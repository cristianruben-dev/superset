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
"""Pydantic schemas of the AuraData BI workspace tools."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

WorkspaceRole = Literal["viewer", "contributor", "admin"]


class WorkspaceOutcome(BaseModel):
    """Error fields shared by every workspace tool response."""

    error: str | None = Field(None, description="Why the call failed")
    error_type: str | None = Field(
        None, description="NotFound, Forbidden, InvalidRequest or Conflict"
    )
    permission_denied: bool = Field(
        False, description="True when the role does not allow it (do not retry)"
    )


class WorkspaceInfo(BaseModel):
    """A workspace and the current user's rights in it."""

    model_config = ConfigDict(extra="ignore")

    id: int
    uuid: str | None = None
    name: str
    description: str | None = None
    color: str | None = None
    role: WorkspaceRole | None = Field(None, description="Current user's role")
    can_edit: bool = Field(False, description="Admin of the workspace")
    can_contribute: bool = Field(
        False, description="Contributor or admin: edits its dashboards"
    )
    dashboard_ids: list[int] = Field(default_factory=list)
    dashboard_count: int = 0
    dataset_count: int = 0
    member_count: int = 0
    changed_on: str | None = None


class WorkspaceRef(BaseModel):
    """A workspace by name, with the current user's role there."""

    id: int
    name: str
    color: str | None = None
    role: WorkspaceRole | None = None


class WorkspaceDashboardItem(BaseModel):
    """A dashboard of a workspace."""

    id: int
    dashboard_title: str | None = None
    url: str | None = None
    published: bool | None = None
    can_edit: bool = False


class WorkspaceDatasetItem(BaseModel):
    """A dataset of a workspace."""

    id: int
    table_name: str | None = None
    schema_name: str | None = Field(None, description="Schema of the table")
    database_name: str | None = None
    can_edit: bool = False


class WorkspaceUser(BaseModel):
    """A user, as a member or a member candidate."""

    id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    role: WorkspaceRole | None = Field(None, description="Role in the workspace")


class ListWorkspacesRequest(BaseModel):
    """Optional name search."""

    search: str | None = Field(None, description="Text the name contains")


class ListWorkspacesResponse(WorkspaceOutcome):
    workspaces: list[WorkspaceInfo] = Field(default_factory=list)
    count: int = 0


class WorkspaceIdRequest(BaseModel):
    workspace_id: int = Field(..., description="Workspace ID")


class GetWorkspaceResponse(WorkspaceOutcome):
    workspace: WorkspaceInfo | None = None
    dashboards: list[WorkspaceDashboardItem] = Field(default_factory=list)
    datasets: list[WorkspaceDatasetItem] = Field(default_factory=list)


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(..., description="Name (1-250 characters)")
    description: str | None = Field(None, description="Up to 1000 characters")
    color: str | None = Field(None, description="Hex color like #2563EB")


class UpdateWorkspaceRequest(BaseModel):
    """Only the fields given change."""

    workspace_id: int = Field(..., description="Workspace ID")
    name: str | None = None
    description: str | None = None
    color: str | None = Field(None, description="Hex color like #2563EB")


class WorkspaceWriteResponse(WorkspaceOutcome):
    success: bool = False
    workspace: WorkspaceInfo | None = None


class DeleteWorkspaceResponse(WorkspaceOutcome):
    success: bool = False
    deleted_id: int | None = None
    deleted_name: str | None = None


class ListWorkspaceMembersResponse(WorkspaceOutcome):
    members: list[WorkspaceUser] = Field(default_factory=list)


class SetWorkspaceMemberRequest(BaseModel):
    workspace_id: int = Field(..., description="Workspace ID")
    user_id: int = Field(..., description="User ID (see list_member_candidates)")
    role: WorkspaceRole = Field(..., description="viewer, contributor or admin")


class SetWorkspaceMemberResponse(WorkspaceOutcome):
    success: bool = False
    member: WorkspaceUser | None = None
    workspace: WorkspaceInfo | None = None


class RemoveWorkspaceMemberRequest(BaseModel):
    workspace_id: int = Field(..., description="Workspace ID")
    user_id: int = Field(..., description="Member to remove (yourself to leave)")


class RemoveWorkspaceMemberResponse(WorkspaceOutcome):
    success: bool = False
    removed_user_id: int | None = None
    left_workspace: bool = Field(False, description="True when you removed yourself")


class ListMemberCandidatesRequest(BaseModel):
    workspace_id: int = Field(..., description="Workspace ID")
    search: str | None = Field(None, description="Name, username or email text")


class ListMemberCandidatesResponse(WorkspaceOutcome):
    candidates: list[WorkspaceUser] = Field(default_factory=list)


class MoveDashboardToWorkspaceRequest(BaseModel):
    dashboard_id: int = Field(..., description="Dashboard ID")
    workspace_id: int | None = Field(
        None, description="Target workspace; null takes it out of any workspace"
    )


class MoveDatasetToWorkspaceRequest(BaseModel):
    dataset_id: int = Field(..., description="Dataset ID")
    workspace_id: int | None = Field(
        None, description="Target workspace; null makes it shared"
    )


class MoveToWorkspaceResponse(WorkspaceOutcome):
    success: bool = False
    previous_workspace_id: int | None = None
    workspace: WorkspaceInfo | None = Field(
        None, description="The target workspace; null when moved out"
    )
    message: str | None = None


class GetWorkspaceOfDashboardRequest(BaseModel):
    dashboard_id: int = Field(..., description="Dashboard ID")


class GetWorkspaceOfDashboardResponse(WorkspaceOutcome):
    dashboard_id: int | None = None
    workspace_ref: WorkspaceRef | None = Field(
        None,
        description="Null when the dashboard has no workspace or yours do not hold it",
    )
