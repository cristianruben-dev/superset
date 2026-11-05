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
The report model of AuraData BI in Python: the same layout keys, cell grid,
positions, pages and mobile layout the frontend uses (``src/auradata/format``,
``elements``, ``report``), so the MCP writes layouts the editor opens unchanged.
Shared fixtures under ``tests/fixtures/auradata/layouts`` run through Jest and
pytest and must give the same results.
"""

from superset.auradata.layout.arrange import (
    align_cells,
    box_of,
    distribute_cells,
    is_locked,
    layer_order,
)
from superset.auradata.layout.cells import is_in_cells, layout_to_cells
from superset.auradata.layout.formats import (
    format_of,
    merge_visual_format,
    own_chart_format,
    own_format,
    pasted_meta,
    sharable_chart_format,
    sharable_format,
    shared_visual_format,
    visual_format_of,
    with_own_format,
)
from superset.auradata.layout.grid import (
    canvas_format,
    CANVAS_PRESETS,
    canvas_size,
    CELL,
    column_count_of,
    DEFAULT_OBJECT_COLUMNS,
    DEFAULT_OBJECT_ROWS,
    MAX_CANVAS_CELLS,
    MIN_CHART_COLUMNS,
    MIN_CHART_ROWS,
    MIN_OBJECT_COLUMNS,
    MIN_OBJECT_ROWS,
    root_meta,
    row_count_of,
)
from superset.auradata.layout.mobile import (
    mobile_candidates,
    MOBILE_COLUMNS,
    mobile_layout_of,
    mobile_page_rows,
    mobile_size_of,
    propose_mobile_layout,
)
from superset.auradata.layout.pages import (
    descendants,
    is_hidden_page,
    page_ids,
    page_objects,
    page_of,
    page_title,
    top_tabs_id,
)
from superset.auradata.layout.positions import (
    clamp_to_page,
    free_cell,
    is_positioned,
    layout_to_positions,
    place_at,
    Pos,
    pos_of,
    size_of,
)

__all__ = [
    "align_cells",
    "box_of",
    "CANVAS_PRESETS",
    "canvas_format",
    "canvas_size",
    "CELL",
    "clamp_to_page",
    "column_count_of",
    "DEFAULT_OBJECT_COLUMNS",
    "DEFAULT_OBJECT_ROWS",
    "descendants",
    "distribute_cells",
    "format_of",
    "free_cell",
    "is_hidden_page",
    "is_in_cells",
    "is_locked",
    "is_positioned",
    "layer_order",
    "layout_to_cells",
    "layout_to_positions",
    "MAX_CANVAS_CELLS",
    "merge_visual_format",
    "MIN_CHART_COLUMNS",
    "MIN_CHART_ROWS",
    "MIN_OBJECT_COLUMNS",
    "MIN_OBJECT_ROWS",
    "MOBILE_COLUMNS",
    "mobile_candidates",
    "mobile_layout_of",
    "mobile_page_rows",
    "mobile_size_of",
    "propose_mobile_layout",
    "own_chart_format",
    "own_format",
    "page_ids",
    "page_objects",
    "page_of",
    "page_title",
    "pasted_meta",
    "place_at",
    "Pos",
    "pos_of",
    "root_meta",
    "row_count_of",
    "sharable_chart_format",
    "sharable_format",
    "shared_visual_format",
    "size_of",
    "with_own_format",
    "top_tabs_id",
    "visual_format_of",
]
