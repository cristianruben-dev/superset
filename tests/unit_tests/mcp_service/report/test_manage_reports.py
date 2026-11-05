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
Scheduled reports and alerts of a report, for the same people as the web: Dani
edits the dashboard "Ventas", Ana and Ada contribute to and administer its
workspace, Vera views it, Carlos is in another workspace and Root is a
Superset admin. A report runs as its editor, who must open the dashboard: the
tools refuse up front a report that would stop running.
"""

from typing import Any

import pytest
from fastmcp.exceptions import ToolError
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.reports.models import ReportSchedule
from superset.subjects.utils import get_or_create_user_subject
from superset.tasks.types import ExecutorType, FixedExecutor
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

REPORT = {
    "name": "Ventas semanal",
    "crontab": "0 8 * * 1",
    "recipients": ["jefa@ventas.example.com"],
}


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    world["dashboard"].editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    session.commit()
    mocker.patch.dict(
        current_app.config,
        {
            "ALERT_REPORTS_EXECUTORS": [ExecutorType.EDITOR],
            "ALERT_REPORTS_NOTIFICATION_DRY_RUN": True,
        },
    )
    return world


def draft(world: dict[str, Any]) -> None:
    session = world["session"]
    session.get(Dashboard, world["dashboard"].id).published = False
    session.commit()


def reports(world: dict[str, Any]) -> list[ReportSchedule]:
    session = world["session"]
    session.expire_all()
    return session.query(ReportSchedule).all()


async def create(world: dict[str, Any], **fields: Any) -> dict[str, Any]:
    return await call(
        "create_report", {"dashboard": world["dashboard"].id, **REPORT, **fields}
    )


# create_report


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada", "Vera", "Root"])
async def test_who_opens_a_published_report_schedules_it(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    result = await create(world)

    assert result["success"] is True, result
    assert result["executor"] == name.lower()
    assert result["recipients"] == ["jefa@ventas.example.com"]
    assert result["dry_run"] is True
    assert result["url"].endswith("/report/list/")
    [report] = reports(world)
    assert report.dashboard_id == world["dashboard"].id
    assert report.type == "Report"
    assert report.creation_method == "alerts_reports"


@pytest.mark.asyncio
async def test_another_workspace_does_not_see_the_dashboard(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    result = await create(world)

    assert result["success"] is False
    assert result["error_type"] == "NotFound"
    assert reports(world) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada"])
async def test_who_edits_a_draft_schedules_it_with_a_warning(
    world: dict[str, Any], name: str
) -> None:
    draft(world)
    as_user(world, name)
    result = await create(world)

    assert result["success"] is True, result
    assert any("draft" in warning for warning in result["warnings"])


@pytest.mark.asyncio
async def test_a_viewer_does_not_see_a_draft(world: dict[str, Any]) -> None:
    draft(world)
    as_user(world, "Vera")
    result = await create(world)

    assert result["error_type"] == "NotFound"
    assert reports(world) == []


@pytest.mark.asyncio
async def test_an_executor_who_cant_open_the_draft_is_refused(
    world: dict[str, Any],
) -> None:
    """The report would run as Vera, who doesn't open drafts."""
    current_app.config["ALERT_REPORTS_EXECUTORS"] = [FixedExecutor("vera")]
    draft(world)
    as_user(world, "Dani")
    result = await create(world)

    assert result["success"] is False
    assert result["error_type"] == "ExecutorCannotOpenDashboard"
    assert "publish_dashboard" in result["error"]
    assert "vera" in result["error"]
    assert reports(world) == []


