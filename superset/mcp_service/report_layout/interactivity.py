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
Report interactivity for the MCP tools, as the editor sets it up:

- filter bar levels of native filters (``scopeLevel`` and the scope);
- bookmarks on the layout root (``bookmarks.ts``);
- pages that accept a drill through (``drillthrough.ts``);
- "Edit interactions": cross-filter scopes in ``chart_configuration``
  (``interactions.ts``);
- "Sync slicers": the filter scope plus copies of the canvas slicer
  (``SyncSlicers.tsx``);
- tooltip pages and the tooltip of a chart (``PageSection.tsx``,
  ``GeneralSections.tsx``).

Settings of the layout save with ``save_report``; those of the dashboard
metadata (``chart_configuration``, ``filter_bar_auto_apply``) go in the same
update, with the whole current metadata, as the frontend sends it.
"""

from __future__ import annotations

import copy
from typing import Any

from superset.auradata.layout import (
    free_cell,
    keys,
    page_ids,
    page_of,
    page_title,
    pos_of,
    size_of,
)
from superset.auradata.layout.interactivity import (
    bookmarks_of,
    cross_filter_scope,
    tooltip_page_of,
    top_level_pages,
)
from superset.mcp_service.report_layout.editing import (
    append_in_new_row,
    box,
    LayoutEditError,
    meta_of,
    overlaps,
    refuse_locked,
    Report,
    resolve_object,
    resolve_page,
    set_box,
)
from superset.utils import json

# Metadata


def dashboard_metadata(dashboard: Any) -> dict[str, Any]:
    """The ``json_metadata`` of a dashboard as a dict."""
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
    except (TypeError, ValueError):
        return {}
    return metadata if isinstance(metadata, dict) else {}


def metadata_fields(report: Report, changes: dict[str, Any]) -> dict[str, Any]:
    """
    The ``json_metadata`` field of a dashboard update with these changes. The
    whole current metadata goes with them, as the frontend sends it: the
    update resets derived color settings that are missing from the payload.
    """
    metadata = dashboard_metadata(report.dashboard)
    metadata.update(changes)
    return {"json_metadata": json.dumps(metadata)}


def auto_apply_of(metadata: dict[str, Any]) -> bool:
    """Whether filters apply right away: unless a dashboard opts out."""
    return metadata.get("filter_bar_auto_apply") is not False


# Pages


def report_page(report: Report, page: Any, purpose: str) -> str:
    """A top level page of a report of several pages."""
    if not top_level_pages(report.layout):
        raise LayoutEditError(
            f"The report has one page, so it cannot {purpose}; add a page with "
            "add_page first."
        )
    return resolve_page(report, page)


def resolve_pages(report: Report, pages: list[Any]) -> list[str]:
    """Pages by id, name or position, in report order, without repeats."""
    chosen = {resolve_page(report, page) for page in pages}
    return [page for page in page_ids(report.layout) if page in chosen]


def page_name(report: Report, page_id: str | None) -> str | None:
    if page_id is None:
        return None
    return page_title(report.layout, page_id) or page_id


# Filter levels


def scoped(
    conf: dict[str, Any],
    level: str | None,
    pages: list[str] | None,
    all_pages: list[str],
) -> dict[str, Any]:
    """
    A native filter with a filter bar level and the scope it needs. Pages
    root the scope at them (every page is the whole report), as Sync slicers
    does; without an explicit level they make it a page or report filter.
    ``auto`` drops the level, so the bar derives it from the scope.
    """
    conf = dict(conf)
    scope = dict(conf.get("scope") or {"rootPath": [keys.ROOT_ID], "excluded": []})
    scope.setdefault("excluded", [])
    if pages is not None:
        if not pages:
            raise LayoutEditError("Give at least one page.")
        every = set(all_pages) <= set(pages)
        on_tabs = level == "page" and keys.GRID_ID not in pages
        scope["rootPath"] = [keys.ROOT_ID] if every and not on_tabs else list(pages)
        if level is None:
            level = "report" if every else "page"
        elif level == "report" and not every:
            raise LayoutEditError(
                "A report filter covers every page; leave out the pages or "
                "use the page level."
            )
    on_pages = keys.ROOT_ID not in (scope.get("rootPath") or [keys.ROOT_ID])
    if level == "report" and on_pages:
        scope["rootPath"] = [keys.ROOT_ID]
    if (
        level == "page"
        and not on_pages
        and len([page for page in all_pages if page != keys.GRID_ID]) > 1
    ):
        raise LayoutEditError(
            "A page filter needs the pages it filters: give scope_pages."
        )
    if level == "visual" and not scope["excluded"]:
        raise LayoutEditError(
            "A visual filter reaches only some charts: give scope_chart_ids."
        )
    conf["scope"] = scope
    if level == "auto":
        conf.pop("scopeLevel", None)
    elif level is not None:
        conf["scopeLevel"] = level
    return conf


# Columns of the report


def report_columns(dashboard: Any) -> set[str]:
    """The columns of the datasets of the report's charts."""
    columns: set[str] = set()
    for chart in dashboard.slices:
        datasource = getattr(chart, "datasource", None)
        for column in getattr(datasource, "columns", None) or []:
            if name := getattr(column, "column_name", None):
                columns.add(name)
    return columns


