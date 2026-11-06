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
Export a report as a PNG or a PDF on the server, with the pages the web's
Export takes: each page at the fixed size of its canvas.
"""

import base64
from datetime import datetime
from typing import Any, Literal

from fastmcp import Context
from fastmcp.tools.tool import ToolResult
from mcp.types import BlobResourceContents, EmbeddedResource, ImageContent, TextContent
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import LayoutEditError, open_report
from superset.mcp_service.screenshot import capture, export
from superset.mcp_service.screenshot.schemas import (
    ExportDashboardRequest,
    ExportedPage,
    ExportResponse,
)
from superset.utils import json

_ANNOTATIONS: dict[str, Any] = {
    "readOnlyHint": True,
    "destructiveHint": False,
    "openWorldHint": False,
}

_MIME = {"png": "image/png", "pdf": "application/pdf"}


def _result(info: ExportResponse, data: bytes | None) -> ToolResult:
    payload = info.model_dump(exclude_none=True)
    content: list[Any] = [TextContent(type="text", text=json.dumps(payload))]
    if data is not None and info.mime_type == _MIME["png"]:
        content.append(
            ImageContent(
                type="image",
                data=base64.b64encode(data).decode("ascii"),
                mimeType=info.mime_type,
            )
        )
    elif data is not None and info.mime_type:
        content.append(
            EmbeddedResource(
                type="resource",
                resource=BlobResourceContents(
                    uri=f"auradata://export/{info.file_name}",
                    mimeType=info.mime_type,
                    blob=base64.b64encode(data).decode("ascii"),
                ),
            )
        )
    return ToolResult(content=content, structured_content=payload)


async def _export(
    request: ExportDashboardRequest, ctx: Context, kind: Literal["png", "pdf"]
) -> ToolResult:
    await ctx.info(
        f"Export dashboard={request.dashboard} page={request.page} "
        f"all_pages={request.all_pages} as {kind}"
    )
    try:
        with event_logger.log_context(action=f"mcp.export_dashboard_{kind}"):
            report = open_report(request.dashboard)
            pages, skipped = export.pages_to_export(
                report, request.page, request.all_pages
            )
            size = export.page_size(report)
            window = export.export_window(report)
            # Everything read from the database comes first: a capture runs in
            # its own thread and app context, which leaves the session's rows
            # detached when it ends
            dashboard_id = report.dashboard.id
            title = report.dashboard.dashboard_title or "Report"
            exported = export.names(report, pages)
            skipped_pages = export.names(report, skipped)
            urls = [capture.page_url(report, page_id) for page_id in pages]
            images = []
            for url in urls:
                png = await capture.capture_raw(url, export.CANVAS_ELEMENT, window)
                images.append(export.page_image(png, size))
            data = (
                export.build_png(images)
                if kind == "png"
                else export.build_pdf(images, title)
            )
            export.check_size(data)
    except LayoutEditError as ex:
        await ctx.warning(f"Export refused: {ex.error_type}: {ex.message}")
        return _result(ExportResponse(error=ex.message, error_type=ex.error_type), None)
    info = ExportResponse(
        dashboard_id=dashboard_id,
        format=kind.upper(),
        pages=[ExportedPage(**page) for page in exported],
        skipped_pages=[ExportedPage(**page) for page in skipped_pages],
        file_name=export.file_name(title, datetime.now(), kind),
        mime_type=_MIME[kind],
        size_bytes=len(data),
        width=size[0],
        height=size[1],
    )
    return _result(info, data)


@tool(
    tags=["discovery", "sharing"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(title="Export dashboard image", **_ANNOTATIONS),
)
async def export_dashboard_image(
    request: ExportDashboardRequest, ctx: Context
) -> ExportResponse:
    """
    Export a report as a PNG, as the web's Export does: one page, or with
    all_pages every page viewers see (one under another), each at the full
    size of its canvas (1920 x 1088 px for 16:9). Hidden and tooltip pages are
    left out unless named. At most 10 pages and 20 MB per export.
    """
    return await _export(request, ctx, "png")


@tool(
    tags=["discovery", "sharing"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(title="Export dashboard PDF", **_ANNOTATIONS),
)
async def export_dashboard_pdf(
    request: ExportDashboardRequest, ctx: Context
) -> ExportResponse:
    """
    Export a report as a PDF, as the web's Export does: one PDF page per
    report page, of the size of its canvas, in page order. One page, or with
    all_pages every page viewers see; hidden and tooltip pages are left out
    unless named. At most 10 pages and 20 MB per export. The file comes as an
    embedded resource (application/pdf, base64).
    """
    return await _export(request, ctx, "pdf")
