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
Page operations of a report, as the editor does them
(``src/auradata/report/pageActions.ts``): pages are the top level tabs, and a
report of one page gets its first tabs when a second page is added.
"""

from typing import Any

from superset.auradata.layout import keys, page_ids, page_title, top_tabs_id
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.report_layout.editing import (
    chart_ids_under,
    LayoutEditError,
    Report,
    resolve_page,
    subtree,
)

TAB_DEFAULTS = {"defaultText": "Tab title", "placeholder": "Tab title"}


def _default_name(index: int) -> str:
    return f"Página {index}"


def make_tabs(report: Report) -> str:
    """
    The id of the set of tabs holding the pages, made when the report has
    none: what the grid holds becomes the first page, with its mobile layout.
    """
    layout = report.layout
    if tabs_id := top_tabs_id(layout):
        return tabs_id
    root = layout[keys.ROOT_ID]
    top_id = (root.get("children") or [keys.GRID_ID])[0]
    top = layout.get(top_id)
    if not isinstance(top, dict):
        raise LayoutEditError("The report has no grid.", "InvalidDashboardLayout")
    tabs_id = generate_id(keys.TABS_TYPE)
    first_id = generate_id(keys.TAB_TYPE)
    top_meta = dict(top.get("meta") or {})
    first_meta: dict[str, Any] = {"text": _default_name(1), **TAB_DEFAULTS}
    if mobile := top_meta.pop(keys.MOBILE_LAYOUT_KEY, None):
        first_meta[keys.MOBILE_LAYOUT_KEY] = mobile
    layout[first_id] = {
        "type": keys.TAB_TYPE,
        "id": first_id,
        "children": list(top.get("children") or []),
        "parents": [],
        "meta": first_meta,
    }
    layout[tabs_id] = {
        "type": keys.TABS_TYPE,
        "id": tabs_id,
        "children": [first_id],
        "parents": [],
        "meta": {},
    }
    layout[top_id] = {**top, "children": [], "meta": top_meta}
    root["children"] = [tabs_id]
    return tabs_id


def add_page(report: Report, name: str | None, position: int | None) -> str:
    """Adds a page, at the end unless a place is given; returns its id."""
    tabs_id = make_tabs(report)
    tabs = report.layout[tabs_id]
    children = tabs.setdefault("children", [])
    page_id = generate_id(keys.TAB_TYPE)
    report.layout[page_id] = {
        "type": keys.TAB_TYPE,
        "id": page_id,
        "children": [],
        "parents": [],
        "meta": {"text": name or _default_name(len(children) + 1), **TAB_DEFAULTS},
    }
    index = len(children) if position is None else min(position - 1, len(children))
    children.insert(index, page_id)
    return page_id


def rename_page(report: Report, page: Any, name: str) -> str:
    # A report of one page gets its tab, which holds the name
    make_tabs(report)
    page_id = resolve_page(report, page)
    report.layout[page_id].setdefault("meta", {})["text"] = name
    return page_id


def reorder_pages(report: Report, order: list[Any]) -> list[str]:
    """Puts the pages in this order; it must name every page once."""
    tabs_id = top_tabs_id(report.layout)
    current = page_ids(report.layout)
    wanted = [resolve_page(report, page) for page in order]
    if (
        not tabs_id
        or sorted(wanted) != sorted(current)
        or len(set(wanted)) != len(wanted)
    ):
        raise LayoutEditError(
            "order must name every page once. Pages: "
            + ", ".join(f"{p} ({page_title(report.layout, p)!r})" for p in current)
        )
    report.layout[tabs_id]["children"] = wanted
    return wanted


def set_page_hidden(report: Report, page: Any, hidden: bool) -> str:
    page_id = resolve_page(report, page)
    if hidden and not top_tabs_id(report.layout):
        raise LayoutEditError("A report of one page cannot hide it.")
    meta = report.layout[page_id].setdefault("meta", {})
    if hidden:
        visible = [
            p
            for p in page_ids(report.layout)
            if p != page_id
            and not (report.layout[p].get("meta") or {}).get(keys.HIDDEN_PAGE_KEY)
            and not (report.layout[p].get("meta") or {}).get(keys.TOOLTIP_PAGE_KEY)
        ]
        if not visible:
            raise LayoutEditError("Viewers need at least one visible page.")
        meta[keys.HIDDEN_PAGE_KEY] = True
    else:
        meta.pop(keys.HIDDEN_PAGE_KEY, None)
    return page_id


def delete_page(report: Report, page: Any) -> tuple[str, list[int]]:
    """Removes a page and what it holds; returns its id and its chart ids."""
    page_id = resolve_page(report, page)
    tabs_id = top_tabs_id(report.layout)
    pages = page_ids(report.layout)
    if not tabs_id or len(pages) < 2:
        raise LayoutEditError("A report keeps at least one page.")
    chart_ids = chart_ids_under(report, page_id)
    for component_id in subtree(report, page_id):
        report.layout.pop(component_id, None)
    tabs = report.layout[tabs_id]
    tabs["children"] = [c for c in tabs.get("children") or [] if c != page_id]
    return page_id, chart_ids


def copy_page(
    report: Report, page_id: str, name: str | None, clones: dict[int, Any]
) -> str:
    """
    Copies a page right after itself, with new ids, the cloned charts and new
    group tags; its mobile layout follows the new ids.
    """
    layout = report.layout
    new_ids: dict[str, str] = {}
    groups: dict[str, str] = {}

    def copy(component_id: str) -> str:
        item = layout[component_id]
        meta = dict(item.get("meta") or {})
        meta.pop("uuid", None)
        if item.get("type") == keys.CHART_TYPE and meta.get("chartId") in clones:
            clone = clones[meta["chartId"]]
            meta["chartId"] = clone.id
            meta["sliceName"] = clone.slice_name
            meta.pop("sliceNameOverride", None)
        if group := meta.get(keys.GROUP_KEY):
            groups.setdefault(group, generate_id("g"))
            meta[keys.GROUP_KEY] = groups[group]
        new_id = generate_id(str(item.get("type") or "COMPONENT"))
        new_ids[component_id] = new_id
        children = [copy(child) for child in item.get("children") or []]
        layout[new_id] = {
            **item,
            "id": new_id,
            "children": children,
            "parents": [],
            "meta": meta,
        }
        return new_id

    copy_id = copy(page_id)
    meta = layout[copy_id]["meta"]
    meta["text"] = name or f"{page_title(layout, page_id)} (copia)"
    mobile = meta.get(keys.MOBILE_LAYOUT_KEY)
    if isinstance(mobile, dict) and isinstance(mobile.get("items"), list):
        meta[keys.MOBILE_LAYOUT_KEY] = {
            **mobile,
            "items": [
                {**box, "id": new_ids[box["id"]]}
                for box in mobile["items"]
                if isinstance(box, dict) and box.get("id") in new_ids
            ],
        }
    tabs = layout[top_tabs_id(layout) or ""]
    children = tabs["children"]
    children.insert(children.index(page_id) + 1, copy_id)
    return copy_id
