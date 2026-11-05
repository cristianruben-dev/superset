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
"""MCP tool: list_member_candidates"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    ListMemberCandidatesRequest,
    ListMemberCandidatesResponse,
)
from superset.mcp_service.workspace.utils import error_response, user_item


@tool(
    tags=["discovery", "workspace"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="List member candidates",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_member_candidates(
    request: ListMemberCandidatesRequest, ctx: Context
) -> ListMemberCandidatesResponse:
    """Find up to 20 active users who are not members of a workspace yet.

    Only admins of the workspace can search, to add them with
    set_workspace_member.
    """
    from superset.auradata.workspaces import member_candidates, WorkspaceError

    await ctx.info("Listing member candidates: id=%s" % (request.workspace_id,))
    with event_logger.log_context(action="mcp.list_member_candidates"):
        try:
            users = member_candidates(request.workspace_id, request.search)
        except WorkspaceError as error:
            return error_response(ListMemberCandidatesResponse, error)
    return ListMemberCandidatesResponse(candidates=[user_item(user) for user in users])
