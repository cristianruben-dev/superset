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
The charts of a report, as the side panel of the report editor makes and
changes them: a chart is created with its place on a page, and its fields,
dataset and sort are saved on the chart itself (``saveChartFields``,
``saveChartParams`` in the frontend).

A chart setting the layout also holds (``meta.auradataFormat.chart``) wins over
the chart's saved form data, so every write here moves the keys it changes out
of the chart's own format, as the editor does, and reports the keys the shared
format of the report still overrides. A write never succeeds silently while
the report keeps showing the old value.

The ``query_context`` of a changed chart is cleared, as ``update_chart`` does:
the frontend builds it with ``buildQuery`` (post-processing, ordering, base
axis), which Python cannot rebuild exactly, and a query context that differs
from the chart is worse than none. Reports regenerate a missing one through a
screenshot (``_update_query_context``), and data reads use the params.
"""

from __future__ import annotations

import copy
import logging
from dataclasses import dataclass, field
from typing import Any

from superset.auradata.layout import keys, shared_visual_format
from superset.auradata.layout.sort import DatasetColumn
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    open_report,
    Report,
    resolve_object,
    save_report,
)
from superset.utils import json

logger = logging.getLogger(__name__)


def _reraise(ex: Exception) -> None:
    raise ex


def in_one_transaction(func: Any) -> Any:
    """Runs commands in one commit: everything is saved or nothing is."""
    from superset.utils.decorators import transaction

    return transaction(on_error=_reraise)(func)


# Chart specs


@dataclass
class PreparedChart:
    """A chart spec checked, mapped to form data and compiled."""

    dataset: Any
    form_data: dict[str, Any]
    name: str
    warnings: list[str] = field(default_factory=list)


def describe_error(error: Any) -> str:
    """A chart generation error as one readable message, with its hints."""
    if error is None:
        return "The chart is not valid."
    if isinstance(error, str):
        return error
    parts = [getattr(error, "message", None) or str(error)]
    if details := getattr(error, "details", None):
        parts.append(str(details))
    if suggestions := getattr(error, "suggestions", None):
        parts.append("Suggestions: " + "; ".join(str(s) for s in suggestions))
    return " ".join(parts)


def _time_filter(item: dict[str, str]) -> dict[str, Any]:
    return {
        "clause": "WHERE",
        "expressionType": "SIMPLE",
        "subject": item["column"],
        "operator": "TEMPORAL_RANGE",
        "comparator": item["range"],
    }


def prepare_chart(
    dataset_id: int | str,
    config: dict[str, Any],
    chart_name: str | None,
    time_filters: list[dict[str, str]] | None = None,
) -> PreparedChart:
    """
    Check a chart spec as ``generate_chart`` does before saving: the validation
    pipeline, the mapping to form data, the user's access to the dataset and a
    compile check of its query, so a broken chart is never saved. ``time_filters``
    join the filters of the chart, as the Filters well holds a time range.
    """
    from superset.mcp_service.chart.chart_utils import (
        find_accessible_dataset,
        generate_chart_name,
        map_config_to_form_data,
    )
    from superset.mcp_service.chart.compile import _compile_chart
    from superset.mcp_service.chart.validation import ValidationPipeline

    result = ValidationPipeline.validate_request_with_warnings(
        {
            "dataset_id": dataset_id,
            "config": config,
            "chart_name": chart_name,
            "save_chart": True,
            "generate_preview": False,
        }
    )
    if not result.is_valid or result.request is None:
        raise LayoutEditError(describe_error(result.error), "InvalidChart")
    request = result.request
    warnings: list[str] = list(getattr(request, "sanitization_warnings", []) or [])
    if result.warnings:
        warnings += result.warnings.get("warnings", [])

    dataset = find_accessible_dataset(request.dataset_id)
    if not dataset:
        raise LayoutEditError(
            f"Dataset not found: {request.dataset_id!r}. Use list_datasets.",
            "NotFound",
        )
    form_data = map_config_to_form_data(request.config, dataset_id=dataset.id)
    warnings += form_data.pop("_mcp_warnings", [])
    if time_filters:
        form_data["adhoc_filters"] = [
            *form_data.get("adhoc_filters", []),
            *(_time_filter(item) for item in time_filters),
        ]
    compiled = _compile_chart(form_data, dataset.id)
    if not compiled.success:
        raise LayoutEditError(
            describe_error(compiled.error_obj or compiled.error), "CompileError"
        )
    warnings += compiled.warnings
    dataset_name = getattr(dataset, "datasource_name", None) or getattr(
        dataset, "table_name", None
    )
    name = request.chart_name or generate_chart_name(
        request.config, dataset_name=dataset_name
    )
    return PreparedChart(dataset, form_data, name, warnings)


def compile_or_refuse(form_data: dict[str, Any], dataset_id: int) -> list[str]:
    """
    Run the query of a changed chart once before saving it, as the editor
    never saves a chart that cannot draw itself; returns its warnings.
    """
    from superset.mcp_service.chart.compile import _compile_chart

    compiled = _compile_chart(copy.deepcopy(form_data), dataset_id)
    if not compiled.success:
        raise LayoutEditError(
            "The chart would not draw with these settings, so nothing was "
            "saved: " + describe_error(compiled.error_obj or compiled.error),
            "CompileError",
        )
    return list(compiled.warnings)


def command_error(ex: Exception) -> LayoutEditError:
    """A chart command's refusal as the error a tool returns."""
    from superset.commands.chart.exceptions import (
        ChartForbiddenError,
        ChartInvalidError,
        ChartNotFoundError,
        DashboardsForbiddenError,
    )

    if isinstance(ex, (ChartForbiddenError, DashboardsForbiddenError)):
        return LayoutEditError(
            "You don't have permission to change this chart.", "Forbidden"
        )
    if isinstance(ex, ChartNotFoundError):
        return LayoutEditError("Chart not found.", "NotFound")
    if isinstance(ex, ChartInvalidError):
        return LayoutEditError(
            f"The chart was refused: {ex.normalized_messages()}", "InvalidRequest"
        )
    return LayoutEditError(f"The chart could not be saved: {ex}", "DatabaseError")


