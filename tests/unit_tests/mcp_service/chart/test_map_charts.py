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
"""Tests for the map chart types: point clusters, scatter, heatmap and country.

Schema validation, the form data each maps to (matching the frontend
buildQuery of ``point_cluster_map``, ``deck_scatter``, ``deck_heatmap`` and
``country_map``), the query the MCP builds from it, and the checks that keep a
map from drawing the whole world or a gray country.
"""

import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest
from pydantic import TypeAdapter, ValidationError

from superset.mcp_service.chart import registry
from superset.mcp_service.chart.chart_helpers import (
    build_query_dicts_from_form_data,
    point_cluster_map_columns,
)
from superset.mcp_service.chart.chart_utils import map_config_to_form_data
from superset.mcp_service.chart.map_countries import COUNTRY_MAP_COUNTRIES
from superset.mcp_service.chart.schemas import (
    ChartConfig,
    CountryMapChartConfig,
    DeckHeatmapChartConfig,
    DeckScatterChartConfig,
    PointClusterMapChartConfig,
)
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _CHART_EXAMPLES,
    VALID_CHART_TYPES,
)

ADAPTER: TypeAdapter[Any] = TypeAdapter(ChartConfig)
COORDINATES = {"latitude": {"name": "lat"}, "longitude": {"name": "lon"}}
MAP_TYPES = ("point_cluster_map", "deck_scatter", "deck_heatmap", "country_map")


def _query(form_data: dict[str, Any]) -> dict[str, Any]:
    """The query the MCP builds from a chart's form data, without a database."""
    with (
        patch("superset.mcp_service.chart.chart_helpers.prepare_form_data_for_query"),
        patch(
            "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
            return_value="postgresql",
        ),
    ):
        return build_query_dicts_from_form_data(form_data, 1, "table", row_limit=5)[0]


def _filters_on(form_data: dict[str, Any], column: str) -> list[tuple[str, Any]]:
    return [
        (f["operator"], f.get("comparator"))
        for f in form_data.get("adhoc_filters", [])
        if f["subject"] == column
    ]


def test_map_types_are_registered_and_listed() -> None:
    for chart_type in MAP_TYPES:
        plugin = registry.get(chart_type)
        assert plugin is not None
        assert chart_type in VALID_CHART_TYPES
        assert plugin.resolve_viz_type(None) == chart_type


@pytest.mark.parametrize("chart_type", MAP_TYPES)
def test_schema_examples_validate(chart_type: str) -> None:
    for example in _CHART_EXAMPLES[chart_type]:
        assert ADAPTER.validate_python(example).chart_type == chart_type


def test_point_cluster_map_form_data() -> None:
    config = ADAPTER.validate_python(
        {
            "chart_type": "point_cluster_map",
            "lat": {"name": "lat"},
            "lng": {"name": "lon"},
            "label": {"name": "staff"},
            "label_aggregate": "mean",
            "clustering_radius": 80,
        }
    )
    assert isinstance(config, PointClusterMapChartConfig)
    form_data = map_config_to_form_data(config)
    assert form_data["viz_type"] == "point_cluster_map"
    assert form_data["all_columns_x"] == "lon"
    assert form_data["all_columns_y"] == "lat"
    assert form_data["map_label"] == ["staff"]
    assert form_data["pandas_aggfunc"] == "mean"
    assert form_data["clustering_radius"] == "80"
    assert form_data["map_renderer"] == "maplibre"
    assert form_data["maplibre_style"].startswith("https://")
    assert form_data["map_color"] == "#2563EB"
    # The map fits itself to the points
    assert not any(key.startswith("viewport") for key in form_data)


def test_point_maps_leave_out_missing_and_zero_coordinates() -> None:
    for chart_type in ("point_cluster_map", "deck_scatter", "deck_heatmap"):
        form_data = map_config_to_form_data(
            ADAPTER.validate_python({"chart_type": chart_type, **COORDINATES})
        )
        for column in ("lat", "lon"):
            assert _filters_on(form_data, column) == [("IS NOT NULL", None), ("!=", 0)]


