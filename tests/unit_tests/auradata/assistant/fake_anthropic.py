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
A fake Anthropic for tests: the real SDK over a scripted transport.

Nothing leaves the process, and the code under test still goes through the SDK's own
stream parsing and request building, so tests read the request as it would go on the
wire and responses come back with the SDK's real types.
"""

from typing import Any

import anthropic
import httpx2

from superset.utils import json

USAGE = {"input_tokens": 100, "output_tokens": 20}


def text(value: str) -> dict[str, Any]:
    return {"type": "text", "text": value}


def thinking(value: str, signature: str) -> dict[str, Any]:
    return {"type": "thinking", "thinking": value, "signature": signature}


def tool_use(
    name: str, tool_input: dict[str, Any], tool_id: str = "toolu_1"
) -> dict[str, Any]:
    return {"type": "tool_use", "id": tool_id, "name": name, "input": tool_input}


def reply(
    *content: dict[str, Any],
    stop_reason: str = "end_turn",
    model: str = "claude-sonnet-5-5",
    usage: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "content": list(content),
        "stop_reason": stop_reason,
        "model": model,
        "usage": usage or USAGE,
    }


def _event(name: str, **data: Any) -> str:
    return f"event: {name}\ndata: {json.dumps({'type': name, **data})}\n\n"


def _block_events(index: int, block: dict[str, Any]) -> list[str]:
    kind = block["type"]
    start: dict[str, Any]
    delta: dict[str, Any]
    if kind == "text":
        start, delta = (
            {"type": "text", "text": ""},
            {
                "type": "text_delta",
                "text": block["text"],
            },
        )
    elif kind == "tool_use":
        start = {**block, "input": {}}
        delta = {
            "type": "input_json_delta",
            "partial_json": json.dumps(block["input"]),
        }
    elif kind == "thinking":
        start = {"type": "thinking", "thinking": "", "signature": ""}
        return [
            _event("content_block_start", index=index, content_block=start),
            _event(
                "content_block_delta",
                index=index,
                delta={"type": "thinking_delta", "thinking": block["thinking"]},
            ),
            _event(
                "content_block_delta",
                index=index,
                delta={"type": "signature_delta", "signature": block["signature"]},
            ),
            _event("content_block_stop", index=index),
        ]
    else:
        # Server blocks arrive whole
        return [
            _event("content_block_start", index=index, content_block=block),
            _event("content_block_stop", index=index),
        ]
    return [
        _event("content_block_start", index=index, content_block=start),
        _event("content_block_delta", index=index, delta=delta),
        _event("content_block_stop", index=index),
    ]


def _stream_of(message: dict[str, Any]) -> str:
    usage = message["usage"]
    events = [
        _event(
            "message_start",
            message={
                "id": "msg_1",
                "type": "message",
                "role": "assistant",
                "model": message["model"],
                "content": [],
                "stop_reason": None,
                "stop_sequence": None,
                "usage": {
                    key: value for key, value in usage.items() if key != "iterations"
                },
            },
        ),
    ]
    for index, block in enumerate(message["content"]):
        events.extend(_block_events(index, block))
    events.append(
        _event(
            "message_delta",
            delta={
                "stop_reason": message["stop_reason"],
                "stop_sequence": None,
            },
            usage=usage,
        )
    )
    events.append(_event("message_stop"))
    return "".join(events)


class FakeAnthropic:
    """Answers each request with the next of ``script``: a reply or an error status."""

    def __init__(self, *script: dict[str, Any] | tuple[int, str]) -> None:
        self.script = list(script)
        self.requests: list[dict[str, Any]] = []
        self.headers: list[Any] = []
        self.client = anthropic.Anthropic(
            api_key="test-key",
            max_retries=0,
            http_client=anthropic.DefaultHttpxClient(
                transport=httpx2.MockTransport(self._answer)
            ),
        )

    def _answer(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(json.loads(request.content))
        self.headers.append(request.headers)
        step = self.script.pop(0)
        if isinstance(step, tuple):
            status, kind = step
            return httpx2.Response(
                status,
                json={"type": "error", "error": {"type": kind, "message": kind}},
            )
        return httpx2.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=_stream_of(step).encode(),
        )
