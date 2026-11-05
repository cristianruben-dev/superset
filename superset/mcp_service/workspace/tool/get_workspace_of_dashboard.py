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
"""MCP tool: get_workspace_of_dashboard"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    GetWorkspaceOfDashboardRequest,
    GetWorkspaceOfDashboardResponse,
    WorkspaceRef,
)
from superset.mcp_service.workspace.utils import error_response


@tool(
    tags=["discovery", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get workspace of dashboard",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_workspace_of_dashboard(
    request: GetWorkspaceOfDashboardRequest, ctx: Context
) -> GetWorkspaceOfDashboardResponse:
    """Get the workspace a dashboard lives in, and your role there.

    Null when it has no workspace, or it is in one you do not belong to.
    """
    from superset.auradata.workspaces import workspace_of_dashboard, WorkspaceError

    await ctx.info("Getting workspace of dashboard: id=%s" % (request.dashboard_id,))
    with event_logger.log_context(action="mcp.get_workspace_of_dashboard"):
        try:
            found = workspace_of_dashboard(request.dashboard_id)
        except WorkspaceError as error:
            return error_response(GetWorkspaceOfDashboardResponse, error)
    if found is None:
        return GetWorkspaceOfDashboardResponse(dashboard_id=request.dashboard_id)
    workspace, role = found
    return GetWorkspaceOfDashboardResponse(
        dashboard_id=request.dashboard_id,
        workspace_ref=WorkspaceRef(
            id=workspace.id, name=workspace.name, color=workspace.color, role=role
        ),
    )
