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
"""MCP tool: move_dashboard_to_workspace"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    MoveDashboardToWorkspaceRequest,
    MoveToWorkspaceResponse,
)
from superset.mcp_service.workspace.utils import (
    error_response,
    rollback,
    workspace_info,
)


@tool(
    tags=["mutate", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Move dashboard to workspace",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def move_dashboard_to_workspace(
    request: MoveDashboardToWorkspaceRequest, ctx: Context
) -> MoveToWorkspaceResponse:
    """Move a dashboard into a workspace, or out of any (workspace_id null).

    Needs a contributor or admin role in the workspace it enters (and the
    right to edit the dashboard) or in the one it leaves. Its charts may
    only use datasets of the new workspace or shared ones; otherwise share
    or move those datasets first.
    """
    from superset.auradata import workspaces
    from superset.auradata.workspace_access import workspace_role
    from superset.auradata.workspace_datasets import dashboard_workspace_ids
    from superset.daos.dashboard import DashboardDAO

    dashboard_id = request.dashboard_id
    target = request.workspace_id
    await ctx.info(
        "Moving dashboard to workspace: dashboard_id=%s, workspace_id=%s"
        % (dashboard_id, target)
    )
    with event_logger.log_context(action="mcp.move_dashboard_to_workspace"):
        try:
            if DashboardDAO.find_by_id(dashboard_id) is None:
                raise workspaces.WorkspaceNotFoundError()
            current = next(iter(dashboard_workspace_ids([dashboard_id])), None)
            if target is None and current is None:
                message = "The dashboard is not in any workspace."
            elif target is None:
                workspaces.move_dashboards(current, {"remove": [dashboard_id]})
                message = "The dashboard left its workspace."
            elif target == current:
                workspaces.find_workspace(target)
                message = "The dashboard is already in this workspace."
            else:
                workspaces.move_dashboards(target, {"add": [dashboard_id]})
                message = "The dashboard moved to the workspace."
            workspace = (
                workspace_info(workspaces.find_workspace(target)[0])
                if target is not None
                else None
            )
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(MoveToWorkspaceResponse, error)
    return MoveToWorkspaceResponse(
        success=True,
        # Workspaces the user does not belong to stay private
        previous_workspace_id=current
        if current is not None and workspace_role(current)
        else None,
        workspace=workspace,
        message=message,
    )
