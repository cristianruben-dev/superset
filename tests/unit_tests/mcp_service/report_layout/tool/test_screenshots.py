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
get_dashboard_screenshot and get_visual_screenshot: who may look at a report,
which page and element the browser opens, and the picture they return. The
browser itself is replaced by a picture of 2000 x 1000 px.
"""

import base64
import io
from typing import Any

import pytest
from fastmcp import Client
from PIL import Image
from pytest_mock import MockerFixture

from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user


@pytest.fixture
def browser(mocker: MockerFixture) -> Any:
    picture = io.BytesIO()
    Image.new("RGB", (2000, 1000), "white").save(picture, format="PNG")
    return mocker.patch(
        "superset.utils.screenshots.DashboardScreenshot.get_screenshot",
        autospec=True,
        return_value=picture.getvalue(),
    )


async def look(tool: str, request: dict[str, Any]) -> tuple[dict[str, Any], Any]:
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
    images = [item for item in result.content if item.type == "image"]
    return json.loads(result.content[0].text), images[0] if images else None


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Vera", "Root"])
async def test_who_sees_the_report_looks_at_it(
    world: dict[str, Any], browser: Any, name: str
) -> None:
    as_user(world, name)
    info, image = await look(
        "get_dashboard_screenshot", {"dashboard": world["dashboard"].id}
    )

    assert info.get("error") is None, info
    assert info["page"] == "GRID_ID"
    assert info["url"].endswith(f"/dashboard/{world['dashboard'].id}/")
    # Shrunk to 1600 px on its longest side, as a JPEG
    assert (info["width"], info["height"]) == (1600, 800)
    assert image.mimeType == "image/jpeg"
    picture = Image.open(io.BytesIO(base64.b64decode(image.data)))
    assert picture.size == (1600, 800)
    (screenshot,) = browser.call_args.args
    # The whole 16:9 page, plus the top bar
    assert browser.call_args.kwargs["window_size"] == (1920, 1088 + 160)
    assert screenshot.element == "standalone"


@pytest.mark.asyncio
async def test_a_stranger_does_not_look(world: dict[str, Any], browser: Any) -> None:
    as_user(world, "Carlos")
    info, image = await look(
        "get_dashboard_screenshot", {"dashboard": world["dashboard"].id}
    )
    assert info["error_type"] == "NotFound"
    assert image is None
    browser.assert_not_called()


@pytest.mark.asyncio
async def test_a_page_opens_as_the_active_tab(
    world: dict[str, Any], browser: Any, mocker: MockerFixture
) -> None:
    page = ok(await as_editor(world, "add_page", name="Detalle"))["page"]
    create = mocker.patch(
        "superset.commands.dashboard.permalink.create."
        "CreateDashboardPermalinkCommand.run",
        return_value="abc123",
    )
    as_user(world, "Vera")
    info, image = await look(
        "get_dashboard_screenshot",
        {"dashboard": world["dashboard"].id, "page": "Detalle"},
    )

    assert info["page"] == page
    assert info["url"].endswith("/dashboard/p/abc123/")
    assert image is not None
    create.assert_called_once()


@pytest.mark.asyncio
async def test_a_visual_is_its_chart_element(
    world: dict[str, Any], browser: Any
) -> None:
    as_user(world, "Vera")
    chart_id = world["chart"].id
    info, image = await look(
        "get_visual_screenshot",
        {"dashboard": world["dashboard"].id, "object": chart_id},
    )

    assert info["object"] == "CHART-1"
    assert image is not None
    (screenshot,) = browser.call_args.args
    assert screenshot.element == f"dashboard-chart-id-{chart_id}"


@pytest.mark.asyncio
async def test_only_charts_have_a_visual_screenshot(
    world: dict[str, Any], browser: Any
) -> None:
    as_user(world, "Vera")
    info, image = await look(
        "get_visual_screenshot",
        {"dashboard": world["dashboard"].id, "object": "MARKDOWN-1"},
    )
    assert info["error_type"] == "InvalidRequest"
    browser.assert_not_called()


@pytest.mark.asyncio
async def test_a_browser_failure_is_reported(
    world: dict[str, Any], browser: Any
) -> None:
    browser.side_effect = RuntimeError("Playwright is required")
    as_user(world, "Vera")
    info, image = await look(
        "get_dashboard_screenshot", {"dashboard": world["dashboard"].id}
    )
    assert info["error_type"] == "ScreenshotUnavailable"
    assert image is None


@pytest.mark.asyncio
async def test_a_phone_shows_the_whole_mobile_layout(
    world: dict[str, Any], browser: Any
) -> None:
    as_user(world, "Vera")
    info, image = await look(
        "get_dashboard_screenshot",
        {"dashboard": world["dashboard"].id, "device": "phone"},
    )

    assert info.get("error") is None, info
    assert info["device"] == "phone"
    assert info["mobile_layout"] is True
    assert image is not None
    # 393 pt wide; the phone page (at least 24 cells of 12) scaled to it, plus
    # the top bar
    assert browser.call_args.kwargs["window_size"] == (393, 24 * 393 // 12 + 160)


@pytest.mark.asyncio
async def test_a_phone_without_mobile_layout_shows_the_scaled_canvas(
    world: dict[str, Any], browser: Any
) -> None:
    ok(await as_editor(world, "clear_mobile_layout"))
    as_user(world, "Vera")
    info, _ = await look(
        "get_dashboard_screenshot",
        {"dashboard": world["dashboard"].id, "device": "phone"},
    )

    assert info["mobile_layout"] is False
    # The 60 x 34 cell canvas at 393 px wide is short: a whole phone screen
    assert browser.call_args.kwargs["window_size"] == (393, 852)
