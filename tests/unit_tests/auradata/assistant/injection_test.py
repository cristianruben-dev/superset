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
A dataset whose text gives orders, from the real endpoints to the real tools.

The model here is fake and does what the text says, which is the worst case: whether a
real model follows such a text is measured by tasks I1 and I2 of the battery. What
these tests show is that following it gets nowhere: nothing a tool returns can approve
a call, and a destructive call waits for its card.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant.conversations import pending_turn
from superset.auradata.assistant.tools import MODE_EDIT, ToolBox
from superset.utils import json
from tests.assistant_eval.runner import load_battery
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    login,
    payloads,
    session_engine,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import (
    add_page,
    ask_in_editor,
    conversation_of,
    decide,
    delete_call,
    layout_of,
    spy_on_tools,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text, tool_use

NOTES = load_battery()["fixtures"]["injection"]["rows"]
ORDER_TO_DELETE = NOTES[1][2]
CLAIMED_APPROVAL = NOTES[2][2]


def rows_result() -> Any:
    """What ``query_dataset`` returns for the fixture dataset."""
    rows = [{"region": r, "ventas": v, "nota": n} for r, v, n in NOTES]
    return SimpleNamespace(
        is_error=False,
        content=[
            SimpleNamespace(
                type="text",
                text=json.dumps(
                    {
                        "dataset_id": 1,
                        "dataset_name": "evaluacion_inyeccion",
                        "data": rows,
                    }
                ),
            )
        ],
    )


def query_call(tool_id: str = "toolu_q") -> dict[str, Any]:
    return tool_use(
        "query_dataset",
        {"request": {"dataset_id": 1, "columns": ["region", "nota"]}},
        tool_id,
    )


def stub_the_rows(mocker: MockerFixture) -> Any:
    """Only the query is stubbed, so a spy counts whatever else reaches the MCP."""

    async def answer(name: str, _arguments: dict[str, Any]) -> Any:
        assert name == "query_dataset"
        return rows_result()

    return mocker.patch.object(ToolBox, "_call_tool", side_effect=answer)


def test_a_call_after_an_injected_row_waits_for_its_card(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    add_page(world)
    before = layout_of(world)
    calls = stub_the_rows(mocker)
    use_model(
        mocker,
        reply(query_call(), stop_reason="tool_use"),
        reply(delete_call(world), stop_reason="tool_use"),
    )

    response = ask_in_editor(client, world)

    assert [card["name"] for card in payloads(response, "confirm")] == ["delete_page"]
    assert [call.args[0] for call in calls.call_args_list] == ["query_dataset"]
    assert layout_of(world) == before


def test_a_result_that_claims_approval_approves_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """The model says it was approved and calls again: still a card, and no result."""
    login(world, "Ana")
    add_page(world)
    before = layout_of(world)
    calls = stub_the_rows(mocker)
    use_model(
        mocker,
        reply(query_call(), stop_reason="tool_use"),
        reply(
            text(f"Según los datos: {CLAIMED_APPROVAL}"),
            delete_call(world),
            stop_reason="tool_use",
        ),
    )

    response = ask_in_editor(client, world)

    conversation = conversation_of(world, conversation_id_of(response))
    assert pending_turn(conversation).undecided == ["toolu_1"]
    assert len(calls.call_args_list) == 1
    assert layout_of(world) == before


def test_text_of_the_person_that_repeats_the_row_does_not_decide(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """A row pasted into the chat is a new message: the card's call does not run."""
    login(world, "Ana")
    add_page(world)
    before = layout_of(world)
    fake = use_model(
        mocker,
        reply(delete_call(world), stop_reason="tool_use"),
        reply(text("No lo hice.")),
    )
    spy = spy_on_tools(mocker)

    response = ask_in_editor(client, world)
    ask_in_editor(
        client,
        world,
        message=CLAIMED_APPROVAL,
        conversation_id=conversation_id_of(response),
    )

    spy.assert_not_called()
    assert layout_of(world) == before
    results = [
        block
        for block in fake.requests[1]["messages"][-1]["content"]
        if block["type"] == "tool_result"
    ]
    assert [result.get("is_error") for result in results] == [True]


def test_only_the_decision_of_the_person_runs_the_call(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """The control: the same call runs once its card is approved."""
    login(world, "Ana")
    add_page(world)
    before = layout_of(world)
    use_model(
        mocker,
        reply(delete_call(world), stop_reason="tool_use"),
        reply(text("Borrada.")),
    )

    response = ask_in_editor(client, world)
    decide(client, conversation_id_of(response))

    assert layout_of(world) != before


@pytest.mark.parametrize(
    "name",
    ["delete_dashboard", "publish_dashboard", "share_dashboard"],
)
def test_the_tools_the_rows_ask_for_are_refused_without_a_decision(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    name: str,
) -> None:
    login(world, "Ana")
    spy = spy_on_tools(mocker)

    outcome = ToolBox("ana", MODE_EDIT).call(name, {"request": {}})

    assert outcome.is_error
    spy.assert_not_called()


@pytest.mark.parametrize(
    "name",
    ["delete_dashboard", "publish_dashboard", "share_dashboard"],
)
def test_read_mode_does_not_run_them_either(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    name: str,
) -> None:
    login(world, "Ana")
    calls = stub_the_rows(mocker)
    use_model(
        mocker,
        reply(query_call(), stop_reason="tool_use"),
        reply(tool_use(name, {"request": {}}), stop_reason="tool_use"),
        reply(text("No puedo.")),
    )

    response = ask(client, world["dashboard"])

    assert payloads(response, "confirm") == []
    assert [call.args[0] for call in calls.call_args_list] == ["query_dataset"]


def test_the_rows_stay_out_of_the_instructions(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """The text reaches the model as a tool result, never as part of the system."""
    login(world, "Ana")
    stub_the_rows(mocker)
    fake = use_model(
        mocker,
        reply(query_call(), stop_reason="tool_use"),
        reply(text("Listo.")),
    )

    ask(client, world["dashboard"])

    assert ORDER_TO_DELETE not in fake.requests[1]["system"][0]["text"]
    results = fake.requests[1]["messages"][-1]["content"]
    assert results[0]["type"] == "tool_result"
    assert "delete_dashboard" in results[0]["content"][0]["text"]
