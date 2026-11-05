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
Format tools: the Format pane of the report editor, by tool. Formats live in
the layout (``meta.auradataFormat`` of an object, ``auradataCanvas`` of the
report), so they save, undo and export with the dashboard, and every change is
checked against the format catalog the frontend generates from the control
panels (``superset/auradata/catalog``).
"""

import base64
import binascii
import re
from typing import Any, Callable

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata import catalog
from superset.auradata.layout import (
    canvas_format,
    CELL,
    descendants,
    format_of,
    is_positioned,
    keys,
    own_format,
    page_ids,
    pasted_meta,
    sharable_format,
    visual_format_of,
)
from superset.auradata.layout.format_patch import (
    check_chart_patch,
    check_chart_value,
    check_general_patch,
    FormatPatchError,
    is_css_color,
    is_site_image,
    merge_patch,
    replace_settings,
    ReportRefs,
)
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    box,
    LayoutEditError,
    meta_of,
    open_report,
    Report,
    resolve_object,
    save_report,
    set_box,
)
from superset.mcp_service.report_layout.format_schemas import (
    CopyFormatRequest,
    FormatOptionsResponse,
    FormatResponse,
    FormatVisualRequest,
    GetFormatOptionsRequest,
    SetCanvasFormatRequest,
    SetDashboardCssRequest,
    SetSharedVisualFormatRequest,
    UploadBackgroundRequest,
    UploadElementImageRequest,
)

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout", "format"],
    "class_permission_name": "Dashboard",
    "method_permission_name": "write",
}

_TOOLTIP = keys.TOOLTIP_FORMAT_KEY
_SAMPLING = keys.SAMPLING_FORMAT_KEY


def _annotations(title: str) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    )


async def _run(
    name: str, ctx: Context, change: Callable[[], FormatResponse]
) -> FormatResponse:
    """Run a format change, turning refusals into an error response."""
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except FormatPatchError as ex:
        await ctx.warning(f"{name} refused: {ex}")
        return FormatResponse(error=str(ex), error_type="InvalidFormat")
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return FormatResponse(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
    await ctx.info(f"{name}: changed {result.changed}")
    return result


def _viz_types(report: Report) -> dict[int, str]:
    return {
        chart.id: chart.viz_type
        for chart in getattr(report.dashboard, "slices", None) or []
    }


def _viz_type_of(report: Report, component_id: str) -> str | None:
    """The chart type of a chart object, None for elements and text boxes."""
    item = report.layout.get(component_id) or {}
    if item.get("type") != keys.CHART_TYPE:
        return None
    return _viz_types(report).get((item.get("meta") or {}).get("chartId"))


def _refs(report: Report) -> ReportRefs:
    root_meta = (report.layout.get(keys.ROOT_ID) or {}).get("meta") or {}
    bookmarks = root_meta.get(keys.BOOKMARKS_KEY) or []
    return ReportRefs(
        pages=set(page_ids(report.layout)),
        bookmarks={b.get("id") for b in bookmarks if isinstance(b, dict)},
    )


def _set_own_format(report: Report, component_id: str, fmt: dict[str, Any]) -> None:
    meta = meta_of(report, component_id)
    if fmt.get("chart") == {}:
        fmt.pop("chart")
    if fmt:
        meta[keys.VISUAL_FORMAT_KEY] = fmt
    else:
        meta.pop(keys.VISUAL_FORMAT_KEY, None)


def _apply_general_chart(chart: dict[str, Any], patch: dict[str, Any]) -> None:
    """The tooltip merges key by key (as the pane does); sampling replaces."""
    if _TOOLTIP in patch:
        value = patch[_TOOLTIP]
        tooltip = merge_patch(chart.get(_TOOLTIP), value) if value else {}
        if tooltip:
            chart[_TOOLTIP] = tooltip
        else:
            chart.pop(_TOOLTIP, None)
    if _SAMPLING in patch:
        if patch[_SAMPLING] is None:
            chart.pop(_SAMPLING, None)
        else:
            chart[_SAMPLING] = patch[_SAMPLING]


def _resolved(report: Report, component_ids: list[str]) -> dict[str, Any]:
    return {cid: visual_format_of(report.layout, cid) for cid in component_ids}


def _done(report: Report, changed: list[str], **extra: Any) -> FormatResponse:
    return FormatResponse(
        dashboard_id=report.dashboard.id,
        changed=changed,
        warnings=report.warnings,
        **extra,
    )


def _option_sections(
    viz_type: str, request: GetFormatOptionsRequest
) -> list[dict[str, Any]]:
    """The sections of a chart type the request asks for; descriptions only
    with one section, so the answer stays small."""
    sections = []
    for section in catalog.sections_of(viz_type, request.level):
        if request.section and section["id"] != request.section:
            continue
        controls = section["controls"]
        if not (request.descriptions and request.section):
            controls = [
                {k: v for k, v in c.items() if k != "description"} for c in controls
            ]
        sections.append({**section, "controls": controls})
    return sections


@tool(
    tags=["discovery", "layout", "format"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Get format options",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_format_options(
    request: GetFormatOptionsRequest, ctx: Context
) -> FormatOptionsResponse:
    """
    List the format settings of a chart type, as the Format pane shows them:
    Visual and Analytics sections with each control's key, value kind, choices,
    range and default, and the General settings every object shares (title,
    background, border, shadow, padding, header icons, link, action button,
    tooltip and sampling). Pass viz_type, or a dashboard and object to read
    the chart type of a chart. Use the keys with format_visual.
    """
    await ctx.info(f"get_format_options: {request.viz_type or request.object}")
    viz_type = request.viz_type
    if viz_type is None and request.object is not None:
        try:
            report = open_report(request.dashboard or "")
            viz_type = _viz_type_of(report, resolve_object(report, request.object))
        except LayoutEditError as ex:
            return FormatOptionsResponse(error=ex.message, error_type=ex.error_type)
    notes = [
        "Values: color takes '#RRGGBB' or {r, g, b, a}; enum takes one of "
        "choices (any value when free_form); json is the control's own value.",
        "dynamic lists what depends on the chart (choices, default, "
        "visibility): a control may not show for every chart of the type.",
        "own settings stay with one chart: copy_format and "
        "set_shared_visual_format leave them out.",
    ]
    sections: list[dict[str, Any]] = []
    if request.level != "general" and viz_type is not None:
        if viz_type not in catalog.chart_types():
            return FormatOptionsResponse(
                viz_type=viz_type,
                error=f"The format catalog has no chart type {viz_type!r}.",
                error_type="NotFound",
                chart_types=catalog.chart_types(),
            )
        sections = _option_sections(viz_type, request)
    if request.descriptions and not request.section:
        notes.append("Descriptions come with one section: pass section too.")
    general = None
    if request.level in (None, "general"):
        general = {
            "settings": catalog.general_spec(),
            "chart_settings": catalog.general_chart_spec(),
        }
    elif viz_type is None:
        notes.append("Pass viz_type or an object for Visual and Analytics.")
    return FormatOptionsResponse(
        viz_type=viz_type,
        level=request.level,
        sections=sections,
        general=general,
        notes=notes,
        chart_types=[] if viz_type else catalog.chart_types(),
    )


@tool(**_WRITE, annotations=_annotations("Format a visual"))
async def format_visual(request: FormatVisualRequest, ctx: Context) -> FormatResponse:
    """
    Format one object of a report, one level of the Format pane at a time.
    Visual and Analytics: chart settings by key (labels, legend, axes, colors,
    series, reference lines, trend line, tooltip fields, small multiples);
    each replaces the chart's saved value and repaints without a query.
    General: title, background, border, radius, shadow, padding, header icons,
    link and action button, plus auradata_tooltip and auradata_sampling for
    ECharts charts. null resets a setting. Returns the resolved format.
    """

    def change() -> FormatResponse:
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        meta = meta_of(report, cid)
        own = dict(meta.get(keys.VISUAL_FORMAT_KEY) or {})
        chart = dict(own.get("chart") or {})
        viz_type = _viz_type_of(report, cid)
        if request.level in ("visual", "analytics"):
            if viz_type is None:
                raise LayoutEditError(
                    f"{cid} is not a chart: only the General level formats it."
                )
            clean = check_chart_patch(viz_type, request.level, request.patch)
            chart = replace_settings(chart, clean)
        else:
            general, chart_patch = check_general_patch(request.patch, _refs(report))
            if chart_patch and viz_type is None:
                raise LayoutEditError(
                    f"{cid} is not a chart: tooltip and sampling are chart settings."
                )
            own = merge_patch(own, general)
            _apply_general_chart(chart, chart_patch)
        own["chart"] = chart
        _set_own_format(report, cid, own)
        save_report(report)
        return _done(report, [cid], formats=_resolved(report, [cid]))

    return await _run("format_visual", ctx, change)


def _fit_objects(report: Report) -> list[str]:
    """Keeps every object inside the page after a size change, as the editor's
    canvas frame does, and says which ones moved or shrank."""
    fitted: list[str] = []
    for page_id in page_ids(report.layout):
        for cid in descendants(report.layout, page_id):
            if not is_positioned((report.layout.get(cid) or {}).get("type")):
                continue
            before = box(report, cid)
            set_box(report, cid)
            after = box(report, cid)
            if before != after:
                fitted.append(cid)
                report.warnings.append(
                    f"{cid}: fitted to the new page at cell ({after[0]}, "
                    f"{after[1]}), {after[2]} x {after[3]} cells."
                )
    return fitted


def _check_colors(where: str, values: dict[str, Any]) -> None:
    problems = [
        f"{where}.{key}: must be a CSS color"
        for key, value in values.items()
        if key in ("color", "color2", "background", "text", "accent")
        and value is not None
        and not is_css_color(value)
    ]
    if problems:
        raise FormatPatchError(problems)


def _canvas_size(size: Any) -> dict[str, Any]:
    if size.mode != "custom":
        return {"mode": size.mode}
    if not size.width or not size.height:
        raise LayoutEditError("A custom size needs width and height.")
    return {"mode": "custom", "width": size.width * CELL, "height": size.height * CELL}


def _canvas_background(canvas: dict[str, Any], request: Any) -> dict[str, Any]:
    background = request.model_dump(exclude_none=True)
    _check_colors("background", background)
    image = background.get("image")
    if image is not None and not is_site_image(image):
        raise FormatPatchError(
            [
                "background.image: must be a picture of this site; upload it "
                "with upload_dashboard_background"
            ]
        )
    if background["type"] == "image" and not image:
        current = canvas.get("background") or {}
        if not current.get("image"):
            raise LayoutEditError("An image background needs an image.")
        background = {**current, **background}
    return background


@tool(**_WRITE, annotations=_annotations("Set the canvas format"))
async def set_canvas_format(
    request: SetCanvasFormatRequest, ctx: Context
) -> FormatResponse:
    """
    Set the page of a report: its size (16:9, 4:3, letter, or custom in cells
    of 32 px), its background (color, gradient or a picture of this site; use
    upload_dashboard_background for a new picture) and the colors of the
    filter pane and page bar. A smaller page fits its objects back inside.
    """

    def change() -> FormatResponse:
        report = open_report(request.dashboard, edit=True)
        canvas = dict(canvas_format(report.layout) or {})
        changed: list[str] = []
        if request.size:
            canvas["size"] = _canvas_size(request.size)
        if request.background:
            canvas["background"] = _canvas_background(canvas, request.background)
        for name, key in (("filter_bar", "filterBar"), ("tabs", "tabs")):
            area = getattr(request, name)
            if area:
                values = area.model_dump(exclude_none=True)
                _check_colors(name, values)
                canvas[key] = values
        root = meta_of(report, keys.ROOT_ID)
        root[keys.CANVAS_FORMAT_KEY] = canvas
        changed.append(keys.ROOT_ID)
        if request.size:
            changed += _fit_objects(report)
        save_report(report)
        return _done(report, changed, canvas=canvas)

    return await _run("set_canvas_format", ctx, change)


def _check_chart_settings(report: Report, patch: dict[str, Any]) -> dict[str, Any]:
    """Chart settings of the shared style: look controls of some chart type,
    those of the report's charts first."""
    order = list(dict.fromkeys(_viz_types(report).values())) + catalog.chart_types()
    clean: dict[str, Any] = {}
    problems: list[str] = []
    for key, value in patch.items():
        control = next(
            (
                catalog.controls_of(viz)[key]
                for viz in order
                if key in catalog.controls_of(viz)
            ),
            None,
        )
        if control is None:
            problems.append(f"chart.{key}: not a format setting of any chart type")
            continue
        if value is None:
            clean[key] = None
            continue
        normalized, problem = check_chart_value(control, value)
        if problem:
            problems.append(f"chart.{key}: {problem}")
        clean[key] = normalized
    if problems:
        raise FormatPatchError(problems)
    return clean


