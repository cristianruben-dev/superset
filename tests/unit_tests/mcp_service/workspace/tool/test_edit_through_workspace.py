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
Contributors and admins of a workspace edit its dashboards and charts through the
MCP as in the web, without becoming their editors; viewers and members of other
workspaces do not.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

EDITORS = ["Ana", "Ada", "Root"]


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    return build_world(session, mocker)


def fresh(world: dict[str, Any], model: type, pk: int) -> Any:
    session = world["session"]
    session.expire_all()
    return session.get(model, pk)


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
async def test_workspace_editors_update_its_dashboard(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    pk = world["dashboard"].id
    result = await call("update_dashboard", {"identifier": pk, "dashboard_title": "Q4"})

    assert result.get("error") is None, result
    dashboard = fresh(world, Dashboard, pk)
    assert dashboard.dashboard_title == "Q4"
    # A workspace role never makes anyone an editor
    assert list(dashboard.editors) == []


@pytest.mark.asyncio
async def test_a_viewer_cannot_update_the_dashboard(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    pk = world["dashboard"].id
    result = await call("update_dashboard", {"identifier": pk, "dashboard_title": "Q4"})

    assert result["permission_denied"] is True
    assert fresh(world, Dashboard, pk).dashboard_title == "Ventas"


@pytest.mark.asyncio
async def test_another_workspace_cannot_update_the_dashboard(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    pk = world["dashboard"].id
    result = await call("update_dashboard", {"identifier": pk, "dashboard_title": "Q4"})

    assert result.get("error")
    assert fresh(world, Dashboard, pk).dashboard_title == "Ventas"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
async def test_workspace_editors_rename_its_chart(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    pk = world["chart"].id
    result = await call(
        "update_chart",
        {"identifier": pk, "chart_name": "kpi Q4", "generate_preview": False},
    )

    assert result.get("error") is None, result
    chart = fresh(world, Slice, pk)
    assert chart.slice_name == "kpi Q4"
    assert list(chart.editors) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Vera", "Carlos"])
async def test_others_cannot_rename_the_chart(world: dict[str, Any], name: str) -> None:
    as_user(world, name)
    pk = world["chart"].id
    result = await call(
        "update_chart",
        {"identifier": pk, "chart_name": "kpi Q4", "generate_preview": False},
    )

    assert result.get("error")
    assert fresh(world, Slice, pk).slice_name == "kpi"


def layout_of(chart_id: int) -> dict[str, Any]:
    """A layout of one row holding the chart."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-1"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "CHART-1": {
            "type": "CHART",
            "id": "CHART-1",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "meta": {"chartId": chart_id, "width": 8, "height": 6},
        },
    }


def new_chart(world: dict[str, Any]) -> Slice:
    chart = Slice(
        slice_name="nuevo",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=world["ventas"].id,
    )
    world["session"].add(chart)
    world["session"].commit()
    return chart


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Root", True), ("Vera", False), ("Carlos", False)],
)
async def test_adding_and_removing_charts_follows_the_workspace_role(
    world: dict[str, Any], name: str, allowed: bool
) -> None:
    dashboard_id = world["dashboard"].id
    chart = world["chart"]
    as_user(world, name)

    removed = await call(
        "remove_chart_from_dashboard",
        {"dashboard_id": dashboard_id, "chart_id": chart.id},
    )

    assert (removed.get("error") is None) is allowed, removed
    dashboard = fresh(world, Dashboard, dashboard_id)
    assert (chart.id in {s.id for s in dashboard.slices}) is not allowed


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Root", True), ("Vera", False), ("Carlos", False)],
)
async def test_adding_a_chart_follows_the_workspace_role(
    world: dict[str, Any], name: str, allowed: bool
) -> None:
    dashboard_id = world["dashboard"].id
    chart = new_chart(world)
    as_user(world, name)

    added = await call(
        "add_chart_to_existing_dashboard",
        {"dashboard_id": dashboard_id, "chart_id": chart.id},
    )

    assert (added.get("error") is None) is allowed, added
    dashboard = fresh(world, Dashboard, dashboard_id)
    assert (chart.id in {s.id for s in dashboard.slices}) is allowed


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Root", True), ("Vera", False), ("Carlos", False)],
)
async def test_native_filters_follow_the_workspace_role(
    world: dict[str, Any], name: str, allowed: bool
) -> None:
    dashboard_id = world["dashboard"].id
    as_user(world, name)

    result = await call(
        "manage_native_filters",
        {
            "dashboard_id": dashboard_id,
            "add": [
                {
                    "filter_type": "filter_select",
                    "name": "Región",
                    "dataset_id": world["ventas"].id,
                    "column": "region",
                }
            ],
        },
    )

    assert (result.get("error") is None) is allowed, result
    metadata = fresh(world, Dashboard, dashboard_id).json_metadata or ""
    assert ("NATIVE_FILTER-" in metadata) is allowed


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Root", True), ("Vera", False), ("Carlos", False)],
)
async def test_deleting_follows_the_workspace_role(
    world: dict[str, Any], name: str, allowed: bool
) -> None:
    chart_id = world["chart"].id
    dashboard_id = world["dashboard"].id
    as_user(world, name)

    chart = await call("delete_chart", {"identifier": chart_id})
    dashboard = await call("delete_dashboard", {"identifier": dashboard_id})

    assert chart["success"] is allowed, chart
    assert dashboard["success"] is allowed, dashboard
    if not allowed:
        assert fresh(world, Slice, chart_id) is not None
        assert fresh(world, Dashboard, dashboard_id) is not None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Root", True), ("Vera", False), ("Carlos", False)],
)
async def test_copying_a_dashboard_follows_the_workspace_role(
    world: dict[str, Any], name: str, allowed: bool
) -> None:
    session = world["session"]
    world["dashboard"].position_json = json.dumps(layout_of(world["chart"].id))
    session.commit()
    as_user(world, name)

    result = await call(
        "duplicate_dashboard",
        {"dashboard_id": world["dashboard"].id, "dashboard_title": "Copia"},
    )

    assert (result.get("error") is None) is allowed, result
    session.expire_all()
    copies = session.query(Dashboard).filter_by(dashboard_title="Copia").all()
    assert len(copies) == (1 if allowed else 0)


@pytest.mark.asyncio
async def test_a_contributor_does_not_certify(world: dict[str, Any]) -> None:
    """A contributor edits the report but does not certify it."""
    pk = world["dashboard"].id
    as_user(world, "Ana")

    result = await call(
        "manage_dashboard_certification",
        {"identifier": pk, "certified_by": "Finanzas"},
    )

    assert result["permission_denied"] is True
    assert fresh(world, Dashboard, pk).certified_by is None


@pytest.mark.asyncio
async def test_an_admin_of_the_workspace_certifies(world: dict[str, Any]) -> None:
    """The admins of its workspace certify a report without being its editors."""
    pk = world["dashboard"].id
    as_user(world, "Ada")

    result = await call(
        "manage_dashboard_certification",
        {"identifier": pk, "certified_by": "Finanzas"},
    )

    assert not result.get("permission_denied")
    assert fresh(world, Dashboard, pk).certified_by == "Finanzas"


@pytest.fixture
def no_data_world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """Nobody has data permissions: only the workspace grant reads "ventas"."""
    world = build_world(session, mocker, data_access=False)
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: view in ("Dataset", "Dashboard", "Chart"),
    )
    return world


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "allowed"),
    [("Ana", True), ("Ada", True), ("Vera", False), ("Dani", False)],
)
async def test_edits_need_no_data_permissions_beyond_the_workspace(
    no_data_world: dict[str, Any], name: str, allowed: bool
) -> None:
    """A contributor whose only data access is the workspace grant edits too."""
    world = no_data_world
    dashboard_id = world["dashboard"].id
    chart_id = world["chart"].id
    extra = new_chart(world)
    as_user(world, name)

    results = {
        "update_dashboard": await call(
            "update_dashboard", {"identifier": dashboard_id, "dashboard_title": "Q4"}
        ),
        "update_chart": await call(
            "update_chart",
            {"identifier": chart_id, "chart_name": "kpi Q4", "generate_preview": False},
        ),
        "add_chart": await call(
            "add_chart_to_existing_dashboard",
            {"dashboard_id": dashboard_id, "chart_id": extra.id},
        ),
        "native_filters": await call(
            "manage_native_filters",
            {
                "dashboard_id": dashboard_id,
                "add": [
                    {
                        "filter_type": "filter_select",
                        "name": "Región",
                        "dataset_id": world["ventas"].id,
                        "column": "region",
                    }
                ],
            },
        ),
        "remove_chart": await call(
            "remove_chart_from_dashboard",
            {"dashboard_id": dashboard_id, "chart_id": chart_id},
        ),
    }

    outcomes = {tool: result.get("error") is None for tool, result in results.items()}
    assert outcomes == dict.fromkeys(results, allowed), results
