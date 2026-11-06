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
A turn of the assistant, from the web request to the worker and back.

The web request checks everything, stores what the person said or decided, writes a
ticket and queues a task that only carries the id of the turn. The worker runs the turn
and writes each event to Redis (``turn_store.py``), and any connection of the owner
relays them, as many times as it takes. So a turn outlives whoever asked: a reload
reads it from where it was, and only ``POST .../stop/`` stops it.

**Identity.** The worker acts as the user the request read from its session, which
reaches the worker in the ticket and nowhere else: no client writes a ticket, and the
task has no argument for a user. ``_owner_of`` holds it against the owner of the
conversation and fails closed for a user who is gone or inactive. Then the turn runs
under ``override_user``, and each tool under ``run_as`` with that user's id, as in the
web process. There is no other identity to fall back on: never a system user, an admin
or ``MCP_DEV_USERNAME``. What the person may do on the report is read again at the
start.

A turn runs inside an empty POST request of its own, like the one that used to carry it:
per-user OAuth2, ``SavedQueryFilter`` and other code ask whether there is a request, and
must answer as they do in the web process. That request has no cookies and adds no
identity: Flask-Login is told who it is from the same user, in ``g``, so its session is
never read or written.

**One run.** A repeated turn repeats writes and spending, so the task takes no retries,
is acknowledged as it starts (``acks_late`` off: a dead worker loses the turn, which is
then reported, instead of running it twice) and first takes the claim of its turn, which
a second delivery cannot get. A reader that gives up on a queued turn takes the same
claim, so a late worker finds it taken.

**A dead turn.** ``settle_turn`` runs wherever the owner comes back. A turn nobody took,
or whose heartbeat stopped, is closed: what its calls left unanswered gets an answer, an
open change gets its end on record, the person reads why, and the stream is released.

The limits of a turn are its own deadline, heard between steps like a stop, because
``SoftTimeLimitExceeded`` is an ``Exception`` that the handlers around tools would
swallow; ``time_limit`` only remains as the last resort, which reads as a dead turn. A
running tool always finishes: stopping one halfway would leave a write half done.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Generator, Iterator
from contextlib import nullcontext
from dataclasses import replace
from typing import Any
from uuid import UUID

from flask import current_app, g, has_request_context
from flask_babel import force_locale, gettext as _

from superset import security_manager
from superset.auradata.assistant.agent import (
    build_client,
    Event,
    resume_after_decisions,
    run_conversation,
    TICK,
)
from superset.auradata.assistant.conversations import (
    AssistantConversation,
    context_tokens_of,
    ConversationBusyError,
    ConversationLog,
    find_conversation,
    history_of,
    lost_results,
    pending_turn,
    STOP_INTERRUPTED,
    turn_left_open,
    workspace_id_of,
)
from superset.auradata.assistant.governance import budget_of
from superset.auradata.assistant.models import CatalogModel, get_catalog, tuned_spec
from superset.auradata.assistant.prompt import system_prompt, TOOL_SEARCH_NOTE
from superset.auradata.assistant.settings import (
    AssistantSettings,
    get_assistant_settings,
    offered_models,
)
from superset.auradata.assistant.spending import BudgetState
from superset.auradata.assistant.tools import MODE_EDIT, ToolBox
from superset.auradata.assistant.turn_store import (
    ABANDONED,
    TRIMMED,
    TURN_END,
    TurnStore,
    TurnTicket,
)
from superset.auradata.assistant.undo import can_undo, report_versions
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import override_user

logger = logging.getLogger(__name__)

KIND_CHAT = "chat"
KIND_DECIDE = "decide"

# Keep reports and alerts off these slots: a turn lasts minutes
QUEUE = "auradata_assistant"
# What Celery may add to the deadline of a turn before it kills the process
LIMIT_MARGIN_SECONDS = 60
# How a turn listens while it waits on the model or a tool
WATCH_SECONDS = 1.0
BEATS_EVERY = 5
# Longer than a request takes between taking a turn and writing its ticket
TICKET_GRACE_SECONDS = 60

