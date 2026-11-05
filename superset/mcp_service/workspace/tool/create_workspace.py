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
"""MCP tool: create_workspace"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    CreateWorkspaceRequest,
    WorkspaceWriteResponse,
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
        title="Create workspace",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def create_workspace(
    request: CreateWorkspaceRequest, ctx: Context
) -> WorkspaceWriteResponse:
    """Create a workspace; you become its admin.

    Example: {"name": "Ventas", "color": "#2563EB"}
    """
    from superset.auradata import workspaces

    await ctx.info("Creating workspace: name=%s" % (request.name,))
    with event_logger.log_context(action="mcp.create_workspace"):
        try:
            workspace = workspaces.create_workspace(
                request.model_dump(exclude_none=True)
            )
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(WorkspaceWriteResponse, error)
    return WorkspaceWriteResponse(success=True, workspace=workspace_info(workspace))
