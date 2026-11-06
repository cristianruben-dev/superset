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
What people think of the answers of the assistant.

A vote lands on the first row of an answer, which is the id the panel knows it by, and
sits in a table of its own: a conversation only grows, so a vote changes no message and
does not even touch the conversation. Reasons come from a fixed list. Each person reads
only their own votes here, and ``spending.usage_report`` gives admins the totals.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from superset.auradata.models import (
    AssistantConversation,
    AssistantFeedback,
    AssistantMessage,
)
from superset.extensions import db

VOTE_UP = "up"
VOTE_DOWN = "down"
VOTES = (VOTE_UP, VOTE_DOWN)

REASONS = ("wrong_data", "off_topic", "incomplete", "other")


def answer_of(
    conversation: AssistantConversation, message_id: UUID
) -> AssistantMessage | None:
    """An answer of this conversation. Anything else is None, as if it never was."""
    return (
        db.session.query(AssistantMessage)
        .filter(
            AssistantMessage.id == message_id,
            AssistantMessage.conversation_id == conversation.id,
            AssistantMessage.role == "assistant",
        )
        .one_or_none()
    )


def _vote_json(row: AssistantFeedback) -> dict[str, Any]:
    return {"vote": row.vote, "reason": row.reason}


def _find_vote(message_id: UUID, user_id: int) -> AssistantFeedback | None:
    return (
        db.session.query(AssistantFeedback)
        .filter(
            AssistantFeedback.message_id == message_id,
            AssistantFeedback.user_id == user_id,
        )
        .one_or_none()
    )


def feedback_of(
    conversation: AssistantConversation, user_id: int
) -> dict[str, dict[str, Any]]:
    """The votes of a person in a conversation, by message."""
    rows = db.session.query(AssistantFeedback).filter(
        AssistantFeedback.conversation_id == conversation.id,
        AssistantFeedback.user_id == user_id,
    )
    return {str(row.message_id): _vote_json(row) for row in rows}


def save_vote(
    answer: AssistantMessage, user_id: int, vote: str, reason: str | None
) -> dict[str, Any]:
    """
    Store a vote, or change the one this person cast. A reason only explains a vote
    against. Of two clicks that race to create the row, the second one updates it.
    """
    message_id = answer.id
    conversation_id = answer.conversation_id
    kept = reason if vote == VOTE_DOWN else None
    row = _find_vote(message_id, user_id)
    if row is None:
        row = AssistantFeedback(
            message_id=message_id,
            conversation_id=conversation_id,
            user_id=user_id,
        )
        db.session.add(row)
    row.vote = vote
    row.reason = kept
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        row = _find_vote(message_id, user_id)
        if row is None:
            raise
        row.vote = vote
        row.reason = kept
        db.session.commit()
    return _vote_json(row)


def clear_vote(answer: AssistantMessage, user_id: int) -> None:
    """Take back the vote of this person, if there is one."""
    if (row := _find_vote(answer.id, user_id)) is not None:
        db.session.delete(row)
        db.session.commit()
