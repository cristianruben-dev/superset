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
Data access through a workspace: its members query the datasets of the workspace,
viewers included, and nobody else gains anything.

No role here has data permissions of its own, so every grant seen is the one of
the workspace.
"""

from datetime import datetime
from typing import Any

import pytest
import sqlalchemy as sa
from flask import g
from flask_appbuilder.models.sqla.interface import SQLAInterface
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.auradata.models import (
    ROLE_ADMIN,
    ROLE_CONTRIBUTOR,
    ROLE_VIEWER,
    Workspace,
    WorkspaceDashboard,
    WorkspaceDataset,
    WorkspaceMember,
)
from superset.charts.filters import ChartFilter
from superset.commands.chart.create import CreateChartCommand
from superset.commands.chart.exceptions import ChartForbiddenError
from superset.commands.chart.update import UpdateChartCommand
from superset.connectors.sqla.models import (
    RLSFilterSubjects,
    RLSFilterTables,
    RowLevelSecurityFilter,
    SqlaTable,
)
from superset.dashboards.filters import DashboardAccessFilter
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import RowLevelSecurityFilterType
from superset.views.base import DatasourceFilter

USER_ID_LOOKUPS = (
    "superset.security.manager.get_user_id",
    "superset.auradata.workspace_access.get_user_id",
    "superset.auradata.workspace_grants.get_user_id",
    "superset.dashboards.filters.get_user_id",
)


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """
    "Ventas" holds the dataset "ventas", the chart and the published dashboard
    that use it. Ana contributes there, Ada administers, Vera views. Carlos
    contributes to "Finanzas" and Dani belongs to no workspace. "compartido" is
    a dataset of no workspace. Nobody has data permissions.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    users = {
        name: security_manager.user_model(
            first_name=name, last_name="T", username=name.lower(), email=f"{name}@x"
        )
        for name in ("Ana", "Ada", "Vera", "Carlos", "Dani")
    }
    database = Database(database_name="almacen", sqlalchemy_uri="sqlite://")
    ventas = SqlaTable(table_name="ventas", database=database)
    compartido = SqlaTable(table_name="compartido", database=database)
    session.add_all([*users.values(), database, ventas, compartido])
    session.flush()

    chart = Slice(
        slice_name="kpi",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=ventas.id,
    )
    shared_chart = Slice(
        slice_name="kpi compartido",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=compartido.id,
    )
    dashboard = Dashboard(dashboard_title="Ventas", slices=[chart], published=True)
    shared_dashboard = Dashboard(
        dashboard_title="Compartido", slices=[shared_chart], published=True
    )
    session.add_all([chart, shared_chart, dashboard, shared_dashboard])
    session.flush()

    ventas_ws = Workspace(name="Ventas")
    ventas_ws.dashboards.append(WorkspaceDashboard(dashboard_id=dashboard.id))
    ventas_ws.datasets.append(WorkspaceDataset(dataset_id=ventas.id))
    for name, role in (
        ("Ana", ROLE_CONTRIBUTOR),
        ("Ada", ROLE_ADMIN),
        ("Vera", ROLE_VIEWER),
    ):
        ventas_ws.members.append(WorkspaceMember(user_id=users[name].id, role=role))
    finanzas_ws = Workspace(name="Finanzas")
    finanzas_ws.members.append(
        WorkspaceMember(user_id=users["Carlos"].id, role=ROLE_CONTRIBUTOR)
    )
    session.add_all([ventas_ws, finanzas_ws])
    session.flush()

    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    # No role holds any data permission
    mocker.patch.object(security_manager, "can_access", return_value=False)
    mocker.patch.object(security_manager, "can_access_schema", return_value=False)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch.object(security_manager, "user_view_menu_names", return_value=set())
    mocker.patch.object(security_manager, "get_accessible_databases", return_value=[])
    return {
        "users": users,
        "ventas": ventas,
        "compartido": compartido,
        "chart": chart,
        "shared_chart": shared_chart,
        "dashboard": dashboard,
        "shared_dashboard": shared_dashboard,
        "ventas_ws": ventas_ws,
        "finanzas_ws": finanzas_ws,
        "mocker": mocker,
    }


def as_user(world: dict[str, Any], name: str) -> None:
    for lookup in USER_ID_LOOKUPS:
        world["mocker"].patch(lookup, return_value=world["users"][name].id)


def allowed(check: Any, **kwargs: Any) -> bool:
    try:
        check(**kwargs)
    except SupersetSecurityException:
        return False
    return True