@pytest.mark.asyncio
async def test_recipients_are_only_the_ones_given(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await create(world, recipients=["no-es-un-correo"])

    assert result["success"] is False
    assert result["error_type"] == "InvalidRequest"
    assert reports(world) == []

    with pytest.raises(ToolError, match="at least 1 item"):
        await create(world, recipients=[])
    assert reports(world) == []


@pytest.mark.asyncio
async def test_a_report_of_one_page(world: dict[str, Any]) -> None:
    session = world["session"]
    dashboard = session.get(Dashboard, world["dashboard"].id)
    dashboard.position_json = (
        '{"ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["TABS-1"]},'
        ' "TABS-1": {"type": "TABS", "id": "TABS-1", "children": ["TAB-a", "TAB-b"]},'
        ' "TAB-a": {"type": "TAB", "id": "TAB-a", "children": [],'
        ' "meta": {"text": "Resumen"}},'
        ' "TAB-b": {"type": "TAB", "id": "TAB-b", "children": [],'
        ' "meta": {"text": "Detalle"}}}'
    )
    session.commit()
    as_user(world, "Dani")
    result = await create(world, page="Detalle", format="PDF")

    assert result["success"] is True, result
    [report] = reports(world)
    assert report.report_format == "PDF"
    assert '"activeTabs": ["TAB-b"]' in report.extra_json


# create_alert


@pytest.mark.asyncio
async def test_an_alert_with_a_condition(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call(
        "create_alert",
        {
            "dashboard": world["dashboard"].id,
            **REPORT,
            "database": world["ventas"].database.id,
            "sql": "SELECT 1",
            "condition": {"op": ">", "threshold": 0},
        },
    )

    assert result["success"] is True, result
    assert result["url"].endswith("/alert/list/")
    [alert] = reports(world)
    assert alert.type == "Alert"
    assert alert.validator_type == "operator"


@pytest.mark.asyncio
async def test_an_alert_needs_a_threshold(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call(
        "create_alert",
        {
            "dashboard": world["dashboard"].id,
            **REPORT,
            "database": world["ventas"].database.id,
            "sql": "SELECT 1",
            "condition": {"op": ">"},
        },
    )

    assert result["success"] is False
    assert "threshold" in result["error"]
    assert reports(world) == []


# update_report and delete_report


@pytest.mark.asyncio
async def test_the_editor_of_a_report_changes_it(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    created = await create(world)
    result = await call(
        "update_report",
        {"report": created["report"]["id"], "crontab": "0 9 * * *", "active": False},
    )

    assert result["success"] is True, result
    [report] = reports(world)
    assert report.crontab == "0 9 * * *"
    assert report.active is False


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Vera", "Carlos"])
async def test_others_dont_change_or_delete_it(
    world: dict[str, Any], name: str
) -> None:
    """A report belongs to its editors, whatever their workspace role."""
    as_user(world, "Dani")
    created = await create(world)
    as_user(world, name)

    result = await call(
        "update_report", {"report": created["report"]["id"], "crontab": "0 9 * * *"}
    )
    assert result["success"] is False
    assert result["error_type"] in {"NotFound", "Forbidden"}

    result = await call("delete_report", {"report": created["report"]["id"]})
    assert result["success"] is False
    assert reports(world)[0].crontab == "0 8 * * 1"


@pytest.mark.asyncio
async def test_an_admin_changes_any_report(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    created = await create(world)
    as_user(world, "Root")
    result = await call(
        "update_report", {"report": created["report"]["id"], "name": "Semanal"}
    )

    assert result["success"] is True, result
    assert reports(world)[0].name == "Semanal"


@pytest.mark.asyncio
async def test_a_change_checks_the_executor_again(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    created = await create(world)
    draft(world)
    current_app.config["ALERT_REPORTS_EXECUTORS"] = [FixedExecutor("vera")]
    result = await call(
        "update_report", {"report": created["report"]["id"], "crontab": "0 9 * * *"}
    )

    assert result["error_type"] == "ExecutorCannotOpenDashboard"
    assert reports(world)[0].crontab == "0 8 * * 1"


@pytest.mark.asyncio
async def test_the_editor_deletes_it(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    created = await create(world)
    result = await call("delete_report", {"report": created["report"]["id"]})

    assert result["success"] is True, result
    assert result["deleted_id"] == created["report"]["id"]
    assert reports(world) == []
