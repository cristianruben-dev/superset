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
"""MCP tool: set_workspace_member"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    SetWorkspaceMemberRequest,
    SetWorkspaceMemberResponse,
)
from superset.mcp_service.workspace.utils import (
    error_response,
    rollback,
    user_item,
    workspace_info,
)


@tool(
    tags=["mutate", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Set workspace member",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def set_workspace_member(
    request: SetWorkspaceMemberRequest, ctx: Context
) -> SetWorkspaceMemberResponse:
    """Add a user to a workspace, or change their role (its admins).

    viewer reads; contributor also edits its dashboards and charts and reads
    its datasets; admin also manages the workspace and its members. A
    workspace keeps at least one admin.
    """
    from superset.auradata import workspaces

    await ctx.info(
        "Setting workspace member: id=%s, user_id=%s, role=%s"
        % (request.workspace_id, request.user_id, request.role)
    )
    with event_logger.log_context(action="mcp.set_workspace_member"):
        try:
            workspace, role = workspaces.set_member(
                request.workspace_id,
                {"user_id": request.user_id, "role": request.role},
            )
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(SetWorkspaceMemberResponse, error)
        member = next(m for m in workspace.members if m.user_id == request.user_id)
        return SetWorkspaceMemberResponse(
            success=True,
            member=user_item(member.user, member.role),
            workspace=workspace_info(workspace, role),
        )
