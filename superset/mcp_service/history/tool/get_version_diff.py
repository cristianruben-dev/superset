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
"""MCP tool: get_version_diff"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.history.schemas import (
    GetVersionDiffResponse,
    VersionChange,
    VersionRef,
)


@tool(
    tags=["discovery", "history"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get version diff",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_version_diff(request: VersionRef, ctx: Context) -> GetVersionDiffResponse:
    """What one version of a dashboard, chart or dataset changed.

    Returns the field changes of that save (kind, operation, path, before
    and after), the records the history panel of the web shows. Give the
    version by version_uuid or version_number from list_versions.
    """
    from superset.mcp_service.history.utils import (
        entity_versions,
        error_response,
        find_version,
        history_entity,
        HistoryError,
        version_item,
    )

    await ctx.info(
        "Reading version diff: %s %s" % (request.entity_type, request.identifier)
    )
    with event_logger.log_context(action="mcp.get_version_diff"):
        try:
            entity, entity_uuid = history_entity(
                "get_version_diff", request.entity_type, request.identifier
            )
            version = find_version(
                entity_versions(request.entity_type, entity, entity_uuid),
                request.version_uuid,
                request.version_number,
            )
        except HistoryError as error:
            return error_response(GetVersionDiffResponse, error)
        return GetVersionDiffResponse(
            entity_type=request.entity_type,
            entity_id=entity.id,
            version=version_item(version),
            changes=[
                VersionChange.model_validate(change)
                for change in version.get("changes") or []
            ],
        )