def check_columns(dashboard: Any, columns: list[str]) -> list[str]:
    """Columns of the report's datasets, without repeats."""
    known = report_columns(dashboard)
    if unknown := [column for column in columns if column not in known]:
        raise LayoutEditError(
            f"Columns not in the datasets of the report's charts: {unknown}. "
            f"Columns: {sorted(known)}."
        )
    return list(dict.fromkeys(columns))


# Bookmarks


def find_bookmark(report: Report, ref: str) -> dict[str, Any]:
    bookmarks = bookmarks_of(report.layout)
    for bookmark in bookmarks:
        if bookmark.get("id") == ref:
            return bookmark
    named = [b for b in bookmarks if str(b.get("name", "")).lower() == ref.lower()]
    if len(named) == 1:
        return named[0]
    if len(named) > 1:
        raise LayoutEditError(f"More than one bookmark is called {ref!r}; use its id.")
    raise LayoutEditError(
        f"Bookmark not found: {ref!r}. Bookmarks: "
        + ", ".join(f"{b.get('id')} ({b.get('name')!r})" for b in bookmarks),
        "NotFound",
    )


def save_bookmarks(report: Report, bookmarks: list[dict[str, Any]]) -> None:
    """The bookmarks of the report; none drops the setting, as the editor."""
    meta = meta_of(report, keys.ROOT_ID)
    if bookmarks:
        meta[keys.BOOKMARKS_KEY] = bookmarks
    else:
        meta.pop(keys.BOOKMARKS_KEY, None)


def native_filters(dashboard: Any) -> list[dict[str, Any]]:
    """The native filters of a dashboard, without dividers."""
    from superset.mcp_service.dashboard.tool.manage_native_filters import (
        current_native_filter_config,
    )

    return [
        conf
        for conf in current_native_filter_config(dashboard)
        if conf.get("type", "NATIVE_FILTER") == "NATIVE_FILTER" and conf.get("id")
    ]


def default_mask(conf: dict[str, Any]) -> dict[str, Any]:
    """The data mask a filter starts with: its default value, or none."""
    mask = conf.get("defaultDataMask") or {}
    return {
        "extraFormData": copy.deepcopy(mask.get("extraFormData") or {}),
        "filterState": copy.deepcopy(mask.get("filterState") or {}),
    }


def find_filter(confs: list[dict[str, Any]], ref: str) -> dict[str, Any]:
    for conf in confs:
        if conf.get("id") == ref:
            return conf
    named = [c for c in confs if str(c.get("name", "")).lower() == ref.lower()]
    if len(named) == 1:
        return named[0]
    raise LayoutEditError(
        f"Filter not found: {ref!r}. Filters: "
        + ", ".join(f"{c.get('id')} ({c.get('name')!r})" for c in confs),
        "NotFound",
    )


