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
"""MCP tool: delete_workspace"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    DeleteWorkspaceResponse,
    WorkspaceIdRequest,
)
from superset.mcp_service.workspace.utils import error_response, rollback


@tool(
    tags=["mutate", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Delete workspace",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def delete_workspace(
    request: WorkspaceIdRequest, ctx: Context
) -> DeleteWorkspaceResponse:
    """Delete a workspace (its admins). Ask the user first.

    Its dashboards and datasets are kept, outside any workspace: the
    dashboards are then visible to anyone with access, and the datasets
    become shared.
    """
    from superset.auradata import workspaces

    await ctx.info("Deleting workspace: id=%s" % (request.workspace_id,))
    with event_logger.log_context(action="mcp.delete_workspace"):
        try:
            workspace, _ = workspaces.find_workspace(
                request.workspace_id, workspaces.ROLE_ADMIN
            )
            name = workspace.name
            workspaces.delete_workspace(request.workspace_id)
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(DeleteWorkspaceResponse, error)
    return DeleteWorkspaceResponse(
        success=True, deleted_id=request.workspace_id, deleted_name=name
    )
