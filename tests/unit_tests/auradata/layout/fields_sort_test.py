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
"""The field wells and sorts of a chart, as chartFields.ts and sort/adapters.ts."""

from superset.auradata.layout.fields import (
    fields_kept_by,
    is_metric_well,
    takes_list,
    well_names,
)
from superset.auradata.layout.sort import (
    BOOLEAN,
    DatasetColumn,
    NUMERIC,
    Sort,
    sort_adapter_for,
    STRING,
    TEMPORAL,
)

SUM_SALES = {
    "expressionType": "SIMPLE",
    "aggregate": "SUM",
    "column": {"column_name": "sales"},
}


def test_wells_follow_power_bi_order() -> None:
    bar = {"viz_type": "echarts_timeseries_bar"}
    assert well_names(bar) == ["x_axis", "metrics", "groupby"]
    assert is_metric_well(bar, "metrics")
    assert not is_metric_well(bar, "groupby")
    assert well_names({"viz_type": "table", "query_mode": "raw"})[:2] == [
        "groupby",
        "all_columns",
    ]
    assert well_names({"viz_type": "unknown"}) == []
    assert takes_list("groupby")
    assert not takes_list("x_axis")


def test_fields_kept_by_drops_what_the_dataset_lacks() -> None:
    form_data = {
        "viz_type": "echarts_timeseries_bar",
        "x_axis": "region",
        "metrics": ["total", SUM_SALES],
        "groupby": ["product"],
        "adhoc_filters": [
            {"subject": "region", "operator": "==", "comparator": "N"},
            {"subject": "product", "operator": "==", "comparator": "A"},
            {"expressionType": "SQL", "sqlExpression": "1 = 1"},
        ],
    }

    kept, emptied = fields_kept_by(form_data, {"region", "sales"}, set())

    assert kept == {
        "metrics": [SUM_SALES],
        "groupby": [],
        "adhoc_filters": [
            {"subject": "region", "operator": "==", "comparator": "N"},
            {"expressionType": "SQL", "sqlExpression": "1 = 1"},
        ],
    }
    assert emptied is True


def test_fields_kept_by_keeps_everything_on_a_matching_dataset() -> None:
    form_data = {"viz_type": "pie", "groupby": ["region"], "metric": "total"}
    assert fields_kept_by(form_data, {"region"}, {"total"}) == ({}, False)
    kept, emptied = fields_kept_by(form_data, {"region"}, set())
    assert kept == {"metric": None}
    assert emptied


COLUMNS = {
    "region": DatasetColumn(STRING, False),
    "active": DatasetColumn(BOOLEAN, False),
    "units": DatasetColumn(NUMERIC, False),
    "day": DatasetColumn(TEMPORAL, True),
}


def test_axis_sort_choices_and_reading_order() -> None:
    adapter = sort_adapter_for("echarts_timeseries_bar")
    assert adapter is not None
    bar = {
        "viz_type": "echarts_timeseries_bar",
        "x_axis": "region",
        "metrics": [SUM_SALES],
    }
    assert adapter.options(bar, COLUMNS) == ["region", "SUM(sales)"]
    # Series or several metrics sort by an aggregate of the series
    assert adapter.options({**bar, "groupby": ["active"]}, COLUMNS) == [
        "name",
        "sum",
        "min",
        "max",
        "avg",
    ]
    # A time or number axis keeps its order
    assert adapter.options({**bar, "x_axis": "day"}, COLUMNS) == []
    assert adapter.options({**bar, "x_axis": "units"}, COLUMNS) == []
    assert adapter.options(
        {**bar, "x_axis": "units", "xAxisForceCategorical": True}, COLUMNS
    ) == ["units", "SUM(sales)"]

    assert adapter.changes(bar, Sort("region", True)) == {
        "x_axis_sort": "region",
        "x_axis_sort_asc": True,
    }
    # A horizontal chart stores the order the other way round
    horizontal = {**bar, "orientation": "horizontal"}
    assert adapter.changes(horizontal, Sort("region", True))["x_axis_sort_asc"] is False
    assert adapter.current(
        {**horizontal, "x_axis_sort": "region", "x_axis_sort_asc": False}
    ) == Sort("region", True)
    # ...unless its axis is reversed too
    reversed_horizontal = {**horizontal, "x_axis_inverse": True}
    assert (
        adapter.changes(reversed_horizontal, Sort("region", True))["x_axis_sort_asc"]
        is True
    )


def test_category_table_and_pivot_sorts() -> None:
    pie = sort_adapter_for("pie")
    assert pie is not None
    pie_form = {"viz_type": "pie", "metric": "total", "groupby": ["region"]}
    assert pie.options(pie_form, COLUMNS) == ["total", "region"]
    assert pie.current(pie_form) == Sort("total", False)
    assert pie.changes(pie_form, Sort("region", True)) == {
        "auradata_sort_by": "region",
        "auradata_sort_asc": True,
    }

    table = sort_adapter_for("table")
    assert table is not None
    table_form = {"viz_type": "table", "groupby": ["region"], "metrics": ["total"]}
    assert table.options(table_form, COLUMNS) == ["region", "total"]
    assert table.current(table_form) == Sort("total", False)
    assert table.changes(table_form, Sort("region", True)) == {
        "auradata_table_sort": [{"key": "region", "desc": False}]
    }
    raw = {"viz_type": "table", "query_mode": "raw", "all_columns": ["region"]}
    assert table.options(raw, COLUMNS) == ["region"]
    assert table.current(raw) is None

    pivot = sort_adapter_for("pivot_table_v2")
    assert pivot is not None
    assert pivot.current({}) == Sort("key", True)
    assert pivot.changes({}, Sort("value", False)) == {"rowOrder": "value_z_to_a"}

    assert sort_adapter_for("big_number_total") is None
