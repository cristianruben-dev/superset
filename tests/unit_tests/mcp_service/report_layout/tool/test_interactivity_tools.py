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
The report interactivity tools: filter levels and instant filters, bookmarks,
drill through pages, edit interactions, sync slicers and tooltip pages. What
they write in the layout and the dashboard metadata, the editor's rules they
keep and who may use them.
"""

from typing import Any

import pytest

from superset.models.dashboard import Dashboard
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


def two_pages(chart_id: int, other_id: int) -> dict[str, Any]:
    """A report of two pages: a chart and a text box, then another chart."""

    def item(cid: str, kind: str, parents: list[str], **meta: Any) -> dict[str, Any]:
        return {
            "type": kind,
            "id": cid,
            "children": [],
            "parents": parents,
            "meta": meta,
        }

    page1 = ["ROOT_ID", "TABS-1", "TAB-1", "ROW-1"]
    page2 = ["ROOT_ID", "TABS-1", "TAB-2", "ROW-2"]
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {
            "type": "ROOT",
            "id": "ROOT_ID",
            "children": ["TABS-1"],
            "meta": {"auradataCells": True},
        },
        "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": []},
        "TABS-1": {
            "type": "TABS",
            "id": "TABS-1",
            "children": ["TAB-1", "TAB-2"],
            "parents": ["ROOT_ID"],
            "meta": {},
        },
        "TAB-1": {
            **item("TAB-1", "TAB", ["ROOT_ID", "TABS-1"], text="Resumen"),
            "children": ["ROW-1"],
        },
        "TAB-2": {
            **item("TAB-2", "TAB", ["ROOT_ID", "TABS-1"], text="Detalle"),
            "children": ["ROW-2"],
        },
        "ROW-1": {
            **item("ROW-1", "ROW", page1[:3], background="BACKGROUND_TRANSPARENT"),
            "children": ["CHART-1", "MARKDOWN-1"],
        },
        "ROW-2": {
            **item("ROW-2", "ROW", page2[:3], background="BACKGROUND_TRANSPARENT"),
            "children": ["CHART-2"],
        },
        "CHART-1": item(
            "CHART-1",
            "CHART",
            page1,
            chartId=chart_id,
            width=12,
            height=12,
            auradataPos={"x": 0, "y": 0},
        ),
        "MARKDOWN-1": item(
            "MARKDOWN-1",
            "MARKDOWN",
            page1,
            width=10,
            height=6,
            code="# Ventas",
            auradataPos={"x": 20, "y": 0},
        ),
        "CHART-2": item(
            "CHART-2",
            "CHART",
            page2,
            chartId=other_id,
            width=12,
            height=12,
            auradataPos={"x": 0, "y": 0},
        ),
    }


@pytest.fixture
def report(world: dict[str, Any]) -> dict[str, Any]:
    """The world's report with two pages and a second chart."""
    session = world["session"]
    other = Slice(
        slice_name="ventas por region",
        viz_type="echarts_timeseries_bar",
        datasource_type="table",
        datasource_id=world["ventas"].id,
    )
    session.add(other)
    session.flush()
    other.editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    dashboard = world["dashboard"]
    dashboard.slices = [world["chart"], other]
    dashboard.position_json = json.dumps(two_pages(world["chart"].id, other.id))
    dashboard.json_metadata = json.dumps(
        {"shared_label_colors": ["Norte"], "color_scheme_domain": ["#2563EB"]}
    )
    session.commit()
    world["other"] = other
    return world


def metadata(world: dict[str, Any]) -> dict[str, Any]:
    session = world["session"]
    session.expire_all()
    dashboard = session.get(Dashboard, world["dashboard"].id)
    return json.loads(dashboard.json_metadata or "{}")


def native_filters(world: dict[str, Any]) -> list[dict[str, Any]]:
    return metadata(world).get("native_filter_configuration") or []


