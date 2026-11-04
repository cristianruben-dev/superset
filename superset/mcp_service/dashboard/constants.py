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
Shared constants for MCP dashboard tools.

Values match frontend defaults from
``superset-frontend/src/dashboard/util/constants.ts``.
"""

import uuid
from typing import Any

GRID_DEFAULT_CHART_WIDTH = 4
GRID_COLUMN_COUNT = 12


def generate_id(prefix: str) -> str:
    """
    Generate a component ID matching the frontend's nanoid-style pattern.

    Uses a UUID hex prefix to produce IDs like ``ROW-a1b2c3d4`` which are
    compatible with the frontend's ``nanoid()``-based ID generation.
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# AuraData BI pages are grids of square cells of CELL pixels (see
# ``superset-frontend/src/mibi/format/columns.ts`` and ``positions.ts``). A layout
# in cells is marked on its root, sizes every object in cells and places charts,
# elements and text boxes at an absolute cell of their page.
CELL = 32
CELLS_KEY = "mibiCells"
CANVAS_FORMAT_KEY = "mibiCanvas"
POS_KEY = "mibiPos"
LEGACY_COLUMN_COUNT_KEY = "mibiColumns"
# Page presets in cells (width, height); 16:9 is the default
CANVAS_PRESETS: dict[str, tuple[int, int]] = {
    "16:9": (60, 34),
    "4:3": (45, 34),
    "letter": (26, 34),
}
DEFAULT_CANVAS_SIZE = "16:9"
MIN_CANVAS_CELLS = 10
MAX_CANVAS_CELLS = 128
# Default size of a new chart in a layout in cells
DEFAULT_OBJECT_CELLS = 12
POSITIONED_TYPES = frozenset({"CHART", "DYNAMIC", "MARKDOWN"})


def _root_meta(layout: dict[str, Any]) -> dict[str, Any]:
    root = layout.get("ROOT_ID")
    meta = root.get("meta") if isinstance(root, dict) else None
    return meta if isinstance(meta, dict) else {}


def is_in_cells(layout: dict[str, Any]) -> bool:
    """Whether a layout already has its sizes in cells."""
    return bool(_root_meta(layout).get(CELLS_KEY))


def canvas_cells(layout: dict[str, Any]) -> tuple[int, int]:
    """The page size of a layout, in cells (width, height)."""
    canvas = _root_meta(layout).get(CANVAS_FORMAT_KEY)
    raw_size = canvas.get("size") if isinstance(canvas, dict) else None
    size: dict[str, Any] = raw_size if isinstance(raw_size, dict) else {}
    mode = size.get("mode")
    if mode == "custom":
        default_width, default_height = CANVAS_PRESETS[DEFAULT_CANVAS_SIZE]

        def cells(pixels: Any, default: int) -> int:
            value = pixels if isinstance(pixels, (int, float)) and pixels else 0
            count = round(value / CELL) if value else default
            return max(MIN_CANVAS_CELLS, min(MAX_CANVAS_CELLS, count))

        return (
            cells(size.get("width"), default_width),
            cells(size.get("height"), default_height),
        )
    return CANVAS_PRESETS.get(mode or "", CANVAS_PRESETS[DEFAULT_CANVAS_SIZE])


def layout_column_count(layout: dict[str, Any]) -> int:
    """
    The columns of a dashboard layout. A layout in cells has as many columns as
    its page is wide in cells; one from before the cell grid uses 12, or the 24
    or 48 it kept on the root as ``mibiColumns``.
    """
    if is_in_cells(layout):
        return canvas_cells(layout)[0]
    count = _root_meta(layout).get(LEGACY_COLUMN_COUNT_KEY)
    return count if count in (12, 24, 48) else GRID_COLUMN_COUNT


def _whole(value: Any) -> int:
    return max(0, round(value)) if isinstance(value, (int, float)) else 0


def _taken_boxes(
    layout: dict[str, Any], page_id: str
) -> list[tuple[int, int, int, int]]:
    """The cells (x, y, width, height) the placed objects of a page cover."""
    taken: list[tuple[int, int, int, int]] = []

    def collect(component_id: str) -> None:
        item = layout.get(component_id)
        if not isinstance(item, dict):
            return
        meta = item.get("meta") if isinstance(item.get("meta"), dict) else {}
        pos = meta.get(POS_KEY)
        if item.get("type") in POSITIONED_TYPES and isinstance(pos, dict):
            taken.append(
                (
                    _whole(pos.get("x")),
                    _whole(pos.get("y")),
                    int(meta.get("width") or 1),
                    int(meta.get("height") or 1),
                )
            )
        # A set of tabs inside the page holds other pages
        if item.get("type") != "TABS" or component_id == page_id:
            for child_id in item.get("children") or []:
                collect(child_id)

    collect(page_id)
    return taken


def free_cell(
    layout: dict[str, Any], page_id: str, width: int, height: int
) -> dict[str, int]:
    """
    The first cell of a page, from the top left, where an object of this size
    covers no other object of that page. Below the lowest object (kept on the
    page) when there is no room. Mirrors ``freeCell`` of the frontend.
    """
    taken = _taken_boxes(layout, page_id)
    columns = layout_column_count(layout)
    rows = canvas_cells(layout)[1]

    def fits(x: int, y: int) -> bool:
        return all(
            x + width <= bx or bx + bw <= x or y + height <= by or by + bh <= y
            for bx, by, bw, bh in taken
        )

    for y in range(0, rows - height + 1):
        for x in range(0, columns - width + 1):
            if fits(x, y):
                return {"x": x, "y": y}
    bottom = max([0, *(by + bh for _bx, by, _bw, bh in taken)])
    return {"x": 0, "y": max(0, min(bottom, rows - height))}


def scaled_width(width: int, column_count: int) -> int:
    """A width in 12-column units, with the same share of ``column_count``."""
    return max(1, round(width * column_count / GRID_COLUMN_COUNT))
