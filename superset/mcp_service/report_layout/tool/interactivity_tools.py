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
"""
Report interactivity tools, as in Power BI: filters that apply at once,
bookmarks, drill through pages, "Edit interactions", "Sync slicers", tooltip
pages and the defaults "Reset filters" brings back. Every change goes through
the layout library and the dashboard update command, so it lands in the
version history; users who may not edit the report are refused.
"""

from typing import Any, Callable, TypeVar

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import keys, page_ids
from superset.auradata.layout.interactivity import (
    bookmarks_of,
    filter_scope_level,
    interaction_mode,
    new_bookmark_id,
    tooltip_pages,
    top_level_pages,
)
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    meta_of,
    open_report,
    page_of_object,
    Report,
    resolve_page,
    save_report,
)
from superset.mcp_service.report_layout.interactivity import (
    auto_apply_of,
    bookmark_filters,
    bookmark_users,
    bookmark_view,
    bookmark_visibility,
    chart_object,
    check_columns,
    clipped_objects,
    copy_slicer,
    dashboard_metadata,
    find_bookmark,
    metadata_fields,
    native_filters,
    remove_component,
    report_page,
    resolve_pages,
    save_bookmarks,
    scoped,
    set_interactions,
    slicers_of,
)
from superset.mcp_service.report_layout.interactivity_schemas import (
    ClearDrillthroughPageRequest,
    CreateBookmarkRequest,
    DeleteBookmarkRequest,
    FilterDefault,
    FilterDefaultsResponse,
    GetFilterDefaultsRequest,
    InteractivityResponse,
    ListBookmarksRequest,
    MakeTooltipPageRequest,
    SetDrillthroughPageRequest,
    SetFilterBarAutoApplyRequest,
    SetVisualInteractionsRequest,
    SetVisualTooltipRequest,
    SyncSlicerRequest,
    UpdateBookmarkRequest,
)

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout", "interactivity"],
    "class_permission_name": "Dashboard",
    "method_permission_name": "write",
}
_READ: dict[str, Any] = {
    "tags": ["core", "layout", "interactivity"],
    "class_permission_name": "Dashboard",
}

Response = TypeVar("Response", InteractivityResponse, FilterDefaultsResponse)


def _annotations(
    title: str, read_only: bool = False, destructive: bool = False
) -> ToolAnnotations:
    if read_only:
        return ToolAnnotations(
            title=title,
            readOnlyHint=True,
            destructiveHint=False,
            openWorldHint=False,
        )
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=False,
        openWorldHint=False,
    )


