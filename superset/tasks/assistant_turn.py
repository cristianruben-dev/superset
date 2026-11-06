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
"""Celery task: one turn of the AI assistant."""

from __future__ import annotations

import logging

from superset.auradata.assistant.turn_store import turn_store
from superset.auradata.assistant.turns import run_turn
from superset.extensions import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="auradata_assistant.run_turn",
    ignore_result=True,
    acks_late=False,
    reject_on_worker_lost=False,
    max_retries=0,
)
def run_assistant_turn(turn_id: str) -> None:
    """
    Run a turn the web request opened. It runs once or never, because a repeated turn
    repeats writes and spending: it is acknowledged as it starts, never retries, and
    ``run_turn`` takes the claim of the turn first. A worker that dies mid turn loses
    it, and whoever comes back reads why. The only argument is the id of a ticket the
    server wrote, which says who asked.
    """
    store = turn_store()
    if store is None:
        logger.error("The assistant has no store: a turn cannot run")
        return
    run_turn(store, turn_id)
