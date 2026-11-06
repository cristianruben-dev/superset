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

A call that needs the approval of the person is the one exception, on purpose: its turn
is stored without results and with an ``awaiting`` record, and that is the whole pending
state. The arguments that run later are the stored ones, so nothing a request says can
change them. Rows of the role ``record`` hold what the app itself must remember
(decisions and the versions around a turn). They are never sent to the model.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

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
# A response the person left in the middle: kept for what it cost, and never sent
STOP_INTERRUPTED = "interrupted"
_NOT_SENT = {STOP_REFUSAL, STOP_INTERRUPTED}

ROLE_RECORD = "record"
RECORD_AWAITING = "awaiting"
RECORD_DECISION = "decision"
RECORD_TURN_START = "turn_start"
RECORD_TURN_END = "turn_end"
RECORD_UNDONE = "undone"

# Why a call did not run, for the model. Each one answers its tool_use
REJECTED = "The user rejected this action. It did not run. Do not retry it."
HELD_BACK = "Not run: the user rejected another action of this same step."
MOVED_ON = "Not run: the user wrote a new message instead of deciding on it."

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


@dataclass(frozen=True)
class PendingTurn:
    """
    A stored turn whose tools wait for decisions of the person. Nothing of it has
    run: ``calls`` holds every tool call of the turn, as the model made them.
    """

    calls: list[dict[str, Any]]
    # The calls a person must decide on, by id, with the title of their tool
    titles: dict[str, str]
    decisions: dict[str, bool]

    @property
    def undecided(self) -> list[str]:
        return [call for call in self.titles if call not in self.decisions]


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


def _blocks(message: AssistantMessage) -> list[dict[str, Any]]:
    return json.loads(message.content)


def _holds_results(message: AssistantMessage) -> bool:
    return message.role == "user" and any(
        block["type"] == "tool_result" for block in _blocks(message)
    )


def _is_awaiting(message: AssistantMessage) -> bool:
    return message.role == ROLE_RECORD and any(
        block["type"] == RECORD_AWAITING for block in _blocks(message)
    )


