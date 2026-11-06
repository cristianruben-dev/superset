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
export_dashboard_image and export_dashboard_pdf: who may export a report, which
pages go in and the file they return. The browser is replaced by a picture of
2000 x 1000 px; every page comes out at the size of its canvas.
"""

import base64
import io
import re
from typing import Any

import pytest
from fastmcp import Client
from PIL import Image
from pytest_mock import MockerFixture

from superset.mcp_service.screenshot import export
from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    as_editor,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user

PAGE = (1920, 1088)


@pytest.fixture
def browser(mocker: MockerFixture) -> Any:
    picture = io.BytesIO()
    Image.new("RGB", (2000, 1000), "white").save(picture, format="PNG")
    return mocker.patch(
        "superset.utils.screenshots.DashboardScreenshot.get_screenshot",
        autospec=True,
        return_value=picture.getvalue(),
    )


@pytest.fixture
def permalinks(mocker: MockerFixture) -> Any:
    return mocker.patch(
        "superset.commands.dashboard.permalink.create."
        "CreateDashboardPermalinkCommand.run",
        return_value="abc123",
    )


async def export_file(
    tool: str, request: dict[str, Any]
) -> tuple[dict[str, Any], bytes | None]:
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
    info = json.loads(result.content[0].text)
    if len(result.content) < 2:
        return info, None
    item = result.content[1]
    data = item.data if item.type == "image" else item.resource.blob
    return info, base64.b64decode(data)


async def pages_report(world: dict[str, Any]) -> None:
    """Pages "Página 1", "Detalle", a hidden "Oculta" and a tooltip page."""
    ok(await as_editor(world, "add_page", name="Detalle"))
    ok(await as_editor(world, "add_page", name="Oculta"))
    ok(await as_editor(world, "set_page_hidden", page="Oculta", hidden=True))
    ok(await as_editor(world, "add_page", name="Tooltip"))
    ok(await as_editor(world, "make_tooltip_page", page="Tooltip"))


def pdf_pages(data: bytes) -> int:
    return len(re.findall(rb"/Type\s*/Page\b(?!s)", data))


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada", "Vera", "Root"])
async def test_who_sees_the_report_exports_it(
    world: dict[str, Any], browser: Any, name: str
) -> None:
    as_user(world, name)
    info, data = await export_file(
        "export_dashboard_image", {"dashboard": world["dashboard"].id}
    )

    assert info.get("error") is None, info
    assert info["mime_type"] == "image/png"
    assert [page["id"] for page in info["pages"]] == ["GRID_ID"]
    assert (info["width"], info["height"]) == PAGE
    assert data is not None
    assert Image.open(io.BytesIO(data)).size == PAGE
    (screenshot,) = browser.call_args.args
    assert screenshot.element == "auradata-canvas"
    # Wide enough for the page at its own size beside the filter rail
    assert browser.call_args.kwargs["window_size"] == (1920 + 72, 1088 + 160 + 120)


@pytest.mark.asyncio
async def test_a_stranger_does_not_export(world: dict[str, Any], browser: Any) -> None:
    as_user(world, "Carlos")
    info, data = await export_file(
        "export_dashboard_pdf", {"dashboard": world["dashboard"].id}
    )

    assert info["error_type"] == "NotFound"
    assert data is None
    browser.assert_not_called()


@pytest.mark.asyncio
async def test_all_pages_leave_out_hidden_and_tooltip_pages(
    world: dict[str, Any], browser: Any, permalinks: Any
) -> None:
    await pages_report(world)
    as_user(world, "Vera")
    info, data = await export_file(
        "export_dashboard_image",
        {"dashboard": world["dashboard"].id, "all_pages": True},
    )

    assert info.get("error") is None, info
    assert [page["name"] for page in info["pages"]] == ["Página 1", "Detalle"]
    assert browser.call_count == 2
    # One under another, with a gap
    assert data is not None
    assert Image.open(io.BytesIO(data)).size == (1920, 2 * 1088 + export.PAGE_GAP)


@pytest.mark.asyncio
async def test_a_pdf_has_a_page_per_report_page(
    world: dict[str, Any], browser: Any, permalinks: Any
) -> None:
    await pages_report(world)
    as_user(world, "Ana")
    info, data = await export_file(
        "export_dashboard_pdf", {"dashboard": world["dashboard"].id, "all_pages": True}
    )

    assert info.get("error") is None, info
    assert info["mime_type"] == "application/pdf"
    assert info["file_name"].endswith(".pdf")
    assert data is not None
    assert data.startswith(b"%PDF")
    assert pdf_pages(data) == 2
    # 1920 x 1088 px at 96 px to the inch: 1440 x 816 pt
    assert (
        re.findall(rb"/MediaBox \[ 0 0 ([\d.]+) ([\d.]+) \]", data)
        == [(b"1440.0", b"816.0")] * 2
    )


@pytest.mark.asyncio
async def test_a_hidden_page_by_name(
    world: dict[str, Any], browser: Any, permalinks: Any
) -> None:
    await pages_report(world)
    as_user(world, "Dani")
    info, _ = await export_file(
        "export_dashboard_pdf", {"dashboard": world["dashboard"].id, "page": "Oculta"}
    )

    assert [page["name"] for page in info["pages"]] == ["Oculta"]
    assert browser.call_count == 1


@pytest.mark.asyncio
async def test_page_and_all_pages_together_are_refused(
    world: dict[str, Any], browser: Any
) -> None:
    as_user(world, "Dani")
    info, data = await export_file(
        "export_dashboard_image",
        {"dashboard": world["dashboard"].id, "page": 1, "all_pages": True},
    )

    assert info["error_type"] == "InvalidRequest"
    browser.assert_not_called()


@pytest.mark.asyncio
async def test_pages_over_the_limit_are_reported(
    world: dict[str, Any], browser: Any, permalinks: Any, mocker: MockerFixture
) -> None:
    await pages_report(world)
    mocker.patch.object(export, "MAX_EXPORT_PAGES", 1)
    as_user(world, "Dani")
    info, _ = await export_file(
        "export_dashboard_pdf", {"dashboard": world["dashboard"].id, "all_pages": True}
    )

    assert [page["name"] for page in info["pages"]] == ["Página 1"]
    assert [page["name"] for page in info["skipped_pages"]] == ["Detalle"]


@pytest.mark.asyncio
async def test_a_file_over_the_limit_is_refused(
    world: dict[str, Any], browser: Any, mocker: MockerFixture
) -> None:
    mocker.patch.object(export, "MAX_EXPORT_BYTES", 10)
    as_user(world, "Dani")
    info, data = await export_file(
        "export_dashboard_image", {"dashboard": world["dashboard"].id}
    )

    assert info["error_type"] == "ExportTooLarge"
    assert data is None


@pytest.mark.asyncio
async def test_a_browser_failure_is_reported(
    world: dict[str, Any], browser: Any
) -> None:
    browser.side_effect = RuntimeError("Playwright is required")
    as_user(world, "Vera")
    info, data = await export_file(
        "export_dashboard_pdf", {"dashboard": world["dashboard"].id}
    )

    assert info["error_type"] == "ScreenshotUnavailable"
    assert data is None
