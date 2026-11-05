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
"""Schemas of the design element and slicer tools."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from superset.mcp_service.report_layout.format_schemas import (
    _Request,
    _Write,
    MAX_IMAGE_BASE64,
)
from superset.mcp_service.report_layout.schemas import (
    _OBJECT,
    _OVERLAP,
    _PAGE,
    ObjectRef,
    PageRef,
)

ElementKind = Literal["image", "shape", "button", "text", "navigator"]

_SETTINGS = (
    "Element settings (get_format_options with element=<kind> lists them); "
    "objects merge key by key, null resets"
)
_GENERAL = "General box patch: title, background, border, radius, shadow, padding"
_IMAGE = "PNG, JPEG, GIF or WebP as base64, 2 MB at most; never an address"


class _Place(_Write):
    page: PageRef | None = Field(None, description=_PAGE)
    x: int | None = Field(None, ge=0, description="Cell column; free cell by default")
    y: int | None = Field(None, ge=0, description="Cell row; free cell by default")
    width: int | None = Field(None, ge=1, description="Cells")
    height: int | None = Field(None, ge=1, description="Cells")
    allow_overlap: bool = Field(False, description=_OVERLAP)


class AddElementRequest(_Place):
    kind: ElementKind
    settings: dict[str, Any] = Field(default_factory=dict, description=_SETTINGS)
    format: dict[str, Any] | None = Field(None, description=_GENERAL)
    image_base64: str | None = Field(
        None, max_length=MAX_IMAGE_BASE64, description=_IMAGE
    )


class UpdateElementRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    settings: dict[str, Any] = Field(default_factory=dict, description=_SETTINGS)
    image_base64: str | None = Field(
        None, max_length=MAX_IMAGE_BASE64, description=_IMAGE
    )


class FormatElementRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    patch: dict[str, Any] = Field(description=_GENERAL)


class RemoveElementRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    remove_filter: bool = Field(
        True, description="A slicer's native filter goes too, if nothing else shows it"
    )


class ElementResponse(BaseModel):
    dashboard_id: int | None = None
    changed: list[str] = Field(default_factory=list, description="Changed ids")
    object: str | None = Field(None, description="Id of the element")
    page: str | None = None
    element: dict[str, Any] | None = Field(None, description="Its settings")
    format: dict[str, Any] | None = Field(None, description="Its General format")
    filter_id: str | None = None
    filter: dict[str, Any] | None = Field(None, description="Native filter")
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False


SlicerVariant = Literal["dropdown", "list", "buttons", "input"]
SlicerSelection = Literal["multi", "single", "ctrl"]

_DEFAULT = (
    "Default: a list of values (list), [min, max] (range), or a time range "
    "such as 'Last month' (time); null clears it"
)


class _SlicerOptions(_Request):
    name: str | None = Field(None, min_length=1, description="Filter name")
    variant: SlicerVariant | None = Field(None, description="List filters only")
    range_style: Literal["between", "slider"] | None = None
    date_style: Literal["relative", "between"] | None = None
    selection: SlicerSelection | None = Field(
        None, description="single, multi or ctrl (one per click, more with Ctrl)"
    )
    apply_button: bool | None = Field(None, description="Wait for Apply")
    sort: Literal["asc", "desc"] | None = None
    hidden_values: list[Any] | None = Field(None, description="Values left out")
    show_in_filter_bar: bool | None = None
    default_value: Any = Field(None, description=_DEFAULT)


class AddSlicerRequest(_Place, _SlicerOptions):
    name: str = Field(min_length=1, description="Filter name")
    filter_type: Literal["list", "range", "time"] = Field(
        "list", description="list of values, numeric range, or time range"
    )
    dataset_id: int | None = Field(None, description="Dataset (list and range)")
    column: str | None = Field(None, description="Column (list and range)")
    scope: Literal["page", "report"] = Field(
        "report", description="Charts it filters: this page's or all"
    )
    settings: dict[str, Any] = Field(default_factory=dict, description=_SETTINGS)


class UpdateSlicerRequest(_Write, _SlicerOptions):
    object: ObjectRef = Field(description=_OBJECT)
    clear_default: bool = Field(False, description="Drop the default value")


class FormatSlicerRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    level: Literal["visual", "general"] = Field(
        description="visual: look of the slicer; general: its box"
    )
    patch: dict[str, Any] = Field(
        description="visual: slicer settings; general: " + _GENERAL
    )
