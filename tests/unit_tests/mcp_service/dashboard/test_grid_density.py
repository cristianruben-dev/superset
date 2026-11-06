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
"""Charts added by the MCP tools take the grid density of their dashboard."""

from typing import Any
from unittest.mock import Mock

import pytest

from superset.mcp_service.dashboard.constants import (
    canvas_cells,
    layout_column_count,
    scaled_width,
)
from superset.mcp_service.dashboard.tool.add_chart_to_existing_dashboard import (
    _add_chart_to_layout,
)


@pytest.mark.parametrize(
    ("layout", "expected"),
    [
        ({}, 12),
        ({"ROOT_ID": {"meta": {}}}, 12),
        ({"ROOT_ID": {"meta": {"auradataColumns": 48}}}, 48),
        ({"ROOT_ID": {"meta": {"auradataColumns": 7}}}, 12),
        ({"ROOT_ID": "broken"}, 12),
        # A layout in cells has the columns of its page, in cells
        ({"ROOT_ID": {"meta": {"auradataCells": True}}}, 60),
        (
            {"ROOT_ID": {"meta": {"auradataCells": True, "auradataColumns": 48}}},
            60,
        ),
        (
            {
                "ROOT_ID": {
                    "meta": {
                        "auradataCells": True,
                        "auradataCanvas": {"size": {"mode": "4:3"}},
                    }
                }
            },
            45,
        ),
    ],
)
def test_layout_column_count(layout: dict[str, Any], expected: int) -> None:
    assert layout_column_count(layout) == expected


def test_scaled_width() -> None:
    assert scaled_width(4, 12) == 4
    assert scaled_width(4, 48) == 16
    assert scaled_width(1, 12) == 1


def test_a_chart_added_to_a_48_column_dashboard() -> None:
    layout: dict[str, Any] = {
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["GRID_ID"],
            "meta": {"auradataColumns": 48},
        },
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": [],
            "parents": ["ROOT_ID"],
        },
    }
    chart = Mock(slice_name="Ventas", uuid=None)
    chart_key, row_key = _add_chart_to_layout(layout, chart, 7, "ROW-new", "GRID_ID")
    assert layout[chart_key]["meta"]["width"] == 12
    assert "width" not in layout[row_key]["meta"]


@pytest.mark.parametrize(
    ("size", "expected"),
    [
        (None, (60, 34)),
        ({"mode": "letter"}, (26, 34)),
        ({"mode": "custom", "width": 1000, "height": 500}, (31, 16)),
        # Kept between 10 and 128 cells; an empty side takes the 16:9 one
        ({"mode": "custom", "width": 100, "height": 99999}, (10, 128)),
        ({"mode": "custom", "width": 0}, (60, 34)),
    ],
)
def test_canvas_cells(size: dict[str, Any] | None, expected: tuple[int, int]) -> None:
    canvas = {"size": size} if size else {}
    layout = {"ROOT_ID": {"meta": {"auradataCells": True, "auradataCanvas": canvas}}}
    assert canvas_cells(layout) == expected
