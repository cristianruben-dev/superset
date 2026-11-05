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
"""MCP tool: get_workspace"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    GetWorkspaceResponse,
    WorkspaceIdRequest,
)
from superset.mcp_service.workspace.utils import (
    dashboard_item,
    dataset_item,
    error_response,
    workspace_info,
)


@tool(
    tags=["discovery", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get workspace",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_workspace(
    request: WorkspaceIdRequest, ctx: Context
) -> GetWorkspaceResponse:
    """Get a workspace you belong to, with its dashboards and datasets.

    Lists only the dashboards and datasets you can access.
    """
    from superset.auradata.workspaces import (
        find_workspace,
        workspace_dashboards,
        workspace_dataset_list,
        WorkspaceError,
    )

    await ctx.info("Getting workspace: id=%s" % (request.workspace_id,))
    with event_logger.log_context(action="mcp.get_workspace"):
        try:
            workspace, role = find_workspace(request.workspace_id)
        except WorkspaceError as error:
            return error_response(GetWorkspaceResponse, error)
        return GetWorkspaceResponse(
            workspace=workspace_info(workspace, role),
            dashboards=[dashboard_item(d) for d in workspace_dashboards(workspace)],
            datasets=[dataset_item(d) for d in workspace_dataset_list(workspace)],
        )
