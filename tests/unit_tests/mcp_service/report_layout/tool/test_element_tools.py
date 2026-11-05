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
The design element and slicer tools: what they write in the layout and in the
native filters, the rules of the editor they keep (catalog settings, safe
pictures and links, styles per kind of filter) and who may use them.
"""

import base64
from typing import Any

import pytest

from superset.connectors.sqla.models import TableColumn
from superset.models.dashboard import Dashboard
from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    layout,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user, call

EDITORS = ["Dani", "Ana", "Ada"]
NOT_EDITORS = ["Vera", "Carlos"]

PNG = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )
).decode()


def filters(world: dict[str, Any]) -> list[dict[str, Any]]:
    session = world["session"]
    session.expire_all()
    dashboard = session.get(Dashboard, world["dashboard"].id)
    metadata = json.loads(dashboard.json_metadata or "{}")
    return metadata.get("native_filter_configuration") or []


def slicer_request(world: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return {
        "name": "Región",
        "dataset_id": world["ventas"].id,
        "column": "region",
        **extra,
    }


def writes(world: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        ("add_element", {"kind": "shape"}),
        ("add_slicer", slicer_request(world)),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_add(
    world: dict[str, Any], name: str
) -> None:
    before = layout(world)
    as_user(world, name)
    for tool, request in writes(world):
        result = await call(tool, {"dashboard": world["dashboard"].id, **request})
        assert result["error_type"] == ("Forbidden" if name == "Vera" else "NotFound")
        assert result["permission_denied"] is (name == "Vera")
    assert layout(world) == before
    assert filters(world) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
async def test_editors_and_workspace_editors_add_and_change(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    dashboard = world["dashboard"].id
    shape = ok(await call("add_element", {"dashboard": dashboard, "kind": "shape"}))
    slicer = ok(
        await call("add_slicer", {"dashboard": dashboard, **slicer_request(world)})
    )
    for tool, request in (
        ("update_element", {"object": shape["object"], "settings": {"radius": 4}}),
        ("format_element", {"object": shape["object"], "patch": {"radius": 8}}),
        ("update_slicer", {"object": slicer["object"], "variant": "buttons"}),
        (
            "format_slicer",
            {"object": slicer["object"], "level": "visual", "patch": {"itemGap": 4}},
        ),
        ("remove_element", {"object": shape["object"]}),
    ):
        result = await call(tool, {"dashboard": dashboard, **request})
        assert result.get("error") is None, (tool, result)
        assert result["changed"]
    # A viewer of the workspace changes nothing of it
    as_user(world, "Vera")
    refused = await call(
        "update_slicer",
        {"dashboard": dashboard, "object": slicer["object"], "variant": "list"},
    )
    assert refused["permission_denied"] is True


CHANGES = [
    ("update_element", "shape", {"settings": {"radius": 4}}),
    ("format_element", "shape", {"patch": {"radius": 8}}),
    ("remove_element", "shape", {}),
    ("update_slicer", "slicer", {"variant": "list"}),
    ("format_slicer", "slicer", {"level": "general", "patch": {"radius": 2}}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
@pytest.mark.parametrize(("tool", "target", "request_"), CHANGES)
async def test_viewers_and_strangers_cannot_change_elements(
    world: dict[str, Any],
    name: str,
    tool: str,
    target: str,
    request_: dict[str, Any],
) -> None:
    objects = {
        "shape": ok(await as_editor(world, "add_element", kind="shape"))["object"],
        "slicer": ok(await as_editor(world, "add_slicer", **slicer_request(world)))[
            "object"
        ],
    }
    before, filters_before = layout(world), filters(world)
    as_user(world, name)
    result = await call(
        tool,
        {"dashboard": world["dashboard"].id, "object": objects[target], **request_},
    )
    assert result["error_type"] == ("Forbidden" if name == "Vera" else "NotFound")
    assert result["permission_denied"] is (name == "Vera")
    assert layout(world) == before
    assert filters(world) == filters_before


@pytest.mark.asyncio
async def test_add_element_writes_a_dynamic_component_at_a_free_cell(
    world: dict[str, Any],
) -> None:
    result = ok(
        await as_editor(
            world,
            "add_element",
            kind="button",
            settings={"label": "Ver detalle", "normal": {"fill": "#2563EB"}},
        )
    )
    item = layout(world)[result["object"]]
    meta = item["meta"]
    assert item["type"] == "DYNAMIC"
    assert meta["componentKey"] == "auradata-button"
    assert meta["background"] == "BACKGROUND_TRANSPARENT"
    # Defaults of a new button, with the patch over them
    assert meta["auradataElement"]["kind"] == "button"
    assert meta["auradataElement"]["label"] == "Ver detalle"
    assert meta["auradataElement"]["icon"] == "ArrowRightOutlined"
    assert meta["auradataElement"]["normal"] == {"fill": "#2563EB"}
    assert meta["auradataFormat"]["shadow"] == "none"
    assert (meta["width"], meta["height"]) == (8, 2)
    # The chart sits at (0, 0) 12 wide: the button goes next to it
    assert meta["auradataPos"] == {"x": 12, "y": 0}
    rows = [
        cid
        for cid, row in layout(world).items()
        if isinstance(row, dict) and result["object"] in (row.get("children") or [])
    ]
    assert layout(world)[rows[0]]["type"] == "ROW"


@pytest.mark.asyncio
async def test_add_element_refuses_overlap_and_bad_settings(
    world: dict[str, Any],
) -> None:
    before = layout(world)
    overlap = await as_editor(world, "add_element", kind="shape", x=0, y=0)
    assert overlap["error_type"] == "Overlap"
    unknown = await as_editor(world, "add_element", kind="shape", settings={"x": 1})
    assert unknown["error_type"] == "InvalidFormat"
    bad_color = await as_editor(
        world, "add_element", kind="shape", settings={"fill": {"color": "url(x)"}}
    )
    assert "fill.color" in bad_color["error"]
    foreign = await as_editor(
        world, "add_element", kind="image", settings={"src": "https://e.com/a.png"}
    )
    assert "src" in foreign["error"]
    managed = await as_editor(
        world, "add_element", kind="image", settings={"imageId": 3}
    )
    assert "imageId" in managed["error"]
    link = await as_editor(
        world,
        "add_element",
        kind="text",
        settings={"html": '<a href="javascript:alert(1)">x</a>'},
    )
    assert "link" in link["error"]
    style = await as_editor(
        world,
        "add_element",
        kind="text",
        settings={"html": '<p style="background:url(https://e.com/t.png)">x</p>'},
    )
    assert "url(" in style["error"]
    assert layout(world) == before


@pytest.mark.asyncio
async def test_image_from_base64_and_its_replacement(world: dict[str, Any]) -> None:
    from superset.auradata.models import DashboardImage

    added = ok(
        await as_editor(world, "add_element", kind="image", image_base64=PNG, x=30, y=0)
    )
    element = added["element"]
    assert element["src"].startswith("/api/v1/dashboard_image/")
    first = element["imageId"]
    replaced = ok(
        await as_editor(
            world, "update_element", object=added["object"], image_base64=PNG
        )
    )
    assert replaced["element"]["imageId"] != first
    session = world["session"]
    assert session.get(DashboardImage, first) is None
    not_an_image = await as_editor(world, "add_element", kind="shape", image_base64=PNG)
    assert not_an_image["error"]


@pytest.mark.asyncio
async def test_button_actions_name_pages_and_bookmarks(world: dict[str, Any]) -> None:
    one_page = await as_editor(
        world,
        "add_element",
        kind="button",
        settings={"action": {"type": "page", "page": 1}},
    )
    assert "one page" in one_page["error"]
    ok(await as_editor(world, "add_page", name="Detalle"))
    button = ok(
        await as_editor(
            world,
            "add_element",
            kind="button",
            page=1,
            settings={"action": {"type": "page", "page": "Detalle"}},
        )
    )
    tab_id = button["element"]["action"]["tabId"]
    assert layout(world)[tab_id]["type"] == "TAB"
    assert "page" not in button["element"]["action"]
    missing = await as_editor(
        world,
        "update_element",
        object=button["object"],
        settings={"action": {"type": "bookmark", "bookmarkId": "nope"}},
    )
    assert "bookmark" in missing["error"]
    back = ok(
        await as_editor(
            world,
            "update_element",
            object=button["object"],
            settings={"action": {"type": "back", "tabId": None}},
        )
    )
    assert back["element"]["action"] == {"type": "back"}


@pytest.mark.asyncio
async def test_add_slicer_writes_the_filter_and_its_element(
    world: dict[str, Any],
) -> None:
    result = ok(
        await as_editor(
            world,
            "add_slicer",
            **slicer_request(
                world,
                variant="buttons",
                selection="single",
                apply_button=True,
                sort="desc",
                hidden_values=["Norte", None, True, 2.0],
                show_in_filter_bar=False,
                default_value=["Sur"],
            ),
        )
    )
    (conf,) = filters(world)
    assert conf["id"] == result["filter_id"]
    assert conf["filterType"] == "filter_select"
    assert conf["targets"] == [
        {"datasetId": world["ventas"].id, "column": {"name": "region"}}
    ]
    assert conf["controlValues"]["multiSelect"] is False
    assert conf["controlValues"]["sortAscending"] is False
    assert conf["defaultDataMask"] == {
        "filterState": {"value": ["Sur"]},
        "extraFormData": {"filters": [{"col": "region", "op": "IN", "val": ["Sur"]}]},
    }
    assert conf["scope"] == {"rootPath": ["ROOT_ID"], "excluded": []}
    meta = layout(world)[result["object"]]["meta"]
    assert meta["componentKey"] == "auradata-filter"
    element = meta["auradataElement"]
    assert element["filterId"] == conf["id"]
    assert element["variant"] == "buttons"
    assert element["selection"] == "single"
    assert element["applyButton"] is True
    assert element["sortValues"] == "desc"
    assert element["showInFilterBar"] is False
    # slicerValueKey writes them as JavaScript's String() does
    assert element["hiddenValues"] == ["Norte", "\u0000blank", "true", "2"]
    assert meta["auradataFormat"] == {"padding": 12, "radius": 12}


@pytest.mark.asyncio
async def test_buttons_stack_unless_their_layout_says_a_row(
    world: dict[str, Any],
) -> None:
    from superset.mcp_service.app import mcp

    # The editor draws buttons in a column by default, and the tool says how
    # to put them in a row
    (tool,) = [t for t in await mcp.list_tools() if t.name == "add_slicer"]
    assert '{"layout": "horizontal"}' in (tool.description or "")
    stacked = ok(
        await as_editor(world, "add_slicer", **slicer_request(world, variant="buttons"))
    )
    row = ok(
        await as_editor(
            world,
            "add_slicer",
            **slicer_request(
                world, variant="buttons", settings={"layout": "horizontal"}
            ),
        )
    )
    data = layout(world)
    assert "layout" not in data[stacked["object"]]["meta"]["auradataElement"]
    assert data[row["object"]]["meta"]["auradataElement"]["layout"] == "horizontal"


@pytest.mark.asyncio
async def test_slicer_of_a_page_and_of_a_range(world: dict[str, Any]) -> None:
    session = world["session"]
    session.add(TableColumn(column_name="importe", type="FLOAT", table=world["ventas"]))
    session.commit()
    page = ok(await as_editor(world, "add_page", name="Detalle"))["page"]
    result = ok(
        await as_editor(
            world,
            "add_slicer",
            name="Importe",
            filter_type="range",
            dataset_id=world["ventas"].id,
            column="importe",
            range_style="slider",
            scope="page",
            page=page,
            default_value=[10, None],
        )
    )
    (conf,) = filters(world)
    assert conf["filterType"] == "filter_range"
    assert conf["scope"] == {"rootPath": [page], "excluded": []}
    assert conf["defaultDataMask"] == {
        "filterState": {"value": [10, None]},
        "extraFormData": {"filters": [{"col": "importe", "op": ">=", "val": 10}]},
    }
    assert layout(world)[result["object"]]["meta"]["auradataElement"]["rangeStyle"] == (
        "slider"
    )
    time = ok(
        await as_editor(
            world,
            "add_slicer",
            name="Fecha",
            filter_type="time",
            date_style="relative",
            default_value="Last month",
        )
    )
    assert time["filter"]["type"] == "time"
    assert filters(world)[1]["defaultDataMask"]["extraFormData"] == {
        "time_range": "Last month"
    }


@pytest.mark.asyncio
async def test_slicer_styles_belong_to_their_kind_of_filter(
    world: dict[str, Any],
) -> None:
    before = layout(world)
    for request in (
        slicer_request(world, range_style="slider"),
        {"name": "Fecha", "filter_type": "time", "variant": "buttons"},
        slicer_request(world, settings={"dateStyle": "between"}),
        {"name": "Fecha", "filter_type": "time", "selection": "single"},
        {"name": "Sin datos"},
    ):
        result = await as_editor(world, "add_slicer", **request)
        assert result["error"], request
    assert layout(world) == before
    assert filters(world) == []


@pytest.mark.asyncio
async def test_slicer_dataset_of_another_workspace(world: dict[str, Any]) -> None:
    from superset.auradata.models import Workspace, WorkspaceDataset

    finanzas: Workspace = world["finanzas_ws"]
    finanzas.datasets.append(WorkspaceDataset(dataset_id=world["compartido"].id))
    world["session"].commit()
    result = await as_editor(
        world, "add_slicer", name="X", dataset_id=world["compartido"].id, column="x"
    )
    assert result["error_type"] in ("Forbidden", "NotFound")
    assert filters(world) == []


@pytest.mark.asyncio
async def test_a_refused_save_keeps_neither_filter_nor_element(
    world: dict[str, Any],
) -> None:
    from superset.commands.dashboard.exceptions import DashboardUpdateFailedError

    before = layout(world)
    world["mocker"].patch(
        "superset.commands.dashboard.update.UpdateDashboardCommand.run",
        side_effect=DashboardUpdateFailedError(),
    )
    result = await as_editor(world, "add_slicer", **slicer_request(world))
    assert result["error_type"] == "DatabaseError"
    assert layout(world) == before
    assert filters(world) == []


@pytest.mark.asyncio
async def test_update_and_format_slicer(world: dict[str, Any]) -> None:
    added = ok(await as_editor(world, "add_slicer", **slicer_request(world)))
    slicer = added["object"]
    ok(
        await as_editor(
            world,
            "update_slicer",
            object=slicer,
            name="Zona",
            selection="ctrl",
            default_value=["Norte", "Sur"],
        )
    )
    (conf,) = filters(world)
    assert conf["name"] == "Zona"
    assert conf["controlValues"]["multiSelect"] is True
    assert conf["defaultDataMask"]["filterState"]["value"] == ["Norte", "Sur"]
    ok(await as_editor(world, "update_slicer", object=slicer, clear_default=True))
    assert filters(world)[0]["defaultDataMask"]["filterState"] == {"value": None}
    ok(
        await as_editor(
            world,
            "format_slicer",
            object=slicer,
            level="visual",
            patch={"selectedFill": "#2563EB", "itemCorners": [4, 4, 0, 0]},
        )
    )
    ok(
        await as_editor(
            world,
            "format_slicer",
            object=slicer,
            level="general",
            patch={"title": {"show": True, "subtitle": "Elige una zona"}},
        )
    )
    meta = layout(world)[slicer]["meta"]
    assert meta["auradataElement"]["selectedFill"] == "#2563EB"
    assert meta["auradataElement"]["itemCorners"] == [4, 4, 0, 0]
    assert meta["auradataElement"]["filterId"] == conf["id"]
    assert meta["auradataFormat"]["title"]["subtitle"] == "Elige una zona"
    wrong = await as_editor(
        world, "format_slicer", object=slicer, level="visual", patch={"filterId": "x"}
    )
    assert wrong["error_type"] == "InvalidFormat"
    # Options tied to the filter go through update_slicer
    tied = await as_editor(
        world,
        "format_slicer",
        object=slicer,
        level="visual",
        patch={"selection": "single"},
    )
    assert "update_slicer" in tied["error"]
    corners = await as_editor(
        world,
        "format_slicer",
        object=slicer,
        level="visual",
        patch={"itemCorners": [1]},
    )
    assert "4 values" in corners["error"]
    not_slicer = await as_editor(
        world, "update_slicer", object="MARKDOWN-1", variant="list"
    )
    assert not_slicer["error"]


@pytest.mark.asyncio
async def test_remove_slicer_takes_its_filter(world: dict[str, Any]) -> None:
    added = ok(await as_editor(world, "add_slicer", **slicer_request(world)))
    ok(await as_editor(world, "remove_element", object=added["object"]))
    assert added["object"] not in layout(world)
    assert filters(world) == []


@pytest.mark.asyncio
async def test_element_options_list_settings_and_defaults(
    world: dict[str, Any],
) -> None:
    as_user(world, "Vera")
    result = ok(await call("get_format_options", {"element": "filter"}))
    settings = result["element"]["settings"]
    assert settings["variant"]["values"] == ["dropdown", "list", "buttons", "input"]
    assert "filterId" not in settings
    assert result["element"]["defaults"]["width"] == 10
    button = ok(await call("get_format_options", {"element": "button"}))
    assert button["element"]["settings"]["action"]["type"] == "object"