def bookmark_filters(
    report: Report,
    selections: dict[str, Any],
    saved: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    The filter selections of a bookmark, by data mask id: every native filter
    with its default value (or the saved selection), with the asked values
    over them. Cross-filters are left out, so applying it clears them.
    """
    from superset.mcp_service.report_layout.slicers import default_data_mask

    confs = native_filters(report.dashboard)
    filters: dict[str, Any] = {}
    for conf in confs:
        filters[conf["id"]] = (saved or {}).get(conf["id"]) or default_mask(conf)
    for ref, value in selections.items():
        conf = find_filter(confs, ref)
        mask = default_data_mask(conf, value)
        filters[conf["id"]] = {
            "extraFormData": mask.get("extraFormData") or {},
            "filterState": mask.get("filterState") or {},
        }
    return filters


def visibility_objects(report: Report) -> list[str]:
    """Charts and design elements, whose visibility a bookmark keeps."""
    found = []
    for component_id, item in report.layout.items():
        if not isinstance(item, dict):
            continue
        if item.get("type") == keys.CHART_TYPE or (
            item.get("type") == keys.DYNAMIC_TYPE
            and keys.element_kind((item.get("meta") or {}).get("componentKey"))
        ):
            found.append(component_id)
    return found


def bookmark_visibility(
    report: Report,
    hidden: list[Any],
    shown: list[Any],
    saved: dict[str, bool] | None = None,
) -> dict[str, bool]:
    """Whether a bookmark hides each object: as saved (or as the object is),
    with the asked ones over it."""
    objects = visibility_objects(report)
    visibility = {
        cid: bool(
            (saved or {}).get(cid, meta_of(report, cid).get(keys.HIDDEN_KEY, False))
        )
        for cid in objects
    }
    for refs, value in ((hidden, True), (shown, False)):
        for ref in refs:
            cid = resolve_object(report, ref)
            if cid not in visibility:
                raise LayoutEditError(
                    f"{cid} is not a chart or design element; bookmarks keep "
                    "only their visibility."
                )
            visibility[cid] = value
    return visibility


def bookmark_view(report: Report, bookmark: dict[str, Any]) -> dict[str, Any]:
    """A bookmark in report terms."""
    confs = {conf["id"]: conf for conf in native_filters(report.dashboard)}
    filters = {
        filter_id: {
            "name": (confs.get(filter_id) or {}).get("name"),
            "value": (mask.get("filterState") or {}).get("value"),
        }
        for filter_id, mask in (bookmark.get("filters") or {}).items()
    }
    page = bookmark.get("page")
    return {
        "id": bookmark.get("id"),
        "name": bookmark.get("name"),
        "page": page,
        "page_name": page_name(report, page),
        "options": bookmark.get("options"),
        "filters": filters,
        "hidden": sorted(
            cid for cid, hide in (bookmark.get("visibility") or {}).items() if hide
        ),
    }


def bookmark_users(report: Report, bookmark_id: str) -> list[str]:
    """Objects whose actions go to a bookmark (buttons, chart links)."""

    def points_at(value: Any) -> bool:
        if isinstance(value, dict):
            if value.get("bookmarkId") == bookmark_id:
                return True
            return any(points_at(v) for v in value.values())
        if isinstance(value, list):
            return any(points_at(v) for v in value)
        return False

    return sorted(
        cid
        for cid, item in report.layout.items()
        if cid != keys.ROOT_ID
        and isinstance(item, dict)
        and points_at(item.get("meta"))
    )


# Interactions


def chart_object(report: Report, ref: Any) -> tuple[str, int]:
    """A chart of the report, as its layout id and chart id."""
    component_id = resolve_object(report, ref)
    item = report.layout[component_id]
    chart_id = (item.get("meta") or {}).get("chartId")
    if item.get("type") != keys.CHART_TYPE or not isinstance(chart_id, int):
        raise LayoutEditError(f"{component_id} is not a chart.")
    return component_id, chart_id


def charts_in_scope(report: Report, scope: dict[str, Any]) -> list[int]:
    """The charts of the report a scope covers (``getChartIdsInFilterScope``)."""
    from superset.dashboards.filter_scope import (
        build_chart_layout_items,
        get_chart_ids_in_scope,
    )
    from superset.mcp_service.dashboard.layout_validation import (
        rebuild_parent_chains,
    )

    layout = rebuild_parent_chains(copy.deepcopy(report.layout))
    chart_ids = [chart.id for chart in report.dashboard.slices]
    return get_chart_ids_in_scope(scope, chart_ids, build_chart_layout_items(layout))


def set_interactions(
    report: Report, metadata: dict[str, Any], source: int, modes: dict[int, str]
) -> dict[str, Any]:
    """The ``chart_configuration`` with the source's cross-filters reaching
    each target or not, as ``setInteraction`` writes it."""
    scope = copy.deepcopy(cross_filter_scope(metadata, source))
    excluded = list(scope.get("excluded") or [])
    for target, mode in modes.items():
        if mode == "none" and target not in excluded:
            excluded.append(target)
        elif mode == "filter" and target in excluded:
            excluded.remove(target)
    scope = {**scope, "excluded": excluded}
    in_scope = [cid for cid in charts_in_scope(report, scope) if cid != source]
    configuration = dict(metadata.get("chart_configuration") or {})
    configuration[str(source)] = {
        "id": source,
        "crossFilters": {"scope": scope, "chartsInScope": in_scope},
    }
    return configuration


def excluded_interactions(metadata: dict[str, Any]) -> dict[str, list[int]]:
    """Charts each chart's cross-filters do not reach, by chart id."""
    found: dict[str, list[int]] = {}
    for key in metadata.get("chart_configuration") or {}:
        if not str(key).isdigit():
            continue
        excluded = cross_filter_scope(metadata, int(key)).get("excluded") or []
        if excluded:
            found[str(key)] = [cid for cid in excluded if isinstance(cid, int)]
    return found


# Sync slicers


def slicers_of(report: Report, filter_id: str) -> dict[str, list[str]]:
    """Canvas slicers of a filter on each page."""
    found: dict[str, list[str]] = {}
    for cid, item in report.layout.items():
        if not isinstance(item, dict) or item.get("type") != keys.DYNAMIC_TYPE:
            continue
        meta = item.get("meta") or {}
        if keys.element_kind(meta.get("componentKey")) != "filter":
            continue
        if (meta.get(keys.ELEMENT_KEY) or {}).get("filterId") != filter_id:
            continue
        if page := page_of(report.layout, cid):
            found.setdefault(page, []).append(cid)
    return found


def copy_slicer(report: Report, source_id: str, page_id: str) -> str:
    """A copy of a slicer on another page, at its cell when that is free."""
    from superset.mcp_service.dashboard.constants import generate_id

    meta = copy.deepcopy(meta_of(report, source_id))
    component_id = generate_id(keys.DYNAMIC_TYPE)
    report.layout[component_id] = {
        "type": keys.DYNAMIC_TYPE,
        "id": component_id,
        "children": [],
        "parents": [],
        "meta": meta,
    }
    append_in_new_row(report, page_id, component_id)
    cell = pos_of(meta)
    set_box(report, component_id, cell)
    if overlaps(report, page_id, [component_id]):
        width, height = size_of(meta)
        meta.pop(keys.POS_KEY, None)
        set_box(
            report,
            component_id,
            free_cell(report.layout, page_id, int(width), int(height)),
        )
        if overlaps(report, page_id, [component_id]):
            raise LayoutEditError(
                f"There is no free room for the slicer on page "
                f"{page_name(report, page_id)!r}; make room first.",
                "Overlap",
            )
        report.warnings.append(
            f"{component_id}: its cell was taken on {page_name(report, page_id)!r}; "
            f"placed at {box(report, component_id)[:2]}."
        )
    return component_id


def remove_component(report: Report, component_id: str) -> None:
    from superset.mcp_service.report_layout.editing import detach

    refuse_locked(report, component_id)
    detach(report, component_id)
    report.layout.pop(component_id, None)


# Tooltips


def tooltip_page_setting(report: Report, page_id: str) -> dict[str, Any] | None:
    return tooltip_page_of(meta_of(report, page_id))


def clipped_objects(report: Report, page_id: str, width: int, height: int) -> list[str]:
    """Objects of a tooltip page past its tooltip area."""
    from superset.auradata.layout import page_objects

    clipped = []
    for cid in page_objects(report.layout, page_id):
        x, y, w, h = box(report, cid)
        if x + w > width or y + h > height:
            clipped.append(cid)
    return clipped
