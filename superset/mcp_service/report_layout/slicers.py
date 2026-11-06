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
Slicers of a report for the MCP tools: a native filter of the dashboard drawn
on the canvas by a filter element (``auradata-filter``). A new slicer creates
both in one transaction, so it lands in one version; its options go where the
editor keeps them: the filter's own settings (name, multiple choice, sort,
default value, scope) in ``native_filter_configuration``, the way it is drawn
(variant, styles, selection, Apply button, hidden values) in the element.
"""

from __future__ import annotations

import copy
from typing import Any

from superset.auradata.layout import keys
from superset.auradata.layout._js import is_number
from superset.auradata.layout.elements import slicer_value_key
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    Report,
)

FILTER_TYPES = {"list": "filter_select", "range": "filter_range", "time": "filter_time"}
KIND_OF_FILTER = {value: key for key, value in FILTER_TYPES.items()}


def filter_config(dashboard: Any, filter_id: str) -> dict[str, Any]:
    """The native filter of a dashboard with this id."""
    from superset.mcp_service.dashboard.tool.manage_native_filters import (
        current_native_filter_config,
    )

    for conf in current_native_filter_config(dashboard):
        if conf.get("id") == filter_id:
            return copy.deepcopy(conf)
    raise LayoutEditError(
        f"The slicer shows filter {filter_id!r}, which the dashboard no longer has.",
        "NotFound",
    )


def check_dataset(dashboard: Any, dataset_id: int) -> None:
    """A slicer reads a dataset the user can read and the report may use: one
    of its workspace or a shared one, as a chart of the report would."""
    from superset import security_manager
    from superset.auradata.workspace_datasets import validate_chart_dataset
    from superset.daos.dataset import DatasetDAO

    dataset = DatasetDAO.find_by_id(dataset_id)
    if dataset is None or not security_manager.can_access_datasource(dataset):
        raise LayoutEditError(f"Dataset not found: {dataset_id}.", "NotFound")
    if error := validate_chart_dataset(dataset_id, "table", [dashboard.id]):
        raise LayoutEditError(str(error.messages[0]), "Forbidden")


def check_styles(filter_type: str, request: Any, element: dict[str, Any]) -> None:
    """Each way of drawing applies to one kind of filter, as FilterView draws
    them: variants to lists, range styles to ranges, date styles to times."""
    kind = KIND_OF_FILTER.get(filter_type, filter_type)
    rules = (
        ("variant", "variant", "list"),
        ("range_style", "rangeStyle", "range"),
        ("date_style", "dateStyle", "time"),
    )
    for name, key, needed in rules:
        asked = getattr(request, name, None)
        if asked is not None:
            element[key] = asked
        if element.get(key) is not None and kind != needed:
            raise LayoutEditError(
                f"{name} only applies to {needed} slicers; this one is a {kind} slicer."
            )


def element_options(request: Any, element: dict[str, Any]) -> dict[str, Any]:
    """The options of a request that the element keeps."""
    for name, key in (
        ("selection", "selection"),
        ("apply_button", "applyButton"),
        ("sort", "sortValues"),
        ("show_in_filter_bar", "showInFilterBar"),
    ):
        value = getattr(request, name, None)
        if value is not None:
            element[key] = value
    if request.hidden_values is not None:
        element["hiddenValues"] = [
            slicer_value_key(value) for value in request.hidden_values
        ]
        if not element["hiddenValues"]:
            element.pop("hiddenValues")
    return element


def select_extra_form_data(column: str, values: list[Any]) -> dict[str, Any]:
    """``getSelectExtraFormData`` of an exact match."""
    if not values:
        return {}
    return {"filters": [{"col": column, "op": "IN", "val": values}]}


def range_extra_form_data(column: str, lower: Any, upper: Any) -> dict[str, Any]:
    """``getRangeExtraFormData``: bounds that differ, or one equal value."""
    filters = []
    if lower is not None and lower != upper:
        filters.append({"col": column, "op": ">=", "val": lower})
    if upper is not None and upper != lower:
        filters.append({"col": column, "op": "<=", "val": upper})
    if upper is not None and lower is not None and upper == lower:
        filters.append({"col": column, "op": "==", "val": upper})
    return {"filters": filters} if filters else {}


def default_data_mask(conf: dict[str, Any], value: Any) -> dict[str, Any]:
    """The ``defaultDataMask`` of a filter for a default value, as the
    filter plugins write it."""
    from superset.mcp_service.dashboard.tool.manage_native_filters import (
        empty_data_mask,
        time_data_mask,
    )

    if value is None:
        return empty_data_mask()
    filter_type = conf.get("filterType")
    if filter_type == "filter_time":
        if not isinstance(value, str) or not value.strip():
            raise LayoutEditError(
                "A time slicer's default is a time range, like 'Last month' or "
                "'2024-01-01 : 2024-12-31'."
            )
        return time_data_mask(value.strip())
    column: Any = ((conf.get("targets") or [{}])[0].get("column") or {}).get("name")
    if filter_type == "filter_range":
        if (
            not isinstance(value, list)
            or len(value) != 2
            or not all(v is None or is_number(v) for v in value)
        ):
            raise LayoutEditError(
                "A range slicer's default is [min, max]; null leaves a side open."
            )
        lower, upper = value
        return {
            "filterState": {"value": [lower, upper]},
            "extraFormData": range_extra_form_data(column, lower, upper),
        }
    values = value if isinstance(value, list) else [value]
    multi = (conf.get("controlValues") or {}).get("multiSelect", True)
    if not multi and len(values) > 1:
        raise LayoutEditError("This slicer takes one value; give one default.")
    return {
        "filterState": {"value": values},
        "extraFormData": select_extra_form_data(column, values),
    }


def apply_filter_options(conf: dict[str, Any], request: Any) -> dict[str, Any]:
    """The options of a request that the native filter keeps."""
    if request.name is not None:
        conf["name"] = request.name
    controls = dict(conf.get("controlValues") or {})
    if conf.get("filterType") == "filter_select":
        if request.selection is not None:
            # A filter of one value keeps one, whatever the slicer says
            controls["multiSelect"] = request.selection != "single"
        if request.sort is not None:
            controls["sortAscending"] = request.sort == "asc"
    elif request.selection is not None or request.sort is not None:
        raise LayoutEditError("selection and sort only apply to list slicers.")
    conf["controlValues"] = controls
    return conf


def page_scope(report: Report, page_id: str) -> dict[str, Any]:
    """The scope of a filter of one page; a report of one page is the report."""
    if page_id == keys.GRID_ID:
        return {"rootPath": [keys.ROOT_ID], "excluded": []}
    return {"rootPath": [page_id], "excluded": []}


def slicer_summary(conf: dict[str, Any]) -> dict[str, Any]:
    """What the tools say about the filter of a slicer."""
    target = (conf.get("targets") or [{}])[0] or {}
    return {
        "id": conf.get("id"),
        "name": conf.get("name"),
        "type": KIND_OF_FILTER.get(conf.get("filterType") or ""),
        "dataset_id": target.get("datasetId"),
        "column": (target.get("column") or {}).get("name"),
        "scope": conf.get("scope"),
        "multi_select": (conf.get("controlValues") or {}).get("multiSelect"),
        "default": ((conf.get("defaultDataMask") or {}).get("filterState") or {}).get(
            "value"
        ),
    }


def save_with_filter(report: Report, conf: dict[str, Any]) -> None:
    """Saves a native filter and the layout in one transaction, so a refusal
    of either leaves both as they were."""
    from superset.commands.dashboard.exceptions import (
        DashboardForbiddenError,
        DashboardInvalidError,
        DashboardNativeFiltersUpdateFailedError,
    )
    from superset.commands.dashboard.update import (
        UpdateDashboardNativeFiltersCommand,
    )
    from superset.mcp_service.report_layout.editing import save_report
    from superset.mcp_service.report_layout.visuals import in_one_transaction

    @in_one_transaction
    def save() -> None:
        try:
            UpdateDashboardNativeFiltersCommand(
                report.dashboard.id, {"modified": [conf]}
            ).run()
        except DashboardForbiddenError as ex:
            raise LayoutEditError(
                "You don't have permission to edit this dashboard.", "Forbidden"
            ) from ex
        except DashboardInvalidError as ex:
            raise LayoutEditError(
                f"The dashboard refused the filter: {ex.normalized_messages()}"
            ) from ex
        except DashboardNativeFiltersUpdateFailedError as ex:
            raise LayoutEditError("Failed to save the filter.", "DatabaseError") from ex
        save_report(report)

    save()
