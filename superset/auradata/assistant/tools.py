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
The tools of the assistant: those of the MCP, in this process, as the person asking.

``ToolBox`` builds, once per request, the exact set of tools a user gets in a mode,
and that set is the only gate for a tool name: what the model asks for outside it
never reaches the MCP. Each call then goes through the real tool, in a real MCP
session held in memory, under ``run_as``: the wrapper of the tool checks permissions
for that user and the tool applies the fork rules (``can_edit_resource``, workspace
grants, one dashboard per chart, row level security, version history).

The FastMCP middleware does not run in the web process, so this module caps the size
of results and hides internal errors, as the size guard and the error handler do on
the MCP server.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from flask import current_app, g

from superset.security.api_key_scopes import METHOD_PERMISSION_SCOPE_ACTION

logger = logging.getLogger(__name__)

MODE_READ = "read"
MODE_EDIT = "edit"
MODES = (MODE_READ, MODE_EDIT)

# Read mode holds the same restriction as an API key with this scope, so a write is
# refused by the wrapper of the tool as well as by the offered set
READ_SCOPES = frozenset({"superset:read"})

TOOL_SEARCH_NAME = "tool_search_tool_bm25"
TOOL_SEARCH = {"type": "tool_search_tool_bm25_20251119", "name": TOOL_SEARCH_NAME}

# Loaded on every request, in this order: report structure, datasets, queries and
# captures. The others wait behind the search tool. Their schemas are small; those
# of the chart tools take about 44 KB each.
FIXED_TOOLS = (
    "get_report_structure",
    "get_dashboard_info",
    "get_dashboard_datasets",
    "list_datasets",
    "get_dataset_info",
    "query_dataset",
    "get_chart_data",
    "get_dashboard_screenshot",
    "get_visual_screenshot",
)

# About the service itself, or a file for a person that the model cannot hand over
HIDDEN_TOOLS = frozenset(
    {
        "export_dashboard_image",
        "export_dashboard_pdf",
        "generate_bug_report",
        "health_check",
    }
)

MAX_RESULT_CHARS = 100_000
# The limits of an image on the API, in base64 where it is smaller on some platforms
MAX_IMAGE_BASE64_CHARS = 5_000_000
IMAGE_TYPES = frozenset({"image/gif", "image/jpeg", "image/png", "image/webp"})
EMPTY_RESULT = "The tool returned nothing."


@dataclass(frozen=True)
class ToolOutcome:
    """A result of a tool, ready for a ``tool_result`` block."""

    content: list[dict[str, Any]]
    is_error: bool = False


def _text_block(text: str) -> dict[str, Any]:
    """
    A text block the API takes: it refuses empty ones, and a conversation that stored
    one would fail on every later request.
    """
    return {"type": "text", "text": text if text.strip() else EMPTY_RESULT}


def _error(text: str) -> ToolOutcome:
    return ToolOutcome([_text_block(text)], is_error=True)


def _is_read_tool(tool: Any) -> bool:
    """
    A tool that only reads. The annotation alone is not enough: some tools marked
    read only ask for a write permission, like those that test a connection.
    """
    from superset.mcp_service.auth import METHOD_PERMISSION_ATTR

    method = getattr(tool.fn, METHOD_PERMISSION_ATTR, "read")
    annotations = tool.annotations
    return (
        METHOD_PERMISSION_SCOPE_ACTION.get(method) == "read"
        and annotations is not None
        and annotations.readOnlyHint is True
        and "mutate" not in tool.tags
    )


def _needs_confirmation(tool: Any) -> bool:
    """
    A tool that must be confirmed on screen before it runs: deleting, overwriting,
    publishing, sharing or scheduling. There is no such screen yet, so these are not
    offered in any mode.
    """
    if _is_read_tool(tool):
        return False
    annotations = tool.annotations
    return (
        annotations is None
        or annotations.destructiveHint is not False
        or "sharing" in tool.tags
    )


def _allowed_in_mode(tool: Any, mode: str) -> bool:
    if tool.name in HIDDEN_TOOLS or _needs_confirmation(tool):
        return False
    return mode == MODE_EDIT or _is_read_tool(tool)


def _definition(tool: Any, deferred: bool) -> dict[str, Any]:
    definition = {
        "name": tool.name,
        "description": tool.description or "",
        "input_schema": tool.parameters,
    }
    if deferred:
        definition["defer_loading"] = True
    return definition


