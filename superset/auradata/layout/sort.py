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
The sort of a visual, as the report's "Sort axis" menu sets it
(``src/auradata/sort/adapters.ts`` and ``axisChoices.ts``): each chart type
keeps its sort in its own form data keys, and offers its own choices.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

# GenericDataType of superset.utils.core
NUMERIC, STRING, TEMPORAL, BOOLEAN = 0, 1, 2, 3

# ``SORT_SERIES_CHOICES``: an aggregate of the series, for charts with several
SERIES_SORTS = ("name", "sum", "min", "max", "avg")


@dataclass(frozen=True)
class DatasetColumn:
    """What the sort needs of a dataset column."""

    generic_type: int | None
    is_dttm: bool


Columns = dict[str, DatasetColumn]


@dataclass(frozen=True)
class Sort:
    by: str
    ascending: bool


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def column_label(column: Any) -> str:
    """``getColumnLabel``: a name, or the label or SQL of an ad hoc column."""
    if isinstance(column, str):
        return column
    if isinstance(column, dict):
        return str(column.get("label") or column.get("sqlExpression") or "")
    return str(column)


def metric_label(metric: Any) -> str:
    """``getMetricLabel``: a saved metric's name, or an ad hoc metric's label."""
    if isinstance(metric, str):
        return metric
    if isinstance(metric, dict):
        if metric.get("label"):
            return str(metric["label"])
        if metric.get("expressionType") == "SIMPLE":
            column = metric.get("column") or {}
            return f"{metric.get('aggregate')}({column.get('column_name')})"
        return str(metric.get("sqlExpression") or "")
    return str(metric)


# Bar, line, area, step, scatter and smooth line: ``x_axis_sort``


def _runs_against_reading(form_data: dict[str, Any]) -> bool:
    """A horizontal chart or a reversed axis stores the order the other way."""
    return (form_data.get("orientation") == "horizontal") != bool(
        form_data.get("x_axis_inverse")
    )


def _is_sortable_axis(form_data: dict[str, Any], columns: Columns) -> bool:
    x_axis = form_data.get("x_axis")
    if x_axis is None or x_axis == "":
        return False
    # The type of a custom SQL column is unknown, so it is left to the user
    if isinstance(x_axis, dict):
        return True
    column = columns.get(column_label(x_axis))
    kind = column.generic_type if column else None
    if form_data.get("xAxisForceCategorical") and kind == NUMERIC:
        return True
    return kind in (STRING, BOOLEAN)


def _axis_options(form_data: dict[str, Any], columns: Columns) -> list[str]:
    if not _is_sortable_axis(form_data, columns):
        return []
    axis = column_label(form_data["x_axis"])
    column = columns.get(axis)
    if column and column.is_dttm:
        return []
    groupby = _as_list(form_data.get("groupby"))
    metrics = _as_list(form_data.get("metrics"))
    sort_metrics = [*metrics, form_data.get("timeseries_limit_metric")]
    labels: list[str] = []
    for metric in sort_metrics:
        if metric and (label := metric_label(metric)) not in labels:
            labels.append(label)
    options: list[str] = []
    if not groupby:
        options += [axis, *labels]
    if groupby or len(metrics) > 1:
        options += list(SERIES_SORTS)
    return options


def _axis_current(form_data: dict[str, Any]) -> Sort | None:
    by = form_data.get("x_axis_sort")
    if not isinstance(by, str) or not by:
        return None
    stored = form_data.get("x_axis_sort_asc")
    stored = True if stored is None else bool(stored)
    return Sort(by, not stored if _runs_against_reading(form_data) else stored)


def _axis_changes(form_data: dict[str, Any], sort: Sort) -> dict[str, Any]:
    ascending = sort.ascending
    return {
        "x_axis_sort": sort.by,
        "x_axis_sort_asc": not ascending
        if _runs_against_reading(form_data)
        else ascending,
    }


# Pie and funnel: ``auradata_sort_by`` and ``auradata_sort_asc``


def _category_options(form_data: dict[str, Any], columns: Columns) -> list[str]:
    metric = form_data.get("metric")
    return [
        *([metric_label(metric)] if metric else []),
        *(column_label(c) for c in _as_list(form_data.get("groupby"))),
    ]


