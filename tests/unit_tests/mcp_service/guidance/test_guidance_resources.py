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
"""Tests for the AuraData BI guidance resources (auradata://*)."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.auradata import catalog
from superset.auradata.layout.grid import CANVAS_PRESETS, CELL, MIN_CHART_COLUMNS
from superset.mcp_service.app import mcp
from superset.mcp_service.guidance import content
from superset.utils import json

URIS = (
    "auradata://brand",
    "auradata://report-conventions",
    "auradata://format-catalog",
)


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Resources authenticate through mcp_auth_hook."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


async def _read(uri: str) -> dict[str, Any]:
    async with Client(mcp) as client:
        result = await client.read_resource(uri)
    return json.loads(result[0].text)


@pytest.mark.asyncio
async def test_guidance_resources_are_listed() -> None:
    async with Client(mcp) as client:
        uris = {str(resource.uri) for resource in await client.list_resources()}
    assert set(URIS) <= uris


@pytest.mark.asyncio
async def test_brand_has_the_brand_colors_fonts_and_gradient_rule() -> None:
    brand = await _read("auradata://brand")

    assert brand["product"] == "AuraData BI"
    assert brand["colors"]["azul_aura"] == "#2563EB"
    assert brand["colors"]["violet"] == "#7C3AED"
    assert brand["colors"]["green"] == "#10B981"
    assert "Outfit" in brand["fonts"]["text"]
    assert "Geist Mono" in brand["fonts"]["data"]
    assert "headline accent" in brand["gradient"]["rule"]
    default = [palette for palette in brand["palettes"] if palette["default"]]
    assert [palette["id"] for palette in default] == ["auradata"]
    assert default[0]["colors"][:3] == ["#2563EB", "#7C3AED", "#10B981"]
    assert brand["language"]["default"] == "es"
    assert "«tú»" in brand["language"]["spanish_style"]


@pytest.mark.asyncio
async def test_report_conventions_layout_fits_the_default_page() -> None:
    conventions = await _read("auradata://report-conventions")
    page = conventions["page"]
    width, height = CANVAS_PRESETS[page["default_size"]]
    columns, rows = width // CELL, height // CELL

    assert page["sizes"]["16:9"] == {
        "columns": 60,
        "rows": 34,
        "pixels_wide": 1920,
        "pixels_high": 1088,
    }
    boxes = page["standard_layout"]["objects"]
    for box in boxes:
        # Inside the page, with the 1-cell margin
        assert box["x"] >= 1
        assert box["y"] >= 1
        assert box["x"] + box["width"] <= columns - 1
        assert box["y"] + box["height"] <= rows - 1
        assert box["width"] >= MIN_CHART_COLUMNS
    for index, box in enumerate(boxes):
        for other in boxes[index + 1 :]:
            apart = (
                box["x"] + box["width"] <= other["x"]
                or other["x"] + other["width"] <= box["x"]
                or box["y"] + box["height"] <= other["y"]
                or other["y"] + other["height"] <= box["y"]
            )
            assert apart, (box, other)
    assert conventions["numbers"]["formats"]["percentages"] == ".1%"
    assert conventions["language"]["default"] == "es"


@pytest.mark.asyncio
async def test_format_catalog_summary_follows_the_catalog() -> None:
    summary = await _read("auradata://format-catalog")

    assert summary["chart_types"] == sorted(catalog.chart_types())
    assert set(summary["levels"]) == set(catalog.LEVELS)
    assert "button" in summary["elements"]
    assert any("get_format_options" in line for line in summary["how"])


def test_language_follows_the_configured_default(app_context: None) -> None:
    from flask import current_app

    with patch.dict(current_app.config, {"BABEL_DEFAULT_LOCALE": "en"}):
        rule = content.language_rule()
    assert rule["default"] == "en"
    assert "English" in rule["rule"]
    assert "spanish_style" not in rule
