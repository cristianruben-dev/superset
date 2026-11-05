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
"""The mark of the AI: what a call of the assistant leaves in logs and history."""

from typing import Any

import pytest
from sqlalchemy import event

from superset.auradata.action_log import ASSISTANT_TOOL_CALL, select_records
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ, ToolBox
from superset.extensions import db
from superset.mcp_service.history.utils import field_changes, version_item
from superset.models.core import Log
from superset.utils import json
from superset.utils.log import DBEventLogger
from superset.versioning.activity import (
    ActivityParamsError,
    parse_activity_query_params,
)
from superset.versioning.activity.orchestrator import (
    _saves_by_agent,
    _search,
    BY_ASSISTANT,
)
from superset.versioning.changes import acting_model, AGENT_KIND, state as change_state
from superset.versioning.changes.state import bulk_insert_records
from superset.versioning.changes.table import version_changes_table
from superset.versioning.diff import ChangeRecord
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    login,
    session_engine,
    SONNET,
    world,
)


@pytest.fixture
def logged(mocker: Any) -> Any:
    """The real logger of the action log, whatever the test configuration says."""
    mocker.patch("superset.auradata.assistant.tools.event_logger", DBEventLogger())


def rows_of_the_log() -> list[Log]:
    return db.session.query(Log).filter(Log.action == ASSISTANT_TOOL_CALL).all()


def test_the_action_log_keeps_the_assistant_and_nothing_else_by_that_door() -> None:
    record = [{"tool": "add_page"}]
    assert select_records(ASSISTANT_TOOL_CALL, record) == record
    assert select_records("assistant_other", record) == []


def test_a_call_is_a_row_of_the_log_with_the_tool_and_the_model(
    world: dict[str, Any],  # noqa: F811
    logged: Any,
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_EDIT, SONNET, world["dashboard"].id)
    box.conversation_id = "conv-1"

    outcome = box.call(
        "add_page", {"request": {"dashboard": world["dashboard"].id, "name": "Nueva"}}
    )

    assert not outcome.is_error
    row = rows_of_the_log()[-1]
    payload = json.loads(row.json)
    assert row.user_id == world["users"]["Ana"].id
    assert row.dashboard_id == world["dashboard"].id
    assert row.duration_ms >= 0
    assert payload["tool"] == "add_page"
    assert payload["model"] == SONNET
    assert payload["mode"] == MODE_EDIT
    assert payload["conversation_id"] == "conv-1"
    assert payload["success"] is True


def test_a_call_that_only_reads_is_a_row_too(
    world: dict[str, Any],  # noqa: F811
    logged: Any,
) -> None:
    """Reading takes data out, so it counts."""
    login(world, "Ana")
    box = ToolBox("ana", MODE_READ, SONNET, world["dashboard"].id)

    box.call("get_report_structure", {"request": {"dashboard": 999_999}})

    assert json.loads(rows_of_the_log()[-1].json)["tool"] == "get_report_structure"


def test_a_tool_that_breaks_is_a_failed_row(
    world: dict[str, Any],  # noqa: F811
    logged: Any,
    mocker: Any,
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_READ, SONNET, world["dashboard"].id)
    mocker.patch.object(ToolBox, "_call_tool", side_effect=RuntimeError("boom"))

    outcome = box.call("get_report_structure", {"request": {"dashboard": 1}})

    assert outcome.is_error
    assert json.loads(rows_of_the_log()[-1].json)["success"] is False


def test_a_call_that_never_reached_a_tool_is_no_action(
    world: dict[str, Any],  # noqa: F811
    logged: Any,
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_READ, SONNET, world["dashboard"].id)

    box.call("add_page", {"request": {}})
    assert rows_of_the_log() == []


