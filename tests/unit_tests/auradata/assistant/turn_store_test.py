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
The rules of the store of a turn, over Redis and over the double the other tests use.

The Redis half needs a server with the scripts of the store: it runs where the stack
is, on a database of its own and random ids, and is skipped elsewhere.
"""

import os
import threading
import time
from typing import Any
from uuid import uuid4

import pytest

from superset.auradata.assistant.turn_store import (
    ABANDONED,
    RedisTurnStore,
    TAKEN,
    TURN_END,
    TurnTicket,
)
from superset.utils import json
from tests.unit_tests.auradata.assistant.memory_store import MemoryTurnStore

REDIS_TEST_DB = 15


def _redis_store() -> RedisTurnStore:
    redis = pytest.importorskip("redis")
    client = redis.Redis(
        host=os.environ.get("REDIS_HOST", "redis"),
        port=int(os.environ.get("REDIS_PORT", "6379")),
        db=REDIS_TEST_DB,
        decode_responses=True,
        socket_connect_timeout=1,
    )
    try:
        client.ping()
    except redis.RedisError:
        pytest.skip("No Redis here")
    return RedisTurnStore(client)


@pytest.fixture(params=("memory", "redis"))
def store(request: pytest.FixtureRequest) -> Any:
    return MemoryTurnStore() if request.param == "memory" else _redis_store()


@pytest.fixture
def ids() -> tuple[str, str]:
    return str(uuid4()), str(uuid4())


def ticket_of(conversation: str, turn: str) -> TurnTicket:
    return TurnTicket(
        turn,
        conversation,
        7,
        "chat",
        "read",
        "model",
        1,
        "es",
        0,
        3,
        time.time(),
    )


def test_a_conversation_has_one_turn_at_a_time(
    store: Any, ids: tuple[str, str]
) -> None:
    conversation, turn = ids

    assert store.acquire(conversation, turn)
    assert not store.acquire(conversation, "another")
    assert store.holder(conversation) == turn

    store.release(conversation, "another")
    assert store.holder(conversation) == turn

    store.release(conversation, turn)
    assert store.holder(conversation) is None


def test_events_are_numbered_and_read_after_a_number(
    store: Any, ids: tuple[str, str]
) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)

    numbers = [
        store.publish(conversation, turn, "text", {"text": letter}) for letter in "abc"
    ]

    assert numbers == [1, 2, 3]
    assert store.last_event(conversation) == 3
    assert [number for number, _event, _data in store.read(conversation, 0, 0)] == [
        1,
        2,
        3,
    ]
    number, event, data = store.read(conversation, 2, 0)[0]
    assert (number, event, json.loads(data)) == (3, "text", {"text": "c"})
    assert store.read(conversation, 3, 0) == []


def test_only_the_holder_of_a_stream_writes_to_it(
    store: Any, ids: tuple[str, str]
) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)

    assert store.publish(conversation, "another", "text", {}) == 0
    assert store.read(conversation, 0, 0) == []


def test_the_last_event_lets_go_of_the_stream_in_the_same_step(
    store: Any, ids: tuple[str, str]
) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)

    assert store.publish(conversation, turn, TURN_END, {}, last=True) == 1

    assert store.holder(conversation) is None
    assert store.publish(conversation, turn, "text", {}) == 0


def test_numbers_go_on_across_turns(store: Any, ids: tuple[str, str]) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)
    store.publish(conversation, turn, TURN_END, {}, last=True)
    store.acquire(conversation, "next")

    assert store.publish(conversation, "next", "text", {}) == 2


def test_one_claim_for_a_turn(store: Any, ids: tuple[str, str]) -> None:
    _conversation, turn = ids

    assert store.claimed(turn) is None
    assert store.claim(turn, ABANDONED)
    assert not store.claim(turn)
    assert store.claimed(turn) == ABANDONED


def test_two_deliveries_at_once_get_one_claim(store: Any, ids: tuple[str, str]) -> None:
    _conversation, turn = ids
    won: list[bool] = []
    threads = [
        threading.Thread(target=lambda: won.append(store.claim(turn, TAKEN)))
        for _ in range(8)
    ]

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert won.count(True) == 1


def test_a_ticket_comes_back_as_it_went(store: Any, ids: tuple[str, str]) -> None:
    conversation, turn = ids
    ticket = ticket_of(conversation, turn)

    store.save_ticket(ticket)

    assert store.ticket(turn) == ticket
    assert store.ticket("nobody") is None


def test_marks_of_a_turn(store: Any, ids: tuple[str, str]) -> None:
    _conversation, turn = ids

    assert not store.alive(turn)
    assert not store.stop_asked(turn)
    store.beat(turn)
    store.ask_to_stop(turn)

    assert store.alive(turn)
    assert store.stop_asked(turn)
    assert store.take_settling(turn)
    assert not store.take_settling(turn)


def test_forget_leaves_nothing_of_a_conversation(
    store: Any, ids: tuple[str, str]
) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)
    store.publish(conversation, turn, "text", {"text": "secreto"})

    store.forget(conversation)

    assert store.read(conversation, 0, 0) == []
    assert store.holder(conversation) is None


def test_a_long_stream_keeps_its_last_events_and_says_where_it_starts(
    store: Any, ids: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    conversation, turn = ids
    monkeypatch.setattr(turn_store_module, "MAX_EVENTS", 10)
    store.acquire(conversation, turn)

    for _ in range(500):
        store.publish(conversation, turn, "text", {})

    first = store.first_event(conversation)
    assert first > 1
    kept = [number for number, _event, _data in store.read(conversation, 0, 0)]
    assert kept == list(range(first, 501))
    assert len(kept) >= 10


def test_a_conversation_without_events_has_no_first(
    store: Any, ids: tuple[str, str]
) -> None:
    assert store.first_event(ids[0]) is None


def test_the_age_of_a_lock(store: Any, ids: tuple[str, str]) -> None:
    conversation, turn = ids
    store.acquire(conversation, turn)

    assert 0 <= store.lock_age(conversation) < 5


def test_every_key_of_a_turn_expires() -> None:
    store = _redis_store()
    conversation, turn = str(uuid4()), str(uuid4())
    store.acquire(conversation, turn)
    store.save_ticket(ticket_of(conversation, turn))
    store.publish(conversation, turn, "text", {})
    store.claim(turn)
    store.beat(turn)
    store.ask_to_stop(turn)
    store.take_settling(turn)
    client = store._redis

    keys = [*store._keys(conversation)]
    keys += [
        store._key(turn, name)
        for name in ("ticket", "claim", "beat", "stop", "settling")
    ]

    assert all(client.ttl(key) > 0 for key in keys)
