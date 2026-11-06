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
"""MCP tool: move_dataset_to_workspace"""

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.extensions import event_logger
from superset.mcp_service.workspace.schemas import (
    MoveDatasetToWorkspaceRequest,
    MoveToWorkspaceResponse,
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
        title="Move dataset to workspace",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def move_dataset_to_workspace(
    request: MoveDatasetToWorkspaceRequest, ctx: Context
) -> MoveToWorkspaceResponse:
    """Move a dataset into a workspace, or make it shared (workspace_id null).

    Entering needs a contributor or admin role in the workspace and real
    editorship of the dataset, and no dashboard outside the workspace may use
    it. Sharing needs that role in the workspace it leaves.
    """
    from superset.auradata import workspaces
    from superset.auradata.workspace_access import workspace_role
    from superset.auradata.workspace_datasets import dataset_workspace_id
    from superset.daos.dataset import DatasetDAO

    dataset_id = request.dataset_id
    target = request.workspace_id
    await ctx.info(
        "Moving dataset to workspace: dataset_id=%s, workspace_id=%s"
        % (dataset_id, target)
    )
    with event_logger.log_context(action="mcp.move_dataset_to_workspace"):
        try:
            if DatasetDAO.find_by_id(dataset_id) is None:
                raise workspaces.WorkspaceNotFoundError()
            current = dataset_workspace_id(dataset_id)
            if target is None:
                if current is None:
                    message = "The dataset is already shared."
                else:
                    workspaces.move_datasets(current, {"remove": [dataset_id]})
                    message = "The dataset is now shared."
            elif target == current:
                workspaces.find_workspace(target)
                message = "The dataset is already in this workspace."
            else:
                workspaces.move_datasets(target, {"add": [dataset_id]})
                message = "The dataset moved to the workspace."
            workspace = (
                workspace_info(workspaces.find_workspace(target)[0])
                if target is not None
                else None
            )
        except workspaces.WorkspaceError as error:
            rollback()
            return error_response(MoveToWorkspaceResponse, error)
    return MoveToWorkspaceResponse(
        success=True,
        # Workspaces the user does not belong to stay private
        previous_workspace_id=current
        if current is not None and workspace_role(current)
        else None,
        workspace=workspace,
        message=message,
    )