def _category_current(form_data: dict[str, Any]) -> Sort | None:
    if form_data.get("auradata_sort_by"):
        return Sort(
            str(form_data["auradata_sort_by"]),
            bool(form_data.get("auradata_sort_asc")),
        )
    metric = form_data.get("metric")
    if metric and form_data.get("sort_by_metric") is not False:
        return Sort(metric_label(metric), False)
    return None


def _category_changes(form_data: dict[str, Any], sort: Sort) -> dict[str, Any]:
    return {"auradata_sort_by": sort.by, "auradata_sort_asc": sort.ascending}


# Tables: ``auradata_table_sort``


def _is_raw_table(form_data: dict[str, Any]) -> bool:
    mode = form_data.get("query_mode")
    return mode == "raw" or (
        mode != "aggregate" and len(_as_list(form_data.get("all_columns"))) > 0
    )


def _table_options(form_data: dict[str, Any], columns: Columns) -> list[str]:
    if _is_raw_table(form_data):
        return [column_label(c) for c in _as_list(form_data.get("all_columns"))]
    return [
        *(column_label(c) for c in _as_list(form_data.get("groupby"))),
        *(metric_label(m) for m in _as_list(form_data.get("metrics"))),
    ]


def _table_current(form_data: dict[str, Any]) -> Sort | None:
    saved = next(iter(_as_list(form_data.get("auradata_table_sort"))), None)
    if isinstance(saved, dict) and saved.get("key"):
        return Sort(str(saved["key"]), not saved.get("desc"))
    if _is_raw_table(form_data):
        return None
    sort_metric = next(iter(_as_list(form_data.get("timeseries_limit_metric"))), None)
    if sort_metric:
        return Sort(metric_label(sort_metric), form_data.get("order_desc") is False)
    metrics = _as_list(form_data.get("metrics"))
    return Sort(metric_label(metrics[0]), False) if metrics else None


def _table_changes(form_data: dict[str, Any], sort: Sort) -> dict[str, Any]:
    return {"auradata_table_sort": [{"key": sort.by, "desc": not sort.ascending}]}


# Pivot tables: ``rowOrder``

PIVOT_ROW_ORDERS = {
    ("key", True): "key_a_to_z",
    ("key", False): "key_z_to_a",
    ("value", True): "value_a_to_z",
    ("value", False): "value_z_to_a",
}


def _pivot_options(form_data: dict[str, Any], columns: Columns) -> list[str]:
    return ["key", "value"]


def _pivot_current(form_data: dict[str, Any]) -> Sort | None:
    order = form_data.get("rowOrder") or "key_a_to_z"
    for (by, ascending), value in PIVOT_ROW_ORDERS.items():
        if value == order:
            return Sort(by, ascending)
    return None


def _pivot_changes(form_data: dict[str, Any], sort: Sort) -> dict[str, Any]:
    return {"rowOrder": PIVOT_ROW_ORDERS[(sort.by, sort.ascending)]}


@dataclass(frozen=True)
class SortAdapter:
    options: Callable[[dict[str, Any], Columns], list[str]]
    current: Callable[[dict[str, Any]], Sort | None]
    changes: Callable[[dict[str, Any], Sort], dict[str, Any]]


_AXIS = SortAdapter(_axis_options, _axis_current, _axis_changes)
_CATEGORY = SortAdapter(_category_options, _category_current, _category_changes)

ADAPTERS: dict[str, SortAdapter] = {
    "table": SortAdapter(_table_options, _table_current, _table_changes),
    "pivot_table_v2": SortAdapter(_pivot_options, _pivot_current, _pivot_changes),
    "pie": _CATEGORY,
    "funnel": _CATEGORY,
    "echarts_timeseries_bar": _AXIS,
    "echarts_timeseries_line": _AXIS,
    "echarts_area": _AXIS,
    "echarts_timeseries_step": _AXIS,
    "echarts_timeseries_scatter": _AXIS,
    "echarts_timeseries_smooth": _AXIS,
}


def sort_adapter_for(viz_type: str | None) -> SortAdapter | None:
    """The sort of a chart type, if visuals of that type can be sorted."""
    return ADAPTERS.get(viz_type or "")
