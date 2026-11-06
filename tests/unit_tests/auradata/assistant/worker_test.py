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
A turn in a worker: who it acts as, what it can do, and what happens to it.

Each test runs ``run_turn`` the way the task does: in an application context of its own,
with no request. ``MCP_DEV_USERNAME`` points at the Superset admin of the world, and the
tests that matter most also leave that admin in ``g``: a turn that fell back on either
would see and change everything. The model is fake; users, tools, their permission
checks and the database are real.
"""

import time
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from flask import current_app, g, has_request_context, request, session
from pytest_mock import MockerFixture

from superset import security_manager
from superset.auradata.assistant import (
    turn_store as turn_store_module,
    turns as turns_module,
)
from superset.auradata.assistant.conversations import (
    ConversationLog,
    create_conversation,
    find_conversation,
    history_of,
    LOST,
    lost_turns,
    pending_turn,
    turn_is_running,
)
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ, ToolBox
from superset.auradata.assistant.turn_store import (
    ABANDONED,
    TAKEN,
    TURN_END,
    TurnTicket,
)
from superset.auradata.assistant.turns import (
    KIND_CHAT,
    KIND_DECIDE,
    NO_WORKER,
    run_turn,
    settle_turn,
    WORKER_LOST,
)
from superset.auradata.models import AssistantMessage
from superset.db_engine_specs.snowflake import SnowflakeEngineSpec
from superset.mcp_service.auth import (
    get_user_from_request,
    InProcessPrincipal,
    run_as,
)
from superset.utils import json
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    catalog_model,
    conversation_id_of,
    login,
    payloads,
    session_engine,
    SONNET,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import (
    ask_in_editor,
    asks_to_delete,
    decide,
    delete_call,
    spy_on_tools,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import (
    reply,
    text,
    tool_use,
)

ADD_PAGE = "add_page"


def open_turn(
    world: dict[str, Any],  # noqa: F811
    store: Any,
    name: str,
    mode: str = MODE_READ,
    kind: str = KIND_CHAT,
    conversation: Any = None,
    dashboard: Any = None,
    **changes: Any,
) -> TurnTicket:
    """What the web request leaves behind for the worker, past all its checks."""
    user = world["users"][name]
    dashboard = dashboard or world["dashboard"]
    if conversation is None:
        conversation = create_conversation(user.id, dashboard.id, mode, SONNET, "Hola")
        ConversationLog(conversation, user.id).add_user_message([text("Hola")])
    turn_id = str(uuid4())
    assert store.acquire(conversation.id, turn_id)
    ticket = TurnTicket(
        **{
            "turn_id": turn_id,
            "conversation_id": str(conversation.id),
            "user_id": user.id,
            "kind": kind,
            "mode": mode,
            "model": SONNET,
            "dashboard_id": dashboard.id,
            "locale": None,
            "after": store.last_event(conversation.id),
            "seq": 0,
            "opened_at": time.time(),
            **changes,
        }
    )
    store.save_ticket(ticket)
    return ticket


def in_worker(store: Any, ticket: TurnTicket, ambient: Any = None) -> None:
    """The task: no request, and an application context of its own."""
    with current_app._get_current_object().app_context():
        assert not has_request_context()
        if ambient is not None:
            g.user = ambient
        run_turn(store, ticket.turn_id)


def written(store: Any, ticket: TurnTicket) -> list[tuple[str, dict[str, Any]]]:
    return [
        (event, json.loads(data))
        for _number, event, data in store.read(ticket.conversation_id, 0, 0)
    ]


def named(events: list[tuple[str, Any]], name: str) -> list[Any]:
    return [data for event, data in events if event == name]


def tool_answers(world: dict[str, Any]) -> list[dict[str, Any]]:  # noqa: F811
    world["session"].expire_all()
    rows = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.role == "user")
        .order_by(AssistantMessage.seq)
        .all()
    )
    blocks = [block for row in rows for block in json.loads(row.content)]
    return [block for block in blocks if block["type"] == "tool_result"]


AMBIENT = pytest.mark.parametrize("ambient", [False, True], ids=["clean", "admin_in_g"])


# Who the worker acts as


@AMBIENT
def test_a_viewer_cannot_start_an_edit_turn_in_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
    ambient: bool,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(world, turn_memory, "Vera", MODE_EDIT)

    in_worker(turn_memory, ticket, world["users"]["Root"] if ambient else None)

    assert fake.requests == []
    assert named(written(turn_memory, ticket), "error")[0]["code"] == "refused"


@AMBIENT
def test_the_real_tool_refuses_a_viewer_in_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
    ambient: bool,
) -> None:
    """Past every check of the assistant, the write still rests on the person."""
    mocker.patch.object(turns_module, "_may_still_run", return_value=True)
    dashboard = world["dashboard"]
    before = dashboard.position_json
    use_model(
        mocker,
        reply(
            tool_use(
                ADD_PAGE, {"request": {"dashboard": dashboard.id, "name": "Otra"}}
            ),
            stop_reason="tool_use",
        ),
        reply(text("Listo")),
    )
    ticket = open_turn(world, turn_memory, "Vera", MODE_EDIT)

    in_worker(turn_memory, ticket, world["users"]["Root"] if ambient else None)

    world["session"].expire_all()
    assert dashboard.position_json == before
    answers = tool_answers(world)
    assert json.loads(answers[0]["content"][0]["text"])["permission_denied"] is True


def test_the_same_write_works_for_a_contributor_in_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    """The control of the test above: the refusal came from the rules, not the setup."""
    dashboard = world["dashboard"]
    before = dashboard.position_json
    use_model(
        mocker,
        reply(
            tool_use(
                ADD_PAGE, {"request": {"dashboard": dashboard.id, "name": "Otra"}}
            ),
            stop_reason="tool_use",
        ),
        reply(text("Listo")),
    )
    ticket = open_turn(world, turn_memory, "Ana", MODE_EDIT)

    in_worker(turn_memory, ticket)

    world["session"].expire_all()
    assert dashboard.position_json != before
    assert json.loads(tool_answers(world)[0]["content"][0]["text"])["error"] is None


@AMBIENT
def test_read_mode_in_the_worker_offers_no_write_and_refuses_one_made_up(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
    ambient: bool,
) -> None:
    dashboard = world["dashboard"]
    before = dashboard.position_json
    run = spy_on_tools(mocker)
    fake = use_model(
        mocker,
        reply(
            tool_use(
                ADD_PAGE, {"request": {"dashboard": dashboard.id, "name": "Otra"}}
            ),
            stop_reason="tool_use",
        ),
        reply(text("Listo")),
    )
    ticket = open_turn(world, turn_memory, "Ana", MODE_READ)

    in_worker(turn_memory, ticket, world["users"]["Root"] if ambient else None)

    offered = {tool.get("name") for tool in fake.requests[0]["tools"]}
    assert ADD_PAGE not in offered
    assert run.call_count == 0
    world["session"].expire_all()
    assert dashboard.position_json == before
    assert tool_answers(world)[0]["is_error"] is True


@AMBIENT
def test_a_call_that_needs_a_person_does_not_run_in_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
    ambient: bool,
) -> None:
    run = spy_on_tools(mocker)
    fake = use_model(mocker, asks_to_delete(world), reply(text("no llega")))
    ticket = open_turn(world, turn_memory, "Ana", MODE_EDIT)

    in_worker(turn_memory, ticket, world["users"]["Root"] if ambient else None)

    assert run.call_count == 0
    assert len(fake.requests) == 1
    assert named(written(turn_memory, ticket), "confirm")
    conversation = find_conversation(
        UUID(ticket.conversation_id), world["users"]["Ana"].id
    )
    assert pending_turn(conversation).undecided == ["toolu_1"]


@AMBIENT
def test_tools_in_the_worker_see_what_the_person_sees(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
    ambient: bool,
) -> None:
    script = (
        reply(tool_use("list_dashboards", {"request": {}}), stop_reason="tool_use"),
        reply(text("Listo")),
    )
    fake = use_model(mocker, *script)
    shared = world["shared_dashboard"]
    in_worker(turn_memory, open_turn(world, turn_memory, "Root", dashboard=shared))
    everything = json.dumps(fake.requests[1]["messages"][-1]["content"])
    fake = use_model(mocker, *script)

    in_worker(
        turn_memory,
        open_turn(world, turn_memory, "Dani", dashboard=shared),
        world["users"]["Root"] if ambient else None,
    )

    seen = json.dumps(fake.requests[1]["messages"][-1]["content"])
    assert world["dashboard"].dashboard_title in everything
    assert world["dashboard"].dashboard_title not in seen


def test_the_action_log_names_the_person_of_the_turn(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    log = mocker.spy(ToolBox, "_log_call")
    use_model(
        mocker,
        reply(tool_use("list_dashboards", {"request": {}}), stop_reason="tool_use"),
        reply(text("Listo")),
    )

    in_worker(
        turn_memory,
        open_turn(world, turn_memory, "Ana"),
        world["users"]["Root"],
    )

    assert log.call_args.args[3] == world["users"]["Ana"].id


# A user who can no longer act


def test_an_inactive_user_fails_closed(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(world, turn_memory, "Ana")
    world["users"]["Ana"].active = False
    world["session"].commit()

    in_worker(turn_memory, ticket)

    assert fake.requests == []
    assert named(written(turn_memory, ticket), "error")[0]["code"] == "refused"
    assert turn_memory.holder(ticket.conversation_id) is None


def test_a_deleted_user_fails_closed(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(world, turn_memory, "Ana", user_id=999_999)

    in_worker(turn_memory, ticket, world["users"]["Root"])

    assert fake.requests == []
    assert named(written(turn_memory, ticket), "error")[0]["code"] == "refused"


def test_a_ticket_for_someone_who_does_not_own_the_conversation_is_refused(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(world, turn_memory, "Ana", user_id=world["users"]["Root"].id)

    in_worker(turn_memory, ticket)

    assert fake.requests == []
    assert named(written(turn_memory, ticket), "error")[0]["code"] == "refused"


def test_a_ticket_that_disagrees_with_its_conversation_is_refused(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(
        world, turn_memory, "Ana", dashboard_id=world["shared_dashboard"].id
    )

    in_worker(turn_memory, ticket)

    assert fake.requests == []


def test_a_user_who_loses_the_report_stops_at_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("no")))
    ticket = open_turn(world, turn_memory, "Ana")
    mocker.patch.object(turns_module, "open_dashboard", return_value=None)

    in_worker(turn_memory, ticket)

    assert fake.requests == []


def test_a_turn_runs_in_an_empty_post_request_as_the_web_does(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    """
    Code asks ``has_request_context``: without one, Snowflake drops per-user OAuth2 for
    shared credentials and ``SavedQueryFilter`` opens up. A session here could only be
    an identity nobody checked, so it must stay empty.
    """
    seen: dict[str, Any] = {}
    original = ToolBox._call_tool

    async def spy(name: str, arguments: dict[str, Any]) -> Any:
        seen.update(
            has_request=has_request_context(),
            method=request.method,
            cookies=dict(request.cookies),
            session=dict(session),
            user=g.user.username,
            login_user=g._login_user.username,
        )
        return await original(name, arguments)

    mocker.patch.object(ToolBox, "_call_tool", side_effect=spy)
    use_model(
        mocker,
        reply(tool_use("list_dashboards", {"request": {}}), stop_reason="tool_use"),
        reply(text("Listo")),
    )

    in_worker(
        turn_memory,
        open_turn(world, turn_memory, "Ana"),
        world["users"]["Root"],
    )

    assert seen == {
        "has_request": True,
        "method": "POST",
        "cookies": {},
        "session": {},
        "user": "ana",
        "login_user": "ana",
    }


def test_oauth2_of_a_database_stays_on_in_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    seen: list[bool] = []
    fake = use_model(mocker, reply(text("Listo")))
    mocker.patch.dict(
        current_app.config, {"DATABASE_OAUTH2_CLIENTS": {"Snowflake": {}}}
    )
    prepare = turns_module._prepare_turn

    def check(*args: Any) -> Any:
        seen.append(SnowflakeEngineSpec.is_oauth2_enabled())
        return prepare(*args)

    mocker.patch.object(turns_module, "_prepare_turn", side_effect=check)

    in_worker(turn_memory, open_turn(world, turn_memory, "Ana"))

    assert seen == [SnowflakeEngineSpec.supports_oauth2]
    assert fake.requests


def test_a_name_taken_by_someone_else_never_runs_a_tool(
    world: dict[str, Any],  # noqa: F811
) -> None:
    principal = InProcessPrincipal("root", None, world["users"]["Ana"].id)

    with run_as(principal), pytest.raises(PermissionError):
        get_user_from_request()


# It runs once


def test_a_second_delivery_of_a_task_does_not_run(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("Una vez")), reply(text("Dos veces")))
    ticket = open_turn(world, turn_memory, "Ana")

    in_worker(turn_memory, ticket)
    in_worker(turn_memory, ticket)

    assert len(fake.requests) == 1


def test_a_delivery_after_the_reader_gave_up_does_not_run(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("Tarde")))
    ticket = open_turn(world, turn_memory, "Ana")
    assert turn_memory.claim(ticket.turn_id, ABANDONED)

    in_worker(turn_memory, ticket)

    assert fake.requests == []


def test_a_lock_without_a_ticket_yet_is_left_alone(
    world: dict[str, Any],  # noqa: F811
    turn_memory: Any,
) -> None:
    """A request between taking the turn and writing the ticket, and a reader."""
    conversation = create_conversation(
        world["users"]["Ana"].id, world["dashboard"].id, MODE_READ, SONNET, "Hola"
    )
    assert turn_memory.acquire(conversation.id, "turn")

    settle_turn(turn_memory, conversation.id)

    assert turn_memory.holder(conversation.id) == "turn"


def test_a_lock_that_never_got_its_ticket_lets_go_after_the_grace(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    conversation = create_conversation(
        world["users"]["Ana"].id, world["dashboard"].id, MODE_READ, SONNET, "Hola"
    )
    assert turn_memory.acquire(conversation.id, "turn")
    mocker.patch.object(turns_module, "TICKET_GRACE_SECONDS", 0)

    settle_turn(turn_memory, conversation.id)

    assert turn_memory.holder(conversation.id) is None


def test_a_failed_queueing_leaves_alone_a_turn_a_worker_took(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    """The broker can take a message and still answer with an error."""
    login(world, "Ana")

    def taken_then_refused(ticket: TurnTicket) -> None:
        assert turn_memory.claim(ticket.turn_id)
        turn_memory.beat(ticket.turn_id)
        turn_memory.publish(
            ticket.conversation_id, ticket.turn_id, TURN_END, {}, last=True
        )
        raise ConnectionError("down")

    mocker.patch.object(turns_module, "enqueue", side_effect=taken_then_refused)

    response = ask(client, world["dashboard"])

    assert payloads(response, "error") == []
    ticket = next(iter(turn_memory.tickets.values()))
    conversation = find_conversation(
        UUID(ticket.conversation_id), world["users"]["Ana"].id
    )
    assert lost_turns(conversation) == []
    assert turn_memory.claimed(ticket.turn_id) == TAKEN


def test_a_task_without_a_ticket_does_nothing(
    mocker: MockerFixture, turn_memory: Any, app_context: None
) -> None:
    claim = mocker.spy(turn_memory, "claim")

    run_turn(turn_memory, "made-up")

    assert claim.call_count == 0


def test_the_task_takes_no_retries_and_is_acknowledged_as_it_starts() -> None:
    from superset.tasks.assistant_turn import run_assistant_turn

    assert run_assistant_turn.acks_late is False
    assert run_assistant_turn.max_retries == 0
    assert run_assistant_turn.reject_on_worker_lost is False
    assert run_assistant_turn.name == "auradata_assistant.run_turn"


# It stops


def test_a_stop_before_the_turn_starts_sends_nothing_to_the_model(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker, reply(text("Hola, hola")))
    ticket = open_turn(world, turn_memory, "Ana")
    turn_memory.ask_to_stop(ticket.turn_id)

    in_worker(turn_memory, ticket)

    events = written(turn_memory, ticket)
    assert fake.requests == []
    assert named(events, "done")[0]["stop_reason"] == "interrupted"
    assert events[-1][0] == "turn_end"


def test_a_stop_between_tools_leaves_the_next_one_unrun_and_the_history_valid(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    mocker.patch.object(turns_module, "WATCH_SECONDS", 0.001)
    fake = use_model(
        mocker,
        reply(tool_use("list_dashboards", {"request": {}}), stop_reason="tool_use"),
        reply(text("no llega")),
    )
    run = spy_on_tools(mocker)
    ticket = open_turn(world, turn_memory, "Ana")
    send_all = turns_module._send_all

    def stop_at_once(store: Any, seen: Any, events: Any, watch: Any) -> Any:
        watch.stop_asked.set()
        return send_all(store, seen, events, watch)

    mocker.patch.object(turns_module, "_send_all", side_effect=stop_at_once)

    in_worker(turn_memory, ticket)

    assert run.call_count == 0
    assert len(fake.requests) <= 1
    conversation = find_conversation(
        UUID(ticket.conversation_id), world["users"]["Ana"].id
    )
    calls = [
        block
        for message in history_of(conversation)
        for block in message["content"]
        if block["type"] == "tool_use"
    ]
    results = [
        block
        for message in history_of(conversation)
        for block in message["content"]
        if block["type"] == "tool_result"
    ]
    assert len(calls) == len(results)


def test_a_turn_past_its_time_stops_as_a_stop_does(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    mocker.patch.object(turns_module, "turn_seconds", return_value=-1)
    use_model(mocker, reply(text("Hola")))
    ticket = open_turn(world, turn_memory, "Ana")

    in_worker(turn_memory, ticket)

    events = written(turn_memory, ticket)
    assert named(events, "error")[0]["code"] == "timed_out"
    assert named(events, "done")[0]["stop_reason"] == "interrupted"


def test_stop_asks_only_for_the_running_turn_and_only_of_its_owner(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = open_turn(world, turn_memory, "Ana")
    stop = f"{URL}conversations/{ticket.conversation_id}/stop/"

    login(world, "Dani")
    assert client.post(stop).status_code == 404
    assert not turn_memory.stop_asked(ticket.turn_id)

    login(world, "Ana")
    assert client.post(stop).json["result"] == {"stopping": True}
    assert turn_memory.stop_asked(ticket.turn_id)


def test_a_stop_that_arrives_after_the_end_changes_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")), reply(text("Otra")))
    conversation_id = conversation_id_of(ask(client, world["shared_dashboard"]))

    response = client.post(f"{URL}conversations/{conversation_id}/stop/")

    assert response.status_code == 200
    assert response.json["result"] == {"stopping": False}
    second = ask(client, world["shared_dashboard"], conversation_id=conversation_id)
    assert payloads(second, "done")[0]["stop_reason"] == "end_turn"


# A worker that dies


def dead_turn(
    world: dict[str, Any],  # noqa: F811
    store: Any,
    name: str = "Ana",
    **fields: Any,
) -> TurnTicket:
    """A turn a worker took and then lost: no pulse, nothing more written."""
    ticket = open_turn(world, store, name, **fields)
    assert store.claim(ticket.turn_id)
    return ticket


def test_a_dead_worker_leaves_a_clear_message_and_a_usable_conversation(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = dead_turn(world, turn_memory)
    url = f"{URL}conversations/{ticket.conversation_id}/"
    login(world, "Ana")

    body = client.get(f"{url}stream/?after=0").get_data(as_text=True)

    assert "event: error" in body
    assert WORKER_LOST in body
    assert "event: turn_end" in body
    assert turn_memory.holder(ticket.conversation_id) is None
    stored = client.get(url).json["result"]
    assert stored["interrupted"]
    assert stored["running"] is None

    conversation = find_conversation(
        UUID(ticket.conversation_id), world["users"]["Ana"].id
    )
    assert not turn_is_running(conversation)
    use_model(mocker, reply(text("Sigo aquí")))
    answer = ask(
        client,
        world["dashboard"],
        conversation_id=ticket.conversation_id,
    )
    assert answer.status_code == 200
    assert payloads(answer, "done")


def test_a_dead_turn_is_repaired_once_however_many_find_it(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = dead_turn(world, turn_memory)

    settle_turn(turn_memory, ticket.conversation_id)
    settle_turn(turn_memory, ticket.conversation_id)

    conversation = find_conversation(
        UUID(ticket.conversation_id), world["users"]["Ana"].id
    )
    assert len(lost_turns(conversation)) == 1
    assert len(named(written(turn_memory, ticket), "turn_end")) == 1


def test_a_turn_with_a_pulse_is_left_alone(
    world: dict[str, Any],  # noqa: F811
    turn_memory: Any,
) -> None:
    ticket = dead_turn(world, turn_memory)
    turn_memory.beat(ticket.turn_id)

    settle_turn(turn_memory, ticket.conversation_id)

    assert turn_memory.holder(ticket.conversation_id) == ticket.turn_id


def test_a_worker_given_up_for_dead_writes_nothing_more(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = dead_turn(world, turn_memory)
    settle_turn(turn_memory, ticket.conversation_id)
    before = written(turn_memory, ticket)

    assert (
        turn_memory.publish(
            ticket.conversation_id, ticket.turn_id, "text", {"text": "x"}
        )
        == 0
    )
    assert written(turn_memory, ticket) == before


def test_a_decided_turn_whose_worker_died_answers_its_calls(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world))
    conversation_id = conversation_id_of(ask_in_editor(client, world))
    user_id = world["users"]["Ana"].id
    conversation = find_conversation(UUID(conversation_id), user_id)
    ConversationLog(conversation, user_id).add_decision("toolu_1", True)
    dead_turn(
        world,
        turn_memory,
        mode=MODE_EDIT,
        kind=KIND_DECIDE,
        conversation=conversation,
    )

    settle_turn(turn_memory, conversation_id)

    assert pending_turn(conversation) is None
    assert tool_answers(world)[0]["content"][0]["text"] == LOST
    use_model(mocker, reply(text("Vale")))
    answer = ask_in_editor(client, world, conversation_id=conversation_id)
    assert answer.status_code == 200


def test_decided_calls_with_no_turn_left_do_not_block_the_next_message(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    """Redis lost the lock too, so nothing can say the worker died."""
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world))
    conversation_id = conversation_id_of(ask_in_editor(client, world))
    user_id = world["users"]["Ana"].id
    conversation = find_conversation(UUID(conversation_id), user_id)
    ConversationLog(conversation, user_id).add_decision("toolu_1", True)
    use_model(mocker, reply(text("Vale")))

    answer = ask_in_editor(client, world, conversation_id=conversation_id)

    assert answer.status_code == 200
    assert payloads(answer, "done")
    assert tool_answers(world)[0]["content"][0]["text"] == LOST


def test_a_turn_no_worker_took_says_so_after_the_wait(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = open_turn(world, turn_memory, "Ana", opened_at=time.time() - 3600)
    login(world, "Ana")

    body = client.get(f"{URL}conversations/{ticket.conversation_id}/stream/").get_data(
        as_text=True
    )

    assert NO_WORKER in body
    assert turn_memory.claimed(ticket.turn_id) == ABANDONED


def test_a_turn_still_in_its_wait_is_left_alone(
    world: dict[str, Any],  # noqa: F811
    turn_memory: Any,
) -> None:
    ticket = open_turn(world, turn_memory, "Ana")

    settle_turn(turn_memory, ticket.conversation_id)

    assert turn_memory.holder(ticket.conversation_id) == ticket.turn_id
    assert turn_memory.claimed(ticket.turn_id) is None


def test_a_queue_that_cannot_take_the_turn_says_so_at_once(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    fake = use_model(mocker, reply(text("no")))
    mocker.patch.object(turns_module, "enqueue", side_effect=ConnectionError("down"))

    response = ask(client, world["dashboard"])

    assert fake.requests == []
    assert payloads(response, "error")[0]["code"] == NO_WORKER
    assert turn_memory.holder(conversation_id_of(response)) is None


# One turn at a time


def test_a_second_message_during_a_turn_is_busy(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    ticket = open_turn(world, turn_memory, "Ana")
    turn_memory.beat(ticket.turn_id)
    turn_memory.claim(ticket.turn_id)
    login(world, "Ana")
    fake = use_model(mocker, reply(text("no")))

    response = ask(client, world["dashboard"], conversation_id=ticket.conversation_id)

    assert response.status_code == 409
    assert fake.requests == []


def test_a_message_that_loses_the_race_for_the_turn_stores_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    rows = world["session"].query(AssistantMessage).count()
    mocker.patch.object(turn_memory, "acquire", return_value=False)

    response = ask(client, world["dashboard"], conversation_id=conversation_id)

    assert response.status_code == 409
    assert world["session"].query(AssistantMessage).count() == rows


def test_undo_and_delete_wait_for_the_turn(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    turn_memory: Any,
) -> None:
    ticket = open_turn(world, turn_memory, "Ana", MODE_EDIT)
    turn_memory.beat(ticket.turn_id)
    turn_memory.claim(ticket.turn_id)
    login(world, "Ana")
    url = f"{URL}conversations/{ticket.conversation_id}/"

    assert client.post(f"{url}undo/").status_code == 409
    assert client.delete(url).status_code == 409


def test_deleting_a_conversation_deletes_its_stream(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    assert turn_memory.read(conversation_id, 0, 0)

    assert client.delete(f"{URL}conversations/{conversation_id}/").status_code == 200

    assert turn_memory.read(conversation_id, 0, 0) == []


def test_two_decisions_racing_run_the_calls_once(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world), reply(text("Listo")))
    conversation_id = conversation_id_of(ask_in_editor(client, world))
    mocker.patch.object(turn_memory, "acquire", side_effect=[True, False])
    run = spy_on_tools(mocker)

    assert decide(client, conversation_id).status_code == 200
    assert decide(client, conversation_id).status_code == 409

    assert run.call_count <= 1


# Who reads a stream


def test_only_the_owner_reads_a_stream(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Secreto de Ana")))
    conversation_id = conversation_id_of(ask(client, world["shared_dashboard"]))
    stream = f"{URL}conversations/{conversation_id}/stream/?after=0"
    assert "Secreto de Ana" in client.get(stream).get_data(as_text=True)

    for other in ("Dani", "Root", "Vera"):
        login(world, other)
        response = client.get(stream)
        assert response.status_code == 404
        assert "Secreto" not in response.get_data(as_text=True)


def test_a_guessed_conversation_is_not_found(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ana")

    assert client.get(f"{URL}conversations/{uuid4()}/stream/").status_code == 404


def test_an_api_key_gets_what_the_chat_gives_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    mocker.patch.object(
        security_manager, "extract_api_key_from_request", return_value="sst_x"
    )
    url = f"{URL}conversations/{conversation_id}/"

    assert client.get(f"{url}stream/").status_code == 403
    assert client.post(f"{url}stop/").status_code == 403


def test_a_guest_gets_what_the_chat_gives_them(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    mocker.patch.object(security_manager, "is_guest_user", return_value=True)

    response = client.get(f"{URL}conversations/{conversation_id}/stream/")

    assert response.status_code == 403


def test_an_owner_who_lost_the_report_reads_nothing_on_the_next_connection(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    mocker.patch("superset.auradata.assistant.api.open_dashboard", return_value=None)

    response = client.get(f"{URL}conversations/{conversation_id}/stream/")

    assert response.status_code == 404


# Reading again


def test_a_stream_gives_what_is_missing_after_a_number(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(
        mocker,
        reply(tool_use("list_dashboards", {"request": {}}), stop_reason="tool_use"),
        reply(text("Dos")),
    )
    whole = ask(client, world["dashboard"])
    conversation_id = conversation_id_of(whole)
    url = f"{URL}conversations/{conversation_id}/stream/"

    all_of_it = client.get(f"{url}?after=0").get_data(as_text=True)
    rest = client.get(f"{url}?after=2").get_data(as_text=True)

    assert all_of_it.replace(": connected\n\n", "") == whole.text.replace(
        ": connected\n\n", ""
    )
    assert "id: 1\n" not in rest
    assert "id: 2\n" not in rest
    assert "id: 3\n" in rest
    assert "event: turn_end" in rest


def test_a_redis_failure_does_not_spoil_a_deleted_conversation(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    mocker.patch.object(turn_memory, "forget", side_effect=ConnectionError("down"))

    response = client.delete(f"{URL}conversations/{conversation_id}/")

    assert response.status_code == 200
    assert client.get(f"{URL}conversations/{conversation_id}/").status_code == 404


def test_a_connection_with_nothing_to_read_says_so(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Hola")))
    response = ask(client, world["dashboard"])
    conversation_id = conversation_id_of(response)
    last = response.text.count("id: ")

    body = client.get(
        f"{URL}conversations/{conversation_id}/stream/?after={last}"
    ).get_data(as_text=True)

    assert 'event: turn_end\ndata: {"gone": true}' in body


def test_a_conversation_read_during_a_turn_leaves_that_turn_to_its_stream(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    use_model(mocker, reply(text("Primera")))
    conversation_id = conversation_id_of(ask(client, world["dashboard"]))
    user_id = world["users"]["Ana"].id
    conversation = find_conversation(UUID(conversation_id), user_id)
    log = ConversationLog(conversation, user_id)
    log.add_user_message([text("Segunda")])
    seq = log.next_seq
    ticket = open_turn(
        world,
        turn_memory,
        "Ana",
        conversation=conversation,
        seq=seq,
        after=turn_memory.last_event(conversation_id),
    )
    turn_memory.beat(ticket.turn_id)
    turn_memory.claim(ticket.turn_id)
    log.add_user_message([text("Lo que este turno guardó")])

    stored = client.get(f"{URL}conversations/{conversation_id}/").json["result"]

    assert stored["running"] == {"after": ticket.after}
    assert max(row["seq"] for row in stored["messages"]) == seq - 1
    assert stored["pending"] == []
    assert stored["can_undo"] is False


def test_a_decision_runs_in_the_worker_with_what_was_stored(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world), reply(text("Listo")))
    conversation_id = conversation_id_of(ask_in_editor(client, world))
    run = spy_on_tools(mocker)

    response = decide(client, conversation_id)

    assert run.call_args.args[0] == delete_call(world)["name"]
    assert payloads(response, "done")


def test_the_language_of_the_request_reaches_the_worker(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    fake = use_model(mocker)
    ticket = open_turn(world, turn_memory, "Ana", user_id=999_999, locale="es")
    catalog = mocker.spy(turns_module, "force_locale")

    in_worker(turn_memory, ticket)

    assert fake.requests == []
    catalog.assert_called_once_with("es")
