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
"""
MCP tool: restore_dataset
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetLogicalDuplicateError,
    DatasetNotFoundError,
)
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dataset.schemas import (
    RestoreDatasetRequest,
    RestoreDatasetResponse,
)

logger = logging.getLogger(__name__)


def _find_dataset_for_restore(identifier: int | str) -> Any | None:
    """A dataset by numeric ID or UUID, including soft-deleted rows.

    Both bypasses mirror ``BaseRestoreCommand.validate``'s own lookup; the
    restore audience is enforced by ``RestoreDatasetCommand`` via
    ``raise_for_editorship``.
    """
    from superset.daos.dataset import DatasetDAO

    return DatasetDAO.find_by_id_or_uuid(
        str(identifier),
        skip_base_filter=True,
        skip_visibility_filter=True,
    )


def _visible_to_caller(identifier: int | str, dataset_id: int) -> bool:
    """
    Whether the caller would see the dataset if it were not deleted: the
    dataset access filter and the workspace rules, as the dataset API applies
    them. A dataset outside both answers as if it did not exist.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dataset import DatasetDAO
    from superset.mcp_service.dataset.dataset_utils import visible_in_workspaces
    from superset.models.helpers import skip_visibility_filter

    with skip_visibility_filter(db.session, SqlaTable):
        if DatasetDAO.find_by_id_or_uuid(str(identifier)) is None:
            return False
        return visible_in_workspaces(dataset_id)


def _not_found(identifier: int | str) -> RestoreDatasetResponse:
    display_id = str(identifier)[:200]
    return RestoreDatasetResponse(
        success=False,
        error=f"No dataset found with identifier: {display_id}.",
        error_type="NotFound",
    )


def _forbidden(dataset_id: int, name: str | None = None) -> RestoreDatasetResponse:
    what = f"'{name}' (id={dataset_id})" if name else f"id={dataset_id}"
    return RestoreDatasetResponse(
        success=False,
        permission_denied=True,
        error=(
            f"You do not have permission to restore dataset {what}. Only its "
            "editors and admins restore it; ask the user to restore it or grant "
            "access; do not retry."
        ),
        error_type="Forbidden",
    )


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Database rollback failed during restore_dataset error handling")


async def _run_restore(dataset: Any, ctx: Context) -> RestoreDatasetResponse:
    """Runs the restore command and turns its refusals into responses."""
    dataset_id = dataset.id
    dataset_name = dataset.table_name
    try:
        from superset.commands.dataset.restore import RestoreDatasetCommand

        RestoreDatasetCommand(str(dataset.uuid)).run()
        return RestoreDatasetResponse(
            success=True,
            restored_id=dataset_id,
            restored_name=dataset_name,
            message=(
                f"Restored dataset '{dataset_name}' (id={dataset_id}) from trash."
            ),
        )
    except DatasetForbiddenError:
        await ctx.warning("Permission denied restoring dataset id=%s" % (dataset_id,))
        return _forbidden(dataset_id, dataset_name)
    except DatasetLogicalDuplicateError:
        _rollback()
        return RestoreDatasetResponse(
            success=False,
            error=(
                f"Dataset '{dataset_name}' (id={dataset_id}) can't be "
                "restored: another active dataset already points at the "
                "same table. Delete or rename that one first."
            ),
            error_type="Conflict",
        )
    except DatasetNotFoundError:
        return RestoreDatasetResponse(
            success=False,
            error=f"Dataset id={dataset_id} is no longer restorable.",
            error_type="NotFound",
        )
    except (CommandException, SQLAlchemyError, ValueError) as ex:
        _rollback()
        await ctx.error("Dataset restore failed: %s: %s" % (type(ex).__name__, ex))
        return RestoreDatasetResponse(
            success=False,
            error=(
                "Dataset restore failed due to a database error."
                if isinstance(ex, SQLAlchemyError)
                else f"Dataset restore failed: {ex}"
            ),
            error_type=type(ex).__name__,
        )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    annotations=ToolAnnotations(
        title="Restore dataset",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def restore_dataset(
    request: RestoreDatasetRequest, ctx: Context
) -> RestoreDatasetResponse:
    """Restore a soft-deleted dataset from trash.

    Identify the dataset by numeric ID or UUID string, as list_trash returns
    it. Only datasets moved to trash can be restored; the caller must be an
    editor of the dataset or an Admin (workspace roles don't edit datasets).
    It keeps its workspace. A restore is refused when another active dataset
    already points at the same table.

    Example:
    ```json
    {"identifier": 42}
    ```

    When the caller lacks permission, ``permission_denied`` is true — do not
    retry; ask the user.
    """
    await ctx.info("Restoring dataset: identifier=%s" % (request.identifier,))

    try:
        dataset = _find_dataset_for_restore(request.identifier)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Dataset lookup failed during restore_dataset")
        return RestoreDatasetResponse(
            success=False,
            error="Dataset lookup failed due to a database error.",
            error_type="LookupFailed",
        )
    if not dataset:
        return _not_found(request.identifier)

    dataset_id = dataset.id

    # The lookup bypasses the access filters, so the restore audience is
    # checked before any response names the dataset: a dataset the caller
    # can't see answers as not found, as the web API does.
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    try:
        try:
            security_manager.raise_for_editorship(dataset)
        except SupersetSecurityException:
            if not _visible_to_caller(request.identifier, dataset_id):
                return _not_found(request.identifier)
            await ctx.warning(
                "Permission denied restoring dataset id=%s" % (dataset_id,)
            )
            return _forbidden(dataset_id)
    except SQLAlchemyError:
        _rollback()
        logger.exception("Editorship check failed during restore_dataset")
        return RestoreDatasetResponse(
            success=False,
            error="Dataset lookup failed due to a database error.",
            error_type="LookupFailed",
        )

    dataset_name = dataset.table_name
    if dataset.deleted_at is None:
        return RestoreDatasetResponse(
            success=False,
            error=(
                f"Dataset '{dataset_name}' (id={dataset_id}) is not in trash; "
                "nothing to restore."
            ),
            error_type="NotDeleted",
        )

    with event_logger.log_context(action="mcp.restore_dataset"):
        return await _run_restore(dataset, ctx)
