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
The part of a turn that lives in Redis, between the worker and whoever reads it.

Each conversation has one stream of numbered events, and at most one turn holds it: the
``lock`` is what makes it one turn per conversation, and an event is only written by the
turn that holds the lock, in one atomic step. A worker that was given up for dead cannot
write any more, so a person never sees two endings.

The rest belongs to one turn: its ticket, written by the web request and read by the
worker; the claim, which only one delivery of a task or one reader giving up can take;
the heartbeat, refreshed from a thread of the worker; the mark that a person asked to
stop, and the mark that someone is repairing a dead turn.

Every key expires. The lock lasts long enough for the next visit to find out what became
of a turn. What a turn said stays for ``EVENTS_TTL`` after its last event, so a person
who reconnects late still reads it; it holds what the conversation holds, and deleting a
conversation deletes it too (``forget``).

Nothing here decides who may read what: that is ``api.py``, on each connection.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import Any, Protocol
from uuid import UUID

from flask import current_app

from superset.utils import json

logger = logging.getLogger(__name__)

# A turn nobody heard from for this long is dead
HEARTBEAT_TTL = 30
LOCK_TTL = 24 * 3600
TICKET_TTL = 24 * 3600
EVENTS_TTL = 3600
# An exported document waits this long for whoever asked for it
EXPORT_TTL = 15 * 60
# Longer than a stream, so numbers never start over under a reader that came back
COUNT_TTL = 7 * 24 * 3600

# Events a conversation keeps at least. A stream only grows while a turn writes it, and
# the longest turn fits in this unless the model outruns about 40 events per second. If
# it does, a reader behind the start is told so with ``TRIMMED``, and the rows have it
MAX_EVENTS = 50_000

# The value of the claim of a turn no worker took
ABANDONED = "abandoned"
TAKEN = "taken"

# The last event of every turn, written with the release of the lock
TURN_END = "turn_end"
# For a reader who asked for events no longer kept
TRIMMED = "trimmed"

_PREFIX = "auradata:assistant"

# Only the holder of the lock writes: the number, the event and the expiry go together
_PUBLISH = """
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local number = redis.call('INCR', KEYS[2])
redis.call(
  'XADD', KEYS[3], 'MAXLEN', '~', ARGV[7], number .. '-0',
  'event', ARGV[2], 'data', ARGV[3]
)
redis.call('EXPIRE', KEYS[3], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[5])
if ARGV[6] == '1' then redis.call('DEL', KEYS[1]) end
return number
"""

_RELEASE = """
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
"""


@dataclass(frozen=True)
class TurnTicket:
    """
    What the web request says about a turn, once it has checked everything. The user
    comes from the session of that request, and the worker holds it against the owner
    of the conversation. The task of Celery only carries ``turn_id``.
    """

    turn_id: str
    conversation_id: str
    user_id: int
    # ``chat`` answers the last message; ``decide`` runs the calls a person decided on
    kind: str
    mode: str
    model: str
    dashboard_id: int
    locale: str | None
    # The event before this turn's first, and the first row it will store
    after: int
    seq: int
    opened_at: float


class TurnStore(Protocol):
    """What a turn needs of Redis. Tests run the same rules over a double."""

    def acquire(self, conversation_id: UUID | str, turn_id: str) -> bool: ...

    def release(self, conversation_id: UUID | str, turn_id: str) -> None: ...

    def holder(self, conversation_id: UUID | str) -> str | None: ...

    def lock_age(self, conversation_id: UUID | str) -> float: ...

    def last_event(self, conversation_id: UUID | str) -> int: ...

    def first_event(self, conversation_id: UUID | str) -> int | None: ...

    def save_ticket(self, ticket: TurnTicket) -> None: ...

    def ticket(self, turn_id: str) -> TurnTicket | None: ...

    def publish(
        self,
        conversation_id: UUID | str,
        turn_id: str,
        event: str,
        data: dict[str, Any],
        last: bool = False,
    ) -> int: ...

    def read(
        self, conversation_id: UUID | str, after: int, block_ms: int
    ) -> list[tuple[int, str, str]]: ...

    def claim(self, turn_id: str, value: str = TAKEN) -> bool: ...

    def claimed(self, turn_id: str) -> str | None: ...

    def beat(self, turn_id: str) -> None: ...

    def alive(self, turn_id: str) -> bool: ...

    def ask_to_stop(self, turn_id: str) -> None: ...

    def stop_asked(self, turn_id: str) -> bool: ...

    def take_settling(self, turn_id: str) -> bool: ...

    def forget(self, conversation_id: UUID | str) -> None: ...

    def save_export(self, job_id: str, job: dict[str, Any]) -> None: ...

    def export(self, job_id: str) -> dict[str, Any] | None: ...


