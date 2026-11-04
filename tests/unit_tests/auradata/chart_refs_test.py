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
"""Tests for the chart ids a copied dashboard follows (auradata/chart_refs.py)."""

from collections.abc import Iterator
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.auradata.chart_refs import (
    remap_bookmark_chart_ids,
    remap_metadata_chart_ids,
)
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json


@pytest.fixture
def db_session(session: Session) -> Iterator[Session]:
    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    yield session
    session.rollback()


def bookmarked_positions(chart_id: int) -> dict[str, Any]:
    return {
        "ROOT_ID": {
            "type": "ROOT",
            "meta": {
                "mibiBookmarks": [
                    {
                        "id": "b1",
                        "name": "North",
                        "options": {"data": True, "display": True, "page": True},
                        "filters": {
                            str(chart_id): {"filterState": {"value": ["North"]}},
                            "NATIVE_FILTER-abc": {"filterState": {"value": [1]}},
                        },
                        "visibility": {"CHART-1": True},
                    }
                ]
            },
        },
        "CHART-1": {"type": "CHART", "meta": {"chartId": chart_id}},
    }


def test_remap_bookmark_chart_ids_keeps_native_filters() -> None:
    positions = bookmarked_positions(59)

    remap_bookmark_chart_ids(positions, {59: 104})

    filters = positions["ROOT_ID"]["meta"]["mibiBookmarks"][0]["filters"]
    assert set(filters) == {"104", "NATIVE_FILTER-abc"}
    assert filters["104"] == {"filterState": {"value": ["North"]}}


def test_remap_bookmark_chart_ids_without_bookmarks() -> None:
    positions = {"ROOT_ID": {"type": "ROOT", "meta": {}}}

    remap_bookmark_chart_ids(positions, {59: 104})

    assert positions == {"ROOT_ID": {"type": "ROOT", "meta": {}}}


def test_remap_metadata_chart_ids() -> None:
    metadata: dict[str, Any] = {
        "chart_configuration": {
            "59": {
                "id": 59,
                "crossFilters": {"scope": {"rootPath": ["ROOT_ID"], "excluded": [62]}},
            }
        },
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [62]}
        },
        "native_filter_configuration": [
            {"id": "NATIVE_FILTER-abc", "scope": {"excluded": [59]}}
        ],
        "expanded_slices": {"62": True},
        "timed_refresh_immune_slices": [59],
    }

    remap_metadata_chart_ids(metadata, {59: 104, 62: 105})

    assert metadata["chart_configuration"] == {
        "104": {
            "id": 104,
            "crossFilters": {"scope": {"rootPath": ["ROOT_ID"], "excluded": [105]}},
        }
    }
    assert metadata["global_chart_configuration"]["scope"]["excluded"] == [105]
    assert metadata["native_filter_configuration"][0]["scope"]["excluded"] == [104]
    assert metadata["expanded_slices"] == {"105": True}
    assert metadata["timed_refresh_immune_slices"] == [104]


def test_copy_dashboard_points_bookmarks_at_the_copies(
    mocker: MockerFixture, db_session: Session
) -> None:
    from superset import security_manager
    from superset.daos.dashboard import DashboardDAO

    mocker.patch("superset.daos.dashboard.g", user=None)
    # Copying a dashboard needs editorship of it
    mocker.patch.object(security_manager, "is_editor", return_value=True)
    chart = Slice(slice_name="chart", viz_type="table", datasource_type="table")
    db_session.add(chart)
    db_session.flush()
    original = Dashboard(
        dashboard_title="A",
        slices=[chart],
        json_metadata=json.dumps(
            {"chart_configuration": {str(chart.id): {"id": chart.id}}}
        ),
    )
    db_session.add(original)
    db_session.flush()

    copied = DashboardDAO.copy_dashboard(
        original,
        {
            "dashboard_title": "A (copy)",
            "json_metadata": json.dumps({"positions": bookmarked_positions(chart.id)}),
            "duplicate_slices": True,
        },
    )
    db_session.flush()

    new_id = copied.slices[0].id
    assert new_id != chart.id
    positions = json.loads(copied.position_json)
    filters = positions["ROOT_ID"]["meta"]["mibiBookmarks"][0]["filters"]
    assert set(filters) == {str(new_id), "NATIVE_FILTER-abc"}
    assert json.loads(copied.json_metadata)["chart_configuration"] == {
        str(new_id): {"id": new_id}
    }
