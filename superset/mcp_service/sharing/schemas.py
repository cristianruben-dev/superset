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
"""Schemas of the publish and share tools."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from superset.mcp_service.system.schemas import SubjectInfo


class DashboardRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard: int | str = Field(description="Dashboard id, uuid or slug")

    @field_validator("dashboard", mode="before")
    @classmethod
    def reject_bool(cls, value: object) -> object:
        """bool is a subclass of int: true would mean dashboard 1."""
        if isinstance(value, bool):
            raise ValueError("dashboard must be an id, uuid or slug")
        return value


class PublishDashboardRequest(DashboardRef):
    published: bool = Field(
        True, description="true publishes the report, false turns it into a draft"
    )


class SharingOutcome(BaseModel):
    dashboard_id: int | None = None
    title: str | None = None
    published: bool | None = None
    url: str | None = Field(None, description="The report's address")
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = Field(
        False, description="True when the caller may not do it: do not retry"
    )


class PublishDashboardResponse(SharingOutcome):
    changed: bool = Field(False, description="Whether the published state changed")


class ShareDashboardRequest(DashboardRef):
    page: int | str | None = Field(
        None,
        description="Page id, name or position from 1: the link opens on that "
        "page. Without it the link opens the report on its first page.",
    )


class WorkspaceRef(BaseModel):
    id: int
    name: str
    your_role: str = Field(description="viewer, contributor or admin")


class ShareDashboardResponse(SharingOutcome):
    link: str | None = Field(None, description="The link to send")
    permalink: str | None = Field(
        None, description="A permanent link to the page, when a page was given"
    )
    page: str | None = None
    audience: str | None = Field(None, description="Who can open the link")
    editors: list[SubjectInfo] = Field(default_factory=list)
    viewers: list[SubjectInfo] = Field(default_factory=list)
    workspace: WorkspaceRef | None = Field(
        None, description="The report's workspace, when you belong to it"
    )
    next_steps: list[str] = Field(
        default_factory=list, description="Tools that give more people access"
    )