def test_zero_coordinates_can_stay() -> None:
    form_data = map_config_to_form_data(
        ADAPTER.validate_python(
            {
                "chart_type": "deck_scatter",
                **COORDINATES,
                "exclude_zero_coordinates": False,
                "filters": [{"column": "type", "op": "=", "value": "clinic"}],
            }
        )
    )
    assert _filters_on(form_data, "lat") == [("IS NOT NULL", None)]
    assert _filters_on(form_data, "type") == [("==", "clinic")]


def test_deck_scatter_fixed_points() -> None:
    form_data = map_config_to_form_data(
        ADAPTER.validate_python(
            {"chart_type": "deck_scatter", **COORDINATES, "color": "#10B981"}
        )
    )
    assert form_data["spatial"] == {"type": "latlong", "latCol": "lat", "lonCol": "lon"}
    assert form_data["point_radius_fixed"] == {"type": "fix", "value": 300}
    assert form_data["point_unit"] == "radius_m"
    assert form_data["color_scheme_type"] == "fixed_color"
    assert form_data["color_picker"] == {"r": 16, "g": 185, "b": 129, "a": 1}
    assert form_data["autozoom"] is True
    assert "dimension" not in form_data


def test_deck_scatter_sized_and_colored_by_data() -> None:
    config = ADAPTER.validate_python(
        {
            "chart_type": "deck_scatter",
            **COORDINATES,
            "dimension": {"name": "type"},
            "point_size": {"name": "staff", "aggregate": "SUM"},
        }
    )
    assert isinstance(config, DeckScatterChartConfig)
    form_data = map_config_to_form_data(config)
    assert form_data["dimension"] == "type"
    assert form_data["color_scheme_type"] == "categorical_palette"
    radius = form_data["point_radius_fixed"]
    assert radius["type"] == "metric"
    assert radius["value"]["aggregate"] == "SUM"
    query = _query(form_data)
    assert query["columns"] == ["lon", "lat", "type"]
    assert [m["label"] for m in query["metrics"]] == ["SUM(staff)"]


def test_deck_heatmap_counts_rows_by_default() -> None:
    config = ADAPTER.validate_python({"chart_type": "deck_heatmap", **COORDINATES})
    assert isinstance(config, DeckHeatmapChartConfig)
    form_data = map_config_to_form_data(config)
    assert form_data["size"]["sqlExpression"] == "COUNT(*)"
    assert form_data["radius_pixels"] == 30
    assert form_data["intensity"] == 1
    weighted = map_config_to_form_data(
        ADAPTER.validate_python(
            {
                "chart_type": "deck_heatmap",
                **COORDINATES,
                "weight": {"name": "staff", "aggregate": "AVG"},
                "aggregation": "mean",
            }
        )
    )
    assert weighted["size"]["aggregate"] == "AVG"
    assert weighted["aggregation"] == "mean"


def test_default_point_maps_keep_their_form_data() -> None:
    """Options left out change nothing: the form data is the one of before."""
    adhoc_filters = [
        {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": column,
            "operator": operator,
            **({"comparator": 0} if operator == "!=" else {}),
        }
        for column in ("lat", "lon")
        for operator in ("IS NOT NULL", "!=")
    ]
    spatial = {"type": "latlong", "latCol": "lat", "lonCol": "lon"}
    scatter = map_config_to_form_data(
        ADAPTER.validate_python({"chart_type": "deck_scatter", **COORDINATES})
    )
    assert scatter == {
        "viz_type": "deck_scatter",
        "spatial": spatial,
        "point_radius_fixed": {"type": "fix", "value": 300},
        "point_unit": "radius_m",
        "min_radius": 3,
        "max_radius": 40,
        "multiplier": 1,
        "color_picker": {"r": 37, "g": 99, "b": 235, "a": 1},
        "color_scheme_type": "fixed_color",
        "map_renderer": "maplibre",
        "autozoom": True,
        "filter_nulls": True,
        "row_limit": 10000,
        "adhoc_filters": adhoc_filters,
    }
    heatmap = map_config_to_form_data(
        ADAPTER.validate_python({"chart_type": "deck_heatmap", **COORDINATES})
    )
    assert heatmap == {
        "viz_type": "deck_heatmap",
        "spatial": spatial,
        "size": {
            "expressionType": "SQL",
            "sqlExpression": "COUNT(*)",
            "label": "COUNT(*)",
            "hasCustomLabel": False,
        },
        "aggregation": "sum",
        "radius_pixels": 30,
        "intensity": 1,
        "color_scheme_type": "linear_palette",
        "map_renderer": "maplibre",
        "autozoom": True,
        "filter_nulls": True,
        "row_limit": 10000,
        "adhoc_filters": adhoc_filters,
    }
    cluster = map_config_to_form_data(
        ADAPTER.validate_python({"chart_type": "point_cluster_map", **COORDINATES})
    )
    assert cluster["maplibre_style"] == "https://tiles.openfreemap.org/styles/liberty"
    assert "tooltip_contents" not in scatter
    assert "tooltip_contents" not in heatmap
    assert "linear_color_scheme" not in heatmap
    assert "legend_position" not in scatter


