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
Every name the report model stores in a dashboard layout (``position_json``),
in one place. The frontend declares the same names next to the code that uses
them (``src/auradata/format``, ``elements``, ``report``, ``present``);
``tests/fixtures/auradata/layouts/meta_keys.json`` lists them and a Jest test and a
pytest test keep both sides on that list.
"""

# Component ids and types of the Superset layout
ROOT_ID = "ROOT_ID"
GRID_ID = "GRID_ID"
HEADER_ID = "HEADER_ID"
VERSION_KEY = "DASHBOARD_VERSION_KEY"

ROOT_TYPE = "ROOT"
GRID_TYPE = "GRID"
TABS_TYPE = "TABS"
TAB_TYPE = "TAB"
ROW_TYPE = "ROW"
COLUMN_TYPE = "COLUMN"
CHART_TYPE = "CHART"
MARKDOWN_TYPE = "MARKDOWN"
DYNAMIC_TYPE = "DYNAMIC"
HEADER_TYPE = "HEADER"
DIVIDER_TYPE = "DIVIDER"

# Objects placed on the page by position: charts, design elements, text boxes
POSITIONED_TYPES = frozenset({CHART_TYPE, DYNAMIC_TYPE, MARKDOWN_TYPE})

# Root of the layout
CANVAS_FORMAT_KEY = "auradataCanvas"
CELLS_KEY = "auradataCells"
LEGACY_COLUMN_COUNT_KEY = "auradataColumns"
BOOKMARKS_KEY = "auradataBookmarks"
FIELD_STEP_KEY = "auradataFieldStep"

# Pages (top level tabs, or the grid of a report of one page)
MOBILE_LAYOUT_KEY = "auradataMobile"
HIDDEN_PAGE_KEY = "auradataHiddenPage"
TOOLTIP_PAGE_KEY = "auradataTooltipPage"
DRILLTHROUGH_PAGE_KEY = "auradataDrillthrough"
PAGE_BACKGROUND_KEY = "auradataPageBackground"

# Objects of a page
VISUAL_FORMAT_KEY = "auradataFormat"
POS_KEY = "auradataPos"
LEGACY_OFFSET_KEY = "auradataOffset"
Z_KEY = "auradataZ"
GROUP_KEY = "auradataGroup"
HIDDEN_KEY = "auradataHidden"
LOCKED_KEY = "auradataLocked"
ALT_TEXT_KEY = "auradataAltText"
ELEMENT_KEY = "auradataElement"

# Every meta key above, as the contract test compares it with the frontend
LAYOUT_META_KEYS = frozenset(
    {
        CANVAS_FORMAT_KEY,
        CELLS_KEY,
        LEGACY_COLUMN_COUNT_KEY,
        BOOKMARKS_KEY,
        FIELD_STEP_KEY,
        MOBILE_LAYOUT_KEY,
        HIDDEN_PAGE_KEY,
        TOOLTIP_PAGE_KEY,
        DRILLTHROUGH_PAGE_KEY,
        PAGE_BACKGROUND_KEY,
        VISUAL_FORMAT_KEY,
        POS_KEY,
        LEGACY_OFFSET_KEY,
        Z_KEY,
        GROUP_KEY,
        HIDDEN_KEY,
        LOCKED_KEY,
        ALT_TEXT_KEY,
        ELEMENT_KEY,
    }
)

# Design elements are DYNAMIC components whose componentKey is this prefix
# plus their kind
ELEMENT_PREFIX = "auradata-"
ELEMENT_KINDS = ("image", "shape", "button", "text", "filter", "navigator")

# Keys of meta.auradataFormat.chart the report passes to ECharts
TOOLTIP_FORMAT_KEY = "auradata_tooltip"
SAMPLING_FORMAT_KEY = "auradata_sampling"


def element_kind(component_key: object) -> str | None:
    """The kind of a design element from its componentKey, or None."""
    if not isinstance(component_key, str) or not component_key.startswith(
        ELEMENT_PREFIX
    ):
        return None
    kind = component_key[len(ELEMENT_PREFIX) :]
    return kind if kind in ELEMENT_KINDS else None
