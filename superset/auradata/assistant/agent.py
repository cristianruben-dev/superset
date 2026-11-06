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
The loop of the assistant, one manual turn at a time.

The loop is written out rather than left to the tool runner of the SDK because each
step here has a rule of its own: every response is stored as it came, with the cost of
that call, before the next one; a refused or cut response never runs its tools; and
every tool call goes through ``ToolBox``, the only gate for a tool name.

A response with a call that needs the approval of the person stops the loop: none of
its tools run, the turn is stored as pending, and ``resume_after_decisions`` picks it up
once the person has decided on each of those calls. Only a stored decision approves a
call. What the model writes and what tools return have no way to.

Tool inputs are not streamed eagerly: with that option the API stops checking them,
and these tools write as the user.

``anthropic`` is imported where it is used: the web app must start without it.
"""

from __future__ import annotations

import logging
import queue
import socket
import threading
from collections.abc import Callable, Iterator
from decimal import Decimal
from typing import Any

from flask import current_app
from flask_babel import gettext as _

from superset.auradata.assistant.artifacts import artifact_of
from superset.auradata.assistant.conversations import (
    AssistantTurn,
    confirmation_json,
    content_to_send,
    ConversationBusyError,
    ConversationLog,
    HELD_BACK,
    history_of,
    PendingTurn,
    REJECTED,
    STOP_INTERRUPTED,
    STOP_REFUSAL,
    tool_uses_of,
)
from superset.auradata.assistant.figures import figure_of
from superset.auradata.assistant.models import (
    CatalogModel,
    context_of_message,
    cost_of_message,
    DISPLAY_UPDATES,
    REFUSAL_FALLBACK_BETA,
    THINKING_UPDATES_BETA,
    TokenUsage,
)
from superset.auradata.assistant.tools import ToolBox
from superset.auradata.models import AssistantConversation

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 64_000
# Calls to the API for one message of the user
MAX_MODEL_CALLS = 25
INTERRUPTED = "The tool did not run: the turn ended first."
# How often a wait on the model gives the turn a chance to stop
TICK_SECONDS = 1.0
# An event with no meaning for the panel: the turn looks at its marks and goes on
TICK = "tick"

# Error code of a conversation too long for the model: the panel offers a new one
CONTEXT_EXCEEDED = "context_exceeded"
STOP_CONTEXT_WINDOW = "model_context_window_exceeded"
OVER_CONTEXT_PHRASES = ("prompt is too long", "exceed context limit")
# With this beta a response lists the usage of each time the model ran for it, also
# without a fallback. It does not change the prompt cache
USAGE_PER_PASS_BETA = REFUSAL_FALLBACK_BETA

Event = tuple[str, dict[str, Any]]


def build_client() -> Any:
    """A client with the key of the configuration, never ambient credentials."""
    import anthropic  # pylint: disable=import-outside-toplevel

    return anthropic.Anthropic(api_key=current_app.config["ANTHROPIC_API_KEY"])


def request_params(
    model: CatalogModel,
    system: str,
    tools: list[dict[str, Any]],
    messages: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    The request for a model, from what its ``ModelSpec`` says.

    The cache marker on the system prompt covers the tools too, which come first; the
    top level marker follows the growing conversation. Claude chooses the tools:
    several models refuse a forced choice.
    """
    spec = model.spec
    params: dict[str, Any] = {
        "model": model.id,
        "max_tokens": min(
            MAX_OUTPUT_TOKENS, model.max_output_tokens or MAX_OUTPUT_TOKENS
        ),
        "system": [
            {
                "type": "text",
                "text": system,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        "messages": messages,
        **spec.refusal_fallback_params(),
    }
    if tools:
        params["tools"] = tools
        params["tool_choice"] = {"type": "auto"}
    if spec.thinking_on is not None:
        params["thinking"] = dict(spec.thinking_on)
        if spec.thinking_display is not None:
            params["thinking"]["display"] = spec.thinking_display
        if spec.thinking_display == DISPLAY_UPDATES:
            params["betas"] = [*params.get("betas", []), THINKING_UPDATES_BETA]
    betas = params.get("betas", [])
    if tools and spec.tool_search and USAGE_PER_PASS_BETA not in betas:
        params["betas"] = [USAGE_PER_PASS_BETA, *betas]
    if spec.efforts and spec.default_effort:
        params["output_config"] = {"effort": spec.default_effort}
    if spec.automatic_cache:
        params["cache_control"] = {"type": "ephemeral"}
    return params


def _is_out_of_credit(ex: Any) -> bool:
    return (
        getattr(ex, "type", None) == "billing_error"
        or getattr(ex, "status_code", None) == 402
        or "credit balance" in str(ex).lower()
    )


def _is_over_context(ex: Any) -> bool:
    """The API has no type for this: a 400 says it in its message."""
    text = str(ex).lower()
    return any(phrase in text for phrase in OVER_CONTEXT_PHRASES)


def _is_kind(ex: Any, status: int, kind: str) -> bool:
    """By status or, for an error in the middle of a stream, by its type."""
    return (
        getattr(ex, "status_code", None) == status or getattr(ex, "type", None) == kind
    )


def context_exceeded_event() -> Event:
    """A conversation that no longer fits in what the model can read."""
    return (
        "error",
        {
            "code": CONTEXT_EXCEEDED,
            "message": _(
                "This conversation is too long for the model. "
                "Start a new one to keep going."
            ),
        },
    )


def error_event(ex: Exception) -> Event:
    """What the user reads when a call to the API fails."""
    import anthropic  # pylint: disable=import-outside-toplevel

    logger.warning(
        "Assistant call failed: %s, request %s",
        type(ex).__name__,
        getattr(ex, "request_id", None),
    )
    if _is_over_context(ex):
        return context_exceeded_event()
    if _is_kind(ex, 429, "rate_limit_error"):
        code = "rate_limited"
        message = _("The AI service has too many requests. Wait a moment and retry.")
    elif _is_out_of_credit(ex):
        code = "no_credit"
        message = _("The AI service has run out of credit. Tell your administrator.")
    elif _is_kind(ex, 529, "overloaded_error"):
        code = "overloaded"
        message = _("The AI service is overloaded. Wait a moment and retry.")
    elif isinstance(
        ex, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)
    ):
        code = "rejected_key"
        message = _(
            "The AI service rejected the server's key. Tell your administrator."
        )
    elif isinstance(ex, anthropic.APIConnectionError):
        code = "unreachable"
        message = _("The AI service cannot be reached. Try again later.")
    else:
        code = "failed"
        message = _("The AI service failed. Start a new conversation if this repeats.")
    return "error", {"code": code, "message": message}


def _note_of(event: Any) -> Event:
    """
    A piece of what the model shows of its thinking. ``starts`` opens a new note: only
    the first text of a block makes up all that the block holds.
    """
    return "note", {"text": event.thinking, "starts": event.snapshot == event.thinking}


class ModelCall:
    """
    One call to the model, read from a thread of its own.

    While the model thinks little or nothing arrives: only its notes have text, it can
    go long without one, and the SDK drops the pings. So the call waits in that thread,
    and ``events`` yields ``TICK`` every so often while it does, which is where a person
    who asked to stop is heard. A thinking event with no text never reaches the queue:
    it would restart that wait with nothing for the panel. That thread only runs the
    HTTP call of the SDK: the session, ``g`` and the tools stay in the turn's thread.
    """

    def __init__(self, client: Any, params: dict[str, Any]) -> None:
        self._client = client
        self._params = params
        self._items: queue.Queue[tuple[str, Any]] = queue.Queue()
        self._stream: Any = None
        self._leaving = threading.Event()

    def _read(self) -> None:
        try:
            with self._client.beta.messages.stream(**self._params) as stream:
                self._stream = stream
                if self._leaving.is_set():
                    return
                for event in stream:
                    if event.type == "text":
                        self._items.put(("item", ("text", {"text": event.text})))
                    elif event.type == "thinking" and event.thinking:
                        self._items.put(("item", _note_of(event)))
                self._items.put(("item", stream.get_final_message()))
            self._items.put(("end", None))
        except Exception as ex:  # pylint: disable=broad-except
            self._items.put(("failed", ex))

    def events(self) -> Iterator[Event | Any]:
        """Text and notes as they arrive, as events, and the final message last."""
        threading.Thread(target=self._read, daemon=True, name="assistant-model").start()
        try:
            while True:
                try:
                    kind, value = self._items.get(timeout=TICK_SECONDS)
                except queue.Empty:
                    yield TICK, {}
                    continue
                if kind == "end":
                    return
                if kind == "failed":
                    raise value
                yield value
        finally:
            # The turn stopped: end the model call instead of waiting for its next event
            self._leaving.set()
            self._hang_up()

    def _hang_up(self) -> None:
        """
        End the request from this side. Closing a socket does not wake a thread
        blocked reading it, so the connection is shut down first when it can be
        reached. Past that the read ends with its next byte or its timeout.
        """
        stream = self._stream
        if stream is None:
            return
        try:
            network = stream.response.extensions.get("network_stream")
            sock = network.get_extra_info("socket") if network else None
            if sock is not None:
                sock.shutdown(socket.SHUT_RDWR)
        except (AttributeError, OSError):
            logger.debug("The connection to the model was already closed")
        try:
            stream.close()
        except Exception:  # pylint: disable=broad-except
            logger.debug("Closing the stream of the model failed", exc_info=True)

    def partial_message(self) -> Any | None:
        """What the API said before the call stopped, if it said anything."""
        stream = self._stream
        if stream is None:
            return None
        try:
            return stream.current_message_snapshot
        except (AssertionError, AttributeError):
            return None


def _turn_of(message: Any) -> AssistantTurn:
    """A response as it came: ``to_dict`` keeps the API's own field names and values."""
    usage, cost = cost_of_message(message.model, message.usage)
    return AssistantTurn(
        content=[block.to_dict(mode="json") for block in message.content],
        model=message.model,
        stop_reason=message.stop_reason,
        usage=usage,
        cost_usd=cost,
        context_tokens=context_of_message(message.usage),
    )


def _store_what_it_cost(call: ModelCall, log: ConversationLog) -> None:
    """A call cut short was still paid for. Its output is not kept: it is not whole."""
    message = call.partial_message()
    if message is None:
        return
    usage, cost = cost_of_message(message.model, message.usage)
    try:
        log.add_turn(
            AssistantTurn(
                [],
                message.model,
                STOP_INTERRUPTED,
                usage,
                cost,
                context_of_message(message.usage),
            )
        )
    except ConversationBusyError:
        logger.warning("The cost of a call that stopped was not stored")


def _result_block(tool_use_id: str, outcome: Any) -> dict[str, Any]:
    block = {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": outcome.content,
    }
    if outcome.is_error:
        block["is_error"] = True
    return block


def _error_result(tool_use_id: str, text: str) -> dict[str, Any]:
    return {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": [{"type": "text", "text": text}],
        "is_error": True,
    }


def _why_not_run(block: dict[str, Any], decisions: dict[str, bool]) -> str | None:
    """A call left out by the person: a rejected one, and the rest of its step."""
    if decisions.get(block["id"]) is False:
        return REJECTED
    if block["id"] not in decisions and False in decisions.values():
        return HELD_BACK
    return None


def _run_tools(
    tool_uses: list[dict[str, Any]],
    toolbox: ToolBox,
    results: list[dict[str, Any]],
    decisions: dict[str, bool] | None = None,
) -> Iterator[Event]:
    """
    Run the calls of a turn in order. ``decisions`` are the stored decisions of the
    person: the only thing that approves a call.
    """
    decisions = decisions or {}
    for block in tool_uses:
        reason = _why_not_run(block, decisions)
        yield (
            "tool_start",
            {
                "id": block["id"],
                "name": block["name"],
                "changes": reason is None and toolbox.changes_something(block["name"]),
            },
        )
        if reason is not None:
            results.append(_error_result(block["id"], reason))
            yield (
                "tool_end",
                {
                    "id": block["id"],
                    "name": block["name"],
                    "is_error": True,
                    "rejected": decisions.get(block["id"]) is False,
                },
            )
            continue
        outcome = toolbox.call(
            block["name"],
            block.get("input"),
            approved=decisions.get(block["id"]) is True,
        )
        result = _result_block(block["id"], outcome)
        results.append(result)
        payload = {
            "id": block["id"],
            "name": block["name"],
            "is_error": outcome.is_error,
            "changed": not outcome.is_error
            and toolbox.changes_something(block["name"]),
        }
        figure = figure_of(block, result)
        if figure is not None:
            payload["figure"] = figure
        artifact = artifact_of(block, result)
        if artifact is not None:
            payload["artifact"] = artifact
        yield "tool_end", payload


def _with_missing_results(
    tool_uses: list[dict[str, Any]], results: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Every call answered: a stored call without a result breaks the conversation."""
    answered = {result["tool_use_id"] for result in results}
    return results + [
        _error_result(block["id"], INTERRUPTED)
        for block in tool_uses
        if block["id"] not in answered
    ]


def _done(
    model: CatalogModel,
    usage: TokenUsage,
    cost: Decimal,
    stop: Any,
    context_tokens: int,
) -> Event:
    return "done", {
        "model": model.id,
        "stop_reason": stop,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": usage.cache_read_input_tokens,
        "cache_creation_input_tokens": usage.cache_creation_input_tokens,
        "cost_usd": float(cost),
        "context_tokens": context_tokens,
    }


def run_conversation(  # noqa: C901
    client: Any,
    model: CatalogModel,
    system: str,
    toolbox: ToolBox,
    log: ConversationLog,
    history: list[dict[str, Any]],
) -> Iterator[Event]:
    """Call the model and its tools until it answers, yielding what happens."""
    import anthropic  # pylint: disable=import-outside-toplevel

    tools = toolbox.definitions(model.spec.tool_search)
    total_usage = TokenUsage()
    total_cost = Decimal(0)
    stop_reason = None
    context_tokens = 0

    for _call in range(MAX_MODEL_CALLS):
        call = ModelCall(client, request_params(model, system, tools, history))
        message = None
        try:
            for item in call.events():
                if isinstance(item, tuple):
                    yield item
                else:
                    message = item
        except anthropic.APIError as ex:
            yield error_event(ex)
            return
        finally:
            if message is None:
                _store_what_it_cost(call, log)

        turn = _turn_of(message)
        total_usage += turn.usage
        total_cost += turn.cost_usd
        stop_reason = turn.stop_reason
        context_tokens = turn.context_tokens

        if stop_reason == STOP_REFUSAL:
            log.add_turn(turn)
            yield (
                "refusal",
                {
                    "message": _(
                        "The AI declined to answer this. Try asking in another way."
                    ),
                },
            )
            break

        tool_uses = tool_uses_of(turn.content)
        awaiting = [
            {"id": block["id"], "title": toolbox.title(block["name"])}
            for block in tool_uses
            if toolbox.needs_confirmation(block["name"])
        ]
        if stop_reason == "tool_use" and awaiting:
            # Nothing of this turn runs yet: the calls of one turn answer together
            log.add_turn(turn, awaiting=awaiting)
            titles = {call["id"]: call["title"] for call in awaiting}
            for block in tool_uses:
                if block["id"] in titles:
                    yield "confirm", confirmation_json(block, titles[block["id"]])
            break

        if stop_reason == "tool_use" and tool_uses:
            results: list[dict[str, Any]] = []
            try:
                yield from _run_tools(tool_uses, toolbox, results)
            finally:
                # Also when the turn stops here: the tools have run
                results = _with_missing_results(tool_uses, results)
                log.add_turn(turn, results)
            history.append(
                {"role": "assistant", "content": content_to_send(turn.content)}
            )
            history.append({"role": "user", "content": results})
            continue

        if stop_reason == "pause_turn":
            log.add_turn(turn)
            history.append(
                {"role": "assistant", "content": content_to_send(turn.content)}
            )
            continue

        # A call cut by the output limit is incomplete: it must not run
        log.add_turn(
            turn,
            _with_missing_results(tool_uses, []) if tool_uses else None,
        )
        if stop_reason == "max_tokens":
            yield (
                "error",
                {
                    "code": "too_long",
                    "message": _("The answer was too long and was cut. Ask for less."),
                },
            )
        if stop_reason == STOP_CONTEXT_WINDOW:
            yield context_exceeded_event()
        break
    else:
        yield (
            "error",
            {
                "code": "too_many_steps",
                "message": _("This took too many steps. Ask for something smaller."),
            },
        )

    yield _done(model, total_usage, total_cost, stop_reason, context_tokens)


def resume_after_decisions(  # pylint: disable=too-many-arguments
    client: Any,
    model: CatalogModel,
    system: str,
    toolbox: ToolBox,
    log: ConversationLog,
    conversation_of: Callable[[], AssistantConversation],
    pending: PendingTurn,
) -> Iterator[Event]:
    """
    Run a turn the person has decided on, as stored, and let the model go on. The
    conversation is read after the tools run, because they end the session they share.
    """
    results: list[dict[str, Any]] = []
    try:
        yield from _run_tools(pending.calls, toolbox, results, pending.decisions)
    finally:
        log.add_results(_with_missing_results(pending.calls, results))
    yield from run_conversation(
        client, model, system, toolbox, log, history_of(conversation_of())
    )
