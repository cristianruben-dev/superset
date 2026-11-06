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
What a workspace viewer gets from read mode, through the real tools.

Nobody here holds a data permission: ``can_access`` answers as the Gamma role does on
the class permissions of the tools and says no to ``datasource_access``, so only the
checks of the product decide. ``chat_test.world`` says yes to everything and could not
tell any of this apart.
"""

import asyncio
from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine

from superset import security_manager
from superset.auradata.assistant.tools import MODE_READ, ToolBox
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from tests.unit_tests.mcp_service.workspace.world import build_world, shared_engine

# What the Gamma role holds over the classes these tools ask for
GAMMA = {
    ("can_read", "Chart"),
    ("can_read", "Dashboard"),
    ("can_read", "Dataset"),
    ("can_get_drill_info", "Dataset"),
}


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(session: Any, mocker: MockerFixture, full_api_access: None) -> dict[str, Any]:
    built = build_world(session, mocker, data_access=False)
    built["granted"] = set(GAMMA)
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: (permission, view) in built["granted"],
    )
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.dict(
        current_app.config, {"MCP_DEV_USERNAME": "root", "MCP_RBAC_ENABLED": True}
    )
    return built


def sign_in(world: dict[str, Any], name: str) -> None:
    g.user = world["users"][name]


def text_of(outcome: Any) -> str:
    return " ".join(block.get("text", "") for block in outcome.content)


def query(world: dict[str, Any], name: str) -> Any:
    sign_in(world, name)
    return ToolBox(name.lower(), MODE_READ).call(
        "query_dataset",
        {
            "request": {
                "dataset_id": world["ventas"].id,
                "metrics": ["total"],
                "columns": ["region"],
            }
        },
    )


def chart_data(world: dict[str, Any], name: str) -> Any:
    sign_in(world, name)
    return ToolBox(name.lower(), MODE_READ).call(
        "get_chart_data", {"request": {"identifier": world["chart"].id}}
    )


def chart_query_is_allowed(world: dict[str, Any], name: str) -> bool:
    """The check of the request a chart of the dashboard sends to the chart data API."""
    sign_in(world, name)
    context = world["mocker"].MagicMock(
        datasource=world["ventas"],
        form_data={
            "slice_id": world["chart"].id,
            "dashboardId": world["dashboard"].id,
        },
    )
    try:
        security_manager.raise_for_access(query_context=context)
    except SupersetSecurityException:
        return False
    return True


def test_read_mode_offers_query_dataset_to_a_viewer(world: dict[str, Any]) -> None:
    sign_in(world, "Vera")
    names = ToolBox("vera", MODE_READ).names

    assert "query_dataset" in names
    assert "get_chart_data" in names


def error_type_of(outcome: Any) -> str:
    return json.loads(outcome.content[0]["text"])["error_type"]


def test_a_viewer_reaches_the_figures_through_the_workspace_grant(
    world: dict[str, Any],
) -> None:
    """
    The tools get past every access check: the table does not exist in the test
    database, so the only thing left to fail is the query itself.
    """
    assert error_type_of(query(world, "Vera")) == "QueryError"
    assert error_type_of(chart_data(world, "Vera")) != "NotFound"


def test_the_charts_of_the_dashboard_open_to_that_viewer_too(
    world: dict[str, Any],
) -> None:
    """The panel is not ahead of the page: this person sees the same charts there."""
    assert chart_query_is_allowed(world, "Vera")


def test_someone_outside_the_workspace_gets_no_rows_from_any_tool(
    world: dict[str, Any],
) -> None:
    """
    The control: the dataset and the chart look missing, because the list filters
    hide them before any access check. So the answer has no figure.
    """
    assert error_type_of(query(world, "Dani")) == "NotFound"
    assert error_type_of(chart_data(world, "Dani")) == "NotFound"
    assert not chart_query_is_allowed(world, "Dani")


def test_a_contributor_reaches_the_query_through_the_workspace_grant(
    world: dict[str, Any],
) -> None:
    assert error_type_of(query(world, "Ana")) == "QueryError"
    assert chart_query_is_allowed(world, "Ana")


def test_a_role_with_access_to_the_dataset_opens_the_chart_query(
    world: dict[str, Any],
) -> None:
    """A role still opens a dataset to someone outside its workspace's grant."""
    perm = world["ventas"].perm
    world["granted"].add(("datasource_access", perm))
    cast(MagicMock, security_manager.user_view_menu_names).return_value = {perm}

    assert chart_query_is_allowed(world, "Dani")


def test_a_tool_stays_with_its_person_on_a_thread_with_a_running_loop(
    world: dict[str, Any],
) -> None:
    """
    A worker that took a screenshot keeps a loop running on its thread, so a tool runs
    in a thread of its own. Who it runs as has to go with it, and nobody else's access.
    """

    async def after_a_screenshot() -> list[Any]:
        return [query(world, name) for name in ("Vera", "Dani")]

    vera, dani = asyncio.run(after_a_screenshot())

    # Past every check: only this test database has no such table
    assert "no such table" in text_of(vera)
    assert "no such table" not in text_of(dani)
