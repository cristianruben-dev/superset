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
Arranging objects of a page: align, distribute and stack order. Mirrors the
commands of ``src/auradata/format/arrange.ts``; each returns the new cells by
object (without touching locked objects) so the caller writes them.
"""

from dataclasses import dataclass
from typing import Any, Literal

from superset.auradata.layout._js import as_dict, js_round, truthy
from superset.auradata.layout.keys import LOCKED_KEY, Z_KEY
from superset.auradata.layout.pages import page_objects
from superset.auradata.layout.positions import Pos, pos_of, size_of

AlignMode = Literal["left", "center", "right", "top", "middle", "bottom"]
LayerMove = Literal["front", "back", "forward", "backward"]


@dataclass
class Box:
    """An object of the page as a box of cells."""

    id: str
    x: int
    y: int
    w: Any
    h: Any


def box_of(layout: dict[str, Any], component_id: str) -> Box | None:
    """The box of a placed object, or None."""
    item = layout.get(component_id)
    pos = pos_of(as_dict(item).get("meta"))
    if not isinstance(item, dict) or not pos:
        return None
    width, height = size_of(item.get("meta"))
    return Box(component_id, pos["x"], pos["y"], width, height)


def is_locked(layout: dict[str, Any], component_id: str) -> bool:
    """Whether an object keeps where it is (``meta.auradataLocked``)."""
    meta = as_dict(as_dict(layout.get(component_id)).get("meta"))
    return truthy(meta.get(LOCKED_KEY))


def _boxes(layout: dict[str, Any], ids: list[str]) -> list[Box]:
    return [box for box in (box_of(layout, cid) for cid in ids) if box]


def align_cells(
    layout: dict[str, Any], ids: list[str], mode: AlignMode
) -> dict[str, Pos]:
    """The cells that line the objects up against the outer edge or middle."""
    picked = _boxes(layout, ids)
    if len(picked) < 2:
        return {}
    left = min(b.x for b in picked)
    right = max(b.x + b.w for b in picked)
    top = min(b.y for b in picked)
    bottom = max(b.y + b.h for b in picked)
    changes: dict[str, Pos] = {}
    for b in picked:
        x, y = b.x, b.y
        if mode == "left":
            x = left
        if mode == "right":
            x = right - b.w
        if mode == "center":
            x = js_round((left + right - b.w) / 2)
        if mode == "top":
            y = top
        if mode == "bottom":
            y = bottom - b.h
        if mode == "middle":
            y = js_round((top + bottom - b.h) / 2)
        if x != b.x or y != b.y:
            changes[b.id] = {"x": max(0, x), "y": max(0, y)}
    return changes


def distribute_cells(
    layout: dict[str, Any],
    ids: list[str],
    axis: Literal["horizontal", "vertical"],
) -> dict[str, Pos]:
    """The cells that space three or more objects evenly between the outer two."""
    picked = _boxes(layout, ids)
    if len(picked) < 3:
        return {}
    horizontal = axis == "horizontal"

    def start(b: Box) -> Any:
        return b.x if horizontal else b.y

    def size(b: Box) -> Any:
        return b.w if horizontal else b.h

    ordered = sorted(picked, key=start)
    first, last = ordered[0], ordered[-1]
    span = start(last) + size(last) - start(first)
    free = span - sum(size(b) for b in ordered)
    gap = free / (len(ordered) - 1)
    changes: dict[str, Pos] = {}
    cursor = start(first) + size(first) + gap
    for b in ordered[1:-1]:
        at = js_round(cursor)
        x = at if horizontal else b.x
        y = b.y if horizontal else at
        if x != b.x or y != b.y:
            changes[b.id] = {"x": max(0, x), "y": max(0, y)}
        cursor += size(b) + gap
    return changes


def layer_order(
    layout: dict[str, Any], page_id: str, component_id: str, move: LayerMove
) -> dict[str, int]:
    """The stack places (``auradataZ``, from 1 at the back) that change."""
    order = page_objects(layout, page_id)
    if component_id not in order:
        return {}
    start = order.index(component_id)
    order.remove(component_id)
    target = {
        "front": len(order),
        "back": 0,
        "forward": min(len(order), start + 1),
        "backward": max(0, start - 1),
    }[move]
    order.insert(target, component_id)
    changes: dict[str, int] = {}
    for index, key in enumerate(order):
        meta = as_dict(as_dict(layout.get(key)).get("meta"))
        if meta.get(Z_KEY) != index + 1:
            changes[key] = index + 1
    return changes
