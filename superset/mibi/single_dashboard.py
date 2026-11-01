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
Single-dashboard charts: every chart belongs to at most one dashboard.

Upstream Superset treats charts as standalone objects that any number of dashboards
can reuse. AuraData BI follows the Power BI model instead, where a visual lives
inside one report. The rule is controlled by ``MIBI_SINGLE_DASHBOARD_CHARTS``.

It is enforced in two layers:

* The commands and importers that attach charts to dashboards validate the request
  up front and return a readable 422 error (``validate_chart_dashboards`` and
  ``validate_dashboard_charts``).
* An ORM safety net (``register_listeners``) checks every flush that adds a
  chart/dashboard link, so a code path that skips validation still cannot persist a
  chart in two dashboards. Code that writes ``dashboard_slices`` with Core statements
  bypasses the ORM and calls ``assert_single_dashboard`` itself.

A database unique constraint would be stricter, but it needs a migration, and fork
migrations conflict with the ones every Superset release ships.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from flask import current_app, has_app_context
from flask_babel import gettext as __, lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy import event, func, inspect, select
from sqlalchemy.orm import Session

from superset import db
from superset.commands.exceptions import CommandInvalidError
from superset.models.dashboard import Dashboard, dashboard_slices
from superset.models.slice import Slice
from superset.utils import json

CONFIG_KEY = "MIBI_SINGLE_DASHBOARD_CHARTS"

# session.info key holding the charts whose dashboard links changed in a flush
_TOUCHED_CHARTS_KEY = "mibi_single_dashboard_touched_charts"


def is_enabled() -> bool:
    """Whether the single-dashboard rule is active for the current app."""
    return has_app_context() and bool(current_app.config.get(CONFIG_KEY, False))


class ChartInMultipleDashboardsError(CommandInvalidError):
    """Raised when a write would leave a chart in more than one dashboard."""

    def __init__(self, conflicts: dict[int, set[int]]) -> None:
        self.conflicts = conflicts
        super().__init__(
            _(
                "A chart can only belong to one dashboard. Charts in more than one "
                "dashboard: %(details)s",
                details=_format_conflicts(conflicts),
            )
        )


def _format_conflicts(conflicts: dict[int, set[int]]) -> str:
    return "; ".join(
        f"chart {chart_id} -> dashboards {sorted(dashboard_ids)}"
        for chart_id, dashboard_ids in sorted(conflicts.items())
    )


def get_chart_dashboard_ids(
    chart_ids: Iterable[int],
    session: Session | None = None,
) -> dict[int, set[int]]:
    """
    Map each chart to the dashboards it is attached to.

    :param chart_ids: The charts to look up
    :param session: The session to query with, defaults to ``db.session``
    :returns: ``{chart_id: {dashboard_id, ...}}`` for the charts that have dashboards
    """
    ids = {chart_id for chart_id in chart_ids if chart_id is not None}
    if not ids:
        return {}

    rows = (session or db.session).execute(
        select(dashboard_slices.c.slice_id, dashboard_slices.c.dashboard_id).where(
            dashboard_slices.c.slice_id.in_(ids)
        )
    )
    result: dict[int, set[int]] = defaultdict(set)
    for chart_id, dashboard_id in rows:
        result[chart_id].add(dashboard_id)
    return dict(result)


def find_charts_in_other_dashboards(
    chart_ids: Iterable[int],
    dashboard_id: int | None,
    session: Session | None = None,
) -> dict[int, set[int]]:
    """
    Find the charts that are attached to a dashboard other than ``dashboard_id``.

    :param chart_ids: The charts that are about to be attached to ``dashboard_id``
    :param dashboard_id: The target dashboard, or None for a dashboard not yet saved
    :param session: The session to query with, defaults to ``db.session``
    :returns: ``{chart_id: {other_dashboard_id, ...}}`` for the conflicting charts
    """
    conflicts: dict[int, set[int]] = {}
    for chart_id, dashboard_ids in get_chart_dashboard_ids(chart_ids, session).items():
        if others := dashboard_ids - {dashboard_id}:
            conflicts[chart_id] = others
    return conflicts


def find_charts_in_multiple_dashboards(
    chart_ids: Iterable[int] | None = None,
    session: Session | None = None,
) -> dict[int, set[int]]:
    """
    Find the charts attached to more than one dashboard.

    :param chart_ids: Limit the check to these charts, or check every chart if None
    :param session: The session to query with, defaults to ``db.session``
    :returns: ``{chart_id: {dashboard_id, ...}}`` for the charts that break the rule
    """
    session = session or db.session
    if chart_ids is None:
        shared = (
            select(dashboard_slices.c.slice_id)
            .group_by(dashboard_slices.c.slice_id)
            .having(func.count(func.distinct(dashboard_slices.c.dashboard_id)) > 1)
        )
        chart_ids = [row[0] for row in session.execute(shared)]

    return {
        chart_id: dashboard_ids
        for chart_id, dashboard_ids in get_chart_dashboard_ids(
            chart_ids, session
        ).items()
        if len(dashboard_ids) > 1
    }