def test_deck_tooltip_fields_reach_the_form_data_and_the_query() -> None:
    config = ADAPTER.validate_python(
        {
            "chart_type": "deck_scatter",
            **COORDINATES,
            "tooltip_fields": [{"name": "establecimiento"}, {"name": "clues"}],
        }
    )
    form_data = map_config_to_form_data(config)
    assert form_data["tooltip_contents"] == [
        {"item_type": "column", "column_name": "establecimiento"},
        {"item_type": "column", "column_name": "clues"},
    ]
    assert _query(form_data)["columns"] == [
        "lon",
        "lat",
        "establecimiento",
        "clues",
    ]
    heatmap = map_config_to_form_data(
        ADAPTER.validate_python(
            {
                "chart_type": "deck_heatmap",
                **COORDINATES,
                "tooltip_fields": [{"name": "municipio"}],
            }
        )
    )
    assert heatmap["tooltip_contents"] == [
        {"item_type": "column", "column_name": "municipio"}
    ]
    assert _query(heatmap)["columns"] == ["lon", "lat", "municipio"]


@pytest.mark.parametrize(
    ("style", "url"),
    [
        ("light", None),
        ("dark", "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"),
        ("streets", "https://tiles.openfreemap.org/styles/liberty"),
    ],
)
def test_map_style_sets_the_base_map(style: str, url: str | None) -> None:
    for chart_type in ("deck_scatter", "deck_heatmap"):
        form_data = map_config_to_form_data(
            ADAPTER.validate_python(
                {"chart_type": chart_type, **COORDINATES, "map_style": style}
            )
        )
        assert form_data.get("maplibre_style") == url
    cluster = map_config_to_form_data(
        ADAPTER.validate_python(
            {"chart_type": "point_cluster_map", **COORDINATES, "map_style": style}
        )
    )
    expected = url or "https://tiles.openfreemap.org/styles/liberty"
    assert cluster["maplibre_style"] == expected


def test_heatmap_color_scheme_sets_the_linear_palette() -> None:
    form_data = map_config_to_form_data(
        ADAPTER.validate_python(
            {
                "chart_type": "deck_heatmap",
                **COORDINATES,
                "color_scheme": "schemeViridis",
            }
        )
    )
    assert form_data["linear_color_scheme"] == "schemeViridis"
    assert form_data["color_scheme_type"] == "linear_palette"


