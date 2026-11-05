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

from superset.auradata.layout import (  # noqa: F401
    CELL,
    column_count_of,
    DEFAULT_OBJECT_COLUMNS,
    free_cell,
    is_in_cells,
    keys,
    root_meta,
    row_count_of,
)

GRID_DEFAULT_CHART_WIDTH = 4
GRID_COLUMN_COUNT = 12


def generate_id(prefix: str) -> str:
    """
    Generate a component ID matching the frontend's nanoid-style pattern.

    Uses a UUID hex prefix to produce IDs like ``ROW-a1b2c3d4`` which are
    compatible with the frontend's ``nanoid()``-based ID generation.
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# AuraData BI pages are grids of square cells (see ``superset/auradata/layout``,
# which mirrors the frontend). These names stay here for the dashboard tools.
CELLS_KEY = keys.CELLS_KEY
CANVAS_FORMAT_KEY = keys.CANVAS_FORMAT_KEY
POS_KEY = keys.POS_KEY
LEGACY_COLUMN_COUNT_KEY = keys.LEGACY_COLUMN_COUNT_KEY
POSITIONED_TYPES = keys.POSITIONED_TYPES
DEFAULT_OBJECT_CELLS = DEFAULT_OBJECT_COLUMNS


def canvas_cells(layout: dict[str, Any]) -> tuple[int, int]:
    """The page size of a layout, in cells (width, height)."""
    return column_count_of(layout), row_count_of(layout)


def layout_column_count(layout: dict[str, Any]) -> int:
    """
    The columns a new chart is sized in. A layout in cells has as many columns
    as its page is wide in cells; one from before the cell grid uses 12, or the
    24 or 48 it kept on the root as ``auradataColumns``.
    """
    if is_in_cells(layout):
        return column_count_of(layout)
    count = root_meta(layout).get(LEGACY_COLUMN_COUNT_KEY)
    return count if count in (12, 24, 48) else GRID_COLUMN_COUNT


def scaled_width(width: int, column_count: int) -> int:
    """A width in 12-column units, with the same share of ``column_count``."""
    return max(1, round(width * column_count / GRID_COLUMN_COUNT))
