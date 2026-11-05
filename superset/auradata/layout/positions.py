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
Free placement on the cell grid. Every chart, element and text box sits at an
absolute cell of its page (``meta.auradataPos``, from the top-left corner), so moving
or resizing one never moves another; rows stay as containers. Mirrors
``src/auradata/format/positions.ts``.
"""

from typing import Any, TypedDict

from superset.auradata.layout._js import (
    as_dict,
    is_finite,
    js_round,
    number_or,
    truthy,
)
from superset.auradata.layout.grid import (
    canvas_format,
    canvas_size,
    CELL,
    column_count_of,
    row_count_of,
)
from superset.auradata.layout.keys import (
    CANVAS_FORMAT_KEY,
    HEADER_TYPE,
    LEGACY_OFFSET_KEY,
    POS_KEY,
    POSITIONED_TYPES,
    ROOT_ID,
    ROW_TYPE,
    TABS_TYPE,
)


class Pos(TypedDict):
    """A cell of the page, from its top-left corner."""

    x: int
    y: int


# Height of the components that have none of their own, in cells
HEADER_ROWS = {"SMALL_HEADER": 1, "MEDIUM_HEADER": 2, "LARGE_HEADER": 3}


def _whole(value: Any) -> int:
    return max(0, js_round(value)) if is_finite(value) else 0


def is_positioned(component_type: Any) -> bool:
    """Whether objects of this type are placed on the page by position."""
    return component_type in POSITIONED_TYPES


def pos_of(meta: Any) -> Pos | None:
    """The cell an object sits on, or None while it follows the row."""
    raw = as_dict(meta).get(POS_KEY)
    if not truthy(raw):
        return None
    raw = as_dict(raw)
    return {"x": _whole(raw.get("x")), "y": _whole(raw.get("y"))}


def size_of(meta: Any) -> tuple[Any, Any]:
    """Width and height of an object in cells, 1 when it has none."""
    meta = as_dict(meta)
    return number_or(meta.get("width"), 1), number_or(meta.get("height"), 1)


def clamp_to_page(layout: dict[str, Any], meta: Any, cell: Pos) -> Pos:
    """The cell nearest to ``cell`` where an object of this width fits the page."""
    columns = column_count_of(layout)
    width = number_or(as_dict(meta).get("width"), 1)
    return {"x": max(0, min(cell["x"], columns - width)), "y": max(0, cell["y"])}


def place_at(
    layout: dict[str, Any], component_id: str | None, cell: Pos | None
) -> dict[str, Any]:
    """The layout with an object placed on a cell of the page."""
    item = layout.get(component_id) if component_id else None
    if not component_id or not isinstance(item, dict) or not cell:
        return layout
    if not is_positioned(item.get("type")):
        return layout
    target = clamp_to_page(layout, item.get("meta"), cell)
    current = pos_of(item.get("meta"))
    if current == target:
        return layout
    return {
        **layout,
        component_id: {**item, "meta": {**as_dict(item.get("meta")), POS_KEY: target}},
    }


def taken_boxes(
    layout: dict[str, Any], page_id: str
) -> list[tuple[int, int, Any, Any]]:
    """The cells (x, y, width, height) the placed objects of a page cover."""
    taken: list[tuple[int, int, Any, Any]] = []

    def collect(component_id: str) -> None:
        item = layout.get(component_id)
        if not isinstance(item, dict):
            return
        pos = pos_of(item.get("meta")) if is_positioned(item.get("type")) else None
        if pos:
            width, height = size_of(item.get("meta"))
            taken.append((pos["x"], pos["y"], width, height))
        # A set of tabs inside the page holds other pages
        if item.get("type") != TABS_TYPE or component_id == page_id:
            for child_id in item.get("children") or []:
                collect(child_id)

    collect(page_id)
    return taken


def free_cell(layout: dict[str, Any], page_id: str, width: int, height: int) -> Pos:
    """
    The first cell of a page, from the top left, where an object of this size
    covers no other object of that page. Below the lowest object (kept on the
    page) when there is no room.
    """
    taken = taken_boxes(layout, page_id)
    columns = column_count_of(layout)
    rows = row_count_of(layout)

    def fits(x: int, y: int) -> bool:
        return all(
            x + width <= bx or bx + bw <= x or y + height <= by or by + bh <= y
            for bx, by, bw, bh in taken
        )

    y = 0
    while y + height <= rows:
        x = 0
        while x + width <= columns:
            if fits(x, y):
                return {"x": x, "y": y}
            x += 1
        y += 1
    bottom = max([0, *(by + bh for _bx, by, _bw, bh in taken)])
    return {"x": 0, "y": max(0, min(bottom, rows - height))}


def layout_to_positions(layout: dict[str, Any]) -> dict[str, Any]:  # noqa: C901
    """
    Gives every object without a position the cell it has in the flow of the
    layout: rows side by side, stacked from the top of each page. Objects that
    have one are left alone; the same layout when nothing is missing. The page
    grows to hold what lands below its bottom.
    """
    if not isinstance(layout, dict) or not layout.get(ROOT_ID):
        return layout
    if not any(
        isinstance(item, dict)
        and is_positioned(item.get("type"))
        and not pos_of(item.get("meta"))
        for item in layout.values()
    ):
        return layout

    result: dict[str, Any] = dict(layout)

    def visit(component_id: str, x: int, y: int) -> Any:  # noqa: C901
        item = layout.get(component_id)
        if not truthy(item) or not isinstance(item, dict):
            return 0
        meta = as_dict(item.get("meta"))
        old = as_dict(meta.get(LEGACY_OFFSET_KEY))
        left = x + _whole(old.get("x"))
        top = y + _whole(old.get("y"))
        height = number_or(meta.get("height"), 0)

        if is_positioned(item.get("type")):
            if not pos_of(meta):
                rest = {k: v for k, v in meta.items() if k != LEGACY_OFFSET_KEY}
                result[component_id] = {
                    **item,
                    "meta": {**rest, POS_KEY: {"x": left, "y": top}},
                }
            return _whole(old.get("y")) + height
        if item.get("type") == HEADER_TYPE:
            return HEADER_ROWS.get(_js_string(meta.get("headerSize")), 2)
        if item.get("type") == ROW_TYPE:
            cursor = x
            tallest: Any = 0
            for child_id in item.get("children") or []:
                child_meta = as_dict(as_dict(layout.get(child_id)).get("meta"))
                child_old = as_dict(child_meta.get(LEGACY_OFFSET_KEY))
                tallest = max(tallest, visit(child_id, cursor, y))
                cursor += _whole(child_old.get("x")) + number_or(
                    child_meta.get("width"), 0
                )
            return tallest
        # Columns and the page itself stack what they hold; each page of a set
        # of tabs starts again from the top
        same_start = item.get("type") == TABS_TYPE
        cursor = y
        used: Any = 0
        for child_id in item.get("children") or []:
            taken = visit(child_id, x, 0 if same_start else cursor)
            if same_start:
                used = max(used, taken)
            else:
                cursor += taken
                used += taken
        return used

    visit(ROOT_ID, 0, 0)

    bottom: Any = 0
    for entry in result.values():
        if not isinstance(entry, dict) or not is_positioned(entry.get("type")):
            continue
        pos = pos_of(entry.get("meta"))
        if pos:
            height = number_or(as_dict(entry.get("meta")).get("height"), 0)
            bottom = max(bottom, pos["y"] + height)

    root = result[ROOT_ID]
    canvas = canvas_format(result)
    width, page_height = canvas_size(canvas)
    if bottom * CELL > page_height:
        result[ROOT_ID] = {
            **root,
            "meta": {
                **as_dict(root.get("meta")),
                CANVAS_FORMAT_KEY: {
                    **as_dict(canvas),
                    "size": {"mode": "custom", "width": width, "height": bottom * CELL},
                },
            },
        }
    return result


def _js_string(value: Any) -> str:
    """``String(value)`` for the values a header size can hold."""
    if value is None:
        return "undefined"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value)

