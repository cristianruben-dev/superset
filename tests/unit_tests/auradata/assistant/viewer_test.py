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

from typing import Any

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


def test_a_viewer_without_data_permissions_gets_no_rows_from_any_tool(
    world: dict[str, Any],
) -> None:
    """
    The dataset and the chart look missing: the list filters hide them before any
    access check, as they do for anyone without access. So the answer has no figure.
    """
    assert error_type_of(query(world, "Vera")) == "NotFound"
    assert error_type_of(chart_data(world, "Vera")) == "NotFound"


def test_the_charts_of_the_dashboard_are_refused_to_that_viewer_too(
    world: dict[str, Any],
) -> None:
    """The panel is not behind the page: this person sees no chart there either."""
    assert not chart_query_is_allowed(world, "Vera")


def test_a_contributor_reaches_the_query_through_the_workspace_grant(
    world: dict[str, Any],
) -> None:
    """The control: the refusal above comes from the viewer role, not from the setup."""
    assert error_type_of(query(world, "Ana")) == "QueryError"
    assert chart_query_is_allowed(world, "Ana")


def test_a_viewer_whose_role_reads_the_dataset_queries_it(
    world: dict[str, Any],
) -> None:
    """What a viewer needs today: ``datasource_access`` from a role, nothing else."""
    perm = world["ventas"].perm
    world["granted"].add(("datasource_access", perm))
    security_manager.user_view_menu_names.return_value = {perm}

    assert error_type_of(query(world, "Vera")) == "QueryError"
    assert chart_query_is_allowed(world, "Vera")