def _block_of(item: Any) -> dict[str, Any]:
    """One MCP content item as a block of ``tool_result``."""
    if getattr(item, "type", None) == "image":
        if item.mimeType not in IMAGE_TYPES:
            return _text_block("The tool returned an image of an unsupported type.")
        if len(item.data) > MAX_IMAGE_BASE64_CHARS:
            return _text_block("The image is too large to show.")
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": item.mimeType,
                "data": item.data,
            },
        }
    text = getattr(item, "text", None)
    if text is None:
        return {
            "type": "text",
            "text": "The tool returned content that cannot be read.",
        }
    if len(text) > MAX_RESULT_CHARS:
        return _text_block(
            f"{text[:MAX_RESULT_CHARS]}\n\n[Cut at {MAX_RESULT_CHARS} characters of "
            f"{len(text)}: ask for less, with filters or a smaller page.]"
        )
    return _text_block(text)


def _safe_error_text(content: list[Any]) -> str:
    from superset.mcp_service.utils.error_sanitization import (
        _sanitize_validation_error,
    )

    text = " ".join(str(getattr(item, "text", "")) for item in content)
    return _sanitize_validation_error(Exception(text), log_original=False)


class ToolBox:
    """The tools one user has in one mode, for the length of one request."""

    def __init__(self, username: str, mode: str) -> None:
        from superset.mcp_service.auth import InProcessPrincipal

        self._mode = mode
        self._principal = InProcessPrincipal(
            username, READ_SCOPES if mode == MODE_READ else None
        )
        registered = self._registered()
        self._tools = {tool.name: tool for tool in self._offered(registered)}
        self.unavailable = frozenset(
            tool.name for tool in registered if tool.name not in self._tools
        )

    @staticmethod
    def _registered() -> Sequence[Any]:
        from superset.mcp_service.app import mcp

        return asyncio.run(mcp.list_tools(run_middleware=False))

    def _offered(self, registered: Sequence[Any]) -> list[Any]:
        from superset.mcp_service.app import feature_disabled_tools
        from superset.mcp_service.auth import is_tool_visible_to_current_user, run_as

        disabled = set(current_app.config.get("MCP_DISABLED_TOOLS") or ())
        disabled |= feature_disabled_tools()
        with run_as(self._principal):
            return [
                tool
                for tool in registered
                if tool.name not in disabled
                and _allowed_in_mode(tool, self._mode)
                and is_tool_visible_to_current_user(tool)
            ]

    @property
    def names(self) -> frozenset[str]:
        """Every tool name this request accepts."""
        return frozenset(self._tools)

    def definitions(self, tool_search: bool) -> list[dict[str, Any]]:
        """
        The ``tools`` of the request, in the same order every time: the prompt cache
        is a match on bytes. Without tool search only the fixed group is offered.
        """
        fixed = [
            _definition(self._tools[name], deferred=False)
            for name in FIXED_TOOLS
            if name in self._tools
        ]
        if not tool_search:
            return fixed
        deferred = [
            _definition(self._tools[name], deferred=True)
            for name in sorted(self._tools)
            if name not in FIXED_TOOLS
        ]
        return [TOOL_SEARCH, *fixed, *deferred]

    def call(self, name: str, arguments: Any) -> ToolOutcome:
        """Run a tool the model asked for, as the user. Failures become a result."""
        if name not in self._tools:
            logger.warning("Assistant refused a tool it does not offer: %r", name)
            return _error(f"The tool {name!r} is not available here.")
        if not isinstance(arguments, dict):
            return _error("The input of a tool must be an object.")

        from superset.mcp_service.auth import run_as

        previous_user = g.get("user")
        try:
            with run_as(self._principal):
                result = asyncio.run(self._call_tool(name, arguments))
        except Exception:  # pylint: disable=broad-except
            logger.exception("Assistant tool %s failed", name)
            return _error("The tool failed. Try again or ask for something else.")
        finally:
            # The tool leaves in g.user its own copy, bound to its own session
            g.user = previous_user
        if result.is_error:
            return _error(_safe_error_text(result.content))
        blocks = [_block_of(item) for item in result.content]
        return ToolOutcome(blocks or [_text_block("")])

    @staticmethod
    async def _call_tool(name: str, arguments: dict[str, Any]) -> Any:
        from fastmcp import Client

        from superset.mcp_service.app import mcp

        async with Client(mcp) as client:
            return await client.call_tool(name, arguments, raise_on_error=False)
