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
"""Tests for superset/mibi/workspace_access.py."""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.mibi import workspace_access
from superset.mibi.models import Workspace, WorkspaceDashboard, WorkspaceMember
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    """
    Ana is a viewer of "Ventas" and a contributor of "Finanzas"; "Libre" is a
    dashboard outside any workspace.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    ana = security_manager.user_model(
        first_name="Ana", last_name="T", username="ana", email="ana@x.com"
    )
    chart = Slice(
        slice_name="kpi", viz_type="big_number_total", datasource_type="table"
    )
    ventas, finanzas, libre = (
        Dashboard(dashboard_title="Ventas"),
        Dashboard(dashboard_title="Finanzas", slices=[chart]),
        Dashboard(dashboard_title="Libre"),
    )
    otra = Dashboard(dashboard_title="Otra")
    session.add_all([ana, chart, ventas, finanzas, libre, otra])
    session.flush()
    for name, dashboard, role in (
        ("Ventas", ventas, "viewer"),
        ("Finanzas", finanzas, "contributor"),
        ("Ajena", otra, None),
    ):
        workspace = Workspace(name=name)
        workspace.dashboards.append(WorkspaceDashboard(dashboard_id=dashboard.id))
        if role:
            workspace.members.append(WorkspaceMember(user_id=ana.id, role=role))
        session.add(workspace)
    session.flush()

    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch("superset.mibi.workspace_access.get_user_id", return_value=ana.id)
    return {
        "ventas": ventas,
        "finanzas": finanzas,
        "libre": libre,
        "otra": otra,
        "chart": chart,
    }


def test_dashboards_of_other_workspaces_are_hidden(
    world: dict[str, Any], session: Session
) -> None:
    condition = workspace_access.dashboard_visibility_filter(Dashboard.id)

    titles = {d.dashboard_title for d in session.query(Dashboard).filter(condition)}

    assert titles == {"Ventas", "Finanzas", "Libre"}
    assert workspace_access.can_see_dashboard(world["libre"].id)
    assert workspace_access.can_see_dashboard(world["ventas"].id)
    assert not workspace_access.can_see_dashboard(world["otra"].id)


def test_admins_and_guests_are_not_filtered(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    assert workspace_access.dashboard_visibility_filter(Dashboard.id) is None

    mocker.patch.object(security_manager, "is_admin", return_value=True)
    assert workspace_access.can_see_dashboard(world["otra"].id)


def test_contributors_edit_dashboards_and_their_charts(
    world: dict[str, Any],
) -> None:
    edits = workspace_access.edits_as_workspace_member

    assert edits(world["finanzas"])
    assert edits(world["chart"])
    # Viewers and non-members do not
    assert not edits(world["ventas"])
    assert not edits(world["otra"])
    assert not edits(world["libre"])


def test_the_rules_can_be_turned_off(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    mocker.patch("superset.mibi.workspace_access.enabled", return_value=False)

    assert workspace_access.dashboard_visibility_filter(Dashboard.id) is None
    assert workspace_access.can_see_dashboard(world["otra"].id)
    assert not workspace_access.edits_as_workspace_member(world["finanzas"])


def test_raise_for_ownership_accepts_contributors(
    mocker: MockerFixture, world: dict[str, Any]
) -> None:
    mocker.patch("superset.security.manager.g")

    security_manager.raise_for_ownership(world["finanzas"])
    assert security_manager.is_owner(world["chart"])
    assert not security_manager.is_owner(world["ventas"])
