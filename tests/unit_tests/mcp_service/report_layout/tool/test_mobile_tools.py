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
The mobile layout tools: what they propose and write in the page, the
editor's rules they keep and who may use them. The world's chart is a card
(``big_number_total``); its report is one page (``GRID_ID``) holding the card
and a text box, and a mobile layout with the card only.
"""

from typing import Any

import pytest
from fastmcp.exceptions import ToolError

from superset.models.slice import Slice
from superset.subjects.utils import get_or_create_user_subject
from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    layout,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user, call

EDITORS = ["Dani", "Ana", "Ada"]
NOT_EDITORS = ["Vera", "Carlos"]


def mobile_of(world: dict[str, Any], page: str = "GRID_ID") -> Any:
    return (layout(world)[page].get("meta") or {}).get("auradataMobile")


@pytest.fixture
def report(world: dict[str, Any]) -> dict[str, Any]:
    """The world's report with a bar chart under the card and the text box."""
    session = world["session"]
    bar = Slice(
        slice_name="ventas por region",
        viz_type="echarts_timeseries_bar",
        datasource_type="table",
        datasource_id=world["ventas"].id,
    )
    session.add(bar)
    session.flush()
    bar.editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    dashboard = world["dashboard"]
    dashboard.slices = [world["chart"], bar]
    saved = json.loads(dashboard.position_json)
    saved["ROW-1"]["children"].append("CHART-2")
    saved["CHART-2"] = {
        "type": "CHART",
        "id": "CHART-2",
        "children": [],
        "parents": ["ROOT_ID", "GRID_ID", "ROW-1"],
        "meta": {
            "chartId": bar.id,
            "width": 30,
            "height": 12,
            "auradataPos": {"x": 0, "y": 12},
        },
    }
    dashboard.position_json = json.dumps(saved)
    session.commit()
    world["bar"] = bar
    return world


@pytest.mark.asyncio
async def test_generate_proposes_without_writing(report: dict[str, Any]) -> None:
    before = layout(report)
    result = ok(await as_editor(report, "generate_mobile_layout"))
    assert result["applied"] is False
    assert result["page"] == "GRID_ID"
    # The card (0, 0) goes first; the text box (20, 0) keeps its place before
    # the bar (0, 12), which followed it on the canvas
    assert [item["id"] for item in result["items"]] == [
        "CHART-1",
        "MARKDOWN-1",
        "CHART-2",
    ]
    assert result["items"][0]["width"] == 12
    assert result["items"][2] == {
        "id": "CHART-2",
        "x": 0,
        "y": result["items"][1]["y"] + result["items"][1]["height"],
        "width": 12,
        "height": 8,
    }
    assert result["left_out"] == []
    assert layout(report) == before


@pytest.mark.asyncio
async def test_generate_applies_to_the_page(report: dict[str, Any]) -> None:
    result = ok(await as_editor(report, "generate_mobile_layout", apply=True))
    assert result["applied"] is True
    assert mobile_of(report) == {"items": result["items"]}
    assert result["rows"] == 24


@pytest.mark.asyncio
async def test_generate_leaves_hidden_objects_out(report: dict[str, Any]) -> None:
    ok(await as_editor(report, "set_object_state", object="MARKDOWN-1", hidden=True))
    result = ok(await as_editor(report, "generate_mobile_layout", apply=True))
    assert [item["id"] for item in result["items"]] == ["CHART-1", "CHART-2"]
    assert result["left_out"] == ["MARKDOWN-1"]
    assert any("MARKDOWN-1" in warning for warning in result["warnings"])


