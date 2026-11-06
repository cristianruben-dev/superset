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
"""MCP tool: restore_version"""

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.history.schemas import RestoreVersionResponse, VersionRef

logger = logging.getLogger(__name__)


def _commands() -> dict[str, type[Any]]:
    """The restore command of each kind, the one the REST endpoints run."""
    from superset.commands.chart.restore_version import RestoreChartVersionCommand
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )
    from superset.commands.dataset.restore_version import (
        RestoreDatasetVersionCommand,
    )

    return {
        "dashboard": RestoreDashboardVersionCommand,
        "chart": RestoreChartVersionCommand,
        "dataset": RestoreDatasetVersionCommand,
    }


@tool(
    tags=["mutate", "history"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Restore version",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def restore_version(request: VersionRef, ctx: Context) -> RestoreVersionResponse:
    """Bring a dashboard, chart or dataset back to one of its versions.

    The restore is itself a new version, so it can be undone the same way.
    Who can edit it can restore it (its editors and the contributors and
    admins of its workspace). A dashboard version brings back its charts
    too, unless one now belongs to another dashboard or uses a dataset of
    another workspace. Unsaved changes in an open editor are not kept.
    """
    from superset.extensions import db
    from superset.mcp_service.history.utils import (
        entity_versions,
        error_response,
        find_version,
        history_entity,
        HistoryError,
    )
    from superset.versioning.restore import PrunedChildHistoryError

    await ctx.info(
        "Restoring version: %s %s" % (request.entity_type, request.identifier)
    )
    command_cls = _commands()[request.entity_type]
    with event_logger.log_context(action="mcp.restore_version"):
        try:
            entity, entity_uuid = history_entity(
                "restore_version", request.entity_type, request.identifier, "write"
            )
            version = find_version(
                entity_versions(request.entity_type, entity, entity_uuid),
                request.version_uuid,
                request.version_number,
            )
            entity_id = entity.id
            result = command_cls(entity_uuid, version["version_uuid"]).run()
        except HistoryError as error:
            return error_response(RestoreVersionResponse, error)
        except command_cls.not_found_exc:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            return RestoreVersionResponse(
                error="That version can't be restored (it is gone, or history "
                "capture is off).",
                error_type="NotFound",
            )
        except command_cls.forbidden_exc:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            return RestoreVersionResponse(
                error=f"You can't restore this {request.entity_type} (do not "
                "retry; ask the user).",
                error_type="Forbidden",
                permission_denied=True,
            )
        except (PrunedChildHistoryError, command_cls.failed_exc) as ex:
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.info("restore_version refused: %s", ex)
            return RestoreVersionResponse(error=str(ex), error_type="Conflict")
        skipped = list(result.skipped_slice_ids or [])
        number = version["version_number"]
        return RestoreVersionResponse(
            success=True,
            entity_type=request.entity_type,
            entity_id=entity_id,
            restored_version_number=number,
            skipped_chart_ids=skipped,
            message=f"Restored {request.entity_type} {entity_id} to version "
            f"{number}"
            + (f"; {len(skipped)} of its charts no longer exist" if skipped else ""),
        )