def query_context_of(world: dict[str, Any], dataset: str = "ventas") -> Any:
    return world["mocker"].MagicMock(
        datasource=world[dataset], form_data={"slice_id": world["chart"].id}
    )


@pytest.mark.parametrize("name", ["Ana", "Ada", "Vera"])
def test_members_query_the_datasets_of_their_workspace(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    check = security_manager.raise_for_access

    assert allowed(check, datasource=world["ventas"])
    assert allowed(check, chart=world["chart"])
    assert allowed(check, query_context=query_context_of(world))
    assert allowed(check, dashboard=world["dashboard"])
    assert security_manager.can_access_datasource(world["ventas"])


@pytest.mark.parametrize("name", ["Carlos", "Dani"])
def test_outsiders_gain_nothing(world: dict[str, Any], name: str) -> None:
    as_user(world, name)
    check = security_manager.raise_for_access

    assert not allowed(check, datasource=world["ventas"])
    assert not allowed(check, chart=world["chart"])
    assert not allowed(check, query_context=query_context_of(world))
    assert not allowed(check, dashboard=world["dashboard"])


@pytest.mark.parametrize("name", ["Ana", "Vera"])
def test_a_shared_dataset_grants_nothing(world: dict[str, Any], name: str) -> None:
    as_user(world, name)
    check = security_manager.raise_for_access

    assert not allowed(check, datasource=world["compartido"])
    assert not allowed(check, chart=world["shared_chart"])
    assert not allowed(check, dashboard=world["shared_dashboard"])


@pytest.mark.parametrize("name", ["Ana", "Vera"])
def test_raw_sql_and_strict_paths_stay_closed(world: dict[str, Any], name: str) -> None:
    as_user(world, name)
    check = security_manager.raise_for_access

    # SQL Lab, MetaDB and MCP execute_sql ask for a strict match of the dataset
    assert not allowed(check, datasource=world["ventas"], force_dataset_match=True)
    # Defining a dataset over a table never counts a workspace as access
    assert not allowed(check, datasource=world["ventas"], allow_editorship=False)
    # Database, schema and table checks have no workspace leg
    assert not security_manager.can_access_schema(world["ventas"])


def test_the_grant_follows_membership_and_workspace(
    session: Session, world: dict[str, Any]
) -> None:
    as_user(world, "Ana")
    check = security_manager.raise_for_access
    assert allowed(check, datasource=world["ventas"])

    # Moving the dataset to another workspace takes the access away
    link = session.query(WorkspaceDataset).one()
    link.workspace_id = world["finanzas_ws"].id
    session.flush()
    assert not allowed(check, datasource=world["ventas"])
    link.workspace_id = world["ventas_ws"].id
    session.flush()
    assert allowed(check, datasource=world["ventas"])

    # Sharing it (no workspace) takes it away too
    session.delete(link)
    session.flush()
    assert not allowed(check, datasource=world["ventas"])
    session.add(
        WorkspaceDataset(
            workspace_id=world["ventas_ws"].id, dataset_id=world["ventas"].id
        )
    )
    session.flush()
    assert allowed(check, datasource=world["ventas"])

    # Lowering the member to viewer keeps it, and removing them takes it away
    member = (
        session.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == world["users"]["Ana"].id)
        .one()
    )
    member.role = ROLE_VIEWER
    session.flush()
    assert allowed(check, datasource=world["ventas"])
    session.delete(member)
    session.flush()
    assert not allowed(check, datasource=world["ventas"])


@pytest.mark.parametrize("name", ["Ana", "Vera"])
def test_a_workspace_role_does_not_edit_a_dataset(
    world: dict[str, Any], name: str
) -> None:
    """Editing it could repoint it to any table, and the grant would follow."""
    as_user(world, name)

    assert not security_manager.can_edit_resource(world["ventas"])
    with pytest.raises(SupersetSecurityException):
        security_manager.raise_for_editorship(world["ventas"])


def test_a_viewer_stays_a_viewer(world: dict[str, Any]) -> None:
    """Reading the dataset opens nothing to edit, whatever is built on it."""
    as_user(world, "Vera")

    for resource in ("chart", "dashboard"):
        assert not security_manager.can_edit_resource(world[resource])
        assert not security_manager.is_editor(world[resource])
        with pytest.raises(SupersetSecurityException):
            security_manager.raise_for_editorship(world[resource])


