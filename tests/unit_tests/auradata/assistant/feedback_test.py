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
Votes on the answers of the assistant, through the API: whose they are, what they leave
untouched, and what admins read of them.
"""

from datetime import datetime
from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant.spending import month_start, usage_report
from superset.auradata.models import (
    AssistantConversation,
    AssistantFeedback,
    AssistantMessage,
)
from superset.utils import json
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    HAIKU,
    login,
    payloads,
    session_engine,
    SONNET,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import asks_to_delete, decide
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text, tool_use


def vote_url(conversation_id: str, message_id: str) -> str:
    return f"{URL}conversations/{conversation_id}/messages/{message_id}/feedback/"


def answered(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    name: str = "Ana",
    answer: str = "Vendimos 10",
) -> tuple[str, str]:
    """A person asks and gets an answer: its conversation, and the id to vote on."""
    login(world, name)
    use_model(mocker, reply(text(answer)))
    response = ask(client, world["shared_dashboard"])
    return (
        conversation_id_of(response),
        payloads(response, "done")[0]["message_id"],
    )


def rows_of(world: dict[str, Any]) -> list[AssistantFeedback]:  # noqa: F811
    return world["session"].query(AssistantFeedback).all()


def test_a_vote_stays_and_comes_back_with_the_conversation(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)

    response = client.put(
        vote_url(conversation, message),
        json={"vote": "down", "reason": "wrong_data"},
    )

    assert response.status_code == 200
    assert response.json["result"] == {"vote": "down", "reason": "wrong_data"}
    stored = client.get(f"{URL}conversations/{conversation}/").json["result"]
    assert stored["feedback"] == {message: {"vote": "down", "reason": "wrong_data"}}
    assert stored["messages"][1]["id"] == message


def test_a_vote_can_change_and_stays_one_row(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    url = vote_url(conversation, message)

    client.put(url, json={"vote": "down", "reason": "off_topic"})
    response = client.put(url, json={"vote": "up", "reason": "off_topic"})

    assert response.json["result"] == {"vote": "up", "reason": None}
    [row] = rows_of(world)
    assert (row.vote, row.reason) == ("up", None)
    assert row.user_id == world["users"]["Ana"].id


def test_a_vote_can_be_taken_back(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    url = vote_url(conversation, message)
    client.put(url, json={"vote": "up"})

    assert client.delete(url).status_code == 200
    assert client.delete(url).status_code == 200

    assert rows_of(world) == []
    stored = client.get(f"{URL}conversations/{conversation}/").json["result"]
    assert stored["feedback"] == {}


def test_nobody_votes_in_the_conversation_of_someone_else(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    url = vote_url(conversation, message)
    client.put(url, json={"vote": "up"})

    login(world, "Dani")

    assert client.put(url, json={"vote": "down"}).status_code == 404
    assert client.delete(url).status_code == 404
    [row] = rows_of(world)
    assert (row.vote, row.user_id) == ("up", world["users"]["Ana"].id)


def test_a_message_of_another_conversation_is_not_found(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    _, of_ana = answered(client, world, mocker)
    own, _ = answered(client, world, mocker, "Dani")

    response = client.put(vote_url(own, of_ana), json={"vote": "up"})

    assert response.status_code == 404
    assert rows_of(world) == []


def test_only_an_answer_takes_a_vote(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    question = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.role == "user")
        .one()
    )

    response = client.put(vote_url(conversation, str(question.id)), json={"vote": "up"})

    assert response.status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {"vote": "maybe"},
        {},
        {"vote": "down", "reason": "pegué aquí las cifras de la empresa"},
    ],
)
def test_a_vote_outside_the_lists_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    body: dict[str, str],
) -> None:
    conversation, message = answered(client, world, mocker)

    response = client.put(vote_url(conversation, message), json=body)

    assert response.status_code == 400
    assert rows_of(world) == []


def test_a_vote_leaves_the_conversation_as_it_was(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    session = world["session"]

    def snapshot() -> list[tuple[Any, ...]]:
        return [
            (row.id, row.seq, row.role, row.content, row.stop_reason, row.cost_usd)
            for row in session.query(AssistantMessage)
            .order_by(AssistantMessage.seq)
            .all()
        ]

    def touched() -> datetime:
        return session.query(AssistantConversation).one().changed_on

    messages, changed_on = snapshot(), touched()

    client.put(vote_url(conversation, message), json={"vote": "up"})
    client.put(vote_url(conversation, message), json={"vote": "down"})
    client.delete(vote_url(conversation, message))

    assert snapshot() == messages
    assert touched() == changed_on


def test_a_turn_of_several_calls_is_voted_on_its_first_row(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(
        mocker,
        reply(tool_use("get_dashboard_info", {"id": 1}), stop_reason="tool_use"),
        reply(text("Listo")),
    )

    response = ask(client, world["shared_dashboard"])

    message = payloads(response, "done")[0]["message_id"]
    first = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.role == "assistant")
        .order_by(AssistantMessage.seq)
        .first()
    )
    assert message == str(first.id)


def test_a_failed_call_names_no_message(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, (500, "api_error"))

    response = ask(client, world["shared_dashboard"])

    assert payloads(response, "done") == []


def test_a_confirmed_turn_keeps_the_id_of_the_answer_that_asked(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world))
    response = ask(client, world["dashboard"], mode="edit")
    conversation = conversation_id_of(response)
    first = payloads(response, "done")[0]["message_id"]

    use_model(mocker, reply(text("Borrado")))
    decided = decide(client, conversation, approved=True)

    assert first != payloads(decided, "done")[0]["message_id"]
    stored = client.get(f"{URL}conversations/{conversation}/").json["result"]
    assert stored["messages"][1]["id"] == first


def test_admins_read_totals_of_the_month_and_nothing_written(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    private = "Margen secreto"
    conversation, message = answered(client, world, mocker, answer=private)
    client.put(
        vote_url(conversation, message),
        json={"vote": "down", "reason": "wrong_data"},
    )
    conversation, message = answered(client, world, mocker)
    client.put(vote_url(conversation, message), json={"vote": "up"})
    answered(client, world, mocker)

    now = datetime.now()
    report = usage_report(month_start(now), now)

    [model] = report["by_model"]
    assert (model["answers"], model["votes_up"], model["votes_down"]) == (3, 1, 1)
    [workspace] = report["by_workspace"]
    assert (workspace["votes_up"], workspace["votes_down"]) == (1, 1)
    assert "votes_up" not in report["by_user"][0]
    dumped = json.dumps(report)
    assert private not in dumped
    assert "wrong_data" not in dumped


def test_votes_count_in_the_month_of_their_answer(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    client.put(vote_url(conversation, message), json={"vote": "up"})
    answer = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.role == "assistant")
        .one()
    )
    answer.created_on = datetime(2026, 1, 15)
    world["session"].commit()

    assert usage_report(datetime(2026, 1, 1))["by_model"][0]["votes_up"] == 1
    now = datetime.now()
    assert usage_report(month_start(now), now)["by_model"] == []


def test_a_person_who_is_not_admin_reads_no_totals(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ada")

    assert client.get("/api/v1/auradata_assistant/usage/").status_code == 403