def tool_uses_of(blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The tool calls of a stored turn that count, in order."""
    return [block for block in content_to_send(blocks) if block["type"] == "tool_use"]


def pending_turn(conversation: AssistantConversation) -> PendingTurn | None:
    """
    The turn waiting for decisions, read from what is stored. A turn stops waiting
    when a row holds its results, so a decision can only ever apply once.
    """
    rows = _messages_of(conversation)
    awaiting = next(
        (index for index in reversed(range(len(rows))) if _is_awaiting(rows[index])),
        None,
    )
    if awaiting is None:
        return None
    later = rows[awaiting + 1 :]
    if any(_holds_results(row) for row in later):
        return None
    decisions = {
        block["tool_use_id"]: block["approved"]
        for row in later
        if row.role == ROLE_RECORD
        for block in _blocks(row)
        if block["type"] == RECORD_DECISION
    }
    return PendingTurn(
        calls=tool_uses_of(_blocks(rows[awaiting - 1])),
        titles={
            call["id"]: call["title"]
            for block in _blocks(rows[awaiting])
            for call in block["calls"]
        },
        decisions=decisions,
    )


def pending_json(pending: PendingTurn | None) -> list[dict[str, Any]]:
    """The cards the person still has to answer."""
    if pending is None:
        return []
    return [
        confirmation_json(call, pending.titles[call["id"]])
        for call in pending.calls
        if call["id"] in pending.undecided
    ]


def confirmation_json(call: dict[str, Any], title: str) -> dict[str, Any]:
    return {
        "id": call["id"],
        "name": call["name"],
        "title": title,
        "input": call.get("input") or {},
    }


def records_of(conversation: AssistantConversation) -> list[dict[str, Any]]:
    """What the app recorded in a conversation, oldest first."""
    return [
        block
        for row in _messages_of(conversation)
        if row.role == ROLE_RECORD
        for block in _blocks(row)
    ]


def rejected_calls(conversation: AssistantConversation) -> list[str]:
    """The calls the person rejected, by id."""
    return [
        block["tool_use_id"]
        for block in records_of(conversation)
        if block["type"] == RECORD_DECISION and not block["approved"]
    ]


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
    return [
        message_json(message)
        for message in _messages_of(conversation)
        if message.role != ROLE_RECORD
    ]


def context_tokens_of(conversation: AssistantConversation) -> int:
    """How much of the model's context the last response took."""
    last = (
        db.session.query(AssistantMessage)
        .filter(
            AssistantMessage.conversation_id == conversation.id,
            AssistantMessage.role == "assistant",
        )
        .order_by(AssistantMessage.seq.desc())
        .first()
    )
    if last is None:
        return 0
    return (
        last.input_tokens
        + last.cache_read_input_tokens
        + last.cache_creation_input_tokens
    )


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
    A response the person left in the middle is not sent either: it has no content.
    """
    return [
        {
            "role": message.role,
            "content": content_to_send(json.loads(message.content)),
        }
        for message in _messages_of(conversation)
        if message.role != ROLE_RECORD and message.stop_reason not in _NOT_SENT
    ]


def uses_tool_search(history: list[dict[str, Any]]) -> bool:
    """Whether a history holds tools found by searching, which need that search."""
    return any(
        block.get("type") == "tool_search_tool_result"
        or (
            block.get("type") == "server_tool_use"
            and "tool_search" in block.get("name", "")
        )
        for message in history
        for block in message["content"]
    )


def not_run_results(pending: PendingTurn) -> list[dict[str, Any]]:
    """Answers for a turn the person left behind: none of its calls ran."""
    return [
        {
            "type": "tool_result",
            "tool_use_id": call["id"],
            "content": [{"type": "text", "text": MOVED_ON}],
            "is_error": True,
        }
        for call in pending.calls
    ]


class ConversationLog:
    """
    Writes one request's messages at the end of a conversation.

    It keeps ids and no row: it lives through a stream, which runs after the session
    of the view ended, and tools end the session they share with it.
    """

    def __init__(self, conversation: AssistantConversation, user_id: int) -> None:
        self._conversation_id = conversation.id
        self._dashboard_id = conversation.dashboard_id
        self._user_id = user_id
        # The first answer this request stored, which the panel votes on
        self.answer_id: UUID | None = None
        last = (
            db.session.query(db.func.max(AssistantMessage.seq))
            .filter(AssistantMessage.conversation_id == conversation.id)
            .scalar()
        )
        self._next_seq = 0 if last is None else last + 1

    def _row(self, role: str, content: list[dict[str, Any]]) -> AssistantMessage:
        row = AssistantMessage(
            id=uuid4(),
            conversation_id=self._conversation_id,
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

    def add_results(self, tool_results: list[dict[str, Any]]) -> None:
        """Answer a turn that waited for decisions."""
        self._row("user", tool_results)
        self._commit()

    def add_decision(self, tool_use_id: str, approved: bool) -> None:
        """
        What the person decided on a call. The position is unique, so of two requests
        that race for the same decision only one gets here, before any tool runs.
        """
        self._row(
            ROLE_RECORD,
            [
                {
                    "type": RECORD_DECISION,
                    "tool_use_id": tool_use_id,
                    "approved": approved,
                }
            ],
        )
        self._commit()

    def add_turn_start(self, versions: dict[str, Any], continues: bool) -> None:
        """The versions right before a turn's first change."""
        self._row(
            ROLE_RECORD,
            [{"type": RECORD_TURN_START, "versions": versions, "continues": continues}],
        )
        self._commit()

    def add_turn_end(self, versions: dict[str, Any]) -> None:
        self._row(ROLE_RECORD, [{"type": RECORD_TURN_END, "versions": versions}])
        self._commit()

    def add_undone(self, versions: dict[str, Any], note: dict[str, Any]) -> None:
        """An undo, and in the same commit a note that tells the model."""
        self._row(ROLE_RECORD, [{"type": RECORD_UNDONE, "versions": versions}])
        self._row("user", [note])
        self._commit()

    def add_turn(
        self,
        turn: AssistantTurn,
        tool_results: list[dict[str, Any]] | None = None,
        awaiting: list[dict[str, str]] | None = None,
    ) -> None:
        """
        Store a response of the API and, in the same commit, its tool results or, if
        some of its calls need a decision (``awaiting``, their id and title), the
        record that makes the turn pending.
        """
        row = self._row("assistant", turn.content)
        self.answer_id = self.answer_id or row.id
        row.model = turn.model
        row.stop_reason = turn.stop_reason
        row.user_id = self._user_id
        row.workspace_id = (
            workspace_id_of(self._dashboard_id)
            if self._dashboard_id is not None
            else None
        )
        row.input_tokens = turn.usage.input_tokens
        row.output_tokens = turn.usage.output_tokens
        row.cache_read_input_tokens = turn.usage.cache_read_input_tokens
        row.cache_creation_input_tokens = turn.usage.cache_creation_input_tokens
        row.cost_usd = turn.cost_usd
        if tool_results:
            self._row("user", tool_results)
        if awaiting:
            self._row(ROLE_RECORD, [{"type": RECORD_AWAITING, "calls": awaiting}])
        self._commit()
