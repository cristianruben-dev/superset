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
"""The phone layout the MCP proposes for a report page."""

from typing import Any

from superset.auradata.layout import (
    MOBILE_COLUMNS,
    mobile_layout_of,
    propose_mobile_layout,
)


def _object(cid: str, kind: str, x: int, y: int, w: int, h: int, **meta: Any) -> Any:
    return {
        "type": kind,
        "id": cid,
        "children": [],
        "parents": ["ROOT_ID", "TABS-1", "TAB-1", "ROW-1"],
        "meta": {"width": w, "height": h, "auradataPos": {"x": x, "y": y}, **meta},
    }


def page() -> dict[str, Any]:
    """A 60 cell wide page: a title, a bar, two cards, a slicer, a note, a line."""
    objects = [
        _object("TITLE", "MARKDOWN", 0, 0, 60, 2, code="# Ventas"),
        _object("BAR", "CHART", 0, 2, 30, 12, chartId=1),
        _object("CARD-1", "CHART", 30, 2, 10, 5, chartId=2),
        _object("CARD-2", "CHART", 40, 2, 10, 5, chartId=3),
        _object("SLICER", "DYNAMIC", 50, 2, 10, 3, componentKey="auradata-filter"),
        _object("NOTE", "MARKDOWN", 0, 14, 20, 4, code="Notas"),
        _object("HIDDEN", "CHART", 30, 14, 30, 4, chartId=4, auradataHidden=True),
        _object("LINE", "CHART", 0, 18, 60, 12, chartId=5),
    ]
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["TABS-1"],
            "meta": {"auradataCells": True},
        },
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
        "TABS-1": {"type": "TABS", "id": "TABS-1", "children": ["TAB-1"]},
        "TAB-1": {
            "type": "TAB",
            "id": "TAB-1",
            "children": ["ROW-1"],
            "meta": {"text": "Resumen"},
        },
        # The row lists them out of reading order on purpose
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": [o["id"] for o in reversed(objects)],
            "meta": {},
        },
        **{o["id"]: o for o in objects},
    }


def propose(layout: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        dict(box)
        for box in propose_mobile_layout(
            layout,
            "TAB-1",
            cards={"CARD-1", "CARD-2"},
            first={"CARD-1", "CARD-2", "SLICER"},
            leave_out={"HIDDEN"},
        )
    ]


def test_title_heads_then_cards_and_slicers_then_charts_in_reading_order() -> None:
    assert propose(page()) == [
        {"id": "TITLE", "x": 0, "y": 0, "width": 12, "height": 2},
        {"id": "CARD-1", "x": 0, "y": 2, "width": 6, "height": 3},
        {"id": "CARD-2", "x": 6, "y": 2, "width": 6, "height": 3},
        {"id": "SLICER", "x": 0, "y": 5, "width": 12, "height": 4},
        {"id": "BAR", "x": 0, "y": 9, "width": 12, "height": 8},
        {"id": "NOTE", "x": 0, "y": 17, "width": 12, "height": 2},
        {"id": "LINE", "x": 0, "y": 19, "width": 12, "height": 8},
    ]


def test_the_frontend_reads_the_proposal_back_unchanged() -> None:
    layout = page()
    boxes = propose(layout)
    layout["TAB-1"]["meta"]["auradataMobile"] = {"items": boxes}
    assert mobile_layout_of(layout, "TAB-1") == boxes


def test_boxes_stack_without_gaps_or_overlaps_inside_the_phone() -> None:
    boxes = propose(page())
    for box in boxes:
        assert box["x"] >= 0
        assert box["x"] + box["width"] <= MOBILE_COLUMNS
    rows: dict[int, int] = {}
    for box in boxes:
        rows[box["y"]] = max(rows.get(box["y"], 0), box["height"])
    bottom = 0
    for y in sorted(rows):
        assert y == bottom
        bottom = y + rows[y]


def test_a_wide_card_and_a_lonely_card_take_the_full_width() -> None:
    layout = page()
    layout["CARD-2"]["meta"]["width"] = 30  # half the canvas: not a small card
    boxes = {box["id"]: box for box in propose(layout)}
    assert boxes["CARD-1"]["width"] == MOBILE_COLUMNS
    assert boxes["CARD-2"]["width"] == MOBILE_COLUMNS
    assert boxes["CARD-2"]["y"] == boxes["CARD-1"]["y"] + boxes["CARD-1"]["height"]


def test_tall_charts_stop_at_the_editor_height() -> None:
    layout = page()
    layout["BAR"]["meta"].update(width=20, height=40)
    boxes = {box["id"]: box for box in propose(layout)}
    assert boxes["BAR"]["height"] == 12


def test_a_text_below_the_first_object_stays_with_what_followed_it() -> None:
    layout = page()
    # The note moves just above the cards: it goes up with them
    layout["NOTE"]["meta"]["auradataPos"] = {"x": 30, "y": 1}
    order = [box["id"] for box in propose(layout)]
    assert order == ["TITLE", "NOTE", "CARD-1", "CARD-2", "SLICER", "BAR", "LINE"]


def test_the_shared_fixture_holds_what_the_mcp_proposes() -> None:
    """Jest reads this fixture's boxes back with ``mobileLayoutOf`` unchanged."""
    from pathlib import Path

    from superset.utils import json

    path = Path(__file__).parents[3] / "fixtures/auradata/layouts/mobile_layout_of.json"
    cases = json.loads(path.read_text())["cases"]
    case = next(c for c in cases if c["name"].startswith("a layout generate_"))
    layout, page_id = case["args"]
    del layout[page_id]["meta"]["auradataMobile"]
    assert layout == page()
    assert case["expected"] == propose(layout)
