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
"""Map chart type plugins: points, clusters, heat and regions of a country.

The point maps draw on a MapLibre base, which needs no API key, and fit their
view to the points, so a config never carries a viewport.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from copy import deepcopy
from typing import Any, ClassVar

from superset.mcp_service.chart.chart_utils import (
    _summarize_filters,
    map_country_map_config,
    map_deck_heatmap_config,
    map_deck_scatter_config,
    map_point_cluster_map_config,
)
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    CountryMapChartConfig,
    DeckHeatmapChartConfig,
    DeckScatterChartConfig,
    PointClusterMapChartConfig,
    PointMapBaseConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import (
    DatasetValidator,
    is_numeric_column,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)

# An ISO 3166-2 subdivision code: the country, a dash and up to three characters
_ISO_REGION = re.compile(r"^[A-Z]{2}-[A-Z0-9]{1,3}$")
# Values of the region column read to judge whether it holds codes
_REGION_SAMPLE = 20

_COORDINATE_EXAMPLE = (
    "'latitude': {'name': 'latitud'}, 'longitude': {'name': 'longitud'}"
)


def _label(ref: ColumnRef) -> str:
    return ref.label or ref.name or ""


def _canonical_column(ref: dict[str, Any] | None, dataset_context: Any) -> None:
    if ref and ref.get("name") and not ref.get("sql_expression"):
        ref["name"] = DatasetValidator.get_canonical_column_name(
            ref["name"], dataset_context
        )


def _canonical_metric(ref: dict[str, Any] | None, dataset_context: Any) -> None:
    if not ref or ref.get("sql_expression") or not ref.get("name"):
        return
    if ref.get("saved_metric"):
        ref["name"] = DatasetValidator.get_canonical_metric_name(
            ref["name"], dataset_context
        )
    else:
        ref["name"] = DatasetValidator.get_canonical_column_name(
            ref["name"], dataset_context
        )


def _filter_refs(config: Any) -> list[ColumnRef]:
    return [ColumnRef(name=f.column) for f in config.filters or []]


class _PointMapPlugin(BaseChartPlugin):
    """What the three maps of coordinates share."""

    config_class: ClassVar[type[PointMapBaseConfig]]
    #: Columns of the config, besides the coordinates
    column_fields: ClassVar[tuple[str, ...]] = ()
    #: Metrics of the config
    metric_fields: ClassVar[tuple[str, ...]] = ()
    #: Lists of columns of the config
    column_list_fields: ClassVar[tuple[str, ...]] = ()

    def pre_validate(self, config: dict[str, Any]) -> ChartGenerationError | None:
        has_lat = any(k in config for k in ("latitude", "lat"))
        has_lon = any(k in config for k in ("longitude", "lon", "lng"))
        if has_lat and has_lon:
            return None
        return ChartGenerationError(
            error_type="missing_map_coordinates",
            message=(f"A {self.display_name} needs 'latitude' and 'longitude' columns"),
            details="Each row is placed on the map by its two coordinates",
            suggestions=[
                "Use get_dataset_info to find the latitude and longitude columns",
                f"Example: {{'chart_type': '{self.chart_type}', "
                f"{_COORDINATE_EXAMPLE}}}",
            ],
            error_code="MISSING_MAP_COORDINATES",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, self.config_class):
            return []
        refs: list[ColumnRef] = [config.latitude, config.longitude]
        for field in self.column_fields + self.metric_fields:
            if (ref := getattr(config, field)) is not None:
                refs.append(ref)
        for field in self.column_list_fields:
            refs.extend(getattr(config, field) or [])
        return refs + _filter_refs(config)

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """Coordinates must be numeric columns, as the map controls ask."""
        if not isinstance(config, self.config_class) or dataset_id is None:
            return None
        dataset_context = DatasetValidator._get_dataset_context(dataset_id)
        if dataset_context is None:
            return None
        columns = {
            col["name"].lower(): col for col in dataset_context.available_columns
        }
        wrong = [
            f"'{ref.name}' ({columns[ref.name.lower()].get('type', 'UNKNOWN')})"
            for ref in (config.latitude, config.longitude)
            if ref.name
            and ref.name.lower() in columns
            and not is_numeric_column(columns[ref.name.lower()])
        ]
        if not wrong:
            return None
        numeric = sorted(
            col["name"]
            for col in dataset_context.available_columns
            if is_numeric_column(col)
        )
        return ChartGenerationError(
            error_type="non_numeric_map_coordinates",
            message=f"Map coordinates must be numeric; got {', '.join(wrong)}",
            details=(
                "Latitude and longitude are decimal degrees. A text column of "
                "coordinates needs a calculated column that casts it first."
            ),
            suggestions=(
                [f"Numeric columns in this dataset: {', '.join(numeric)}"]
                if numeric
                else ["Use get_dataset_info to inspect the dataset's columns"]
            ),
            error_code="NON_NUMERIC_MAP_COORDINATES",
        )

    def resolve_viz_type(self, config: Any) -> str:
        return self.chart_type

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        for field in ("latitude", "longitude", *self.column_fields):
            _canonical_column(config_dict.get(field), dataset_context)
        for field in self.metric_fields:
            _canonical_metric(config_dict.get(field), dataset_context)
        for field in self.column_list_fields:
            for ref in config_dict.get(field) or []:
                _canonical_column(ref, dataset_context)
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return self.config_class.model_validate(config_dict)

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = self._what(config)
        return self._with_context(what, _summarize_filters(config.filters))

    def _what(self, config: Any) -> str:
        return "Points on a map"

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type=f"{self.chart_type}_validation_error",
            message=f"{self.display_name} configuration validation failed",
            details=(
                "Point maps take numeric 'latitude' and 'longitude' columns. "
                "They need no API key and fit their view to the points."
            ),
            suggestions=[
                f"Example: {{'chart_type': '{self.chart_type}', "
                f"{_COORDINATE_EXAMPLE}}}",
                "Use get_chart_type_schema for every field of this chart type",
            ],
            error_code=f"{self.chart_type.upper()}_VALIDATION_ERROR",
        )


class PointClusterMapChartPlugin(_PointMapPlugin):
    """Points on a map, grouped into clusters as they get close."""

    chart_type = "point_cluster_map"
    display_name = "Point cluster map"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "point_cluster_map": "Point Cluster Map",
    }
    config_class = PointClusterMapChartConfig
    column_fields = ("label",)

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_point_cluster_map_config(config)

    def _what(self, config: Any) -> str:
        if config.label:
            return f"{config.label_aggregate} of {_label(config.label)} on a map"
        return "Points on a map"


class DeckScatterChartPlugin(_PointMapPlugin):
    """A circle per row on a map, colored and sized by the data."""

    chart_type = "deck_scatter"
    display_name = "Scatter map"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "deck_scatter": "deck.gl Scatterplot",
    }
    config_class = DeckScatterChartConfig
    column_fields = ("color_by",)
    column_list_fields = ("tooltip_fields",)
    metric_fields = ("point_size",)

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_deck_scatter_config(config)

    def _what(self, config: Any) -> str:
        what = "Points on a map"
        if config.point_size:
            what = f"{_label(config.point_size)} on a map"
        if config.color_by:
            what += f" by {_label(config.color_by)}"
        return what


class DeckHeatmapChartPlugin(_PointMapPlugin):
    """Where points gather, as a glow over a map."""

    chart_type = "deck_heatmap"
    display_name = "Heatmap"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "deck_heatmap": "deck.gl Heatmap",
    }
    config_class = DeckHeatmapChartConfig
    column_list_fields = ("tooltip_fields",)
    metric_fields = ("weight",)

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_deck_heatmap_config(config)

    def _what(self, config: Any) -> str:
        if config.weight:
            return f"Density of {_label(config.weight)}"
        return "Density of points"


class CountryMapChartPlugin(BaseChartPlugin):
    """The regions of one country, colored by a metric."""

    chart_type = "country_map"
    display_name = "Country map"
    native_viz_types: ClassVar[Mapping[str, str]] = {
        "country_map": "Country Map",
    }

    def pre_validate(self, config: dict[str, Any]) -> ChartGenerationError | None:
        missing = [
            label
            for keys, label in (
                (("country", "select_country"), "'country' (e.g. 'mexico')"),
                (("region", "entity"), "'region' (column of ISO 3166-2 codes)"),
                (("metric",), "'metric' (value that colors each region)"),
            )
            if not any(k in config for k in keys)
        ]
        if not missing:
            return None
        return ChartGenerationError(
            error_type="missing_country_map_fields",
            message=f"Country map missing required fields: {', '.join(missing)}",
            details=(
                "A country map colors the regions of one country by a metric, "
                "matching them by ISO 3166-2 code (e.g. 'MX-QUE')"
            ),
            suggestions=[
                "Example: {'chart_type': 'country_map', 'country': 'mexico', "
                "'region': {'name': 'estado_iso'}, "
                "'metric': {'name': 'ventas', 'aggregate': 'SUM'}}",
            ],
            error_code="MISSING_COUNTRY_MAP_FIELDS",
        )

    def extract_column_refs(self, config: Any) -> list[ColumnRef]:
        if not isinstance(config, CountryMapChartConfig):
            return []
        return [config.region, config.metric] + _filter_refs(config)

    def to_form_data(
        self, config: Any, dataset_id: int | str | None = None
    ) -> dict[str, Any]:
        return map_country_map_config(config)

    def post_map_validate(
        self,
        config: Any,
        form_data: dict[str, Any],
        dataset_id: int | str | None = None,
    ) -> ChartGenerationError | None:
        """Refuse a region column of names: the map matches ISO codes only.

        A column of names compiles and runs, and the map then draws every
        region gray without a word, so a few of its values are read first.
        """
        if not isinstance(config, CountryMapChartConfig) or dataset_id is None:
            return None
        values = _sample_region_values(form_data, dataset_id)
        if not values or any(_ISO_REGION.match(value) for value in values):
            return None
        return ChartGenerationError(
            error_type="country_map_region_not_iso",
            message=(
                f"Column '{config.region.name}' holds names, not ISO 3166-2 "
                f"codes: {', '.join(values[:5])}"
            ),
            details=(
                "The country map matches regions by code only (e.g. 'MX-QUE' "
                "for Querétaro); with names every region stays gray. Only "
                "first-level regions (states or provinces) exist on the map."
            ),
            suggestions=[
                "Add a calculated column that turns the names into codes "
                "(add_calculated_column), e.g. CASE estado WHEN 'Querétaro' "
                "THEN 'MX-QUE' WHEN 'Jalisco' THEN 'MX-JAL' END",
                "For data with latitude and longitude, use 'deck_scatter', "
                "'point_cluster_map' or 'deck_heatmap'",
            ],
            error_code="COUNTRY_MAP_REGION_NOT_ISO",
        )

    def generate_name(self, config: Any, dataset_name: str | None = None) -> str:
        what = f"{_label(config.metric)} by {_label(config.region)}"
        return self._with_context(what, _summarize_filters(config.filters))

    def resolve_viz_type(self, config: Any) -> str:
        return "country_map"

    def normalize_column_refs(self, config: Any, dataset_context: Any) -> Any:
        config_dict = config.model_dump(exclude_unset=True)
        _canonical_column(config_dict.get("region"), dataset_context)
        _canonical_metric(config_dict.get("metric"), dataset_context)
        DatasetValidator.normalize_filters(config_dict, dataset_context)
        return CountryMapChartConfig.model_validate(config_dict)

    def schema_error_hint(self) -> ChartGenerationError | None:
        return ChartGenerationError(
            error_type="country_map_validation_error",
            message="Country map configuration validation failed",
            details=(
                "'country' is a lowercase English key ('mexico', 'spain', "
                "'usa'); 'region' a column of ISO 3166-2 codes ('MX-QUE'), "
                "never region names; only first-level regions (states or "
                "provinces) can be drawn, not municipalities"
            ),
            suggestions=[
                "Region names need a calculated column that turns them into "
                "codes, e.g. CASE estado WHEN 'Querétaro' THEN 'MX-QUE' ... END",
                "For data with coordinates, use 'deck_scatter', "
                "'point_cluster_map' or 'deck_heatmap' instead",
            ],
            error_code="COUNTRY_MAP_VALIDATION_ERROR",
        )


def _sample_region_values(
    form_data: dict[str, Any], dataset_id: int | str
) -> list[str]:
    """Read a few values of a country map's region column.

    Returns nothing when they cannot be read: the compile check that follows
    reports a query that fails.
    """
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.mcp_service.chart.chart_helpers import (
        build_query_context_from_form_data,
    )

    query_form_data = deepcopy(form_data)
    query_form_data["datasource"] = f"{dataset_id}__table"
    query_form_data["datasource_id"] = dataset_id
    query_form_data["datasource_type"] = "table"
    entity = form_data.get("entity")
    try:
        command = ChartDataCommand(
            build_query_context_from_form_data(
                query_form_data, row_limit=_REGION_SAMPLE, force=False
            )
        )
        command.validate()
        result = command.run()
    except Exception:  # pylint: disable=broad-except
        logger.warning("Could not read the regions of a country map", exc_info=True)
        return []
    rows = (result.get("queries") or [{}])[0].get("data") or []
    return [
        str(row[entity]).strip()
        for row in rows
        if isinstance(row, dict) and row.get(entity) is not None
    ]
