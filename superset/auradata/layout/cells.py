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
Layouts saved before the cell grid have widths in 12, 24 or 48 columns, heights
in steps of 8 px and a canvas with margins and gaps. ``layout_to_cells`` converts
them once, keeping each object about where and as big as it was, and marks the
root with ``auradataCells``. Mirrors ``src/auradata/format/cells.ts``.
"""

from typing import Any

from superset.auradata.layout._js import (
    as_dict,
    is_number,
    js_round,
    number_or,
    truthy,
)
from superset.auradata.layout.grid import (
    CELL,
    MIN_OBJECT_COLUMNS,
    MIN_OBJECT_ROWS,
    root_meta,
)
from superset.auradata.layout.keys import (
    CANVAS_FORMAT_KEY,
    CELLS_KEY,
    COLUMN_TYPE,
    LEGACY_COLUMN_COUNT_KEY,
    ROOT_ID,
    ROW_TYPE,
)

# Superset's grid before the cell grid
GRID_BASE_UNIT = 8
GRID_GUTTER_SIZE = 2 * GRID_BASE_UNIT

# Pixel sizes of the pages before the cell grid
LEGACY_PAGE: dict[str, tuple[Any, Any]] = {
    "16:9": (1280, 720),
    "4:3": (960, 720),
    "letter": (816, 1056),
}


def _legacy_page(canvas: dict[str, Any] | None) -> tuple[Any, Any]:
    size = as_dict(as_dict(canvas).get("size"))
    if size.get("mode") == "custom":
        width, height = size.get("width"), size.get("height")
        return (width if truthy(width) else 1280, height if truthy(height) else 720)
    mode = size.get("mode")
    return LEGACY_PAGE.get(mode if isinstance(mode, str) else "", LEGACY_PAGE["16:9"])


def _to_cells(pixels: float, least: int = 1) -> int:
    return max(least, js_round(pixels / CELL))


def is_in_cells(layout: Any) -> bool:
    """Whether a layout already has its sizes in cells."""
    return truthy(root_meta(layout).get(CELLS_KEY))


def _items(layout: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in layout.values() if isinstance(item, dict)]


def _fit_rows(
    layout: dict[str, Any], widths: dict[str, int], columns: int
) -> None:
    """Rounding must not make a row wider than the page."""
    for item in _items(layout):
        if item.get("type") != ROW_TYPE:
            continue
        kids = [kid for kid in item.get("children") or [] if kid in widths]
        if not kids:
            continue
        total = sum(widths[kid] for kid in kids)
        while total > columns:
            widest = kids[0]
            for kid in kids[1:]:
                if widths[kid] > widths[widest]:
                    widest = kid
            if widths[widest] <= MIN_OBJECT_COLUMNS:
                break
            widths[widest] -= 1
            total -= 1


def _fit_columns(layout: dict[str, Any], widths: dict[str, int]) -> None:
    """Objects in a column stay within it."""
    for item in _items(layout):
        column_id = item.get("id")
        if item.get("type") != COLUMN_TYPE or not column_id:
            continue
        if not widths.get(column_id):
            continue

        def visit(component_id: str, column: str) -> None:
            if component_id in widths:
                widths[component_id] = min(widths[component_id], widths[column])
            child = layout.get(component_id)
            for grandchild in as_dict(child).get("children") or []:
                visit(grandchild, column)

        for child_id in item.get("children") or []:
            visit(child_id, column_id)


def layout_to_cells(layout: dict[str, Any]) -> dict[str, Any]:
    """
    The layout with its sizes in cells; the same object when it already is.
    A layout without sized objects only gets the marker.
    """
    root = layout.get(ROOT_ID) if isinstance(layout, dict) else None
    if not isinstance(root, dict) or truthy(as_dict(root.get("meta")).get(CELLS_KEY)):
        return layout

    items = _items(layout)
    sized = any(is_number(as_dict(item.get("meta")).get("width")) for item in items)
    marked = {
        **layout,
        ROOT_ID: {**root, "meta": {**as_dict(root.get("meta")), CELLS_KEY: True}},
    }
    if not sized:
        return marked

    meta = as_dict(root.get("meta"))
    canvas = meta.get(CANVAS_FORMAT_KEY)
    canvas = canvas if isinstance(canvas, dict) else None
    legacy_columns = number_or(meta.get(LEGACY_COLUMN_COUNT_KEY), 12)
    page_width, page_height = _legacy_page(canvas)
    padding = as_dict(canvas).get("padding")
    content = page_width - 2 * (padding if padding is not None else 0)
    step = (content + GRID_GUTTER_SIZE) / legacy_columns
    columns = _to_cells(page_width, 10)

    widths: dict[str, int] = {}
    for item in items:
        width = as_dict(item.get("meta")).get("width")
        if item.get("id") and is_number(width):
            pixels = width * step - GRID_GUTTER_SIZE
            widths[item["id"]] = min(columns, _to_cells(pixels, MIN_OBJECT_COLUMNS))
    _fit_rows(layout, widths, columns)
    _fit_columns(layout, widths)

    result: dict[str, Any] = dict(marked)
    for item in items:
        item_id = item.get("id")
        item_meta = item.get("meta")
        if not item_id or item_id == ROOT_ID:
            continue
        if not isinstance(item_meta, dict) or (
            item_id not in widths and "height" not in item_meta
        ):
            continue
        changed = dict(item_meta)
        if item_id in widths:
            changed["width"] = widths[item_id]
        if is_number(item_meta.get("height")):
            changed["height"] = _to_cells(
                item_meta["height"] * GRID_BASE_UNIT, MIN_OBJECT_ROWS
            )
        result[item_id] = {**item, "meta": changed}

    marked_root = result[ROOT_ID]
    root_meta_next = dict(as_dict(marked_root.get("meta")))
    root_meta_next.pop(LEGACY_COLUMN_COUNT_KEY, None)
    kept = {k: v for k, v in as_dict(canvas).items() if k not in ("padding", "gap")}
    # The same page, in whole cells
    root_meta_next[CANVAS_FORMAT_KEY] = {
        **kept,
        "size": {
            "mode": "custom",
            "width": columns * CELL,
            "height": _to_cells(page_height, 10) * CELL,
        },
    }
    result[ROOT_ID] = {**marked_root, "meta": root_meta_next}
    return result
