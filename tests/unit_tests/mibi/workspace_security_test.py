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
A workspace role edits dashboards and charts but never grants access to data.

Superset 7.0 counts editorship (``is_editor``) as data access in several places:
the chart branch of ``raise_for_access``, promiscuous viewer mode and guest token
minting. These tests prove that a workspace viewer and a workspace contributor,
neither with access to the dataset, get no data access through their role.
"""

from typing import Any

import pytest
import sqlalchemy as sa
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.commands.dashboard.exceptions import DashboardForbiddenError
from superset.commands.utils import compute_subjects
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.mibi.models import Workspace, WorkspaceDashboard, WorkspaceMember
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.utils import get_or_create_user_subject
from superset.utils import json

USER_ID_LOOKUPS = (
    "superset.security.manager.get_user_id",
    "superset.mibi.workspace_access.get_user_id",
    "superset.commands.utils.get_user_id",
)


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """
    Ana is a viewer of "Ventas" and a contributor of "Finanzas"; "Ajena" has no
    members. Every dashboard has one chart on the "ventas" dataset, which Ana
    cannot access, and Bruno edits all of them.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    ana, bruno = (
        security_manager.user_model(
            first_name=name, last_name="T", username=name.lower(), email=f"{name}@x"
        )
        for name in ("Ana", "Bruno")
    )
    database = Database(database_name="almacen", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="ventas", database=database)
    session.add_all([ana, bruno, database, dataset])
    session.flush()
    bruno_subject = get_or_create_user_subject(bruno.id)
    ana_subject = get_or_create_user_subject(ana.id)
    assert bruno_subject
    assert ana_subject

    def dashboard(title: str, workspace: str, role: str | None) -> Dashboard:
        chart = Slice(
            slice_name=f"kpi {title}",
            viz_type="big_number_total",
            datasource_type="table",
            datasource_id=dataset.id,
            editors=[bruno_subject],
        )
        board = Dashboard(
            dashboard_title=title,
            slices=[chart],
            published=True,
            editors=[bruno_subject],
        )
        session.add_all([chart, board])
        session.flush()
        group = Workspace(name=workspace)
        group.dashboards.append(WorkspaceDashboard(dashboard_id=board.id))
        if role:
            group.members.append(WorkspaceMember(user_id=ana.id, role=role))
        session.add(group)
        session.flush()
        return board

    ventas = dashboard("Ventas", "Ventas", "viewer")
    finanzas = dashboard("Finanzas", "Finanzas", "contributor")
    ajena = dashboard("Ajena", "Ajena", None)

    for lookup in USER_ID_LOOKUPS:
        mocker.patch(lookup, return_value=ana.id)
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    # Ana holds no data access of her own
    mocker.patch.object(security_manager, "can_access", return_value=False)
    mocker.patch.object(security_manager, "can_access_schema", return_value=False)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch.object(security_manager, "can_access_datasource", return_value=False)
    return {
        "ana": ana,
        "ana_subject": ana_subject,
        "dataset": dataset,
        "bruno_subject": bruno_subject,
        "ventas": ventas,
        "finanzas": finanzas,
        "ajena": ajena,
    }


def chart_of(dashboard: Dashboard) -> Slice:
    return dashboard.slices[0]


def raises(check: Any, *args: Any, **kwargs: Any) -> bool:
    try:
        check(*args, **kwargs)
    except SupersetSecurityException:
        return True
    return False


def test_a_workspace_role_is_not_editorship(world: dict[str, Any]) -> None:
    for name in ("ventas", "finanzas"):
        assert not security_manager.is_editor(world[name])
        assert not security_manager.is_editor(chart_of(world[name]))


def test_contributors_edit_and_viewers_do_not(world: dict[str, Any]) -> None:
    finanzas, ventas = world["finanzas"], world["ventas"]

    assert security_manager.can_edit_resource(finanzas)
    assert security_manager.can_edit_resource(chart_of(finanzas))
    assert not raises(security_manager.raise_for_editorship, finanzas)
    assert not raises(security_manager.raise_for_editorship, chart_of(finanzas))

    assert not security_manager.can_edit_resource(ventas)
    assert raises(security_manager.raise_for_editorship, ventas)
    assert raises(security_manager.raise_for_editorship, chart_of(ventas))
    assert raises(security_manager.raise_for_editorship, world["ajena"])


def test_managing_editors_needs_real_editorship(world: dict[str, Any]) -> None:
    assert raises(
        security_manager.raise_for_editorship, world["finanzas"], workspace_role=False
    )


def test_guests_never_edit(mocker: MockerFixture, world: dict[str, Any]) -> None:
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)

    assert not security_manager.can_edit_resource(world["finanzas"])
    assert raises(security_manager.raise_for_editorship, world["finanzas"])


def test_no_chart_access_through_a_workspace_role(world: dict[str, Any]) -> None:
    for name in ("ventas", "finanzas"):
        assert raises(security_manager.raise_for_access, chart=chart_of(world[name]))


def test_no_dataset_access_through_a_workspace_role(world: dict[str, Any]) -> None:
    assert raises(security_manager.raise_for_access, datasource=world["dataset"])


@pytest.mark.parametrize("name", ["ventas", "finanzas"])
def test_no_data_through_promiscuous_viewer_mode(
    mocker: MockerFixture, app: Any, world: dict[str, Any], name: str
) -> None:
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda flag: flag == "ENABLE_VIEWERS",
    )
    mocker.patch.dict(app.config, {"VIEWER_PROMISCUOUS_MODE": True})
    dashboard = world[name]
    chart = chart_of(dashboard)
    query_context = mocker.MagicMock(
        datasource=world["dataset"],
        form_data={"slice_id": chart.id, "dashboardId": dashboard.id},
    )

    assert raises(security_manager.raise_for_access, query_context=query_context)

    # The mode itself works: a real viewer of the chart reads its data
    chart.viewers = [world["ana_subject"]]
    assert not raises(security_manager.raise_for_access, query_context=query_context)


