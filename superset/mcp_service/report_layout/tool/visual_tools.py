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
Visual tools: the charts of a report, made and changed from inside it as the
side panel of the report editor does. A chart is created with its place on a
page, in one transaction; its fields, dataset and sort are saved on the chart
(a chart belongs to one dashboard), following the rules of the Fields level
(``chartFields.ts``) and the sort menu (``sort/adapters.ts``).
"""

from typing import Any, Callable

from fastmcp import Context
from pydantic import ValidationError as PydanticValidationError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import (
    DEFAULT_OBJECT_COLUMNS,
    DEFAULT_OBJECT_ROWS,
    free_cell,
    keys,
)
from superset.auradata.layout.fields import (
    fields_kept_by,
    is_metric_well,
    ROLES,
    takes_list,
    well_names,
)
from superset.auradata.layout.sort import NUMERIC, Sort, sort_adapter_for
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import (
    append_in_new_row,
    box,
    LayoutEditError,
    open_report,
    refuse_overlaps,
    Report,
    resolve_page,
    save_report,
    set_box,
)
from superset.mcp_service.report_layout.schemas import CellBox
from superset.mcp_service.report_layout.visual_schemas import (
    ChangeVisualDatasetRequest,
    CreateVisualRequest,
    GetVisualFieldsRequest,
    SetVisualFieldsRequest,
    SetVisualSortRequest,
    VisualResponse,
)
from superset.mcp_service.report_layout.visuals import (
    chart_of,
    command_error,
    compile_or_refuse,
    dataset_fields,
    DatasetFields,
    in_one_transaction,
    params_of,
    prepare_chart,
    with_changes,
    write_chart,
)
from superset.utils import json

_WRITE: dict[str, Any] = {
    "tags": ["mutate", "layout", "visual"],
    "class_permission_name": "Chart",
    "method_permission_name": "write",
}


def _annotations(title: str, read_only: bool = False) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=read_only,
        destructiveHint=False,
        idempotentHint=read_only,
        openWorldHint=False,
    )


async def _run(
    name: str, ctx: Context, change: Callable[[], VisualResponse]
) -> VisualResponse:
    """Run a visual change, turning refusals into an error response."""
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return VisualResponse(
            error=ex.message,
            error_type=ex.error_type,
            permission_denied=ex.error_type == "Forbidden",
        )
    await ctx.info(f"{name}: changed {result.changed}")
    return result


# Field values


def _metric_value(value: Any, dataset: DatasetFields) -> Any:
    """A value of a well of values, as Explore saves it."""
    from superset.mcp_service.chart.chart_utils import create_metric_object
    from superset.mcp_service.chart.schemas import ColumnRef

    if isinstance(value, str):
        if value in dataset.metrics:
            return value
        column = dataset.columns.get(value)
        if column and column.generic_type == NUMERIC:
            # As the Data pane adds a number column: its sum
            return create_metric_object(ColumnRef(name=value, aggregate="SUM"))
        raise LayoutEditError(
            f"{value!r} is neither a saved metric nor a number column of the "
            f"dataset. Saved metrics: {sorted(dataset.metrics)}.",
            "InvalidField",
        )
    if isinstance(value, dict) and value.get("expressionType"):
        return value
    if isinstance(value, dict):
        try:
            ref = ColumnRef.model_validate(value)
        except PydanticValidationError as ex:
            raise LayoutEditError(
                f"Invalid value {value!r}: {ex.errors()[0]['msg']}", "InvalidField"
            ) from ex
        if ref.saved_metric and ref.name not in dataset.metrics:
            raise LayoutEditError(f"No saved metric {ref.name!r}.", "InvalidField")
        if not ref.sql_expression and not ref.saved_metric:
            if ref.name not in dataset.columns:
                raise LayoutEditError(
                    f"No column {ref.name!r} in the dataset.", "InvalidField"
                )
        return create_metric_object(ref)
    raise LayoutEditError(f"Invalid value {value!r} for a well of values.")


def _column_value(value: Any, dataset: DatasetFields) -> Any:
    """A value of a well of columns, as Explore saves it."""
    if isinstance(value, str):
        if value in dataset.columns:
            return value
        raise LayoutEditError(
            f"No column {value!r} in the dataset. Columns: {sorted(dataset.columns)}.",
            "InvalidField",
        )
    if isinstance(value, dict) and value.get("expressionType"):
        return value
    if isinstance(value, dict) and value.get("sql_expression"):
        expression = str(value["sql_expression"])
        return {
            "expressionType": "SQL",
            "sqlExpression": expression,
            "label": str(value.get("label") or expression),
        }
    raise LayoutEditError(f"Invalid value {value!r} for a well of columns.")


def _field_changes(
    form_data: dict[str, Any], fields: dict[str, Any], dataset: DatasetFields
) -> dict[str, Any]:
    """The form data changes that put these fields in their wells."""
    wells = well_names(form_data)
    viz_type = form_data.get("viz_type")
    if not wells:
        raise LayoutEditError(
            f"The report knows no field wells for {viz_type!r} charts; change "
            "them with update_chart.",
            "Unsupported",
        )
    changes: dict[str, Any] = {}
    for name, value in fields.items():
        if name not in wells:
            raise LayoutEditError(
                f"{name!r} is not a field well of {viz_type!r} charts. Wells: {wells}.",
                "InvalidField",
            )
        if value is None or value == []:
            changes[name] = [] if takes_list(name) else None
            continue
        normalize = _metric_value if is_metric_well(form_data, name) else _column_value
        values = value if isinstance(value, list) else [value]
        if takes_list(name):
            changes[name] = [normalize(v, dataset) for v in values]
        elif len(values) != 1:
            raise LayoutEditError(f"{name!r} takes one field.", "InvalidField")
        else:
            changes[name] = normalize(values[0], dataset)
    return changes


def _fields_of(form_data: dict[str, Any]) -> dict[str, Any]:
    return {
        name: form_data[name]
        for name in well_names(form_data)
        if form_data.get(name) not in (None, [])
    }


def _wells_of(form_data: dict[str, Any]) -> list[dict[str, Any]]:
    roles = ROLES.get(str(form_data.get("viz_type")), ())
    return [
        {
            "name": name,
            "kind": "value" if is_metric_well(form_data, name) else "column",
            "list": takes_list(name),
            "role": name in roles,
        }
        for name in well_names(form_data)
    ]


def _emptied(before: dict[str, Any], after: dict[str, Any]) -> list[str]:
    """Wells that had fields and have none: the chart could not draw."""
    return [
        name
        for name in well_names(before)
        if before.get(name) not in (None, []) and after.get(name) in (None, [])
    ]


def _response(
    report: Report,
    component_id: str,
    chart: Any,
    form_data: dict[str, Any],
    **extra: Any,
) -> VisualResponse:
    x, y, width, height = box(report, component_id)
    return VisualResponse(
        dashboard_id=report.dashboard.id,
        object_id=component_id,
        chart_id=chart.id,
        box=CellBox(x=x, y=y, width=width, height=height),
        viz_type=form_data.get("viz_type"),
        fields=_fields_of(form_data),
        **extra,
    )


def _dataset_of(chart: Any) -> Any:
    from superset.mcp_service.chart.chart_utils import find_accessible_dataset

    dataset = find_accessible_dataset(chart.datasource_id)
    if dataset is None:
        raise LayoutEditError(
            f"The dataset of chart {chart.id} is not accessible.", "NotFound"
        )
    return dataset


# Tools


def _place_chart(
    report: Report, page_id: str, chart: Any, request: CreateVisualRequest
) -> str:
    """Puts a new chart on a page, in a row of its own, as the editor does."""
    component_id = f"{keys.CHART_TYPE}-{chart.id}"
    while component_id in report.layout:
        component_id += "-1"
    width = request.width or DEFAULT_OBJECT_COLUMNS
    height = request.height or DEFAULT_OBJECT_ROWS
    report.layout[component_id] = {
        "type": keys.CHART_TYPE,
        "id": component_id,
        "children": [],
        "parents": [],
        "meta": {
            "chartId": chart.id,
            "sliceName": chart.slice_name,
            "uuid": str(chart.uuid),
            "width": width,
            "height": height,
        },
    }
    append_in_new_row(report, page_id, component_id)
    set_box(report, component_id, None, width, height)
    meta = report.layout[component_id]["meta"]
    if request.x is None and request.y is None:
        meta.pop(keys.POS_KEY, None)
        cell = free_cell(report.layout, page_id, meta["width"], meta["height"])
    else:
        cell = {"x": request.x or 0, "y": request.y or 0}
    set_box(report, component_id, cell)
    refuse_overlaps(report, page_id, [component_id], request.allow_overlap)
    return component_id


@tool(**_WRITE, annotations=_annotations("Create a visual in a report"))
async def create_visual(request: CreateVisualRequest, ctx: Context) -> VisualResponse:
    """Create a chart inside a report and place it on a page, in one step, as
    the report editor's side panel does: the chart belongs to this dashboard
    only and uses a dataset of the dashboard's workspace or a shared one.

    The spec is the one generate_chart takes (dataset_id + config with
    chart_type); it is validated and its query compiled before anything is
    saved. Without x and y the chart takes the first free cell of the page;
    it never covers another object unless allow_overlap. Format it later with
    format_visual, change its fields with set_visual_fields."""

    def change() -> VisualResponse:
        from superset import db
        from superset.auradata.workspace_datasets import validate_chart_dataset
        from superset.commands.chart.create import CreateChartCommand
        from superset.commands.exceptions import CommandException

        report = open_report(request.dashboard, edit=True)
        page_id = resolve_page(report, request.page)
        prepared = prepare_chart(
            request.dataset_id,
            request.config.model_dump(),
            request.chart_name,
        )
        if error := validate_chart_dataset(
            prepared.dataset.id, "table", [report.dashboard.id]
        ):
            raise LayoutEditError(str(error.messages[0]), "Conflict")

        @in_one_transaction
        def save() -> tuple[Any, str]:
            chart = CreateChartCommand(
                {
                    "slice_name": prepared.name,
                    "viz_type": prepared.form_data["viz_type"],
                    "datasource_id": prepared.dataset.id,
                    "datasource_type": "table",
                    "params": json.dumps(prepared.form_data),
                    "dashboards": [report.dashboard.id],
                }
            ).run()
            db.session.flush()
            component_id = _place_chart(report, page_id, chart, request)
            save_report(report)
            return chart, component_id

        try:
            chart, component_id = save()
        except LayoutEditError:
            raise
        except CommandException as ex:
            raise command_error(ex) from ex
        return _response(
            report,
            component_id,
            chart,
            prepared.form_data,
            page=page_id,
            changed=[component_id],
            warnings=prepared.warnings + report.warnings,
        )

    return await _run("create_visual", ctx, change)


@tool(
    tags=["layout", "visual"],
    class_permission_name="Chart",
    annotations=_annotations("Read the fields of a visual", read_only=True),
)
async def get_visual_fields(
    request: GetVisualFieldsRequest, ctx: Context
) -> VisualResponse:
    """The field wells of a chart of a report (as the Fields pane shows them),
    what each takes, and its sort with the choices set_visual_sort accepts."""

    def read() -> VisualResponse:
        report = open_report(request.dashboard)
        component_id, chart = chart_of(report, request.object)
        form_data = params_of(chart)
        adapter = sort_adapter_for(form_data.get("viz_type"))
        sort = adapter.current(form_data) if adapter else None
        options = (
            adapter.options(form_data, dataset_fields(_dataset_of(chart)).columns)
            if adapter
            else []
        )
        return _response(
            report,
            component_id,
            chart,
            form_data,
            wells=_wells_of(form_data),
            sort={"by": sort.by, "ascending": sort.ascending} if sort else None,
            sort_options=options,
        )

    return await _run("get_visual_fields", ctx, read)


@tool(**_WRITE, annotations=_annotations("Set the fields of a visual"))
async def set_visual_fields(
    request: SetVisualFieldsRequest, ctx: Context
) -> VisualResponse:
    """Put fields in the wells of a chart of a report (axis, legend, values,
    columns...), as the Fields pane and the Data pane do. The change is saved
    on the chart after its query compiles; a value the report's layout held
    over the chart moves to the chart, so the report shows the new fields."""

    def change() -> VisualResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, chart = chart_of(report, request.object)
        dataset = _dataset_of(chart)
        before = params_of(chart)
        after = with_changes(
            before, _field_changes(before, request.fields, dataset_fields(dataset))
        )
        if emptied := _emptied(before, after):
            raise LayoutEditError(
                f"The chart would lose every field of {emptied} and could not "
                "draw itself: give those wells a field.",
                "InvalidField",
            )
        warnings = compile_or_refuse(after, dataset.id)
        changed, unmasked = write_chart(report, chart, after)
        return _response(
            report,
            component_id,
            chart,
            after,
            changed=changed,
            moved_from_layout=unmasked.moved,
            warnings=warnings + unmasked.warnings(),
        )

    return await _run("set_visual_fields", ctx, change)


@tool(**_WRITE, annotations=_annotations("Change the dataset of a visual"))
async def change_visual_dataset(
    request: ChangeVisualDatasetRequest, ctx: Context
) -> VisualResponse:
    """Move a chart of a report to another dataset of the dashboard's workspace
    (or a shared one), as "Use this table in the chart" does: the fields and
    filters the new dataset lacks leave the chart (listed in dropped). A well
    left empty needs a replacement in fields, or the change is refused."""

    def change() -> VisualResponse:
        from superset.mcp_service.chart.chart_utils import find_accessible_dataset

        report = open_report(request.dashboard, edit=True)
        component_id, chart = chart_of(report, request.object)
        dataset = find_accessible_dataset(request.dataset_id)
        if dataset is None:
            raise LayoutEditError(
                f"Dataset not found: {request.dataset_id!r}.", "NotFound"
            )
        fields = dataset_fields(dataset)
        before = params_of(chart)
        dropped, _ = fields_kept_by(before, set(fields.columns), fields.metrics)
        changes = {**dropped, "datasource": f"{dataset.id}__table"}
        if request.fields:
            changes.update(
                _field_changes(with_changes(before, dropped), request.fields, fields)
            )
        after = with_changes(before, changes)
        if emptied := _emptied(before, after):
            raise LayoutEditError(
                f"The new dataset has nothing for {emptied}; pass replacement "
                "fields for those wells.",
                "InvalidField",
            )
        warnings = compile_or_refuse(after, dataset.id)
        changed, unmasked = write_chart(report, chart, after, datasource_id=dataset.id)
        return _response(
            report,
            component_id,
            chart,
            after,
            changed=changed,
            dropped={
                name: before.get(name)
                for name in dropped
                if name not in (request.fields or {})
            },
            moved_from_layout=unmasked.moved,
            warnings=warnings + unmasked.warnings(),
        )

    return await _run("change_visual_dataset", ctx, change)


@tool(**_WRITE, annotations=_annotations("Sort a visual"))
async def set_visual_sort(
    request: SetVisualSortRequest, ctx: Context
) -> VisualResponse:
    """Sort a chart of a report as its "Sort axis" menu does: bars, lines and
    areas by the axis, a metric or a series aggregate; pie and funnel by the
    metric or a dimension; tables by a column or metric; pivot tables by row
    labels (key) or values. Saved on the chart."""

    def change() -> VisualResponse:
        report = open_report(request.dashboard, edit=True)
        component_id, chart = chart_of(report, request.object)
        before = params_of(chart)
        viz_type = before.get("viz_type")
        adapter = sort_adapter_for(viz_type)
        if adapter is None:
            raise LayoutEditError(
                f"{viz_type!r} charts have no sort in the report.", "Unsupported"
            )
        options = adapter.options(before, dataset_fields(_dataset_of(chart)).columns)
        if request.by not in options:
            raise LayoutEditError(
                f"Cannot sort by {request.by!r}. Choices: {options or 'none'} "
                "(a time axis keeps its order).",
                "InvalidSort",
            )
        sort = Sort(request.by, request.ascending)
        after = with_changes(before, adapter.changes(before, sort))
        changed, unmasked = write_chart(report, chart, after)
        return _response(
            report,
            component_id,
            chart,
            after,
            changed=changed,
            sort={"by": sort.by, "ascending": sort.ascending},
            sort_options=options,
            moved_from_layout=unmasked.moved,
            warnings=unmasked.warnings(),
        )

    return await _run("set_visual_sort", ctx, change)
