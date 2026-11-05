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

"""Scoped API keys reach every registered MCP tool through a mapped scope.

A personal API key («Conectar IA») may carry scopes such as
``superset:dashboard:read``. They only narrow what its owner can do, so every
tool must declare a resource and an action the scope map knows, and a tool
that changes something must require a write scope: otherwise a read-only key
could call it.
"""

import asyncio

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR
from superset.security.api_key_scopes import (
    METHOD_PERMISSION_SCOPE_ACTION,
    RESOURCE_SCOPE_NAME,
)

# Tools without an RBAC class. A scoped key reaches them only with the flat
# ``superset:read`` scope (``_token_scope_allows`` without a resource), so a key
# limited to some resources cannot call them.
_PERMISSIONLESS_TOOLS = {
    "find_users",
    "generate_bug_report",
    "get_instance_info",
    "get_schema",
    "health_check",
}

# Deliberate mismatches between a tool's hints and its scope action.
_READ_SCOPED_WRITERS = {
    # Stores a temporary explore form-data entry in the cache, nothing persisted.
    "generate_explore_link",
}
_WRITE_SCOPED_READERS = {
    # Runs the chart's SQL: needs SQL Lab execution, a write-class scope.
    "get_chart_sql",
    # Lists users to add to a workspace: only for those who may edit its members.
    "list_member_candidates",
    # Tests a stored connection: the REST test_connection route is a write one,
    # kept for those who manage connections.
    "test_database_connection",
}


def _registered_tools() -> list:
    return asyncio.run(mcp.list_tools())


def _is_mutating(tool) -> bool:
    annotations = tool.annotations
    read_only = getattr(annotations, "readOnlyHint", None) if annotations else None
    return read_only is False or "mutate" in (tool.tags or set())


def test_every_tool_declares_a_mapped_resource_and_action() -> None:
    unmapped: dict[str, str] = {}
    for tool in _registered_tools():
        func = tool.fn
        class_name = getattr(func, CLASS_PERMISSION_ATTR, None)
        method_name = getattr(func, METHOD_PERMISSION_ATTR, None)
        if class_name is None:
            if tool.name not in _PERMISSIONLESS_TOOLS:
                unmapped[tool.name] = "no class_permission_name"
            continue
        if class_name not in RESOURCE_SCOPE_NAME:
            unmapped[tool.name] = f"resource {class_name!r} has no scope"
        elif method_name not in METHOD_PERMISSION_SCOPE_ACTION:
            unmapped[tool.name] = f"method {method_name!r} has no scope action"
    assert unmapped == {}


def test_mutating_tools_require_a_write_scope() -> None:
    read_scoped_writers = sorted(
        tool.name
        for tool in _registered_tools()
        if _is_mutating(tool)
        and getattr(tool.fn, CLASS_PERMISSION_ATTR, None) is not None
        and METHOD_PERMISSION_SCOPE_ACTION.get(
            getattr(tool.fn, METHOD_PERMISSION_ATTR, "read")
        )
        != "write"
    )
    assert read_scoped_writers == sorted(_READ_SCOPED_WRITERS)


def test_read_only_tools_accept_a_read_scope() -> None:
    write_scoped_readers = sorted(
        tool.name
        for tool in _registered_tools()
        if not _is_mutating(tool)
        and getattr(tool.fn, CLASS_PERMISSION_ATTR, None) is not None
        and METHOD_PERMISSION_SCOPE_ACTION.get(
            getattr(tool.fn, METHOD_PERMISSION_ATTR, "read")
        )
        != "read"
    )
    assert write_scoped_readers == sorted(_WRITE_SCOPED_READERS)
