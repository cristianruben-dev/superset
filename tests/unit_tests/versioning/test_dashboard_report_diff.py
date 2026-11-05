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
The version history of AuraData BI report settings: "Edit interactions"
(``chart_configuration``), the canvas format and bookmarks (``ROOT_ID``), the
settings of a report of one page such as its mobile layout (``GRID_ID``) and
design elements. Saved the same way by the editor and the MCP tools.
"""

from __future__ import annotations

import copy
from typing import Any

from superset.utils import json
from superset.versioning.diff import ChangeRecord, diff_dashboard


def _metadata(charts: dict[str, Any]) -> dict[str, Any]:
    return {
        "color_scheme": "",
        "cross_filters_enabled": True,
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
            "chartsInScope": [1, 2],
        },
        "chart_configuration": charts,
    }


def _chart_config(chart_id: int, excluded: list[int], in_scope: list[int]) -> Any:
    return {
        "id": chart_id,
        "crossFilters": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": excluded},
            "chartsInScope": in_scope,
        },
    }


def _layout() -> dict[str, Any]:
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
        },
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-1"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {},
        },
        "CHART-1": {
            "type": "CHART",
            "id": "CHART-1",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
            "meta": {"chartId": 1, "width": 12, "height": 12},
        },
    }


def _diff(
    pre_layout: dict[str, Any],
    post_layout: dict[str, Any],
    pre_metadata: dict[str, Any] | None = None,
    post_metadata: dict[str, Any] | None = None,
) -> list[ChangeRecord]:
    pre_metadata = pre_metadata or _metadata({})
    return diff_dashboard(
        {
            "position_json": json.dumps(pre_layout),
            "json_metadata": json.dumps(pre_metadata),
        },
        {
            "position_json": json.dumps(post_layout),
            "json_metadata": json.dumps(post_metadata or pre_metadata),
        },
        fields=[],
    )


def test_an_interaction_set_to_none_is_recorded() -> None:
    before = _metadata({"1": _chart_config(1, [], [2])})
    after = _metadata({"1": _chart_config(1, [2], [])})
    (record,) = _diff(_layout(), _layout(), before, after)
    assert record.kind == "interaction"
    assert record.operation == "edit"
    assert record.path == ["json_metadata", "chart_configuration", "1"]
    assert record.to_value == {"rootPath": ["ROOT_ID"], "excluded": [2]}


def test_the_dashboard_scope_is_recorded() -> None:
    before = _metadata({})
    after = copy.deepcopy(before)
    after["global_chart_configuration"]["scope"]["excluded"] = [2]
    (record,) = _diff(_layout(), _layout(), before, after)
    assert record.kind == "interaction"
    assert record.path == ["json_metadata", "global_chart_configuration"]


def test_charts_joining_the_dashboard_record_no_interaction() -> None:
    """A new chart following the dashboard's scope, and the derived lists of
    charts in scope, are not interactions anybody set."""
    before = _metadata({"1": _chart_config(1, [], [])})
    after = _metadata(
        {
            "1": _chart_config(1, [], [2]),
            "2": {"id": 2, "crossFilters": {"scope": "global", "chartsInScope": [1]}},
        }
    )
    after["global_chart_configuration"]["chartsInScope"] = [1, 2, 3]
    assert _diff(_layout(), _layout(), before, after) == []


def test_bookmarks_and_canvas_format_are_recorded_by_setting() -> None:
    after = _layout()
    after["ROOT_ID"]["meta"]["auradataBookmarks"] = [
        {"id": "abc", "name": "Norte", "page": "GRID_ID"}
    ]
    after["ROOT_ID"]["meta"]["auradataCanvas"] = {"background": "#ffffff"}
    after["ROOT_ID"]["meta"]["auradataFieldStep"] = 4
    records = _diff(_layout(), after)
    assert [(r.kind, r.operation, r.path) for r in records] == [
        ("report", "add", ["ROOT_ID", "auradataBookmarks"]),
        ("report", "add", ["ROOT_ID", "auradataCanvas"]),
    ]


def test_the_mobile_layout_of_a_one_page_report_is_recorded() -> None:
    before = _layout()
    after = copy.deepcopy(before)
    after["GRID_ID"]["meta"] = {
        "auradataMobile": {
            "items": [{"id": "CHART-1", "x": 0, "y": 0, "width": 12, "height": 8}]
        }
    }
    (record,) = _diff(before, after)
    assert (record.kind, record.operation, record.path) == (
        "report",
        "add",
        ["GRID_ID", "auradataMobile"],
    )


def test_design_elements_are_recorded() -> None:
    after = _layout()
    after["ROW-1"]["children"].append("DYNAMIC-1")
    after["DYNAMIC-1"] = {
        "type": "DYNAMIC",
        "id": "DYNAMIC-1",
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
        "meta": {"componentKey": "auradata-button", "width": 4, "height": 2},
    }
    records = [r for r in _diff(_layout(), after) if r.kind != "row"]
    assert [(r.kind, r.operation, r.path) for r in records] == [
        ("element", "add", ["DYNAMIC-1"])
    ]


def test_the_grid_and_root_still_record_no_component_changes() -> None:
    after = _layout()
    after["ROOT_ID"]["children"] = ["GRID_ID", "HEADER_ID"]
    after["GRID_ID"]["parents"] = ["ROOT_ID", "X"]
    assert _diff(_layout(), after) == []


def test_a_page_setting_is_recorded_whole_and_its_name_by_leaf() -> None:
    before = _layout()
    before["ROOT_ID"]["children"] = ["TABS-1"]
    before["TABS-1"] = {"type": "TABS", "id": "TABS-1", "children": ["TAB-1"]}
    before["TAB-1"] = {
        "type": "TAB",
        "id": "TAB-1",
        "children": [],
        "parents": ["ROOT_ID", "TABS-1"],
        "meta": {"text": "Resumen"},
    }
    after = copy.deepcopy(before)
    after["TAB-1"]["meta"]["text"] = "Ventas"
    after["TAB-1"]["meta"]["auradataMobile"] = {"items": []}
    records = _diff(before, after)
    assert [(r.kind, r.path, r.to_value) for r in records] == [
        ("report", ["TAB-1", "auradataMobile"], {"items": []}),
        ("tab", ["TAB-1", "text"], "Ventas"),
    ]


def test_a_new_report_metadata_saves_without_phantom_changes() -> None:
    """The first metadata write of a report made by generate_dashboard records
    only what it changed, not the keys the update command normalizes."""
    from types import SimpleNamespace

    from superset.daos.dashboard import DashboardDAO
    from superset.mcp_service.dashboard.tool.generate_dashboard import (
        default_json_metadata,
    )

    saved = json.dumps(default_json_metadata())
    dashboard = SimpleNamespace(json_metadata=saved, params_dict=json.loads(saved))
    # What a metadata tool sends: the whole metadata, with one change
    data = {**json.loads(saved), "filter_bar_auto_apply": False}
    DashboardDAO.set_dash_metadata(dashboard, data)  # type: ignore[arg-type]

    records = diff_dashboard(
        {"json_metadata": saved},
        {"json_metadata": dashboard.json_metadata},
        fields=[],
    )
    assert [(r.kind, r.path, r.to_value) for r in records] == [
        ("field", ["json_metadata", "filter_bar_auto_apply"], False)
    ]
