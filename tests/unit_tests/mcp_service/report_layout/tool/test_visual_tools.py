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
The visual tools: charts made and changed inside a report, the rules of the
side panel they keep (one dashboard per chart, workspace datasets, fields the
dataset has, layout settings that would hide a change) and who may use them.
"""

from typing import Any

import pytest

from superset.auradata.layout import layout_to_cells, layout_to_positions
from superset.auradata.models import WorkspaceDashboard, WorkspaceDataset
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.mcp_service.chart.compile import CompileResult
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.unit_tests.mcp_service.report_layout.tool.conftest import layout, ok
from tests.unit_tests.mcp_service.workspace.world import as_user, call

EDITORS = ["Dani", "Ana", "Ada"]
NOT_EDITORS = ["Vera", "Carlos"]

BIG_NUMBER = {
    "chart_type": "big_number",
    "metric": {"name": "total", "saved_metric": True},
}


@pytest.fixture(autouse=True)
def compiled(world: dict[str, Any]) -> None:
    """The test database has no tables to query: every query compiles."""
    world["mocker"].patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=True),
    )


def set_params(world: dict[str, Any], params: dict[str, Any]) -> None:
    session = world["session"]
    chart = session.get(Slice, world["chart"].id)
    chart.params = json.dumps({"datasource": f"{world['ventas'].id}__table", **params})
    chart.viz_type = params["viz_type"]
    chart.query_context = '{"stale": true}'
    session.commit()


def params(world: dict[str, Any]) -> dict[str, Any]:
    session = world["session"]
    session.expire_all()
    return json.loads(session.get(Slice, world["chart"].id).params or "{}")


def chart_count(world: dict[str, Any]) -> int:
    session = world["session"]
    session.expire_all()
    return session.query(Slice).count()


def set_layout(world: dict[str, Any], change: Any) -> None:
    session = world["session"]
    dashboard = session.get(Dashboard, world["dashboard"].id)
    position = json.loads(dashboard.position_json)
    change(position)
    dashboard.position_json = json.dumps(position)
    session.commit()


def foreign_dataset(world: dict[str, Any]) -> SqlaTable:
    """A dataset of the Finanzas workspace, with the columns of ventas."""
    session = world["session"]
    gastos = SqlaTable(
        table_name="gastos",
        database=world["ventas"].database,
        columns=[TableColumn(column_name="region", type="VARCHAR")],
    )
    session.add(gastos)
    session.flush()
    session.add(
        WorkspaceDataset(workspace_id=world["finanzas_ws"].id, dataset_id=gastos.id)
    )
    session.commit()
    return gastos


async def tool(world: dict[str, Any], name: str, who: str, **request: Any) -> Any:
    as_user(world, who)
    return await call(name, {"dashboard": world["dashboard"].id, **request})


# create_visual


@pytest.mark.asyncio
@pytest.mark.parametrize("who", EDITORS)
async def test_editors_create_a_visual_on_a_page(
    world: dict[str, Any], who: str
) -> None:
    result = ok(
        await tool(
            world,
            "create_visual",
            who,
            dataset_id=world["ventas"].id,
            config=BIG_NUMBER,
            chart_name="Total",
        )
    )

    stored = layout(world)
    cid = result["object_id"]
    chart = world["session"].get(Slice, result["chart_id"])
    assert [d.id for d in chart.dashboards] == [world["dashboard"].id]
    assert chart.slice_name == "Total"
    assert chart.query_context is None
    # ROW > CHART on the page, at a free cell, as the editor writes it
    row = stored[stored[cid]["parents"][-1]]
    assert row["type"] == "ROW"
    assert row["children"] == [cid]
    assert "GRID_ID" in stored[cid]["parents"]
    meta = stored[cid]["meta"]
    assert meta["chartId"] == chart.id
    assert (meta["width"], meta["height"]) == (12, 12)
    assert meta["auradataPos"] == {"x": result["box"]["x"], "y": result["box"]["y"]}
    assert meta["auradataPos"] != {"x": 0, "y": 0}
    # Opening the report converts nothing
    assert layout_to_positions(layout_to_cells(stored)) == stored


@pytest.mark.asyncio
@pytest.mark.parametrize("who", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_create_a_visual(
    world: dict[str, Any], who: str
) -> None:
    before = (chart_count(world), layout(world))
    result = await tool(
        world, "create_visual", who, dataset_id=world["ventas"].id, config=BIG_NUMBER
    )

    assert result["error_type"] == ("Forbidden" if who == "Vera" else "NotFound")
    assert (chart_count(world), layout(world)) == before


@pytest.mark.asyncio
async def test_a_refused_place_leaves_no_chart_behind(world: dict[str, Any]) -> None:
    """Chart and layout save in one transaction: a refused place undoes both."""
    before = (chart_count(world), layout(world))
    result = await tool(
        world,
        "create_visual",
        "Ana",
        dataset_id=world["ventas"].id,
        config=BIG_NUMBER,
        x=0,
        y=0,
    )

    assert result["error_type"] == "Overlap"
    assert (chart_count(world), layout(world)) == before


@pytest.mark.asyncio
async def test_a_visual_cannot_use_a_dataset_of_another_workspace(
    world: dict[str, Any],
) -> None:
    gastos = foreign_dataset(world)
    before = chart_count(world)
    result = await tool(
        world,
        "create_visual",
        "Root",
        dataset_id=gastos.id,
        config={"chart_type": "table", "columns": [{"name": "region"}]},
    )

    assert result["error_type"] == "Conflict"
    assert "workspace" in result["error"]
    assert chart_count(world) == before


# generate_dashboard in a workspace


@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["Ana", "Ada"])
async def test_contributors_create_an_empty_report_in_their_workspace(
    world: dict[str, Any], who: str
) -> None:
    as_user(world, who)
    result = await call(
        "generate_dashboard",
        {"dashboard_title": "Nuevo", "workspace_id": world["ventas_ws"].id},
    )

    assert result["error"] is None, result
    dashboard_id = result["dashboard"]["id"]
    link = (
        world["session"]
        .query(WorkspaceDashboard)
        .filter_by(dashboard_id=dashboard_id)
        .one()
    )
    assert link.workspace_id == world["ventas_ws"].id
    # create_visual can build on it right away
    as_user(world, who)
    created = await call(
        "create_visual",
        {
            "dashboard": dashboard_id,
            "dataset_id": world["ventas"].id,
            "config": BIG_NUMBER,
        },
    )
    assert created["error"] is None, created


@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["Vera", "Carlos"])
async def test_only_contributors_create_reports_in_a_workspace(
    world: dict[str, Any], who: str
) -> None:
    before = world["session"].query(Dashboard).count()
    as_user(world, who)
    result = await call(
        "generate_dashboard",
        {"dashboard_title": "Nuevo", "workspace_id": world["ventas_ws"].id},
    )

    assert result["error"]
    assert world["session"].query(Dashboard).count() == before


@pytest.mark.asyncio
async def test_workspace_charts_need_the_workspace(world: dict[str, Any]) -> None:
    """A chart on a workspace dataset joins a report of that workspace only."""
    session = world["session"]
    orphan = Slice(
        slice_name="huérfano",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=world["ventas"].id,
    )
    session.add(orphan)
    session.commit()
    as_user(world, "Ana")

    outside = await call("generate_dashboard", {"chart_ids": [orphan.id]})
    assert "ventas" in outside["error"]

    inside = await call(
        "generate_dashboard",
        {"chart_ids": [orphan.id], "workspace_id": world["ventas_ws"].id},
    )
    assert inside["error"] is None, inside


# set_visual_fields


@pytest.mark.asyncio
@pytest.mark.parametrize("who", EDITORS)
async def test_editors_set_fields_and_take_them_from_the_layout(
    world: dict[str, Any], who: str
) -> None:
    set_params(world, {"viz_type": "pie", "groupby": [], "metric": "total"})

    def mask(position: dict[str, Any]) -> None:
        position["CHART-1"]["meta"]["auradataFormat"] = {
            "chart": {"groupby": ["old"], "show_legend": False},
            "radius": 4,
        }
        position["ROOT_ID"]["meta"]["auradataCanvas"] = {
            "visuals": {"chart": {"metric": "shared"}}
        }

    set_layout(world, mask)
    result = ok(
        await tool(
            world,
            "set_visual_fields",
            who,
            object=world["chart"].id,
            fields={
                "groupby": "region",
                "metric": {"name": "region", "aggregate": "COUNT"},
            },
        )
    )

    saved = params(world)
    assert saved["groupby"] == ["region"]
    assert saved["metric"]["aggregate"] == "COUNT"
    assert world["session"].get(Slice, world["chart"].id).query_context is None
    assert result["changed"] == ["groupby", "metric"]
    # The layout no longer hides the chart's groupby; its own look stays
    assert layout(world)["CHART-1"]["meta"]["auradataFormat"] == {
        "chart": {"show_legend": False},
        "radius": 4,
    }
    assert result["moved_from_layout"] == ["groupby"]
    # The shared format still sets metric: said, not hidden
    assert any("metric" in w and "shared" in w for w in result["warnings"])


@pytest.mark.asyncio
@pytest.mark.parametrize("who", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_set_fields(
    world: dict[str, Any], who: str
) -> None:
    set_params(world, {"viz_type": "pie", "groupby": [], "metric": "total"})
    result = await tool(
        world, "set_visual_fields", who, object="CHART-1", fields={"groupby": "region"}
    )

    assert result["error"]
    assert params(world)["groupby"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("fields", "error_type"),
    [
        ({"groupby": "nope"}, "InvalidField"),
        ({"colour": "region"}, "InvalidField"),
        ({"metric": "region"}, "InvalidField"),
        ({"metric": None}, "InvalidField"),
    ],
)
async def test_fields_the_dataset_lacks_are_refused(
    world: dict[str, Any], fields: dict[str, Any], error_type: str
) -> None:
    set_params(world, {"viz_type": "pie", "groupby": [], "metric": "total"})
    result = await tool(
        world, "set_visual_fields", "Ana", object="CHART-1", fields=fields
    )

    assert result["error_type"] == error_type
    assert params(world)["metric"] == "total"


@pytest.mark.asyncio
async def test_a_chart_that_would_not_draw_is_not_saved(world: dict[str, Any]) -> None:
    set_params(world, {"viz_type": "pie", "groupby": [], "metric": "total"})
    world["mocker"].patch(
        "superset.mcp_service.chart.compile._compile_chart",
        return_value=CompileResult(success=False, error="no such column"),
    )
    result = await tool(
        world,
        "set_visual_fields",
        "Ana",
        object="CHART-1",
        fields={"groupby": "region"},
    )

    assert result["error_type"] == "CompileError"
    assert params(world)["groupby"] == []


# change_visual_dataset


@pytest.mark.asyncio
async def test_change_dataset_needs_fields_for_emptied_wells(
    world: dict[str, Any],
) -> None:
    region_filter = {"subject": "region", "operator": "==", "comparator": "N"}
    set_params(
        world,
        {
            "viz_type": "pie",
            "groupby": ["region"],
            "metric": "total",
            "adhoc_filters": [region_filter],
        },
    )
    shared = world["compartido"].id

    refused = await tool(
        world, "change_visual_dataset", "Ana", object="CHART-1", dataset_id=shared
    )
    assert refused["error_type"] == "InvalidField"
    assert params(world)["metric"] == "total"

    result = ok(
        await tool(
            world,
            "change_visual_dataset",
            "Ana",
            object="CHART-1",
            dataset_id=shared,
            fields={
                "metric": {"sql_expression": "COUNT(*)", "label": "n"},
                "groupby": {"sql_expression": "'all'", "label": "todo"},
            },
        )
    )
    saved = params(world)
    assert saved["datasource"] == f"{shared}__table"
    assert saved["groupby"][0]["sqlExpression"] == "'all'"
    assert saved["metric"]["sqlExpression"] == "COUNT(*)"
    assert saved["adhoc_filters"] == []
    assert result["dropped"] == {"adhoc_filters": [region_filter]}
    assert world["session"].get(Slice, world["chart"].id).datasource_id == shared


@pytest.mark.asyncio
async def test_change_dataset_keeps_the_workspace_rule(world: dict[str, Any]) -> None:
    set_params(world, {"viz_type": "pie", "groupby": ["region"], "metric": "total"})
    gastos = foreign_dataset(world)

    result = await tool(
        world,
        "change_visual_dataset",
        "Root",
        object="CHART-1",
        dataset_id=gastos.id,
        fields={"metric": {"name": "region", "aggregate": "COUNT"}},
    )

    assert result["error"]
    assert world["session"].get(Slice, world["chart"].id).datasource_id == (
        world["ventas"].id
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("who", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_change_the_dataset(
    world: dict[str, Any], who: str
) -> None:
    set_params(world, {"viz_type": "pie", "groupby": [], "metric": "total"})
    result = await tool(
        world,
        "change_visual_dataset",
        who,
        object="CHART-1",
        dataset_id=world["compartido"].id,
        fields={"metric": {"sql_expression": "COUNT(*)", "label": "n"}},
    )

    assert result["error"]
    assert params(world)["metric"] == "total"


# set_visual_sort and get_visual_fields


@pytest.mark.asyncio
@pytest.mark.parametrize("who", EDITORS)
async def test_editors_sort_a_table(world: dict[str, Any], who: str) -> None:
    set_params(
        world, {"viz_type": "table", "groupby": ["region"], "metrics": ["total"]}
    )

    result = ok(
        await tool(
            world, "set_visual_sort", who, object="CHART-1", by="region", ascending=True
        )
    )

    assert params(world)["auradata_table_sort"] == [{"key": "region", "desc": False}]
    assert result["sort"] == {"by": "region", "ascending": True}
    assert result["sort_options"] == ["region", "total"]


@pytest.mark.asyncio
async def test_sort_refuses_what_the_chart_does_not_offer(
    world: dict[str, Any],
) -> None:
    set_params(
        world, {"viz_type": "table", "groupby": ["region"], "metrics": ["total"]}
    )
    result = await tool(world, "set_visual_sort", "Ana", object="CHART-1", by="price")
    assert result["error_type"] == "InvalidSort"
    assert "region" in result["error"]

    set_params(world, {"viz_type": "big_number_total", "metric": "total"})
    result = await tool(world, "set_visual_sort", "Ana", object="CHART-1", by="total")
    assert result["error_type"] == "Unsupported"


@pytest.mark.asyncio
@pytest.mark.parametrize("who", NOT_EDITORS)
async def test_viewers_and_strangers_cannot_sort(
    world: dict[str, Any], who: str
) -> None:
    set_params(
        world, {"viz_type": "table", "groupby": ["region"], "metrics": ["total"]}
    )
    result = await tool(world, "set_visual_sort", who, object="CHART-1", by="region")

    assert result["error"]
    assert "auradata_table_sort" not in params(world)


@pytest.mark.asyncio
async def test_viewers_read_the_fields_of_a_visual(world: dict[str, Any]) -> None:
    set_params(
        world, {"viz_type": "table", "groupby": ["region"], "metrics": ["total"]}
    )
    result = ok(await tool(world, "get_visual_fields", "Vera", object="CHART-1"))

    assert result["fields"] == {"groupby": ["region"], "metrics": ["total"]}
    assert {"name": "metrics", "kind": "value", "list": True, "role": True} in result[
        "wells"
    ]
    assert result["sort"] == {"by": "total", "ascending": False}


# update_chart and the layout


def mask_metric(position: dict[str, Any]) -> None:
    position["CHART-1"]["meta"]["auradataFormat"] = {
        "chart": {"metric": "old", "header_font_size": 0.4}
    }


@pytest.mark.asyncio
async def test_update_chart_takes_its_change_from_the_layout(
    world: dict[str, Any],
) -> None:
    set_params(world, {"viz_type": "big_number_total", "metric": "total"})
    set_layout(world, mask_metric)
    as_user(world, "Ana")

    result = await call(
        "update_chart",
        {
            "identifier": world["chart"].id,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "region", "aggregate": "COUNT"},
            },
            "generate_preview": False,
            "preview_formats": [],
        },
    )

    assert result["success"], result
    assert layout(world)["CHART-1"]["meta"]["auradataFormat"] == {
        "chart": {"header_font_size": 0.4}
    }
    assert any("metric" in w and "moved" in w for w in result["warnings"])


@pytest.mark.asyncio
async def test_update_chart_says_when_the_layout_still_hides_it(
    world: dict[str, Any],
) -> None:
    """A chart editor who can't edit the report is told the change is hidden."""
    from superset import security_manager

    set_params(world, {"viz_type": "big_number_total", "metric": "total"})
    set_layout(world, mask_metric)
    as_user(world, "Ana")
    world["mocker"].patch.object(
        security_manager,
        "can_edit_resource",
        side_effect=lambda resource: not isinstance(resource, Dashboard),
    )

    result = await call(
        "update_chart",
        {
            "identifier": world["chart"].id,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "region", "aggregate": "COUNT"},
            },
            "generate_preview": False,
            "preview_formats": [],
        },
    )

    assert result["success"], result
    assert layout(world)["CHART-1"]["meta"]["auradataFormat"]["chart"]["metric"] == (
        "old"
    )
    assert any("can't edit" in w for w in result["warnings"])
