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
Where a chart stores the metrics and columns a guest may request.

Used by ``_columns_metrics_modified`` in ``superset.security.manager``, which ensures
guest users on embedded dashboards only read the metrics and columns the chart was
saved with. Superset 7.0 compares the request against a short list of controls; each
chart type stores its values under its own control names, sometimes nested (spatial
configurations, deck.gl tooltips, a chart inside ``selected_chart``), so legitimate
loads of those charts read as tampering. These helpers only widen where stored values
are found; every requested value still has to match one of them exactly.
"""

from typing import Any

from superset.utils import json

#: Chart ``params`` keys that can hold a chart's metrics. A request always carries its
#: metrics under ``metrics``, but each chart type saves them under its own control name:
#: big number and pie store ``metric``, bubble stores ``x``/``y``/``size``, and so on.
#: Broader than ``METRIC_FORM_DATA_PARAMS`` in ``superset.connectors.sqla.models``,
#: which omits several of these; kept separate to avoid importing that module here.
STORED_METRIC_PARAMS = (
    "metric",
    "metric_2",
    "metrics",
    "metrics_b",
    "percent_metrics",
    "point_radius_fixed",
    "right_axis_metric",
    "secondary_metric",
    "series_limit_metric",
    "series_limit_metric_b",
    "size",
    "timeseries_limit_metric",
    "timeseries_limit_metric_b",
    "tooltip_metrics",
    "x",
    "y",
)

#: Chart ``params`` keys that can hold a chart's columns or group-bys. As with the
#: metrics above, a request carries them under ``columns``/``groupby`` while charts save
#: them under control names such as ``all_columns`` (table), ``source``/``target``
#: (sankey), or ``x_axis`` (time series).
STORED_COLUMN_PARAMS = (
    "all_columns",
    "all_columns_x",
    "column",
    "columns",
    "dimension",
    "end_spatial",
    "end_time",
    "entity",
    "geom_column",
    "granularity_sqla",
    "groupby",
    "groupbyColumns",
    "groupbyRows",
    "groupby_b",
    "id",
    "js_columns",
    "line_column",
    "name",
    "order_by_cols",
    "parent",
    "series",
    "series_columns",
    "source",
    "source_category",
    "spatial",
    "start_spatial",
    "start_time",
    "target",
    "target_category",
    "tooltip_columns",
    "tooltip_contents",
    "x_axis",
    "y_axis",
)


def collapse_column_reference(value: Any) -> Any:
    """
    Reduce an adhoc column that merely names a physical column to that column's name.

    A physical column is saved in a chart's ``params`` as a bare string, but the
    frontend may send it as an adhoc column that only points back at it: flagged
    ``isColumnReference``, or a plain adhoc column whose ``sqlExpression`` is its own
    label (how box plot sends its temporal column). Neither reads data beyond the saved
    column, yet neither appears verbatim in ``params``. (A synthesized ``BASE_AXIS``
    x-axis is reduced first by ``_denormalize_base_axis_column`` in the manager.)

    Collapsing only rewrites the reference to the name it points at; the result still
    has to match a value stored on the chart, so pointing at an unrelated column or
    wrapping free-form SQL grants no additional access. Other values are returned
    unchanged.
    """
    if not isinstance(value, dict):
        return value
    expression = value.get("sqlExpression")
    if isinstance(expression, str) and (
        value.get("isColumnReference") or expression == value.get("label")
    ):
        return expression
    return value


def unwrap_orderby(value: Any) -> Any:
    """
    Return the expression an ``orderby`` entry sorts on.

    Entries are ``[expression, is_ascending]`` pairs; only the expression selects data
    and therefore needs to be validated.
    """
    if (
        isinstance(value, (list, tuple))
        and len(value) == 2
        and isinstance(value[1], bool)
    ):
        return value[0]
    return value


def _decode_orderby_pair(value: Any) -> Any:
    """
    Decode an ``order_by_cols`` entry, which stores its pair JSON-encoded in a string.

    Only strings holding a ``[column, is_ascending]`` list are decoded, so a column
    whose name happens to be valid JSON is left alone.
    """
    if not isinstance(value, str):
        return value
    try:
        decoded = json.loads(value)
    except ValueError:
        return value
    return decoded if isinstance(decoded, list) else value


#: Controls whose stored value is a nested lat/lon/geohash configuration rather than a
#: column name. The frontend decomposes them with ``getSpatialColumns()`` and queries
#: the columns they name, so the stored config has to be decomposed the same way to be
#: comparable against the flat column names a request carries.
SPATIAL_PARAMS = frozenset({"end_spatial", "spatial", "start_spatial"})

#: Keys a spatial configuration can name a column under, per ``getSpatialColumns()``.
SPATIAL_COLUMN_KEYS = ("geohashCol", "latCol", "lonCol", "lonlatCol")

#: Control holding a chart definition JSON-encoded inside a string, with its own metrics
#: and columns nested within. Scanning the outer ``params`` keys never looks inside it.
EMBEDDED_CHART_PARAM = "selected_chart"


def decompose_spatial(value: Any) -> list[Any]:
    """
    The columns a spatial configuration names, mirroring ``getSpatialColumns()``.

    A configuration names its columns under ``lonCol``/``latCol`` (latlong),
    ``lonlatCol`` (delimited) or ``geohashCol`` (geohash). All of them are returned
    regardless of the declared ``type``, since every one is a column the chart is saved
    with; the request still has to name one of them exactly.
    """
    if not isinstance(value, dict):
        return [value]
    return [value[key] for key in SPATIAL_COLUMN_KEYS if value.get(key)]


def decompose_tooltip_contents(value: Any) -> list[Any]:
    """
    The columns a deck.gl tooltip entry reads, mirroring ``extractTooltipColumns()``.

    An entry is either a bare column name or a tooltip-config object wrapping one. Only
    ``item_type: "column"`` entries reach the query's columns; metric entries are read
    from data already fetched and add nothing to select.
    """
    if isinstance(value, dict):
        if value.get("item_type") == "column" and value.get("column_name"):
            return [value["column_name"]]
        return []
    return [value]


def decompose_fixed_or_metric(value: Any) -> list[Any]:
    """
    The metric a fixed-or-metric control holds, if it holds one.

    deck.gl's ``point_radius_fixed`` is either a legacy bare metric name or
    ``{"type": "fix" | "metric", "value": ...}``, where only the ``metric`` variant
    contributes a metric to the query.
    """
    if not isinstance(value, dict):
        return [value]
    if value.get("type") == "metric" and value.get("value") is not None:
        return [value["value"]]
    return []


def embedded_chart_params(value: Any) -> dict[str, Any]:
    """
    The ``params`` of a chart definition nested inside a control's value.

    Cartodiagram stores the chart it renders per feature in ``selected_chart`` as a
    JSON string whose ``params`` is itself a JSON string. Its metrics and columns are
    the ones actually queried, so they have to be reachable.
    """
    definition = _decode_json(value)
    if not isinstance(definition, dict):
        return {}
    params = _decode_json(definition.get("params"))
    return params if isinstance(params, dict) else {}


def _decode_json(value: Any) -> Any:
    """
    Decode a JSON-encoded string, leaving anything else untouched.
    """
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except ValueError:
        return None


def decompose_stored_value(key: str, value: Any) -> list[Any]:
    """
    The individual metrics or columns one stored value of control ``key`` holds.

    Most controls hold their values flat, as a name or a list of names. The ones that
    wrap them in a nested structure are decomposed into the names they point at, so that
    they compare against the flat names a request carries. ``order_by_cols`` entries are
    JSON-encoded ``[column, is_ascending]`` pairs whose column the query reads.
    """
    if key in SPATIAL_PARAMS:
        return decompose_spatial(value)
    if key == "tooltip_contents":
        return decompose_tooltip_contents(value)
    if key == "point_radius_fixed":
        return decompose_fixed_or_metric(value)
    if key == "order_by_cols":
        return [unwrap_orderby(_decode_orderby_pair(value))]
    return [value]
