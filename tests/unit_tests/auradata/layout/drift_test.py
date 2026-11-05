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
Drift guard: the Python report model gives the frontend's results for the
shared fixtures of ``tests/fixtures/auradata/layouts``, written by
``superset-frontend/src/auradata/format/layoutDrift.test.ts``.
"""

from pathlib import Path
from typing import Any, Callable

import pytest

from superset.auradata.layout import (
    canvas_size,
    clamp_to_page,
    column_count_of,
    free_cell,
    is_hidden_page,
    keys,
    layout_to_cells,
    layout_to_positions,
    merge_visual_format,
    mobile_layout_of,
    mobile_size_of,
    page_ids,
    page_objects,
    page_title,
    place_at,
    top_tabs_id,
)
from superset.utils import json

FIXTURES = Path(__file__).parents[3] / "fixtures" / "auradata" / "layouts"


def _canvas_size(canvas: Any) -> dict[str, int]:
    width, height = canvas_size(canvas)
    return {"width": width, "height": height}


def _top_level_tabs(layout: dict[str, Any]) -> list[dict[str, Any]]:
    if not top_tabs_id(layout):
        return []
    return [
        {
            "id": page_id,
            "title": page_title(layout, page_id),
            "hidden": is_hidden_page(layout[page_id].get("meta")),
        }
        for page_id in page_ids(layout)
    ]


FUNCTIONS: dict[str, Callable[..., Any]] = {
    "canvasSize": _canvas_size,
    "columnCountOf": column_count_of,
    "layoutToCells": layout_to_cells,
    "layoutToPositions": layout_to_positions,
    "loadLayout": lambda layout: layout_to_positions(layout_to_cells(layout)),
    "freeCell": free_cell,
    "clampToPage": clamp_to_page,
    "placeAt": place_at,
    "mergeVisualFormat": merge_visual_format,
    "mobileLayoutOf": mobile_layout_of,
    "mobileSizeOf": mobile_size_of,
    "pageObjects": page_objects,
    "topLevelTabs": _top_level_tabs,
}


def _cases() -> list[Any]:
    cases = []
    for path in sorted(FIXTURES.glob("*.json")):
        if path.name == "meta_keys.json":
            continue
        fixture = json.loads(path.read_text())
        for case in fixture["cases"]:
            cases.append(
                pytest.param(
                    fixture["fn"],
                    case["args"],
                    case["expected"],
                    id=f"{path.stem}: {case['name']}",
                )
            )
    return cases


@pytest.mark.parametrize(("fn", "args", "expected"), _cases())
def test_layout_fixture(fn: str, args: list[Any], expected: Any) -> None:
    result = FUNCTIONS[fn](*args)
    # Through JSON, as the frontend wrote it
    assert json.loads(json.dumps(result)) == expected


def test_python_knows_every_layout_meta_key() -> None:
    contract = json.loads((FIXTURES / "meta_keys.json").read_text())
    assert keys.LAYOUT_META_KEYS == set(contract["layout_meta"])
    assert sorted(keys.ELEMENT_KINDS) == contract["element_kinds"]


def test_element_kind() -> None:
    assert keys.element_kind("auradata-button") == "button"
    assert keys.element_kind("auradata-chart") is None
    assert keys.element_kind("button") is None
    assert keys.element_kind(None) is None


@pytest.mark.parametrize("count", [0, 1, 4, 5, 20, 21, 45])
def test_generated_reports_load_unchanged(count: int) -> None:
    """What generate_dashboard writes is what the editor would save."""
    from types import SimpleNamespace

    from superset.mcp_service.dashboard.tool.generate_dashboard import (
        _create_dashboard_layout,
    )

    charts = [
        SimpleNamespace(id=i, slice_name=f"Chart {i}", uuid=None)
        for i in range(1, count + 1)
    ]
    layout = json.loads(json.dumps(_create_dashboard_layout(charts)))
    assert layout_to_positions(layout_to_cells(layout)) == layout
    assert (
        sum(
            1
            for item in layout.values()
            if isinstance(item, dict) and item.get("type") == "CHART"
        )
        == count
    )