# A connection ends after this and the panel opens the next, with access read again
CONNECTION_SECONDS = 45.0
READ_BLOCK_MS = 3_000
# Seconds without a byte before a connection says it is alive: under the 60 of a proxy
KEEP_ALIVE_SECONDS = 15.0

# Why a turn ended without an ending, for the panel
WORKER_LOST = "worker_lost"
NO_WORKER = "no_worker"
TIMED_OUT = "timed_out"


class _FencedError(Exception):
    """This turn was given up for dead while it ran: its stream is not its own."""


def turn_seconds() -> int:
    """How long a turn may run."""
    return int(current_app.config["AURADATA_ASSISTANT_TURN_SECONDS"])


def queue_seconds() -> int:
    """How long a turn waits for a free worker."""
    return int(current_app.config["AURADATA_ASSISTANT_QUEUE_SECONDS"])


def open_dashboard(dashboard_id: int | None) -> Dashboard | None:
    """The dashboard if this user can open it. None hides whether it exists."""
    if dashboard_id is None:
        return None
    try:
        return DashboardDAO.get_by_id_or_slug(dashboard_id)
    except (
        DashboardNotFoundError,
        DashboardAccessDeniedError,
        SupersetSecurityException,
    ):
        return None


def offered_model(settings: AssistantSettings, model_id: str) -> CatalogModel | None:
    """A model the settings offer, tuned as the admin chose."""
    offered = offered_models(settings, get_catalog())
    model = next((item for item in offered if item.id == model_id), None)
    if model is None:
        return None
    return replace(
        model, spec=tuned_spec(model.spec, settings.effort, settings.thinking)
    )


def _sse(event: str, data: str, number: int | None = None) -> str:
    head = f"id: {number}\n" if number is not None else ""
    return f"{head}event: {event}\ndata: {data}\n\n"


def _keep_alive() -> str:
    """A comment of the SSE format: proxies count it, and readers skip it."""
    return ": keep-alive\n\n"


def enqueue(ticket: TurnTicket) -> None:
    """
    Hand a turn to the workers. It expires with the wait, ``retry=False`` leaves the
    publishing to one attempt, and the task never retries.
    """
    # pylint: disable=import-outside-toplevel
    from superset.tasks.assistant_turn import run_assistant_turn

    run_assistant_turn.apply_async(
        args=[ticket.turn_id],
        queue=QUEUE,
        expires=queue_seconds(),
        time_limit=turn_seconds() + LIMIT_MARGIN_SECONDS,
        retry=False,
    )


def start_turn(store: TurnStore, ticket: TurnTicket, opening: list[Event]) -> None:
    """
    Save the ticket of a turn that holds the lock and queue it. ``opening`` is what a
    reader learns first, written here so it knows that whatever the worker does.
    """
    store.save_ticket(ticket)
    for event, payload in opening:
        store.publish(ticket.conversation_id, ticket.turn_id, event, payload)
    try:
        enqueue(ticket)
    except Exception:  # pylint: disable=broad-except
        logger.exception("The turn of the assistant could not be queued")
        # The broker may have taken it after all: then a worker has it, and it goes on
        if store.claim(ticket.turn_id, ABANDONED):
            _close_dead_turn(store, ticket, NO_WORKER)


# In the worker


