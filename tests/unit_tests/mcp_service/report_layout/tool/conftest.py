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
A report on a real database for the report layout tools. Dani edits the
dashboard as its editor, Ana and Ada as contributor and admin of its workspace;
Vera only views it and Carlos is in another workspace.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.models.dashboard import Dashboard
from superset.subjects.utils import get_or_create_user_subject
from superset.utils import json
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)


def report_layout(chart_id: int) -> dict[str, Any]:
    """A report of one page in cells: a chart and a text box."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["GRID_ID"],
            "meta": {"auradataCells": True},
        },
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-1"],
            "parents": ["ROOT_ID"],
            "meta": {
                "auradataMobile": {
                    "items": [
                        {"id": "CHART-1", "x": 0, "y": 0, "width": 12, "height": 6}
                    ]
                }
            },
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-1", "MARKDOWN-1"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "CHART-1": {
            "type": "CHART",
            "id": "CHART-1",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "meta": {
                "chartId": chart_id,
                "width": 12,
                "height": 12,
                "auradataPos": {"x": 0, "y": 0},
            },
        },
        "MARKDOWN-1": {
            "type": "MARKDOWN",
            "id": "MARKDOWN-1",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "meta": {
                "width": 10,
                "height": 6,
                "code": "# Ventas",
                "auradataPos": {"x": 20, "y": 0},
            },
        },
    }


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    dashboard = world["dashboard"]
    dashboard.position_json = json.dumps(report_layout(world["chart"].id))
    # Dani edits the dashboard and its chart as their editor
    subject = get_or_create_user_subject(world["users"]["Dani"].id)
    dashboard.editors = [subject]
    world["chart"].editors = [subject]
    session.commit()
    return world


def layout(world: dict[str, Any]) -> dict[str, Any]:
    session = world["session"]
    session.expire_all()
    dashboard = session.get(Dashboard, world["dashboard"].id)
    return json.loads(dashboard.position_json)


def ok(result: dict[str, Any]) -> dict[str, Any]:
    assert result.get("error") is None, result
    return result


async def as_editor(world: dict[str, Any], tool: str, **request: Any) -> dict[str, Any]:
    as_user(world, "Ana")
    return await call(tool, {"dashboard": world["dashboard"].id, **request})
