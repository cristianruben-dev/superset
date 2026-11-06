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
Screenshots of a report page and of one visual, so the AI can look at what it
built: build, look, fix.
"""

from typing import Any

from fastmcp import Context
from fastmcp.tools.tool import ToolResult
from mcp.types import ImageContent, TextContent
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import keys
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    open_report,
    page_of_object,
    resolve_object,
    resolve_page,
)
from superset.mcp_service.screenshot import capture
from superset.mcp_service.screenshot.schemas import (
    GetDashboardScreenshotRequest,
    GetVisualScreenshotRequest,
    ScreenshotResponse,
)
from superset.utils import json

_ANNOTATIONS: dict[str, Any] = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "openWorldHint": False,
}


def _result(info: ScreenshotResponse, picture: capture.Picture | None) -> ToolResult:
    import base64

    data = info.model_dump(exclude_none=True)
    content: list[Any] = [TextContent(type="text", text=json.dumps(data))]
    if picture:
        content.append(
            ImageContent(
                type="image",
                data=base64.b64encode(picture.data).decode("ascii"),
                mimeType=picture.mime_type,
            )
        )
    return ToolResult(content=content, structured_content=data)


def _error(ex: LayoutEditError) -> ToolResult:
    return _result(ScreenshotResponse(error=ex.message, error_type=ex.error_type), None)


@tool(
    tags=["discovery", "layout"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(title="Get dashboard screenshot", **_ANNOTATIONS),
)
async def get_dashboard_screenshot(
    request: GetDashboardScreenshotRequest, ctx: Context
) -> ScreenshotResponse:
    """
    Take a picture of a page of a report as viewers see it (JPEG, at most
    1600 px on a side), to check the layout and format after changing them.
    device='phone' shows it on a 393 pt wide phone: its mobile layout, or the
    canvas scaled to the width when the page has none.
    """
    await ctx.info(
        f"Screenshot of dashboard={request.dashboard} page={request.page} "
        f"device={request.device}"
    )
    mobile_layout: bool | None = None
    try:
        with event_logger.log_context(action="mcp.get_dashboard_screenshot"):
            report = open_report(request.dashboard)
            page_id = resolve_page(report, request.page)
            dashboard_id = report.dashboard.id
            url = capture.page_url(report, page_id)
            if request.device == "phone":
                window, mobile_layout = capture.phone_window_for(report, page_id)
            else:
                window = capture.window_for(report)
            picture = await capture.capture(url, "standalone", window)
    except LayoutEditError as ex:
        await ctx.warning(f"Screenshot refused: {ex.error_type}: {ex.message}")
        return _error(ex)
    info = ScreenshotResponse(
        dashboard_id=dashboard_id,
        page=page_id,
        url=url,
        device=request.device,
        mobile_layout=mobile_layout,
        width=picture.width,
        height=picture.height,
        mime_type=picture.mime_type,
    )
    return _result(info, picture)


@tool(
    tags=["discovery", "layout"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(title="Get visual screenshot", **_ANNOTATIONS),
)
async def get_visual_screenshot(
    request: GetVisualScreenshotRequest, ctx: Context
) -> ScreenshotResponse:
    """
    Take a picture of one chart as it shows on its report page, with the
    report's format (JPEG, at most 1600 px on a side).
    """
    await ctx.info(
        f"Screenshot of dashboard={request.dashboard} object={request.object}"
    )
    try:
        with event_logger.log_context(action="mcp.get_visual_screenshot"):
            report = open_report(request.dashboard)
            component_id = resolve_object(report, request.object)
            item = report.layout[component_id]
            if item.get("type") != keys.CHART_TYPE:
                raise LayoutEditError(
                    "Only charts have a visual screenshot; use "
                    "get_dashboard_screenshot for the page."
                )
            page_id = page_of_object(report, component_id)
            chart_id = (item.get("meta") or {}).get("chartId")
            dashboard_id = report.dashboard.id
            url = capture.page_url(report, page_id)
            element = f"dashboard-chart-id-{chart_id}"
            picture = await capture.capture(url, element, capture.window_for(report))
    except LayoutEditError as ex:
        await ctx.warning(f"Screenshot refused: {ex.error_type}: {ex.message}")
        return _error(ex)
    info = ScreenshotResponse(
        dashboard_id=dashboard_id,
        page=page_id,
        object=component_id,
        url=url,
        width=picture.width,
        height=picture.height,
        mime_type=picture.mime_type,
    )
    return _result(info, picture)