@pytest.mark.asyncio
async def test_set_takes_chart_ids_and_fits_boxes(report: dict[str, Any]) -> None:
    result = ok(
        await as_editor(
            report,
            "set_mobile_layout",
            items=[
                {"object": report["bar"].id, "x": 0, "y": 0, "width": 12, "height": 9},
                {"object": "CHART-1", "x": 10, "y": 9, "width": 6, "height": 1},
            ],
        )
    )
    assert result["items"] == [
        {"id": "CHART-2", "x": 0, "y": 0, "width": 12, "height": 9},
        {"id": "CHART-1", "x": 6, "y": 9, "width": 6, "height": 3},
    ]
    assert result["left_out"] == ["MARKDOWN-1"]
    assert result["warnings"]
    assert mobile_of(report) == {"items": result["items"]}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("items", "error_type"),
    [
        ([{"object": "CHART-9", "x": 0, "y": 0, "width": 12, "height": 4}], "NotFound"),
        (
            [
                {"object": "CHART-1", "x": 0, "y": 0, "width": 12, "height": 4},
                {"object": "CHART-1", "x": 0, "y": 4, "width": 12, "height": 4},
            ],
            "InvalidRequest",
        ),
        ([{"object": "ROW-1", "x": 0, "y": 0, "width": 12, "height": 4}], None),
    ],
)
async def test_set_refuses_objects_off_the_page_and_repeats(
    report: dict[str, Any], items: list[dict[str, Any]], error_type: str | None
) -> None:
    before = layout(report)
    result = await as_editor(report, "set_mobile_layout", items=items)
    assert result["error"]
    if error_type:
        assert result["error_type"] == error_type
    assert layout(report) == before


@pytest.mark.asyncio
async def test_set_refuses_boxes_past_twelve_columns(report: dict[str, Any]) -> None:
    before = layout(report)
    with pytest.raises(ToolError, match="less than or equal to 12"):
        await as_editor(
            report,
            "set_mobile_layout",
            items=[{"object": "CHART-1", "x": 0, "y": 0, "width": 13, "height": 4}],
        )
    assert layout(report) == before


@pytest.mark.asyncio
async def test_clear_removes_the_layout(report: dict[str, Any]) -> None:
    result = ok(await as_editor(report, "clear_mobile_layout"))
    assert result["applied"] is True
    assert mobile_of(report) is None
    again = ok(await as_editor(report, "clear_mobile_layout"))
    assert again["applied"] is False


@pytest.mark.asyncio
async def test_tooltip_pages_have_no_mobile_layout(report: dict[str, Any]) -> None:
    saved = layout(report)
    saved["GRID_ID"]["meta"]["auradataTooltipPage"] = {"width": 10, "height": 8}
    report["dashboard"].position_json = json.dumps(saved)
    report["session"].commit()
    result = await as_editor(report, "generate_mobile_layout", apply=True)
    assert result["error_type"] == "InvalidRequest"
    assert "tooltip" in result["error"]


def writes() -> list[tuple[str, dict[str, Any]]]:
    return [
        ("generate_mobile_layout", {"apply": True}),
        (
            "set_mobile_layout",
            {
                "items": [
                    {"object": "CHART-2", "x": 0, "y": 0, "width": 12, "height": 8}
                ]
            },
        ),
        ("clear_mobile_layout", {}),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_viewers_and_strangers_change_nothing(
    report: dict[str, Any], name: str
) -> None:
    before = layout(report)
    as_user(report, name)
    for tool, request in writes():
        result = await call(tool, {"dashboard": report["dashboard"].id, **request})
        assert result["error_type"] == (
            "Forbidden" if name == "Vera" else "NotFound"
        ), (tool, result)
        assert result["permission_denied"] is (name == "Vera")
    assert layout(report) == before


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_a_proposal_follows_dashboard_access(
    report: dict[str, Any], name: str
) -> None:
    as_user(report, name)
    result = await call("generate_mobile_layout", {"dashboard": report["dashboard"].id})
    if name == "Vera":
        assert result.get("error") is None, result
    else:
        assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
async def test_editors_and_workspace_editors_change_it(
    report: dict[str, Any], name: str
) -> None:
    as_user(report, name)
    for tool, request in writes():
        result = await call(tool, {"dashboard": report["dashboard"].id, **request})
        assert result.get("error") is None, (tool, result)
        assert result["applied"] is True, tool
    assert mobile_of(report) is None
