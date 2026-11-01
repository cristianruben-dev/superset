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
"""Tests for superset/mibi/previews.py."""

from types import SimpleNamespace
from typing import Any

from superset.mibi.previews import dashboard_preview, MAX_ROWS
from superset.utils import json


def make_dashboard(layout: dict[str, Any] | str | None, charts: dict[int, str]):
    return SimpleNamespace(
        position_json=layout
        if isinstance(layout, str) or layout is None
        else json.dumps(layout),
        slices=[SimpleNamespace(id=id_, viz_type=viz) for id_, viz in charts.items()],
    )


def chart(id_: str, chart_id: int, width: int = 4, height: int = 50):
    return {
        id_: {
            "type": "CHART",
            "id": id_,
            "meta": {"chartId": chart_id, "width": width, "height": height},
        }
    }


def test_rows_and_columns():
    layout = {
        "ROOT_ID": {"type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"type": "GRID", "children": ["ROW-1", "ROW-2"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a", "COLUMN-1"]},
        "COLUMN-1": {
            "type": "COLUMN",
            "meta": {"width": 6},
            "children": ["CHART-b", "MARKDOWN-1"],
        },
        "MARKDOWN-1": {"type": "MARKDOWN", "meta": {"width": 6, "height": 20}},
        "ROW-2": {"type": "ROW", "children": ["CHART-c", "DIVIDER-1"]},
        "DIVIDER-1": {"type": "DIVIDER"},
        **chart("CHART-a", 1, 6, 40),
        **chart("CHART-b", 2, 6, 30),
        **chart("CHART-c", 3, 12, 60),
    }
    dashboard = make_dashboard(
        layout, {1: "big_number_total", 2: "pie", 3: "echarts_timeseries_bar"}
    )

    assert dashboard_preview(dashboard) == [
        [
            {"width": 6, "height": 40, "kind": "big_number_total"},
            {
                "width": 6,
                "height": 50,
                "kind": "column",
                "cells": [
                    {"width": 6, "height": 30, "kind": "pie"},
                    {"width": 6, "height": 20, "kind": "markdown"},
                ],
            },
        ],
        [{"width": 12, "height": 60, "kind": "echarts_timeseries_bar"}],
    ]


def test_uses_the_first_tab():
    layout = {
        "GRID_ID": {"type": "GRID", "children": ["TABS-1"]},
        "TABS-1": {"type": "TABS", "children": ["TAB-1", "TAB-2"]},
        "TAB-1": {"type": "TAB", "children": ["ROW-1"]},
        "TAB-2": {"type": "TAB", "children": ["ROW-2"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a"]},
        "ROW-2": {"type": "ROW", "children": ["CHART-b"]},
        **chart("CHART-a", 1),
        **chart("CHART-b", 2),
    }
    dashboard = make_dashboard(layout, {1: "table", 2: "pie"})

    assert dashboard_preview(dashboard) == [
        [{"width": 4, "height": 50, "kind": "table"}]
    ]


def test_uses_the_first_top_level_tab():
    # Top-level tabs (pages) hang from the root; the grid is left empty
    layout = {
        "ROOT_ID": {"type": "ROOT", "children": ["TABS-1"]},
        "GRID_ID": {"type": "GRID", "children": []},
        "TABS-1": {"type": "TABS", "children": ["TAB-1", "TAB-2"]},
        "TAB-1": {"type": "TAB", "children": ["ROW-1"]},
        "TAB-2": {"type": "TAB", "children": ["ROW-2"]},
        "ROW-1": {"type": "ROW", "children": ["CHART-a"]},
        "ROW-2": {"type": "ROW", "children": ["CHART-b"]},
        **chart("CHART-a", 1),
        **chart("CHART-b", 2),
    }
    dashboard = make_dashboard(layout, {1: "table", 2: "pie"})

    assert dashboard_preview(dashboard) == [
        [{"width": 4, "height": 50, "kind": "table"}]
    ]


def test_limits_rows_and_handles_unknown_charts():
    rows = {f"ROW-{i}": {"type": "ROW", "children": ["CHART-x"]} for i in range(9)}
    layout = {
        "GRID_ID": {"type": "GRID", "children": list(rows)},
        **rows,
        **chart("CHART-x", 99),
    }

    preview = dashboard_preview(make_dashboard(layout, {}))

    assert len(preview) == MAX_ROWS
    assert preview[0][0]["kind"] == "chart"


def test_unreadable_layouts():
    assert dashboard_preview(make_dashboard(None, {})) == []
    assert dashboard_preview(make_dashboard("not json", {})) == []
    assert dashboard_preview(make_dashboard("[]", {})) == []
    assert dashboard_preview(make_dashboard({"CHART-1": {}}, {})) == []