async def add_slicer(world: dict[str, Any], **extra: Any) -> dict[str, Any]:
    return ok(
        await as_editor(
            world,
            "add_slicer",
            name="Región",
            dataset_id=world["ventas"].id,
            column="region",
            page="TAB-1",
            **extra,
        )
    )


def writes(world: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    return [
        ("set_filter_bar_auto_apply", {"auto_apply": False}),
        ("create_bookmark", {"name": "Norte"}),
        ("update_bookmark", {"bookmark": "Inicio", "name": "Otro"}),
        ("delete_bookmark", {"bookmark": "Inicio"}),
        ("set_drillthrough_page", {"page": "Detalle", "columns": ["region"]}),
        ("clear_drillthrough_page", {"page": "Detalle"}),
        (
            "set_visual_interactions",
            {
                "source": world["chart"].id,
                "interactions": [{"target": world["other"].id, "mode": "none"}],
            },
        ),
        ("make_tooltip_page", {"page": "Detalle"}),
        ("set_visual_tooltip", {"object": world["chart"].id, "mode": "auto"}),
        ("sync_slicer", {"object": "SLICER", "visible_pages": [1, 2]}),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_viewers_and_strangers_change_nothing(
    report: dict[str, Any], name: str
) -> None:
    slicer = (await add_slicer(report))["object"]
    ok(await as_editor(report, "create_bookmark", name="Inicio"))
    ok(await as_editor(report, "set_drillthrough_page", page=2, columns=["region"]))
    before = (layout(report), metadata(report))
    as_user(report, name)
    for tool, request in writes(report):
        request = {k: slicer if v == "SLICER" else v for k, v in request.items()}
        result = await call(tool, {"dashboard": report["dashboard"].id, **request})
        assert result["error_type"] == (
            "Forbidden" if name == "Vera" else "NotFound"
        ), (
            tool,
            result,
        )
        assert result["permission_denied"] is (name == "Vera")
    assert (layout(report), metadata(report)) == before


@pytest.mark.asyncio
@pytest.mark.parametrize("name", NOT_EDITORS)
async def test_reads_follow_dashboard_access(report: dict[str, Any], name: str) -> None:
    ok(await as_editor(report, "create_bookmark", name="Inicio"))
    as_user(report, name)
    for tool in ("list_bookmarks", "get_filter_defaults"):
        result = await call(tool, {"dashboard": report["dashboard"].id})
        if name == "Vera":
            assert result.get("error") is None, result
        else:
            assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
@pytest.mark.parametrize("name", EDITORS)
async def test_editors_and_workspace_editors_change_it(
    report: dict[str, Any], name: str
) -> None:
    slicer = (await add_slicer(report))["object"]
    ok(await as_editor(report, "create_bookmark", name="Inicio"))
    as_user(report, name)
    for tool, request in writes(report):
        request = {k: slicer if v == "SLICER" else v for k, v in request.items()}
        if tool == "delete_bookmark":
            request["bookmark"] = "Otro"
        result = await call(tool, {"dashboard": report["dashboard"].id, **request})
        assert result.get("error") is None, (tool, result)
        assert result["changed"], tool


@pytest.mark.asyncio
async def test_auto_apply_keeps_the_rest_of_the_metadata(
    report: dict[str, Any],
) -> None:
    ok(await as_editor(report, "set_filter_bar_auto_apply", auto_apply=False))
    saved = metadata(report)
    assert saved["filter_bar_auto_apply"] is False
    assert saved["shared_label_colors"] == ["Norte"]
    assert saved["color_scheme_domain"] == ["#2563EB"]
    defaults = ok(await as_editor(report, "get_filter_defaults"))
    assert defaults["filter_bar_auto_apply"] is False


@pytest.mark.asyncio
async def test_filter_levels(report: dict[str, Any]) -> None:
    dashboard = report["dashboard"].id
    chart = report["chart"].id
    as_user(report, "Ana")
    spec = {
        "filter_type": "filter_select",
        "name": "Región",
        "dataset_id": report["ventas"].id,
        "column": "region",
    }
    added = await call(
        "manage_native_filters",
        {
            "dashboard_id": dashboard,
            "add": [{**spec, "scope_pages": ["Detalle"]}],
        },
    )
    assert added.get("error") is None, added
    conf = native_filters(report)[0]
    assert conf["scope"] == {"rootPath": ["TAB-2"], "excluded": []}
    assert conf["scopeLevel"] == "page"

    async def update(**fields: Any) -> dict[str, Any]:
        return await call(
            "manage_native_filters",
            {"dashboard_id": dashboard, "update": [{"id": conf["id"], **fields}]},
        )

    assert (await update(scope_pages=[1, 2])).get("error") is None
    conf = native_filters(report)[0]
    assert conf["scope"]["rootPath"] == ["ROOT_ID"]
    assert conf["scopeLevel"] == "report"

    refused = await update(scope_level="visual")
    assert "scope_chart_ids" in refused["error"]
    refused = await update(scope_level="report", scope_pages=["Detalle"])
    assert "every page" in refused["error"]
    refused = await update(scope_level="page")
    assert "scope_pages" in refused["error"]
    assert native_filters(report)[0] == conf

    assert (
        await update(scope_level="visual", scope_chart_ids=[report["other"].id])
    ).get("error") is None
    conf = native_filters(report)[0]
    assert conf["scopeLevel"] == "visual"
    assert conf["scope"]["excluded"] == [chart]

    assert (await update(scope_level="auto")).get("error") is None
    conf = native_filters(report)[0]
    assert "scopeLevel" not in conf
    structure = ok(await as_editor(report, "get_report_structure"))
    assert structure["filters"][0]["level"] == "report"


@pytest.mark.asyncio
async def test_bookmarks(report: dict[str, Any]) -> None:
    slicer = await add_slicer(report, default_value=["Sur"])
    filter_id = slicer["filter_id"]
    created = ok(
        await as_editor(
            report,
            "create_bookmark",
            name="Norte",
            page="Detalle",
            filters={"Región": ["Norte"]},
            hidden=[report["chart"].id],
            options={"display": False},
        )
    )
    bookmark = created["bookmark"]
    assert len(bookmark["id"]) == 10
    saved = layout(report)["ROOT_ID"]["meta"]["auradataBookmarks"][0]
    assert saved["page"] == "TAB-2"
    assert saved["options"] == {"data": True, "display": False, "page": True}
    assert saved["filters"][filter_id] == {
        "extraFormData": {"filters": [{"col": "region", "op": "IN", "val": ["Norte"]}]},
        "filterState": {"value": ["Norte"]},
    }
    # Charts and design elements, not text boxes
    assert "MARKDOWN-1" not in saved["visibility"]
    assert saved["visibility"]["CHART-1"] is True
    assert saved["visibility"]["CHART-2"] is False
    assert saved["visibility"][slicer["object"]] is False
    created = await as_editor(
        report, "create_bookmark", name="Mal", hidden=["MARKDOWN-1"]
    )
    assert "visibility" in created["error"]

    # A button goes to it
    ok(
        await as_editor(
            report,
            "add_element",
            kind="button",
            page="Resumen",
            settings={"action": {"type": "bookmark", "bookmarkId": bookmark["id"]}},
        )
    )

    ok(await as_editor(report, "create_bookmark", name="Todo"))
    updated = ok(
        await as_editor(
            report,
            "update_bookmark",
            bookmark="todo",
            name="Todo visible",
            position=1,
            reset_filters=True,
            filters={filter_id: None},
        )
    )
    assert updated["bookmark"]["filters"][filter_id]["value"] is None
    listed = ok(await as_editor(report, "list_bookmarks"))["bookmarks"]
    assert [b["name"] for b in listed] == ["Todo visible", "Norte"]
    assert listed[1]["page_name"] == "Detalle"
    assert listed[1]["hidden"] == ["CHART-1"]
    structure = ok(await as_editor(report, "get_report_structure"))
    assert structure["bookmarks"][1]["filter_ids"] == [filter_id]

    deleted = ok(await as_editor(report, "delete_bookmark", bookmark=bookmark["id"]))
    assert "still go to the deleted bookmark" in deleted["warnings"][0]
    assert len(layout(report)["ROOT_ID"]["meta"]["auradataBookmarks"]) == 1
    ok(await as_editor(report, "delete_bookmark", bookmark="Todo visible"))
    assert "auradataBookmarks" not in layout(report)["ROOT_ID"]["meta"]
    missing = await as_editor(report, "update_bookmark", bookmark="Nada")
    assert missing["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_drillthrough_pages(report: dict[str, Any]) -> None:
    result = ok(
        await as_editor(
            report, "set_drillthrough_page", page="Detalle", columns=["region"]
        )
    )
    assert result["drillthrough_columns"] == ["region"]
    assert layout(report)["TAB-2"]["meta"]["auradataDrillthrough"] == {
        "columns": ["region"]
    }
    structure = ok(await as_editor(report, "get_report_structure"))
    assert structure["pages"][1]["drillthrough_columns"] == ["region"]
    refused = await as_editor(
        report, "set_drillthrough_page", page="Detalle", columns=["planeta"]
    )
    assert "planeta" in refused["error"]
    ok(await as_editor(report, "clear_drillthrough_page", page="Detalle"))
    assert "auradataDrillthrough" not in layout(report)["TAB-2"]["meta"]


@pytest.mark.asyncio
async def test_one_page_reports_have_no_drillthrough_or_tooltip_pages(
    world: dict[str, Any],
) -> None:
    for tool, request in (
        ("set_drillthrough_page", {"page": 1, "columns": ["region"]}),
        ("make_tooltip_page", {"page": 1}),
    ):
        refused = await as_editor(world, tool, **request)
        assert "one page" in refused["error"], tool


@pytest.mark.asyncio
async def test_visual_interactions(report: dict[str, Any]) -> None:
    chart, other = report["chart"].id, report["other"].id
    result = ok(
        await as_editor(
            report,
            "set_visual_interactions",
            source=chart,
            interactions=[{"target": "CHART-2", "mode": "none"}],
        )
    )
    assert result["interactions"] == {str(other): "none"}
    config = metadata(report)["chart_configuration"][str(chart)]
    assert config == {
        "id": chart,
        "crossFilters": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [other]},
            "chartsInScope": [],
        },
    }
    assert metadata(report)["shared_label_colors"] == ["Norte"]
    structure = ok(await as_editor(report, "get_report_structure"))
    assert structure["interactions"] == {str(chart): [other]}

    ok(
        await as_editor(
            report,
            "set_visual_interactions",
            source=chart,
            interactions=[{"target": other, "mode": "filter"}],
        )
    )
    config = metadata(report)["chart_configuration"][str(chart)]
    assert config["crossFilters"]["scope"]["excluded"] == []
    assert config["crossFilters"]["chartsInScope"] == [other]
    refused = await as_editor(
        report,
        "set_visual_interactions",
        source=chart,
        interactions=[{"target": chart, "mode": "none"}],
    )
    assert "itself" in refused["error"]
    refused = await as_editor(
        report,
        "set_visual_interactions",
        source="MARKDOWN-1",
        interactions=[{"target": other, "mode": "none"}],
    )
    assert "not a chart" in refused["error"]


@pytest.mark.asyncio
async def test_sync_slicer(report: dict[str, Any]) -> None:
    slicer = await add_slicer(report, scope="page")
    component, filter_id = slicer["object"], slicer["filter_id"]
    assert native_filters(report)[0]["scope"]["rootPath"] == ["TAB-1"]

    result = ok(
        await as_editor(
            report,
            "sync_slicer",
            object=component,
            filter_pages=["Detalle"],
            visible_pages=["Resumen", "Detalle"],
        )
    )
    conf = native_filters(report)[0]
    assert conf["scope"] == {"rootPath": ["TAB-2"], "excluded": []}
    assert conf["scopeLevel"] == "page"
    saved = layout(report)
    copies = [
        cid
        for cid in result["changed"]
        if cid != filter_id and cid in saved and "TAB-2" in saved[cid]["parents"]
    ]
    assert len(copies) == 1
    copy = saved[copies[0]]["meta"]
    assert copy["auradataElement"]["filterId"] == filter_id
    assert copy["componentKey"] == saved[component]["meta"]["componentKey"]

    ok(await as_editor(report, "sync_slicer", object=component, filter_pages=[1, 2]))
    assert native_filters(report)[0]["scope"]["rootPath"] == ["ROOT_ID"]
    assert native_filters(report)[0]["scopeLevel"] == "report"

    ok(await as_editor(report, "sync_slicer", object=component, visible_pages=[1]))
    assert copies[0] not in layout(report)
    refused = await as_editor(
        report, "sync_slicer", object=component, visible_pages=["Detalle"]
    )
    assert "always shows it" in refused["error"]
    refused = await as_editor(
        report, "sync_slicer", object="CHART-1", visible_pages=[1]
    )
    assert "design element" in refused["error"]


@pytest.mark.asyncio
async def test_tooltip_pages(report: dict[str, Any]) -> None:
    result = ok(
        await as_editor(
            report,
            "make_tooltip_page",
            page="Detalle",
            width=8,
            height=6,
            columns=["region"],
        )
    )
    assert result["tooltip_page"] == {"width": 8, "height": 6, "columns": ["region"]}
    # The chart of the page (12 x 12) is past the tooltip area
    assert "CHART-2" in result["warnings"][0]
    assert layout(report)["TAB-2"]["meta"]["auradataTooltipPage"] == {
        "width": 8,
        "height": 6,
        "columns": ["region"],
    }
    refused = await as_editor(
        report,
        "set_visual_tooltip",
        object=report["chart"].id,
        mode="page",
        page="Resumen",
    )
    assert "not a tooltip page" in refused["error"]
    # format_visual cannot point a chart at a page that is no tooltip either
    refused = await as_editor(
        report,
        "format_visual",
        object=report["chart"].id,
        level="general",
        patch={"tooltipPage": {"type": "page", "page": "TAB-1"}},
    )
    assert "not a tooltip page" in refused["error"]

    ok(
        await as_editor(
            report,
            "set_visual_tooltip",
            object=report["chart"].id,
            mode="page",
            page="Detalle",
        )
    )
    meta = layout(report)["CHART-1"]["meta"]
    assert meta["auradataFormat"]["tooltipPage"] == {"type": "page", "page": "TAB-2"}
    structure = ok(await as_editor(report, "get_report_structure"))
    assert structure["pages"][0]["objects"][0]["tooltip_page"] == {
        "type": "page",
        "page": "TAB-2",
    }
    assert structure["pages"][1]["shown_to_viewers"] is False

    ok(
        await as_editor(
            report, "set_visual_tooltip", object=report["chart"].id, mode="default"
        )
    )
    meta = layout(report)["CHART-1"]["meta"]
    assert meta["auradataFormat"]["tooltipPage"] == {"type": "default"}
    ok(await as_editor(report, "make_tooltip_page", page="Detalle", enabled=False))
    assert "auradataTooltipPage" not in layout(report)["TAB-2"]["meta"]


@pytest.mark.asyncio
async def test_filter_defaults(report: dict[str, Any]) -> None:
    slicer = await add_slicer(report, default_value=["Norte"])
    defaults = ok(await as_editor(report, "get_filter_defaults"))
    assert defaults["cross_filters"] == "cleared"
    assert defaults["filter_bar_auto_apply"] is True
    assert defaults["filters"] == [
        {
            "id": slicer["filter_id"],
            "name": "Región",
            "type": "filter_select",
            "level": "report",
            "column": "region",
            "default": ["Norte"],
            "default_filters": [{"col": "region", "op": "IN", "val": ["Norte"]}],
        }
    ]