def test_the_mark_reaches_the_commit_of_the_tool(
    world: dict[str, Any],  # noqa: F811
) -> None:
    """The tool saves on a session of its own, in a task of its own."""
    login(world, "Ana")
    seen: list[str | None] = []

    def listen(_session: Any) -> None:
        seen.append(change_state._acting_model.get())

    event.listen(db.session, "before_commit", listen)
    try:
        ToolBox("ana", MODE_EDIT, SONNET, world["dashboard"].id).call(
            "add_page",
            {"request": {"dashboard": world["dashboard"].id, "name": "Nueva"}},
        )
    finally:
        event.remove(db.session, "before_commit", listen)

    assert SONNET in seen
    assert change_state._acting_model.get() is None


def record() -> ChangeRecord:
    return ChangeRecord(
        kind="field",
        operation="edit",
        path=["dashboard_title"],
        from_value="A",
        to_value="B",
    )


def test_each_entity_of_a_save_gets_the_mark_first(session: Any) -> None:
    version_changes_table.create(session.get_bind(), checkfirst=True)
    records = {("dashboard", 901): [record()], ("chart", 902): [record()]}

    with acting_model(SONNET):
        bulk_insert_records(session, 77, records)
    session.flush()

    rows = (
        session.connection()
        .execute(
            version_changes_table.select()
            .where(version_changes_table.c.transaction_id == 77)
            .order_by(
                version_changes_table.c.entity_id, version_changes_table.c.sequence
            )
        )
        .fetchall()
    )
    assert [(row.entity_id, row.sequence, row.kind) for row in rows] == [
        (901, 0, AGENT_KIND),
        (901, 1, "field"),
        (902, 0, AGENT_KIND),
        (902, 1, "field"),
    ]
    assert rows[0].to_value == {"assistant_model": SONNET}


def test_a_save_of_a_person_has_no_mark(session: Any) -> None:
    version_changes_table.create(session.get_bind(), checkfirst=True)

    bulk_insert_records(session, 78, {("dashboard", 903): [record()]})

    kinds = [
        row.kind
        for row in session.connection().execute(
            version_changes_table.select().where(
                version_changes_table.c.transaction_id == 78
            )
        )
    ]
    assert kinds == ["field"]


def activity_row(transaction: int, kind: str, **fields: Any) -> dict[str, Any]:
    return {
        "transaction_id": transaction,
        "kind": kind,
        "summary": "",
        "entity_name": "",
        "path": [],
        **fields,
    }


def test_the_history_filter_keeps_only_the_saves_of_the_assistant() -> None:
    mark = activity_row(1, AGENT_KIND, to_value={"assistant_model": SONNET})
    made = activity_row(1, "field")
    other = activity_row(2, "field")

    assert _saves_by_agent([mark, made, other]) == [mark, made]


def test_a_search_keeps_the_mark_of_the_saves_it_finds() -> None:
    mark = activity_row(1, AGENT_KIND, to_value={"assistant_model": SONNET})
    found = activity_row(1, "field", summary="Ventas")
    alone = activity_row(2, AGENT_KIND, to_value={"assistant_model": SONNET})

    assert _search([mark, found, alone], "ventas") == [mark, found]


def test_the_history_takes_only_the_filter_it_knows() -> None:
    assert parse_activity_query_params({"by": BY_ASSISTANT})["by"] == BY_ASSISTANT
    assert "by" not in parse_activity_query_params({})
    with pytest.raises(ActivityParamsError):
        parse_activity_query_params({"by": "someone"})


def test_the_mcp_says_who_made_a_version_and_does_not_count_the_mark() -> None:
    mark = {
        "kind": AGENT_KIND,
        "operation": "announce",
        "path": [AGENT_KIND],
        "to_value": {"assistant_model": SONNET},
    }
    change = {"kind": "field", "operation": "edit", "path": ["x"]}

    item = version_item(
        {
            "version_uuid": "aaaaaaaa-0000-5000-8000-000000000001",
            "version_number": 2,
            "operation_type": "update",
            "changes": [mark, change],
        }
    )

    assert item.assistant_model == SONNET
    assert item.change_count == 1
    assert item.change_kinds == ["field"]
    assert field_changes([mark, change]) == [change]
