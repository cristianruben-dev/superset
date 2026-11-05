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
The figures of an answer: what the panel draws from a ``query_dataset`` call.

Nothing is stored for a figure. It comes out of the call and its result, which every
conversation already keeps, so the stream and a conversation read later give the same
figure and the model has no say in where a number comes from: the dataset and the
filters are those of the query that ran.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from superset.utils import json

QUERY_TOOL = "query_dataset"
MAX_ROWS = 30
# The limit of ``query_dataset`` when the call sets none
DEFAULT_ROW_LIMIT = 1000


def _result_text(result: dict[str, Any]) -> str | None:
    blocks = result.get("content") or []
    if result.get("is_error") or len(blocks) != 1 or blocks[0].get("type") != "text":
        return None
    return blocks[0].get("text")


def figure_of(
    tool_use: dict[str, Any], tool_result: dict[str, Any]
) -> dict[str, Any] | None:
    """
    The figure of a stored call and its result, or None when it has none: another
    tool, a failed query, no rows, or a result cut for being too long.
    """
    if tool_use.get("name") != QUERY_TOOL:
        return None
    text = _result_text(tool_result)
    if text is None:
        return None
    try:
        response = json.loads(text)
    except ValueError:
        return None
    if not isinstance(response, dict) or not response.get("data"):
        return None
    request = tool_use.get("input") or {}
    rows = response["data"]
    return {
        "dataset_id": response.get("dataset_id"),
        "dataset_name": response.get("dataset_name"),
        "metrics": request.get("metrics") or [],
        "columns": request.get("columns") or [],
        "filters": response.get("applied_filters") or [],
        "order_by": request.get("order_by") or [],
        "order_desc": request.get("order_desc", True),
        "row_limit": request.get("row_limit", DEFAULT_ROW_LIMIT),
        "rows": rows[:MAX_ROWS],
        "row_count": len(rows),
        "from_dttm": response.get("from_dttm"),
        "to_dttm": response.get("to_dttm"),
    }


def figures_in(messages: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """The figures of a stored conversation, by the id of their tool call."""
    calls: dict[str, dict[str, Any]] = {}
    figures: dict[str, dict[str, Any]] = {}
    for message in messages:
        for block in message["content"]:
            if block.get("type") == "tool_use":
                calls[block["id"]] = block
            elif block.get("type") == "tool_result":
                call = calls.get(block["tool_use_id"])
                figure = figure_of(call, block) if call else None
                if figure is not None:
                    figures[block["tool_use_id"]] = figure
    return figures
