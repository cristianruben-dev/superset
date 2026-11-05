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
Helpers shared by the workspace tools.

The tools call the workspace operations of ``superset.auradata.workspaces``, the
same ones the REST API uses, and turn their errors into tool responses.
"""

from typing import Any, TypeVar

from superset.mcp_service.workspace.schemas import (
    WorkspaceDashboardItem,
    WorkspaceDatasetItem,
    WorkspaceInfo,
    WorkspaceOutcome,
    WorkspaceUser,
)

R = TypeVar("R", bound=WorkspaceOutcome)

ERROR_TYPES = {
    404: "NotFound",
    403: "Forbidden",
    422: "Conflict",
    400: "InvalidRequest",
}

DEFAULT_MESSAGES = {
    404: (
        "Not found, or not in a workspace you belong to. Use list_workspaces, "
        "list_dashboards or list_datasets to get valid IDs."
    ),
    403: (
        "Your role in this workspace does not allow it (do not retry; ask a "
        "workspace admin)."
    ),
}


def error_text(message: Any) -> str:
    """A readable text of an error message, which may hold field errors."""
    if not isinstance(message, dict):
        return str(message)
    parts = []
    for field, errors in message.items():
        text = " ".join(map(str, errors)) if isinstance(errors, list) else errors
        parts.append(f"{field}: {text}")
    return "; ".join(parts)


def error_response(response_cls: type[R], error: Any, **fields: Any) -> R:
    """The tool response of a ``WorkspaceError``."""
    status = getattr(error, "status", 400)
    message = getattr(error, "message", None)
    return response_cls(
        error=error_text(message) if message else DEFAULT_MESSAGES.get(status, ""),
        error_type=ERROR_TYPES.get(status, "InvalidRequest"),
        permission_denied=status == 403,
        **fields,
    )


def workspace_info(workspace: Any, role: str | None = None) -> WorkspaceInfo:
    """The workspace as the tools return it, with the current user's rights."""
    from superset.auradata.workspaces import serialize

    return WorkspaceInfo.model_validate(serialize(workspace, role))


def user_item(user: Any, role: str | None = None) -> WorkspaceUser:
    return WorkspaceUser(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        role=role,
    )


def dashboard_item(dashboard: Any) -> WorkspaceDashboardItem:
    from superset import security_manager

    return WorkspaceDashboardItem(
        id=dashboard.id,
        dashboard_title=dashboard.dashboard_title,
        url=dashboard.url,
        published=dashboard.published,
        can_edit=security_manager.can_edit_resource(dashboard),
    )


def dataset_item(dataset: Any) -> WorkspaceDatasetItem:
    from superset import security_manager

    return WorkspaceDatasetItem(
        id=dataset.id,
        table_name=dataset.table_name,
        schema_name=dataset.schema,
        database_name=dataset.database.database_name if dataset.database else None,
        can_edit=security_manager.can_edit_resource(dataset),
    )


def rollback() -> None:
    """Drop a failed transaction so the session stays usable."""
    from superset import db

    db.session.rollback()  # pylint: disable=consider-using-transaction
