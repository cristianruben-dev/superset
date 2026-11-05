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
"""Requests and responses of the trash and version history tools."""

from typing import Any, Literal

from pydantic import BaseModel, Field

EntityType = Literal["dashboard", "chart", "dataset"]


class HistoryOutcome(BaseModel):
    """Error fields shared by every trash and history tool response."""

    error: str | None = Field(None, description="Why the call failed")
    error_type: str | None = Field(
        None, description="NotFound, Forbidden, InvalidRequest or Conflict"
    )
    permission_denied: bool = Field(
        False, description="True when the role does not allow it (do not retry)"
    )


class ListTrashRequest(BaseModel):
    workspace_id: int | None = Field(
        None,
        description=(
            "Workspace whose deleted dashboards to list (contributors and admins "
            "of it). Omit for the whole trash: everything for Superset admins, "
            "what they edit for others"
        ),
    )
    entity_types: list[EntityType] | None = Field(
        None, description="Without workspace_id: kinds to list (default all)"
    )
    limit: int = Field(50, ge=1, le=200, description="Most per kind")


class TrashItem(BaseModel):
    entity_type: EntityType
    id: int
    uuid: str
    name: str
    deleted_at: str | None = None
    blocked_by: str | None = Field(
        None, description="Why it can't be restored (charts now elsewhere)"
    )
    restore_tool: str | None = Field(
        None, description="Tool that restores it; None: restore it in the web"
    )


class ListTrashResponse(HistoryOutcome):
    workspace_id: int | None = None
    items: list[TrashItem] = Field(default_factory=list)


class EntityRef(BaseModel):
    entity_type: EntityType
    identifier: int | str = Field(..., description="ID or UUID")


class ListVersionsRequest(EntityRef):
    limit: int = Field(50, ge=1, le=500, description="Newest versions to return")


class VersionAuthor(BaseModel):
    id: int | None = None
    name: str | None = None


class VersionItem(BaseModel):
    version_uuid: str
    version_number: int = Field(..., description="0 is the oldest")
    operation_type: str = Field(..., description="baseline, update or delete")
    issued_at: str | None = None
    changed_by: VersionAuthor | None = None
    change_count: int = 0
    change_kinds: list[str] = Field(default_factory=list)


class ListVersionsResponse(HistoryOutcome):
    entity_type: EntityType | None = None
    entity_id: int | None = None
    entity_uuid: str | None = None
    total_count: int = 0
    current_version_number: int | None = None
    versions: list[VersionItem] = Field(
        default_factory=list, description="Newest first"
    )


class VersionRef(EntityRef):
    version_uuid: str | None = Field(None, description="From list_versions")
    version_number: int | None = Field(None, description="Or its number")


class VersionChange(BaseModel):
    kind: str | None = None
    operation: str | None = None
    path: Any = None
    from_value: Any = None
    to_value: Any = None


class GetVersionDiffResponse(HistoryOutcome):
    entity_type: EntityType | None = None
    entity_id: int | None = None
    version: VersionItem | None = None
    changes: list[VersionChange] = Field(
        default_factory=list, description="What this save changed"
    )


class RestoreVersionResponse(HistoryOutcome):
    success: bool = False
    entity_type: EntityType | None = None
    entity_id: int | None = None
    restored_version_number: int | None = None
    message: str | None = None
    skipped_chart_ids: list[int] = Field(
        default_factory=list, description="Charts of the version that no longer exist"
    )
