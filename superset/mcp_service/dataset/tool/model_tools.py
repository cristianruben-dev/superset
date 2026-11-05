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
Tools that model a dataset: calculated columns, saved metrics and column
properties. Their rules live in ``superset.mcp_service.dataset.modeling``.
"""

import logging

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.dataset import modeling
from superset.mcp_service.dataset.modeling import ModelingError
from superset.mcp_service.dataset.schemas import (
    AddCalculatedColumnRequest,
    AddMetricRequest,
    DatasetModelResponse,
    DeleteDatasetItemRequest,
    SetColumnPropertiesRequest,
    UpdateCalculatedColumnRequest,
)

logger = logging.getLogger(__name__)


def _annotations(title: str, destructive: bool) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=False,
        openWorldHint=False,
    )


async def _refused(
    ctx: Context, error: ModelingError, dataset_id: int | str
) -> DatasetModelResponse:
    await ctx.warning("Dataset model change refused: %s" % (error.message,))
    return error.response(
        dataset_id=dataset_id if isinstance(dataset_id, int) else None
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Add calculated column", destructive=False),
)
async def add_calculated_column(
    request: AddCalculatedColumnRequest, ctx: Context
) -> DatasetModelResponse:
    """Add a calculated column to a dataset: a row-level SQL expression.

    The expression runs once on the dataset before it is saved, so a typo comes
    back as an error. Only the dataset's editors (and admins) change its model;
    a workspace role does not allow it.

    Example:
    ```json
    {"dataset_id": 12, "column_name": "size",
     "expression": "CASE WHEN total > 100 THEN 'big' ELSE 'small' END"}
    ```
    """
    await ctx.info(
        "Adding calculated column: dataset_id=%s, column=%r"
        % (request.dataset_id, request.column_name)
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        if modeling.named(dataset.columns, "column_name", request.column_name):
            raise ModelingError(
                f"The dataset already has a column named '{request.column_name}'.",
                "InvalidRequest",
            )
        modeling.check_expression(dataset, request.expression, "column")
        new = request.model_dump(exclude_none=True, exclude={"dataset_id"})
        updated = modeling.save(
            dataset, {"columns": modeling.column_payload(dataset, new=new)}
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    column = modeling.named(updated.columns, "column_name", request.column_name)
    return modeling.response(
        updated,
        column=modeling.column_detail(column) if column else None,
        changed=sorted(new),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Update calculated column", destructive=True),
)
async def update_calculated_column(
    request: UpdateCalculatedColumnRequest, ctx: Context
) -> DatasetModelResponse:
    """Change a calculated column of a dataset: expression, name, label or flags.

    Only the settings you pass change. A new expression runs once before it is
    saved. Physical columns have no expression: use set_column_properties for
    their label and flags. Renaming breaks charts that use the old name.

    Example:
    ```json
    {"dataset_id": 12, "column": "size", "expression": "total > 100"}
    ```
    """
    updates = request.updates()
    await ctx.info(
        "Updating calculated column: dataset_id=%s, column=%r, settings=%s"
        % (request.dataset_id, request.column, sorted(updates))
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        column = modeling.find_item(dataset.columns, request.column, "column_name")
        if not modeling.is_calculated(column):
            raise ModelingError(
                f"'{column.column_name}' is a column of the table, not a calculated "
                "one: change its label and flags with set_column_properties.",
                "InvalidRequest",
            )
        new_name = updates.get("column_name")
        if (
            new_name
            and new_name != column.column_name
            and modeling.named(dataset.columns, "column_name", new_name)
        ):
            raise ModelingError(
                f"The dataset already has a column named '{new_name}'.",
                "InvalidRequest",
            )
        if "expression" in updates:
            modeling.check_expression(dataset, updates["expression"], "column")
        column_id = column.id
        updated = modeling.save(
            dataset,
            {"columns": modeling.column_payload(dataset, changes={column_id: updates})},
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    changed = next((c for c in updated.columns if c.id == column_id), None)
    return modeling.response(
        updated,
        column=modeling.column_detail(changed) if changed else None,
        changed=sorted(updates),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Delete calculated column", destructive=True),
)
async def delete_calculated_column(
    request: DeleteDatasetItemRequest, ctx: Context
) -> DatasetModelResponse:
    """Delete a calculated column of a dataset.

    Charts that use it stop finding it. Columns of the table itself cannot be
    deleted: they come from the database.

    Example:
    ```json
    {"dataset_id": 12, "name": "size"}
    ```
    """
    await ctx.info(
        "Deleting calculated column: dataset_id=%s, column=%r"
        % (request.dataset_id, request.name)
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        column = modeling.find_item(dataset.columns, request.name, "column_name")
        if not modeling.is_calculated(column):
            raise ModelingError(
                f"'{column.column_name}' is a column of the table, not a calculated "
                "one, so it cannot be deleted.",
                "InvalidRequest",
            )
        name = column.column_name
        updated = modeling.save(
            dataset, {"columns": modeling.column_payload(dataset, drop=column.id)}
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    return modeling.response(updated, deleted=name)


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Set column properties", destructive=False),
)
async def set_column_properties(
    request: SetColumnPropertiesRequest, ctx: Context
) -> DatasetModelResponse:
    """Set the label, description and flags of any dataset column.

    Sets ``verbose_name``, ``description``, ``is_dttm`` (time column),
    ``groupby``, ``filterable`` and ``python_date_format`` (for a time column
    stored as text). Only the properties you pass change.

    Example:
    ```json
    {"dataset_id": 12, "column": "order_date", "is_dttm": true,
     "python_date_format": "%Y-%m-%d", "verbose_name": "Order date"}
    ```
    """
    updates = request.updates()
    await ctx.info(
        "Setting column properties: dataset_id=%s, column=%r, properties=%s"
        % (request.dataset_id, request.column, sorted(updates))
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        column = modeling.find_item(dataset.columns, request.column, "column_name")
        modeling.check_date_format(updates.get("python_date_format"))
        column_id = column.id
        updated = modeling.save(
            dataset,
            {"columns": modeling.column_payload(dataset, changes={column_id: updates})},
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    changed = next((c for c in updated.columns if c.id == column_id), None)
    return modeling.response(
        updated,
        column=modeling.column_detail(changed) if changed else None,
        changed=sorted(updates),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Add dataset metric", destructive=False),
)
async def add_metric(request: AddMetricRequest, ctx: Context) -> DatasetModelResponse:
    """Add a saved metric to a dataset: a named aggregate such as SUM(total).

    The expression runs once on the dataset before it is saved. Charts then use
    it as ``{"name": "<metric_name>", "saved_metric": true}``. Change it later
    with update_dataset_metric.

    Example:
    ```json
    {"dataset_id": 12, "metric_name": "revenue", "expression": "SUM(total)",
     "d3format": ",.2f"}
    ```
    """
    await ctx.info(
        "Adding metric: dataset_id=%s, metric=%r"
        % (request.dataset_id, request.metric_name)
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        if modeling.named(dataset.metrics, "metric_name", request.metric_name):
            raise ModelingError(
                f"The dataset already has a metric named '{request.metric_name}': "
                "change it with update_dataset_metric.",
                "InvalidRequest",
            )
        modeling.check_expression(dataset, request.expression, "metric")
        new = request.model_dump(exclude_none=True, exclude={"dataset_id"})
        updated = modeling.save(
            dataset, {"metrics": modeling.metric_payload(dataset, new=new)}
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    metric = modeling.named(updated.metrics, "metric_name", request.metric_name)
    return modeling.response(
        updated,
        metric=modeling.metric_detail(metric) if metric else None,
        changed=sorted(new),
    )


@tool(
    tags=["mutate"],
    class_permission_name="Dataset",
    method_permission_name="write",
    annotations=_annotations("Delete dataset metric", destructive=True),
)
async def delete_metric(
    request: DeleteDatasetItemRequest, ctx: Context
) -> DatasetModelResponse:
    """Delete a saved metric of a dataset. Charts that use it stop finding it.

    Example:
    ```json
    {"dataset_id": 12, "name": "revenue"}
    ```
    """
    await ctx.info(
        "Deleting metric: dataset_id=%s, metric=%r" % (request.dataset_id, request.name)
    )
    try:
        dataset = modeling.editable_dataset(request.dataset_id)
        metric = modeling.find_item(dataset.metrics, request.name, "metric_name")
        name = metric.metric_name
        updated = modeling.save(
            dataset, {"metrics": modeling.metric_payload(dataset, drop=metric.id)}
        )
    except ModelingError as error:
        return await _refused(ctx, error, request.dataset_id)

    return modeling.response(updated, deleted=name)