def test_a_draft_stays_hidden_from_a_viewer(
    session: Session, world: dict[str, Any]
) -> None:
    def listed() -> set[str]:
        access = DashboardAccessFilter("id", SQLAInterface(Dashboard))
        return {d.dashboard_title for d in access.apply(session.query(Dashboard), None)}

    world["dashboard"].published = False
    session.flush()
    check = security_manager.raise_for_access

    as_user(world, "Vera")
    assert not allowed(check, dashboard=world["dashboard"])
    assert listed() == set()

    # The control: the same draft is open to a contributor of the workspace
    as_user(world, "Ana")
    assert allowed(check, dashboard=world["dashboard"])
    assert listed() == {"Ventas"}


def create_chart(world: dict[str, Any], dataset: str = "ventas") -> None:
    CreateChartCommand(
        {
            "slice_name": "nuevo",
            "viz_type": "table",
            "datasource_id": world[dataset].id,
            "datasource_type": "table",
        }
    ).validate()


def test_reading_a_dataset_builds_nothing_on_it(world: dict[str, Any]) -> None:
    """A chart is a write, even one of their own that no dashboard shows."""
    as_user(world, "Vera")

    with pytest.raises(ChartForbiddenError):
        create_chart(world)


def test_a_viewer_moves_no_chart_of_theirs_onto_the_dataset(
    session: Session, world: dict[str, Any]
) -> None:
    """Their own chart, on a dataset they read: only the move is refused."""
    own = Slice(
        slice_name="propio",
        viz_type="table",
        datasource_type="table",
        datasource_id=world["compartido"].id,
    )
    session.add(own)
    session.flush()
    as_user(world, "Vera")
    world["mocker"].patch.object(security_manager, "is_editor", return_value=True)
    world["mocker"].patch.object(
        security_manager, "can_edit_resource", return_value=True
    )
    world["mocker"].patch(
        "superset.commands.chart.update.ChartDAO.find_by_id", return_value=own
    )
    world["mocker"].patch(
        "superset.auradata.workspace_grants._reads_outside_the_grant",
        return_value=False,
    )

    with pytest.raises(ChartForbiddenError):
        UpdateChartCommand(
            own.id,
            {"datasource_id": world["ventas"].id, "datasource_type": "table"},
        ).validate()


def test_a_real_data_permission_keeps_building_charts(
    world: dict[str, Any],
) -> None:
    as_user(world, "Vera")
    security_manager.can_access.return_value = True

    create_chart(world)


def test_a_contributor_builds_charts_on_the_dataset(world: dict[str, Any]) -> None:
    as_user(world, "Ana")

    create_chart(world)


def listed_charts(session: Session) -> set[str]:
    access = ChartFilter("id", SQLAInterface(Slice))
    return {chart.slice_name for chart in access.apply(session.query(Slice), None)}


def test_the_charts_of_a_published_dashboard_open_to_a_viewer(
    session: Session, world: dict[str, Any]
) -> None:
    as_user(world, "Vera")

    assert allowed(security_manager.raise_for_access, chart=world["chart"])
    assert listed_charts(session) == {"kpi"}


def test_the_charts_of_a_draft_stay_hidden_from_a_viewer(
    session: Session, world: dict[str, Any]
) -> None:
    """One chart lives in one dashboard: a draft's charts are the draft."""
    world["dashboard"].published = False
    session.flush()
    check = security_manager.raise_for_access

    as_user(world, "Vera")
    assert not allowed(check, chart=world["chart"])
    assert listed_charts(session) == set()
    # The dataset itself stays open: the grant is on the data
    assert allowed(check, datasource=world["ventas"])

    # The control: a contributor of the workspace opens them
    as_user(world, "Ana")
    assert allowed(check, chart=world["chart"])
    assert listed_charts(session) == {"kpi"}


def test_a_chart_on_no_dashboard_stays_hidden_from_a_viewer(
    session: Session, world: dict[str, Any]
) -> None:
    session.commit()  # version history takes one change per link and transaction
    world["dashboard"].slices = []
    session.commit()
    as_user(world, "Vera")

    assert not allowed(security_manager.raise_for_access, chart=world["chart"])
    assert listed_charts(session) == set()


def test_a_soft_deleted_dashboard_does_not_publish_its_charts(
    session: Session, world: dict[str, Any]
) -> None:
    world["dashboard"].deleted_at = datetime(2026, 1, 1)
    session.flush()
    as_user(world, "Vera")

    assert not allowed(security_manager.raise_for_access, chart=world["chart"])
    assert listed_charts(session) == set()


