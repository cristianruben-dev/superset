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
A document as pages of its report: what each block becomes, where it goes, and that the
whole of it runs through the tools of the report, after a card and only after one.
"""

from typing import Any
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant import artifact_pages, artifact_tools
from superset.auradata.assistant.artifact_blocks import SaveArtifactAsPage
from superset.auradata.assistant.artifact_pages import (
    NotAChartError,
    page_plan,
    PageSaveError,
    save_pages,
    text_settings,
    visual_of,
)
from superset.auradata.assistant.artifact_tools import OwnToolContext, save_card
from superset.auradata.assistant.artifacts import (
    ArtifactRefusedError,
    CHANGE_ARTIFACT,
    SAVE_ARTIFACT,
)
from superset.auradata.assistant.conversations import find_conversation, pending_turn
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ, ToolBox, ToolOutcome
from superset.auradata.models import AssistantArtifactVersion
from superset.utils import json
from tests.unit_tests.auradata.assistant.artifacts_test import (
    change_call,
    create,
    document,
    figure_block,
    run,
    text_block,
)
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    login,
    payloads,
    session_engine,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text, tool_use

COLUMNS, ROWS = 60, 34


def chart(chart_kind: str = "bar", **query: Any) -> dict[str, Any]:
    return {
        "id": "c",
        "type": "chart",
        "title": "Ventas por región",
        "chart": chart_kind,
        "query": {
            "dataset_id": 7,
            "columns": ["region"],
            "aggregates": [
                {"column": "ventas", "aggregate": "SUM", "label": "Ventas"},
            ],
            **query,
        },
    }


def figure(label: str = "Total", **query: Any) -> dict[str, Any]:
    return {
        "id": "f",
        "type": "figure",
        "label": label,
        "format": "currency",
        "query": {"dataset_id": 7, "metrics": ["total"], **query},
    }


def paragraph(body: str = "Hola") -> dict[str, Any]:
    return {"id": "t", "type": "text", "text": body, "written_on": "2026-11-06"}


def test_figures_share_a_row_and_nothing_overlaps() -> None:
    plan = page_plan(
        [paragraph(), figure(), figure(), figure(), chart(), chart()], COLUMNS, ROWS
    )

    assert len(plan) == 1
    placed = plan[0]
    assert [item.x for item in placed[1:4]] == [0, 20, 40]
    assert [item.width for item in placed[1:4]] == [20, 20, 20]
    assert placed[4].y == placed[5].y == placed[1].y + placed[1].height
    assert (placed[4].x, placed[5].x, placed[4].width) == (0, 30, 30)


def test_what_does_not_fit_goes_on_to_another_page() -> None:
    plan = page_plan([chart()] * 8, COLUMNS, ROWS)

    assert len(plan) == 2
    for page in plan:
        assert all(item.y + item.height <= ROWS for item in page)
    assert plan[1][0].y == 0


def test_a_long_text_takes_the_height_it_needs_up_to_the_page() -> None:
    short = page_plan([paragraph()], COLUMNS, ROWS)[0][0]
    long = page_plan([paragraph("palabra " * 900)], COLUMNS, ROWS)[0][0]

    assert short.height < long.height <= ROWS


def test_a_chart_block_is_a_chart_of_the_same_query() -> None:
    request = visual_of(
        chart(
            filters=[
                {"col": "region", "op": "==", "val": "Norte"},
                {"col": "anio", "op": "IN", "val": [2025, 2026]},
            ],
            row_limit=12,
        )
    )

    assert request["dataset_id"] == 7
    assert request["chart_name"] == "Ventas por región"
    config = request["config"]
    assert (config["chart_type"], config["kind"]) == ("xy", "bar")
    assert config["x"] == {"name": "region"}
    assert config["y"] == [{"name": "ventas", "aggregate": "SUM", "label": "Ventas"}]
    assert config["row_limit"] == 12
    assert config["filters"] == [
        {"column": "region", "op": "=", "value": "Norte"},
        {"column": "anio", "op": "IN", "value": [2025, 2026]},
    ]


def test_a_time_range_stays_with_the_chart() -> None:
    request = visual_of(
        chart(
            time_range="Last quarter",
            time_column="fecha",
            filters=[{"col": "alta", "op": "TEMPORAL_RANGE", "val": "Last year"}],
        )
    )

    assert request["config"]["filters"] == []
    assert request["time_filters"] == [
        {"column": "alta", "range": "Last year"},
        {"column": "fecha", "range": "Last quarter"},
    ]


def test_a_pie_a_table_and_a_figure_become_their_charts() -> None:
    pie = visual_of(chart("pie"))["config"]
    assert (pie["chart_type"], pie["dimension"]) == ("pie", {"name": "region"})

    grid = visual_of(
        {
            "id": "g",
            "type": "table",
            "title": "Filas",
            "query": {
                "dataset_id": 7,
                "columns": ["region"],
                "metrics": ["total"],
                "order_by": ["total"],
                "order_desc": False,
            },
        }
    )["config"]
    assert grid["query_mode"] == "aggregate"
    assert grid["sort_by"] == [{"column": "total", "ascending": True}]

    number = visual_of(figure())
    assert number["chart_name"] == "Total"
    assert number["config"]["y_axis_format"] == "$,.2f"
    assert number["config"]["metric"] == {"name": "total", "saved_metric": True}


def test_a_filter_no_chart_says_exactly_is_refused_not_dropped() -> None:
    with pytest.raises(NotAChartError):
        visual_of(chart(filters=[{"col": "activo", "op": "IS TRUE"}]))


def test_text_goes_through_the_sanitized_markdown() -> None:
    html = text_settings(paragraph("## Título\n\n**Fuerte**<script>x</script>"))["html"]

    assert "<h2>" in html
    assert "<strong>Fuerte</strong>" in html
    assert "<script" not in html


class Tools:
    """The tools of a report, as ``ToolBox.call`` answers them."""

    def __init__(self, refuse: str | None = None) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.refuse = refuse

    def __call__(self, name: str, arguments: dict[str, Any]) -> ToolOutcome:
        request = arguments["request"]
        self.calls.append((name, request))
        if name == self.refuse:
            return ToolOutcome(
                [{"type": "text", "text": json.dumps({"error": "No, sorry"})}]
            )
        answers: dict[str, dict[str, Any]] = {
            "get_report_structure": {
                "canvas": {"width": COLUMNS, "height": ROWS},
            },
            "add_page": {"page": f"TAB-{len(self.calls)}"},
            "create_visual": {"object_id": "CHART-1", "chart_id": 1},
            "add_element": {"element_id": "x"},
        }
        return ToolOutcome(
            [{"type": "text", "text": json.dumps(answers.get(name, {}))}]
        )


def test_it_only_acts_through_the_tools_of_the_report() -> None:
    tools = Tools()

    result = save_pages(tools, 9, "Resumen", [paragraph(), figure(), chart()])

    assert [name for name, _ in tools.calls] == [
        "get_report_structure",
        "add_page",
        "add_element",
        "create_visual",
        "create_visual",
    ]
    assert result["pages"][0]["name"] == "Resumen"
    assert result["left_out"] == []
    for name, request in tools.calls[2:]:
        assert request["dashboard"] == 9
        assert request["page"] == result["pages"][0]["id"]
        assert {"x", "y", "width", "height"} <= set(request), name


def test_the_order_of_a_chart_is_asked_for_after_creating_it() -> None:
    tools = Tools()

    save_pages(tools, 9, "Resumen", [chart(order_by=["Ventas"], order_desc=False)])

    assert tools.calls[-1] == (
        "set_visual_sort",
        {"dashboard": 9, "object": "CHART-1", "by": "Ventas", "ascending": True},
    )


def test_more_pages_are_named_after_the_first() -> None:
    tools = Tools()

    result = save_pages(tools, 9, "Resumen", [chart()] * 8)

    assert [page["name"] for page in result["pages"]] == ["Resumen", "Resumen (2)"]


def test_a_block_the_tools_refuse_stays_out_and_is_named() -> None:
    result = save_pages(
        Tools(refuse="create_visual"), 9, "Resumen", [paragraph(), figure("Margen")]
    )

    assert result["left_out"] == [{"block": "Margen", "why": "No, sorry"}]
    assert len(result["pages"]) == 1


def test_a_page_the_tools_refuse_ends_it() -> None:
    with pytest.raises(PageSaveError, match="No, sorry"):
        save_pages(Tools(refuse="add_page"), 9, "Resumen", [paragraph()])


def test_read_mode_is_not_offered_it_and_a_call_is_refused(
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_READ)

    assert SAVE_ARTIFACT not in box.names
    assert box.call(SAVE_ARTIFACT, {}, approved=True).is_error


def test_it_waits_for_a_card_that_says_what_it_creates(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation = document(
        client, world, mocker, text_block(), figure_block(world["ventas"].id)
    )
    saved = mocker.spy(artifact_pages, "save_pages")
    use_model(
        mocker,
        reply(
            tool_use(
                SAVE_ARTIFACT,
                {"artifact_id": artifact["id"], "version": artifact["version"]},
            ),
            stop_reason="tool_use",
        ),
    )

    # A document written while reading is saved from a conversation of the editor
    response = ask(
        client, world["dashboard"], mode=MODE_EDIT, message="Guárdalo como página"
    )

    card = payloads(response, "confirm")[0]
    assert "Resumen" in card["title"]
    assert "2" in card["title"]
    saved.assert_not_called()
    assert conversation_id_of(response) != conversation


def _document_in_the_editor(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> tuple[dict[str, Any], str]:
    login(world, "Ana")
    ended, conversation = run(
        client, world, mocker, create(text_block("Primera")), mode=MODE_EDIT
    )
    return ended["artifact"], conversation


def _rewrite(client: Any, artifact: dict[str, Any]) -> dict[str, Any]:
    blocks = client.get(f"{URL}artifacts/{artifact['id']}/").json["result"]["blocks"]
    return change_call(
        artifact,
        {
            "action": "replace",
            "block_id": blocks[0]["id"],
            "block": text_block("Otra que nadie leyó en la tarjeta"),
        },
    )


def _versions(world: dict[str, Any]) -> int:  # noqa: F811
    return world["session"].query(AssistantArtifactVersion).count()


def test_a_save_of_a_version_that_does_not_exist_yet_gets_no_card(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    artifact, conversation = _document_in_the_editor(client, world, mocker)
    saved = mocker.spy(artifact_pages, "save_pages")
    use_model(
        mocker,
        reply(
            _rewrite(client, artifact),
            tool_use(SAVE_ARTIFACT, {"artifact_id": artifact["id"], "version": 2}),
            stop_reason="tool_use",
        ),
        reply(text("No pude")),
    )

    response = ask(
        client,
        world["dashboard"],
        mode=MODE_EDIT,
        message="Cámbialo y guárdalo",
        conversation_id=conversation,
    )

    assert payloads(response, "confirm") == []
    ended = {item["name"]: item for item in payloads(response, "tool_end")}
    assert ended[SAVE_ARTIFACT]["is_error"] is True
    assert ended[CHANGE_ARTIFACT]["is_error"] is False
    saved.assert_not_called()
    assert _versions(world) == 2


def test_a_save_approved_on_a_version_that_moved_before_it_runs_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    artifact, conversation = _document_in_the_editor(client, world, mocker)
    saved = mocker.spy(artifact_pages, "save_pages")
    use_model(
        mocker,
        reply(
            _rewrite(client, artifact),
            tool_use(SAVE_ARTIFACT, {"artifact_id": artifact["id"], "version": 1}),
            stop_reason="tool_use",
        ),
        reply(text("No pude")),
    )
    response = ask(
        client,
        world["dashboard"],
        mode=MODE_EDIT,
        message="Cámbialo y guárdalo",
        conversation_id=conversation,
    )
    card = payloads(response, "confirm")[0]
    stored = find_conversation(UUID(conversation), world["users"]["Ana"].id)
    assert pending_turn(stored).card_versions == {card["id"]: 1}

    decided = client.post(
        f"{URL}conversations/{conversation}/decide/",
        json={"tool_use_id": card["id"], "approved": True},
    )

    ended = {item["name"]: item for item in payloads(decided, "tool_end")}
    assert ended[CHANGE_ARTIFACT]["is_error"] is False
    assert ended[SAVE_ARTIFACT]["is_error"] is True
    saved.assert_not_called()


def test_a_save_runs_only_on_the_version_its_card_described(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    latest = mocker.MagicMock(number=2)
    mocker.patch.object(artifact_tools, "version_of", return_value=latest)
    mocker.patch.object(artifact_tools, "_on_this_report")
    saved = mocker.patch.object(artifact_pages, "save_pages", return_value={})
    request = SaveArtifactAsPage(artifact_id="x", version=2)
    mocker.patch.object(artifact_tools.artifacts, "blocks_of", return_value=[])

    def context(card_version: int | None) -> OwnToolContext:
        return OwnToolContext(1, UUID(int=1), 1, None, mocker.MagicMock(), card_version)

    for card_version in (None, 1):
        with pytest.raises(ArtifactRefusedError):
            artifact_tools._save(request, context(card_version))
    saved.assert_not_called()

    artifact_tools._save(request, context(2))
    saved.assert_called_once()


def test_the_card_describes_the_last_version_or_there_is_no_card(
    mocker: MockerFixture,
) -> None:
    latest = mocker.MagicMock(number=3, title="Resumen")
    mocker.patch.object(artifact_tools, "version_of", return_value=latest)
    mocker.patch.object(artifact_tools, "_on_this_report")
    mocker.patch.object(
        artifact_tools.artifacts, "blocks_of", return_value=[paragraph()]
    )
    mocker.patch(
        "superset.mcp_service.report_layout.editing.open_report",
        return_value=mocker.MagicMock(columns=COLUMNS, rows=ROWS),
    )
    context = OwnToolContext(1, UUID(int=1), 1, None)

    card = save_card({"artifact_id": "x", "version": 3}, context)

    assert card is not None
    assert card["version"] == 3
    assert "Resumen" in card["title"]
    assert save_card({"artifact_id": "x", "version": 2}, context) is None
    assert save_card({"artifact_id": "x", "version": 4}, context) is None


def test_an_unapproved_call_never_runs_whatever_the_model_says(
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_EDIT)

    outcome = box.call(SAVE_ARTIFACT, {"artifact_id": "x", "version": 1})

    assert outcome.is_error
    assert "approval" in outcome.content[0]["text"]
    assert box.needs_confirmation(SAVE_ARTIFACT)
    assert box.changes_something(SAVE_ARTIFACT)


def test_the_card_of_a_document_speaks_for_the_tools_of_a_page_alone(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    box = ToolBox("ana", MODE_EDIT, dashboard_id=1, user_id=world["users"]["Ana"].id)
    run = mocker.patch.object(box, "call")

    refused = box._call_page_tool("delete_dashboard", {"request": {}})
    box._call_page_tool("add_page", {"request": {}})

    assert refused.is_error
    run.assert_called_once_with("add_page", {"request": {}}, approved=True)


def test_the_person_decides_and_the_turn_can_be_undone(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    tools = Tools()
    mocker.patch.object(
        artifact_pages,
        "save_pages",
        side_effect=lambda call, *args: save_pages_with(tools, call, *args),
    )
    use_model(
        mocker,
        reply(
            tool_use(
                SAVE_ARTIFACT,
                {"artifact_id": artifact["id"], "version": artifact["version"]},
            ),
            stop_reason="tool_use",
        ),
        reply(text("Listo")),
    )
    response = ask(client, world["dashboard"], mode=MODE_EDIT, message="Guárdalo")
    conversation = conversation_id_of(response)
    card = payloads(response, "confirm")[0]

    decided = client.post(
        f"{URL}conversations/{conversation}/decide/",
        json={"tool_use_id": card["id"], "approved": True},
    )

    ended = payloads(decided, "tool_end")[0]
    assert ended["is_error"] is False
    assert ended["changed"] is True
    assert [name for name, _ in tools.calls][:2] == ["get_report_structure", "add_page"]


def save_pages_with(tools: Tools, _call: Any, *args: Any) -> dict[str, Any]:
    """The real plan, on tools that answer without a canvas behind them."""
    return REAL_SAVE_PAGES(tools, *args)


REAL_SAVE_PAGES = save_pages
