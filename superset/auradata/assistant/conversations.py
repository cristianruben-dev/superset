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
Conversations of the assistant in the metadata database.

They are append-only and private: every read goes through ``find_conversation``, which
answers None for a conversation of someone else, so it looks like one that does not
exist. A turn of the assistant and the results of its tools are written in one
transaction, because the API refuses a history with a tool call and no result.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from superset.auradata.assistant.models import TokenUsage
from superset.auradata.models import (
    AssistantConversation,
    AssistantMessage,
    WorkspaceDashboard,
)
from superset.extensions import db
from superset.utils import json

TITLE_LENGTH = 80
STOP_REFUSAL = "refusal"

# What stays of a declined model's output, along with its finished server tool calls
_KEPT_BEFORE_FALLBACK = {"text", "fallback"}


class ConversationBusyError(Exception):
    """Another request wrote to this conversation first."""


@dataclass(frozen=True)
class AssistantTurn:
    """A response of the API, to be stored as it came."""

    content: list[dict[str, Any]]
    model: str
    stop_reason: str | None
    usage: TokenUsage
    cost_usd: Decimal


def workspace_id_of(dashboard_id: int) -> int | None:
    """The workspace a dashboard is in at this moment."""
    return (
        db.session.query(WorkspaceDashboard.workspace_id)
        .filter(WorkspaceDashboard.dashboard_id == dashboard_id)
        .scalar()
    )


def create_conversation(
    user_id: int, dashboard_id: int, mode: str, model: str, title: str
) -> AssistantConversation:
    conversation = AssistantConversation(
        user_id=user_id,
        dashboard_id=dashboard_id,
        mode=mode,
        model=model,
        title=title[:TITLE_LENGTH],
    )
    db.session.add(conversation)
    db.session.commit()
    return conversation


def find_conversation(
    conversation_id: UUID, user_id: int
) -> AssistantConversation | None:
    """A conversation of this user. Anyone else's is None, like one that never was."""
    return (
        db.session.query(AssistantConversation)
        .filter(
            AssistantConversation.id == conversation_id,
            AssistantConversation.user_id == user_id,
        )
        .one_or_none()
    )


def list_conversations(user_id: int, dashboard_id: int) -> list[AssistantConversation]:
    """The conversations of a user over a dashboard, the latest first."""
    return (
        db.session.query(AssistantConversation)
        .filter(
            AssistantConversation.user_id == user_id,
            AssistantConversation.dashboard_id == dashboard_id,
        )
        .order_by(AssistantConversation.changed_on.desc())
        .all()
    )


def _messages_of(conversation: AssistantConversation) -> list[AssistantMessage]:
    return (
        db.session.query(AssistantMessage)
        .filter(AssistantMessage.conversation_id == conversation.id)
        .order_by(AssistantMessage.seq)
        .all()
    )


def message_json(message: AssistantMessage) -> dict[str, Any]:
    return {
        "id": str(message.id),
        "seq": message.seq,
        "role": message.role,
        "content": json.loads(message.content),
        "model": message.model,
        "stop_reason": message.stop_reason,
        "cost_usd": float(message.cost_usd),
        "created_on": message.created_on.isoformat(),
    }


def conversation_json(conversation: AssistantConversation) -> dict[str, Any]:
    return {
        "id": str(conversation.id),
        "dashboard_id": conversation.dashboard_id,
        "mode": conversation.mode,
        "model": conversation.model,
        "title": conversation.title,
        "created_on": conversation.created_on.isoformat(),
        "changed_on": conversation.changed_on.isoformat(),
    }


def conversation_messages(conversation: AssistantConversation) -> list[dict[str, Any]]:
    return [message_json(message) for message in _messages_of(conversation)]


def content_to_send(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    A stored turn as the API takes it back: unchanged, except after a model handed
    over mid output. Then what the declined model wrote before the last ``fallback``
    block must be left out, save its text and its finished server tool calls. The
    stored row keeps everything.
    """
    boundary = max(
        (index for index, block in enumerate(blocks) if block["type"] == "fallback"),
        default=-1,
    )
    if boundary < 0:
        return blocks
    finished = {block.get("tool_use_id") for block in blocks if "tool_use_id" in block}

    def kept(block: dict[str, Any]) -> bool:
        if block["type"] in _KEPT_BEFORE_FALLBACK:
            return True
        if block["type"] == "server_tool_use":
            return block["id"] in finished
        return "tool_use_id" in block

    return [block for block in blocks[:boundary] if kept(block)] + blocks[boundary:]


def history_of(conversation: AssistantConversation) -> list[dict[str, Any]]:
    """
    The ``messages`` of the next request. A refused turn is kept for its cost but not
    sent: the API says to discard refused output, and consecutive user turns are valid.
    """
    return [
        {
            "role": message.role,
            "content": content_to_send(json.loads(message.content)),
        }
        for message in _messages_of(conversation)
        if message.stop_reason != STOP_REFUSAL
    ]


class ConversationLog:
    """Writes one request's messages at the end of a conversation."""

    def __init__(self, conversation: AssistantConversation, user_id: int) -> None:
        self._conversation = conversation
        self._user_id = user_id
        last = (
            db.session.query(db.func.max(AssistantMessage.seq))
            .filter(AssistantMessage.conversation_id == conversation.id)
            .scalar()
        )
        self._next_seq = 0 if last is None else last + 1

    def _row(self, role: str, content: list[dict[str, Any]]) -> AssistantMessage:
        row = AssistantMessage(
            conversation_id=self._conversation.id,
            seq=self._next_seq,
            role=role,
            content=json.dumps(content),
            input_tokens=0,
            output_tokens=0,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=0,
            cost_usd=0,
        )
        self._next_seq += 1
        db.session.add(row)
        return row

    def _commit(self) -> None:
        try:
            db.session.commit()
        except IntegrityError as ex:
            db.session.rollback()
            raise ConversationBusyError from ex

    def add_user_message(self, content: list[dict[str, Any]]) -> None:
        self._row("user", content)
        self._commit()

    def add_turn(
        self,
        turn: AssistantTurn,
        tool_results: list[dict[str, Any]] | None = None,
    ) -> None:
        """Store a response of the API and, in the same commit, its tool results."""
        row = self._row("assistant", turn.content)
        row.model = turn.model
        row.stop_reason = turn.stop_reason
        row.user_id = self._user_id
        row.workspace_id = (
            workspace_id_of(self._conversation.dashboard_id)
            if self._conversation.dashboard_id is not None
            else None
        )
        row.input_tokens = turn.usage.input_tokens
        row.output_tokens = turn.usage.output_tokens
        row.cache_read_input_tokens = turn.usage.cache_read_input_tokens
        row.cache_creation_input_tokens = turn.usage.cache_creation_input_tokens
        row.cost_usd = turn.cost_usd
        if tool_results:
            self._row("user", tool_results)
        self._commit()
