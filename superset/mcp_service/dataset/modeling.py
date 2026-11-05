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
Changes to a dataset's model: calculated columns, saved metrics and column
properties.

Every change goes through ``UpdateDatasetCommand``, as the dataset editor of the
web does, so it keeps the command's validation and only a dataset's editors (and
admins) make it. Workspace roles never give edit rights on a dataset. A new or
changed expression first runs once in a small query, the compile check of the
chart tools, so a typo comes back as a readable error and nothing is saved.
"""

from __future__ import annotations

import difflib
from typing import Any

from superset import security_manager
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.dataset.schemas import (
    DatasetColumnDetail,
    DatasetMetricDetail,
    DatasetModelResponse,
)

PROBE_LABEL = "auradata_probe"


class ModelingError(Exception):
    """A change that cannot be made; ``error_type`` names why."""

    def __init__(self, message: str, error_type: str) -> None:
        super().__init__(message)
        self.message = message
        self.error_type = error_type

    def response(self, **fields: Any) -> DatasetModelResponse:
        return DatasetModelResponse(
            error=self.message, error_type=self.error_type, **fields
        )


def editable_dataset(identifier: int | str) -> Any:
    """
    The dataset, once the current user may edit it.

    :raises ModelingError: Not found (also when the workspace rules hide it), or
        the user is not one of its editors
    """
    from sqlalchemy.orm import joinedload, subqueryload

    from superset.connectors.sqla.models import SqlaTable
    from superset.mcp_service.dataset.dataset_utils import resolve_dataset

    dataset = resolve_dataset(
        identifier,
        [
            subqueryload(SqlaTable.columns),
            subqueryload(SqlaTable.metrics),
            joinedload(SqlaTable.database),
        ],
    )
    if dataset is None:
        raise ModelingError(
            f"No dataset found with identifier: {identifier}. "
            "Use list_datasets to get valid dataset IDs.",
            "NotFound",
        )
    # Before any lookup or query, so names are not revealed to others
    try:
        security_manager.raise_for_editorship(dataset)
    except SupersetSecurityException as ex:
        raise ModelingError(
            "Only the editors of this dataset (or admins) change its columns "
            "and metrics; a workspace role does not allow it.",
            "Forbidden",
        ) from ex
    return dataset


def find_item(items: list[Any], identifier: int | str, attribute: str) -> Any:
    """
    A column or metric by ID or name.

    :raises ModelingError: None has it, with the closest names
    """
    if isinstance(identifier, str) and identifier.isdigit():
        identifier = int(identifier)
    if isinstance(identifier, int):
        found = next((item for item in items if item.id == identifier), None)
    else:
        found = next(
            (item for item in items if getattr(item, attribute) == identifier), None
        )
    if found is not None:
        return found
    names = [getattr(item, attribute) for item in items]
    kind = "Column" if attribute == "column_name" else "Metric"
    message = f"{kind} '{identifier}' not found on this dataset."
    if close := difflib.get_close_matches(str(identifier), names, n=3, cutoff=0.6):
        message += f" Did you mean: {', '.join(close)}?"
    elif names:
        message += f" Available: {', '.join(sorted(names))}."
    raise ModelingError(message, "NotFound")


def is_calculated(column: Any) -> bool:
    return bool((column.expression or "").strip())


def column_payload(
    dataset: Any,
    changes: dict[int, dict[str, Any]] | None = None,
    drop: int | None = None,
    new: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Every column of the dataset for the update command, which deletes the ones
    left out: unchanged ones as ``{id, column_name}``.
    """
    changes = changes or {}
    payload = [
        {
            "id": column.id,
            "column_name": column.column_name,
            **changes.get(column.id, {}),
        }
        for column in dataset.columns
        if column.id != drop
    ]
    return payload + ([new] if new else [])


