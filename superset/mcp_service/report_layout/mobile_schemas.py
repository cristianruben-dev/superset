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
"""Schemas of the mobile layout tools."""

from pydantic import BaseModel, Field

from superset.mcp_service.report_layout.format_schemas import _Write
from superset.mcp_service.report_layout.schemas import (
    _OBJECT,
    _PAGE,
    ObjectRef,
    PageRef,
)

_PHONE = "cells of 32 px on a phone page 12 cells wide"


class MobileBoxInput(BaseModel):
    """Where an object of the page goes on the phone page."""

    object: ObjectRef = Field(description=_OBJECT)
    x: int = Field(ge=0, le=11, description=f"Column, {_PHONE}")
    y: int = Field(ge=0, description="Row from the top, in cells")
    width: int = Field(ge=1, le=12, description="Width in cells, 12 at most")
    height: int = Field(ge=1, description="Height in cells")


class MobileBoxOutput(BaseModel):
    id: str
    x: int
    y: int
    width: int
    height: int


class GenerateMobileLayoutRequest(_Write):
    page: PageRef | None = Field(None, description=f"{_PAGE}; the first by default")
    apply: bool = Field(
        False,
        description="Save the proposal as the page's mobile layout (false: only "
        "return it)",
    )


class SetMobileLayoutRequest(_Write):
    page: PageRef | None = Field(None, description=f"{_PAGE}; the first by default")
    items: list[MobileBoxInput] = Field(
        min_length=1,
        description=f"Boxes back to front, in {_PHONE}. Objects left out do not "
        "show on phones",
    )


class ClearMobileLayoutRequest(_Write):
    page: PageRef | None = Field(None, description=f"{_PAGE}; the first by default")


class MobileLayoutResponse(BaseModel):
    dashboard_id: int | None = None
    page: str | None = None
    applied: bool = Field(False, description="Whether the layout was saved")
    items: list[MobileBoxOutput] = Field(
        default_factory=list,
        description=f"Boxes back to front, in {_PHONE}",
    )
    rows: int | None = Field(None, description="Height of the phone page in cells")
    left_out: list[str] = Field(
        default_factory=list, description="Objects of the page that phones skip"
    )
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False
