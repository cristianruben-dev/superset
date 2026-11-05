# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
Undoing a turn of the assistant.

Every tool saves a version of what it changes, so a turn spans several. The
conversation records which version the dashboard and each of its charts were at before
its first change and when it ended, and undoing brings back the first set through the
restore commands of the version history: a dashboard version does not carry the content
of its charts, so each chart that changed is restored as well.

Those commands act as the person who asks, and a restore is a new version of its own,
so an undo can be undone from the history. It stops when the report changed after the
turn: going back would throw away that work too.

What stays: a dataset changed by a turn keeps its change (other reports read it), a
chart the turn created stays out of the report without being deleted, and a chart it
deleted stays in the trash.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from flask_babel import gettext as _

from superset.auradata.assistant.conversations import (
    AssistantConversation,
    ConversationLog,
    pending_turn,
    RECORD_TURN_END,
    RECORD_TURN_START,
    RECORD_UNDONE,
    records_of,
)
from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.daos.version import VersionDAO
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.queries import current_live_version_uuid
from superset.versioning.restore import PrunedChildHistoryError
from superset.versioning.utils import capture_enabled

Versions = dict[str, Any]

UNDONE_NOTE = "The user undid the changes of your last turn."


class UndoError(Exception):
    """A turn that cannot be undone, with the reason for the person."""


class UndoConflictError(UndoError):
    """The report changed after the turn."""


@dataclass
class ChangingTurn:
    """A turn that changed something, by its versions."""

    before: Versions
    after: Versions


def _version_of(model: type, item: Any) -> str | None:
    version = current_live_version_uuid(model, item.id, item.uuid)
    return str(version) if version is not None else None


def report_versions(dashboard_id: int) -> Versions | None:
    """The version of a dashboard and its charts at this moment."""
    if not capture_enabled():
        return None
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return None
    return {
        "dashboard": _version_of(Dashboard, dashboard),
        "charts": {
            str(chart.uuid): _version_of(Slice, chart) for chart in dashboard.slices
        },
    }


def undoable_turn(records: list[dict[str, Any]]) -> ChangingTurn | None:
    """
    The turn an undo goes back over. Turns that changed nothing do not count, as tools
    that write nothing to the report. A turn stopped by a card goes on after the
    decision as the same turn, unless someone worked in between: then an undo stops
    there and keeps that work. Each undo uncovers the turn before it, under that same
    condition.
    """
    turns: list[ChangingTurn] = []
    started: Versions | None = None
    for record in records:
        if record["type"] == RECORD_TURN_START:
            started = record["versions"]
            if record.get("continues") and turns and turns[-1].after == started:
                started = turns[-1].before
        elif record["type"] == RECORD_TURN_END and started is not None:
            if turns and turns[-1].before is started:
                turns[-1].after = record["versions"]
            elif record["versions"] != started:
                turns.append(ChangingTurn(started, record["versions"]))
        elif record["type"] == RECORD_UNDONE and turns:
            undone = turns.pop()
            if turns and turns[-1].after == undone.before:
                turns[-1].after = record["versions"]
    return turns[-1] if turns else None


def can_undo(conversation: AssistantConversation) -> bool:
    return (
        capture_enabled()
        and pending_turn(conversation) is None
        and undoable_turn(records_of(conversation)) is not None
    )


def _target(model: type, item_uuid: UUID, version: str | None) -> UUID:
    """
    The version to go back to. Something never saved since versions began has none
    when the turn starts: its first change saves what it was as the first version.
    """
    if version is not None:
        return UUID(version)
    versions = VersionDAO.list_versions(model, item_uuid) or []
    if not versions:
        raise UndoError(_("This version of the report no longer exists."))
    return UUID(str(versions[0]["version_uuid"]))


def _restore(
    command_cls: type, model: type, item_uuid: UUID, version: str | None
) -> Any:
    return command_cls(item_uuid, _target(model, item_uuid, version)).run()


def _restore_dashboard(dashboard_id: int, turn: ChangingTurn) -> None:
    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None or turn.before["dashboard"] == turn.after["dashboard"]:
        return
    command = RestoreDashboardVersionCommand
    try:
        _restore(command, Dashboard, dashboard.uuid, turn.before["dashboard"])
    except command.not_found_exc as ex:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        raise UndoError(_("This version of the report no longer exists.")) from ex
    except command.forbidden_exc as ex:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        raise UndoError(_("You can't restore this report.")) from ex
    except (PrunedChildHistoryError, command.failed_exc) as ex:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        raise UndoError(str(ex)) from ex


def _restore_charts(turn: ChangingTurn) -> list[str]:
    """Bring back the charts that changed. Those that cannot be are left out."""
    command = RestoreChartVersionCommand
    skipped = []
    for chart_uuid, version in turn.before["charts"].items():
        if turn.after["charts"].get(chart_uuid) == version:
            continue
        try:
            _restore(command, Slice, UUID(chart_uuid), version)
        except (
            UndoError,
            PrunedChildHistoryError,
            command.not_found_exc,
            command.forbidden_exc,
            command.failed_exc,
        ):
            db.session.rollback()  # pylint: disable=consider-using-transaction
            skipped.append(chart_uuid)
    return skipped


def undo_last_turn(
    conversation: AssistantConversation,
    dashboard_id: int,
    log: ConversationLog,
    note: dict[str, Any],
) -> list[str]:
    """
    Go back to before the last turn that changed something, as the person asking.
    ``note`` joins the conversation, so the model knows on its next turn. Returns the
    charts that could not be brought back.
    """
    turn = undoable_turn(records_of(conversation))
    if turn is None or not capture_enabled():
        raise UndoError(_("There is nothing of the assistant to undo."))
    if report_versions(dashboard_id) != turn.after:
        raise UndoConflictError(
            _(
                "The report changed after the assistant's turn. "
                "Go back from its version history instead."
            )
        )
    _restore_dashboard(dashboard_id, turn)
    skipped = _restore_charts(turn)
    log.add_undone(report_versions(dashboard_id), note)
    return skipped