def metric_payload(
    dataset: Any, drop: int | None = None, new: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """Every metric of the dataset for the update command, as ``column_payload``."""
    payload = [
        {"id": metric.id, "metric_name": metric.metric_name}
        for metric in dataset.metrics
        if metric.id != drop
    ]
    return payload + ([new] if new else [])


def check_expression(dataset: Any, expression: str, kind: str) -> None:
    """
    Run an expression once, as the chart tools' compile check does, before it
    is saved.

    :param kind: ``column`` for a row-level expression, ``metric`` for an
        aggregate one
    :raises ModelingError: The database refused it, with its message
    """
    from superset.mcp_service.chart.compile import _compile_chart

    if kind == "metric":
        form_data: dict[str, Any] = {
            "viz_type": "table",
            "query_mode": "aggregate",
            "groupby": [],
            "metrics": [
                {
                    "expressionType": "SQL",
                    "sqlExpression": expression,
                    "label": PROBE_LABEL,
                }
            ],
        }
    else:
        form_data = {
            "viz_type": "table",
            "query_mode": "raw",
            "all_columns": [
                {
                    "expressionType": "SQL",
                    "sqlExpression": expression,
                    "label": PROBE_LABEL,
                }
            ],
        }
    form_data["row_limit"] = 1
    # A false condition: the database still checks the expression but reads no rows
    form_data["adhoc_filters"] = [
        {"expressionType": "SQL", "clause": "WHERE", "sqlExpression": "1 = 0"}
    ]
    result = _compile_chart(form_data, dataset.id)
    if not result.success:
        # The compile check calls some SQL errors connection errors; here the
        # expression is what failed
        reason = (result.error or "").removeprefix("Database connection error: ")
        raise ModelingError(
            f"The expression does not run on this dataset, so nothing was saved: "
            f"{reason}",
            "InvalidExpression",
        )


def check_date_format(date_format: str | None) -> None:
    from superset.daos.dataset import DatasetDAO

    if date_format and not DatasetDAO.validate_python_date_format(date_format):
        raise ModelingError(
            f"'{date_format}' is not a valid date format: use a Python strftime "
            "format such as '%Y-%m-%d', or 'epoch_s' / 'epoch_ms'.",
            "InvalidRequest",
        )


def save(dataset: Any, properties: dict[str, Any]) -> Any:
    """
    Run the dataset update command.

    :raises ModelingError: The command refused the change
    """
    from superset import db
    from superset.commands.dataset.exceptions import (
        DatasetForbiddenError,
        DatasetInvalidError,
        DatasetNotFoundError,
        DatasetUpdateFailedError,
    )
    from superset.commands.dataset.update import UpdateDatasetCommand
    from superset.extensions import event_logger

    try:
        with event_logger.log_context(action="mcp.dataset_model.update"):
            return UpdateDatasetCommand(dataset.id, properties).run()
    except DatasetNotFoundError as ex:
        raise ModelingError("Dataset not found.", "NotFound") from ex
    except DatasetForbiddenError as ex:
        raise ModelingError(
            "Only the editors of this dataset (or admins) change it.", "Forbidden"
        ) from ex
    except DatasetInvalidError as ex:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        raise ModelingError(
            f"The change was refused: {ex.normalized_messages()}", "InvalidRequest"
        ) from ex
    except (DatasetUpdateFailedError, ValueError) as ex:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        raise ModelingError(f"The change failed: {ex}", "UpdateFailed") from ex


def column_detail(column: Any) -> DatasetColumnDetail:
    return DatasetColumnDetail(
        id=column.id,
        column_name=column.column_name,
        verbose_name=column.verbose_name,
        description=column.description,
        expression=column.expression or None,
        type=column.type,
        is_dttm=column.is_dttm,
        groupby=column.groupby,
        filterable=column.filterable,
        python_date_format=column.python_date_format,
    )


def metric_detail(metric: Any) -> DatasetMetricDetail:
    from superset.mcp_service.dataset.tool.update_dataset_metric import (
        _serialize_metric,
    )

    return _serialize_metric(metric)


def named(items: list[Any], attribute: str, name: str) -> Any | None:
    return next((item for item in items if getattr(item, attribute) == name), None)


def response(dataset: Any, **fields: Any) -> DatasetModelResponse:
    """The success response for a dataset after a change."""
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    return DatasetModelResponse(
        dataset_id=dataset.id,
        dataset_name=dataset.table_name,
        url=(
            f"{get_superset_base_url()}/explore/"
            f"?datasource_type=table&datasource_id={dataset.id}"
        ),
        **fields,
    )
