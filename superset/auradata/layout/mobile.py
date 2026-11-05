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
    column_count_of,
    MIN_CHART_COLUMNS,
    MIN_CHART_ROWS,
    MIN_OBJECT_COLUMNS,
    MIN_OBJECT_ROWS,
)
from superset.auradata.layout.keys import CHART_TYPE, MOBILE_LAYOUT_KEY, TABS_TYPE
from superset.auradata.layout.positions import is_positioned, pos_of

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
    return (
        MIN_CHART_COLUMNS
        if as_dict(item).get("type") == CHART_TYPE
        else (MIN_OBJECT_COLUMNS)
    )


def _min_height(item: Any) -> int:
    return (
        MIN_CHART_ROWS if as_dict(item).get("type") == CHART_TYPE else (MIN_OBJECT_ROWS)
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
        "height": max(_min_height(item), _whole(box.get("height"), _min_height(item))),
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
    raw = as_dict(
        as_dict(as_dict(layout.get(page_id)).get("meta")).get(MOBILE_LAYOUT_KEY)
    )
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


# Proposing a mobile layout. The editor has no automatic layout (the author
# places each object), so this lives only in Python, for the MCP; what it
# proposes is a layout ``mobile_layout_of`` reads back unchanged.

# Charts on a phone: never shorter than a readable plot, never taller than
# the editor makes a new box
MOBILE_CHART_MIN_ROWS = 8
# A card takes half the phone page when it is at most this share of the canvas
SMALL_CARD_SHARE = 1 / 3
MOBILE_CARD_MAX_ROWS = 6


def _reading_order(layout: dict[str, Any], ids: list[str]) -> list[str]:
    """Objects top to bottom, then left to right, as they sit on the canvas."""

    def key(entry: tuple[int, str]) -> tuple[int, int, int]:
        index, component_id = entry
        pos = pos_of(as_dict(layout.get(component_id)).get("meta"))
        if pos is None:
            return (1 << 30, index, index)
        return (pos["y"], pos["x"], index)

    return [cid for _, cid in sorted(enumerate(ids), key=key)]


def _scaled_rows(item: Any, width: int) -> int:
    """Rows an object keeps its canvas shape with at this phone width."""
    meta = as_dict(as_dict(item).get("meta"))
    canvas_width = number_or(meta.get("width"), MOBILE_COLUMNS)
    canvas_height = number_or(meta.get("height"), MOBILE_DEFAULT_MAX_ROWS)
    return js_round(canvas_height * width / canvas_width)


def _is_chart(layout: dict[str, Any], component_id: str) -> bool:
    return as_dict(layout.get(component_id)).get("type") == CHART_TYPE


def _phone_order(
    layout: dict[str, Any], ordered: list[str], first: set[str] | frozenset[str]
) -> list[str]:
    """
    The objects as they go down the phone: the texts above everything else,
    then ``first``, then the rest; an object that is neither a chart nor in
    ``first`` (a text, a shape) goes with the next object that is.
    """
    header: list[str] = []
    top: list[str] = []
    rest: list[str] = []
    pending: list[str] = []
    for component_id in ordered:
        if component_id not in first and not _is_chart(layout, component_id):
            pending.append(component_id)
            continue
        if not (header or top or rest):
            header, pending = pending, []
        target = top if component_id in first else rest
        target.extend([*pending, component_id])
        pending = []
    return header + top + rest + pending


def _phone_rows(
    layout: dict[str, Any], component_id: str, card: bool, width: int
) -> int:
    """Rows of an object on the phone at this width."""
    item = layout.get(component_id)
    rows = _scaled_rows(item, width)
    if card:
        return max(MIN_CHART_ROWS, min(MOBILE_CARD_MAX_ROWS, rows))
    if _is_chart(layout, component_id):
        return max(MOBILE_CHART_MIN_ROWS, min(MOBILE_DEFAULT_MAX_ROWS, rows))
    return mobile_size_of(item)["height"]


def propose_mobile_layout(
    layout: dict[str, Any],
    page_id: str,
    cards: set[str] | frozenset[str] = frozenset(),
    first: set[str] | frozenset[str] = frozenset(),
    leave_out: set[str] | frozenset[str] = frozenset(),
) -> list[MobileBox]:
    """
    A phone layout of the objects of a page, stacked down the page:

    - the objects in ``first`` (cards and slicers) go to the top, in reading
      order, and everything else follows in reading order;
    - a text box (or any object not in ``first`` and not a chart) keeps its
      place before what followed it on the canvas, and the texts above every
      other object (the page title) head the phone page;
    - charts take the full width, between ``MOBILE_CHART_MIN_ROWS`` and
      ``MOBILE_DEFAULT_MAX_ROWS`` rows; small ``cards`` (at most a third of the
      canvas wide) sit two per row; other objects keep their canvas shape at the
      full width.

    ``leave_out`` names objects that stay off the phone (hidden ones).
    """
    ids = [cid for cid in mobile_candidates(layout, page_id) if cid not in leave_out]
    sequence = _phone_order(layout, _reading_order(layout, ids), first)
    columns = column_count_of(layout)
    small = {
        cid
        for cid in cards
        if number_or(
            as_dict(as_dict(layout.get(cid)).get("meta")).get("width"), columns
        )
        <= columns * SMALL_CARD_SHARE
    }
    half = MOBILE_COLUMNS // 2
    boxes: list[MobileBox] = []
    y = 0
    index = 0
    while index < len(sequence):
        row = sequence[index : index + 2]
        if len(row) < 2 or not set(row) <= small:
            row = row[:1]
        width = half if len(row) == 2 else MOBILE_COLUMNS
        height = max(_phone_rows(layout, cid, cid in cards, width) for cid in row)
        for column, component_id in enumerate(row):
            box = {"id": component_id, "x": column * half, "y": y}
            boxes.append(
                fit_box(
                    {**box, "width": width, "height": height},
                    layout.get(component_id),
                )
            )
        y += max(box["height"] for box in boxes[-len(row) :])
        index += len(row)
    return boxes