async def _run(
    name: str,
    ctx: Context,
    change: Callable[[], Response],
    response: type[Response] = InteractivityResponse,  # type: ignore[assignment]
) -> Response:
    """Run a change, turning refusals into an error response."""
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return response(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
    await ctx.info(f"{name}: done")
    return result


# Filter bar


@tool(**_WRITE, annotations=_annotations("Set whether filters apply at once"))
async def set_filter_bar_auto_apply(
    request: SetFilterBarAutoApplyRequest, ctx: Context
) -> InteractivityResponse:
    """
    Choose whether the filters of a report apply as soon as a viewer changes
    them (true, the default of AuraData BI) or wait for the Apply button of
    the filter bar (false). Filter levels (all pages, this page, visuals) are
    set with manage_native_filters (scope_level, scope_pages).
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        save_report(
            report,
            fields=metadata_fields(
                report, {"filter_bar_auto_apply": request.auto_apply}
            ),
        )
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=["filter_bar_auto_apply"],
            filter_bar_auto_apply=request.auto_apply,
        )

    return await _run("set_filter_bar_auto_apply", ctx, change)


@tool(**_READ, annotations=_annotations("Get the filter defaults", read_only=True))
async def get_filter_defaults(
    request: GetFilterDefaultsRequest, ctx: Context
) -> FilterDefaultsResponse:
    """
    The values "Reset filters" brings a report back to: each filter and
    slicer with its default value (null: none), its filter bar level and the
    query filters the default applies. Reset also clears every cross-filter,
    leaves a drill through and drops what bookmarks showed or hid.
    """

    def read() -> FilterDefaultsResponse:
        report = open_report(request.dashboard)
        defaults = []
        for conf in native_filters(report.dashboard):
            if "defaultDataMask" not in conf:
                continue
            mask = conf.get("defaultDataMask") or {}
            target = (conf.get("targets") or [{}])[0] or {}
            defaults.append(
                FilterDefault(
                    id=conf["id"],
                    name=conf.get("name"),
                    type=conf.get("filterType"),
                    level=filter_scope_level(conf),
                    column=(target.get("column") or {}).get("name"),
                    default=(mask.get("filterState") or {}).get("value"),
                    default_filters=(mask.get("extraFormData") or {}).get("filters")
                    or [],
                )
            )
        return FilterDefaultsResponse(
            dashboard_id=report.dashboard.id,
            filters=defaults,
            filter_bar_auto_apply=auto_apply_of(dashboard_metadata(report.dashboard)),
        )

    return await _run("get_filter_defaults", ctx, read, FilterDefaultsResponse)


# Bookmarks


def _bookmark_page(report: Report, page: Any) -> str | None:
    """The page a bookmark opens: a top level tab, none in a one-page report."""
    if not top_level_pages(report.layout):
        if page is not None and resolve_page(report, page) != keys.GRID_ID:
            raise LayoutEditError(f"Page not found: {page!r}.", "NotFound")
        return None
    return resolve_page(report, page)


def _options(current: dict[str, Any] | None, patch: Any) -> dict[str, bool]:
    options = {"data": True, "display": True, "page": True, **(current or {})}
    if patch is not None:
        options.update({k: v for k, v in patch.model_dump().items() if v is not None})
    return options


@tool(**_READ, annotations=_annotations("List the bookmarks", read_only=True))
async def list_bookmarks(
    request: ListBookmarksRequest, ctx: Context
) -> InteractivityResponse:
    """
    The bookmarks of a report, in order: name, page, what each brings back
    (options), its filter selections and the objects it hides.
    """

    def read() -> InteractivityResponse:
        report = open_report(request.dashboard)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            bookmarks=[
                bookmark_view(report, bookmark)
                for bookmark in bookmarks_of(report.layout)
            ],
        )

    return await _run("list_bookmarks", ctx, read)


@tool(**_WRITE, annotations=_annotations("Create a bookmark"))
async def create_bookmark(
    request: CreateBookmarkRequest, ctx: Context
) -> InteractivityResponse:
    """
    Add a bookmark, a saved view of the report as in Power BI: a page, filter
    and slicer selections (others keep their defaults; cross-filters are
    cleared when it is applied) and which charts and elements show. options
    choose what it brings back (data, display, page). A button goes to it with
    add_element or update_element: action {type: bookmark, bookmarkId}.
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        bookmark = {
            "id": new_bookmark_id(),
            "name": request.name,
            "options": _options(None, request.options),
            "page": _bookmark_page(report, request.page),
            "filters": bookmark_filters(report, request.filters),
            "visibility": bookmark_visibility(report, request.hidden, request.shown),
        }
        if bookmark["page"] is None:
            bookmark.pop("page")
        save_bookmarks(report, [*bookmarks_of(report.layout), bookmark])
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[bookmark["id"]],
            bookmark=bookmark_view(report, bookmark),
            warnings=report.warnings,
        )

    return await _run("create_bookmark", ctx, change)


@tool(**_WRITE, annotations=_annotations("Update a bookmark"))
async def update_bookmark(
    request: UpdateBookmarkRequest, ctx: Context
) -> InteractivityResponse:
    """
    Change a bookmark: its name, page, options, filter selections (merged
    over the saved ones; reset_filters starts from the filter defaults), the
    objects it hides or shows, or its place in the list.
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        current = find_bookmark(report, request.bookmark)
        bookmark = dict(current)
        if request.name is not None:
            bookmark["name"] = request.name
        if request.page is not None:
            page = _bookmark_page(report, request.page)
            if page:
                bookmark["page"] = page
        bookmark["options"] = _options(current.get("options"), request.options)
        if request.filters is not None or request.reset_filters:
            bookmark["filters"] = bookmark_filters(
                report,
                request.filters or {},
                None if request.reset_filters else current.get("filters"),
            )
        if request.hidden or request.shown:
            bookmark["visibility"] = bookmark_visibility(
                report, request.hidden, request.shown, current.get("visibility")
            )
        bookmarks = [
            bookmark if item.get("id") == current.get("id") else item
            for item in bookmarks_of(report.layout)
        ]
        if request.position is not None:
            bookmarks.remove(bookmark)
            bookmarks.insert(min(request.position, len(bookmarks) + 1) - 1, bookmark)
        save_bookmarks(report, bookmarks)
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[str(bookmark["id"])],
            bookmark=bookmark_view(report, bookmark),
        )

    return await _run("update_bookmark", ctx, change)


@tool(**_WRITE, annotations=_annotations("Delete a bookmark", destructive=True))
async def delete_bookmark(
    request: DeleteBookmarkRequest, ctx: Context
) -> InteractivityResponse:
    """
    Delete a bookmark. Buttons and chart links that went to it are named in
    the warnings: point them elsewhere with update_element or format_visual.
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        bookmark = find_bookmark(report, request.bookmark)
        save_bookmarks(
            report,
            [b for b in bookmarks_of(report.layout) if b.get("id") != bookmark["id"]],
        )
        if users := bookmark_users(report, bookmark["id"]):
            report.warnings.append(
                f"These objects still go to the deleted bookmark: {users}."
            )
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[str(bookmark["id"])],
            warnings=report.warnings,
        )

    return await _run("delete_bookmark", ctx, change)


