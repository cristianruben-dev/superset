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
"""Tests for the single-dashboard chart rule (superset/mibi/single_dashboard.py)."""

import copy
from collections.abc import Iterator

import pytest
from flask import current_app, g
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    dashboards_config_1,
    databases_config,
    datasets_config,
)


@pytest.fixture
def db_session(session: Session) -> Iterator[Session]:
    """A session with the Superset tables and the ORM safety net installed."""
    from superset.mibi.single_dashboard import register_listeners

    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    register_listeners()
    yield session
    session.rollback()


@pytest.fixture
def rule_disabled() -> Iterator[None]:
    previous = current_app.config["MIBI_SINGLE_DASHBOARD_CHARTS"]
    current_app.config["MIBI_SINGLE_DASHBOARD_CHARTS"] = False
    yield
    current_app.config["MIBI_SINGLE_DASHBOARD_CHARTS"] = previous


def make_chart(session: Session, name: str = "chart") -> Slice:
    chart = Slice(slice_name=name, viz_type="table", datasource_type="table")
    session.add(chart)
    session.flush()
    return chart


def make_dashboard(
    session: Session, title: str = "dashboard", charts: list[Slice] | None = None
) -> Dashboard:
    dashboard = Dashboard(dashboard_title=title, slices=charts or [])
    session.add(dashboard)
    session.flush()
    return dashboard


def test_rule_is_enabled_by_default(app_context: None) -> None:
    from superset.mibi.single_dashboard import is_enabled

    assert is_enabled()


def test_orm_rejects_adding_chart_to_second_dashboard(db_session: Session) -> None:
    from superset.mibi.single_dashboard import ChartInMultipleDashboardsError

    chart = make_chart(db_session)
    make_dashboard(db_session, "A", [chart])
    other = make_dashboard(db_session, "B")

    other.slices.append(chart)
    with pytest.raises(ChartInMultipleDashboardsError) as excinfo:
        db_session.flush()
    assert set(excinfo.value.conflicts) == {chart.id}


def test_orm_rejects_new_dashboard_reusing_chart(db_session: Session) -> None:
    from superset.mibi.single_dashboard import ChartInMultipleDashboardsError

    chart = make_chart(db_session)
    make_dashboard(db_session, "A", [chart])

    with pytest.raises(ChartInMultipleDashboardsError):
        make_dashboard(db_session, "B", [chart])


def test_orm_rejects_from_chart_side(db_session: Session) -> None:
    from superset.mibi.single_dashboard import ChartInMultipleDashboardsError

    chart = make_chart(db_session)
    make_dashboard(db_session, "A", [chart])
    other = make_dashboard(db_session, "B")

    chart.dashboards.append(other)
    with pytest.raises(ChartInMultipleDashboardsError):
        db_session.flush()


def test_orm_allows_moving_chart_in_one_flush(db_session: Session) -> None:
    chart = make_chart(db_session)
    first = make_dashboard(db_session, "A", [chart])
    second = make_dashboard(db_session, "B")

    first.slices.remove(chart)
    second.slices.append(chart)
    db_session.flush()

    assert chart.dashboards == [second]


def test_orm_allows_resaving_same_dashboard(db_session: Session) -> None:
    chart = make_chart(db_session)
    dashboard = make_dashboard(db_session, "A", [chart])

    dashboard.slices = [chart, make_chart(db_session, "other")]
    db_session.flush()

    assert len(dashboard.slices) == 2


def test_orm_allows_sharing_when_disabled(
    db_session: Session, rule_disabled: None
) -> None:
    chart = make_chart(db_session)
    make_dashboard(db_session, "A", [chart])
    make_dashboard(db_session, "B", [chart])

    assert len(chart.dashboards) == 2


def test_find_charts_in_multiple_dashboards(
    db_session: Session, rule_disabled: None
) -> None:
    from superset.mibi.single_dashboard import find_charts_in_multiple_dashboards

    shared = make_chart(db_session, "shared")
    own = make_chart(db_session, "own")
    first = make_dashboard(db_session, "A", [shared, own])
    second = make_dashboard(db_session, "B", [shared])

    assert find_charts_in_multiple_dashboards() == {shared.id: {first.id, second.id}}
    assert find_charts_in_multiple_dashboards([own.id]) == {}


