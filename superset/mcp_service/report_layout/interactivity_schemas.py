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
"""Schemas of the report interactivity tools."""

from typing import Any, Literal

from pydantic import BaseModel, Field

from superset.mcp_service.report_layout.format_schemas import _Write
from superset.mcp_service.report_layout.schemas import (
    _OBJECT,
    _PAGE,
    ObjectRef,
    PageRef,
)

_SELECTIONS = (
    "Filter values by filter id or name: a list of values for list filters, "
    "[min, max] for ranges, a time range ('Last month') for time filters; "
    "null clears the filter"
)
_BOOKMARK = "Bookmark id or name (list_bookmarks lists them)"
_COLUMNS = "Dataset columns of the report's charts"


class BookmarkOptionsPatch(BaseModel):
    data: bool | None = Field(None, description="Bring back filter selections")
    display: bool | None = Field(None, description="Bring back shown/hidden objects")
    page: bool | None = Field(None, description="Bring back its page")


class SetFilterBarAutoApplyRequest(_Write):
    auto_apply: bool = Field(
        description="Filters apply as soon as they change (true) or on Apply (false)"
    )


class ListBookmarksRequest(_Write):
    pass


class CreateBookmarkRequest(_Write):
    name: str = Field(min_length=1, max_length=200)
    page: PageRef | None = Field(
        None, description=f"{_PAGE}; the first page by default"
    )
    filters: dict[str, Any] = Field(
        default_factory=dict,
        description=f"{_SELECTIONS}. Others keep their default values",
    )
    hidden: list[ObjectRef] = Field(
        default_factory=list, description="Objects the bookmark hides"
    )
    shown: list[ObjectRef] = Field(
        default_factory=list, description="Objects the bookmark shows"
    )
    options: BookmarkOptionsPatch | None = Field(
        None, description="What it brings back; everything by default"
    )


class UpdateBookmarkRequest(_Write):
    bookmark: str = Field(description=_BOOKMARK)
    name: str | None = Field(None, min_length=1, max_length=200)
    page: PageRef | None = Field(None, description=_PAGE)
    filters: dict[str, Any] | None = Field(
        None, description=f"{_SELECTIONS}. Merged over the saved selections"
    )
    reset_filters: bool = Field(
        False, description="Start the selections again from the filter defaults"
    )
    hidden: list[ObjectRef] = Field(default_factory=list)
    shown: list[ObjectRef] = Field(default_factory=list)
    options: BookmarkOptionsPatch | None = None
    position: int | None = Field(
        None, ge=1, description="New place in the bookmark list, from 1"
    )


class DeleteBookmarkRequest(_Write):
    bookmark: str = Field(description=_BOOKMARK)


class SetDrillthroughPageRequest(_Write):
    page: PageRef = Field(description=_PAGE)
    columns: list[str] = Field(
        min_length=1,
        description=f"{_COLUMNS} a data point passes to this page when drilled",
    )


class ClearDrillthroughPageRequest(_Write):
    page: PageRef = Field(description=_PAGE)


class VisualInteraction(BaseModel):
    target: ObjectRef = Field(description="Chart the source's cross-filters reach")
    mode: Literal["filter", "none"]


class SetVisualInteractionsRequest(_Write):
    source: ObjectRef = Field(
        description=f"Chart whose cross-filters change; {_OBJECT}"
    )
    interactions: list[VisualInteraction] = Field(min_length=1)


class SyncSlicerRequest(_Write):
    object: ObjectRef = Field(description="The slicer (canvas filter element)")
    filter_pages: list[PageRef] | None = Field(
        None, description="Pages whose charts the slicer filters (all = the report)"
    )
    visible_pages: list[PageRef] | None = Field(
        None,
        description="Pages that show the slicer; copies come and go, its own "
        "page always keeps it",
    )


class MakeTooltipPageRequest(_Write):
    page: PageRef = Field(description=_PAGE)
    enabled: bool = Field(True, description="false makes it a normal page again")
    width: int | None = Field(
        None, ge=4, le=30, description="Tooltip width in cells (10 by default)"
    )
    height: int | None = Field(
        None, ge=2, le=24, description="Tooltip height in cells (8 by default)"
    )
    columns: list[str] | None = Field(
        None, description=f"{_COLUMNS} it is made for; Auto charts match on them"
    )


class SetVisualTooltipRequest(_Write):
    object: ObjectRef = Field(description=f"A chart; {_OBJECT}")
    mode: Literal["default", "auto", "page"] = Field(
        description="default: the chart's own tooltip; auto: the tooltip page "
        "with its fields; page: the given tooltip page"
    )
    page: PageRef | None = Field(None, description="Tooltip page for mode page")


class GetFilterDefaultsRequest(_Write):
    pass


class InteractivityResponse(BaseModel):
    dashboard_id: int | None = None
    changed: list[str] = Field(default_factory=list, description="Changed ids")
    page: str | None = None
    bookmark: dict[str, Any] | None = None
    bookmarks: list[dict[str, Any]] | None = None
    filter: dict[str, Any] | None = None
    interactions: dict[str, str] | None = Field(
        None, description="Target chart id -> filter or none"
    )
    drillthrough_columns: list[str] | None = None
    tooltip_page: dict[str, Any] | None = None
    filter_bar_auto_apply: bool | None = None
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False


class FilterDefault(BaseModel):
    id: str
    name: str | None = None
    type: str | None = None
    level: str = Field(description="Filter bar section: report, page or visual")
    column: str | None = None
    default: Any = Field(None, description="Value a reset brings back; null: none")
    default_filters: list[dict[str, Any]] = Field(
        default_factory=list, description="Query filters the default applies"
    )


class FilterDefaultsResponse(BaseModel):
    dashboard_id: int | None = None
    filters: list[FilterDefault] = Field(default_factory=list)
    cross_filters: str = Field(
        "cleared", description="Reset filters clears every cross-filter"
    )
    filter_bar_auto_apply: bool | None = None
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False
