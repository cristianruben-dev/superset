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
"""Tests for superset/mibi/api.py."""

from typing import Any

import prison
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json


def test_dashboard_previews(
    mocker: MockerFixture, client: Any, full_api_access: None, session: Session
) -> None:
    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    chart = Slice(
        slice_name="kpi", viz_type="big_number_total", datasource_type="table"
    )
    session.add(chart)
    session.flush()
    layout = {
        "GRID_ID": {"type": "GRID", "children": ["ROW-1"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-1"]},
        "CHART-1": {"type": "CHART", "meta": {"chartId": chart.id, "width": 3}},
    }
    with_layout = Dashboard(
        dashboard_title="A", slices=[chart], position_json=json.dumps(layout)
    )
    empty = Dashboard(dashboard_title="B")
    session.add_all([with_layout, empty])
    session.flush()
    # Access filtering is the DAO's job; here every dashboard is visible
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_ids",
        return_value=[with_layout, empty],
    )

    response = client.get(
        f"/api/v1/mibi/dashboard_previews/?q={prison.dumps([with_layout.id, empty.id])}"
    )

    assert response.status_code == 200
    assert response.json["result"] == [
        {
            "id": with_layout.id,
            "rows": [[{"width": 3, "height": 50, "kind": "big_number_total"}]],
        },
        {"id": empty.id, "rows": []},
    ]


def test_dashboard_previews_rejects_bad_ids(client: Any, full_api_access: None) -> None:
    response = client.get("/api/v1/mibi/dashboard_previews/?q=(a:1)")

    assert response.status_code == 400
