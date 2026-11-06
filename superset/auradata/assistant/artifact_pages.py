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
A document of the assistant as pages of its report.

Nothing here writes to a report: it decides what a document becomes and asks the normal
tools for it, through ``ToolBox`` and as the person (``add_page``, ``add_element`` and
``create_visual``), so one chart per dashboard, the cells of the canvas, the permissions
and the version history hold because those tools hold them. The person approved the
whole of it on a card, which says what will be created (``save_title``).

A text block becomes a text element and a block of data a real chart of the report, with
its filters. A page is a fixed size, so a document that does not fit goes on to more
pages (``page_plan``). A query goes across only if a chart says exactly the same: a
block that cannot stays out of the report, which the result names, and is never saved
without one of its filters.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from flask_babel import gettext as _, ngettext

from superset.auradata.layout import CELL
from superset.utils import json
from superset.utils.core import markdown

FIGURE_HEIGHT = 7
CHART_HEIGHT = 13
TABLE_HEIGHT = 13
MAX_FIGURES_IN_A_ROW = 4
CHARTS_IN_A_ROW = 2
MAX_PAGES = 5

# What a line of a text element takes at its default size, in pixels
CHAR_WIDTH = 9
LINE_HEIGHT = 26
TEXT_PADDING = 16

NUMBER_FORMATS = {
    "number": ",.0f",
    "compact": ".3~s",
    "percent": ",.1%",
    "currency": "$,.2f",
}
# The operators of a query that a chart spec writes another way, or not at all
SAME_OPERATORS = frozenset(
    {
        "!=",
        ">",
        "<",
        ">=",
        "<=",
        "LIKE",
        "ILIKE",
        "NOT LIKE",
        "IN",
        "NOT IN",
        "IS NULL",
        "IS NOT NULL",
    }
)
TIME_OPERATOR = "TEMPORAL_RANGE"

# All the tools a saved document goes through: the card approved these, and only these
PAGE_TOOLS = frozenset(
    {
        "get_report_structure",
        "add_page",
        "add_element",
        "create_visual",
        "set_visual_sort",
    }
)

ToolCall = Callable[[str, dict[str, Any]], Any]


class PageSaveError(Exception):
    """A document that cannot become pages. Its text says why, for the model."""


class NotAChartError(Exception):
    """A query no chart spec says exactly."""


@dataclass(frozen=True)
class Placement:
    """Where a block goes on its page, in cells."""

    block: dict[str, Any]
    x: int
    y: int
    width: int
    height: int


