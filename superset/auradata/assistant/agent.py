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

Tool inputs are not streamed eagerly: with that option the API stops checking them,
and these tools write as the user.

``anthropic`` is imported where it is used: the web app must start without it.
"""

from __future__ import annotations

import logging
import queue
import threading
from collections.abc import Iterator
from decimal import Decimal
from typing import Any

from flask import current_app
from flask_babel import gettext as _

from superset.auradata.assistant.conversations import (
    AssistantTurn,
    content_to_send,
    ConversationLog,
    STOP_REFUSAL,
)
from superset.auradata.assistant.models import (
    CatalogModel,
    cost_of_message,
    TokenUsage,
)
from superset.auradata.assistant.tools import ToolBox

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 64_000
# Calls to the API for one message of the user
MAX_MODEL_CALLS = 25
INTERRUPTED = "The tool did not run: the request ended first."
# Seconds without a byte before the stream says it is alive: under the 60 of a proxy
KEEP_ALIVE_SECONDS = 15.0
# An event with no meaning for the panel: it only keeps the connection open
KEEP_ALIVE = "keep_alive"

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


def _is_kind(ex: Any, status: int, kind: str) -> bool:
    """By status or, for an error in the middle of a stream, by its type."""
    return (
        getattr(ex, "status_code", None) == status or getattr(ex, "type", None) == kind
    )


def error_event(ex: Exception) -> Event:
    """What the user reads when a call to the API fails."""
    import anthropic  # pylint: disable=import-outside-toplevel

    logger.warning(
        "Assistant call failed: %s, request %s",
        type(ex).__name__,
        getattr(ex, "request_id", None),
    )
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


def _stream_model(client: Any, params: dict[str, Any]) -> Iterator[Event | Any]:
    with client.beta.messages.stream(**params) as stream:
        for event in stream:
            if event.type == "text":
                yield "text", {"text": event.text}
        yield stream.get_final_message()


def _call_model(client: Any, params: dict[str, Any]) -> Iterator[Event | Any]:
    """
    Text as it arrives, as events, and the final message last.

    While the model thinks nothing arrives: the thinking is not displayed and the SDK
    drops the pings. So the call waits in a thread of its own, and this side yields
    ``KEEP_ALIVE`` when the wait gets long. That thread only runs the HTTP call of the
    SDK: the session, ``g`` and the tools stay in the thread of the request.
    """
    items: queue.Queue[tuple[str, Any]] = queue.Queue()
    leaving = threading.Event()

    def pump() -> None:
        stream = _stream_model(client, params)
        try:
            for item in stream:
                items.put(("item", item))
                if leaving.is_set():
                    break
            items.put(("end", None))
        except Exception as ex:  # pylint: disable=broad-except
            items.put(("failed", ex))
        finally:
            stream.close()

    threading.Thread(target=pump, daemon=True, name="assistant-model").start()
    try:
        while True:
            try:
                kind, value = items.get(timeout=KEEP_ALIVE_SECONDS)
            except queue.Empty:
                yield KEEP_ALIVE, {}
                continue
            if kind == "end":
                return
            if kind == "failed":
                raise value
            yield value
    finally:
        # The browser left: nobody reads what the model is still writing
        leaving.set()


def _turn_of(message: Any) -> AssistantTurn:
    """A response as it came: ``to_dict`` keeps the API's own field names and values."""
    usage, cost = cost_of_message(message.model, message.usage)
    return AssistantTurn(
        content=[block.to_dict(mode="json") for block in message.content],
        model=message.model,
        stop_reason=message.stop_reason,
        usage=usage,
        cost_usd=cost,
    )


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


def _run_tools(
    tool_uses: list[dict[str, Any]],
    toolbox: ToolBox,
    results: list[dict[str, Any]],
) -> Iterator[Event]:
    for block in tool_uses:
        yield "tool_start", {"id": block["id"], "name": block["name"]}
        outcome = toolbox.call(block["name"], block.get("input"))
        results.append(_result_block(block["id"], outcome))
        yield (
            "tool_end",
            {
                "id": block["id"],
                "name": block["name"],
                "is_error": outcome.is_error,
            },
        )


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


def _done(model: CatalogModel, usage: TokenUsage, cost: Decimal, stop: Any) -> Event:
    return "done", {
        "model": model.id,
        "stop_reason": stop,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
        "cache_read_input_tokens": usage.cache_read_input_tokens,
        "cache_creation_input_tokens": usage.cache_creation_input_tokens,
        "cost_usd": float(cost),
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

    for _call in range(MAX_MODEL_CALLS):
        params = request_params(model, system, tools, history)
        try:
            message = None
            for item in _call_model(client, params):
                if isinstance(item, tuple):
                    yield item
                else:
                    message = item
        except anthropic.APIError as ex:
            yield error_event(ex)
            return

        turn = _turn_of(message)
        total_usage += turn.usage
        total_cost += turn.cost_usd
        stop_reason = turn.stop_reason

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

        tool_uses = [
            block
            for block in content_to_send(turn.content)
            if block["type"] == "tool_use"
        ]
        if stop_reason == "tool_use" and tool_uses:
            results: list[dict[str, Any]] = []
            try:
                yield from _run_tools(tool_uses, toolbox, results)
            finally:
                # Also when the browser leaves: the tools have run
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
        break
    else:
        yield (
            "error",
            {
                "code": "too_many_steps",
                "message": _("This took too many steps. Ask for something smaller."),
            },
        )

    yield _done(model, total_usage, total_cost, stop_reason)