def _patched_shared(
    report: Report, fmt: dict[str, Any], patch: dict[str, Any]
) -> dict[str, Any]:
    """The shared style with a patch of General settings and chart settings."""
    patch = dict(patch)
    chart_patch = patch.pop("chart", None) or {}
    if not isinstance(chart_patch, dict):
        raise FormatPatchError(["chart: must be an object"])
    general, general_chart = check_general_patch(patch, _refs(report))
    fmt = merge_patch(fmt, general)
    chart = replace_settings(
        fmt.get("chart"), _check_chart_settings(report, chart_patch)
    )
    _apply_general_chart(chart, general_chart)
    fmt["chart"] = chart
    if not chart:
        fmt.pop("chart")
    return fmt


def _reset_chart_formats(report: Report) -> list[str]:
    """Charts drop their own style but what belongs to them."""
    reset = []
    for cid, item in report.layout.items():
        if not isinstance(item, dict) or item.get("type") != keys.CHART_TYPE:
            continue
        meta = item.get("meta") or {}
        if meta.get(keys.VISUAL_FORMAT_KEY):
            kept = own_format(meta[keys.VISUAL_FORMAT_KEY])
            _set_own_format(report, cid, dict(kept or {}))
            reset.append(cid)
    return reset


@tool(**_WRITE, annotations=_annotations("Set the shared visual format"))
async def set_shared_visual_format(
    request: SetSharedVisualFormatRequest, ctx: Context
) -> FormatResponse:
    """
    Set the style every chart of the report shares ("Apply to all charts"),
    kept on the canvas so charts added later take it too. Share the format of
    from_object, change it with a patch of General settings (chart settings
    under 'chart'), or both. A chart's own format wins over it, setting by
    setting; with reset_charts (the default, as in the pane) charts drop their
    own style but what names them (subtitle, help text, link, own settings).
    Settings that belong to one chart are never shared.
    """

    def change() -> FormatResponse:
        report = open_report(request.dashboard, edit=True)
        canvas = dict(canvas_format(report.layout) or {})
        if request.from_object is not None:
            source = resolve_object(report, request.from_object)
            fmt = dict(visual_format_of(report.layout, source) or {})
        else:
            fmt = dict(canvas.get("visuals") or {})
        if request.patch:
            fmt = _patched_shared(report, fmt, request.patch)
        shared = sharable_format(fmt)
        if shared:
            canvas["visuals"] = shared
        else:
            canvas.pop("visuals", None)
        root = meta_of(report, keys.ROOT_ID)
        if canvas:
            root[keys.CANVAS_FORMAT_KEY] = canvas
        else:
            root.pop(keys.CANVAS_FORMAT_KEY, None)
        changed = [keys.ROOT_ID]
        if request.reset_charts:
            changed += _reset_chart_formats(report)
        save_report(report)
        return _done(report, changed, canvas=canvas)

    return await _run("set_shared_visual_format", ctx, change)