# Datasets


@dataclass
class DatasetFields:
    """The columns and saved metrics of a dataset, by name."""

    columns: dict[str, DatasetColumn]
    metrics: set[str]


def dataset_fields(dataset: Any) -> DatasetFields:
    columns = {
        column.column_name: DatasetColumn(
            generic_type=_generic_type(column), is_dttm=bool(column.is_dttm)
        )
        for column in getattr(dataset, "columns", None) or []
    }
    metrics = {metric.metric_name for metric in getattr(dataset, "metrics", None) or []}
    return DatasetFields(columns, metrics)


def _generic_type(column: Any) -> int | None:
    try:
        kind = column.type_generic
    except Exception:  # pylint: disable=broad-except
        return None
    return int(kind) if kind is not None else None


# The charts of a report


def chart_of(report: Report, ref: str | int) -> tuple[str, Any]:
    """A chart object of the report and its chart."""
    component_id = resolve_object(report, ref)
    item = report.layout[component_id]
    if item.get("type") != keys.CHART_TYPE:
        raise LayoutEditError(f"{component_id!r} is not a chart.")
    chart_id = (item.get("meta") or {}).get("chartId")
    chart = next((c for c in report.dashboard.slices or [] if c.id == chart_id), None)
    if chart is None:
        raise LayoutEditError(
            f"Chart {chart_id} of {component_id!r} is not on this dashboard.",
            "NotFound",
        )
    return component_id, chart


def params_of(chart: Any) -> dict[str, Any]:
    try:
        params = json.loads(chart.params or "{}")
    except (TypeError, ValueError):
        params = {}
    return params if isinstance(params, dict) else {}


def with_changes(form_data: dict[str, Any], changes: dict[str, Any]) -> dict[str, Any]:
    """Form data with some keys changed; None removes a key (``applyChanges``)."""
    result = {**form_data, **changes}
    for name, value in changes.items():
        if value is None:
            result.pop(name, None)
    return result


