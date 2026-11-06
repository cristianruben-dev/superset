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
How long the conversations of the assistant are kept.

A conversation is due when its last message is older than
``AURADATA_ASSISTANT_RETENTION_DAYS``, or when it lost its report or its person, because
then nobody can open it. A report in the trash keeps its id, and can come back, so it
does not count as lost. With no retention set everything stays, those included.

This cannot be undone, so a pass counts and logs before it deletes, and it goes through
``conversations.erase_conversations``, which keeps what the answers cost. A conversation
with a card waiting or a turn under way is never deleted, and each batch is judged again
with its rows locked: whoever writes in the meantime wins. A due conversation that holds
a card comes up again on every pass, and stays until its owner decides or deletes it.

Only counts reach the logs: no titles, and nothing anyone wrote.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator, Sequence
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from flask import current_app

from superset.auradata.assistant.conversations import (
    erase_conversations,
    last_activity,
    lock_conversations,
    pending_turn,
    turn_is_running,
)
from superset.auradata.assistant.sharing import end_shares_of_conversations
from superset.auradata.assistant.turn_store import forget_streams, turn_store
from superset.auradata.models import AssistantConversation
from superset.extensions import db

logger = logging.getLogger(__name__)

BATCH_SIZE = 50


@dataclass
class PurgeReport:
    """What one pass found and did, in conversations."""

    retention_days: int
    dry_run: bool
    expired: int = 0
    orphaned: int = 0
    deleted: int = 0
    would_delete: int = 0
    kept_pending: int = 0
    kept_under_way: int = 0
    failed: int = 0


def retention_days() -> int | None:
    """
    The days to keep a conversation, None to keep them forever. A value that makes no
    sense keeps them too: a typo must not delete anything.
    """
    days = current_app.config.get("AURADATA_ASSISTANT_RETENTION_DAYS")
    if days is None:
        return None
    if isinstance(days, bool) or not isinstance(days, int) or days <= 0:
        logger.warning(
            "AURADATA_ASSISTANT_RETENTION_DAYS must be a positive number of days or "
            "None; nothing is deleted"
        )
        return None
    return days


def _orphaned() -> Any:
    return sa.or_(
        AssistantConversation.dashboard_id.is_(None),
        AssistantConversation.user_id.is_(None),
    )


def _due(cutoff: datetime) -> Any:
    return sa.or_(_orphaned(), last_activity() < cutoff)


def _batches(ids: list[UUID]) -> Iterator[list[UUID]]:
    for start in range(0, len(ids), BATCH_SIZE):
        yield ids[start : start + BATCH_SIZE]


def _purge_batch(
    ids: Sequence[UUID], cutoff: datetime, now: datetime, report: PurgeReport
) -> None:
    """Delete what is still due of a batch, in one transaction."""
    rows = (
        db.session.query(AssistantConversation)
        .filter(AssistantConversation.id.in_(ids))
        .all()
        if report.dry_run
        else lock_conversations(ids, wait=False)
    )
    # A row missing here is being written to, or someone deleted it first
    report.kept_under_way += len(ids) - len(rows)
    due = {
        row.id
        for row in db.session.query(AssistantConversation.id).filter(
            AssistantConversation.id.in_([row.id for row in rows]), _due(cutoff)
        )
    }
    doomed = []
    held = []
    for row in rows:
        if row.id not in due:
            report.kept_under_way += 1
        elif pending_turn(row) is not None:
            report.kept_pending += 1
            held.append(row.id)
        elif turn_is_running(row, now):
            report.kept_under_way += 1
        else:
            doomed.append(row.id)
    if report.dry_run:
        report.would_delete += len(doomed)
        db.session.rollback()  # pylint: disable=consider-using-transaction
        return
    if doomed:
        erase_conversations(doomed)
    if held:
        # It stays for its card, not for anyone else to go on reading it
        end_shares_of_conversations(held)
    db.session.commit()  # pylint: disable=consider-using-transaction
    report.deleted += len(doomed)
    forget_streams(turn_store(), doomed)


def purge_conversations(
    days: int, dry_run: bool = False, now: datetime | None = None
) -> dict[str, Any]:
    """
    Delete the conversations that are due, in small batches, or only say which with
    ``dry_run``. A batch that fails is rolled back alone, and the next pass tries again.
    """
    # The clock of ``created_on``: the naive local time of the server
    moment = now or datetime.now()
    cutoff = moment - timedelta(days=days)
    found = (
        db.session.query(AssistantConversation.id, _orphaned())
        .filter(_due(cutoff))
        .order_by(AssistantConversation.id)
        .all()
    )
    report = PurgeReport(
        retention_days=days,
        dry_run=dry_run,
        expired=sum(1 for _, orphaned in found if not orphaned),
        orphaned=sum(1 for _, orphaned in found if orphaned),
    )
    db.session.rollback()  # pylint: disable=consider-using-transaction
    logger.info(
        "assistant retention: found %s expired and %s orphaned conversations "
        "(retention %s days, dry run %s)",
        report.expired,
        report.orphaned,
        days,
        dry_run,
    )
    for batch in _batches([conversation_id for conversation_id, _ in found]):
        try:
            _purge_batch(batch, cutoff, moment, report)
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()  # pylint: disable=consider-using-transaction
            report.failed += len(batch)
            logger.exception("assistant retention: a batch failed and stayed as it was")
    logger.info("assistant retention: %s", report)
    return asdict(report)