class _Watch:
    """
    Keeps a turn visible and listens for a stop, from a thread of its own: tools hold
    the thread of the turn for minutes, and a dead process must go quiet. It touches
    Redis alone, never the session, ``g`` or the tools.
    """

    def __init__(self, store: TurnStore, turn_id: str) -> None:
        self._store = store
        self._turn_id = turn_id
        self._done = threading.Event()
        self.stop_asked = threading.Event()
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="assistant-watch"
        )

    def _run(self) -> None:
        count = 0
        while not self._done.wait(WATCH_SECONDS):
            count += 1
            try:
                if count % BEATS_EVERY == 0:
                    self._store.beat(self._turn_id)
                if self._store.stop_asked(self._turn_id):
                    self.stop_asked.set()
            except Exception:  # pylint: disable=broad-except
                logger.warning("The watch of a turn could not reach Redis")

    def __enter__(self) -> "_Watch":
        # A stop that came first is heard before the first step of the turn
        if self._store.stop_asked(self._turn_id):
            self.stop_asked.set()
        self._thread.start()
        return self

    def __exit__(self, *_args: object) -> None:
        self._done.set()


def _owner_of(ticket: TurnTicket) -> tuple[AssistantConversation, Any] | None:
    """
    The conversation of a ticket and the user to act as. A ticket that does not match
    what the conversation says, or a user who can no longer act, gets nothing.
    """
    conversation = find_conversation(UUID(ticket.conversation_id), ticket.user_id)
    if (
        conversation is None
        or conversation.dashboard_id != ticket.dashboard_id
        or conversation.mode != ticket.mode
    ):
        return None
    user = db.session.get(security_manager.user_model, ticket.user_id)
    if user is None or not user.is_active:
        return None
    return conversation, user


def _may_still_run(ticket: TurnTicket) -> bool:
    """What the request checked about the person and the report, read again as them."""
    dashboard = open_dashboard(ticket.dashboard_id)
    if dashboard is None:
        return False
    return ticket.mode != MODE_EDIT or security_manager.can_edit_resource(dashboard)


def _recorded(
    ticket: TurnTicket,
    log: ConversationLog,
    turn: Iterator[Event],
    budget: Callable[[], BudgetState],
) -> Generator[Event, None, None]:
    """
    The events of a turn, with what the app records around them. A turn that changes
    something records the versions right before its first change and where it ended,
    also if it stops halfway, so it can be undone, and ``done`` says so. The first
    record waits for that change: what anyone saved while the model thought, or while a
    card waited, is not part of the turn and an undo keeps it. A turn goes on from a
    card as the same turn. ``done`` also says where the month stands, so the panel warns
    without asking again. Tools end the session they share with this code, so it holds
    ids and reads what it needs again.
    """
    changed = False
    started = False
    conversation_id = UUID(ticket.conversation_id)

    def end_turn() -> None:
        nonlocal changed
        versions = report_versions(ticket.dashboard_id) if changed else None
        changed = False
        if versions is not None:
            log.add_turn_end(versions)

    try:
        for event, payload in turn:
            if event == "tool_start" and payload.get("changes") and not started:
                # The tool has not run: this generator waits at that yield
                started = True
                versions = report_versions(ticket.dashboard_id)
                if versions is not None:
                    log.add_turn_start(versions, ticket.kind == KIND_DECIDE)
            changed = changed or (event == "tool_end" and payload.get("changed", False))
            if event == "done":
                end_turn()
                payload = {
                    **payload,
                    **_closing(conversation_id, ticket, log, budget),
                }
            yield event, payload
    except ConversationBusyError:
        yield (
            "error",
            {
                "code": "busy",
                "message": _("This conversation is answering another message."),
            },
        )
    except Exception:  # pylint: disable=broad-except
        # The stream is open: a status code can no longer say this
        logger.exception("The assistant failed in the middle of a turn")
        yield (
            "error",
            {
                "code": "failed",
                "message": _(
                    "The AI service failed. Start a new conversation if this repeats."
                ),
            },
        )
    finally:
        end_turn()


def _closing(
    conversation_id: UUID,
    ticket: TurnTicket,
    log: ConversationLog,
    budget: Callable[[], BudgetState],
) -> dict[str, Any]:
    """What ``done`` adds: what the panel asks about once a turn is over."""
    state = budget()
    return {
        "can_undo": ticket.mode == MODE_EDIT
        and can_undo(find_conversation(conversation_id, ticket.user_id)),
        "budget": {"level": state.level, "scope": state.scope},
        "message_id": str(log.answer_id) if log.answer_id else None,
    }


