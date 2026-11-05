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
The page grid: square cells of ``CELL`` pixels. A page has a fixed size in whole
cells, so the columns of a layout are its width in cells, and every width,
height and position of an object is in cells. Mirrors ``canvasSize`` of
``src/auradata/format/styles.ts`` and ``columns.ts``.
"""

import math
from typing import Any

from superset.auradata.layout._js import as_dict, js_round, to_number, truthy
from superset.auradata.layout.keys import CANVAS_FORMAT_KEY, ROOT_ID

CELL = 32
MIN_CANVAS = 10 * CELL
MAX_CANVAS = 128 * CELL
MIN_CANVAS_CELLS = MIN_CANVAS // CELL
MAX_CANVAS_CELLS = MAX_CANVAS // CELL

# Page sizes in pixels, in whole cells: Full HD (1920 x 1088) and the same
# height for the other shapes
CANVAS_PRESETS: dict[str, tuple[int, int]] = {
    "16:9": (60 * CELL, 34 * CELL),
    "4:3": (45 * CELL, 34 * CELL),
    "letter": (26 * CELL, 34 * CELL),
}
DEFAULT_CANVAS_SIZE = "16:9"

# Least and default sizes of objects, in cells
MIN_OBJECT_COLUMNS = 2
MIN_OBJECT_ROWS = 2
MIN_CHART_COLUMNS = 4
MIN_CHART_ROWS = 3
DEFAULT_OBJECT_COLUMNS = 12
DEFAULT_OBJECT_ROWS = 12


def root_meta(layout: Any) -> dict[str, Any]:
    """The meta of the layout root, empty when it has none."""
    root = layout.get(ROOT_ID) if isinstance(layout, dict) else None
    return as_dict(as_dict(root).get("meta"))


def canvas_format(layout: Any) -> dict[str, Any] | None:
    """The canvas format of a layout (``ROOT_ID.meta.auradataCanvas``)."""
    canvas = root_meta(layout).get(CANVAS_FORMAT_KEY)
    return canvas if isinstance(canvas, dict) else None


def canvas_size(canvas: Any) -> tuple[int, int]:
    """The page size of a canvas format in pixels (width, height)."""
    size = as_dict(as_dict(canvas).get("size"))
    if size.get("mode") == "custom":
        default_width, default_height = CANVAS_PRESETS["16:9"]

        def cells(value: Any, default: int) -> int:
            pixels = to_number(value) if truthy(value) else default
            if math.isnan(pixels):
                pixels = default
            whole = js_round(pixels / CELL) * CELL
            return min(MAX_CANVAS, max(MIN_CANVAS, whole))

        return (
            cells(size.get("width"), default_width),
            cells(size.get("height"), default_height),
        )
    mode = size.get("mode")
    preset = mode if isinstance(mode, str) and mode in CANVAS_PRESETS else None
    return CANVAS_PRESETS[preset or DEFAULT_CANVAS_SIZE]


def column_count_of(layout: Any) -> int:
    """The columns of a layout: the width of its page, in cells."""
    return js_round(canvas_size(canvas_format(layout))[0] / CELL)


def row_count_of(layout: Any) -> int:
    """The rows of a layout: the height of its page, in whole cells."""
    return math.floor(canvas_size(canvas_format(layout))[1] / CELL)
