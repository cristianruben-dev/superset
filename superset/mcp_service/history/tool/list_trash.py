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
"""MCP tool: list_trash"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.history.schemas import ListTrashRequest, ListTrashResponse


@tool(
    tags=["discovery", "history"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="List trash",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_trash(request: ListTrashRequest, ctx: Context) -> ListTrashResponse:
    """List deleted dashboards, charts and datasets you can restore.

    With workspace_id: the trash of that workspace page (its deleted
    dashboards; contributors and admins only, viewers get Forbidden). Without
    it: the trash of Administration, everything for Superset admins and what
    you edit for others. Restore with the item's restore_tool;
    blocked_by says why a dashboard can't come back yet.
    """
    from superset.auradata.workspaces import workspace_trash, WorkspaceError
    from superset.mcp_service.history.utils import (
        error_response,
        from_workspace_error,
        global_trash,
        trash_item,
    )

    await ctx.info("Listing trash: workspace_id=%s" % (request.workspace_id,))
    with event_logger.log_context(action="mcp.list_trash"):
        if request.workspace_id is None:
            kinds = request.entity_types or ["dashboard", "chart", "dataset"]
            return ListTrashResponse(
                items=global_trash("list_trash", kinds, request.limit)
            )
        try:
            dashboards = workspace_trash(request.workspace_id)
        except WorkspaceError as error:
            return error_response(
                ListTrashResponse,
                from_workspace_error(error),
                workspace_id=request.workspace_id,
            )
        return ListTrashResponse(
            workspace_id=request.workspace_id,
            items=[
                trash_item("dashboard", dashboard, "dashboard_title")
                for dashboard in dashboards[: request.limit]
            ],
        )
