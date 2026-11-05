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
Design element and slicer tools: the "Design elements" of the report editor
(image, shape, button, text, page navigator) and canvas slicers, a native
filter of the dashboard drawn on the page. Elements are DYNAMIC components
with their settings in ``meta.auradataElement`` and their box in
``meta.auradataFormat``; every change goes through the layout library and the
dashboard update command, so it lands in the version history.
"""

from typing import Any, Callable

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import keys
from superset.auradata.layout.elements import new_element_meta
from superset.auradata.layout.format_patch import FormatPatchError
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    detach,
    LayoutEditError,
    meta_of,
    open_report,
    page_of_object,
    refuse_locked,
    Report,
    resolve_page,
    save_report,
)
from superset.mcp_service.report_layout.element_schemas import (
    AddElementRequest,
    AddSlicerRequest,
    ElementResponse,
    FormatElementRequest,
    FormatSlicerRequest,
    RemoveElementRequest,
    UpdateElementRequest,
    UpdateSlicerRequest,
)
from superset.mcp_service.report_layout.elements import (
    element_of,
    patched_box,
    patched_settings,
    place_new,
)
from superset.mcp_service.report_layout.pictures import decode_image
from superset.mcp_service.report_layout.slicers import (
    apply_filter_options,
    check_dataset,
    check_styles,
    default_data_mask,
    element_options,
    filter_config,
    FILTER_TYPES,
    page_scope,
    save_with_filter,
    slicer_summary,
)

# Slicer settings tied to its native filter, which update_slicer keeps in step
_FILTER_OPTIONS = frozenset({"selection", "sortValues", "hiddenValues"})

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout", "elements"],
    "class_permission_name": "Dashboard",
    "method_permission_name": "write",
}


def _annotations(title: str, destructive: bool = False) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=False,
        openWorldHint=False,
    )


async def _run(
    name: str, ctx: Context, change: Callable[[], ElementResponse]
) -> ElementResponse:
    """Run an element change, turning refusals into an error response."""
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except FormatPatchError as ex:
        await ctx.warning(f"{name} refused: {ex}")
        return ElementResponse(error=str(ex), error_type="InvalidFormat")
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return ElementResponse(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
    await ctx.info(f"{name}: changed {result.changed}")
    return result


def _done(
    report: Report, component_id: str, conf: dict[str, Any] | None = None
) -> ElementResponse:
    meta = meta_of(report, component_id)
    element = meta.get(keys.ELEMENT_KEY) or {}
    return ElementResponse(
        dashboard_id=report.dashboard.id,
        changed=[component_id],
        object=component_id,
        page=page_of_object(report, component_id),
        element=element,
        format=meta.get(keys.VISUAL_FORMAT_KEY),
        filter_id=element.get("filterId"),
        filter=slicer_summary(conf) if conf else None,
        warnings=report.warnings,
    )


def _store_image(report: Report, element: dict[str, Any], encoded: str) -> None:
    from superset.auradata.backgrounds import store_element_image

    data, media_type = decode_image(encoded)
    image_id, url = store_element_image(report.dashboard.id, data, media_type)
    element.update({"src": url, "imageId": image_id})


def _drop_image(report: Report, image_id: Any) -> None:
    """Deletes a picture an image element no longer shows."""
    from superset.auradata.backgrounds import delete_element_image

    if isinstance(image_id, int):
        delete_element_image(report.dashboard.id, image_id)


@tool(**_WRITE, annotations=_annotations("Add a design element"))
async def add_element(request: AddElementRequest, ctx: Context) -> ElementResponse:
    """
    Add a design element to a page of a report, as the editor's Design
    elements do: image, shape, button, text or page navigator, with its
    settings over the defaults of a new one (get_format_options with element
    lists them). A button acts with action: {type: page, page: <name or id>},
    {type: bookmark, bookmarkId}, {type: back}, {type: url, url} or
    reset-filters. An image takes image_base64 (never an address). Without x
    and y it takes the first free cell of the page for its size.
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = resolve_page(report, request.page)
        if request.image_base64 and request.kind != "image":
            raise LayoutEditError("image_base64 only applies to image elements.")
        meta = new_element_meta(request.kind)
        element = patched_settings(
            report, request.kind, meta[keys.ELEMENT_KEY], request.settings
        )
        if request.format:
            meta[keys.VISUAL_FORMAT_KEY] = patched_box(
                report, meta[keys.VISUAL_FORMAT_KEY], request.format
            )
        meta[keys.ELEMENT_KEY] = element
        if request.image_base64:
            decode_image(request.image_base64)
        component_id = place_new(report, page_id, meta, request)
        if request.image_base64:
            _store_image(report, element, request.image_base64)
        save_report(report)
        return _done(report, component_id)

    return await _run("add_element", ctx, change)


