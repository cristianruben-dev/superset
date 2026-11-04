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
"""Chart ids that a dashboard keeps outside ``meta.chartId``.

When a dashboard is copied (or imported) its charts get new ids. Besides the
layout, these places name charts by id and must follow them:

- ``ROOT_ID.meta.mibiBookmarks[].filters``: the saved selections of a bookmark,
  by data mask id; cross-filters use the chart id as key.
- ``chart_configuration`` and ``global_chart_configuration``: the cross-filter
  scopes of "Edit interactions".
- ``native_filter_configuration[].scope.excluded``, ``expanded_slices`` and
  ``timed_refresh_immune_slices``.
"""

from __future__ import annotations

from typing import Any

BOOKMARKS_KEY = "mibiBookmarks"


def _new_key(key: str, id_map: dict[int, int]) -> str:
    try:
        old_id = int(key)
    except (TypeError, ValueError):
        return key
    return str(id_map[old_id]) if old_id in id_map else key


def remap_bookmark_chart_ids(
    positions: dict[str, Any] | None, id_map: dict[int, int]
) -> None:
    """Point the cross-filter selections of every bookmark at the new charts."""
    if not positions or not id_map:
        return
    root = positions.get("ROOT_ID")
    if not isinstance(root, dict):
        return
    bookmarks = (root.get("meta") or {}).get(BOOKMARKS_KEY)
    if not isinstance(bookmarks, list):
        return
    for bookmark in bookmarks:
        filters = bookmark.get("filters") if isinstance(bookmark, dict) else None
        if isinstance(filters, dict):
            bookmark["filters"] = {
                _new_key(key, id_map): value for key, value in filters.items()
            }


def remap_metadata_chart_ids(metadata: dict[str, Any], id_map: dict[int, int]) -> None:
    """Point the chart ids of a dashboard's ``json_metadata`` at the new charts."""
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.importers.v1.utils import (
        update_cross_filter_scoping,
    )

    if not id_map:
        return

    update_cross_filter_scoping({"metadata": metadata}, id_map)

    for native_filter in metadata.get("native_filter_configuration") or []:
        scope = native_filter.get("scope") if isinstance(native_filter, dict) else None
        if isinstance(scope, dict) and scope.get("excluded"):
            scope["excluded"] = [id_map.get(old, old) for old in scope["excluded"]]

    if isinstance(metadata.get("expanded_slices"), dict):
        metadata["expanded_slices"] = {
            _new_key(key, id_map): value
            for key, value in metadata["expanded_slices"].items()
        }

    if isinstance(metadata.get("timed_refresh_immune_slices"), list):
        metadata["timed_refresh_immune_slices"] = [
            id_map.get(old, old) for old in metadata["timed_refresh_immune_slices"]
        ]
