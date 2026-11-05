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
"""Schemas of the report structure, page and object tools."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

DashboardRef = int | str
PageRef = int | str
ObjectRef = int | str

_DASHBOARD = "Dashboard id, uuid or slug"
_PAGE = "Page id, name or position from 1 (get_report_structure lists them)"
_OBJECT = "Object id from get_report_structure, or a chart id"
_OVERLAP = "Allow the object to cover others (off by default)"


class CellBox(BaseModel):
    """Where an object sits on its page, in cells of 32 px from the top left."""

    x: int
    y: int
    width: int
    height: int


class ReportObject(BaseModel):
    id: str
    kind: str = Field(
        description="chart, text_box, slicer, image, shape, button, text, navigator"
    )
    title: str | None = None
    chart_id: int | None = None
    filter_id: str | None = None
    box: CellBox
    layer: int = Field(description="Stack place on its page, 1 at the back")
    hidden: bool = False
    locked: bool = False
    alt_text: str | None = None
    tooltip_page: dict[str, Any] | None = Field(
        None, description="A chart's tooltip: type default or page, and the page"
    )
    format: dict[str, Any] | None = Field(
        None, description="Resolved format: the shared style plus its own"
    )


class PageSummary(BaseModel):
    id: str
    name: str
    index: int
    hidden: bool
    shown_to_viewers: bool
    tooltip_page: dict[str, Any] | None = None
    drillthrough_columns: list[str] | None = None
    has_mobile_layout: bool = False
    objects: list[ReportObject]


class CanvasSummary(BaseModel):
    width: int = Field(description="Page width in cells")
    height: int = Field(description="Page height in cells")
    size_mode: str
    background: dict[str, Any] | None = None
    shared_visual_format: dict[str, Any] | None = None


class FilterSummary(BaseModel):
    id: str
    name: str | None = None
    filter_type: str | None = None
    columns: list[str] = Field(default_factory=list)
    dataset_ids: list[int] = Field(default_factory=list)
    scope_pages: list[str] = Field(default_factory=list)
    excluded_charts: list[int] = Field(default_factory=list)
    level: str | None = Field(
        None, description="Filter bar section: report, page or visual"
    )


class BookmarkSummary(BaseModel):
    id: str
    name: str | None = None
    page: str | None = None
    options: dict[str, Any] | None = None
    filter_ids: list[str] = Field(default_factory=list)
    hidden: list[str] = Field(default_factory=list, description="Objects it hides")


class ReportStructure(BaseModel):
    dashboard_id: int
    dashboard_title: str | None = None
    url: str
    canvas: CanvasSummary
    pages: list[PageSummary]
    filters: list[FilterSummary]
    bookmarks: list[BookmarkSummary]
    filter_bar_auto_apply: bool = Field(
        True, description="Filters apply at once (false: on Apply)"
    )
    interactions: dict[str, list[int]] = Field(
        default_factory=dict,
        description="Charts each chart's cross-filters leave alone, by chart id",
    )
    warnings: list[str] = Field(default_factory=list)


class ReportError(BaseModel):
    error: str
    error_type: str
    permission_denied: bool = False


class GetReportStructureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard: DashboardRef = Field(description=_DASHBOARD)
    include_format: bool = Field(
        True, description="Include each object's resolved format"
    )


class LayoutChangeResponse(BaseModel):
    """What a page or object write changed."""

    dashboard_id: int | None = None
    changed: list[str] = Field(default_factory=list, description="Changed ids")
    page: str | None = Field(None, description="Page the change happened on")
    boxes: dict[str, CellBox] = Field(
        default_factory=dict, description="New boxes of the moved objects"
    )
    skipped_locked: list[str] = Field(default_factory=list)
    removed_chart_ids: list[int] = Field(default_factory=list)
    created_chart_ids: list[int] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False


class _Write(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dashboard: DashboardRef = Field(description=_DASHBOARD)


class AddPageRequest(_Write):
    name: str | None = Field(None, description="Page name; 'Página N' by default")
    position: int | None = Field(
        None, ge=1, description="Place from 1 among the pages; last by default"
    )


class RenamePageRequest(_Write):
    page: PageRef = Field(description=_PAGE)
    name: str = Field(min_length=1, max_length=200)


class ReorderPagesRequest(_Write):
    order: list[PageRef] = Field(min_length=1, description="Every page, new order")


class DuplicatePageRequest(_Write):
    page: PageRef = Field(description=_PAGE)
    name: str | None = Field(None, description="Name of the copy")


class DeletePageRequest(_Write):
    page: PageRef = Field(description=_PAGE)


class SetPageHiddenRequest(_Write):
    page: PageRef = Field(description=_PAGE)
    hidden: bool = Field(description="Hide the page from viewers' tabs")


class PlaceObjectRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    page: PageRef | None = Field(
        None, description="Page to move it to; its own page by default"
    )
    x: int | None = Field(None, ge=0, description="Column cell; first free if unset")
    y: int | None = Field(None, ge=0, description="Row cell; first free if unset")
    width: int | None = Field(None, ge=1, description="Width in cells")
    height: int | None = Field(None, ge=1, description="Height in cells")
    allow_overlap: bool = Field(False, description=_OVERLAP)


class MoveObjectRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    x: int | None = Field(None, ge=0, description="New column cell")
    y: int | None = Field(None, ge=0, description="New row cell")
    dx: int = Field(0, description="Cells to move right (negative: left)")
    dy: int = Field(0, description="Cells to move down (negative: up)")
    allow_overlap: bool = Field(False, description=_OVERLAP)


class ResizeObjectRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    width: int | None = Field(None, ge=1, description="Width in cells")
    height: int | None = Field(None, ge=1, description="Height in cells")
    allow_overlap: bool = Field(False, description=_OVERLAP)


class AlignObjectsRequest(_Write):
    objects: list[ObjectRef] = Field(min_length=2, description="Objects of a page")
    mode: Literal["left", "center", "right", "top", "middle", "bottom"]
    allow_overlap: bool = Field(False, description=_OVERLAP)


class DistributeObjectsRequest(_Write):
    objects: list[ObjectRef] = Field(min_length=3, description="Objects of a page")
    axis: Literal["horizontal", "vertical"]
    allow_overlap: bool = Field(False, description=_OVERLAP)


class BringToFrontRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    move: Literal["front", "back", "forward", "backward"] = "front"


class SetObjectStateRequest(_Write):
    object: ObjectRef = Field(description=_OBJECT)
    hidden: bool | None = Field(None, description="Hide it from viewers")
    locked: bool | None = Field(None, description="Keep it from moving")
    alt_text: str | None = Field(
        None, max_length=1000, description="Screen reader text; empty clears it"
    )
