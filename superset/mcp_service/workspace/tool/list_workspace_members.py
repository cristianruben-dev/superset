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
"""MCP tool: list_workspace_members"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    ListWorkspaceMembersResponse,
    WorkspaceIdRequest,
)
from superset.mcp_service.workspace.utils import error_response, user_item


@tool(
    tags=["discovery", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="List workspace members",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_workspace_members(
    request: WorkspaceIdRequest, ctx: Context
) -> ListWorkspaceMembersResponse:
    """List the members of a workspace you belong to and their roles."""
    from superset.auradata.workspaces import workspace_members, WorkspaceError

    await ctx.info("Listing workspace members: id=%s" % (request.workspace_id,))
    with event_logger.log_context(action="mcp.list_workspace_members"):
        try:
            members = workspace_members(request.workspace_id)
        except WorkspaceError as error:
            return error_response(ListWorkspaceMembersResponse, error)
    return ListWorkspaceMembersResponse(
        members=[user_item(member.user, member.role) for member in members]
    )
