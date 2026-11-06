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
"""``TurnStore`` in memory: the same rules, for tests that do not reach Redis."""

from __future__ import annotations

import time
from typing import Any
from uuid import UUID

from superset.auradata.assistant.turn_store import TAKEN, TurnTicket
from superset.utils import json


class MemoryTurnStore:
    """Holds what ``RedisTurnStore`` holds. ``stream_test`` runs both over one suite."""

    def __init__(self) -> None:
        self.locks: dict[str, str] = {}
        self.locked_at: dict[str, float] = {}
        self.counts: dict[str, int] = {}
        self.events: dict[str, list[tuple[int, str, str]]] = {}
        self.tickets: dict[str, TurnTicket] = {}
        self.claims: dict[str, str] = {}
        self.beats: set[str] = set()
        self.stops: set[str] = set()
        self.settling: set[str] = set()

    def acquire(self, conversation_id: UUID | str, turn_id: str) -> bool:
        key = str(conversation_id)
        if key in self.locks:
            return False
        self.locks[key] = turn_id
        self.locked_at[key] = time.time()
        return True

    def release(self, conversation_id: UUID | str, turn_id: str) -> None:
        if self.locks.get(str(conversation_id)) == turn_id:
            del self.locks[str(conversation_id)]

    def holder(self, conversation_id: UUID | str) -> str | None:
        return self.locks.get(str(conversation_id))

    def lock_age(self, conversation_id: UUID | str) -> float:
        return time.time() - self.locked_at[str(conversation_id)]

    def last_event(self, conversation_id: UUID | str) -> int:
        return self.counts.get(str(conversation_id), 0)

    def save_ticket(self, ticket: TurnTicket) -> None:
        self.tickets[ticket.turn_id] = ticket

    def ticket(self, turn_id: str) -> TurnTicket | None:
        return self.tickets.get(turn_id)

    def publish(
        self,
        conversation_id: UUID | str,
        turn_id: str,
        event: str,
        data: dict[str, Any],
        last: bool = False,
    ) -> int:
        key = str(conversation_id)
        if self.locks.get(key) != turn_id:
            return 0
        number = self.counts.get(key, 0) + 1
        self.counts[key] = number
        self.events.setdefault(key, []).append((number, event, json.dumps(data)))
        if last:
            del self.locks[key]
        return number

    def read(
        self, conversation_id: UUID | str, after: int, block_ms: int
    ) -> list[tuple[int, str, str]]:
        found = [
            entry
            for entry in self.events.get(str(conversation_id), [])
            if entry[0] > after
        ]
        if not found and block_ms:
            time.sleep(0.001)
        return found

    def claim(self, turn_id: str, value: str = TAKEN) -> bool:
        if turn_id in self.claims:
            return False
        self.claims[turn_id] = value
        return True

    def claimed(self, turn_id: str) -> str | None:
        return self.claims.get(turn_id)

    def beat(self, turn_id: str) -> None:
        self.beats.add(turn_id)

    def alive(self, turn_id: str) -> bool:
        return turn_id in self.beats

    def ask_to_stop(self, turn_id: str) -> None:
        self.stops.add(turn_id)

    def stop_asked(self, turn_id: str) -> bool:
        return turn_id in self.stops

    def take_settling(self, turn_id: str) -> bool:
        if turn_id in self.settling:
            return False
        self.settling.add(turn_id)
        return True

    def forget(self, conversation_id: UUID | str) -> None:
        key = str(conversation_id)
        self.locks.pop(key, None)
        self.counts.pop(key, None)
        self.events.pop(key, None)
