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
Design elements of a report for the MCP tools: placing a new one as the
editor's draggers do (a DYNAMIC component in a row of its own, at a free cell
or a given one) and changing its settings and box, checked against the
descriptors of the format catalog.
"""

from __future__ import annotations

from typing import Any

from superset.auradata.layout import free_cell, keys, page_ids
from superset.auradata.layout.elements import check_element_patch
from superset.auradata.layout.format_patch import (
    check_general_patch,
    merge_patch,
    ReportRefs,
)
from superset.auradata.layout.interactivity import tooltip_pages
from superset.mcp_service.report_layout.editing import (
    append_in_new_row,
    LayoutEditError,
    meta_of,
    refuse_overlaps,
    Report,
    resolve_object,
    resolve_page,
    set_box,
)


def report_refs(report: Report) -> ReportRefs:
    """Pages and bookmarks a setting of the report may point at."""
    root_meta = (report.layout.get(keys.ROOT_ID) or {}).get("meta") or {}
    bookmarks = root_meta.get(keys.BOOKMARKS_KEY) or []
    return ReportRefs(
        pages={p for p in page_ids(report.layout) if p != keys.GRID_ID},
        bookmarks={b.get("id") for b in bookmarks if isinstance(b, dict)},
        tooltip_pages=set(tooltip_pages(report.layout)),
    )


def element_of(report: Report, ref: str | int) -> tuple[str, str]:
    """A design element of the report and its kind."""
    component_id = resolve_object(report, ref)
    kind = keys.element_kind(meta_of(report, component_id).get("componentKey"))
    if kind is None:
        raise LayoutEditError(
            f"{component_id} is not a design element (image, shape, button, "
            "text, slicer or navigator)."
        )
    return component_id, kind


def resolve_actions(report: Report, settings: dict[str, Any]) -> dict[str, Any]:
    """An action that goes to a page names it by id, name or position; the
    layout stores its tab id (``tabId``)."""
    action = settings.get("action")
    if not isinstance(action, dict):
        return settings
    action = dict(action)
    page = action.pop("page", None)
    if page is None and action.get("type") == "page":
        page = action.get("tabId")
    if page is not None:
        page_id = resolve_page(report, page)
        if page_id == keys.GRID_ID:
            raise LayoutEditError(
                "The report has one page, so a button has no page to go to; "
                "add a page with add_page first."
            )
        action["tabId"] = page_id
    return {**settings, "action": action}


def patched_settings(
    report: Report, kind: str, current: dict[str, Any], patch: dict[str, Any]
) -> dict[str, Any]:
    """The settings of an element of a kind with a checked patch over them."""
    clean = check_element_patch(
        kind, resolve_actions(report, patch), report_refs(report)
    )
    return {**merge_patch(current, clean), "kind": kind}


def patched_box(
    report: Report, current: dict[str, Any] | None, patch: dict[str, Any]
) -> Any:
    """The General format of an element with a checked patch over it; the
    chart settings of the General level (tooltip, sampling) are refused."""
    general, chart = check_general_patch(patch, report_refs(report))
    if chart:
        raise LayoutEditError(
            "auradata_tooltip and auradata_sampling are chart settings; "
            "elements have none."
        )
    return merge_patch(current, general)


def place_new(
    report: Report,
    page_id: str,
    meta: dict[str, Any],
    request: Any,
    component_type: str = keys.DYNAMIC_TYPE,
) -> str:
    """Puts a new component on a page, in a row of its own as the editor
    does, at the cell of the request or the first free one for its size."""
    from superset.mcp_service.dashboard.constants import generate_id

    component_id = generate_id(component_type)
    if request.width is not None:
        meta["width"] = request.width
    if request.height is not None:
        meta["height"] = request.height
    report.layout[component_id] = {
        "type": component_type,
        "id": component_id,
        "children": [],
        "parents": [],
        "meta": meta,
    }
    append_in_new_row(report, page_id, component_id)
    set_box(report, component_id, None, request.width, request.height)
    meta.pop(keys.POS_KEY, None)
    cell = free_cell(report.layout, page_id, meta["width"], meta["height"])
    if request.x is not None:
        cell = {**cell, "x": request.x}
    if request.y is not None:
        cell = {**cell, "y": request.y}
    set_box(report, component_id, cell)
    refuse_overlaps(report, page_id, [component_id], request.allow_overlap)
    return component_id
