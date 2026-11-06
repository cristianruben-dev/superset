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
Object tools: place, move, resize, align, distribute and stack the charts,
elements and text boxes of a page, and set their state. Positions are cells of
32 px from the top left of the page; every change keeps objects inside the page
and never on top of another unless ``allow_overlap`` is set. Locked objects
never move.
"""

from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import (
    align_cells,
    distribute_cells,
    free_cell,
    keys,
    layer_order,
    Pos,
)
from superset.mcp_service.report_layout.editing import (
    append_in_new_row,
    box,
    detach,
    LayoutEditError,
    meta_of,
    open_report,
    page_of_object,
    refuse_locked,
    refuse_overlaps,
    Report,
    resolve_object,
    resolve_page,
    save_report,
    set_box,
)
from superset.mcp_service.report_layout.schemas import (
    AlignObjectsRequest,
    BringToFrontRequest,
    DistributeObjectsRequest,
    LayoutChangeResponse,
    MoveObjectRequest,
    PlaceObjectRequest,
    ResizeObjectRequest,
    SetObjectStateRequest,
)
from superset.mcp_service.report_layout.tool.common import cell_box, run_write

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout"],
    "class_permission_name": "Dashboard",
    "method_permission_name": "write",
}


def _annotations(title: str) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    )


def _result(
    report: Report, page_id: str, moved: list[str], **extra: Any
) -> LayoutChangeResponse:
    return LayoutChangeResponse(
        dashboard_id=report.dashboard.id,
        changed=moved,
        page=page_id,
        boxes={cid: cell_box(*box(report, cid)) for cid in moved},
        warnings=report.warnings,
        **extra,
    )


@tool(**_WRITE, annotations=_annotations("Place an object on a page"))
async def place_object(
    request: PlaceObjectRequest, ctx: Context
) -> LayoutChangeResponse:
    """Put a chart, element or text box at a cell of a page, optionally moving
    it to another page and resizing it. Without x and y it takes the first free
    cell of the page for its size."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        refuse_locked(report, cid)
        current = page_of_object(report, cid)
        target = resolve_page(report, request.page) if request.page else current
        if target != current:
            detach(report, cid)
            append_in_new_row(report, target, cid)
        x, y, _, _ = box(report, cid)
        set_box(report, cid, None, request.width, request.height)
        meta = meta_of(report, cid)
        if request.x is None and request.y is None:
            # Its own cell is free for it
            meta.pop(keys.POS_KEY, None)
            cell = free_cell(report.layout, target, meta["width"], meta["height"])
        else:
            cell = {
                "x": request.x if request.x is not None else x,
                "y": request.y if request.y is not None else y,
            }
        set_box(report, cid, cell)
        refuse_overlaps(report, target, [cid], request.allow_overlap)
        save_report(report)
        return _result(report, target, [cid])

    return await run_write("place_object", ctx, change)