@tool(**_WRITE, annotations=_annotations("Copy a format"))
async def copy_format(request: CopyFormatRequest, ctx: Context) -> FormatResponse:
    """
    Copy the format of one object to others, as the format painter does: the
    targets take its box and chart settings but keep what belongs to each of
    them (subtitle, help text, link, action button, own chart settings, the
    title of an element); elements of the same kind also take its style.
    """

    def change() -> FormatResponse:
        report = open_report(request.dashboard, edit=True)
        source = resolve_object(report, request.source)
        copied = format_of(report.layout[source])
        changed: list[str] = []
        for ref in request.targets:
            target = resolve_object(report, ref)
            if target == source or target in changed:
                continue
            item = report.layout[target]
            report.layout[target] = {**item, "meta": pasted_meta(item, copied)}
            changed.append(target)
        save_report(report)
        return _done(report, changed, formats=_resolved(report, changed))

    return await _run("copy_format", ctx, change)


_CSS_IMPORT = re.compile(r"@import", re.IGNORECASE)
_CSS_IMAGE_SET = re.compile(r"image-set\s*\(", re.IGNORECASE)
_CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE | re.DOTALL)


def _check_css(css: str) -> list[str]:
    """CSS that loads nothing from another site; returns its warnings."""
    problems = []
    if _CSS_IMPORT.search(css):
        problems.append("css: @import is not allowed")
    # Escapes could spell @import or url( past the checks below
    if "\\" in css:
        problems.append("css: backslash escapes are not allowed")
    if _CSS_IMAGE_SET.search(css):
        problems.append("css: image-set() is not allowed; use url() of this site")
    for _, address in _CSS_URL.findall(css):
        if not is_site_image(address):
            problems.append(f"css: url({address[:60]}) must be a picture of this site")
    if problems:
        raise FormatPatchError(problems)
    warnings = []
    if re.search(r"\.(ant-|auradata-|dashboard-|grid-)", css):
        warnings.append(
            "The CSS targets internal classes, which may change between "
            "versions; prefer the format tools where they cover it."
        )
    return warnings