def _decided_turn(
    ticket: TurnTicket,
    client: Any,
    model: CatalogModel,
    system: str,
    toolbox: ToolBox,
    log: ConversationLog,
    conversation: AssistantConversation,
) -> Iterator[Event]:
    """What the stored decisions say, as the row of the conversation holds them."""
    decided = pending_turn(conversation)
    if decided is None or decided.undecided:
        logger.warning("A decided turn found nothing to run")
        return
    yield from resume_after_decisions(
        client,
        model,
        system,
        toolbox,
        log,
        lambda: find_conversation(UUID(ticket.conversation_id), ticket.user_id),
        decided,
    )


def _prepare_turn(
    ticket: TurnTicket, conversation: AssistantConversation, username: str
) -> tuple[ConversationLog, Iterator[Event], Callable[[], BudgetState]] | Event:
    """What the turn needs, built as the person, or the event that says why not."""
    settings = get_assistant_settings()
    model = offered_model(settings, ticket.model)
    if model is None:
        return (
            "error",
            {"code": "failed", "message": _("This model is not available.")},
        )
    try:
        client = build_client()
        toolbox = ToolBox(
            username, ticket.mode, model.id, ticket.dashboard_id, ticket.user_id
        )
    except ImportError:
        logger.warning("The assistant needs the anthropic and fastmcp packages")
        return (
            "error",
            {"code": "failed", "message": _("The AI assistant is not installed.")},
        )
    toolbox.conversation_id = ticket.conversation_id
    stored = conversation.system_prompt
    if stored is None or (TOOL_SEARCH_NOTE in stored) != model.spec.tool_search:
        # Sent as it is on every later turn: its thinking is bound to this text, so a
        # change of the prompt reaches new conversations and leaves this one alone. Only
        # a change to a model that finds its tools another way writes it again: it would
        # tell that model of tools it does not have
        conversation.system_prompt = system_prompt(
            ticket.mode, toolbox.unavailable, model.spec.tool_search
        )
        db.session.commit()  # pylint: disable=consider-using-transaction
    system = conversation.system_prompt
    log = ConversationLog(conversation, ticket.user_id)
    if ticket.kind == KIND_DECIDE:
        turn = _decided_turn(ticket, client, model, system, toolbox, log, conversation)
    else:
        turn = run_conversation(
            client, model, system, toolbox, log, history_of(conversation)
        )
    workspace_id = workspace_id_of(ticket.dashboard_id)
    return log, turn, lambda: budget_of(get_assistant_settings(), workspace_id)


def _send_all(
    store: TurnStore,
    ticket: TurnTicket,
    events: Generator[Event, None, None],
    watch: _Watch,
) -> str | None:
    """
    Write the events of a turn, and close it when it has to stop: that is the path of
    every turn cut short, and what it had paid for gets stored there. Says why it
    stopped, if it did.
    """
    deadline = time.monotonic() + turn_seconds()
    try:
        if watch.stop_asked.is_set():
            return STOP_INTERRUPTED
        for event, payload in events:
            if event != "done":
                if watch.stop_asked.is_set():
                    return STOP_INTERRUPTED
                if time.monotonic() > deadline:
                    return TIMED_OUT
            if event != TICK and not store.publish(
                ticket.conversation_id, ticket.turn_id, event, payload
            ):
                raise _FencedError
        return None
    finally:
        events.close()


