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
"""MCP tool: list_workspaces"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    ListWorkspacesRequest,
    ListWorkspacesResponse,
)
from superset.mcp_service.workspace.utils import workspace_info


@tool(
    tags=["discovery", "workspace"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="List workspaces",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_workspaces(
    request: ListWorkspacesRequest, ctx: Context
) -> ListWorkspacesResponse:
    """List the workspaces you belong to (all of them for admins), by name.

    A workspace groups dashboards and datasets, with members as viewer,
    contributor or admin. Contributors and admins edit its dashboards.
    """
    from superset.auradata.workspaces import visible_workspaces

    await ctx.info("Listing workspaces: search=%s" % (request.search,))
    with event_logger.log_context(action="mcp.list_workspaces"):
        workspaces = visible_workspaces()
        if text := (request.search or "").strip().lower():
            workspaces = [ws for ws in workspaces if text in ws.name.lower()]
        items = [workspace_info(workspace) for workspace in workspaces]
    return ListWorkspacesResponse(workspaces=items, count=len(items))