@tool(**_WRITE, annotations=_annotations("Update a design element"))
async def update_element(
    request: UpdateElementRequest, ctx: Context
) -> ElementResponse:
    """
    Change the settings of a design element (image, shape, button, text,
    navigator): its content, action and look, as a patch where objects merge
    key by key and null resets a setting. image_base64 replaces the picture of
    an image. Slicers change with update_slicer and format_slicer.
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, kind = element_of(report, request.object)
        if kind == "filter":
            raise LayoutEditError(
                f"{component_id} is a slicer: use update_slicer or format_slicer."
            )
        if request.image_base64 and kind != "image":
            raise LayoutEditError("image_base64 only applies to image elements.")
        meta = meta_of(report, component_id)
        current = dict(meta.get(keys.ELEMENT_KEY) or {"kind": kind})
        element = patched_settings(report, kind, current, request.settings)
        old_image = current.get("imageId")
        if "src" in request.settings:
            # Another picture than the uploaded one
            element.pop("imageId", None)
        if request.image_base64:
            _store_image(report, element, request.image_base64)
        meta[keys.ELEMENT_KEY] = element
        save_report(report)
        if old_image is not None and element.get("imageId") != old_image:
            _drop_image(report, old_image)
        return _done(report, component_id)

    return await _run("update_element", ctx, change)


@tool(**_WRITE, annotations=_annotations("Format a design element"))
async def format_element(
    request: FormatElementRequest, ctx: Context
) -> ElementResponse:
    """
    Format the box of a design element or slicer (the General level of its
    Format pane): title, background, border, radius, shadow, padding, header
    icons and link. null resets a setting.
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, _ = element_of(report, request.object)
        meta = meta_of(report, component_id)
        fmt = patched_box(report, meta.get(keys.VISUAL_FORMAT_KEY), request.patch)
        if fmt:
            meta[keys.VISUAL_FORMAT_KEY] = fmt
        else:
            meta.pop(keys.VISUAL_FORMAT_KEY, None)
        save_report(report)
        return _done(report, component_id)

    return await _run("format_element", ctx, change)


def _other_slicers(report: Report, component_id: str, filter_id: str) -> bool:
    return any(
        cid != component_id
        and isinstance(item, dict)
        and ((item.get("meta") or {}).get(keys.ELEMENT_KEY) or {}).get("filterId")
        == filter_id
        for cid, item in report.layout.items()
    )


@tool(**_WRITE, annotations=_annotations("Remove a design element", True))
async def remove_element(
    request: RemoveElementRequest, ctx: Context
) -> ElementResponse:
    """
    Remove a design element or slicer from its page. A slicer's native filter
    goes too (remove_filter, on by default) unless another slicer shows it;
    an image's uploaded picture is deleted. Locked elements are refused.
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, kind = element_of(report, request.object)
        refuse_locked(report, component_id)
        page_id = page_of_object(report, component_id)
        element = meta_of(report, component_id).get(keys.ELEMENT_KEY) or {}
        detach(report, component_id)
        report.layout.pop(component_id, None)
        filter_id = element.get("filterId") if kind == "filter" else None
        removes_filter = (
            filter_id
            and request.remove_filter
            and not _other_slicers(report, component_id, filter_id)
        )
        if removes_filter:
            _save_without_filter(report, filter_id)
        else:
            save_report(report)
        if kind == "image":
            _drop_image(report, element.get("imageId"))
        return ElementResponse(
            dashboard_id=report.dashboard.id,
            changed=[component_id],
            object=component_id,
            page=page_id,
            filter_id=filter_id if removes_filter else None,
            warnings=report.warnings,
        )

    return await _run("remove_element", ctx, change)


def _save_without_filter(report: Report, filter_id: str) -> None:
    from superset.commands.dashboard.update import (
        UpdateDashboardNativeFiltersCommand,
    )
    from superset.mcp_service.report_layout.visuals import in_one_transaction

    @in_one_transaction
    def save() -> None:
        UpdateDashboardNativeFiltersCommand(
            report.dashboard.id, {"deleted": [filter_id]}
        ).run()
        save_report(report)

    save()


def _new_filter(report: Report, request: AddSlicerRequest, page_id: str) -> Any:
    from superset.mcp_service.dashboard.schemas import (
        FilterRangeSpec,
        FilterSelectSpec,
        FilterTimeSpec,
    )
    from superset.mcp_service.dashboard.tool.manage_native_filters import (
        build_new_filter_config,
        FilterValidationError,
    )

    filter_type = FILTER_TYPES[request.filter_type]
    if filter_type != "filter_time":
        if request.dataset_id is None or not request.column:
            raise LayoutEditError(
                f"A {request.filter_type} slicer needs dataset_id and column."
            )
        check_dataset(report.dashboard, request.dataset_id)
    spec: Any
    if filter_type == "filter_select":
        spec = FilterSelectSpec(
            filter_type=filter_type,
            name=request.name,
            dataset_id=request.dataset_id,
            column=request.column,
            multi_select=request.selection != "single",
        )
    elif filter_type == "filter_range":
        spec = FilterRangeSpec(
            filter_type=filter_type,
            name=request.name,
            dataset_id=request.dataset_id,
            column=request.column,
        )
    else:
        spec = FilterTimeSpec(filter_type=filter_type, name=request.name)
    try:
        conf = build_new_filter_config(spec, [])
    except FilterValidationError as ex:
        raise LayoutEditError(str(ex)) from ex
    if request.scope == "page":
        conf["scope"] = page_scope(report, page_id)
    conf = apply_filter_options(conf, request)
    conf["defaultDataMask"] = default_data_mask(conf, request.default_value)
    return conf


@tool(**_WRITE, annotations=_annotations("Add a slicer"))
async def add_slicer(request: AddSlicerRequest, ctx: Context) -> ElementResponse:
    """
    Add a slicer to a page: a new native filter of the dashboard and the
    canvas element that draws it, saved together. list slicers (a column's
    values) draw as dropdown, list, buttons or a text box (input); range
    slicers as between boxes or a slider; time slicers as a relative date or
    two days. Options: single, multi or ctrl selection, an Apply button, sort,
    hidden values, show_in_filter_bar and a default value. scope "page"
    filters only this page's charts; "report" (default) every chart. Values of
    a list, buttons included, stack in a column as in the editor: pass
    settings {"layout": "horizontal"} for a row of buttons, or "grid" with
    "columns".
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = resolve_page(report, request.page)
        conf = _new_filter(report, request, page_id)
        meta = new_element_meta("filter")
        element = patched_settings(
            report, "filter", meta[keys.ELEMENT_KEY], request.settings
        )
        check_styles(conf["filterType"], request, element)
        element_options(request, element)
        element["filterId"] = conf["id"]
        meta[keys.ELEMENT_KEY] = element
        component_id = place_new(report, page_id, meta, request)
        save_with_filter(report, conf)
        return _done(report, component_id, conf)

    return await _run("add_slicer", ctx, change)


