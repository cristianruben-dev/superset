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
"""get_report_structure: a report in report terms, for whoever sees it."""

from typing import Any

import pytest

from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import (
    layout,
    ok,
)
from tests.unit_tests.mcp_service.workspace.world import as_user, call


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Vera", "Root"])
async def test_who_sees_the_report_reads_its_structure(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    result = ok(
        await call("get_report_structure", {"dashboard": world["dashboard"].id})
    )
    assert result["canvas"] == {
        "width": 60,
        "height": 34,
        "size_mode": "16:9",
        "background": None,
        "shared_visual_format": None,
    }
    [page] = result["pages"]
    assert page["id"] == "GRID_ID"
    assert page["has_mobile_layout"] is True
    chart, text = page["objects"]
    assert chart["kind"] == "chart"
    assert chart["title"] == "kpi"
    assert chart["box"] == {"x": 0, "y": 0, "width": 12, "height": 12}
    assert text["kind"] == "text_box"
    assert text["title"] == "# Ventas"


@pytest.mark.asyncio
async def test_a_stranger_does_not_read_a_workspace_report(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    result = await call("get_report_structure", {"dashboard": world["dashboard"].id})
    assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_structure_resolves_the_shared_format(world: dict[str, Any]) -> None:
    data = layout(world)
    data["ROOT_ID"]["meta"]["auradataCanvas"] = {
        "visuals": {"radius": 4, "title": {"show": True, "size": 14}}
    }
    data["CHART-1"]["meta"]["auradataFormat"] = {"title": {"size": 18}}
    data["CHART-1"]["meta"]["auradataHidden"] = True
    world["dashboard"].position_json = json.dumps(data)
    world["session"].commit()

    as_user(world, "Vera")
    result = ok(
        await call("get_report_structure", {"dashboard": world["dashboard"].id})
    )
    chart = result["pages"][0]["objects"][0]
    assert chart["format"] == {"radius": 4, "title": {"show": True, "size": 18}}
    assert chart["hidden"] is True


@pytest.mark.asyncio
async def test_structure_warns_about_a_layout_before_the_cell_grid(
    world: dict[str, Any],
) -> None:
    data = layout(world)
    del data["ROOT_ID"]["meta"]["auradataCells"]
    del data["CHART-1"]["meta"]["auradataPos"]
    world["dashboard"].position_json = json.dumps(data)
    world["session"].commit()

    as_user(world, "Vera")
    result = ok(
        await call("get_report_structure", {"dashboard": world["dashboard"].id})
    )
    assert result["warnings"]
    # Shown as the editor would show it after converting it
    assert result["pages"][0]["objects"][0]["box"]["x"] == 0
