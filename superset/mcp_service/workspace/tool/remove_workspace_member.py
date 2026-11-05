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
"""MCP tool: remove_workspace_member"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    RemoveWorkspaceMemberRequest,
    RemoveWorkspaceMemberResponse,
)
from superset.mcp_service.workspace.utils import error_response, rollback


@tool(
    tags=["mutate", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Remove workspace member",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def remove_workspace_member(
    request: RemoveWorkspaceMemberRequest, ctx: Context
) -> RemoveWorkspaceMemberResponse:
    """Remove a member from a workspace (its admins), or leave it yourself.

    The last admin of a workspace cannot be removed.
    """
    from superset.auradata import workspaces
    from superset.utils.core import get_user_id

    await ctx.info(
        "Removing workspace member: id=%s, user_id=%s"
        % (request.workspace_id, request.user_id)
    )
    leaving = request.user_id == get_user_id()
    with event_logger.log_context(action="mcp.remove_workspace_member"):
        try:
            workspaces.remove_member(request.workspace_id, request.user_id)
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(RemoveWorkspaceMemberResponse, error)
    return RemoveWorkspaceMemberResponse(
        success=True, removed_user_id=request.user_id, left_workspace=leaving
    )
