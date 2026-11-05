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
Dataset reads through the MCP follow the workspace rules of the REST dataset API:
the datasets of a workspace are for its members (``WorkspaceDatasetFilter``), and
its contributors and admins read them without data permissions of their own
(``workspace_grants``). Viewers gain nothing.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.auradata.models import WorkspaceDataset
from superset.connectors.sqla.models import SqlaTable
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """Everyone reads every dataset through their Superset roles."""
    return build_world(session, mocker)


@pytest.fixture
def no_data_world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """Nobody has data permissions; only the dataset tools are open to them."""
    world = build_world(session, mocker, data_access=False)
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: view == "Dataset",
    )
    return world


async def listed(name: str, world: dict[str, Any]) -> list[str]:
    as_user(world, name)
    result = await call("list_datasets", {"page_size": 50})
    return sorted(dataset["table_name"] for dataset in result["datasets"])


async def found(name: str, world: dict[str, Any], dataset: str) -> bool:
    as_user(world, name)
    result = await call("get_dataset_info", {"identifier": world[dataset].id})
    return result.get("error_type") != "not_found"


async def queried(name: str, world: dict[str, Any], dataset: str) -> bool:
    """Whether the query got past the lookup (the table itself does not exist)."""
    as_user(world, name)
    result = await call(
        "query_dataset", {"dataset_id": world[dataset].id, "columns": ["region"]}
    )
    return result.get("error_type") != "NotFound"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Carlos", "Dani"])
async def test_data_access_does_not_open_another_workspace(
    world: dict[str, Any], name: str
) -> None:
    """As in the REST API, a non-member never sees a workspace's datasets."""
    assert await listed(name, world) == ["compartido"]
    assert not await found(name, world, "ventas")
    assert not await queried(name, world, "ventas")
    assert await found(name, world, "compartido")


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Vera", "Ana", "Ada", "Root"])
async def test_members_with_data_access_see_their_workspace(
    world: dict[str, Any], name: str
) -> None:
    assert await listed(name, world) == ["compartido", "ventas"]
    assert await found(name, world, "ventas")
    assert await queried(name, world, "ventas")


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Ada"])
async def test_contributors_read_their_workspace_without_data_access(
    no_data_world: dict[str, Any], name: str
) -> None:
    assert await listed(name, no_data_world) == ["ventas"]
    assert await found(name, no_data_world, "ventas")
    assert await queried(name, no_data_world, "ventas")
    assert not await found(name, no_data_world, "compartido")


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Vera", "Carlos", "Dani"])
async def test_viewers_and_others_read_nothing_without_data_access(
    no_data_world: dict[str, Any], name: str
) -> None:
    assert await listed(name, no_data_world) == []
    assert not await found(name, no_data_world, "ventas")
    assert not await queried(name, no_data_world, "ventas")


@pytest.mark.asyncio
async def test_usable_in_dashboard_narrows_to_its_workspace_and_shared(
    world: dict[str, Any],
) -> None:
    session = world["session"]
    otro = SqlaTable(table_name="otro", database=world["ventas"].database)
    session.add(otro)
    session.flush()
    session.add(
        WorkspaceDataset(workspace_id=world["finanzas_ws"].id, dataset_id=otro.id)
    )
    session.commit()
    as_user(world, "Root")

    in_ventas = await call(
        "list_datasets",
        {"page_size": 50, "usable_in_dashboard": world["dashboard"].id},
    )
    outside = await call(
        "list_datasets",
        {"page_size": 50, "usable_in_dashboard": world["shared_dashboard"].id},
    )

    assert sorted(d["table_name"] for d in in_ventas["datasets"]) == [
        "compartido",
        "ventas",
    ]
    assert [d["table_name"] for d in outside["datasets"]] == ["compartido"]
