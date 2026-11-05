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
The field wells of a chart, as the Fields level of the report editor reads
them (``src/auradata/format/chartFields.ts``): which form data keys take a
field, in Power BI's order, and what a chart keeps when it moves to another
dataset (``fieldsKeptBy``).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

# The roles of each chart (``rolesOf``): form data key and its English name
_XY_ROLES = ("x_axis", "metrics", "groupby")
ROLES: dict[str, tuple[str, ...]] = {
    "echarts_timeseries_bar": _XY_ROLES,
    "echarts_timeseries_line": _XY_ROLES,
    "echarts_timeseries_smooth": _XY_ROLES,
    "echarts_timeseries_step": _XY_ROLES,
    "echarts_timeseries_scatter": _XY_ROLES,
    "echarts_area": _XY_ROLES,
    "mixed_timeseries": ("x_axis", "metrics", "groupby", "metrics_b", "groupby_b"),
    "pie": ("groupby", "metric"),
    "funnel": ("groupby", "metric"),
    "treemap_v2": ("groupby", "metric"),
    "gauge_chart": ("groupby", "metric", "gauge_target_metric"),
    "waterfall": ("x_axis", "groupby", "metric"),
    "butterfly": ("groupby", "left_metric", "right_metric"),
    "big_number_total": ("metric",),
    "big_number": ("x_axis", "metric", "goal_metric"),
    "table": ("groupby", "all_columns", "metrics", "percent_metrics"),
    "pivot_table_v2": ("groupbyRows", "groupbyColumns", "metrics"),
    "bubble_v2": ("entity", "series", "x", "y", "size"),
}


@dataclass(frozen=True)
class Well:
    """A well a field goes to, and whether it takes one field or a list."""

    name: str
    single: bool = False


@dataclass(frozen=True)
class AddWells:
    column: tuple[Well, ...]
    metric: tuple[Well, ...]


_XY_WELLS = AddWells(
    column=(Well("x_axis", single=True), Well("groupby")),
    metric=(Well("metrics"),),
)
_CATEGORY_WELLS = AddWells(
    column=(Well("groupby"),), metric=(Well("metric", single=True),)
)


def add_wells_of(form_data: dict[str, Any]) -> AddWells | None:
    """Where a field goes on this chart, in order (``addWellsOf``)."""
    viz_type = str(form_data.get("viz_type"))
    if viz_type == "table":
        if form_data.get("query_mode") == "raw":
            return AddWells(column=(Well("all_columns"),), metric=())
        return AddWells(column=(Well("groupby"),), metric=(Well("metrics"),))
    return {
        "echarts_timeseries_bar": _XY_WELLS,
        "echarts_timeseries_line": _XY_WELLS,
        "echarts_timeseries_smooth": _XY_WELLS,
        "echarts_timeseries_step": _XY_WELLS,
        "echarts_timeseries_scatter": _XY_WELLS,
        "echarts_area": _XY_WELLS,
        "mixed_timeseries": _XY_WELLS,
        "pie": _CATEGORY_WELLS,
        "funnel": _CATEGORY_WELLS,
        "treemap_v2": _CATEGORY_WELLS,
        "gauge_chart": _CATEGORY_WELLS,
        "waterfall": AddWells(
            column=(Well("x_axis", single=True), Well("groupby")),
            metric=(Well("metric", single=True),),
        ),
        "butterfly": AddWells(
            column=(Well("groupby"),),
            metric=(
                Well("left_metric", single=True),
                Well("right_metric", single=True),
            ),
        ),
        "big_number_total": AddWells(column=(), metric=(Well("metric", single=True),)),
        "big_number": AddWells(
            column=(Well("x_axis", single=True),),
            metric=(Well("metric", single=True),),
        ),
        "pivot_table_v2": AddWells(
            column=(Well("groupbyRows"), Well("groupbyColumns")),
            metric=(Well("metrics"),),
        ),
        "bubble_v2": AddWells(
            column=(Well("entity", single=True), Well("series", single=True)),
            metric=(
                Well("x", single=True),
                Well("y", single=True),
                Well("size", single=True),
            ),
        ),
    }.get(viz_type)


def well_names(form_data: dict[str, Any]) -> list[str]:
    """Every field well of a chart: its roles, then the wells a field goes to."""
    names = list(ROLES.get(str(form_data.get("viz_type")), ()))
    if wells := add_wells_of(form_data):
        names += [w.name for w in (*wells.column, *wells.metric) if w.name not in names]
    return names


def is_metric_well(form_data: dict[str, Any], name: str) -> bool:
    """Whether a well holds values (measures) rather than columns."""
    wells = add_wells_of(form_data)
    metric_wells = {w.name for w in wells.metric} if wells else set()
    return name in metric_wells or bool(re.search("metric", name))


# The wells that take a list of fields; every other well takes one
LIST_WELLS = frozenset(
    {
        "groupby",
        "metrics",
        "all_columns",
        "percent_metrics",
        "groupbyRows",
        "groupbyColumns",
        "metrics_b",
        "groupby_b",
    }
)


def takes_list(name: str) -> bool:
    """Whether a well takes a list of fields rather than one."""
    return name in LIST_WELLS


def _keeps(value: Any, metric_well: bool, columns: set[str], metrics: set[str]) -> bool:
    if isinstance(value, str):
        return value in (metrics if metric_well else columns)
    if not isinstance(value, dict):
        return True
    column = value.get("column")
    if isinstance(column, dict) and column.get("column_name"):
        return column["column_name"] in columns
    if value.get("subject"):
        return value["subject"] in columns
    return True


def fields_kept_by(
    form_data: dict[str, Any], columns: set[str], metrics: set[str]
) -> tuple[dict[str, Any], bool]:
    """
    The values of the wells and filters of a chart that a dataset still has:
    a column or a measure by name, an aggregate of one of its columns, or a
    SQL expression (``fieldsKeptBy``).

    :returns: The changed keys (a well left without a field is ``None``) and
        whether a well that had fields was emptied
    """
    kept: dict[str, Any] = {}
    emptied = False
    for name in well_names(form_data):
        current = form_data.get(name)
        if current is None:
            continue
        metric_well = is_metric_well(form_data, name)
        if isinstance(current, list):
            nxt = [v for v in current if _keeps(v, metric_well, columns, metrics)]
            if len(nxt) != len(current):
                kept[name] = nxt
            if current and not nxt:
                emptied = True
        elif not _keeps(current, metric_well, columns, metrics):
            kept[name] = None
            emptied = True
    filters = form_data.get("adhoc_filters")
    if isinstance(filters, list):
        nxt = [f for f in filters if _keeps(f, False, columns, metrics)]
        if len(nxt) != len(filters):
            kept["adhoc_filters"] = nxt
    return kept, emptied
