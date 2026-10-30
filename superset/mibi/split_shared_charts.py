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
Give every dashboard its own copy of the charts it shares with other dashboards.

Data created before the single-dashboard rule (or imported from upstream Superset)
can have charts that several dashboards reuse. ``split_shared_charts`` keeps each
shared chart in the dashboard with the lowest id and replaces it in every other
dashboard with a clone, rewriting the chart references in the dashboard layout and
metadata. Run it with ``superset split-shared-charts``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from superset import db
from superset.mibi.single_dashboard import find_charts_in_multiple_dashboards
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json

logger = logging.getLogger(__name__)

# json_metadata keys whose values are lists of chart ids
_ID_LIST_KEYS = {"chartsInScope", "excluded", "immune", "timed_refresh_immune_slices"}
# json_metadata keys whose values are dicts keyed by chart id
_ID_KEYED_KEYS = {"chart_configuration", "expanded_slices", "filter_scopes"}


@dataclass
class SplitResult:
    """What ``split_shared_charts`` did, for reporting."""

    # dashboard id -> {old chart id: new chart id}
    replacements: dict[int, dict[int, int]] = field(default_factory=dict)

    @property
    def cloned_charts(self) -> int:
        return sum(len(mapping) for mapping in self.replacements.values())


def _clone_chart(chart: Slice) -> Slice:
    clone = chart.clone()
    clone.owners = list(chart.owners)
    clone.query_context = chart.query_context
    clone.certified_by = chart.certified_by
    clone.certification_details = chart.certification_details
    return clone


def _remap_id(value: Any, mapping: dict[int, int]) -> Any:
    try:
        chart_id = int(value)
    except (TypeError, ValueError):
        return value
    if chart_id not in mapping:
        return value
    return str(mapping[chart_id]) if isinstance(value, str) else mapping[chart_id]


def _remap_metadata(obj: Any, mapping: dict[int, int], key: str | None = None) -> Any:
    """Rewrite the chart ids in a json_metadata structure."""
    if isinstance(obj, list):
        if key in _ID_LIST_KEYS:
            return [_remap_id(item, mapping) for item in obj]
        return [_remap_metadata(item, mapping) for item in obj]

    if isinstance(obj, dict):
        result = {}
        for item_key, value in obj.items():
            new_key = (
                _remap_id(item_key, mapping) if key in _ID_KEYED_KEYS else item_key
            )
            result[new_key] = _remap_metadata(value, mapping, item_key)
        return result

    return obj


def remap_dashboard_metadata(
    metadata: dict[str, Any], mapping: dict[int, int]
) -> dict[str, Any]:
    """
    Rewrite the chart ids referenced by a dashboard's json_metadata.

    :param metadata: The parsed json_metadata
    :param mapping: {old chart id: new chart id}
    :returns: The metadata with the ids replaced
    """
    result = _remap_metadata(metadata, mapping)

    # chart_configuration entries repeat their own chart id
    for entry in (result.get("chart_configuration") or {}).values():
        if isinstance(entry, dict) and "id" in entry:
            entry["id"] = _remap_id(entry["id"], mapping)

    # default_filters is a JSON string keyed by chart id
    if isinstance(default_filters := result.get("default_filters"), str):
        try:
            parsed = json.loads(default_filters)
        except ValueError:
            parsed = None
        if isinstance(parsed, dict):
            result["default_filters"] = json.dumps(
                {str(_remap_id(k, mapping)): v for k, v in parsed.items()}
            )
    return result


def remap_dashboard_positions(
    positions: dict[str, Any], mapping: dict[int, int], uuids: dict[int, str]
) -> dict[str, Any]:
    """
    Point the chart entries of a dashboard layout to the new charts.

    :param positions: The parsed position_json
    :param mapping: {old chart id: new chart id}
    :param uuids: {new chart id: new chart uuid}
    :returns: The layout with the chart references replaced
    """
    for value in positions.values():
        if not isinstance(value, dict) or not isinstance(value.get("meta"), dict):
            continue
        meta = value["meta"]
        if (old_id := meta.get("chartId")) in mapping:
            meta["chartId"] = mapping[old_id]
            if "uuid" in meta:
                meta["uuid"] = uuids[mapping[old_id]]
    return positions


def split_shared_charts() -> SplitResult:
    """
    Clone every chart shared between dashboards so each dashboard has its own.

    The chart stays in the dashboard with the lowest id; every other dashboard gets a
    clone. Changes are flushed but not committed, so the caller decides whether to
    commit or roll back.

    :returns: The replacements made in each dashboard
    """
    result = SplitResult()
    conflicts = find_charts_in_multiple_dashboards()
    if not conflicts:
        return result

    # dashboard id -> charts it must replace with a clone
    to_replace: dict[int, list[int]] = {}
    for chart_id, dashboard_ids in conflicts.items():
        for dashboard_id in sorted(dashboard_ids)[1:]:
            to_replace.setdefault(dashboard_id, []).append(chart_id)

    for dashboard_id, chart_ids in sorted(to_replace.items()):
        dashboard = db.session.query(Dashboard).get(dashboard_id)
        mapping: dict[int, int] = {}
        uuids: dict[int, str] = {}
        charts = {chart.id: chart for chart in dashboard.slices}

        for chart_id in sorted(chart_ids):
            clone = _clone_chart(charts[chart_id])
            db.session.add(clone)
            db.session.flush()
            mapping[chart_id] = clone.id
            uuids[clone.id] = str(clone.uuid)

        dashboard.slices = [
            db.session.query(Slice).get(mapping[chart.id])
            if chart.id in mapping
            else chart
            for chart in dashboard.slices
        ]
        if dashboard.position_json:
            dashboard.position_json = json.dumps(
                remap_dashboard_positions(
                    json.loads(dashboard.position_json), mapping, uuids
                )
            )
        if dashboard.json_metadata:
            dashboard.json_metadata = json.dumps(
                remap_dashboard_metadata(json.loads(dashboard.json_metadata), mapping)
            )
        db.session.flush()

        result.replacements[dashboard_id] = mapping
        logger.info("Dashboard %s: replaced shared charts %s", dashboard_id, mapping)

    return result
