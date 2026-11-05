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
The mobile layout of a page, as in Power BI: boxes in cells of a phone page
``MOBILE_COLUMNS`` wide, kept in ``TAB-*.meta.auradataMobile`` (or ``GRID_ID`` for a
report of one page). Mirrors ``src/auradata/format/mobileLayout.ts``.
"""

from typing import Any, TypedDict

from superset.auradata.layout._js import as_dict, is_finite, js_round, number_or
from superset.auradata.layout.grid import (
    MIN_CHART_COLUMNS,
    MIN_CHART_ROWS,
    MIN_OBJECT_COLUMNS,
    MIN_OBJECT_ROWS,
)
from superset.auradata.layout.keys import CHART_TYPE, MOBILE_LAYOUT_KEY, TABS_TYPE
from superset.auradata.layout.positions import is_positioned

MOBILE_COLUMNS = 12
MOBILE_MIN_ROWS = 24
MOBILE_DEFAULT_MAX_ROWS = 12


class MobileBox(TypedDict):
    """Where an object of the page sits on its phone page, in cells."""

    id: str
    x: int
    y: int
    width: int
    height: int


def _whole(value: Any, fallback: int) -> int:
    return js_round(value) if is_finite(value) else fallback


def _min_width(item: Any) -> int:
    return MIN_CHART_COLUMNS if as_dict(item).get("type") == CHART_TYPE else (
        MIN_OBJECT_COLUMNS
    )


def _min_height(item: Any) -> int:
    return MIN_CHART_ROWS if as_dict(item).get("type") == CHART_TYPE else (
        MIN_OBJECT_ROWS
    )


def fit_box(box: dict[str, Any], item: Any) -> MobileBox:
    """A box kept inside the phone page, with whole cells and the least size."""
    width = min(
        MOBILE_COLUMNS,
        max(_min_width(item), _whole(box.get("width"), MOBILE_COLUMNS)),
    )
    return {
        "id": box["id"],
        "x": max(0, min(MOBILE_COLUMNS - width, _whole(box.get("x"), 0))),
        "y": max(0, _whole(box.get("y"), 0)),
        "width": width,
        "height": max(
            _min_height(item), _whole(box.get("height"), _min_height(item))
        ),
    }


def mobile_candidates(layout: dict[str, Any], page_id: str) -> list[str]:
    """The charts, elements and text boxes of a page, outside nested tabs."""
    found: list[str] = []

    def visit(component_id: str) -> None:
        item = layout.get(component_id)
        if not isinstance(item, dict):
            return
        if is_positioned(item.get("type")):
            found.append(component_id)
            return
        if item.get("type") == TABS_TYPE and component_id != page_id:
            return
        for child_id in item.get("children") or []:
            visit(child_id)

    visit(page_id)
    return found


def mobile_layout_of(
    layout: dict[str, Any], page_id: str | None
) -> list[MobileBox] | None:
    """
    The mobile layout of a page, back to front, or None when it has none. Boxes
    of objects that left the page are left out.
    """
    if not page_id:
        return None
    raw = as_dict(as_dict(as_dict(layout.get(page_id)).get("meta")).get(
        MOBILE_LAYOUT_KEY
    ))
    items = raw.get("items")
    if not isinstance(items, list) or not items:
        return None
    candidates = set(mobile_candidates(layout, page_id))
    seen: set[str] = set()
    boxes: list[MobileBox] = []
    for box in items:
        if not isinstance(box, dict):
            continue
        box_id = box.get("id")
        if not isinstance(box_id, str) or box_id not in candidates or box_id in seen:
            continue
        seen.add(box_id)
        boxes.append(fit_box(box, layout.get(box_id)))
    return boxes or None


def mobile_page_rows(boxes: list[MobileBox] | None) -> int:
    """Height of the phone page: down to the lowest box, at least a screen."""
    bottom = max([0, *(box["y"] + box["height"] for box in boxes or [])])
    return max(MOBILE_MIN_ROWS, bottom)


def mobile_size_of(item: Any) -> dict[str, int]:
    """The size an object takes when it is added to the phone page."""
    meta = as_dict(as_dict(item).get("meta"))
    width = number_or(meta.get("width"), MOBILE_COLUMNS)
    height = number_or(meta.get("height"), MOBILE_DEFAULT_MAX_ROWS)
    scaled = js_round(height * MOBILE_COLUMNS / width)
    return {
        "width": MOBILE_COLUMNS,
        "height": max(_min_height(item), min(MOBILE_DEFAULT_MAX_ROWS, scaled)),
    }
