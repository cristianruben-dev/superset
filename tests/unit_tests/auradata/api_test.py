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
"""Tests for superset/auradata/api.py."""

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

    ids = prison.dumps([with_layout.id, empty.id])
    response = client.get(f"/api/v1/auradata/dashboard_previews/?q={ids}")

    assert response.status_code == 200
    assert response.json["result"] == [
        {
            "id": with_layout.id,
            "rows": [[{"width": 3, "height": 50, "kind": "big_number_total"}]],
        },
        {"id": empty.id, "rows": []},
    ]


def test_dashboard_previews_rejects_bad_ids(client: Any, full_api_access: None) -> None:
    response = client.get("/api/v1/auradata/dashboard_previews/?q=(a:1)")

    assert response.status_code == 400


def test_mcp_connection_uses_configured_url(
    app: Any, client: Any, full_api_access: None
) -> None:
    app.config["MCP_SERVICE_URL"] = "https://bi.example.com/mcp/"
    app.config["MCP_API_KEY_ENABLED"] = True
    try:
        response = client.get("/api/v1/auradata/mcp_connection/")
    finally:
        app.config.pop("MCP_SERVICE_URL", None)
        app.config.pop("MCP_API_KEY_ENABLED", None)

    assert response.status_code == 200
    assert response.json["result"] == {
        "url": "https://bi.example.com/mcp",
        "api_keys_enabled": True,
    }


def test_mcp_connection_adds_the_mcp_path(
    app: Any, client: Any, full_api_access: None
) -> None:
    app.config["MCP_SERVICE_URL"] = "http://localhost:5008"
    app.config["MCP_API_KEY_ENABLED"] = False
    try:
        response = client.get("/api/v1/auradata/mcp_connection/")
    finally:
        app.config.pop("MCP_SERVICE_URL", None)
        app.config.pop("MCP_API_KEY_ENABLED", None)

    assert response.json["result"] == {
        "url": "http://localhost:5008/mcp",
        "api_keys_enabled": False,
    }


def test_mcp_connection_without_a_configured_url(
    app: Any, client: Any, full_api_access: None
) -> None:
    previous = app.config.pop("MCP_SERVICE_URL", None)
    try:
        response = client.get("/api/v1/auradata/mcp_connection/")
    finally:
        if previous is not None:
            app.config["MCP_SERVICE_URL"] = previous

    assert response.json["result"]["url"] is None