class RedisTurnStore:
    """``TurnStore`` on Redis. Keys of a conversation share a hash tag for a cluster."""

    def __init__(self, client: Any) -> None:
        self._redis = client
        self._publish = client.register_script(_PUBLISH)
        self._release = client.register_script(_RELEASE)

    @staticmethod
    def _keys(conversation_id: UUID | str) -> tuple[str, str, str]:
        base = f"{_PREFIX}:{{{conversation_id}}}"
        return f"{base}:lock", f"{base}:count", f"{base}:events"

    @staticmethod
    def _key(turn_id: str, name: str) -> str:
        return f"{_PREFIX}:turn:{turn_id}:{name}"

    def acquire(self, conversation_id: UUID | str, turn_id: str) -> bool:
        lock, _count, _events = self._keys(conversation_id)
        return bool(self._redis.set(lock, turn_id, nx=True, ex=LOCK_TTL))

    def release(self, conversation_id: UUID | str, turn_id: str) -> None:
        lock, _count, _events = self._keys(conversation_id)
        self._release(keys=[lock], args=[turn_id])

    def holder(self, conversation_id: UUID | str) -> str | None:
        return self._redis.get(self._keys(conversation_id)[0])

    def lock_age(self, conversation_id: UUID | str) -> float:
        """How long ago the lock was taken: its time to live says, as it never moves."""
        return LOCK_TTL - self._redis.ttl(self._keys(conversation_id)[0])

    def last_event(self, conversation_id: UUID | str) -> int:
        return int(self._redis.get(self._keys(conversation_id)[1]) or 0)

    def first_event(self, conversation_id: UUID | str) -> int | None:
        """The number of the oldest event kept, if any."""
        found = self._redis.xrange(self._keys(conversation_id)[2], count=1)
        return int(found[0][0].split("-")[0]) if found else None

    def save_ticket(self, ticket: TurnTicket) -> None:
        self._redis.set(
            self._key(ticket.turn_id, "ticket"),
            json.dumps(asdict(ticket)),
            ex=TICKET_TTL,
        )

    def ticket(self, turn_id: str) -> TurnTicket | None:
        stored = self._redis.get(self._key(turn_id, "ticket"))
        return TurnTicket(**json.loads(stored)) if stored else None

    def publish(
        self,
        conversation_id: UUID | str,
        turn_id: str,
        event: str,
        data: dict[str, Any],
        last: bool = False,
    ) -> int:
        """The number of the event. 0 says this turn no longer holds the stream."""
        return int(
            self._publish(
                keys=list(self._keys(conversation_id)),
                args=[
                    turn_id,
                    event,
                    json.dumps(data),
                    EVENTS_TTL,
                    COUNT_TTL,
                    "1" if last else "0",
                    MAX_EVENTS,
                ],
            )
        )

    def read(
        self, conversation_id: UUID | str, after: int, block_ms: int
    ) -> list[tuple[int, str, str]]:
        """The events past ``after``, waiting up to ``block_ms`` when there are none."""
        events = self._keys(conversation_id)[2]
        found = self._redis.xread({events: f"{after}-0"}, block=block_ms or None)
        return [
            (int(entry.split("-")[0]), fields["event"], fields["data"])
            for _stream, entries in found or []
            for entry, fields in entries
        ]

    def claim(self, turn_id: str, value: str = TAKEN) -> bool:
        """Of a worker and a reader giving up, or of two deliveries, one gets this."""
        return bool(
            self._redis.set(self._key(turn_id, "claim"), value, nx=True, ex=TICKET_TTL)
        )

    def claimed(self, turn_id: str) -> str | None:
        return self._redis.get(self._key(turn_id, "claim"))

    def beat(self, turn_id: str) -> None:
        self._redis.set(self._key(turn_id, "beat"), "1", ex=HEARTBEAT_TTL)

    def alive(self, turn_id: str) -> bool:
        return bool(self._redis.exists(self._key(turn_id, "beat")))

    def ask_to_stop(self, turn_id: str) -> None:
        self._redis.set(self._key(turn_id, "stop"), "1", ex=TICKET_TTL)

    def stop_asked(self, turn_id: str) -> bool:
        return bool(self._redis.exists(self._key(turn_id, "stop")))

    def take_settling(self, turn_id: str) -> bool:
        """Of everyone who finds a dead turn, one repairs it."""
        return bool(
            self._redis.set(self._key(turn_id, "settling"), "1", nx=True, ex=60)
        )

    def forget(self, conversation_id: UUID | str) -> None:
        self._redis.delete(*self._keys(conversation_id))

    def save_export(self, job_id: str, job: dict[str, Any]) -> None:
        self._redis.set(f"{_PREFIX}:export:{job_id}", json.dumps(job), ex=EXPORT_TTL)

    def export(self, job_id: str) -> dict[str, Any] | None:
        job = self._redis.get(f"{_PREFIX}:export:{job_id}")
        return json.loads(job) if job else None


def forget_streams(store: TurnStore | None, ids: Iterable[UUID | str]) -> None:
    """
    Remove what Redis holds of deleted conversations. It expires by itself anyway, so a
    failure here never undoes or spoils a deletion that was already committed.
    """
    if store is None:
        return
    try:
        for conversation_id in ids:
            store.forget(conversation_id)
    except Exception:  # pylint: disable=broad-except
        logger.warning("Redis still holds the stream of a deleted conversation")


_stores: dict[str, RedisTurnStore] = {}


def _connect(url: str) -> Any:
    import redis  # pylint: disable=import-outside-toplevel

    return redis.Redis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=3,
        socket_timeout=15,
        health_check_interval=30,
    )


def turn_store() -> TurnStore | None:
    """
    The store of this server, or None when it has no Redis for the assistant. A client
    connects on first use, so a forked worker never shares one with its parent.
    """
    url = current_app.config.get("AURADATA_ASSISTANT_REDIS_URL")
    if not url:
        return None
    if url not in _stores:
        _stores[url] = RedisTurnStore(_connect(url))
    return _stores[url]
