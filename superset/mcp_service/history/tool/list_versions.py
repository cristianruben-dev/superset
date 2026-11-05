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
"""MCP tool: list_versions"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.history.schemas import (
    ListVersionsRequest,
    ListVersionsResponse,
)


@tool(
    tags=["discovery", "history"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="List versions",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def list_versions(
    request: ListVersionsRequest, ctx: Context
) -> ListVersionsResponse:
    """List the saved versions of a dashboard, chart or dataset, newest first.

    Each save is a version; the history of the web shows the same. Its
    editors and the contributors and admins of its workspace read it.
    Read one version's changes with get_version_diff; go back with
    restore_version.
    """
    from superset.mcp_service.history.utils import (
        entity_versions,
        error_response,
        history_entity,
        HistoryError,
        version_item,
    )

    await ctx.info(
        "Listing versions: %s %s" % (request.entity_type, request.identifier)
    )
    with event_logger.log_context(action="mcp.list_versions"):
        try:
            entity, entity_uuid = history_entity(
                "list_versions", request.entity_type, request.identifier
            )
        except HistoryError as error:
            return error_response(ListVersionsResponse, error)
        versions = entity_versions(request.entity_type, entity, entity_uuid)
        return ListVersionsResponse(
            entity_type=request.entity_type,
            entity_id=entity.id,
            entity_uuid=str(entity_uuid),
            total_count=len(versions),
            current_version_number=versions[-1]["version_number"] if versions else None,
            versions=[version_item(v) for v in reversed(versions)][: request.limit],
        )