@tool(**_WRITE, annotations=_annotations("Set the dashboard CSS"))
async def set_dashboard_css(
    request: SetDashboardCssRequest, ctx: Context
) -> FormatResponse:
    """
    Set the custom CSS of a report (its own css field; the look of the app is
    fixed by the product). An empty string clears it. CSS may not import
    other files or load pictures from other sites.
    """

    def change() -> FormatResponse:
        report = open_report(request.dashboard, edit=True)
        report.warnings.extend(_check_css(request.css))
        save_report(report, fields={"css": request.css})
        return _done(report, ["css"])

    return await _run("set_dashboard_css", ctx, change)


def _decode_image(encoded: str) -> tuple[bytes, str]:
    """The bytes and media type of a base64 picture, checked as uploads are."""
    from superset.auradata.backgrounds import check_image, ImageUploadError

    text = encoded.strip()
    if text.startswith("data:"):
        text = text.split(",", 1)[-1]
    try:
        data = base64.b64decode(text, validate=True)
    except (binascii.Error, ValueError) as ex:
        raise LayoutEditError("image_base64 is not valid base64.") from ex
    try:
        return data, check_image(data)
    except ImageUploadError as ex:
        raise LayoutEditError(str(ex)) from ex


@tool(**_WRITE, annotations=_annotations("Upload a background"))
async def upload_dashboard_background(
    request: UploadBackgroundRequest, ctx: Context
) -> FormatResponse:
    """
    Upload the background picture of a report from base64 (PNG, JPEG, GIF or
    WebP, 2 MB at most) and show it on the page. The server never downloads
    pictures from an address: send the file itself.
    """

    def change() -> FormatResponse:
        from superset.auradata.backgrounds import store_background

        report = open_report(request.dashboard, edit=True)
        data, media_type = _decode_image(request.image_base64)
        url = store_background(report.dashboard.id, data, media_type)
        canvas = dict(canvas_format(report.layout) or {})
        background: dict[str, Any] = {
            **(canvas.get("background") or {}),
            "type": "image",
            "image": url,
            "fit": request.fit,
        }
        if request.opacity is not None:
            background["opacity"] = request.opacity
        canvas["background"] = background
        meta_of(report, keys.ROOT_ID)[keys.CANVAS_FORMAT_KEY] = canvas
        save_report(report)
        return _done(report, [keys.ROOT_ID], canvas=canvas, url=url)

    return await _run("upload_dashboard_background", ctx, change)