def _answer(store: TurnStore, ticket: TurnTicket, watch: _Watch) -> None:
    """Run a turn as its owner, and leave its events in the stream."""

    def say(event: str, payload: dict[str, Any]) -> None:
        store.publish(ticket.conversation_id, ticket.turn_id, event, payload)

    owner = _owner_of(ticket)
    if owner is None:
        logger.warning("A turn of the assistant was refused: its owner cannot act")
        say("error", _refused())
        return
    conversation, user = owner
    with override_user(user):
        # Where Flask-Login looks first: ``login_user`` would write a session
        g._login_user = user  # pylint: disable=protected-access
        if not _may_still_run(ticket):
            logger.warning("A turn of the assistant was refused: access changed")
            say("error", _refused())
            return
        prepared = _prepare_turn(ticket, conversation, user.username)
        if isinstance(prepared[0], str):
            say(*prepared)
            return
        log, turn, budget = prepared
        reason = _send_all(store, ticket, _recorded(ticket, log, turn, budget), watch)
        if reason == TIMED_OUT:
            say(
                "error",
                {
                    "code": TIMED_OUT,
                    "message": _("This took too long and was stopped. Ask for less."),
                },
            )
        if reason is not None:
            conversation_id = UUID(ticket.conversation_id)
            say(
                "done",
                {
                    "stop_reason": STOP_INTERRUPTED,
                    "context_tokens": context_tokens_of(
                        find_conversation(conversation_id, ticket.user_id)
                    ),
                    **_closing(conversation_id, ticket, log, budget),
                },
            )


def _refused() -> dict[str, Any]:
    return {
        "code": "refused",
        "message": _("You can no longer use the assistant on this report."),
    }


def run_turn(store: TurnStore, turn_id: str) -> None:
    """
    The body of the task. ``turn_id`` names a ticket the server wrote, and only the
    delivery that takes the claim goes on.
    """
    ticket = store.ticket(turn_id)
    if ticket is None:
        logger.warning("A turn of the assistant has no ticket: it does not run")
        return
    # Before the claim: nobody should find a taken turn without a pulse
    store.beat(turn_id)
    if not store.claim(turn_id):
        logger.info("A turn of the assistant was taken already: it does not run twice")
        return
    language = force_locale(ticket.locale) if ticket.locale else nullcontext()
    # A worker has none. The eager mode of a test already runs inside one
    request_context = (
        nullcontext()
        if has_request_context()
        else current_app.test_request_context(method="POST")
    )
    with _Watch(store, turn_id) as watch, request_context, language:
        try:
            _answer(store, ticket, watch)
        except _FencedError:
            logger.warning("A turn given up for dead stopped writing")
        except Exception:  # pylint: disable=broad-except
            logger.exception("A turn of the assistant failed")
            store.publish(
                ticket.conversation_id,
                turn_id,
                "error",
                {
                    "code": "failed",
                    "message": _(
                        "The AI service failed. Start a new conversation if this "
                        "repeats."
                    ),
                },
            )
        finally:
            store.publish(ticket.conversation_id, turn_id, TURN_END, {}, last=True)


# In the web process


def _lost_message(code: str) -> str:
    if code == NO_WORKER:
        return _(
            "No worker of the assistant is free. Try again in a moment, and tell your "
            "administrator if this repeats."
        )
    return _(
        "The assistant stopped before finishing, and this answer is incomplete. If it "
        "was changing the report, check it before asking again."
    )


def repair_conversation(
    conversation: AssistantConversation, user_id: int, code: str = WORKER_LOST
) -> None:
    """
    Leave a conversation as a finished turn would, appending only: calls of a decided
    turn get their answer, a change under way gets its end, and a record says what
    happened. A turn that lost a call to the model stored nothing for it, so the
    conversation already reads well for the next message.
    """
    log = ConversationLog(conversation, user_id)
    decided = pending_turn(conversation)
    if decided is not None and not decided.undecided:
        log.add_results(lost_results(decided))
    if turn_left_open(conversation):
        versions = report_versions(conversation.dashboard_id)
        if versions is not None:
            log.add_turn_end(versions)
    log.add_turn_lost(code)


