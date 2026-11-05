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
The page and object tools: what they write, the rules they keep (inside the
page, no overlap, locked objects) and who may use them.
"""

from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.models.dashboard import Dashboard
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    layout,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user, call

EDITORS = ["Dani", "Ana", "Ada"]
NOT_EDITORS = ["Vera", "Carlos"]

# Permissions of every write

WRITES: list[tuple[str, dict[str, Any]]] = [
    ("add_page", {"name": "Detalle"}),
    ("rename_page", {"page": 1, "name": "Resumen"}),
    ("reorder_pages", {"order": [1]}),
    ("duplicate_page", {"page": 1}),
    ("delete_page", {"page": 1}),
    ("set_page_hidden", {"page": 1, "hidden": False}),
    ("place_object", {"object": "MARKDOWN-1", "x": 30, "y": 10}),
    ("move_object", {"object": "MARKDOWN-1", "dx": 2}),
    ("resize_object", {"object": "MARKDOWN-1", "width": 8}),
    ("align_objects", {"objects": ["CHART-1", "MARKDOWN-1"], "mode": "top"}),
    (
        "distribute_objects",
        {"objects": ["CHART-1", "MARKDOWN-1", "MARKDOWN-1"], "axis": "horizontal"},
    ),
    ("bring_to_front", {"object": "CHART-1"}),
    ("set_object_state", {"object": "CHART-1", "locked": True}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize(("tool", "request_"), WRITES)
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_write(
    world: dict[str, Any], name: str, tool: str, request_: dict[str, Any]
) -> None:
    before = layout(world)
    as_user(world, name)
    result = await call(tool, {"dashboard": world["dashboard"].id, **request_})

    assert result["error"]
    assert result["error_type"] == ("Forbidden" if name == "Vera" else "NotFound")
    assert result["permission_denied"] is (name == "Vera")
    assert layout(world) == before


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
@pytest.mark.parametrize(
    ("tool", "request_"),
    [w for w in WRITES if w[0] not in ("delete_page", "reorder_pages")],
)
async def test_editors_and_workspace_editors_write(
    world: dict[str, Any], name: str, tool: str, request_: dict[str, Any]
) -> None:
    before = layout(world)
    as_user(world, name)
    result = await call(tool, {"dashboard": world["dashboard"].id, **request_})

    assert result.get("error") is None, result
    if result["changed"]:
        assert layout(world) != before
    # A workspace role never makes anyone an editor
    session = world["session"]
    editors = session.get(Dashboard, world["dashboard"].id).editors
    assert [subject.user_id for subject in editors] == [world["users"]["Dani"].id]


# Pages


@pytest.mark.asyncio
async def test_a_second_page_makes_the_first_from_the_report(
    world: dict[str, Any],
) -> None:
    result = ok(await as_editor(world, "add_page", name="Detalle"))
    data = layout(world)
    tabs = data[data["ROOT_ID"]["children"][0]]
    assert tabs["type"] == "TABS"
    first, second = tabs["children"]
    assert second == result["page"]
    assert data[first]["meta"]["text"] == "Página 1"
    assert data[first]["children"] == ["ROW-1"]
    # The mobile layout goes with the objects to the first page
    assert data[first]["meta"]["auradataMobile"]["items"][0]["id"] == "CHART-1"
    assert "auradataMobile" not in data["GRID_ID"].get("meta", {})
    assert data["GRID_ID"]["children"] == []
    assert data[second]["meta"]["text"] == "Detalle"
    assert data["CHART-1"]["parents"] == ["ROOT_ID", tabs["id"], first, "ROW-1"]


@pytest.mark.asyncio
async def test_pages_rename_reorder_hide_and_delete(world: dict[str, Any]) -> None:
    ok(await as_editor(world, "add_page", name="Detalle"))
    ok(await as_editor(world, "add_page", name="Notas", position=1))

    async def names() -> list[str]:
        structure = ok(
            await call("get_report_structure", {"dashboard": world["dashboard"].id})
        )
        return [page["name"] for page in structure["pages"]]

    assert await names() == ["Notas", "Página 1", "Detalle"]

    ok(await as_editor(world, "rename_page", page="Página 1", name="Resumen"))
    ok(await as_editor(world, "reorder_pages", order=["Resumen", "Detalle", "Notas"]))
    assert await names() == ["Resumen", "Detalle", "Notas"]

    refused = await as_editor(world, "reorder_pages", order=["Resumen", "Detalle"])
    assert refused["error_type"] == "InvalidRequest"

    ok(await as_editor(world, "set_page_hidden", page="Notas", hidden=True))
    structure = ok(
        await call("get_report_structure", {"dashboard": world["dashboard"].id})
    )
    assert [p["hidden"] for p in structure["pages"]] == [False, False, True]

    result = ok(await as_editor(world, "delete_page", page="Resumen"))
    assert result["removed_chart_ids"] == [world["chart"].id]
    assert await names() == ["Detalle", "Notas"]
    session = world["session"]
    session.expire_all()
    assert session.get(Dashboard, world["dashboard"].id).slices == []


@pytest.mark.asyncio
async def test_the_last_page_stays(world: dict[str, Any]) -> None:
    result = await as_editor(world, "delete_page", page=1)
    assert result["error_type"] == "InvalidRequest"
    ok(await as_editor(world, "add_page"))
    ok(await as_editor(world, "set_page_hidden", page=2, hidden=True))
    refused = await as_editor(world, "set_page_hidden", page=1, hidden=True)
    assert "visible page" in refused["error"]


@pytest.mark.asyncio
async def test_duplicate_page_copies_its_charts(world: dict[str, Any]) -> None:
    result = ok(await as_editor(world, "duplicate_page", page=1, name="Copia"))
    [clone_id] = result["created_chart_ids"]
    data = layout(world)
    copy = data[result["page"]]
    assert copy["meta"]["text"] == "Copia"
    charts = [
        data[cid]
        for cid in data
        if isinstance(data[cid], dict) and data[cid].get("type") == "CHART"
    ]
    assert sorted(c["meta"]["chartId"] for c in charts) == sorted(
        [world["chart"].id, clone_id]
    )
    copied = [c for c in charts if c["meta"]["chartId"] == clone_id][0]
    assert copied["meta"]["auradataPos"] == {"x": 0, "y": 0}
    # Its mobile layout names the copied objects
    assert copy["meta"]["auradataMobile"]["items"][0]["id"] == copied["id"]
    session = world["session"]
    session.expire_all()
    dashboard = session.get(Dashboard, world["dashboard"].id)
    assert sorted(c.id for c in dashboard.slices) == sorted(
        [world["chart"].id, clone_id]
    )


# Objects


@pytest.mark.asyncio
async def test_place_object_takes_the_first_free_cell(world: dict[str, Any]) -> None:
    result = ok(await as_editor(world, "place_object", object="MARKDOWN-1"))
    # Its own cell is free for it, so it moves next to the chart
    assert result["boxes"]["MARKDOWN-1"] == {"x": 12, "y": 0, "width": 10, "height": 6}


@pytest.mark.asyncio
async def test_place_object_on_another_page(world: dict[str, Any]) -> None:
    page = ok(await as_editor(world, "add_page", name="Detalle"))["page"]
    result = ok(
        await as_editor(world, "place_object", object=world["chart"].id, page="Detalle")
    )
    assert result["page"] == page
    data = layout(world)
    assert data["CHART-1"]["parents"][-2] == page
    assert data["CHART-1"]["meta"]["auradataPos"] == {"x": 0, "y": 0}


@pytest.mark.asyncio
async def test_objects_never_land_on_others(world: dict[str, Any]) -> None:
    before = layout(world)
    result = await as_editor(world, "move_object", object="MARKDOWN-1", x=5, y=5)
    assert result["error_type"] == "Overlap"
    assert layout(world) == before

    ok(
        await as_editor(
            world, "move_object", object="MARKDOWN-1", x=5, y=5, allow_overlap=True
        )
    )
    assert layout(world)["MARKDOWN-1"]["meta"]["auradataPos"] == {"x": 5, "y": 5}


@pytest.mark.asyncio
async def test_objects_stay_inside_the_page(world: dict[str, Any]) -> None:
    result = ok(await as_editor(world, "move_object", object="MARKDOWN-1", x=58, y=40))
    assert result["boxes"]["MARKDOWN-1"] == {"x": 50, "y": 28, "width": 10, "height": 6}
    assert result["warnings"]

    result = ok(await as_editor(world, "resize_object", object="MARKDOWN-1", width=99))
    assert result["boxes"]["MARKDOWN-1"]["width"] == 60
    assert result["boxes"]["MARKDOWN-1"]["x"] == 0
    assert result["warnings"]


@pytest.mark.asyncio
async def test_charts_keep_their_least_size(world: dict[str, Any]) -> None:
    result = ok(
        await as_editor(world, "resize_object", object="CHART-1", width=1, height=1)
    )
    assert result["boxes"]["CHART-1"] == {"x": 0, "y": 0, "width": 4, "height": 3}


@pytest.mark.asyncio
async def test_align_and_distribute(world: dict[str, Any]) -> None:
    ok(await as_editor(world, "move_object", object="MARKDOWN-1", y=20))
    result = ok(
        await as_editor(
            world, "align_objects", objects=["CHART-1", "MARKDOWN-1"], mode="top"
        )
    )
    assert result["boxes"] == {
        "MARKDOWN-1": {"x": 20, "y": 0, "width": 10, "height": 6}
    }

    refused = await as_editor(
        world, "align_objects", objects=["CHART-1", "MARKDOWN-1"], mode="left"
    )
    assert refused["error_type"] == "Overlap"


@pytest.mark.asyncio
async def test_locked_objects_do_not_move(world: dict[str, Any]) -> None:
    ok(await as_editor(world, "move_object", object="MARKDOWN-1", y=20))
    ok(await as_editor(world, "set_object_state", object="MARKDOWN-1", locked=True))
    refused = await as_editor(world, "move_object", object="MARKDOWN-1", dx=1)
    assert refused["error_type"] == "Locked"

    result = ok(
        await as_editor(
            world, "align_objects", objects=["CHART-1", "MARKDOWN-1"], mode="top"
        )
    )
    assert result["skipped_locked"] == ["MARKDOWN-1"]
    assert result["changed"] == []


@pytest.mark.asyncio
async def test_object_state(world: dict[str, Any]) -> None:
    ok(
        await as_editor(
            world,
            "set_object_state",
            object=world["chart"].id,
            hidden=True,
            alt_text="Ventas del mes",
        )
    )
    meta = layout(world)["CHART-1"]["meta"]
    assert meta["auradataHidden"] is True
    assert meta["auradataAltText"] == "Ventas del mes"

    ok(
        await as_editor(
            world, "set_object_state", object="CHART-1", hidden=False, alt_text=""
        )
    )
    meta = layout(world)["CHART-1"]["meta"]
    assert "auradataHidden" not in meta
    assert "auradataAltText" not in meta


@pytest.mark.asyncio
async def test_bring_to_front(world: dict[str, Any]) -> None:
    result = ok(await as_editor(world, "bring_to_front", object="CHART-1"))
    assert sorted(result["changed"]) == ["CHART-1", "MARKDOWN-1"]
    data = layout(world)
    assert data["CHART-1"]["meta"]["auradataZ"] == 2
    assert data["MARKDOWN-1"]["meta"]["auradataZ"] == 1


@pytest.mark.asyncio
async def test_writes_go_through_the_update_command(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    from superset.commands.dashboard.update import UpdateDashboardCommand

    spy = mocker.spy(UpdateDashboardCommand, "run")
    ok(await as_editor(world, "rename_page", page=1, name="Resumen"))
    assert spy.call_count == 1