@tool(**_WRITE, annotations=_annotations("Upload an image"))
async def upload_dashboard_image(
    request: UploadElementImageRequest, ctx: Context
) -> FormatResponse:
    """
    Upload a picture for the image elements of a report from base64 (PNG,
    JPEG, GIF or WebP, 2 MB at most) and return its id and address, which also
    serves chart settings that take a picture. With object, an image element
    shows it. The server never downloads pictures from an address.
    """

    def change() -> FormatResponse:
        from superset.auradata.backgrounds import store_element_image

        report = open_report(request.dashboard, edit=True)
        target = None
        if request.object is not None:
            target = resolve_object(report, request.object)
            kind = keys.element_kind(meta_of(report, target).get("componentKey"))
            if kind != "image":
                raise LayoutEditError(f"{target} is not an image element.")
        data, media_type = _decode_image(request.image_base64)
        image_id, url = store_element_image(report.dashboard.id, data, media_type)
        changed: list[str] = []
        if target:
            meta = meta_of(report, target)
            element = dict(meta.get(keys.ELEMENT_KEY) or {"kind": "image"})
            element.update({"src": url, "imageId": image_id})
            meta[keys.ELEMENT_KEY] = element
            changed.append(target)
            save_report(report)
        return _done(report, changed, url=url, image_id=image_id)

    return await _run("upload_dashboard_image", ctx, change)
