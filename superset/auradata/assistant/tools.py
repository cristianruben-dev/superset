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

``ToolBox`` builds, once per turn, the exact set of tools a user gets in a mode,
and that set is the only gate for a tool name: what the model asks for outside it
never reaches the MCP. Each call then goes through the real tool, in a real MCP
session held in memory, under ``run_as``: the wrapper of the tool checks permissions
for that user and the tool applies the fork rules (``can_edit_resource``, workspace
grants, one dashboard per chart, row level security, version history).

Tools that delete, overwrite, publish, share, schedule, restore or move are offered in
edit mode, but ``ToolBox.call`` refuses them unless the person approved that exact call
on screen (``superset.auradata.assistant.agent``). That refusal holds whatever the loop
above it does. ``call`` is also the one place every tool passes through, so it is where
the assistant leaves its mark: the saves of a call say which model made them
(``acting_model``), and each call is a row of the action log, because the MCP service
that writes those rows for an outside AI does not run here.

Besides those, every person gets the tools of the assistant's own documents
(``artifact_tools.py``), outside the MCP catalog, and ``call`` runs them here, as the
person of the turn. They change no report and need no card, in both modes, but for the
one that saves a document as pages: that one is for edit mode and waits for a card, and
what the person approved there runs through the tools of the report, one by one.

