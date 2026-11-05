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
The mobile layout of a report page for the MCP tools: propose one from the
canvas, set explicit boxes, or clear it. It lives in the page
(``TAB-*.meta.auradataMobile``, ``GRID_ID`` for a report of one page), in cells
of a phone page ``MOBILE_COLUMNS`` wide, back to front.
"""

from __future__ import annotations

from typing import Any

from superset.auradata.layout import (
    is_hidden_page,
    keys,
    mobile_candidates,
    MOBILE_COLUMNS,
    mobile_layout_of,
    page_title,
    propose_mobile_layout,
)
from superset.auradata.layout.mobile import fit_box, MobileBox
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    meta_of,
    Report,
    resolve_object,
    resolve_page,
)

# Charts that show one figure: they go to the top of the phone, two per row
CARD_VIZ_TYPES = frozenset({"big_number", "big_number_total", "pop_kpi"})


def _mobile_page(report: Report, page: str | int | None) -> str:
    """A page that can have a mobile layout (not a tooltip page)."""
    page_id = resolve_page(report, page)
    meta = (report.layout.get(page_id) or {}).get("meta") or {}
    if meta.get(keys.TOOLTIP_PAGE_KEY):
        raise LayoutEditError(
            f"{page_title(report.layout, page_id)!r} is a tooltip page: phones "
            "never show it, so it has no mobile layout."
        )
    return page_id


def _viz_types(report: Report) -> dict[int, str]:
    return {
        chart.id: chart.viz_type
        for chart in getattr(report.dashboard, "slices", None) or []
    }


def _first_and_cards(report: Report, ids: list[str]) -> tuple[set[str], set[str]]:
    """The cards (one-figure charts) and slicers among these objects."""
    viz_types = _viz_types(report)
    cards: set[str] = set()
    first: set[str] = set()
    for component_id in ids:
        item = report.layout.get(component_id) or {}
        meta = item.get("meta") or {}
        if item.get("type") == keys.CHART_TYPE:
            if viz_types.get(meta.get("chartId")) in CARD_VIZ_TYPES:
                cards.add(component_id)
                first.add(component_id)
        elif keys.element_kind(meta.get("componentKey")) == "filter":
            first.add(component_id)
    return first, cards


def current_boxes(report: Report, page_id: str) -> list[MobileBox]:
    return mobile_layout_of(report.layout, page_id) or []


def _write(report: Report, page_id: str, boxes: list[MobileBox]) -> None:
    meta = meta_of(report, page_id)
    if boxes:
        meta[keys.MOBILE_LAYOUT_KEY] = {"items": boxes}
    else:
        meta.pop(keys.MOBILE_LAYOUT_KEY, None)


def generate_mobile_layout(
    report: Report, page: str | int | None, apply: bool
) -> tuple[str, list[MobileBox]]:
    """
    Proposes the mobile layout of a page: cards and slicers first, then the
    charts in reading order, texts kept before what followed them, hidden
    objects left out. Written to the page only when ``apply``.
    """
    page_id = _mobile_page(report, page)
    ids = mobile_candidates(report.layout, page_id)
    if not ids:
        raise LayoutEditError(
            f"{page_title(report.layout, page_id)!r} has no objects to place."
        )
    hidden = {
        cid
        for cid in ids
        if ((report.layout[cid].get("meta") or {}).get(keys.HIDDEN_KEY))
    }
    if hidden:
        report.warnings.append(
            "Hidden objects stay off the phone: " + ", ".join(sorted(hidden)) + "."
        )
    first, cards = _first_and_cards(report, ids)
    boxes = propose_mobile_layout(
        report.layout, page_id, cards=cards, first=first, leave_out=hidden
    )
    if apply:
        if is_hidden_page((report.layout.get(page_id) or {}).get("meta")):
            report.warnings.append(
                "The page is hidden from viewers; its mobile layout shows only "
                "when a link or drill through opens it."
            )
        _write(report, page_id, boxes)
    return page_id, boxes


def set_mobile_layout(
    report: Report, page: str | int | None, items: list[dict[str, Any]]
) -> tuple[str, list[MobileBox]]:
    """
    Gives a page explicit mobile boxes, back to front. Each object must be one
    of the page's (a chart id works too) and appear once; boxes are fitted to
    the phone page as the editor does, with a warning.
    """
    page_id = _mobile_page(report, page)
    if not items:
        raise LayoutEditError(
            "Give at least one box; clear_mobile_layout removes the layout."
        )
    candidates = set(mobile_candidates(report.layout, page_id))
    seen: set[str] = set()
    boxes: list[MobileBox] = []
    for entry in items:
        component_id = resolve_object(report, entry["object"])
        if component_id not in candidates:
            raise LayoutEditError(
                f"{component_id!r} is not an object of page "
                f"{page_title(report.layout, page_id)!r}.",
                "NotFound",
            )
        if component_id in seen:
            raise LayoutEditError(f"{component_id!r} has more than one box.")
        seen.add(component_id)
        wanted = {
            "id": component_id,
            "x": entry["x"],
            "y": entry["y"],
            "width": entry["width"],
            "height": entry["height"],
        }
        fitted = fit_box(wanted, report.layout.get(component_id))
        if dict(fitted) != wanted:
            report.warnings.append(
                f"{component_id}: fitted to ({fitted['x']}, {fitted['y']}) "
                f"{fitted['width']} x {fitted['height']} cells to stay inside the "
                f"phone page ({MOBILE_COLUMNS} cells wide)."
            )
        boxes.append(fitted)
    _write(report, page_id, boxes)
    return page_id, boxes


def clear_mobile_layout(report: Report, page: str | int | None) -> str:
    """Removes the mobile layout of a page: phones show its canvas."""
    page_id = resolve_page(report, page)
    _write(report, page_id, [])
    return page_id