def _text_height(text: str, columns: int) -> int:
    per_line = max(columns * CELL // CHAR_WIDTH, 1)
    lines = sum(max(math.ceil(len(line) / per_line), 1) for line in text.split("\n"))
    return math.ceil((lines * LINE_HEIGHT + TEXT_PADDING) / CELL)


def _height(block: dict[str, Any], columns: int, rows: int) -> int:
    if block["type"] == "text":
        return min(_text_height(block["text"], columns), rows)
    heights = {"figure": FIGURE_HEIGHT, "chart": CHART_HEIGHT}
    return min(heights.get(block["type"], TABLE_HEIGHT), rows)


def _rows_of(blocks: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Figures that follow each other share a row, and so do two charts."""
    room = {"figure": MAX_FIGURES_IN_A_ROW, "chart": CHARTS_IN_A_ROW}
    rows: list[list[dict[str, Any]]] = []
    for block in blocks:
        last = rows[-1] if rows else None
        kind = block["type"]
        if last and last[0]["type"] == kind and len(last) < room.get(kind, 1):
            last.append(block)
        else:
            rows.append([block])
    return rows


def page_plan(
    blocks: list[dict[str, Any]], columns: int, rows: int
) -> list[list[Placement]]:
    """
    The blocks of a document on pages of this size, in reading order: each block has
    room of its own, and what does not fit starts the next page.
    """
    pages: list[list[Placement]] = [[]]
    top = 0
    for row in _rows_of(blocks):
        height = max(_height(block, columns, rows) for block in row)
        if top + height > rows and pages[-1]:
            pages.append([])
            top = 0
        width = columns // len(row)
        pages[-1].extend(
            Placement(block, index * width, top, width, height)
            for index, block in enumerate(row)
        )
        top += height
    return pages


def _metric(query: dict[str, Any]) -> list[dict[str, Any]]:
    """The numbers of a query, as a chart spec names them."""
    saved = [{"name": item, "saved_metric": True} for item in query.get("metrics", [])]
    aggregates = [
        {
            "name": item["column"],
            "aggregate": item["aggregate"],
            "label": item.get("label") or f"{item['aggregate']}({item['column']})",
        }
        for item in query.get("aggregates", [])
    ]
    return [*saved, *aggregates]


def _filters(query: dict[str, Any]) -> list[dict[str, Any]]:
    """The filters of a query, or refused if one of them has no exact equivalent."""
    filters = []
    for item in query.get("filters", []):
        if item["op"] == TIME_OPERATOR:
            continue
        if item["op"] != "==" and item["op"] not in SAME_OPERATORS:
            raise NotAChartError(item["op"])
        filters.append(
            {
                "column": item["col"],
                "op": "=" if item["op"] == "==" else item["op"],
                **({"value": item["val"]} if item.get("val") is not None else {}),
            }
        )
    return filters


def _time_filters(query: dict[str, Any]) -> list[dict[str, str]]:
    """The time ranges of a query: one of its own, and those among its filters."""
    ranges = [
        {"column": item["col"], "range": item["val"]}
        for item in query.get("filters", [])
        if item["op"] == TIME_OPERATOR
    ]
    if query.get("time_range") and query.get("time_column"):
        ranges.append({"column": query["time_column"], "range": query["time_range"]})
    return ranges


def _chart_spec(block: dict[str, Any]) -> dict[str, Any]:
    """The spec of a chart block, as ``create_visual`` takes it."""
    query = block["query"]
    columns = query.get("columns", [])
    metrics = _metric(query)
    filters = _filters(query)
    if block["chart"] == "pie":
        return {
            "chart_type": "pie",
            "dimension": {"name": columns[0]},
            "metric": metrics[0],
            "filters": filters,
            "row_limit": query.get("row_limit", 30),
        }
    return {
        "chart_type": "xy",
        "kind": block["chart"],
        "x": {"name": columns[0]},
        "y": metrics,
        "group_by": [{"name": column} for column in columns[1:]] or None,
        "legend": {"show": len(metrics) > 1 or len(columns) > 1},
        "filters": filters,
        "row_limit": query.get("row_limit", 30),
    }


def _table_spec(block: dict[str, Any]) -> dict[str, Any]:
    query = block["query"]
    metrics = _metric(query)
    order = query.get("order_by") or []
    return {
        "chart_type": "table",
        "query_mode": "aggregate" if metrics else "raw",
        "columns": [*({"name": name} for name in query.get("columns", [])), *metrics],
        "filters": _filters(query),
        "row_limit": query.get("row_limit", 30),
        "sort_by": [
            {"column": name, "ascending": not query.get("order_desc", True)}
            for name in order
        ]
        or None,
    }


def _figure_spec(block: dict[str, Any]) -> dict[str, Any]:
    query = block["query"]
    return {
        "chart_type": "big_number",
        "metric": _metric(query)[0],
        "subheader": block["label"],
        "y_axis_format": NUMBER_FORMATS[block.get("format", "number")],
        "filters": _filters(query),
    }


def visual_of(block: dict[str, Any]) -> dict[str, Any]:
    """What ``create_visual`` needs for a block of data, but its place."""
    specs = {"figure": _figure_spec, "chart": _chart_spec, "table": _table_spec}
    query = block["query"]
    request = {
        "dataset_id": query["dataset_id"],
        "config": specs[block["type"]](block),
        "chart_name": block.get("title") or block["label"],
    }
    if ranges := _time_filters(query):
        request["time_filters"] = ranges
    return request


def text_settings(block: dict[str, Any]) -> dict[str, Any]:
    """What ``add_element`` needs for a text block, through the sanitized Markdown."""
    return {"html": markdown(block["text"])}


def plain_result(outcome: Any) -> dict[str, Any]:
    """What a tool answered. A refusal says why, as the tool wrote it."""
    text = outcome.content[0]["text"]
    if outcome.is_error:
        raise PageSaveError(text)
    result = json.loads(text)
    if result.get("error"):
        raise PageSaveError(result["error"])
    return result


def _left_out_name(block: dict[str, Any]) -> str:
    return block.get("title") or block.get("label") or _("A text")


def _place_block(
    call: ToolCall, dashboard_id: int, page: str, placement: Placement
) -> None:
    box = {
        "dashboard": dashboard_id,
        "page": page,
        "x": placement.x,
        "y": placement.y,
        "width": placement.width,
        "height": placement.height,
    }
    block = placement.block
    if block["type"] == "text":
        plain_result(
            call(
                "add_element",
                {
                    "request": {
                        **box,
                        "kind": "text",
                        "settings": text_settings(block),
                    }
                },
            )
        )
        return
    created = plain_result(
        call("create_visual", {"request": {**box, **visual_of(block)}})
    )
    order = block["query"].get("order_by")
    if block["type"] == "chart" and order:
        # Not part of what the numbers are: a sort a chart refuses leaves it readable
        call(
            "set_visual_sort",
            {
                "request": {
                    "dashboard": dashboard_id,
                    "object": created["object_id"],
                    "by": order[0],
                    "ascending": not block["query"].get("order_desc", True),
                }
            },
        )


def save_pages(
    call: ToolCall, dashboard_id: int, title: str, blocks: list[dict[str, Any]]
) -> dict[str, Any]:
    """
    Create the pages of a document, block by block. A block the tools refuse stays out
    and the result names it, so what was created is still there to undo.
    """
    report = plain_result(
        call(
            "get_report_structure",
            {"request": {"dashboard": dashboard_id, "include_format": False}},
        )
    )
    canvas = report["canvas"]
    plan = page_plan(blocks, canvas["width"], canvas["height"])
    if len(plan) > MAX_PAGES:
        raise PageSaveError(f"This document takes over {MAX_PAGES} pages.")
    pages = []
    left_out = []
    for index, placements in enumerate(plan):
        name = title if index == 0 else f"{title} ({index + 1})"
        page = plain_result(
            call("add_page", {"request": {"dashboard": dashboard_id, "name": name}})
        )["page"]
        pages.append({"id": page, "name": name})
        for placement in placements:
            try:
                _place_block(call, dashboard_id, page, placement)
            except (PageSaveError, NotAChartError) as ex:
                left_out.append(
                    {"block": _left_out_name(placement.block), "why": str(ex)}
                )
    return {"pages": pages, "left_out": left_out}


def save_title(title: str, blocks: list[dict[str, Any]], pages: int) -> str:
    """What the card says this will create, in the language of the person."""
    where = ngettext(
        "Save «%(title)s» as %(num)d page of this report",
        "Save «%(title)s» as %(num)d pages of this report",
        pages,
        title=title,
    )
    what = ngettext("%(num)d new object", "%(num)d new objects", len(blocks))
    return f"{where}: {what}"
