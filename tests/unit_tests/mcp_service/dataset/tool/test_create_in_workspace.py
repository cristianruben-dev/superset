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
create_dataset and create_virtual_dataset create a dataset inside a workspace,
as the web's side panel does: contributors and admins of the workspace only,
and the charts of its dashboards can then use it.
"""

import sqlite3
from pathlib import Path
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.auradata.models import WorkspaceDataset
from superset.auradata.workspace_datasets import validate_chart_dataset
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
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
def world(mocker: MockerFixture, session: Session, tmp_path: Path) -> dict[str, Any]:
    world = build_world(session, mocker)
    path = tmp_path / "almacen.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE pedidos (region TEXT, total INTEGER)")
        connection.execute("INSERT INTO pedidos VALUES ('Norte', 3)")
    database = Database(database_name="local", sqlalchemy_uri=f"sqlite:///{path}")
    session.add(database)
    session.commit()
    world["database"] = database
    return world


def physical(world: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {"database_id": world["database"].id, "table_name": "pedidos", **extra}


def virtual(world: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {
        "database_id": world["database"].id,
        "dataset_name": "pedidos_norte",
        "sql": "SELECT region, total FROM pedidos",
        **extra,
    }


def workspace_of(session: Session, dataset_id: int) -> int | None:
    return (
        session.query(WorkspaceDataset.workspace_id)
        .filter(WorkspaceDataset.dataset_id == dataset_id)
        .scalar()
    )


def created(session: Session, name: str) -> bool:
    return session.query(SqlaTable).filter_by(table_name=name).count() > 0


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Ada", "Root"])
async def test_contributors_and_admins_create_inside_their_workspace(
    world: dict[str, Any], name: str
) -> None:
    session, ventas_ws = world["session"], world["ventas_ws"]
    as_user(world, name)
    result = await call("create_dataset", physical(world, workspace_id=ventas_ws.id))
    assert result.get("id"), result
    assert result["workspace_id"] == ventas_ws.id
    assert workspace_of(session, result["id"]) == ventas_ws.id

    # A chart of the workspace's dashboard can use it; one outside cannot
    assert (
        validate_chart_dataset(result["id"], "table", [world["dashboard"].id]) is None
    )
    assert validate_chart_dataset(result["id"], "table", [world["shared_dashboard"].id])


@pytest.mark.asyncio
async def test_virtual_dataset_joins_the_workspace(world: dict[str, Any]) -> None:
    session, ventas_ws = world["session"], world["ventas_ws"]
    as_user(world, "Ana")
    result = await call(
        "create_virtual_dataset", virtual(world, workspace_id=ventas_ws.id)
    )
    assert result["error"] is None, result
    assert result["workspace_id"] == ventas_ws.id
    assert result["columns"] == ["region", "total"]
    assert workspace_of(session, result["id"]) == ventas_ws.id


@pytest.mark.asyncio
async def test_without_workspace_the_dataset_is_shared(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call("create_virtual_dataset", virtual(world))
    assert result["error"] is None, result
    assert result["workspace_id"] is None
    assert workspace_of(world["session"], result["id"]) is None


@pytest.mark.asyncio
async def test_viewers_cannot_add_datasets(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    ventas_ws = world["ventas_ws"]
    result = await call("create_dataset", physical(world, workspace_id=ventas_ws.id))
    assert result["error_type"] == "WorkspaceError"
    assert "contributors and admins" in result["error"]
    result = await call(
        "create_virtual_dataset", virtual(world, workspace_id=ventas_ws.id)
    )
    assert "contributors and admins" in result["error"]
    assert not created(world["session"], "pedidos")
    assert not created(world["session"], "pedidos_norte")


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Carlos", "Dani"])
async def test_non_members_do_not_find_the_workspace(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    ventas_ws = world["ventas_ws"]
    result = await call("create_dataset", physical(world, workspace_id=ventas_ws.id))
    assert result["error_type"] == "WorkspaceError"
    assert "Not found" in result["error"]
    result = await call(
        "create_virtual_dataset", virtual(world, workspace_id=ventas_ws.id)
    )
    assert "Not found" in result["error"]
    assert not created(world["session"], "pedidos")
    assert not created(world["session"], "pedidos_norte")


@pytest.mark.asyncio
async def test_creator_must_stay_an_editor(world: dict[str, Any]) -> None:
    """Moving the dataset into the workspace needs its creator to edit it."""
    as_user(world, "Ana")
    result = await call(
        "create_dataset",
        physical(
            world,
            workspace_id=world["ventas_ws"].id,
            editors=[world["users"]["Vera"].id],
        ),
    )
    assert "editors" in result["error"]
    assert not created(world["session"], "pedidos")
