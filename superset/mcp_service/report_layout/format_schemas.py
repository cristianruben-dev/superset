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
"""Schemas of the format tools."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from superset.mcp_service.report_layout.schemas import (
    _DASHBOARD,
    _OBJECT,
    DashboardRef,
    ObjectRef,
)

FormatLevel = Literal["visual", "general", "analytics"]

# 2 MB of picture is about 2.7 million base64 characters
MAX_IMAGE_BASE64 = 2_800_000


class _Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Write(_Request):
    dashboard: DashboardRef = Field(description=_DASHBOARD)


class GetFormatOptionsRequest(_Request):
    viz_type: str | None = Field(
        None, description="Chart type (e.g. echarts_timeseries_bar)"
    )
    dashboard: DashboardRef | None = Field(
        None, description="With object: read the chart type of that chart"
    )
    object: ObjectRef | None = Field(None, description=_OBJECT)
    level: FormatLevel | None = Field(None, description="One level; all by default")
    section: str | None = Field(None, description="Only this section id")
    descriptions: bool = Field(
        False, description="Include control descriptions (with section)"
    )
    element: (
        Literal["image", "shape", "button", "text", "navigator", "filter"] | None
    ) = Field(None, description="Settings of a design element or slicer (filter)")


class FormatOptionsResponse(BaseModel):
    viz_type: str | None = None
    level: str | None = None
    sections: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Visual and Analytics sections with their controls",
    )
    general: dict[str, Any] | None = Field(
        None, description="General settings, the same for every object"
    )
    element: dict[str, Any] | None = Field(
        None, description="Settings and defaults of a kind of element"
    )
    shapes: dict[str, Any] = Field(
        default_factory=dict,
        description="Value shape of json controls, by their control component",
    )
    notes: list[str] = Field(default_factory=list)
    chart_types: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None


class FormatVisualRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    level: FormatLevel = Field(description="Level of the Format pane")
    patch: dict[str, Any] = Field(
        description=(
            "Settings by key (get_format_options); null resets one. General "
            "objects merge key by key; chart settings replace their value"
        )
    )


class FormatResponse(BaseModel):
    dashboard_id: int | None = None
    changed: list[str] = Field(default_factory=list, description="Changed ids")
    formats: dict[str, Any] = Field(
        default_factory=dict,
        description="Resolved format (shared style plus own) of each object",
    )
    canvas: dict[str, Any] | None = None
    url: str | None = None
    image_id: int | None = None
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False


class CanvasSizeInput(_Request):
    mode: Literal["16:9", "4:3", "letter", "custom"]
    width: int | None = Field(None, ge=10, le=128, description="Cells, for custom")
    height: int | None = Field(None, ge=10, le=128, description="Cells, for custom")


class CanvasBackgroundInput(_Request):
    type: Literal["none", "color", "gradient", "image"]
    color: str | None = None
    color2: str | None = Field(None, description="Second gradient color")
    angle: float | None = Field(None, description="Gradient angle in degrees")
    image: str | None = Field(None, description="Path of this site; upload first")
    fit: Literal["cover", "contain", "repeat"] | None = None
    opacity: float | None = Field(None, ge=0, le=100)


class AreaStyleInput(_Request):
    background: str | None = None
    text: str | None = None
    accent: str | None = None


class SetCanvasFormatRequest(_Write):
    size: CanvasSizeInput | None = Field(
        None, description="Page size; objects are fitted inside a smaller page"
    )
    background: CanvasBackgroundInput | None = None
    filter_bar: AreaStyleInput | None = Field(None, description="Filter pane colors")
    tabs: AreaStyleInput | None = Field(None, description="Page bar colors")


class SetSharedVisualFormatRequest(_Write):
    from_object: ObjectRef | None = Field(
        None, description="Share this chart's format, as 'Apply to all charts'"
    )
    patch: dict[str, Any] | None = Field(
        None,
        description=(
            "General settings to change in the shared style; chart settings "
            "go under 'chart'. null resets one"
        ),
    )
    reset_charts: bool = Field(
        True,
        description=(
            "Charts drop their own style (keeping titles, subtitles, links and "
            "their own chart settings), as the pane does"
        ),
    )


class CopyFormatRequest(_Write):
    source: ObjectRef = Field(description="Object whose format to copy")
    targets: list[ObjectRef] = Field(min_length=1, max_length=100)


class SetDashboardCssRequest(_Write):
    css: str = Field(max_length=100_000, description="CSS; empty clears it")


class UploadImageRequest(_Write):
    image_base64: str = Field(
        max_length=MAX_IMAGE_BASE64,
        description="PNG, JPEG, GIF or WebP, 2 MB at most, as base64",
    )


class UploadBackgroundRequest(UploadImageRequest):
    fit: Literal["cover", "contain", "repeat"] = "cover"
    opacity: float | None = Field(None, ge=0, le=100)


class UploadElementImageRequest(UploadImageRequest):
    object: ObjectRef | None = Field(
        None, description="An image element to show it; otherwise only uploaded"
    )
