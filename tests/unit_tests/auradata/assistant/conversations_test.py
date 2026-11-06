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
Renaming and deleting conversations through the API: only the owner can, nothing but
the title changes, and deleting takes the content and leaves the accounting.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant.conversations import (
    ConversationLog,
    ERASED_CONTENT,
    find_conversation,
    turn_is_running,
    TURN_WINDOW,
)
from superset.auradata.assistant.spending import month_start, spent_usd, usage_report
from superset.auradata.models import (
    AssistantConversation,
    AssistantFeedback,
    AssistantMessage,
)
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    login,
    session_engine,
    SONNET,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import asks_to_delete
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text
from tests.unit_tests.auradata.assistant.feedback_test import answered, vote_url


def url_of(conversation_id: str) -> str:
    return f"{URL}conversations/{conversation_id}/"


def messages_of(world: dict[str, Any]) -> list[tuple[Any, ...]]:  # noqa: F811
    return [
        (row.id, row.seq, row.role, row.content, row.cost_usd, row.created_on)
        for row in world["session"]
        .query(AssistantMessage)
        .order_by(AssistantMessage.seq)
    ]


def test_a_rename_changes_the_title_and_nothing_it_holds(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    before = messages_of(world)

    response = client.put(url_of(conversation), json={"title": "  Ventas de marzo "})

    assert response.status_code == 200
    assert response.json["result"]["title"] == "Ventas de marzo"
    assert messages_of(world) == before
    stored = client.get(url_of(conversation)).json["result"]
    assert stored["title"] == "Ventas de marzo"


@pytest.mark.parametrize("title", ["", "   ", "x" * 81])
def test_a_title_must_have_a_sensible_length(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    title: str,
) -> None:
    conversation, _ = answered(client, world, mocker)
    original = world["session"].query(AssistantConversation).one().title

    response = client.put(url_of(conversation), json={"title": title})

    assert response.status_code == 400
    assert world["session"].query(AssistantConversation).one().title == original


def test_nobody_else_renames_or_deletes_a_conversation(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    title = world["session"].query(AssistantConversation).one().title
    before = messages_of(world)

    login(world, "Carlos")
    renamed = client.put(url_of(conversation), json={"title": "Mía"})
    deleted = client.delete(url_of(conversation))

    assert (renamed.status_code, deleted.status_code) == (404, 404)
    assert world["session"].query(AssistantConversation).one().title == title
    assert messages_of(world) == before


def test_a_conversation_that_never_was_is_a_404(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ana")
    missing = url_of("00000000-0000-0000-0000-000000000000")

    assert client.delete(missing).status_code == 404
    assert client.put(missing, json={"title": "Nada"}).status_code == 404


def test_deleting_removes_everything_that_was_said(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    private = "Margen secreto"
    conversation, _ = answered(client, world, mocker, answer=private)
    session = world["session"]

    assert client.delete(url_of(conversation)).status_code == 200

    assert client.get(url_of(conversation)).status_code == 404
    listed = client.get(
        f"{URL}conversations/?dashboard_id={world['shared_dashboard'].id}"
    )
    assert listed.json["result"] == []
    assert session.query(AssistantConversation).count() == 0
    rows = session.query(AssistantMessage).all()
    assert [row.role for row in rows] == ["assistant"]
    assert [row.content for row in rows] == [ERASED_CONTENT]
    assert rows[0].conversation_id is None
    assert all(private not in row.content for row in rows)


def test_deleting_changes_no_total_and_cannot_refill_a_limit(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, message = answered(client, world, mocker)
    client.put(
        vote_url(conversation, message),
        json={"vote": "down", "reason": "wrong_data"},
    )
    start = month_start(datetime.now())
    spent, report = spent_usd(start), usage_report(start)
    assert spent > 0

    login(world, "Ana")
    assert client.delete(url_of(conversation)).status_code == 200

    assert spent_usd(start) == spent
    assert usage_report(start) == report
    assert report["by_model"][0]["votes_down"] == 1
    vote = world["session"].query(AssistantFeedback).one()
    assert vote.conversation_id is None
    assert vote.reason is None


def test_deleting_one_leaves_the_others_as_they_were(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    gone, _ = answered(client, world, mocker, answer="Primera")
    kept, _ = answered(client, world, mocker, answer="Segunda")
    use_model(mocker, reply(text("Tercera")))
    ask(client, world["shared_dashboard"], "¿Y después?", conversation_id=kept)
    stored = client.get(url_of(kept)).json["result"]["messages"]

    client.delete(url_of(gone))

    assert client.get(url_of(kept)).json["result"]["messages"] == stored


def test_a_conversation_with_a_card_can_be_deleted_by_its_owner(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world))
    response = ask(client, world["dashboard"], mode="edit")

    assert client.delete(url_of(conversation_id_of(response))).status_code == 200


def test_a_person_can_delete_what_they_said_on_a_report_they_lost(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    mocker.patch("superset.auradata.assistant.api._open_dashboard", return_value=None)

    assert client.put(url_of(conversation), json={"title": "x"}).status_code == 404
    assert client.delete(url_of(conversation)).status_code == 200


def test_a_turn_under_way_is_not_deleted_under_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    row = find_conversation(UUID(conversation), world["users"]["Ana"].id)
    ConversationLog(row, world["users"]["Ana"].id).add_user_message(
        [{"type": "text", "text": "¿Y ahora?"}]
    )

    response = client.delete(url_of(conversation))

    assert response.status_code == 409
    assert client.get(url_of(conversation)).status_code == 200


def test_a_turn_that_died_stops_counting_as_under_way(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    row = find_conversation(UUID(conversation), world["users"]["Ana"].id)
    ConversationLog(row, world["users"]["Ana"].id).add_user_message(
        [{"type": "text", "text": "¿Y ahora?"}]
    )

    assert turn_is_running(row)
    assert not turn_is_running(row, datetime.now() + TURN_WINDOW + timedelta(seconds=1))


def test_an_undo_is_not_a_turn_under_way(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    row = find_conversation(UUID(conversation), world["users"]["Ana"].id)
    ConversationLog(row, world["users"]["Ana"].id).add_undone(
        {}, {"type": "text", "text": "Nota"}
    )

    assert not turn_is_running(row)


def test_the_list_follows_the_last_message_and_a_rename_does_not_move_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    older, _ = answered(client, world, mocker, answer="Primera")
    newer, _ = answered(client, world, mocker, answer="Segunda")
    session = world["session"]
    session.query(AssistantMessage).filter(
        AssistantMessage.conversation_id == UUID(older).bytes
    ).update({"created_on": datetime.now() - timedelta(days=3)})
    session.commit()

    client.put(url_of(older), json={"title": "Otro nombre"})
    listed = client.get(
        f"{URL}conversations/?dashboard_id={world['shared_dashboard'].id}"
    ).json["result"]

    assert [item["id"] for item in listed] == [newer, older]
    assert listed[0]["last_message_on"] > listed[1]["last_message_on"]
