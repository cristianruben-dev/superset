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
The format tools: what they write in the layout, the rules of the Format pane
they keep (catalog keys, own settings, safe pictures) and who may use them.
"""

import base64
from typing import Any

import pytest

from superset.models.dashboard import Dashboard
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    layout,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user, call

EDITORS = ["Dani", "Ana", "Ada"]
NOT_EDITORS = ["Vera", "Carlos"]

# The smallest PNG there is: one transparent pixel
PNG = base64.b64encode(
    bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
        "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
    )
).decode()

WRITES: list[tuple[str, dict[str, Any]]] = [
    (
        "format_visual",
        {"object": "CHART-1", "level": "general", "patch": {"radius": 8}},
    ),
    ("set_canvas_format", {"background": {"type": "color", "color": "#f8fafc"}}),
    ("set_shared_visual_format", {"patch": {"radius": 6}}),
    ("copy_format", {"source": "CHART-1", "targets": ["MARKDOWN-1"]}),
    ("set_dashboard_css", {"css": ".x { color: red; }"}),
    ("upload_dashboard_background", {"image_base64": PNG}),
    ("upload_dashboard_image", {"image_base64": PNG}),
]


def own_format(world: dict[str, Any], cid: str = "CHART-1") -> dict[str, Any]:
    return layout(world)[cid]["meta"].get("auradataFormat") or {}


def canvas(world: dict[str, Any]) -> dict[str, Any]:
    return layout(world)["ROOT_ID"]["meta"].get("auradataCanvas") or {}


@pytest.mark.asyncio
@pytest.mark.parametrize(("tool", "request_"), WRITES)
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_format(
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
@pytest.mark.parametrize(("tool", "request_"), WRITES)
async def test_editors_and_workspace_editors_format(
    world: dict[str, Any], name: str, tool: str, request_: dict[str, Any]
) -> None:
    as_user(world, name)
    result = await call(tool, {"dashboard": world["dashboard"].id, **request_})

    assert result.get("error") is None, result
    assert result["changed"] or tool == "upload_dashboard_image"


@pytest.mark.asyncio
async def test_format_options_of_a_chart(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    result = ok(
        await call(
            "get_format_options",
            {"dashboard": world["dashboard"].id, "object": "CHART-1"},
        )
    )
    assert result["viz_type"] == "big_number_total"
    keys = {c["key"] for s in result["sections"] for c in s["controls"]}
    assert "card_value_font" in keys
    assert "metric" not in keys
    assert "title" in result["general"]["settings"]
    assert "auradata_tooltip" in result["general"]["chart_settings"]

    bar = ok(
        await call(
            "get_format_options",
            {"viz_type": "echarts_timeseries_bar", "level": "analytics"},
        )
    )
    ids = {s["id"] for s in bar["sections"]}
    assert {"analytics-reference", "analytics-trend", "analytics-tooltip"} <= ids
    assert bar["general"] is None

    # Descriptions come with one section, so the answer stays small
    described = ok(
        await call(
            "get_format_options",
            {"viz_type": "mixed_timeseries", "descriptions": True},
        )
    )
    assert not any(
        "description" in c for s in described["sections"] for c in s["controls"]
    )
    legend = ok(
        await call(
            "get_format_options",
            {"viz_type": "mixed_timeseries", "section": "legend", "descriptions": True},
        )
    )
    assert any("description" in c for c in legend["sections"][0]["controls"])

    unknown = await call("get_format_options", {"viz_type": "nope"})
    assert unknown["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_format_visual_writes_each_level(world: dict[str, Any]) -> None:
    result = ok(
        await as_editor(
            world,
            "format_visual",
            object=world["chart"].id,
            level="visual",
            patch={"card_value_underline": True, "card_label_show": False},
        )
    )
    assert own_format(world)["chart"] == {
        "card_value_underline": True,
        "card_label_show": False,
    }
    assert result["formats"]["CHART-1"]["chart"]["card_label_show"] is False

    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="general",
            patch={
                "title": {"show": True, "size": 18},
                "background": "#ffffff",
                "auradata_tooltip": {"show": True, "fontSize": 12},
            },
        )
    )
    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="general",
            patch={"title": {"size": None}, "auradata_tooltip": {"bold": True}},
        )
    )
    own = own_format(world)
    assert own["title"] == {"show": True}
    assert own["background"] == "#ffffff"
    assert own["chart"]["auradata_tooltip"] == {
        "show": True,
        "fontSize": 12,
        "bold": True,
    }
    assert own["chart"]["card_value_underline"] is True

    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="visual",
            patch={"card_value_underline": None, "card_label_show": None},
        )
    )
    assert "card_label_show" not in own_format(world)["chart"]


@pytest.mark.asyncio
async def test_format_visual_refuses_what_the_pane_would_not_write(
    world: dict[str, Any],
) -> None:
    before = layout(world)
    for level, patch in [
        ("visual", {"metric": "count"}),
        ("visual", {"card_label_show": "no"}),
        ("analytics", {"card_label_show": True}),
        ("general", {"titel": {"show": True}}),
        ("general", {"link": {"action": {"type": "url", "url": "javascript:x"}}}),
        ("general", {"link": {"action": {"type": "page", "tabId": "TAB-9"}}}),
    ]:
        result = await as_editor(
            world, "format_visual", object="CHART-1", level=level, patch=patch
        )
        assert result["error_type"] == "InvalidFormat", (patch, result)
    # A text box has no chart settings
    text = await as_editor(
        world,
        "format_visual",
        object="MARKDOWN-1",
        level="visual",
        patch={"card_label_show": True},
    )
    assert text["error_type"] == "InvalidRequest"
    assert layout(world) == before


@pytest.mark.asyncio
async def test_set_canvas_format_fits_objects_into_a_smaller_page(
    world: dict[str, Any],
) -> None:
    result = ok(
        await as_editor(
            world,
            "set_canvas_format",
            size={"mode": "custom", "width": 24, "height": 20},
            background={"type": "gradient", "color": "#2563EB", "color2": "#7C3AED"},
            tabs={"accent": "#10B981"},
        )
    )
    saved = canvas(world)
    assert saved["size"] == {"mode": "custom", "width": 768, "height": 640}
    assert saved["background"]["type"] == "gradient"
    assert saved["tabs"] == {"accent": "#10B981"}
    # The text box at x 20, 10 cells wide, moves back inside 24 columns
    meta = layout(world)["MARKDOWN-1"]["meta"]
    assert meta["auradataPos"]["x"] + meta["width"] <= 24
    assert "MARKDOWN-1" in result["changed"]
    assert result["warnings"]


@pytest.mark.asyncio
async def test_set_canvas_format_refuses_pictures_of_other_sites(
    world: dict[str, Any],
) -> None:
    before = layout(world)
    for background in [
        {"type": "image", "image": "https://evil.example/x.png"},
        {"type": "color", "color": "red; background: url(https://evil.example)"},
        {"type": "image"},
    ]:
        result = await as_editor(world, "set_canvas_format", background=background)
        assert result["error"], background
    assert layout(world) == before


@pytest.mark.asyncio
async def test_shared_format_keeps_what_belongs_to_each_chart(
    world: dict[str, Any],
) -> None:
    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="general",
            patch={"radius": 2, "title": {"subtitle": "Mío", "size": 20}},
        )
    )
    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="visual",
            patch={"card_label_text": "Ventas", "card_label_show": False},
        )
    )
    ok(
        await as_editor(
            world,
            "set_shared_visual_format",
            from_object="CHART-1",
            patch={"background": "#f1f5f9", "chart": {"show_legend": False}},
        )
    )
    shared = canvas(world)["visuals"]
    assert shared["background"] == "#f1f5f9"
    assert shared["radius"] == 2
    assert "subtitle" not in shared["title"]
    assert shared["chart"] == {"card_label_show": False, "show_legend": False}
    # Charts keep only what is their own
    assert own_format(world) == {
        "title": {"subtitle": "Mío"},
        "chart": {"card_label_text": "Ventas"},
    }

    refused = await as_editor(
        world, "set_shared_visual_format", patch={"chart": {"metrics": ["x"]}}
    )
    assert refused["error_type"] == "InvalidFormat"


@pytest.mark.asyncio
async def test_copy_format_keeps_the_target_own_settings(
    world: dict[str, Any],
) -> None:
    ok(
        await as_editor(
            world,
            "format_visual",
            object="CHART-1",
            level="general",
            patch={"background": "#000000", "title": {"subtitle": "Solo mío"}},
        )
    )
    result = ok(
        await as_editor(
            world, "copy_format", source="CHART-1", targets=["MARKDOWN-1", "CHART-1"]
        )
    )
    assert result["changed"] == ["MARKDOWN-1"]
    copied = own_format(world, "MARKDOWN-1")
    assert copied["background"] == "#000000"
    assert "subtitle" not in (copied.get("title") or {})


@pytest.mark.asyncio
async def test_set_dashboard_css(world: dict[str, Any]) -> None:
    result = ok(
        await as_editor(world, "set_dashboard_css", css=".ant-card { color: red; }")
    )
    assert result["warnings"]
    session = world["session"]
    session.expire_all()
    assert session.get(Dashboard, world["dashboard"].id).css == (
        ".ant-card { color: red; }"
    )
    for css in [
        "@import url(https://evil.example/x.css);",
        ".x { background: url('https://evil.example/x.png'); }",
        "@\\69mport 'https://evil.example/x.css';",
        ".x { background: \\75rl(https://evil.example/x.png); }",
        '.x { background: image-set("https://evil.example/x.png" 1x); }',
    ]:
        refused = await as_editor(world, "set_dashboard_css", css=css)
        assert refused["error_type"] == "InvalidFormat"


@pytest.mark.asyncio
async def test_upload_background_sets_the_canvas(world: dict[str, Any]) -> None:
    result = ok(
        await as_editor(
            world, "upload_dashboard_background", image_base64=PNG, fit="contain"
        )
    )
    url = result["url"]
    assert url.startswith(f"/api/v1/dashboard_background/{world['dashboard'].id}/")
    assert canvas(world)["background"] == {
        "type": "image",
        "image": url,
        "fit": "contain",
    }


@pytest.mark.asyncio
async def test_uploads_only_take_pictures(world: dict[str, Any]) -> None:
    before = layout(world)
    for encoded in [
        "not base64!",
        base64.b64encode(b"<svg onload=alert(1)>").decode(),
    ]:
        result = await as_editor(
            world, "upload_dashboard_background", image_base64=encoded
        )
        assert result["error_type"] == "InvalidRequest", result
    image = ok(await as_editor(world, "upload_dashboard_image", image_base64=PNG))
    assert image["image_id"]
    assert image["changed"] == []
    not_image = await as_editor(
        world, "upload_dashboard_image", image_base64=PNG, object="CHART-1"
    )
    assert not_image["error_type"] == "InvalidRequest"
    assert layout(world) == before


@pytest.mark.asyncio
async def test_option_code_with_a_picture_of_another_site_is_refused(
    world: dict[str, Any],
) -> None:
    before = layout(world)
    code = "{ graphic: [{ type: 'image', style: { image: 'https://e.com/t.png' } }] }"
    result = await as_editor(
        world, "set_shared_visual_format", patch={"chart": {"echart_options": code}}
    )
    assert result["error_type"] == "InvalidFormat"
    assert "another site" in result["error"]
    assert layout(world) == before
