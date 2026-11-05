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
"""A report described in report terms: pages, objects, filters, bookmarks."""

from __future__ import annotations

import re
from typing import Any

from superset.auradata.layout import (
    canvas_format,
    is_hidden_page,
    keys,
    mobile_layout_of,
    page_ids,
    page_objects,
    page_title,
    visual_format_of,
)
from superset.auradata.layout.interactivity import filter_scope_level
from superset.mcp_service.report_layout.editing import box, Report
from superset.mcp_service.report_layout.interactivity import (
    auto_apply_of,
    dashboard_metadata,
    excluded_interactions,
)
from superset.mcp_service.report_layout.schemas import (
    BookmarkSummary,
    CanvasSummary,
    CellBox,
    FilterSummary,
    PageSummary,
    ReportObject,
    ReportStructure,
)
from superset.utils import json

_TAGS = re.compile(r"<[^>]+>")


def _short(text: Any, limit: int = 60) -> str | None:
    if not isinstance(text, str):
        return None
    plain = " ".join(_TAGS.sub(" ", text).split())
    return plain[:limit] or None


def object_kind(item: dict[str, Any]) -> str:
    """chart, text_box, or the kind of a design element (slicer for filters)."""
    component_type = item.get("type")
    if component_type == keys.CHART_TYPE:
        return "chart"
    if component_type == keys.MARKDOWN_TYPE:
        return "text_box"
    kind = keys.element_kind((item.get("meta") or {}).get("componentKey"))
    if kind == "filter":
        return "slicer"
    return kind or "element"


def _title(
    item: dict[str, Any], chart_names: dict[int, str], filter_names: dict[str, str]
) -> str | None:
    meta = item.get("meta") or {}
    kind = object_kind(item)
    if kind == "chart":
        return (
            meta.get("sliceNameOverride")
            or meta.get("sliceName")
            or chart_names.get(meta.get("chartId"))
        )
    if kind == "text_box":
        return _short(meta.get("code"))
    element = meta.get(keys.ELEMENT_KEY) or {}
    if kind == "slicer":
        return filter_names.get(element.get("filterId"))
    return _short(element.get("label") or element.get("text") or element.get("html"))


def _native_filters(dashboard: Any) -> list[dict[str, Any]]:
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
    except (TypeError, ValueError):
        return []
    filters = (
        metadata.get("native_filter_configuration")
        if isinstance(metadata, dict)
        else None
    )
    return [item for item in filters or [] if isinstance(item, dict)]


def _filter_summary(item: dict[str, Any]) -> FilterSummary:
    targets = item.get("targets") or []
    columns = [
        (target.get("column") or {}).get("name")
        for target in targets
        if isinstance(target, dict)
    ]
    scope = item.get("scope") or {}
    return FilterSummary(
        id=str(item.get("id")),
        name=item.get("name"),
        filter_type=item.get("filterType"),
        columns=[c for c in columns if c],
        dataset_ids=[
            target.get("datasetId")
            for target in targets
            if isinstance(target, dict) and target.get("datasetId") is not None
        ],
        scope_pages=[
            root
            for root in scope.get("rootPath") or []
            if isinstance(root, str) and root != keys.ROOT_ID
        ],
        excluded_charts=[c for c in scope.get("excluded") or [] if isinstance(c, int)],
        level=filter_scope_level(item),
    )


def _tooltip_of(layout: dict[str, Any], component_id: str) -> dict[str, Any] | None:
    """The tooltip setting of a chart, its own over the shared one."""
    if (layout.get(component_id) or {}).get("type") != keys.CHART_TYPE:
        return None
    setting = (visual_format_of(layout, component_id) or {}).get("tooltipPage")
    return setting if isinstance(setting, dict) and setting else None


def build_structure(report: Report, include_format: bool = True) -> ReportStructure:
    """The report as pages of objects with their cells and formats."""
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    layout = report.layout
    dashboard = report.dashboard
    chart_names = {chart.id: chart.slice_name for chart in dashboard.slices}
    filters = _native_filters(dashboard)
    filter_names = {str(item.get("id")): item.get("name") for item in filters}

    pages: list[PageSummary] = []
    for index, page_id in enumerate(page_ids(layout), start=1):
        meta = (layout.get(page_id) or {}).get("meta") or {}
        objects: list[ReportObject] = []
        for z, component_id in enumerate(page_objects(layout, page_id), start=1):
            item = layout[component_id]
            item_meta = item.get("meta") or {}
            x, y, width, height = box(report, component_id)
            resolved = (
                visual_format_of(layout, component_id) if include_format else None
            )
            objects.append(
                ReportObject(
                    id=component_id,
                    kind=object_kind(item),
                    title=_title(item, chart_names, filter_names),
                    chart_id=item_meta.get("chartId"),
                    filter_id=(item_meta.get(keys.ELEMENT_KEY) or {}).get("filterId"),
                    box=CellBox(x=x, y=y, width=width, height=height),
                    layer=z,
                    hidden=bool(item_meta.get(keys.HIDDEN_KEY)),
                    locked=bool(item_meta.get(keys.LOCKED_KEY)),
                    alt_text=item_meta.get(keys.ALT_TEXT_KEY),
                    tooltip_page=_tooltip_of(layout, component_id),
                    format=resolved or None,
                )
            )
        tooltip = meta.get(keys.TOOLTIP_PAGE_KEY)
        drillthrough = meta.get(keys.DRILLTHROUGH_PAGE_KEY)
        pages.append(
            PageSummary(
                id=page_id,
                name=page_title(layout, page_id) or f"Page {index}",
                index=index,
                hidden=bool(meta.get(keys.HIDDEN_PAGE_KEY)),
                shown_to_viewers=not is_hidden_page(meta),
                tooltip_page=tooltip if isinstance(tooltip, dict) else None,
                drillthrough_columns=(drillthrough or {}).get("columns")
                if isinstance(drillthrough, dict)
                else None,
                has_mobile_layout=bool(mobile_layout_of(layout, page_id)),
                objects=objects,
            )
        )

    canvas = canvas_format(layout) or {}
    metadata = dashboard_metadata(dashboard)
    bookmarks = (layout.get(keys.ROOT_ID) or {}).get("meta", {}).get(
        keys.BOOKMARKS_KEY
    ) or []
    return ReportStructure(
        dashboard_id=dashboard.id,
        dashboard_title=dashboard.dashboard_title,
        url=f"{get_superset_base_url()}/dashboard/{dashboard.slug or dashboard.id}/",
        canvas=CanvasSummary(
            width=report.columns,
            height=report.rows,
            size_mode=(canvas.get("size") or {}).get("mode") or "16:9",
            background=canvas.get("background"),
            shared_visual_format=canvas.get("visuals") if include_format else None,
        ),
        pages=pages,
        filters=[_filter_summary(item) for item in filters],
        bookmarks=[
            BookmarkSummary(
                id=str(item.get("id")),
                name=item.get("name"),
                page=item.get("page"),
                options=item.get("options"),
                filter_ids=sorted(item.get("filters") or {}),
                hidden=sorted(
                    cid for cid, hide in (item.get("visibility") or {}).items() if hide
                ),
            )
            for item in bookmarks
            if isinstance(item, dict)
        ],
        filter_bar_auto_apply=auto_apply_of(metadata),
        interactions=excluded_interactions(metadata),
        warnings=report.warnings,
    )