def test_validate_chart_dashboards(db_session: Session) -> None:
    from superset.mibi.single_dashboard import validate_chart_dashboards

    chart = make_chart(db_session)
    first = make_dashboard(db_session, "A", [chart])
    second = make_dashboard(db_session, "B")
    free = make_chart(db_session, "free")

    # several dashboards at once
    assert validate_chart_dashboards(None, [first.id, second.id]) is not None
    # new chart into one dashboard
    assert validate_chart_dashboards(None, [second.id]) is None
    # existing chart stays in its dashboard, or is detached
    assert validate_chart_dashboards(chart, [first.id]) is None
    assert validate_chart_dashboards(chart, []) is None
    # existing chart moved to another dashboard, or to a new one
    assert validate_chart_dashboards(chart, [second.id]) is not None
    assert validate_chart_dashboards(chart, [None]) is not None
    # chart without a dashboard can be added to one
    assert validate_chart_dashboards(free, [second.id]) is None


def test_validate_dashboard_charts(db_session: Session) -> None:
    from superset.mibi.single_dashboard import validate_dashboard_charts

    chart = make_chart(db_session)
    first = make_dashboard(db_session, "A", [chart])
    second = make_dashboard(db_session, "B")
    free = make_chart(db_session, "free")

    assert validate_dashboard_charts(first.id, [chart.id]) is None
    assert validate_dashboard_charts(second.id, [free.id]) is None
    error = validate_dashboard_charts(second.id, [chart.id, free.id])
    assert error is not None
    assert error.field_name == "json_metadata"
    assert str(chart.id) in str(error.messages[0])


def test_update_dashboard_rejects_chart_of_other_dashboard(
    mocker: MockerFixture, db_session: Session
) -> None:
    from superset import security_manager
    from superset.commands.dashboard.exceptions import DashboardInvalidError
    from superset.commands.dashboard.update import UpdateDashboardCommand
    from superset.daos.dashboard import DashboardDAO

    chart = make_chart(db_session)
    make_dashboard(db_session, "A", [chart])
    second = make_dashboard(db_session, "B")
    mocker.patch.object(security_manager, "raise_for_ownership")
    mocker.patch.object(UpdateDashboardCommand, "compute_owners", return_value=[])
    mocker.patch.object(DashboardDAO, "find_by_id", return_value=second)

    positions = {"CHART-1": {"type": "CHART", "meta": {"chartId": chart.id}}}
    command = UpdateDashboardCommand(
        second.id, {"json_metadata": json.dumps({"positions": positions})}
    )
    with pytest.raises(DashboardInvalidError) as excinfo:
        command.validate()
    assert "json_metadata" in excinfo.value.normalized_messages()


def test_copy_dashboard_always_duplicates_charts(
    mocker: MockerFixture, db_session: Session
) -> None:
    from superset.daos.dashboard import DashboardDAO

    mocker.patch("superset.daos.dashboard.g", user=None)
    chart = make_chart(db_session)
    original = make_dashboard(db_session, "A", [chart])
    positions = {"CHART-1": {"type": "CHART", "meta": {"chartId": chart.id}}}

    copied = DashboardDAO.copy_dashboard(
        original,
        {
            "dashboard_title": "A (copy)",
            "json_metadata": json.dumps({"positions": positions}),
            "duplicate_slices": False,
        },
    )
    db_session.flush()

    assert len(copied.slices) == 1
    assert copied.slices[0].id != chart.id
    assert chart.dashboards == [original]


def test_import_rejects_chart_shared_between_dashboards(
    mocker: MockerFixture, db_session: Session
) -> None:
    from superset import security_manager
    from superset.commands.dashboard.importers.v1 import ImportDashboardsCommand
    from superset.mibi.single_dashboard import ChartInMultipleDashboardsError

    mocker.patch.object(security_manager, "can_access", return_value=True)
    g.user = None

    dashboard = copy.deepcopy(
        dashboards_config_1["dashboards/Video_Game_Sales_11.yaml"]
    )
    second_dashboard = {
        **copy.deepcopy(dashboard),
        "dashboard_title": "Video Game Sales (copy)",
        "uuid": "5f1e9c0b-5c9a-4b7e-9d2f-0c6a3f0e7b11",
    }
    configs = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
        "dashboards/first.yaml": dashboard,
        "dashboards/second.yaml": second_dashboard,
    }

    with pytest.raises(ChartInMultipleDashboardsError):
        ImportDashboardsCommand._import(configs, overwrite=True)
