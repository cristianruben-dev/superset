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
"""Tests for superset/mibi/split_shared_charts.py."""

from collections.abc import Iterator
from typing import Any

import pytest
from flask import current_app
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json


@pytest.fixture
def db_session(session: Session) -> Iterator[Session]:
    from superset.mibi.single_dashboard import register_listeners

    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    register_listeners()
    yield session
    session.rollback()


def make_layout(*chart_ids: int) -> dict[str, Any]:
    return {
        f"CHART-{chart_id}": {
            "type": "CHART",
            "meta": {"chartId": chart_id, "uuid": f"uuid-{chart_id}"},
        }
        for chart_id in chart_ids
    }


def make_metadata(*chart_ids: int) -> dict[str, Any]:
    first = chart_ids[0]
    return {
        "expanded_slices": {str(first): True},
        "timed_refresh_immune_slices": [first],
        "native_filter_configuration": [
            {"id": "NATIVE_FILTER-1", "chartsInScope": list(chart_ids)},
        ],
        "chart_configuration": {
            str(first): {
                "id": first,
                "crossFilters": {"scope": "global", "chartsInScope": list(chart_ids)},
            }
        },
        "default_filters": json.dumps({str(first): {"col": ["a"]}}),
    }


def make_shared_dashboards(session: Session) -> tuple[Dashboard, Dashboard, Slice]:
    """Two dashboards that share a chart, created with the rule switched off."""
    current_app.config["MIBI_SINGLE_DASHBOARD_CHARTS"] = False
    try:
        shared = Slice(slice_name="shared", viz_type="table", datasource_type="table")
        own = Slice(slice_name="own", viz_type="table", datasource_type="table")
        session.add_all([shared, own])
        session.flush()

        first = Dashboard(dashboard_title="A", slices=[shared])
        second = Dashboard(dashboard_title="B", slices=[shared, own])
        session.add_all([first, second])
        session.flush()

        for dashboard, chart_ids in (
            (first, [shared.id]),
            (second, [shared.id, own.id]),
        ):
            dashboard.position_json = json.dumps(make_layout(*chart_ids))
            dashboard.json_metadata = json.dumps(make_metadata(*chart_ids))
        session.flush()
    finally:
        current_app.config["MIBI_SINGLE_DASHBOARD_CHARTS"] = True
    return first, second, shared


def test_split_shared_charts(db_session: Session) -> None:
    from superset.mibi.single_dashboard import find_charts_in_multiple_dashboards
    from superset.mibi.split_shared_charts import split_shared_charts

    first, second, shared = make_shared_dashboards(db_session)
    own_id = next(chart.id for chart in second.slices if chart.id != shared.id)

    result = split_shared_charts()

    assert set(result.replacements) == {second.id}
    clone_id = result.replacements[second.id][shared.id]
    clone = db_session.query(Slice).get(clone_id)
    assert clone.slice_name == "shared"
    assert clone.uuid != shared.uuid

    # the lowest id dashboard keeps the original chart
    assert [chart.id for chart in first.slices] == [shared.id]
    assert {chart.id for chart in second.slices} == {clone_id, own_id}
    assert find_charts_in_multiple_dashboards() == {}

    layout = json.loads(second.position_json)
    assert layout[f"CHART-{shared.id}"]["meta"] == {
        "chartId": clone_id,
        "uuid": str(clone.uuid),
    }
    assert layout[f"CHART-{own_id}"]["meta"]["chartId"] == own_id

    metadata = json.loads(second.json_metadata)
    assert metadata["expanded_slices"] == {str(clone_id): True}
    assert metadata["timed_refresh_immune_slices"] == [clone_id]
    assert metadata["native_filter_configuration"][0]["chartsInScope"] == [
        clone_id,
        own_id,
    ]
    chart_configuration = metadata["chart_configuration"][str(clone_id)]
    assert chart_configuration["id"] == clone_id
    assert chart_configuration["crossFilters"]["chartsInScope"] == [clone_id, own_id]
    assert json.loads(metadata["default_filters"]) == {str(clone_id): {"col": ["a"]}}

    # the original dashboard's references are untouched
    assert json.loads(first.position_json) == make_layout(shared.id)


def test_split_shared_charts_is_idempotent(db_session: Session) -> None:
    from superset.mibi.split_shared_charts import split_shared_charts

    make_shared_dashboards(db_session)
    assert split_shared_charts().cloned_charts == 1
    assert split_shared_charts().cloned_charts == 0