def test_no_guest_token_for_datasets_through_a_workspace_role(
    world: dict[str, Any],
) -> None:
    assert raises(
        security_manager._raise_for_guest_token_datasource_access,  # pylint: disable=protected-access
        world["finanzas"],
        None,
    )


def test_contributors_open_drafts_only_with_data_access(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    for name in ("ventas", "finanzas", "ajena"):
        world[name].published = False

    # A draft with charts Ana cannot query stays closed, even to a contributor
    assert raises(security_manager.raise_for_access, dashboard=world["finanzas"])

    mocker.patch.object(security_manager, "can_access_datasource", return_value=True)
    assert not raises(security_manager.raise_for_access, dashboard=world["finanzas"])
    # Viewers and non-members never see a draft
    assert raises(security_manager.raise_for_access, dashboard=world["ventas"])
    assert raises(security_manager.raise_for_access, dashboard=world["ajena"])


def test_editing_through_a_workspace_role_keeps_editors(world: dict[str, Any]) -> None:
    finanzas = world["finanzas"]
    bruno = world["bruno_subject"]

    properties: dict[str, Any] = {"dashboard_title": "Finanzas 2026"}
    exceptions: list[Any] = []
    compute_subjects(finanzas, properties, exceptions)
    # Superset adds whoever edits to the editors; a workspace role does not
    assert exceptions == []
    assert properties["editors"] == [bruno]
    assert properties["viewers"] == []

    properties = {"editors": [bruno.id, world["ana_subject"].id]}
    exceptions = []
    compute_subjects(finanzas, properties, exceptions)
    assert [error.field_name for error in exceptions] == ["editors"]
    assert properties["editors"] == [bruno]

    # Sending the current editors back is not a change
    properties = {"editors": [bruno.id], "viewers": []}
    exceptions = []
    compute_subjects(finanzas, properties, exceptions)
    assert exceptions == []


def test_a_contributor_copies_without_becoming_an_editor(
    session: Session, world: dict[str, Any]
) -> None:
    finanzas = world["finanzas"]
    bruno = world["bruno_subject"]
    original_chart = chart_of(finanzas)
    # The version history records one change per link and transaction
    session.commit()

    copy = DashboardDAO.copy_dashboard(
        finanzas,
        {
            "dashboard_title": "Finanzas (copia)",
            "json_metadata": json.dumps(
                {
                    "positions": {
                        "CHART-1": {
                            "type": "CHART",
                            "meta": {"chartId": original_chart.id},
                        }
                    }
                }
            ),
            "duplicate_slices": True,
        },
    )
    session.flush()

    # The copy and its cloned charts keep the editors of the originals
    assert copy.editors == [bruno]
    assert [chart.editors for chart in copy.slices] == [[bruno]]
    assert copy.slices[0].id != original_chart.id
    assert not security_manager.is_editor(copy)
    assert not security_manager.is_editor(copy.slices[0])
    # ...and sits in the workspace of the original, where Ana edits it
    assert security_manager.can_edit_resource(copy)
    assert raises(security_manager.raise_for_access, chart=copy.slices[0])


def test_a_viewer_cannot_copy(world: dict[str, Any]) -> None:
    with pytest.raises(DashboardForbiddenError):
        DashboardDAO.copy_dashboard(
            world["ventas"],
            {"dashboard_title": "x", "json_metadata": json.dumps({"positions": {}})},
        )


def test_contributors_read_the_history_viewers_do_not(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    from superset.versioning.api_helpers import (
        PathEntityResponseError,
        resolve_endpoint_path_entity,
    )

    api = mocker.MagicMock()
    api.response_403.return_value = "403"
    found: dict[str, object] = {}
    mocker.patch(
        "superset.versioning.api_helpers.VersionDAO.find_active_by_uuid",
        side_effect=lambda _model, _uuid: found["dashboard"],
    )

    found["dashboard"] = world["finanzas"]
    entity, _ = resolve_endpoint_path_entity(
        api, Dashboard, str(world["finanzas"].uuid)
    )
    assert entity is world["finanzas"]

    found["dashboard"] = world["ventas"]
    with pytest.raises(PathEntityResponseError):
        resolve_endpoint_path_entity(api, Dashboard, str(world["ventas"].uuid))


def test_contributors_list_the_drafts_of_their_workspace(
    mocker: MockerFixture, session: Session, world: dict[str, Any]
) -> None:
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset.dashboards.filters import DashboardAccessFilter

    # Ana has data access here, so only the draft rule is on trial
    mocker.patch(
        "superset.dashboards.filters.semantic_layer_grant_clause",
        return_value=sa.false(),
    )
    mocker.patch(
        "superset.dashboards.filters.get_dataset_access_filters",
        return_value=sa.true(),
    )
    for name in ("ventas", "finanzas", "ajena"):
        world[name].published = False
    session.flush()

    def listed() -> set[str]:
        access = DashboardAccessFilter("id", SQLAInterface(Dashboard))
        return {d.dashboard_title for d in access.apply(session.query(Dashboard), None)}

    # A contributor sees the draft of her workspace; a viewer or an outsider
    # sees no draft
    assert listed() == {"Finanzas"}

    for name in ("ventas", "finanzas", "ajena"):
        world[name].published = True
    session.flush()
    assert listed() == {"Ventas", "Finanzas"}
