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
Report interactivity, as the frontend reads it: the filter bar level of a
native filter (``getFilterScopeLevel`` of
``src/dashboard/components/nativeFilters/scopeLevel.ts``), the cross-filter
scope of a chart (``crossFilterScope`` and ``interactionMode`` of
``src/auradata/report/interactions.ts``), tooltip pages (``tooltipPageOf`` of
``tooltipPages.ts``), drill through pages and bookmarks
(``drillthrough.ts``, ``bookmarks.ts``).
"""

from __future__ import annotations

import math
import secrets
from typing import Any

from superset.auradata.layout._js import as_dict, is_finite, js_round, truthy
from superset.auradata.layout.keys import (
    BOOKMARKS_KEY,
    DRILLTHROUGH_PAGE_KEY,
    ROOT_ID,
    TOOLTIP_PAGE_KEY,
)
from superset.auradata.layout.pages import page_ids, top_tabs_id

SCOPE_LEVELS = ("report", "page", "visual")

#: The scope of a cross-filter without a setting of its own
DEFAULT_CROSS_FILTER_SCOPE: dict[str, Any] = {"rootPath": [ROOT_ID], "excluded": []}
GLOBAL_SCOPE_POINTER = "global"

#: ``DEFAULT_TOOLTIP_PAGE``: 320 × 256 px on the cell grid
DEFAULT_TOOLTIP_PAGE: dict[str, Any] = {"width": 10, "height": 8, "columns": []}

_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"


def filter_scope_level(filter_conf: Any) -> str:
    """
    The filter bar section of a native filter. An explicit ``scopeLevel``
    wins; otherwise a scope rooted at pages is a page filter, one over the
    whole report a report filter, and one of the report that leaves out most
    of its charts a visual filter.
    """
    conf = as_dict(filter_conf)
    level = conf.get("scopeLevel")
    if level in SCOPE_LEVELS:
        return str(level)
    scope = as_dict(conf.get("scope"))
    root_path = scope.get("rootPath")
    if root_path is None:
        root_path = [ROOT_ID]
    excluded = scope.get("excluded")
    if excluded is None:
        excluded = []
    if len(root_path) > 0 and ROOT_ID not in root_path:
        return "page"
    if len(excluded) == 0:
        return "report"
    charts = conf.get("chartsInScope")
    if isinstance(charts, list) and len(charts) < len(excluded):
        return "visual"
    return "report"


def cross_filter_scope(metadata: Any, chart_id: int) -> dict[str, Any]:
    """The explicit cross-filter scope of a chart (the global one copied over)."""
    metadata = as_dict(metadata)
    config = as_dict(as_dict(metadata.get("chart_configuration")).get(str(chart_id)))
    scope = as_dict(config.get("crossFilters")).get("scope")
    if scope is not None and truthy(scope) and scope != GLOBAL_SCOPE_POINTER:
        return scope
    global_scope = as_dict(metadata.get("global_chart_configuration")).get("scope")
    if global_scope is not None:
        return global_scope
    return dict(DEFAULT_CROSS_FILTER_SCOPE)


def interaction_mode(metadata: Any, source_id: int, target_id: int) -> str:
    """Whether cross-filters of a chart reach another: ``filter`` or ``none``."""
    excluded = as_dict(cross_filter_scope(metadata, source_id)).get("excluded") or []
    return "none" if target_id in excluded else "filter"


def _whole(value: Any, fallback: int, most: int = 60) -> int:
    if not is_finite(value):
        return fallback
    return int(min(most, max(2, js_round(value))))


def tooltip_page_of(meta: Any) -> dict[str, Any] | None:
    """The tooltip settings of a page, with defaults; None for other pages."""
    raw = as_dict(meta).get(TOOLTIP_PAGE_KEY)
    if not truthy(raw):
        return None
    raw = as_dict(raw)
    columns = raw.get("columns")
    return {
        "width": _whole(raw.get("width"), DEFAULT_TOOLTIP_PAGE["width"]),
        "height": _whole(raw.get("height"), DEFAULT_TOOLTIP_PAGE["height"]),
        "columns": [_js_string(c) for c in columns]
        if isinstance(columns, list)
        else [],
    }


def _js_string(value: Any) -> str:
    """``String(value)`` of a column name."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and math.isfinite(value) and value == int(value):
        return str(int(value))
    return str(value)


def top_level_pages(layout: dict[str, Any]) -> list[str]:
    """The top level tabs of a report; none for a report of one page."""
    return page_ids(layout) if top_tabs_id(layout) else []


def tooltip_pages(layout: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """The pages that are tooltips, in order, with their settings."""
    found: dict[str, dict[str, Any]] = {}
    for page_id in top_level_pages(layout):
        if page := tooltip_page_of(as_dict(layout.get(page_id)).get("meta")):
            found[page_id] = page
    return found


def drillthrough_pages(layout: dict[str, Any]) -> dict[str, list[str]]:
    """Pages set up to receive a drill through, with the columns they accept."""
    found: dict[str, list[str]] = {}
    for page_id in top_level_pages(layout):
        setting = as_dict(as_dict(layout.get(page_id)).get("meta")).get(
            DRILLTHROUGH_PAGE_KEY
        )
        columns = as_dict(setting).get("columns") or []
        if columns:
            found[page_id] = list(columns)
    return found


def bookmarks_of(layout: dict[str, Any]) -> list[dict[str, Any]]:
    """The bookmarks of a report, in order."""
    bookmarks = as_dict(as_dict(layout.get(ROOT_ID)).get("meta")).get(BOOKMARKS_KEY)
    return [b for b in bookmarks or [] if isinstance(b, dict)]


def new_bookmark_id() -> str:
    """An id like ``nanoid(10)``."""
    return "".join(secrets.choice(_ID_ALPHABET) for _ in range(10))