@pytest.mark.parametrize(
    "config",
    [
        # A tooltip shows columns, not metrics
        {
            "chart_type": "deck_scatter",
            **COORDINATES,
            "tooltip_fields": [{"name": "staff", "aggregate": "SUM"}],
        },
        {
            "chart_type": "deck_heatmap",
            **COORDINATES,
            "tooltip_fields": [{"name": "staff", "aggregate": "SUM"}],
        },
        {
            "chart_type": "deck_heatmap",
            **COORDINATES,
            "tooltip_fields": [{"name": f"c{i}"} for i in range(11)],
        },
        # Only the listed base maps and heatmap ramps exist
        {"chart_type": "deck_scatter", **COORDINATES, "map_style": "satellite"},
        {"chart_type": "point_cluster_map", **COORDINATES, "map_style": "satellite"},
        {"chart_type": "deck_heatmap", **COORDINATES, "color_scheme": "schemeRdBu"},
    ],
)
def test_new_map_options_are_refused(config: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        ADAPTER.validate_python(config)


def test_country_map_form_data() -> None:
    config = ADAPTER.validate_python(
        {
            "chart_type": "country_map",
            "select_country": "México",
            "entity": {"name": "state_iso"},
            "metric": {"name": "sales", "aggregate": "SUM"},
        }
    )
    assert isinstance(config, CountryMapChartConfig)
    form_data = map_config_to_form_data(config)
    assert form_data["viz_type"] == "country_map"
    assert form_data["select_country"] == "mexico"
    assert form_data["entity"] == "state_iso"
    assert form_data["metric"]["aggregate"] == "SUM"


@pytest.mark.parametrize(
    ("written", "key"),
    [("Mexico", "mexico"), ("United Kingdom", "uk"), ("usa", "usa")],
)
def test_country_names_are_read_loosely(written: str, key: str) -> None:
    config = CountryMapChartConfig(
        country=written,
        region={"name": "iso"},
        metric={"name": "x", "aggregate": "SUM"},
    )
    assert config.country == key


def test_unknown_country_suggests_the_close_ones() -> None:
    with pytest.raises(ValidationError, match="Did you mean: mexico"):
        CountryMapChartConfig(
            country="mexic",
            region={"name": "iso"},
            metric={"name": "x", "aggregate": "SUM"},
        )


@pytest.mark.parametrize(
    "config",
    [
        # Coordinates are columns, never metrics
        {
            "chart_type": "deck_heatmap",
            "latitude": {"name": "lat", "aggregate": "SUM"},
            "longitude": {"name": "lon"},
        },  # noqa: E501
        {
            "chart_type": "point_cluster_map",
            "latitude": {"sql_expression": "AVG(lat)", "label": "a"},
            "longitude": {"name": "lon"},
        },  # noqa: E501
        # Sizes and weights are metrics
        {"chart_type": "deck_scatter", **COORDINATES, "point_size": {"name": "staff"}},
        {"chart_type": "deck_heatmap", **COORDINATES, "weight": {"name": "staff"}},
        # The category and the cluster label are columns
        {
            "chart_type": "deck_scatter",
            **COORDINATES,
            "color_by": {"name": "x", "aggregate": "SUM"},
        },  # noqa: E501
        {
            "chart_type": "point_cluster_map",
            **COORDINATES,
            "label": {"name": "x", "saved_metric": True},
        },  # noqa: E501
        # Out of the controls' range
        {
            "chart_type": "deck_scatter",
            **COORDINATES,
            "min_radius": 50,
            "max_radius": 10,
        },
        {"chart_type": "deck_heatmap", **COORDINATES, "radius_pixels": 33},
        {"chart_type": "point_cluster_map", **COORDINATES, "clustering_radius": 50},
        {"chart_type": "deck_scatter", **COORDINATES, "color": "blue"},
        # Missing coordinates
        {"chart_type": "deck_scatter", "latitude": {"name": "lat"}},
        # The region is a column of codes, not a metric
        {
            "chart_type": "country_map",
            "country": "mexico",
            "region": {"name": "iso", "aggregate": "MAX"},
            "metric": {"name": "x", "aggregate": "SUM"},
        },  # noqa: E501
        {
            "chart_type": "country_map",
            "country": "mexico",
            "region": {"name": "iso"},
            "metric": {"name": "x"},
        },  # noqa: E501
    ],
)
def test_invalid_map_configs_are_refused(config: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        ADAPTER.validate_python(config)


def test_point_cluster_map_query_reads_one_row_per_point() -> None:
    form_data = map_config_to_form_data(
        ADAPTER.validate_python(
            {
                "chart_type": "point_cluster_map",
                **COORDINATES,
                "label": {"name": "staff"},
            }
        )
    )
    assert point_cluster_map_columns(form_data) == ["lon", "lat", "staff"]
    query = _query(form_data)
    assert query["columns"] == ["lon", "lat", "staff"]
    assert query["metrics"] == []
    assert query["row_limit"] == 5


def test_point_cluster_map_counts_points_without_a_label() -> None:
    assert point_cluster_map_columns(
        {"all_columns_x": "lon", "all_columns_y": "lat", "map_label": ["count"]}
    ) == ["lon", "lat"]


def _context(**types: str) -> SimpleNamespace:
    return SimpleNamespace(
        available_columns=[{"name": name, "type": kind} for name, kind in types.items()]
    )


def test_text_coordinates_are_refused() -> None:
    plugin = registry.get("deck_scatter")
    config = ADAPTER.validate_python({"chart_type": "deck_scatter", **COORDINATES})
    with patch(
        "superset.mcp_service.chart.plugins.maps.DatasetValidator._get_dataset_context",
        return_value=_context(lat="VARCHAR", lon="DOUBLE PRECISION", staff="BIGINT"),
    ):
        error = plugin.post_map_validate(config, {}, dataset_id=1)
    assert error is not None
    assert error.error_code == "NON_NUMERIC_MAP_COORDINATES"
    assert "'lat' (VARCHAR)" in error.message
    assert "lon, staff" in error.suggestions[0]


def test_numeric_coordinates_pass() -> None:
    plugin = registry.get("deck_heatmap")
    config = ADAPTER.validate_python({"chart_type": "deck_heatmap", **COORDINATES})
    with patch(
        "superset.mcp_service.chart.plugins.maps.DatasetValidator._get_dataset_context",
        return_value=_context(lat="FLOAT", lon="DOUBLE PRECISION"),
    ):
        assert plugin.post_map_validate(config, {}, dataset_id=1) is None


@pytest.mark.parametrize(
    ("values", "refused"),
    [
        (["QUERÉTARO", "JALISCO"], True),
        (["MX-QUE", "MX-JAL"], False),
        (["MX-QUE", "Sin estado"], False),
        ([], False),
    ],
)
def test_country_map_refuses_region_names(values: list[str], refused: bool) -> None:
    plugin = registry.get("country_map")
    config = ADAPTER.validate_python(
        {
            "chart_type": "country_map",
            "country": "mexico",
            "region": {"name": "estado"},
            "metric": {"name": "sales", "aggregate": "SUM"},
        }
    )
    with patch(
        "superset.mcp_service.chart.plugins.maps._sample_region_values",
        return_value=values,
    ):
        error = plugin.post_map_validate(config, {}, dataset_id=1)
    assert (error is not None) is refused
    if error is not None:
        assert error.error_code == "COUNTRY_MAP_REGION_NOT_ISO"
        assert "QUERÉTARO" in error.message


def test_country_list_matches_the_frontend() -> None:
    countries_ts = (
        Path(__file__).parents[4]
        / "superset-frontend/plugins/plugin-chart-country-map/src/countries.ts"
    )
    if not countries_ts.exists():
        pytest.skip("The frontend sources are not in this checkout")
    source = countries_ts.read_text(encoding="utf-8")
    body = source.split("export const countries = {", 1)[1].split("};", 1)[0]
    keys = set(re.findall(r"^\s*([a-z_]+),?\s*$", body, flags=re.MULTILINE))
    assert keys == COUNTRY_MAP_COUNTRIES


def test_create_visual_reports_a_refused_country_map_as_invalid() -> None:
    """The check on the data reaches the AI as an error of the chart, not a crash."""
    from superset.mcp_service.report_layout.editing import LayoutEditError
    from superset.mcp_service.report_layout.visuals import prepare_chart

    with (
        patch(
            "superset.mcp_service.chart.chart_utils.find_accessible_dataset",
            return_value=SimpleNamespace(id=1),
        ),
        patch(
            "superset.mcp_service.chart.plugins.maps._sample_region_values",
            return_value=["QUERÉTARO"],
        ),
        patch(
            "superset.mcp_service.chart.validation.ValidationPipeline."
            "validate_request_with_warnings",
            side_effect=lambda data: SimpleNamespace(
                is_valid=True,
                warnings=None,
                request=SimpleNamespace(
                    dataset_id=1, config=ADAPTER.validate_python(data["config"])
                ),
            ),
        ),
        pytest.raises(LayoutEditError, match="holds names") as raised,
    ):
        prepare_chart(
            1,
            {
                "chart_type": "country_map",
                "country": "mexico",
                "region": {"name": "estado"},
                "metric": {"name": "sales", "aggregate": "SUM"},
            },
            None,
        )
    assert raised.value.error_type == "InvalidChart"
