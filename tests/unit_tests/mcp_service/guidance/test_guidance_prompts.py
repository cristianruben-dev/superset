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
"""Tests for the AuraData BI guided prompts."""

import re
from collections.abc import Iterator
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp

PROMPTS = {
    "informe_desde_dataset": {"dataset": "64", "workspace": "Comercial"},
    "replicar_informe_power_bi": {},
    "revisar_informe": {"dashboard": "Ventas 2026"},
    "diseno_movil": {"dashboard": "Ventas 2026"},
}


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Prompts authenticate like tools."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


async def _render(name: str, arguments: dict[str, str]) -> str:
    async with Client(mcp) as client:
        result = await client.get_prompt(name, arguments)
    return result.messages[0].content.text


@pytest.mark.asyncio
async def test_prompts_are_listed_with_titles() -> None:
    async with Client(mcp) as client:
        prompts = {prompt.name: prompt for prompt in await client.list_prompts()}
    for name in PROMPTS:
        assert name in prompts
        assert prompts[name].description


@pytest.mark.asyncio
@pytest.mark.parametrize("name", list(PROMPTS))
async def test_prompts_carry_the_conventions_and_name_real_tools(name: str) -> None:
    text = await _render(name, PROMPTS[name])
    tools = {tool.name for tool in await mcp.list_tools()}

    assert "60 × 34" in text
    assert "contraseñas" in text
    assert "dueño de la clave" in text
    assert "«tú»" not in text  # the rule quotes informal tú without the marks
    assert "tú informal" in text
    named = set(re.findall(r"`([a-z_]+)\(", text)) | set(
        re.findall(r"`([a-z]+_[a-z_]+)`", text)
    )
    unknown = {word for word in named if word not in tools}
    # Values written as code (chart types, fields) are not tools
    assert unknown <= {
        "big_number",
        "mixed_timeseries",
        "pivot_table",
        "chart_ids",
        "workspace_id",
        "dashboard_title",
        "chart_type",
        "dataset_id",
        "show_trendline",
    }, unknown


@pytest.mark.asyncio
async def test_report_prompt_uses_its_arguments() -> None:
    text = await _render("informe_desde_dataset", PROMPTS["informe_desde_dataset"])

    assert "dataset «64»" in text
    assert "workspace «Comercial»" in text
    assert "generate_dashboard" in text
    assert "create_visual" in text
    assert "get_dashboard_screenshot" in text


@pytest.mark.asyncio
async def test_prompt_follows_the_requested_language() -> None:
    text = await _render("revisar_informe", {"dashboard": "Sales", "idioma": "en"})

    assert "Language: write every title" in text
    assert "English" in text