def assert_single_dashboard(
    chart_ids: Iterable[int] | None = None,
    session: Session | None = None,
) -> None:
    """
    Raise if any of the charts is attached to more than one dashboard.

    Call it after writing ``dashboard_slices`` with Core statements, which the ORM
    safety net does not see.

    :param chart_ids: The charts to check, or every chart if None
    :param session: The session to query with, defaults to ``db.session``
    :raises ChartInMultipleDashboardsError: If the rule is broken
    """
    if not is_enabled():
        return
    if conflicts := find_charts_in_multiple_dashboards(chart_ids, session):
        raise ChartInMultipleDashboardsError(conflicts)


def validate_chart_dashboards(
    chart: Slice | None,
    dashboard_ids: Iterable[int | None],
    field_name: str = "dashboards",
) -> ValidationError | None:
    """
    Validate the dashboards a chart is saved into.

    A chart may be saved into a single dashboard. When it already belongs to one, it
    can stay there or be detached, but not be moved to another dashboard, because
    the old dashboard layout would keep pointing at it.

    :param chart: The chart being updated, or None when it is being created
    :param dashboard_ids: The dashboards requested for the chart; None stands for a
        dashboard created in the same request
    :param field_name: The request field to attach the error to
    :returns: The validation error, or None if the request is valid
    """
    if not is_enabled():
        return None

    requested = set(dashboard_ids)
    if len(requested) > 1:
        return ValidationError(
            __("A chart can only belong to one dashboard."), field_name=field_name
        )

    if chart is None or chart.id is None or not requested:
        return None

    current = get_chart_dashboard_ids([chart.id]).get(chart.id, set())
    if current and requested - current:
        return ValidationError(
            __(
                "This chart already belongs to another dashboard. Charts can't be "
                "moved or shared between dashboards."
            ),
            field_name=field_name,
        )
    return None


def validate_dashboard_charts(
    dashboard_id: int | None,
    chart_ids: Iterable[int],
    field_name: str = "json_metadata",
) -> ValidationError | None:
    """
    Validate the charts a dashboard is saved with.

    :param dashboard_id: The dashboard being saved, or None when it is being created
    :param chart_ids: The charts in the dashboard layout
    :param field_name: The request field to attach the error to
    :returns: The validation error, or None if the request is valid
    """
    if not is_enabled():
        return None

    if conflicts := find_charts_in_other_dashboards(chart_ids, dashboard_id):
        return ValidationError(
            __(
                "A chart can only belong to one dashboard. These charts already "
                "belong to another dashboard: %(chart_ids)s",
                chart_ids=", ".join(str(chart_id) for chart_id in sorted(conflicts)),
            ),
            field_name=field_name,
        )
    return None


def validate_dashboard_layout(
    dashboard_id: int,
    json_metadata: str | None,
    exceptions: list[ValidationError],
) -> None:
    """
    Validate the charts in the layout a dashboard is saved with.

    :param dashboard_id: The dashboard being saved
    :param json_metadata: The json_metadata of the request, which carries the layout
        in ``positions``
    :param exceptions: The list the validation error is appended to
    """
    if not json_metadata:
        return
    try:
        positions = json.loads(json_metadata).get("positions")
    except (AttributeError, TypeError, ValueError):
        return
    if isinstance(positions, dict) and (
        error := validate_dashboard_charts(
            dashboard_id, get_position_chart_ids(positions)
        )
    ):
        exceptions.append(error)


def get_position_chart_ids(positions: dict[str, Any]) -> list[int]:
    """
    Extract the chart ids from a dashboard layout.

    :param positions: The dashboard ``positions`` / ``position_json`` mapping
    :returns: The chart ids referenced by the layout
    """
    return [
        chart_id
        for value in positions.values()
        if isinstance(value, dict)
        and (chart_id := (value.get("meta") or {}).get("chartId"))
    ]


def _collect_touched_charts(
    session: Session,
    _flush_context: Any,
    _instances: Any,
) -> None:
    """Remember the charts whose dashboard links this flush adds."""
    touched: list[Slice] = []
    if is_enabled():
        for obj in (*session.new, *session.dirty):
            if isinstance(obj, Dashboard):
                touched.extend(inspect(obj).attrs.slices.history.added or ())
            elif isinstance(obj, Slice) and inspect(obj).attrs.dashboards.history.added:
                touched.append(obj)
    session.info[_TOUCHED_CHARTS_KEY] = touched


def _check_touched_charts(session: Session, _flush_context: Any) -> None:
    """
    Reject the flush if it left a chart in more than one dashboard.

    Runs after the statements are emitted but inside the flush transaction, so
    raising here rolls the flush back.
    """
    touched: list[Slice] = session.info.pop(_TOUCHED_CHARTS_KEY, [])
    if chart_ids := {chart.id for chart in touched if chart.id is not None}:
        assert_single_dashboard(chart_ids, session)


def register_listeners() -> None:
    """Install the ORM safety net. Safe to call more than once."""
    for identifier, listener in (
        ("before_flush", _collect_touched_charts),
        ("after_flush", _check_touched_charts),
    ):
        if not event.contains(Session, identifier, listener):
            event.listen(Session, identifier, listener)
