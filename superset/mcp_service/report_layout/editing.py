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
Reading and writing the layout of a report for the MCP tools.

Every write loads the dashboard, checks that the user may edit it
(``can_edit_resource``: editors and the contributors and admins of its
workspace), brings the layout to cells and positions as the editor does on
load, changes it, keeps every object inside its page and off the others, and
saves it through ``UpdateDashboardCommand``, so the version history records it.
"""

from __future__ import annotations

import copy
import logging
from dataclasses import dataclass, field
from typing import Any

from superset.auradata.layout import (
    clamp_to_page,
    column_count_of,
    descendants,
    is_positioned,
    keys,
    layout_to_cells,
    layout_to_positions,
    MIN_CHART_COLUMNS,
    MIN_CHART_ROWS,
    MIN_OBJECT_COLUMNS,
    MIN_OBJECT_ROWS,
    page_ids,
    page_of,
    page_title,
    Pos,
    pos_of,
    row_count_of,
    size_of,
)
from superset.mcp_service.dashboard.layout_validation import rebuild_parent_chains
from superset.utils import json

logger = logging.getLogger(__name__)


class LayoutEditError(Exception):
    """A write the report refuses, with the ``error_type`` the tool returns."""

    def __init__(self, message: str, error_type: str = "InvalidRequest") -> None:
        super().__init__(message)
        self.message = message
        self.error_type = error_type


@dataclass
class Report:
    """A dashboard and its layout, in cells and positions."""

    dashboard: Any
    layout: dict[str, Any]
    warnings: list[str] = field(default_factory=list)
    original: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.original = copy.deepcopy(self.layout)

    @property
    def columns(self) -> int:
        return column_count_of(self.layout)

    @property
    def rows(self) -> int:
        return row_count_of(self.layout)


def find_dashboard(identifier: int | str) -> Any:
    """The dashboard the user can see, by id, uuid or slug."""
    from superset.commands.dashboard.exceptions import (
        DashboardAccessDeniedError,
        DashboardNotFoundError,
    )
    from superset.daos.dashboard import DashboardDAO

    try:
        return DashboardDAO.get_by_id_or_slug(identifier)
    except (DashboardNotFoundError, DashboardAccessDeniedError) as ex:
        raise LayoutEditError(
            f"Dashboard not found: {identifier!r}", "NotFound"
        ) from ex


def with_dashboard_header(layout: dict[str, Any], title: str | None) -> dict[str, Any]:
    """
    The layout with the dashboard's title as its header component, the way the
    editor adds it on load and saves it, so what the MCP saves is what the
    editor would save.
    """
    return {
        **layout,
        keys.HEADER_ID: {
            "id": keys.HEADER_ID,
            "type": keys.HEADER_TYPE,
            "meta": {"text": title or ""},
        },
    }


def load_layout(dashboard: Any) -> dict[str, Any]:
    """The layout of a dashboard as the editor opens it: in cells, placed."""
    try:
        layout = json.loads(dashboard.position_json or "{}")
    except (TypeError, ValueError) as ex:
        raise LayoutEditError(
            "The dashboard layout cannot be read.", "InvalidDashboardLayout"
        ) from ex
    if not isinstance(layout, dict) or keys.ROOT_ID not in layout:
        raise LayoutEditError(
            "The dashboard has no layout yet; add a chart to it first.",
            "InvalidDashboardLayout",
        )
    return layout_to_positions(layout_to_cells(layout))


def open_report(identifier: int | str, edit: bool = False) -> Report:
    """The report to read, or to edit when the user may edit it."""
    from superset import security_manager

    dashboard = find_dashboard(identifier)
    if edit and not security_manager.can_edit_resource(dashboard):
        raise LayoutEditError(
            f"You don't have permission to edit dashboard "
            f"'{dashboard.dashboard_title}' (ID: {dashboard.id}).",
            "Forbidden",
        )
    return Report(dashboard, load_layout(dashboard))


def save_report(
    report: Report,
    slices: list[Any] | None = None,
    fields: dict[str, Any] | None = None,
) -> bool:
    """
    Save the layout, and any other dashboard ``fields`` (its ``css``), through
    the dashboard update command; nothing is saved (and False returned) when
    the change left the layout as it was and no field was given.
    """
    from superset.commands.dashboard.exceptions import (
        DashboardForbiddenError,
        DashboardInvalidError,
        DashboardNotFoundError,
        DashboardUpdateFailedError,
    )
    from superset.commands.dashboard.update import UpdateDashboardCommand

    if slices is None and not fields and report.layout == report.original:
        return False
    data: dict[str, Any] = {
        "position_json": json.dumps(
            with_dashboard_header(
                rebuild_parent_chains(report.layout), report.dashboard.dashboard_title
            )
        )
    }
    if slices is not None:
        data["slices"] = slices
    if fields:
        data.update(fields)
    try:
        UpdateDashboardCommand(report.dashboard.id, data).run()
    except DashboardForbiddenError as ex:
        raise LayoutEditError(
            "You don't have permission to edit this dashboard.", "Forbidden"
        ) from ex
    except DashboardNotFoundError as ex:
        raise LayoutEditError("Dashboard not found.", "NotFound") from ex
    except DashboardInvalidError as ex:
        raise LayoutEditError(
            f"The dashboard refused the layout: {ex.normalized_messages()}",
            "InvalidDashboardLayout",
        ) from ex
    except DashboardUpdateFailedError as ex:
        logger.exception(
            "Saving the layout of dashboard %s failed", report.dashboard.id
        )
        raise LayoutEditError(
            "Failed to save the dashboard layout.", "DatabaseError"
        ) from ex
    return True


# Pages and objects


def resolve_page(report: Report, page: str | int | None) -> str:
    """A page by id, name (any case) or position from 1; the first by default."""
    pages = page_ids(report.layout)
    if not pages:
        raise LayoutEditError("The report has no pages.", "InvalidDashboardLayout")
    if page is None or page == "":
        return pages[0]
    if isinstance(page, int) or (isinstance(page, str) and page.isdigit()):
        index = int(page)
        if 1 <= index <= len(pages):
            return pages[index - 1]
    if isinstance(page, str):
        if page in pages:
            return page
        named = [
            p for p in pages if page_title(report.layout, p).lower() == page.lower()
        ]
        if len(named) == 1:
            return named[0]
        if len(named) > 1:
            raise LayoutEditError(
                f"More than one page is called {page!r}; use its id: {named}."
            )
    raise LayoutEditError(
        f"Page not found: {page!r}. Pages: "
        + ", ".join(f"{p} ({page_title(report.layout, p)!r})" for p in pages),
        "NotFound",
    )


def resolve_object(report: Report, ref: str | int) -> str:
    """An object of the report by layout id, or a chart by its chart id."""
    layout = report.layout
    if isinstance(ref, str) and ref in layout and isinstance(layout[ref], dict):
        if is_positioned(layout[ref].get("type")):
            return ref
        raise LayoutEditError(
            f"{ref!r} is a {layout[ref].get('type')}, not an object of a page."
        )
    chart_id = (
        ref if isinstance(ref, int) else (int(ref) if str(ref).isdigit() else None)
    )
    if chart_id is not None:
        for component_id, item in layout.items():
            if (
                isinstance(item, dict)
                and item.get("type") == keys.CHART_TYPE
                and (item.get("meta") or {}).get("chartId") == chart_id
            ):
                return component_id
    raise LayoutEditError(
        f"Object not found: {ref!r}. Use get_report_structure for the ids.",
        "NotFound",
    )


def page_of_object(report: Report, component_id: str) -> str:
    """The page that holds an object."""
    page = page_of(report.layout, component_id)
    if not page:
        raise LayoutEditError(f"{component_id!r} is on no page.", "InvalidRequest")
    return page


def meta_of(report: Report, component_id: str) -> dict[str, Any]:
    """The meta of a component, created when it has none (edited in place)."""
    item = report.layout[component_id]
    if not isinstance(item.get("meta"), dict):
        item["meta"] = {}
    return item["meta"]


def is_locked(report: Report, component_id: str) -> bool:
    return bool(meta_of(report, component_id).get(keys.LOCKED_KEY))


def refuse_locked(report: Report, component_id: str) -> None:
    if is_locked(report, component_id):
        raise LayoutEditError(
            f"{component_id!r} is locked; unlock it with set_object_state first.",
            "Locked",
        )


def least_size(report: Report, component_id: str) -> tuple[int, int]:
    """The smallest an object can be, in cells."""
    if report.layout[component_id].get("type") == keys.CHART_TYPE:
        return MIN_CHART_COLUMNS, MIN_CHART_ROWS
    return MIN_OBJECT_COLUMNS, MIN_OBJECT_ROWS


def set_box(
    report: Report,
    component_id: str,
    cell: Pos | None = None,
    width: int | None = None,
    height: int | None = None,
) -> None:
    """
    Gives an object a cell and size, kept inside its page as the editor's
    canvas frame does: a size larger than the page shrinks to it and a cell
    past its edge moves back in, with a warning.
    """
    meta = meta_of(report, component_id)
    least_width, least_height = least_size(report, component_id)
    current_width, current_height = size_of(meta)
    new_width = int(width if width is not None else current_width)
    new_height = int(height if height is not None else current_height)
    new_width = max(least_width, min(new_width, report.columns))
    new_height = max(least_height, min(new_height, report.rows))
    if (width is not None and new_width != width) or (
        height is not None and new_height != height
    ):
        report.warnings.append(
            f"{component_id}: size fitted to {new_width} x {new_height} cells "
            f"(page {report.columns} x {report.rows}, least "
            f"{least_width} x {least_height})."
        )
    meta["width"] = new_width
    meta["height"] = new_height
    target = cell or pos_of(meta) or {"x": 0, "y": 0}
    fitted = clamp_to_page(report.layout, meta, target)
    fitted["y"] = min(fitted["y"], max(0, report.rows - new_height))
    if cell and fitted != {"x": cell["x"], "y": cell["y"]}:
        report.warnings.append(
            f"{component_id}: moved to cell ({fitted['x']}, {fitted['y']}) to stay "
            "inside the page."
        )
    meta[keys.POS_KEY] = fitted


def box(report: Report, component_id: str) -> tuple[int, int, int, int]:
    meta = meta_of(report, component_id)
    pos = pos_of(meta) or {"x": 0, "y": 0}
    width, height = size_of(meta)
    return pos["x"], pos["y"], int(width), int(height)


def overlaps(
    report: Report, page_id: str, component_ids: list[str]
) -> list[tuple[str, str]]:
    """Pairs of objects of a page, one of them among these, that overlap."""
    others = [
        cid
        for cid in descendants(report.layout, page_id)
        if is_positioned((report.layout.get(cid) or {}).get("type"))
        and page_of(report.layout, cid) == page_id
    ]
    found: list[tuple[str, str]] = []
    for cid in component_ids:
        ax, ay, aw, ah = box(report, cid)
        for other in others:
            if other == cid or (other, cid) in found:
                continue
            bx, by, bw, bh = box(report, other)
            if ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah:
                found.append((cid, other))
    return found


def refuse_overlaps(
    report: Report, page_id: str, component_ids: list[str], allow: bool
) -> None:
    """Objects never land on others unless the request allows it."""
    if allow:
        return
    if pairs := overlaps(report, page_id, component_ids):
        raise LayoutEditError(
            "The change would put objects on top of others: "
            + ", ".join(f"{a} over {b}" for a, b in pairs)
            + ". Pick free cells (get_report_structure shows the boxes) or pass "
            "allow_overlap=true.",
            "Overlap",
        )


# Moving components between containers


def detach(report: Report, component_id: str) -> None:
    """Takes a component out of its parent, dropping rows left empty."""
    layout = report.layout
    for parent_id, item in list(layout.items()):
        if not isinstance(item, dict):
            continue
        children = item.get("children") or []
        if component_id in children:
            item["children"] = [c for c in children if c != component_id]
            if (
                item.get("type") in (keys.ROW_TYPE, keys.COLUMN_TYPE)
                and not item["children"]
            ):
                detach(report, parent_id)
                layout.pop(parent_id, None)


def append_in_new_row(report: Report, page_id: str, component_id: str) -> str:
    """Puts a component in a new row at the end of a page."""
    from superset.mcp_service.dashboard.constants import generate_id

    row_id = generate_id(keys.ROW_TYPE)
    report.layout[row_id] = {
        "type": keys.ROW_TYPE,
        "id": row_id,
        "children": [component_id],
        "parents": [],
        "meta": {"background": "BACKGROUND_TRANSPARENT"},
    }
    report.layout[page_id].setdefault("children", []).append(row_id)
    return row_id


def subtree(report: Report, component_id: str) -> list[str]:
    """A component and everything under it."""
    return [component_id, *descendants(report.layout, component_id)]


def chart_ids_under(report: Report, component_id: str) -> list[int]:
    """The chart ids of the charts under a component."""
    ids: list[int] = []
    for cid in subtree(report, component_id):
        item = report.layout.get(cid) or {}
        if item.get("type") == keys.CHART_TYPE:
            chart_id = (item.get("meta") or {}).get("chartId")
            if isinstance(chart_id, int):
                ids.append(chart_id)
    return ids