def _close_dead_turn(store: TurnStore, ticket: TurnTicket, code: str) -> None:
    """Repair a conversation and tell everyone reading it, once."""
    conversation_id = ticket.conversation_id
    # What is left of the turn listens to this at its next step, if it still runs
    store.ask_to_stop(ticket.turn_id)
    conversation = find_conversation(UUID(conversation_id), ticket.user_id)
    try:
        if conversation is not None:
            repair_conversation(conversation, ticket.user_id, code)
    except ConversationBusyError:
        logger.warning("A dead turn could not be recorded: its conversation moved on")
    store.publish(
        conversation_id,
        ticket.turn_id,
        "error",
        {"code": code, "message": _lost_message(code)},
    )
    store.publish(
        conversation_id,
        ticket.turn_id,
        "done",
        {
            "stop_reason": None,
            "context_tokens": context_tokens_of(conversation) if conversation else 0,
            "can_undo": conversation is not None
            and ticket.mode == MODE_EDIT
            and can_undo(conversation),
        },
    )
    store.publish(conversation_id, ticket.turn_id, TURN_END, {}, last=True)


def _why_dead(store: TurnStore, ticket: TurnTicket) -> str | None:
    """Why a turn holding the lock will never end by itself, if so."""
    claimed = store.claimed(ticket.turn_id)
    if claimed is None:
        if time.time() - ticket.opened_at < queue_seconds():
            return None
        if store.claim(ticket.turn_id, ABANDONED):
            return NO_WORKER
        # A worker took it just now
        return None
    if claimed == ABANDONED:
        return NO_WORKER
    return None if store.alive(ticket.turn_id) else WORKER_LOST


def settle_turn(store: TurnStore, conversation_id: UUID | str) -> None:
    """
    Close the turn of a conversation if nothing will end it. Only the owner gets here,
    and anyone who finds it first does the work.
    """
    turn_id = store.holder(conversation_id)
    if turn_id is None:
        return
    ticket = store.ticket(turn_id)
    if ticket is None:
        # A request takes the lock first and writes the ticket once the message is
        # stored. Past that moment the ticket expired or Redis lost it, and nothing can
        # run under this lock
        if store.lock_age(conversation_id) >= TICKET_GRACE_SECONDS:
            store.release(conversation_id, turn_id)
        return
    code = _why_dead(store, ticket)
    if code is not None and store.take_settling(turn_id):
        _close_dead_turn(store, ticket, code)


def relay(store: TurnStore, conversation_id: UUID | str, after: int) -> Iterator[str]:
    """
    One connection to a stream: the events past ``after`` in the format of server-sent
    events, each with its number, until its turn ends or the connection has lasted
    enough. Without ``turn_end`` the reader opens another from its last number, and that
    is when its access is read again. Comments keep it open through silent gaps. A
    reader behind the start of the stream first gets ``trimmed``.
    """
    deadline = time.monotonic() + CONNECTION_SECONDS
    last_byte = time.monotonic()
    yield ": connected\n\n"
    first = store.first_event(conversation_id)
    if first is not None and first > after + 1:
        # What was asked for is gone. The reader goes on, and says it must read the rows
        yield _sse(TRIMMED, json.dumps({}))
        after = first - 1
    while time.monotonic() < deadline:
        entries = store.read(conversation_id, after, READ_BLOCK_MS)
        for number, event, data in entries:
            after = number
            last_byte = time.monotonic()
            yield _sse(event, data, number)
            if event == TURN_END:
                return
        if entries:
            continue
        settle_turn(store, conversation_id)
        if store.holder(conversation_id) is None and not store.read(
            conversation_id, after, 0
        ):
            # Nothing runs and nothing is left to read
            yield _sse(TURN_END, json.dumps({"gone": True}))
            return
        if time.monotonic() - last_byte >= KEEP_ALIVE_SECONDS:
            last_byte = time.monotonic()
            yield _keep_alive()


def answered_at_once(context_tokens: int) -> Iterator[str]:
    """A stream with nothing to wait for: a card answered while others are still up."""
    yield _sse(
        "done",
        json.dumps({"stop_reason": "tool_use", "context_tokens": context_tokens}),
    )
    yield _sse(TURN_END, json.dumps({}))
