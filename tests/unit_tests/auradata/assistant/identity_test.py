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
Who an in-process tool call runs as.

The web configuration of development also sets ``MCP_DEV_USERNAME``, so these tests
set it to the Superset admin of the world: a call that fell through to it would see
everything. ``get_user_from_request`` stays real here, unlike in ``world.as_user``.
"""

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from fastmcp.exceptions import ToolError
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.mcp_service.auth import (
    get_user_from_request,
    InProcessPrincipal,
    run_as,
)
from tests.unit_tests.mcp_service.workspace.world import (
    build_world,
    call as world_call,
    shared_engine,
)


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(session: Session, mocker: MockerFixture) -> Iterator[dict[str, Any]]:
    built = build_world(session, mocker)
    session.commit()
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        security_manager,
        "is_admin",
        side_effect=lambda *_: g.user.username == "root",
    )
    current_app.config["MCP_RBAC_ENABLED"] = True
    current_app.config["MCP_DEV_USERNAME"] = "root"
    yield built
    current_app.config.pop("MCP_DEV_USERNAME")
    current_app.config.pop("MCP_RBAC_ENABLED")


def call(tool: str, request: dict[str, Any]) -> Any:
    return asyncio.run(world_call(tool, request))


def titles(payload: dict[str, Any]) -> set[str]:
    return {item["dashboard_title"] for item in payload["dashboards"]}


def test_without_a_principal_a_call_falls_through_to_the_dev_user(
    world: dict[str, Any],
) -> None:
    """The reason ``run_as`` exists: this is who a bare call would be."""
    assert get_user_from_request().username == "root"


def test_a_principal_comes_before_the_dev_user(world: dict[str, Any]) -> None:
    with run_as(InProcessPrincipal("dani")):
        assert get_user_from_request().username == "dani"


def test_a_tool_sees_what_its_principal_sees(world: dict[str, Any]) -> None:
    with run_as(InProcessPrincipal("root")):
        everything = titles(call("list_dashboards", {}))
    with run_as(InProcessPrincipal("dani")):
        only_public = titles(call("list_dashboards", {}))
    assert everything >= {"Ventas", "Compartido"}
    assert only_public < everything


def test_an_unknown_principal_is_refused_and_never_the_dev_user(
    world: dict[str, Any],
) -> None:
    with run_as(InProcessPrincipal("nobody")):
        with pytest.raises(ToolError, match="not found"):
            call("list_dashboards", {})


def test_a_disabled_principal_is_refused(world: dict[str, Any]) -> None:
    world["users"]["Dani"].active = False
    world["session"].commit()
    with run_as(InProcessPrincipal("dani")):
        with pytest.raises(ToolError, match="disabled"):
            call("list_dashboards", {})


def test_read_scopes_refuse_a_write_inside_the_tool_wrapper(
    world: dict[str, Any],
) -> None:
    """Even for a user who may write, and with no check of the assistant in between."""
    dashboard = world["dashboard"]
    with run_as(InProcessPrincipal("root", frozenset({"superset:read"}))):
        with pytest.raises(ToolError, match="Permission denied: can_write"):
            call("rename_page", {"dashboard": dashboard.id, "page": "1", "name": "X"})


def test_the_principal_ends_with_its_block(world: dict[str, Any]) -> None:
    with run_as(InProcessPrincipal("dani")):
        pass
    assert get_user_from_request().username == "root"