@tool(**_WRITE, annotations=_annotations("Move an object"))
async def move_object(request: MoveObjectRequest, ctx: Context) -> LayoutChangeResponse:
    """Move an object to a cell (x, y) of its page, or by dx and dy cells."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        refuse_locked(report, cid)
        page_id = page_of_object(report, cid)
        x, y, _, _ = box(report, cid)
        cell: Pos = {
            "x": max(0, (request.x if request.x is not None else x) + request.dx),
            "y": max(0, (request.y if request.y is not None else y) + request.dy),
        }
        set_box(report, cid, cell)
        refuse_overlaps(report, page_id, [cid], request.allow_overlap)
        save_report(report)
        return _result(report, page_id, [cid])

    return await run_write("move_object", ctx, change)


@tool(**_WRITE, annotations=_annotations("Resize an object"))
async def resize_object(
    request: ResizeObjectRequest, ctx: Context
) -> LayoutChangeResponse:
    """Resize an object in cells, keeping its top left corner. Charts are at
    least 4 x 3 cells, other objects 2 x 2, and none outgrows the page."""

    def change() -> LayoutChangeResponse:
        if request.width is None and request.height is None:
            raise LayoutEditError("Give a width, a height or both.")
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        refuse_locked(report, cid)
        page_id = page_of_object(report, cid)
        set_box(report, cid, None, request.width, request.height)
        refuse_overlaps(report, page_id, [cid], request.allow_overlap)
        save_report(report)
        return _result(report, page_id, [cid])

    return await run_write("resize_object", ctx, change)


def _same_page(report: Report, refs: list[Any]) -> tuple[str, list[str]]:
    ids = list(dict.fromkeys(resolve_object(report, ref) for ref in refs))
    pages = {page_of_object(report, cid) for cid in ids}
    if len(pages) != 1:
        raise LayoutEditError("The objects must be on the same page.")
    return pages.pop(), ids


def _apply_cells(
    report: Report, page_id: str, cells: dict[str, Any], allow_overlap: bool
) -> tuple[list[str], list[str]]:
    locked = [cid for cid in cells if meta_of(report, cid).get(keys.LOCKED_KEY)]
    moved = [cid for cid in cells if cid not in locked]
    for cid in moved:
        set_box(report, cid, cells[cid])
    refuse_overlaps(report, page_id, moved, allow_overlap)
    return moved, locked


@tool(**_WRITE, annotations=_annotations("Align objects"))
async def align_objects(
    request: AlignObjectsRequest, ctx: Context
) -> LayoutChangeResponse:
    """Line two or more objects of a page up against the left, right, top or
    bottom edge of them all, or their center or middle. Locked ones stay."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id, ids = _same_page(report, list(request.objects))
        cells = align_cells(report.layout, ids, request.mode)
        moved, locked = _apply_cells(report, page_id, cells, request.allow_overlap)
        if moved:
            save_report(report)
        return _result(report, page_id, moved, skipped_locked=locked)

    return await run_write("align_objects", ctx, change)


@tool(**_WRITE, annotations=_annotations("Distribute objects"))
async def distribute_objects(
    request: DistributeObjectsRequest, ctx: Context
) -> LayoutChangeResponse:
    """Space three or more objects of a page evenly between the outer two,
    across (horizontal) or down (vertical). Locked ones stay."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id, ids = _same_page(report, list(request.objects))
        cells = distribute_cells(report.layout, ids, request.axis)
        moved, locked = _apply_cells(report, page_id, cells, request.allow_overlap)
        if moved:
            save_report(report)
        return _result(report, page_id, moved, skipped_locked=locked)

    return await run_write("distribute_objects", ctx, change)


@tool(**_WRITE, annotations=_annotations("Change the stack order of an object"))
async def bring_to_front(
    request: BringToFrontRequest, ctx: Context
) -> LayoutChangeResponse:
    """Bring an object to the front of its page, send it to the back, or move
    it one step forward or backward in the stack."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        page_id = page_of_object(report, cid)
        changes = layer_order(report.layout, page_id, cid, request.move)
        for key, z in changes.items():
            meta_of(report, key)[keys.Z_KEY] = z
        if changes:
            save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id, changed=list(changes), page=page_id
        )

    return await run_write("bring_to_front", ctx, change)


@tool(**_WRITE, annotations=_annotations("Set object state"))
async def set_object_state(
    request: SetObjectStateRequest, ctx: Context
) -> LayoutChangeResponse:
    """Hide an object from viewers (editors still see it faded), lock it so it
    cannot be moved, resized or removed, or set its screen reader text."""

    def change() -> LayoutChangeResponse:
        if (
            request.hidden is None
            and request.locked is None
            and (request.alt_text is None)
        ):
            raise LayoutEditError("Give hidden, locked or alt_text.")
        report = open_report(request.dashboard, edit=True)
        cid = resolve_object(report, request.object)
        meta = meta_of(report, cid)
        for key, value in (
            (keys.HIDDEN_KEY, request.hidden),
            (keys.LOCKED_KEY, request.locked),
        ):
            if value:
                meta[key] = True
            elif value is False:
                meta.pop(key, None)
        if request.alt_text is not None:
            if request.alt_text.strip():
                meta[keys.ALT_TEXT_KEY] = request.alt_text
            else:
                meta.pop(keys.ALT_TEXT_KEY, None)
        saved = save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id,
            changed=[cid] if saved else [],
            page=page_of_object(report, cid),
        )

    return await run_write("set_object_state", ctx, change)
