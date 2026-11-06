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

"""Shared helpers for dataset MCP tools."""

from typing import Any

from superset.mcp_service.utils import _is_uuid


def workspace_filtered(query: Any) -> Any:
    """Apply ``WorkspaceDatasetFilter`` to a query over ``SqlaTable``.

    AuraData BI: the datasets of a workspace are for its members, its editors
    and admins, as in the REST dataset API, which adds ``WorkspaceDatasetFilter``
    to the ``DatasourceFilter`` of ``DatasetDAO``. The workspace grant of its
    members is part of ``DatasourceFilter`` already.
    """
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset import db
    from superset.auradata.workspace_datasets import WorkspaceDatasetFilter
    from superset.connectors.sqla.models import SqlaTable

    datamodel = SQLAInterface(SqlaTable, db.session)
    return WorkspaceDatasetFilter("id", datamodel).apply(query, None)


def visible_in_workspaces(dataset_id: int) -> bool:
    """Whether the workspace rules let the current user see a dataset."""
    from superset import db
    from superset.auradata.workspace_datasets import (
        dataset_visibility_filter,
        dataset_workspace_id,
    )
    from superset.connectors.sqla.models import SqlaTable

    # No rule applies, or the dataset is shared: nothing to hide
    if dataset_visibility_filter(SqlaTable.id) is None:
        return True
    if dataset_workspace_id(dataset_id) is None:
        return True
    query = db.session.query(SqlaTable.id).filter(SqlaTable.id == dataset_id)
    return workspace_filtered(query).first() is not None


def find_visible_dataset(dataset_id: int | str, **kwargs: Any) -> Any | None:
    """``DatasetDAO.find_by_id``, with a dataset hidden by the workspace rules as
    not found."""
    from superset.daos.dataset import DatasetDAO

    dataset = DatasetDAO.find_by_id(dataset_id, **kwargs)
    if dataset is None or not visible_in_workspaces(dataset.id):
        return None
    return dataset


def resolve_dataset(
    identifier: int | str, eager_options: list[Any] | None = None
) -> Any | None:
    """Resolve a dataset by int ID or UUID string.

    Replicates the identifier resolution logic from ModelGetInfoCore._find_object(),
    and treats a dataset hidden by the workspace rules as not found.
    """
    dataset = _find_dataset(identifier, eager_options)
    if dataset is None or not visible_in_workspaces(dataset.id):
        return None
    return dataset


def _find_dataset(
    identifier: int | str, eager_options: list[Any] | None = None
) -> Any | None:
    from superset.daos.dataset import DatasetDAO

    opts = eager_options or None

    if isinstance(identifier, int):
        return DatasetDAO.find_by_id(identifier, query_options=opts)

    # Try parsing as int
    try:
        id_val = int(identifier)
        return DatasetDAO.find_by_id(id_val, query_options=opts)
    except (ValueError, TypeError):
        pass

    # Try UUID
    if _is_uuid(str(identifier)):
        return DatasetDAO.find_by_id(identifier, id_column="uuid", query_options=opts)

    return None
