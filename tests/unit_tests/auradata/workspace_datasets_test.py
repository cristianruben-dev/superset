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
"""Tests for superset/auradata/workspace_datasets.py and its API."""

import importlib.util
from pathlib import Path
from typing import Any

import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.auradata import workspace_datasets
from superset.auradata.models import (
    Workspace,
    WorkspaceDashboard,
    WorkspaceDataset,
    WorkspaceMember,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.utils import get_or_create_user_subject

MIGRATION = (
    Path(__file__).parents[3]
    / "superset/migrations/versions"
    / "2026_11_04_1000_d3f9a2b17c64_mibi_workspace_datasets.py"
)


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """
    Ana is a member of "Ventas" but not of "Ajena". "ventas" belongs to Ventas,
    "ajena" to Ajena and "comun" is shared. "Tablero" is a dashboard of Ventas,
    "Libre" one outside any workspace.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    ana = security_manager.user_model(
        first_name="Ana", last_name="T", username="ana", email="ana@x.com"
    )
    database = Database(database_name="db", sqlalchemy_uri="sqlite://")
    ventas, ajena, comun = (
        SqlaTable(table_name=name, database=database)
        for name in ("ventas", "ajena", "comun")
    )
    tablero = Dashboard(dashboard_title="Tablero")
    libre = Dashboard(dashboard_title="Libre")
    session.add_all([ana, database, ventas, ajena, comun, tablero, libre])
    session.flush()

    ws_ventas = Workspace(name="Ventas")
    ws_ventas.members.append(WorkspaceMember(user_id=ana.id, role="contributor"))
    ws_ventas.dashboards.append(WorkspaceDashboard(dashboard_id=tablero.id))
    ws_ventas.datasets.append(WorkspaceDataset(dataset_id=ventas.id))
    ws_ajena = Workspace(name="Ajena")
    ws_ajena.datasets.append(WorkspaceDataset(dataset_id=ajena.id))
    session.add_all([ws_ventas, ws_ajena])
    session.flush()

    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch(
        "superset.auradata.workspace_datasets.get_user_id", return_value=ana.id
    )
    return {
        "ana": ana,
        "ventas": ventas,
        "ajena": ajena,
        "comun": comun,
        "tablero": tablero,
        "libre": libre,
        "ws_ventas": ws_ventas,
        "ws_ajena": ws_ajena,
    }


def chart_on(dashboard: Dashboard, dataset: SqlaTable, session: Session) -> Slice:
    """A chart of ``dataset`` placed on ``dashboard``."""
    chart = Slice(
        slice_name=f"{dataset.table_name} chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=dataset.id,
    )
    dashboard.slices.append(chart)
    session.flush()
    return chart


def test_datasets_of_other_workspaces_are_hidden(
    world: dict[str, Any], session: Session
) -> None:
    condition = workspace_datasets.dataset_visibility_filter(SqlaTable.id)

    names = {t.table_name for t in session.query(SqlaTable).filter(condition)}

    assert names == {"ventas", "comun"}


def test_admins_guests_and_the_switch_are_not_filtered(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    assert workspace_datasets.dataset_visibility_filter(SqlaTable.id) is None

    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    assert workspace_datasets.dataset_visibility_filter(SqlaTable.id) is None

    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch("superset.auradata.workspace_datasets.enabled", return_value=False)
    assert workspace_datasets.dataset_visibility_filter(SqlaTable.id) is None


def test_the_list_filter_keeps_the_datasets_a_user_edits(
    mocker: MockerFixture, world: dict[str, Any], session: Session
) -> None:
    mocker.patch("superset.subjects.filters.get_user_id", return_value=world["ana"].id)
    world["ajena"].editors = [get_or_create_user_subject(world["ana"].id)]
    session.flush()
    query = session.query(SqlaTable)

    filtered = workspace_datasets.WorkspaceDatasetFilter(
        "id", SQLAInterface(SqlaTable)
    ).apply(query, None)

    assert {t.table_name for t in filtered} == {"ventas", "ajena", "comun"}


def test_charts_use_their_workspace_datasets_or_shared_ones(
    world: dict[str, Any],
) -> None:
    validate = workspace_datasets.validate_chart_dataset
    tablero, libre = world["tablero"].id, world["libre"].id

    assert validate(world["ventas"].id, "table", [tablero]) is None
    assert validate(world["comun"].id, "table", [tablero]) is None
    assert validate(world["comun"].id, "table", [libre]) is None
    assert validate(world["ajena"].id, "table", [tablero]) is not None
    assert validate(world["ventas"].id, "table", [libre]) is not None
    # Queries and charts without a dashboard are not checked
    assert validate(world["ajena"].id, "query", [tablero]) is None
    assert validate(world["ajena"].id, "table", []) is None


def test_charts_joining_a_dashboard_keep_to_its_workspace_datasets(
    world: dict[str, Any], session: Session
) -> None:
    def loose_chart(dataset: SqlaTable) -> int:
        chart = Slice(
            slice_name=f"{dataset.table_name} suelto",
            viz_type="table",
            datasource_type="table",
            datasource_id=dataset.id,
        )
        session.add(chart)
        session.flush()
        return chart.id

    foreign = workspace_datasets.chart_datasets_of_other_workspaces
    ventas, ajena, comun = (
        loose_chart(world[name]) for name in ("ventas", "ajena", "comun")
    )

    assert foreign([ventas, comun], world["tablero"].id) == []
    assert foreign([ventas, ajena, comun], world["tablero"].id) == ["ajena"]
    # A dashboard outside workspaces, saved or not, only takes shared datasets
    assert foreign([ventas, comun], world["libre"].id) == ["ventas"]
    assert foreign([ventas, ajena, comun], None) == ["ajena", "ventas"]


def test_the_usable_in_dashboard_filter(
    world: dict[str, Any], session: Session
) -> None:
    usable = workspace_datasets.DatasetUsableInDashboardFilter(
        "id", SQLAInterface(SqlaTable)
    )

    def names(dashboard: Dashboard) -> set[str]:
        query = usable.apply(session.query(SqlaTable), dashboard.id)
        return {table.table_name for table in query}

    assert names(world["tablero"]) == {"ventas", "comun"}
    assert names(world["libre"]) == {"comun"}


def test_conflicts_when_moving_dashboards_or_datasets(
    world: dict[str, Any], session: Session
) -> None:
    chart_on(world["libre"], world["ajena"], session)
    chart_on(world["tablero"], world["comun"], session)
    ws_ventas, ws_ajena = world["ws_ventas"].id, world["ws_ajena"].id
    libre, tablero = world["libre"].id, world["tablero"].id

    # "Libre" uses a dataset of Ajena: it can only go there
    assert workspace_datasets.datasets_of_other_workspaces([libre], ws_ventas) == [
        "ajena"
    ]
    assert workspace_datasets.datasets_of_other_workspaces([libre], ws_ajena) == []
    # "comun" is used by a dashboard of Ventas: it can't move to Ajena
    assert workspace_datasets.datasets_used_outside([world["comun"].id], ws_ajena) == [
        "comun"
    ]
    assert (
        workspace_datasets.datasets_used_outside([world["comun"].id], ws_ventas) == []
    )
    assert workspace_datasets.datasets_of_other_workspaces([tablero], None) == []


def test_the_migration_assigns_datasets_used_by_one_workspace(
    mocker: MockerFixture, world: dict[str, Any], session: Session
) -> None:
    spec = importlib.util.spec_from_file_location("migration", MIGRATION)
    assert spec
    assert spec.loader
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    session.query(WorkspaceDataset).delete()
    other = Dashboard(dashboard_title="Otro")
    session.add(other)
    session.flush()
    session.add(
        WorkspaceDashboard(workspace_id=world["ws_ajena"].id, dashboard_id=other.id)
    )
    # "ventas" only on a dashboard of Ventas, "ajena" also outside workspaces,
    # "comun" on dashboards of two workspaces
    chart_on(world["tablero"], world["ventas"], session)
    chart_on(world["tablero"], world["ajena"], session)
    chart_on(world["libre"], world["ajena"], session)
    chart_on(world["tablero"], world["comun"], session)
    chart_on(other, world["comun"], session)
    mocker.patch.object(migration.op, "execute", side_effect=session.execute)

    migration.assign_existing_datasets()

    links = {
        (link.dataset_id, link.workspace_id) for link in session.query(WorkspaceDataset)
    }
    assert links == {(world["ventas"].id, world["ws_ventas"].id)}


@pytest.fixture
def api_world(
    mocker: MockerFixture,
    session: Session,
    full_api_access: None,
    world: dict[str, Any],
) -> dict[str, Any]:
    """The world above, seen through the API by an admin."""
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    dashboards = [world["tablero"], world["libre"]]
    datasets = [world["ventas"], world["ajena"], world["comun"]]
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_ids",
        side_effect=lambda ids, **kwargs: [d for d in dashboards if d.id in ids],
    )
    mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_by_ids",
        side_effect=lambda ids, **kwargs: [d for d in datasets if d.id in ids],
    )
    mocker.patch.object(security_manager, "raise_for_editorship")
    mocker.patch.object(security_manager, "can_edit_resource", return_value=True)
    return world


def test_workspace_datasets_api(
    client: Any, api_world: dict[str, Any], session: Session
) -> None:
    ws_ventas = api_world["ws_ventas"].id
    comun = api_world["comun"].id

    response = client.get(f"/api/v1/workspace/{ws_ventas}/datasets/")
    assert [d["table_name"] for d in response.json["result"]] == ["ventas"]

    response = client.put(
        f"/api/v1/workspace/{ws_ventas}/datasets/", json={"add": [comun]}
    )
    assert response.status_code == 200
    assert response.json["result"]["dataset_count"] == 2

    # Taking a dataset out of its workspace shares it
    response = client.put(
        f"/api/v1/workspace/{ws_ventas}/datasets/", json={"remove": [comun]}
    )
    assert response.json["result"]["dataset_count"] == 1
    assert workspace_datasets.dataset_workspace_id(comun) is None


def test_datasets_used_outside_a_workspace_stay_out(
    client: Any, api_world: dict[str, Any], session: Session
) -> None:
    chart_on(api_world["libre"], api_world["comun"], session)

    response = client.put(
        f"/api/v1/workspace/{api_world['ws_ventas'].id}/datasets/",
        json={"add": [api_world["comun"].id]},
    )

    assert response.status_code == 422
    assert "comun" in response.json["message"]


def test_dashboards_keep_the_datasets_of_their_workspace(
    client: Any, api_world: dict[str, Any], session: Session
) -> None:
    chart_on(api_world["tablero"], api_world["ventas"], session)
    ws_ventas, ws_ajena = api_world["ws_ventas"].id, api_world["ws_ajena"].id
    tablero = api_world["tablero"].id

    moved = client.put(
        f"/api/v1/workspace/{ws_ajena}/dashboards/", json={"add": [tablero]}
    )
    removed = client.put(
        f"/api/v1/workspace/{ws_ventas}/dashboards/", json={"remove": [tablero]}
    )

    assert moved.status_code == 422
    assert removed.status_code == 422
    assert "ventas" in removed.json["message"]
