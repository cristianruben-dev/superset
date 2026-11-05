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
Calculated columns, saved metrics and column properties through the MCP: only
the dataset's editors and admins change them, never a workspace role, and an
expression runs once before it is saved.

In the world, Carlos edits the dataset "ventas" of the workspace Ventas, where
Ana contributes, Ada administers and Vera views. Dani belongs to no workspace.
"""

import sqlite3
from pathlib import Path
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.mcp_service.chart.compile import CompileResult
from superset.models.core import Database
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

COMPILE = "superset.mcp_service.chart.compile._compile_chart"

# One request per tool on "ventas", and how to see in the dataset that it ran
CHANGES: dict[str, tuple[dict[str, Any], Any]] = {
    "add_calculated_column": (
        {"column_name": "zona", "expression": "UPPER(region)"},
        lambda ds: "zona" in {c.column_name for c in ds.columns},
    ),
    "update_calculated_column": (
        {"column": "doble", "expression": "region || '-' || region"},
        lambda ds: any(c.expression == "region || '-' || region" for c in ds.columns),
    ),
    "delete_calculated_column": (
        {"name": "doble"},
        lambda ds: "doble" not in {c.column_name for c in ds.columns},
    ),
    "set_column_properties": (
        {"column": "region", "verbose_name": "Región", "groupby": False},
        lambda ds: any(c.verbose_name == "Región" for c in ds.columns),
    ),
    "add_metric": (
        {"metric_name": "regiones", "expression": "COUNT(DISTINCT region)"},
        lambda ds: "regiones" in {m.metric_name for m in ds.metrics},
    ),
    "delete_metric": (
        {"name": "total"},
        lambda ds: "total" not in {m.metric_name for m in ds.metrics},
    ),
}


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    ventas = world["ventas"]
    carlos = world["users"]["Carlos"]
    ventas.editors = [Subject(label="carlos", type=SubjectType.USER, user_id=carlos.id)]
    ventas.columns.append(
        TableColumn(column_name="doble", expression="region || region")
    )
    session.commit()
    # The world's tables do not exist: expressions pass the compile check here
    mocker.patch(COMPILE, return_value=CompileResult(success=True))
    return world


def reloaded(world: dict[str, Any]) -> SqlaTable:
    session = world["session"]
    session.expire_all()
    return session.get(SqlaTable, world["ventas"].id)


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", CHANGES)
@pytest.mark.parametrize("name", ["Carlos", "Root"])
async def test_dataset_editors_and_admins_model_it(
    world: dict[str, Any], tool: str, name: str
) -> None:
    request, applied = CHANGES[tool]
    as_user(world, name)
    result = await call(tool, {"dataset_id": world["ventas"].id, **request})
    assert result["error"] is None, result
    assert result["dataset_name"] == "ventas"
    assert applied(reloaded(world))


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", CHANGES)
@pytest.mark.parametrize("name", ["Ana", "Ada", "Vera"])
async def test_workspace_roles_do_not_edit_datasets(
    world: dict[str, Any], tool: str, name: str
) -> None:
    request, applied = CHANGES[tool]
    as_user(world, name)
    result = await call(tool, {"dataset_id": world["ventas"].id, **request})
    assert result["error_type"] == "Forbidden", result
    assert not applied(reloaded(world))


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", CHANGES)
async def test_non_members_do_not_find_the_dataset(
    world: dict[str, Any], tool: str
) -> None:
    request, applied = CHANGES[tool]
    as_user(world, "Dani")
    result = await call(tool, {"dataset_id": world["ventas"].id, **request})
    assert result["error_type"] == "NotFound", result
    assert not applied(reloaded(world))


@pytest.mark.asyncio
async def test_a_change_keeps_every_other_column_and_metric(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    await call(
        "add_metric",
        {
            "dataset_id": world["ventas"].id,
            "metric_name": "n",
            "expression": "COUNT(*)",
        },
    )
    await call(
        "delete_calculated_column", {"dataset_id": world["ventas"].id, "name": "doble"}
    )
    dataset = reloaded(world)
    assert {c.column_name for c in dataset.columns} == {"region"}
    assert {m.metric_name for m in dataset.metrics} == {"total", "n"}


@pytest.mark.asyncio
async def test_table_columns_are_not_calculated_ones(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    ventas = world["ventas"].id
    deleted = await call(
        "delete_calculated_column", {"dataset_id": ventas, "name": "region"}
    )
    updated = await call(
        "update_calculated_column",
        {"dataset_id": ventas, "column": "region", "expression": "1"},
    )
    for result in (deleted, updated):
        assert result["error_type"] == "InvalidRequest"
        assert "set_column_properties" in updated["error"]
    assert "region" in {c.column_name for c in reloaded(world).columns}


@pytest.mark.asyncio
async def test_names_stay_unique(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    ventas = world["ventas"].id
    column = await call(
        "add_calculated_column",
        {"dataset_id": ventas, "column_name": "region", "expression": "1"},
    )
    metric = await call(
        "add_metric",
        {"dataset_id": ventas, "metric_name": "total", "expression": "SUM(1)"},
    )
    assert "already has a column" in column["error"]
    assert "update_dataset_metric" in metric["error"]


@pytest.mark.asyncio
async def test_unknown_names_suggest_close_ones(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    result = await call(
        "set_column_properties",
        {"dataset_id": world["ventas"].id, "column": "regoin", "description": "x"},
    )
    assert result["error_type"] == "NotFound"
    assert "Did you mean: region" in result["error"]


@pytest.mark.asyncio
async def test_set_column_properties_sets_a_time_column(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    result = await call(
        "set_column_properties",
        {
            "dataset_id": world["ventas"].id,
            "column": "region",
            "is_dttm": True,
            "python_date_format": "%Y-%m-%d",
        },
    )
    assert result["column"]["is_dttm"] is True, result
    assert result["column"]["python_date_format"] == "%Y-%m-%d"
    assert result["changed"] == ["is_dttm", "python_date_format"]

    bad = await call(
        "set_column_properties",
        {
            "dataset_id": world["ventas"].id,
            "column": "region",
            "python_date_format": "%Q",
        },
    )
    assert bad["error_type"] == "InvalidRequest"
    assert "not a valid date format" in bad["error"]


@pytest.fixture
def real_world(
    mocker: MockerFixture, session: Session, tmp_path: Path
) -> dict[str, Any]:
    """A dataset over a real table, for the compile check."""
    world = build_world(session, mocker)
    path = tmp_path / "almacen.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE pedidos (region TEXT, total INTEGER)")
        connection.execute("INSERT INTO pedidos VALUES ('Norte', 3)")
    database = Database(database_name="local", sqlalchemy_uri=f"sqlite:///{path}")
    pedidos = SqlaTable(
        table_name="pedidos",
        database=database,
        columns=[
            TableColumn(column_name="region", type="TEXT"),
            TableColumn(column_name="total", type="INTEGER"),
        ],
    )
    session.add_all([database, pedidos])
    session.commit()
    world["pedidos"] = pedidos
    return world


@pytest.mark.asyncio
async def test_expressions_run_before_they_are_saved(
    real_world: dict[str, Any],
) -> None:
    as_user(real_world, "Root")
    pedidos = real_world["pedidos"].id
    typo = await call(
        "add_calculated_column",
        {"dataset_id": pedidos, "column_name": "doble", "expression": "totl * 2"},
    )
    assert typo["error_type"] == "InvalidExpression", typo
    assert "totl" in typo["error"]
    assert "connection error" not in typo["error"]
    bad_metric = await call(
        "add_metric",
        {"dataset_id": pedidos, "metric_name": "suma", "expression": "SUM(totl)"},
    )
    assert bad_metric["error_type"] == "InvalidExpression", bad_metric

    column = await call(
        "add_calculated_column",
        {"dataset_id": pedidos, "column_name": "doble", "expression": "total * 2"},
    )
    assert column["error"] is None, column
    assert column["column"]["expression"] == "total * 2"
    metric = await call(
        "add_metric",
        {"dataset_id": pedidos, "metric_name": "suma", "expression": "SUM(total)"},
    )
    assert metric["error"] is None, metric
    assert metric["metric"]["expression"] == "SUM(total)"
