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
Soft-deleted dashboards and datasets in the AuraData BI rules.

Superset 7.0 deletes dashboards, charts and datasets softly: the row stays, with
``deleted_at`` set, so it can be restored from the trash. A soft-deleted object
must not show in workspace pages, dataset pickers or previews, and only live
dashboards count for the single-dashboard rule.
"""

from typing import Any

import prison
import pytest
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.auradata.models import (
    ROLE_VIEWER,
    Workspace,
    WorkspaceDashboard,
    WorkspaceDataset,
)
from superset.auradata.single_dashboard import (
    find_charts_blocking_restore,
    find_charts_in_multiple_dashboards,
    register_listeners,
    validate_dashboard_charts,
)
from superset.auradata.workspace_datasets import DatasetUsableInDashboardFilter
from superset.commands.dashboard.exceptions import DashboardRestoreFailedError
from superset.commands.dashboard.restore import RestoreDashboardCommand
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """
    Workspace "Ventas" holds dashboards "Viva" and "Borrada" and datasets "vivo"
    and "borrado"; the chart "kpi" is in "Borrada". "Borrada" and "borrado" are
    soft-deleted, in a transaction of their own as each request is.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    register_listeners()
    database = Database(database_name="almacen", sqlalchemy_uri="sqlite://")
    vivo, borrado = (
        SqlaTable(table_name=name, database=database) for name in ("vivo", "borrado")
    )
    chart = Slice(slice_name="kpi", viz_type="table", datasource_type="table")
    viva = Dashboard(dashboard_title="Viva", published=True)
    borrada = Dashboard(dashboard_title="Borrada", published=True, slices=[chart])
    session.add_all([database, vivo, borrado, chart, viva, borrada])
    session.flush()
    workspace = Workspace(name="Ventas")
    workspace.dashboards.extend(
        WorkspaceDashboard(dashboard_id=dashboard.id) for dashboard in (viva, borrada)
    )
    workspace.datasets.extend(
        WorkspaceDataset(dataset_id=dataset.id) for dataset in (vivo, borrado)
    )
    session.add(workspace)
    session.commit()

    borrada.soft_delete()
    borrado.soft_delete()
    session.commit()

    mocker.patch.object(security_manager, "is_admin", return_value=True)
    return {
        "workspace": workspace,
        "chart": chart,
        "viva": viva,
        "borrada": borrada,
        "vivo": vivo,
        "borrado": borrado,
    }


def test_a_chart_of_a_deleted_dashboard_can_join_another(
    session: Session, world: dict[str, Any]
) -> None:
    chart, viva = world["chart"], world["viva"]

    assert validate_dashboard_charts(viva.id, [chart.id]) is None
    viva.slices.append(chart)
    session.flush()  # the ORM safety net lets it through

    assert find_charts_in_multiple_dashboards() == {}


def test_restoring_a_dashboard_whose_chart_moved_is_refused(
    mocker: MockerFixture, session: Session, world: dict[str, Any]
) -> None:
    mocker.patch.object(security_manager, "raise_for_editorship")
    borrada = world["borrada"]
    restore = RestoreDashboardCommand(str(borrada.uuid))

    assert find_charts_blocking_restore(borrada.id) == {}
    restore.validate()

    world["viva"].slices.append(world["chart"])
    session.commit()

    assert find_charts_blocking_restore(borrada.id) == {
        world["chart"].id: {world["viva"].id}
    }
    with pytest.raises(DashboardRestoreFailedError) as excinfo:
        restore.validate()
    # The message names the chart and the dashboard it moved to, not ids
    assert '"kpi" is now in "Viva"' in str(excinfo.value)


def test_workspace_pages_leave_out_deleted_objects(
    client: Any, full_api_access: None, world: dict[str, Any]
) -> None:
    pk = world["workspace"].id

    workspace = client.get(f"/api/v1/workspace/{pk}/").json["result"]
    assert workspace["dashboard_ids"] == [world["viva"].id]
    assert workspace["dashboard_count"] == 1
    assert workspace["dataset_count"] == 1

    dashboards = client.get(f"/api/v1/workspace/{pk}/dashboards/").json["result"]
    assert [d["dashboard_title"] for d in dashboards] == ["Viva"]

    datasets = client.get(f"/api/v1/workspace/{pk}/datasets/").json["result"]
    assert [d["table_name"] for d in datasets] == ["vivo"]


def test_previews_leave_out_deleted_dashboards(
    client: Any, full_api_access: None, world: dict[str, Any]
) -> None:
    ids = [world["viva"].id, world["borrada"].id]

    response = client.get(
        f"/api/v1/auradata/dashboard_previews/?q={prison.dumps(ids)}"
    ).json["result"]

    assert [preview["id"] for preview in response] == [world["viva"].id]


def test_dataset_pickers_leave_out_deleted_datasets(
    session: Session, world: dict[str, Any]
) -> None:
    usable = DatasetUsableInDashboardFilter("id", SQLAInterface(SqlaTable))

    datasets = usable.apply(session.query(SqlaTable), world["viva"].id)

    assert [dataset.table_name for dataset in datasets] == ["vivo"]


def test_workspace_trash_lists_deleted_dashboards_and_what_blocks_them(
    session: Session, client: Any, full_api_access: None, world: dict[str, Any]
) -> None:
    pk = world["workspace"].id

    trash = client.get(f"/api/v1/workspace/{pk}/trash/").json["result"]
    assert [d["dashboard_title"] for d in trash] == ["Borrada"]
    assert trash[0]["uuid"] == str(world["borrada"].uuid)
    assert trash[0]["blocked_by"] is None

    # The chart joins a live dashboard while "Borrada" is in the trash
    world["viva"].slices.append(world["chart"])
    session.commit()

    trash = client.get(f"/api/v1/workspace/{pk}/trash/").json["result"]
    assert trash[0]["blocked_by"] == '"kpi" is now in "Viva"'


def test_workspace_trash_is_for_contributors(
    mocker: MockerFixture, client: Any, full_api_access: None, world: dict[str, Any]
) -> None:
    pk = world["workspace"].id
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch(
        "superset.auradata.workspaces.workspace_role", return_value=ROLE_VIEWER
    )

    assert client.get(f"/api/v1/workspace/{pk}/trash/").status_code == 403
