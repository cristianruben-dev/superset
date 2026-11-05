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
"""Only real editors and workspace admins set or clear the certified stamp.

AuraData BI decided (2026-11-05) that a workspace contributor edits a report
but cannot certify it: ``certified_by`` and ``certification_details`` change
only for editors of the dashboard or chart, Superset admins and the admins of
its workspace.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.auradata.models import WorkspaceMember
from superset.auradata.workspace_access import can_certify
from superset.commands.chart.exceptions import ChartInvalidError
from superset.commands.chart.update import UpdateChartCommand
from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.unit_tests.auradata import workspace_security_test as _security

# The users, workspaces and reports of the workspace security tests
world = _security.world
chart_of = _security.chart_of
USER_ID_LOOKUPS = _security.USER_ID_LOOKUPS


@pytest.fixture(autouse=True)
def _find_without_list_filters(mocker: MockerFixture, session: Session) -> None:
    """The DAO lookups apply list filters that need a request user; access is
    what the commands check next, so look the models up directly."""
    mocker.patch(
        "superset.commands.dashboard.update.DashboardDAO.find_by_id",
        side_effect=lambda model_id, **_: session.get(Dashboard, model_id),
    )
    mocker.patch(
        "superset.commands.chart.update.ChartDAO.find_by_id",
        side_effect=lambda model_id, **_: session.get(Slice, model_id),
    )


def _make_workspace_admin(session: Session, world: dict[str, Any]) -> None:
    member = (
        session.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == world["ana"].id)
        .filter(WorkspaceMember.role == "contributor")
        .one()
    )
    member.role = "admin"
    session.flush()


def _act_as_bruno(mocker: MockerFixture, world: dict[str, Any]) -> None:
    bruno_id = world["bruno_subject"].user_id
    for lookup in USER_ID_LOOKUPS:
        mocker.patch(lookup, return_value=bruno_id)


def _field_errors(error: Exception) -> dict[str, Any]:
    return error.normalized_messages()  # type: ignore[attr-defined]


def test_a_contributor_cannot_certify_a_dashboard(world: dict[str, Any]) -> None:
    finanzas = world["finanzas"]

    assert not can_certify(finanzas)
    with pytest.raises(DashboardInvalidError) as error:
        UpdateDashboardCommand(finanzas.id, {"certified_by": "Ana"}).validate()
    assert "certified_by" in _field_errors(error.value)

    with pytest.raises(DashboardInvalidError) as error:
        UpdateDashboardCommand(
            finanzas.id, {"certification_details": "Checked"}
        ).validate()
    assert "certification_details" in _field_errors(error.value)


def test_a_contributor_cannot_clear_a_certification(
    session: Session, world: dict[str, Any]
) -> None:
    finanzas = world["finanzas"]
    finanzas.certified_by = "Finance team"
    session.flush()

    with pytest.raises(DashboardInvalidError):
        UpdateDashboardCommand(finanzas.id, {"certified_by": ""}).validate()


def test_a_contributor_still_saves_the_unchanged_stamp(
    session: Session, world: dict[str, Any]
) -> None:
    """The properties modal sends the stamp back with every save."""
    finanzas = world["finanzas"]
    finanzas.certified_by = "Finance team"
    session.flush()

    UpdateDashboardCommand(
        finanzas.id,
        {
            "dashboard_title": "Finanzas 2026",
            "certified_by": "Finance team",
            "certification_details": "",
        },
    ).validate()


def test_a_workspace_admin_certifies(session: Session, world: dict[str, Any]) -> None:
    _make_workspace_admin(session, world)
    finanzas = world["finanzas"]

    assert can_certify(finanzas)
    assert can_certify(chart_of(finanzas))
    UpdateDashboardCommand(finanzas.id, {"certified_by": "Ana"}).validate()


def test_an_editor_certifies(mocker: MockerFixture, world: dict[str, Any]) -> None:
    _act_as_bruno(mocker, world)
    finanzas = world["finanzas"]

    assert can_certify(finanzas)
    UpdateDashboardCommand(finanzas.id, {"certified_by": "Bruno"}).validate()


def test_a_contributor_cannot_certify_a_chart(world: dict[str, Any]) -> None:
    chart = chart_of(world["finanzas"])

    assert not can_certify(chart)
    with pytest.raises(ChartInvalidError) as error:
        UpdateChartCommand(chart.id, {"certified_by": "Ana"}).validate()
    assert "certified_by" in _field_errors(error.value)


def test_guests_never_certify(mocker: MockerFixture, world: dict[str, Any]) -> None:
    from superset import security_manager

    mocker.patch.object(security_manager, "is_guest_user", return_value=True)
    assert not can_certify(world["finanzas"])
