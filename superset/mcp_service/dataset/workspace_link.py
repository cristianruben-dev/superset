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
A dataset created by the MCP inside a workspace, as the web's ``linkNewDataset``
does from a dashboard's side panel: the dataset is created, then moved into the
workspace with ``move_datasets``, the operation of the workspace API.

The caller's role is checked before anything is created, so a refused request
leaves no dataset behind (a deleted one would stay in the trash and block its
name).
"""

from __future__ import annotations

from superset import security_manager
from superset.utils.core import get_user_id


def workspace_refusal(
    workspace_id: int, editors: list[int] | None = None
) -> str | None:
    """
    Why the current user cannot create a dataset in this workspace, or None.

    :param workspace_id: The workspace the dataset joins
    :param editors: The editors requested for the dataset; moving it into the
        workspace needs its creator to be one of them
    """
    from superset.auradata.models import ROLE_CONTRIBUTOR
    from superset.auradata.workspaces import find_workspace, WorkspaceError
    from superset.mcp_service.workspace.utils import DEFAULT_MESSAGES, error_text

    try:
        find_workspace(workspace_id, ROLE_CONTRIBUTOR)
    except WorkspaceError as error:
        if error.status == 403:
            return (
                "Only contributors and admins of a workspace add datasets to "
                "it; your role there does not allow it."
            )
        message = getattr(error, "message", None)
        return error_text(message) if message else DEFAULT_MESSAGES[404]
    if (
        editors is not None
        and not security_manager.is_admin()
        and get_user_id() not in editors
    ):
        return (
            "To create a dataset in a workspace you must be one of its editors: "
            "add your own user ID to editors, or leave editors out."
        )
    return None


def link_to_workspace(dataset_id: int, workspace_id: int) -> str | None:
    """
    Move a dataset just created into the workspace; the reason it stays shared
    when that fails, or None.
    """
    from superset import db
    from superset.auradata.workspaces import move_datasets, WorkspaceError
    from superset.mcp_service.workspace.utils import error_text

    try:
        move_datasets(workspace_id, {"add": [dataset_id]})
    except WorkspaceError as error:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        reason = error_text(getattr(error, "message", None) or "")
        return (
            f"Dataset {dataset_id} was created but stays shared, outside the "
            f"workspace{': ' + reason if reason else ''}. Move it with "
            "move_dataset_to_workspace."
        )
    return None