# Drill through


@tool(**_WRITE, annotations=_annotations("Set a drill through page"))
async def set_drillthrough_page(
    request: SetDrillthroughPageRequest, ctx: Context
) -> InteractivityResponse:
    """
    Make a page a drill through target, as in Power BI: on another page,
    right-clicking a data point and choosing "Drill through" opens this page
    filtered to the point's values of these columns (only the charts whose
    dataset has them).
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = report_page(report, request.page, "drill through to a page")
        columns = check_columns(report.dashboard, request.columns)
        meta_of(report, page_id)[keys.DRILLTHROUGH_PAGE_KEY] = {"columns": columns}
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[page_id],
            page=page_id,
            drillthrough_columns=columns,
        )

    return await _run("set_drillthrough_page", ctx, change)


@tool(**_WRITE, annotations=_annotations("Clear a drill through page"))
async def clear_drillthrough_page(
    request: ClearDrillthroughPageRequest, ctx: Context
) -> InteractivityResponse:
    """Stop a page being a drill through target."""

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = report_page(report, request.page, "drill through to a page")
        meta_of(report, page_id).pop(keys.DRILLTHROUGH_PAGE_KEY, None)
        changed = save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[page_id] if changed else [],
            page=page_id,
        )

    return await _run("clear_drillthrough_page", ctx, change)


# Interactions


@tool(**_WRITE, annotations=_annotations("Set visual interactions"))
async def set_visual_interactions(
    request: SetVisualInteractionsRequest, ctx: Context
) -> InteractivityResponse:
    """
    "Edit interactions", as in Power BI: whether a chart's cross-filters
    (clicking its marks) filter each other chart ("filter") or leave it alone
    ("none"). Charts cannot highlight one another, so there is no third mode.
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        _, source = chart_object(report, request.source)
        modes: dict[int, str] = {}
        for item in request.interactions:
            _, target = chart_object(report, item.target)
            if target == source:
                raise LayoutEditError("A chart's cross-filters never reach itself.")
            modes[target] = item.mode
        metadata = dashboard_metadata(report.dashboard)
        configuration = set_interactions(report, metadata, source, modes)
        if metadata.get("cross_filters_enabled") is False:
            report.warnings.append(
                "Cross-filters are off on this dashboard, so interactions have "
                "no effect until they are turned on."
            )
        save_report(
            report,
            fields=metadata_fields(report, {"chart_configuration": configuration}),
        )
        metadata["chart_configuration"] = configuration
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[str(source)],
            interactions={
                str(chart.id): interaction_mode(metadata, source, chart.id)
                for chart in report.dashboard.slices
                if chart.id != source
            },
            warnings=report.warnings,
        )

    return await _run("set_visual_interactions", ctx, change)


# Sync slicers


def _slicer_filter(report: Report, ref: Any) -> tuple[str, str]:
    """A slicer of the report and the id of the filter it shows."""
    from superset.mcp_service.report_layout.elements import element_of

    component_id, kind = element_of(report, ref)
    if kind != "filter":
        raise LayoutEditError(f"{component_id} is not a slicer.")
    element = meta_of(report, component_id).get(keys.ELEMENT_KEY) or {}
    if not element.get("filterId"):
        raise LayoutEditError(f"{component_id} shows no filter yet.")
    return component_id, element["filterId"]


def _show_on_pages(
    report: Report, component_id: str, filter_id: str, pages: list[Any]
) -> list[str]:
    """Copies of a slicer on the pages that should show it, and none on the
    others; its own page always keeps it."""
    own_page = page_of_object(report, component_id)
    visible = resolve_pages(report, pages)
    if own_page not in visible:
        raise LayoutEditError(
            f"The slicer {component_id} sits on {own_page!r}, which always "
            "shows it; include that page."
        )
    shown = slicers_of(report, filter_id)
    changed: list[str] = []
    for page_id in page_ids(report.layout):
        if page_id in visible:
            if not shown.get(page_id):
                changed.append(copy_slicer(report, component_id, page_id))
            continue
        for cid in shown.get(page_id, []):
            remove_component(report, cid)
            changed.append(cid)
    return changed


