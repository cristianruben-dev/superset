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
"""Schemas of the report screenshot tools."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GetDashboardScreenshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard: int | str = Field(description="Dashboard id, uuid or slug")
    page: int | str | None = Field(
        None, description="Page id, name or position from 1; the first by default"
    )
    device: Literal["desktop", "phone"] = Field(
        "desktop",
        description="phone: a 393 pt wide screen, as a phone viewer sees the page "
        "(its mobile layout, or the canvas scaled to the width)",
    )


class GetVisualScreenshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard: int | str = Field(description="Dashboard id, uuid or slug")
    object: int | str = Field(
        description="Chart object id from get_report_structure, or a chart id"
    )


class ScreenshotResponse(BaseModel):
    """What the picture shows; the picture itself comes as image content."""

    dashboard_id: int | None = None
    page: str | None = None
    object: str | None = None
    device: str | None = None
    mobile_layout: bool | None = Field(
        None, description="phone: whether the page showed its mobile layout"
    )
    url: str | None = None
    width: int | None = Field(None, description="Picture width in pixels")
    height: int | None = Field(None, description="Picture height in pixels")
    mime_type: str | None = None
    error: str | None = None
    error_type: str | None = None