def test_a_real_data_permission_keeps_opening_the_chart_of_a_draft(
    session: Session, world: dict[str, Any]
) -> None:
    """The rule narrows the grant only: a role keeps what it gave before."""
    world["dashboard"].published = False
    session.flush()
    as_user(world, "Vera")
    security_manager.can_access.return_value = True

    assert allowed(security_manager.raise_for_access, chart=world["chart"])


def test_the_lists_show_the_datasets_of_the_workspace_only(
    session: Session, world: dict[str, Any]
) -> None:
    def listed(name: str) -> set[str]:
        as_user(world, name)
        access = DatasourceFilter("id", SQLAInterface(SqlaTable))
        return {d.table_name for d in access.apply(session.query(SqlaTable), None)}

    assert listed("Ana") == {"ventas"}
    assert listed("Ada") == {"ventas"}
    assert listed("Vera") == {"ventas"}
    assert listed("Carlos") == set()
    assert listed("Dani") == set()


def test_the_dashboard_list_follows_the_grant(
    session: Session, world: dict[str, Any]
) -> None:
    def listed(name: str) -> set[str]:
        as_user(world, name)
        access = DashboardAccessFilter("id", SQLAInterface(Dashboard))
        return {d.dashboard_title for d in access.apply(session.query(Dashboard), None)}

    assert listed("Ana") == {"Ventas"}
    assert listed("Vera") == {"Ventas"}
    assert listed("Carlos") == set()
    assert listed("Dani") == set()


@pytest.mark.parametrize("name", ["Ana", "Vera"])
def test_row_level_security_still_filters_a_member(
    mocker: MockerFixture, session: Session, world: dict[str, Any], name: str
) -> None:
    from superset.subjects.utils import get_or_create_user_subject

    member = world["users"][name]
    as_user(world, name)
    subject = get_or_create_user_subject(member.id)
    assert subject
    rule = RowLevelSecurityFilter(
        name="solo norte",
        filter_type=RowLevelSecurityFilterType.REGULAR,
        clause="region = 'Norte'",
    )
    session.add(rule)
    session.flush()
    session.execute(
        sa.insert(RLSFilterTables).values(
            rls_filter_id=rule.id, table_id=world["ventas"].id
        )
    )
    session.execute(
        sa.insert(RLSFilterSubjects).values(
            rls_filter_id=rule.id, subject_id=subject.id
        )
    )
    session.flush()
    g.user = member
    g.pop("_rls_filter_cache", None)
    mocker.patch(
        "superset.subjects.utils.get_current_user_subject_ids",
        return_value=[subject.id],
    )
    mocker.patch("superset.security.manager.get_username", return_value=name.lower())

    # The workspace opens the dataset, and its rows are still filtered
    assert allowed(security_manager.raise_for_access, datasource=world["ventas"])
    clauses = [row.clause for row in security_manager.get_rls_filters(world["ventas"])]
    assert clauses == ["region = 'Norte'"]


@pytest.mark.parametrize(
    ("user", "dataset"),
    [
        ("Ana", "compartido"),  # a shared dataset she cannot read
        ("Ana", "ventas"),  # one she reads through the workspace: not hers to move
        ("Ada", "compartido"),
        ("Vera", "ventas"),  # a viewer reads it, and moves nothing
        ("Vera", "compartido"),
        ("Carlos", "ventas"),  # a dataset of another workspace
    ],
)
def test_adding_a_dataset_to_a_workspace_needs_real_editorship(
    session: Session,
    client: Any,
    full_api_access: None,
    world: dict[str, Any],
    user: str,
    dataset: str,
) -> None:
    """Otherwise adding it would be a way to give oneself access to it."""
    as_user(world, user)
    world["mocker"].patch(
        "superset.auradata.workspaces.workspace_role",
        side_effect=lambda pk: (ROLE_ADMIN if user in ("Ada",) else ROLE_CONTRIBUTOR),
    )
    workspace = world["finanzas_ws"] if user == "Carlos" else world["ventas_ws"]
    links_before = session.query(WorkspaceDataset).count()

    response = client.put(
        f"/api/v1/workspace/{workspace.id}/datasets/",
        json={"add": [world[dataset].id]},
    )

    assert response.status_code in (403, 404)
    assert session.query(WorkspaceDataset).count() == links_before
    assert not allowed(
        security_manager.raise_for_access, datasource=world["compartido"]
    )