def changed_keys(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    return sorted(k for k in {*before, *after} if before.get(k) != after.get(k))


# The rule of ``meta.auradataFormat.chart``


@dataclass
class Unmasked:
    """What a chart write did to the layout settings that hide it."""

    moved: list[str] = field(default_factory=list)
    masked: list[str] = field(default_factory=list)
    formatted: list[str] = field(default_factory=list)

    def warnings(self) -> list[str]:
        notes = []
        if self.formatted:
            notes.append(
                "The report's format of this chart (format_visual) still sets "
                + ", ".join(self.formatted)
                + ", so the report keeps showing that value; change it with "
                "format_visual."
            )
        if self.moved:
            notes.append(
                "These settings were held by the report's layout and hid the "
                "chart's own value; they were moved to the chart: "
                + ", ".join(self.moved)
            )
        if self.masked:
            notes.append(
                "The shared visual format of the report still sets "
                + ", ".join(self.masked)
                + ", so the report keeps showing its value; change it with "
                "set_shared_visual_format."
            )
        return notes


def unmask(
    report: Report,
    chart_id: int,
    changed: list[str],
    keep: frozenset[str] = frozenset(),
) -> Unmasked:
    """
    Takes the changed keys out of the own format of every object of the chart
    (``recordFieldStep`` does the same), and names those the shared format of
    the report still sets: removing them there would restyle every chart.
    Keys in ``keep`` stay in the own format and are named instead.
    """
    result = Unmasked()
    for item in report.layout.values():
        if not (
            isinstance(item, dict)
            and item.get("type") == keys.CHART_TYPE
            and (item.get("meta") or {}).get("chartId") == chart_id
        ):
            continue
        own = item["meta"].get(keys.VISUAL_FORMAT_KEY)
        chart = own.get("chart") if isinstance(own, dict) else None
        if not isinstance(chart, dict):
            continue
        result.formatted += [
            name
            for name in changed
            if name in chart and name in keep and name not in result.formatted
        ]
        hit = [name for name in changed if name in chart and name not in keep]
        if hit:
            item["meta"][keys.VISUAL_FORMAT_KEY] = {
                **own,
                "chart": {k: v for k, v in chart.items() if k not in hit},
            }
            result.moved += [name for name in hit if name not in result.moved]
    shared = shared_visual_format(report.layout)
    shared_chart = shared.get("chart") if isinstance(shared, dict) else None
    if isinstance(shared_chart, dict):
        result.masked = [name for name in changed if name in shared_chart]
    return result


def write_chart(
    report: Report,
    chart: Any,
    after: dict[str, Any],
    datasource_id: int | None = None,
) -> tuple[list[str], Unmasked]:
    """
    Save new params on a chart of the report, with its query context cleared,
    and move the keys it changed out of the layout, in one transaction.
    """
    from superset.commands.chart.update import UpdateChartCommand
    from superset.commands.exceptions import CommandException

    before = params_of(chart)
    changed = changed_keys(before, after)
    if datasource_id is not None and datasource_id != chart.datasource_id:
        changed.append("datasource")
    if not changed:
        return [], Unmasked()
    payload: dict[str, Any] = {
        "params": json.dumps(after),
        "query_context": None,
    }
    if viz_type := after.get("viz_type"):
        payload["viz_type"] = viz_type
    if datasource_id is not None:
        payload["datasource_id"] = datasource_id
        payload["datasource_type"] = "table"
    chart_id = chart.id
    unmasked = unmask(report, chart_id, changed)

    @in_one_transaction
    def save() -> None:
        UpdateChartCommand(chart_id, payload).run()
        save_report(report)

    try:
        save()
    except LayoutEditError:
        raise
    except CommandException as ex:
        raise command_error(ex) from ex
    return changed, unmasked


def unmask_for_chart(chart: Any, changed: list[str]) -> list[str]:
    """
    After a chart was changed outside a report tool (``update_chart``): move the
    changed data keys (fields, filters, sort) out of its dashboard's layout,
    and say which keys still hide the change. Look settings of the format
    catalog stay in the layout: a chart spec rewrites them with defaults the
    user did not ask for. Returns the warnings to report.
    """
    from superset import security_manager
    from superset.auradata import catalog

    if not changed:
        return []
    # A chart spec rewrites the look settings with its defaults: the ones the
    # Format pane set in the layout stay, and the user is told
    dashboards = list(getattr(chart, "dashboards", None) or [])
    if not dashboards:
        return []
    look = frozenset(catalog.controls_of(chart.viz_type or ""))
    notes: list[str] = []
    for dashboard in dashboards:
        try:
            report = open_report(dashboard.id)
        except LayoutEditError:
            # A dashboard without a layout holds no settings
            continue
        result = unmask(report, chart.id, changed, look)
        if result.moved and not security_manager.can_edit_resource(dashboard):
            notes.append(
                f"Dashboard {dashboard.id} holds "
                + ", ".join(result.moved)
                + " in its layout and you can't edit it, so it keeps showing "
                "the old value."
            )
            continue
        if result.moved:
            try:
                save_report(report)
            except LayoutEditError as ex:
                notes.append(
                    f"Dashboard {dashboard.id} keeps "
                    + ", ".join(result.moved)
                    + f" in its layout, so it shows the old value: {ex.message}"
                )
                continue
        notes += result.warnings()
    return notes
