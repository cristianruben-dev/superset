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
Compact layout previews of dashboards, for the dashboard cards.

A preview is the first rows of the dashboard grid (or of its first tab): each row
is a list of cells with their grid width and height and what they hold (a chart's
viz type, a column of stacked cells, markdown...). The frontend draws it as a
miniature of the real dashboard, so cards show a preview without screenshots.
"""

from __future__ import annotations

from typing import Any, TypedDict

from superset.models.dashboard import Dashboard
from superset.utils import json

MAX_ROWS = 4
MAX_COLUMN_CELLS = 3


class PreviewCell(TypedDict, total=False):
    width: int
    height: int
    kind: str
    cells: list[PreviewCell]


def _content_root(layout: dict[str, Any]) -> dict[str, Any] | None:
    """The component whose children are the visible rows: the grid, or its first tab."""
    node = layout.get("GRID_ID")
    while node:
        children = [layout.get(child) or {} for child in node.get("children", [])]
        tabs = next((child for child in children if child.get("type") == "TABS"), None)
        if not tabs:
            return node
        first_tab = layout.get((tabs.get("children") or [None])[0]) or {}
        if not first_tab:
            return node
        node = first_tab
    return None


def _cell(
    layout: dict[str, Any], node: dict[str, Any], viz_types: dict[int, str]
) -> PreviewCell | None:
    meta = node.get("meta") or {}
    kind = node.get("type")
    if kind == "CHART":
        return {
            "width": int(meta.get("width") or 4),
            "height": int(meta.get("height") or 50),
            "kind": viz_types.get(meta.get("chartId") or 0, "chart"),
        }
    if kind == "MARKDOWN":
        return {
            "width": int(meta.get("width") or 4),
            "height": int(meta.get("height") or 50),
            "kind": "markdown",
        }
    if kind == "COLUMN":
        cells = [
            cell
            for child in node.get("children", [])
            if (cell := _cell(layout, layout.get(child) or {}, viz_types))
        ][:MAX_COLUMN_CELLS]
        if not cells:
            return None
        return {
            "width": int(meta.get("width") or 4),
            "height": sum(cell.get("height", 50) for cell in cells),
            "kind": "column",
            "cells": cells,
        }
    return None


def dashboard_preview(dashboard: Dashboard) -> list[list[PreviewCell]]:
    """
    Summarize a dashboard layout for its card preview.

    :param dashboard: The dashboard
    :returns: Up to MAX_ROWS rows of cells; empty when the layout cannot be read
    """
    try:
        layout = json.loads(dashboard.position_json or "{}")
    except (TypeError, ValueError):
        return []
    if not isinstance(layout, dict):
        return []

    viz_types = {chart.id: chart.viz_type for chart in dashboard.slices}
    root = _content_root(layout)
    if not root:
        return []

    rows: list[list[PreviewCell]] = []
    for child in root.get("children", []):
        node = layout.get(child) or {}
        if node.get("type") == "ROW":
            row = [
                cell
                for grandchild in node.get("children", [])
                if (cell := _cell(layout, layout.get(grandchild) or {}, viz_types))
            ]
        else:
            # Charts or markdown placed directly on the grid take a full row
            row = [cell] if (cell := _cell(layout, node, viz_types)) else []
        if row:
            rows.append(row)
        if len(rows) == MAX_ROWS:
            break
    return rows
