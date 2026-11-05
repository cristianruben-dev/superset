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
"""Read the structure of a report in report terms."""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    find_dashboard,
    LayoutEditError,
    load_layout,
    Report,
)
from superset.mcp_service.report_layout.schemas import (
    GetReportStructureRequest,
    ReportError,
    ReportStructure,
)
from superset.mcp_service.report_layout.structure import build_structure
from superset.utils import json


@tool(
    tags=["discovery", "layout"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get report structure",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_report_structure(
    request: GetReportStructureRequest, ctx: Context
) -> ReportStructure | ReportError:
    """
    Describe a report (dashboard) as the editor shows it: its page size in
    cells, its pages (hidden and tooltip pages included) and, on each page,
    its objects (charts, text boxes, slicers, images, shapes, buttons) with
    their box in cells of 32 px from the top left, stack layer, state and
    resolved format, plus its native filters and bookmarks. Use the page and
    object ids with the page and object tools.
    """
    await ctx.info(f"Reading report structure: dashboard={request.dashboard}")
    try:
        with event_logger.log_context(action="mcp.get_report_structure"):
            dashboard = find_dashboard(request.dashboard)
            report = Report(dashboard, load_layout(dashboard))
            stored = json.loads(dashboard.position_json or "{}")
            if stored != report.layout:
                report.warnings.append(
                    "The saved layout predates the cell grid or lacks positions; "
                    "the editor converts it on load and the first layout write "
                    "saves it converted."
                )
            return build_structure(report, request.include_format)
    except LayoutEditError as ex:
        return ReportError(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