@tool(**_WRITE, annotations=_annotations("Update a slicer"))
async def update_slicer(request: UpdateSlicerRequest, ctx: Context) -> ElementResponse:
    """
    Change a slicer: its filter's name and default value (clear_default drops
    it), and how it draws and picks values (variant, range or date style,
    single, multi or ctrl selection, Apply button, sort, hidden values,
    show_in_filter_bar). Its look goes with format_slicer.
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, kind = element_of(report, request.object)
        if kind != "filter":
            raise LayoutEditError(f"{component_id} is not a slicer.")
        meta = meta_of(report, component_id)
        element = dict(meta.get(keys.ELEMENT_KEY) or {"kind": "filter"})
        if not element.get("filterId"):
            raise LayoutEditError(f"{component_id} shows no filter yet.")
        conf = filter_config(report.dashboard, element["filterId"])
        before = dict(conf)
        check_styles(conf.get("filterType") or "", request, element)
        element_options(request, element)
        conf = apply_filter_options(conf, request)
        if request.clear_default:
            conf["defaultDataMask"] = default_data_mask(conf, None)
        elif request.default_value is not None:
            conf["defaultDataMask"] = default_data_mask(conf, request.default_value)
        meta[keys.ELEMENT_KEY] = element
        if conf != before:
            save_with_filter(report, conf)
        else:
            save_report(report)
        return _done(report, component_id, conf)

    return await _run("update_slicer", ctx, change)


@tool(**_WRITE, annotations=_annotations("Format a slicer"))
async def format_slicer(request: FormatSlicerRequest, ctx: Context) -> ElementResponse:
    """
    Format a slicer, one level of its Format pane at a time. visual: the
    header, values, selection, search box, dropdown list, chips and Apply
    button (get_format_options with element=filter lists the keys). general:
    its box (title, background, border, radius, shadow, padding).
    """

    def change() -> ElementResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, kind = element_of(report, request.object)
        if kind != "filter":
            raise LayoutEditError(f"{component_id} is not a slicer.")
        meta = meta_of(report, component_id)
        if request.level == "visual":
            if filter_options := sorted(_FILTER_OPTIONS & set(request.patch)):
                raise LayoutEditError(
                    f"{', '.join(filter_options)}: options of the filter; set them "
                    "with update_slicer (selection, sort, hidden_values)."
                )
            current = dict(meta.get(keys.ELEMENT_KEY) or {"kind": "filter"})
            element = patched_settings(report, "filter", current, request.patch)
            if element.get("filterId"):
                conf = filter_config(report.dashboard, element["filterId"])
                check_styles(conf.get("filterType") or "", request, element)
            meta[keys.ELEMENT_KEY] = element
        else:
            fmt = patched_box(report, meta.get(keys.VISUAL_FORMAT_KEY), request.patch)
            if fmt:
                meta[keys.VISUAL_FORMAT_KEY] = fmt
            else:
                meta.pop(keys.VISUAL_FORMAT_KEY, None)
        save_report(report)
        return _done(report, component_id)

    return await _run("format_slicer", ctx, change)
