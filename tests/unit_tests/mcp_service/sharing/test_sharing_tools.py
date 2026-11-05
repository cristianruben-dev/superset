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
publish_dashboard and share_dashboard answer the same people as the web: Dani
edits the dashboard "Ventas", Ana and Ada contribute to and administer its
workspace, Vera views it, Carlos is in another workspace and Root is a
Superset admin.
"""

from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

import superset.key_value.models  # noqa: F401 (creates its table)
from superset.models.dashboard import Dashboard
from superset.reports.models import ReportSchedule
from superset.subjects.utils import get_or_create_user_subject
from superset.tasks.types import ExecutorType
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

PAGES = (
    '{"ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["TABS-1"]},'
    ' "TABS-1": {"type": "TABS", "id": "TABS-1", "children": ["TAB-a", "TAB-b"]},'
    ' "TAB-a": {"type": "TAB", "id": "TAB-a", "children": [],'
    ' "meta": {"text": "Resumen"}},'
    ' "TAB-b": {"type": "TAB", "id": "TAB-b", "children": [],'
    ' "meta": {"text": "Detalle"}}}'
)


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    dashboard = world["dashboard"]
    dashboard.editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    dashboard.position_json = PAGES
    session.commit()
    mocker.patch.dict(
        current_app.config, {"ALERT_REPORTS_EXECUTORS": [ExecutorType.EDITOR]}
    )
    return world


def published(world: dict[str, Any]) -> bool:
    session = world["session"]
    session.expire_all()
    return session.get(Dashboard, world["dashboard"].id).published


# publish_dashboard


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada", "Root"])
async def test_who_edits_the_report_publishes_it(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    dashboard = world["dashboard"].id
    result = await call(
        "publish_dashboard", {"dashboard": dashboard, "published": False}
    )

    assert result.get("error") is None, result
    assert result["changed"] is True
    assert result["published"] is False
    assert published(world) is False

    result = await call("publish_dashboard", {"dashboard": dashboard})
    assert result["published"] is True
    assert published(world) is True


@pytest.mark.asyncio
async def test_a_viewer_does_not_publish(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    result = await call(
        "publish_dashboard", {"dashboard": world["dashboard"].id, "published": False}
    )

    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert published(world) is True


@pytest.mark.asyncio
async def test_another_workspace_does_not_see_it(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    result = await call(
        "publish_dashboard", {"dashboard": world["dashboard"].id, "published": False}
    )

    assert result["error_type"] == "NotFound"
    assert published(world) is True


@pytest.mark.asyncio
async def test_publishing_twice_changes_nothing(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call("publish_dashboard", {"dashboard": world["dashboard"].id})

    assert result["changed"] is False
    assert result["warnings"] == ["The report was already published."]


@pytest.mark.asyncio
async def test_a_draft_warns_about_reports_that_stop(world: dict[str, Any]) -> None:
    """Vera's report runs as Vera, who doesn't open drafts."""
    session = world["session"]
    vera = world["users"]["Vera"]
    session.add(
        ReportSchedule(
            name="Ventas de Vera",
            type="Report",
            crontab="0 8 * * 1",
            dashboard_id=world["dashboard"].id,
            active=True,
            created_by_fk=vera.id,
            changed_by_fk=vera.id,
            editors=[get_or_create_user_subject(vera.id)],
        )
    )
    session.commit()
    as_user(world, "Dani")
    result = await call(
        "publish_dashboard", {"dashboard": world["dashboard"].id, "published": False}
    )

    assert result["published"] is False
    [warning] = result["warnings"]
    assert "'Ventas de Vera'" in warning
    assert "runs as vera" in warning


# share_dashboard


@pytest.mark.asyncio
async def test_a_viewer_gets_the_link_and_who_to_ask(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    result = await call("share_dashboard", {"dashboard": world["dashboard"].id})

    assert result.get("error") is None, result
    assert result["link"] == result["url"]
    assert result["permalink"] is None
    assert result["published"] is True
    assert result["workspace"]["your_role"] == "viewer"
    assert [e["label"] for e in result["editors"]] == ["Dani T"]
    assert any("Ask an admin" in step for step in result["next_steps"])


@pytest.mark.asyncio
async def test_a_workspace_admin_is_told_how_to_add_people(
    world: dict[str, Any],
) -> None:
    as_user(world, "Ada")
    result = await call("share_dashboard", {"dashboard": world["dashboard"].id})

    workspace_id = world["ventas_ws"].id
    assert any(
        f"set_workspace_member(workspace_id={workspace_id}" in step
        for step in result["next_steps"]
    )


@pytest.mark.asyncio
async def test_a_link_to_one_page_is_a_permalink(world: dict[str, Any]) -> None:
    as_user(world, "Ana")
    result = await call(
        "share_dashboard", {"dashboard": world["dashboard"].id, "page": "Detalle"}
    )

    assert result.get("error") is None, result
    assert result["page"] == "TAB-b"
    assert "/dashboard/p/" in result["permalink"]
    assert result["link"] == result["permalink"]


@pytest.mark.asyncio
async def test_a_draft_says_who_opens_it(world: dict[str, Any]) -> None:
    session = world["session"]
    session.get(Dashboard, world["dashboard"].id).published = False
    session.commit()
    as_user(world, "Dani")
    result = await call("share_dashboard", {"dashboard": world["dashboard"].id})

    assert result["audience"].startswith("A draft")
    assert result["next_steps"][0].startswith("publish_dashboard")
    # Dani edits it but belongs to no workspace: it stays private to members
    assert result["workspace"] is None


@pytest.mark.asyncio
async def test_a_report_of_no_workspace_points_at_workspaces(
    world: dict[str, Any],
) -> None:
    as_user(world, "Root")
    result = await call("share_dashboard", {"dashboard": world["shared_dashboard"].id})

    assert any("move_dashboard_to_workspace" in s for s in result["next_steps"])


@pytest.mark.asyncio
async def test_another_workspace_gets_no_link(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    result = await call("share_dashboard", {"dashboard": world["dashboard"].id})

    assert result["error_type"] == "NotFound"
    assert result["link"] is None
