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
Pages of a report: the top level tabs, or the grid of a report of one page.
Mirrors ``topLevelTabs`` and ``isHiddenPage`` of
``src/auradata/present/dashboardTabs.ts`` and ``pageObjects`` of
``src/auradata/format/arrange.ts``.
"""

import math
from typing import Any

from superset.auradata.layout._js import as_dict, is_finite, to_number, truthy
from superset.auradata.layout.keys import (
    GRID_ID,
    HIDDEN_PAGE_KEY,
    ROOT_ID,
    TABS_TYPE,
    TOOLTIP_PAGE_KEY,
    Z_KEY,
)
from superset.auradata.layout.positions import is_positioned


def top_tabs_id(layout: dict[str, Any]) -> str | None:
    """The id of the set of tabs that makes the pages, or None without one."""
    children = as_dict(layout.get(ROOT_ID)).get("children") or []
    first = children[0] if children else None
    item = layout.get(first) if isinstance(first, str) else None
    return first if as_dict(item).get("type") == TABS_TYPE else None


def page_ids(layout: dict[str, Any]) -> list[str]:
    """The pages of a report, in order: its top level tabs, or the grid."""
    tabs_id = top_tabs_id(layout)
    if not tabs_id:
        return [GRID_ID] if GRID_ID in layout else []
    return [
        child
        for child in as_dict(layout[tabs_id]).get("children") or []
        if isinstance(layout.get(child), dict)
    ]


def is_hidden_page(meta: Any) -> bool:
    """Whether viewers miss a page in the tabs: hidden, or a tooltip page."""
    meta = as_dict(meta)
    return truthy(meta.get(HIDDEN_PAGE_KEY)) or truthy(meta.get(TOOLTIP_PAGE_KEY))


def page_title(layout: dict[str, Any], page_id: str) -> str:
    """The name of a page (the text of its tab)."""
    text = as_dict(as_dict(layout.get(page_id)).get("meta")).get("text")
    return "" if text is None else str(text)


def page_of(layout: dict[str, Any], component_id: str) -> str | None:
    """The page that holds an object, or None."""
    for page_id in page_ids(layout):
        if component_id in descendants(layout, page_id):
            return page_id
    return None


def descendants(layout: dict[str, Any], component_id: str) -> list[str]:
    """Every component under one, depth first."""
    found: list[str] = []

    def visit(current: str) -> None:
        for child_id in as_dict(layout.get(current)).get("children") or []:
            if isinstance(child_id, str) and child_id not in found:
                found.append(child_id)
                visit(child_id)

    visit(component_id)
    return found


def page_objects(layout: dict[str, Any], page_id: str | None) -> list[str]:
    """The objects of a page, in the order they are stacked (back to front)."""
    found: list[str] = []

    def visit(component_id: str) -> None:
        item = layout.get(component_id)
        if not isinstance(item, dict):
            return
        if is_positioned(item.get("type")):
            found.append(component_id)
            return
        for child_id in item.get("children") or []:
            visit(child_id)

    if page_id:
        visit(page_id)

    def order(entry: tuple[int, str]) -> tuple[float, int]:
        index, component_id = entry
        meta = as_dict(as_dict(layout[component_id]).get("meta"))
        # Number(undefined) is NaN, while Number(null) is 0
        z = to_number(meta[Z_KEY]) if Z_KEY in meta else math.nan
        return (z if is_finite(z) else index + 1, index)

    return [cid for _, cid in sorted(enumerate(found), key=order)]
