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
"""Turns run in the request of a test, on a store in memory."""

from __future__ import annotations

from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant import (
    api as api_module,
    retention as retention_module,
    turns as turns_module,
)
from superset.auradata.assistant.turn_store import TurnTicket
from tests.unit_tests.auradata.assistant.memory_store import MemoryTurnStore


@pytest.fixture(autouse=True)
def turn_memory(mocker: MockerFixture) -> MemoryTurnStore:
    """
    The worker of a test: it runs a turn as soon as it is queued, so its stream is
    complete when read. Tests of the worker itself call ``run_turn`` as the task does.
    """
    store = MemoryTurnStore()

    def run_now(ticket: TurnTicket, *_args: Any) -> None:
        turns_module.run_turn(store, ticket.turn_id)

    mocker.patch.object(api_module, "turn_store", return_value=store)
    mocker.patch.object(retention_module, "turn_store", return_value=store)
    mocker.patch.object(turns_module, "enqueue", side_effect=run_now)
    # What a test sets for the request, the worker reads too
    for name in ("get_assistant_settings", "get_catalog", "offered_models"):
        mocker.patch.object(
            turns_module,
            name,
            side_effect=lambda *args, name=name, **kwargs: getattr(api_module, name)(
                *args, **kwargs
            ),
        )
    return store
