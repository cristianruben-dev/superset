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
Mobile layout tools, as in Power BI: a phone page 12 cells wide where some of
the objects of a report page sit, stacked. Phones show it when the page has
one, and the scaled canvas otherwise. Writes go through the dashboard update
command, so they land in the version history.
"""

from typing import Any, Callable

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import mobile_candidates, mobile_page_rows
from superset.auradata.layout.mobile import MobileBox
from superset.extensions import event_logger
from superset.mcp_service.report_layout import mobile
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    open_report,
    Report,
    save_report,
)
from superset.mcp_service.report_layout.mobile_schemas import (
    ClearMobileLayoutRequest,
    GenerateMobileLayoutRequest,
    MobileBoxOutput,
    MobileLayoutResponse,
    SetMobileLayoutRequest,
)

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout", "mobile"],
    "class_permission_name": "Dashboard",
    "method_permission_name": "write",
}


def _annotations(title: str, destructive: bool = False) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=False,
        openWorldHint=False,
    )


def _response(
    report: Report, page_id: str, boxes: list[MobileBox], applied: bool
) -> MobileLayoutResponse:
    placed = {box["id"] for box in boxes}
    return MobileLayoutResponse(
        dashboard_id=report.dashboard.id,
        page=page_id,
        applied=applied,
        items=[MobileBoxOutput(**box) for box in boxes],
        rows=mobile_page_rows(boxes) if boxes else None,
        left_out=[
            cid
            for cid in mobile_candidates(report.layout, page_id)
            if cid not in placed
        ],
        warnings=report.warnings,
    )


async def _run(
    name: str, ctx: Context, change: Callable[[], MobileLayoutResponse]
) -> MobileLayoutResponse:
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return MobileLayoutResponse(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
    await ctx.info(f"{name}: page {result.page}, applied {result.applied}")
    return result


@tool(**_WRITE, annotations=_annotations("Generate a mobile layout"))
async def generate_mobile_layout(
    request: GenerateMobileLayoutRequest, ctx: Context
) -> MobileLayoutResponse:
    """
    Propose the phone layout of a report page from its canvas: cards and
    slicers first (small cards two per row), then charts in reading order at
    full width, text boxes kept before what followed them, hidden objects left
    out. Returns the boxes; pass apply=true to save them as the page's mobile
    layout.
    """

    def change() -> MobileLayoutResponse:
        report = open_report(request.dashboard, edit=request.apply)
        page_id, boxes = mobile.generate_mobile_layout(
            report, request.page, request.apply
        )
        if request.apply:
            save_report(report)
        return _response(report, page_id, boxes, request.apply)

    return await _run("generate_mobile_layout", ctx, change)


@tool(**_WRITE, annotations=_annotations("Set a mobile layout"))
async def set_mobile_layout(
    request: SetMobileLayoutRequest, ctx: Context
) -> MobileLayoutResponse:
    """
    Set the phone layout of a report page with explicit boxes, back to front,
    in cells of a phone page 12 cells wide. Every object must be on that page
    and appear once; objects left out do not show on phones. Boxes past the
    phone page are fitted, with a warning.
    """

    def change() -> MobileLayoutResponse:
        report = open_report(request.dashboard, edit=True)
        page_id, boxes = mobile.set_mobile_layout(
            report, request.page, [item.model_dump() for item in request.items]
        )
        save_report(report)
        return _response(report, page_id, boxes, True)

    return await _run("set_mobile_layout", ctx, change)


@tool(**_WRITE, annotations=_annotations("Clear a mobile layout", destructive=True))
async def clear_mobile_layout(
    request: ClearMobileLayoutRequest, ctx: Context
) -> MobileLayoutResponse:
    """Remove the phone layout of a report page: phones show its scaled canvas."""

    def change() -> MobileLayoutResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = mobile.clear_mobile_layout(report, request.page)
        applied = save_report(report)
        return _response(report, page_id, [], applied)

    return await _run("clear_mobile_layout", ctx, change)