The FastMCP middleware does not run in-process, so this module caps the size
of results and hides internal errors, as the size guard and the error handler do on
the MCP server.
"""

from __future__ import annotations

import asyncio
import contextvars
import logging
import time
from collections.abc import Coroutine, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from flask import current_app, g

from superset import security_manager
from superset.auradata.action_log import ASSISTANT_TOOL_CALL
from superset.auradata.assistant.artifacts import ARTIFACT_TOOLS, EDIT_ONLY_TOOLS
from superset.extensions import db, event_logger
from superset.security.api_key_scopes import METHOD_PERMISSION_SCOPE_ACTION
from superset.utils.core import get_user_id, override_user
from superset.versioning.changes import acting_model

logger = logging.getLogger(__name__)

MODE_READ = "read"
MODE_EDIT = "edit"
MODES = (MODE_READ, MODE_EDIT)

# Read mode holds the same restriction as an API key with this scope, so a write is
# refused by the wrapper of the tool as well as by the offered set
READ_SCOPES = frozenset({"superset:read"})

TOOL_SEARCH_NAME = "tool_search_tool_bm25"
TOOL_SEARCH = {"type": "tool_search_tool_bm25_20251119", "name": TOOL_SEARCH_NAME}

# Marked as harmless by their annotations, but they replace a report's content or move
# it where other people see it, so a person approves them as well
CONFIRM_TOOLS = frozenset(
    {
        "move_dashboard_to_workspace",
        "move_dataset_to_workspace",
        "restore_chart",
        "restore_dashboard",
        "restore_dataset",
        "restore_version",
    }
)

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


def run_coroutine(coroutine: Coroutine[Any, Any, Any]) -> Any:
    """
    Run an MCP call and wait for it. Sync Playwright leaves a loop running on the thread
    that took a screenshot, for as long as its browser lives, so a worker that served
    thumbnails cannot start one here: the call then takes a thread of its own, with the
    Flask context and the identity of this one, while this one waits.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coroutine)
    context = contextvars.copy_context()
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(context.run, asyncio.run, coroutine).result()


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
    publishing, sharing, scheduling, restoring or moving.
    """
    if _is_read_tool(tool):
        return False
    annotations = tool.annotations
    return (
        tool.name in CONFIRM_TOOLS
        or annotations is None
        or annotations.destructiveHint is not False
        or "sharing" in tool.tags
    )


def _allowed_in_mode(tool: Any, mode: str) -> bool:
    if tool.name in HIDDEN_TOOLS:
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
    """The tools one user has in one mode, for the length of one turn."""

    def __init__(
        self,
        username: str,
        mode: str,
        model: str | None = None,
        dashboard_id: int | None = None,
        user_id: int | None = None,
    ) -> None:
        from superset.mcp_service.auth import InProcessPrincipal

        self._user_id = user_id
        self._mode = mode
        self._model = model
        self._dashboard_id = dashboard_id
        # Known once the conversation exists, after the tools are built
        self.conversation_id: str | None = None
        self._principal = InProcessPrincipal(
            username, READ_SCOPES if mode == MODE_READ else None, user_id
        )
        registered = self._registered()
        self._tools = {tool.name: tool for tool in self._offered(registered)}
        self.unavailable = frozenset(
            tool.name for tool in registered if tool.name not in self._tools
        )

    @staticmethod
    def _registered() -> Sequence[Any]:
        from superset.mcp_service.app import mcp

        return run_coroutine(mcp.list_tools(run_middleware=False))

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
        own = ARTIFACT_TOOLS if self._editing else ARTIFACT_TOOLS - EDIT_ONLY_TOOLS
        return frozenset(self._tools) | own

    @property
    def _editing(self) -> bool:
        return self._mode == MODE_EDIT

    def definitions(self, tool_search: bool) -> list[dict[str, Any]]:
        """
        The ``tools`` of the request, in the same order every time: the prompt cache
        is a match on bytes. Without tool search only the fixed group is offered, with
        the tools of the assistant's own documents, which never wait behind a search.
        """
        from superset.auradata.assistant.artifact_tools import own_definitions

        fixed = [
            *(
                _definition(self._tools[name], deferred=False)
                for name in FIXED_TOOLS
                if name in self._tools
            ),
            *own_definitions(self._editing),
        ]
        if not tool_search:
            return fixed
        deferred = [
            _definition(self._tools[name], deferred=True)
            for name in sorted(self._tools)
            if name not in FIXED_TOOLS
        ]
        return [TOOL_SEARCH, *fixed, *deferred]

    def needs_confirmation(self, name: str) -> bool:
        """Whether this tool waits for a decision of the person before it runs."""
        if name in EDIT_ONLY_TOOLS:
            return True
        tool = self._tools.get(name)
        return tool is not None and _needs_confirmation(tool)

    def changes_something(self, name: str) -> bool:
        """Whether a successful call to this tool may have changed a report."""
        if name in EDIT_ONLY_TOOLS:
            return True
        tool = self._tools.get(name)
        return tool is not None and not _is_read_tool(tool)

    def title(self, name: str, arguments: Any = None) -> str:
        """The name of a tool for a person. A card can say what this very call does."""
        if name in ARTIFACT_TOOLS:
            from superset.auradata.assistant.artifact_tools import card_title, OWN_TOOLS

            context = self._context() if name in EDIT_ONLY_TOOLS else None
            specific = (
                card_title(arguments, context)
                if context and isinstance(arguments, dict)
                else None
            )
            return specific or OWN_TOOLS[name].title
        tool = self._tools.get(name)
        annotations = tool.annotations if tool is not None else None
        return (annotations.title if annotations else None) or name

    def call(self, name: str, arguments: Any, *, approved: bool = False) -> ToolOutcome:
        """
        Run a tool the model asked for, as the user. Failures become a result.

        ``approved`` says the person approved this very call. Only the code that
        reads their stored decision passes it; nothing the model says can set it.
        """
        if name in ARTIFACT_TOOLS:
            if name in EDIT_ONLY_TOOLS and not (self._editing and approved):
                logger.warning("Assistant refused an unapproved call to %r", name)
                return _error(f"The tool {name!r} needs the approval of the user.")
            return self._call_own(name, arguments)
        if name not in self._tools:
            logger.warning("Assistant refused a tool it does not offer: %r", name)
            return _error(f"The tool {name!r} is not available here.")
        if self.needs_confirmation(name) and not approved:
            logger.warning("Assistant refused an unapproved call to %r", name)
            return _error(f"The tool {name!r} needs the approval of the user.")
        if not isinstance(arguments, dict):
            return _error("The input of a tool must be an object.")

        from superset.mcp_service.auth import run_as

        previous_user = g.get("user")
        user_id = self._user_id if self._user_id is not None else get_user_id()
        started = time.monotonic()
        try:
            with run_as(self._principal), acting_model(self._model):
                result = run_coroutine(self._call_tool(name, arguments))
        except Exception:  # pylint: disable=broad-except
            logger.exception("Assistant tool %s failed", name)
            self._log_call(name, arguments, user_id, started, success=False)
            return _error("The tool failed. Try again or ask for something else.")
        finally:
            # The tool leaves in g.user its own copy, bound to its own session
            g.user = previous_user
        self._log_call(name, arguments, user_id, started, not result.is_error)
        if result.is_error:
            return _error(_safe_error_text(result.content))
        blocks = [_block_of(item) for item in result.content]
        return ToolOutcome(blocks or [_text_block("")])

    def _context(self) -> Any | None:
        """Who a tool of the assistant acts for, or None when that is not known."""
        from superset.auradata.assistant.artifact_tools import OwnToolContext

        user_id = self._user_id if self._user_id is not None else get_user_id()
        if user_id is None or self.conversation_id is None or not self._dashboard_id:
            return None
        return OwnToolContext(
            user_id,
            UUID(self.conversation_id),
            self._dashboard_id,
            self._model,
            self._call_page_tool,
        )

    def _call_page_tool(self, name: str, arguments: dict[str, Any]) -> ToolOutcome:
        """
        A tool of the report for a saved document. The person approved the whole of it
        on the card of the call that runs this, which speaks for these tools alone.
        """
        from superset.auradata.assistant.artifact_pages import PAGE_TOOLS

        if name not in PAGE_TOOLS:
            return _error(f"The tool {name!r} needs the approval of the user.")
        return self.call(name, arguments, approved=True)

    def _call_own(self, name: str, arguments: Any) -> ToolOutcome:
        """
        Run a tool of the assistant's own documents, as the person of this turn. An MCP
        call ends the session it shares with the turn, so the person is read again, and
        whatever is not known stops here: there is nobody else to act as.
        """
        from superset.auradata.assistant.artifact_tools import run_own_tool

        if not isinstance(arguments, dict):
            return _error("The input of a tool must be an object.")
        context = self._context()
        user = (
            db.session.get(security_manager.user_model, context.user_id)
            if context
            else None
        )
        if context is None or user is None:
            return _error("Documents are not available here.")
        user_id = context.user_id
        previous_login = g.get("_login_user")
        started = time.monotonic()
        try:
            with override_user(user):
                g._login_user = user  # pylint: disable=protected-access
                text, failed = run_own_tool(name, arguments, context)
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()
            logger.exception("Assistant tool %s failed", name)
            text, failed = "The tool failed. Try again or ask for something else.", True
        finally:
            g._login_user = previous_login  # pylint: disable=protected-access
        self._log_call(name, arguments, user_id, started, not failed)
        return _error(text) if failed else ToolOutcome([_text_block(text)])

    def _log_call(
        self,
        name: str,
        arguments: dict[str, Any],
        user_id: int | None,
        started: float,
        success: bool,
    ) -> None:
        """One row of the action log for a call. It never gets in the way of a tool."""
        from superset.mcp_service.middleware import _sanitize_params

        try:
            params = _sanitize_params(arguments)
            if name in ARTIFACT_TOOLS:
                from superset.auradata.assistant.artifact_tools import log_params

                params = log_params(arguments)
            event_logger.log(
                user_id=user_id,
                action=ASSISTANT_TOOL_CALL,
                dashboard_id=self._dashboard_id,
                duration_ms=int((time.monotonic() - started) * 1000),
                slice_id=None,
                referrer=None,
                curated_payload={
                    "tool": name,
                    "model": self._model,
                    "mode": self._mode,
                    "conversation_id": self.conversation_id,
                    "params": params,
                    "success": success,
                },
            )
        except Exception:  # pylint: disable=broad-except
            logger.warning("The call to %s stayed out of the action log", name)

    @staticmethod
    async def _call_tool(name: str, arguments: dict[str, Any]) -> Any:
        from fastmcp import Client

        from superset.mcp_service.app import mcp

        async with Client(mcp) as client:
            return await client.call_tool(name, arguments, raise_on_error=False)