@tool(**_WRITE, annotations=_annotations("Sync a slicer across pages"))
async def sync_slicer(
    request: SyncSlicerRequest, ctx: Context
) -> InteractivityResponse:
    """
    "Sync slicers", as in Power BI, for a canvas slicer: filter_pages are the
    pages whose charts it filters (its filter's scope; all of them is the
    whole report) and visible_pages the pages that show it (a copy of the
    slicer on each, sharing its selection; copies on other pages go). Both
    are saved together.
    """
    from superset.mcp_service.report_layout.slicers import (
        filter_config,
        save_with_filter,
    )

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        if request.filter_pages is None and request.visible_pages is None:
            raise LayoutEditError("Give filter_pages, visible_pages or both.")
        if len(top_level_pages(report.layout)) < 2:
            raise LayoutEditError(
                "Sync slicers needs a report of two pages or more; add a page "
                "with add_page first."
            )
        component_id, filter_id = _slicer_filter(report, request.object)
        conf = filter_config(report.dashboard, filter_id)
        new_conf = conf
        if request.filter_pages is not None:
            pages = resolve_pages(report, request.filter_pages)
            new_conf = scoped(conf, None, pages, page_ids(report.layout))
        changed = [filter_id] if new_conf != conf else []
        if request.visible_pages is not None:
            changed += _show_on_pages(
                report, component_id, filter_id, request.visible_pages
            )
        if new_conf != conf:
            save_with_filter(report, new_conf)
        else:
            save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=changed,
            filter={
                "id": filter_id,
                "level": filter_scope_level(new_conf),
                "scope": new_conf.get("scope"),
            },
            warnings=report.warnings,
        )

    return await _run("sync_slicer", ctx, change)


# Tooltip pages


@tool(**_WRITE, annotations=_annotations("Make a tooltip page"))
async def make_tooltip_page(
    request: MakeTooltipPageRequest, ctx: Context
) -> InteractivityResponse:
    """
    Make a page a tooltip, as in Power BI: viewers never see it in the tabs;
    it shows, at this size in cells from its top left corner and filtered to
    the mark, over the marks of the charts that use it (set_visual_tooltip).
    columns are the fields it is made for: charts on Auto use the tooltip
    page whose fields they have. enabled=false makes it a normal page again.
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = report_page(report, request.page, "have a tooltip page")
        meta = meta_of(report, page_id)
        if not request.enabled:
            meta.pop(keys.TOOLTIP_PAGE_KEY, None)
            changed = save_report(report)
            return InteractivityResponse(
                dashboard_id=report.dashboard.id,
                changed=[page_id] if changed else [],
                page=page_id,
            )
        current = meta.get(keys.TOOLTIP_PAGE_KEY) or {}
        setting = {
            "width": request.width or current.get("width") or 10,
            "height": request.height or current.get("height") or 8,
            "columns": check_columns(report.dashboard, request.columns)
            if request.columns is not None
            else list(current.get("columns") or []),
        }
        meta[keys.TOOLTIP_PAGE_KEY] = setting
        if clipped := clipped_objects(
            report, page_id, setting["width"], setting["height"]
        ):
            report.warnings.append(
                f"Objects past the {setting['width']} x {setting['height']} tooltip "
                f"area are cut off: {clipped}."
            )
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[page_id],
            page=page_id,
            tooltip_page=setting,
            warnings=report.warnings,
        )

    return await _run("make_tooltip_page", ctx, change)


@tool(**_WRITE, annotations=_annotations("Set the tooltip of a visual"))
async def set_visual_tooltip(
    request: SetVisualTooltipRequest, ctx: Context
) -> InteractivityResponse:
    """
    Choose the tooltip of a chart's marks: default (the chart's own), auto
    (the tooltip page whose fields the chart uses) or page (a given tooltip
    page, see make_tooltip_page).
    """

    def change() -> InteractivityResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, _ = chart_object(report, request.object)
        pages = tooltip_pages(report.layout)
        setting: dict[str, Any] = {
            "type": "default" if request.mode == "default" else "page"
        }
        if request.mode == "page":
            if request.page is None:
                raise LayoutEditError("mode page needs the tooltip page.")
            page_id = resolve_page(report, request.page)
            if page_id not in pages:
                raise LayoutEditError(
                    f"{page_id} is not a tooltip page; make it one with "
                    f"make_tooltip_page. Tooltip pages: {list(pages)}."
                )
            setting["page"] = page_id
        elif request.page is not None:
            raise LayoutEditError("page only applies to mode page.")
        if request.mode != "default" and not pages:
            report.warnings.append(
                "The report has no tooltip page yet, so the chart keeps its own "
                "tooltip until one exists."
            )
        meta = meta_of(report, component_id)
        fmt = dict(meta.get(keys.VISUAL_FORMAT_KEY) or {})
        fmt["tooltipPage"] = setting
        meta[keys.VISUAL_FORMAT_KEY] = fmt
        save_report(report)
        return InteractivityResponse(
            dashboard_id=report.dashboard.id,
            changed=[component_id],
            page=page_of_object(report, component_id),
            tooltip_page=setting,
            warnings=report.warnings,
        )

    return await _run("set_visual_tooltip", ctx, change)
