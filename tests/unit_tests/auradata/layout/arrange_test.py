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
"""Align, distribute and stack order, as ``src/auradata/format/arrange.ts``."""

from typing import Any

from superset.auradata.layout import (
    align_cells,
    distribute_cells,
    is_locked,
    layer_order,
    page_objects,
)


def layout(*boxes: tuple[str, int, int, int, int]) -> dict[str, Any]:
    items = {
        cid: {
            "id": cid,
            "type": "CHART",
            "children": [],
            "meta": {"width": w, "height": h, "auradataPos": {"x": x, "y": y}},
        }
        for cid, x, y, w, h in boxes
    }
    return {
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {"id": "GRID_ID", "type": "GRID", "children": list(items)},
        **items,
    }


def test_align() -> None:
    page = layout(("A", 2, 0, 4, 4), ("B", 10, 3, 6, 5))
    assert align_cells(page, ["A", "B"], "left") == {"B": {"x": 2, "y": 3}}
    assert align_cells(page, ["A", "B"], "right") == {"A": {"x": 12, "y": 0}}
    assert align_cells(page, ["A", "B"], "bottom") == {"A": {"x": 2, "y": 4}}
    # Middle of 0..8 for a box of 5 is 1.5, which JavaScript rounds up
    assert align_cells(page, ["A", "B"], "middle") == {
        "A": {"x": 2, "y": 2},
        "B": {"x": 10, "y": 2},
    }
    assert align_cells(page, ["A"], "left") == {}


def test_distribute() -> None:
    page = layout(("A", 0, 0, 4, 2), ("B", 5, 0, 4, 2), ("C", 20, 0, 4, 2))
    # Free span 12 in two gaps of 6
    assert distribute_cells(page, ["A", "B", "C"], "horizontal") == {
        "B": {"x": 10, "y": 0}
    }
    assert distribute_cells(page, ["A", "B"], "horizontal") == {}


def test_layer_order() -> None:
    page = layout(("A", 0, 0, 4, 2), ("B", 5, 0, 4, 2), ("C", 20, 0, 4, 2))
    assert page_objects(page, "GRID_ID") == ["A", "B", "C"]
    assert layer_order(page, "GRID_ID", "A", "front") == {"B": 1, "C": 2, "A": 3}
    assert layer_order(page, "GRID_ID", "C", "backward") == {"A": 1, "C": 2, "B": 3}
    assert layer_order(page, "GRID_ID", "X", "front") == {}


def test_is_locked() -> None:
    page = layout(("A", 0, 0, 4, 2))
    assert not is_locked(page, "A")
    page["A"]["meta"]["auradataLocked"] = True
    assert is_locked(page, "A")
