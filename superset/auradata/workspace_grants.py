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
Data access through a workspace, like the semantic models of a Power BI workspace.

The members of a workspace, viewers included, can query the datasets that belong
to it (``WorkspaceDataset``), whatever data permissions their roles have. The
grant is narrow on purpose:

* Only datasets of the workspace. A shared dataset (no workspace) keeps the
  permissions it had, and a dataset moved to another workspace takes its access
  with it. Nothing is cached, so removing a member also removes the access.
* Only reading. It never makes anyone an editor: viewers keep their role, and
  drafts and every edit point keep asking for a contributor or admin
  (``workspace_access``). A viewer reaches the charts of published dashboards
  only: one chart lives in one dashboard, so the charts of a draft are the draft.
* Only the object checks of charts, dashboards and datasets (``raise_for_access``
  and the list filters). Raw SQL (SQL Lab, MetaDB, MCP ``execute_sql``), schema
  and database listings and editing a dataset keep following real permissions,
  so the grant never reaches a table outside the dataset.
* Row level security still applies: it filters the query, not the access check.
* Adding a dataset to a workspace needs real editorship of it
  (``put_datasets``), so a workspace admin cannot grant access to data that they
  cannot read.

``AURADATA_WORKSPACE_ACCESS`` and ``AURADATA_WORKSPACE_DATASETS`` turn it off.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa

from superset import db, security_manager
from superset.auradata import workspace_access, workspace_datasets
from superset.auradata.models import WorkspaceDataset, WorkspaceMember
from superset.exceptions import SupersetSecurityException
from superset.utils.core import get_user_id


def enabled() -> bool:
    """Whether workspace roles grant access to the datasets of the workspace."""
    return workspace_access.enabled() and workspace_datasets.enabled()


def _granted_dataset_ids(user_id: int) -> Any:
    return sa.select(WorkspaceDataset.dataset_id).where(
        WorkspaceDataset.workspace_id.in_(
            workspace_access.member_workspace_ids(user_id)
        )
    )


def _edited_dataset_ids(user_id: int) -> Any:
    editable_workspaces = sa.select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.role.in_(workspace_access.EDITOR_ROLES),
    )
    return sa.select(WorkspaceDataset.dataset_id).where(
        WorkspaceDataset.workspace_id.in_(editable_workspaces)
    )


def _published_chart_ids() -> Any:
    from superset.models.dashboard import Dashboard, dashboard_slices

    return (
        sa.select(dashboard_slices.c.slice_id)
        .join(Dashboard, Dashboard.id == dashboard_slices.c.dashboard_id)
        .where(Dashboard.published.is_(True), Dashboard.deleted_at.is_(None))
    )


def _is_in(value: int, subquery: Any) -> bool:
    return (
        db.session.query(sa.literal(1)).filter(sa.literal(value).in_(subquery)).first()
        is not None
    )


def granted_dataset_ids() -> Any | None:
    """
    Subquery with the datasets the current user reaches through a workspace, or
    None when no grant applies (disabled, guest, no user).
    """
    if not enabled() or security_manager.is_guest_user():
        return None
    user_id = get_user_id()
    if user_id is None:
        return None
    return _granted_dataset_ids(user_id)


def grants_dataset(datasource: Any) -> bool:
    """
    Whether the current user may query a dataset because they are a member of its
    workspace.
    """
    from superset.connectors.sqla.models import SqlaTable

    if not isinstance(datasource, SqlaTable) or datasource.id is None:
        return False
    granted = granted_dataset_ids()
    return granted is not None and _is_in(datasource.id, granted)


def _reads_outside_the_grant(datasource: Any) -> bool:
    if security_manager.is_editor(datasource):
        return True
    try:
        # ``allow_editorship=False`` leaves the workspace grant out too
        security_manager.raise_for_access(datasource=datasource, allow_editorship=False)
    except SupersetSecurityException:
        return False
    return True


def hides_chart(chart: Any, datasource: Any) -> bool:
    """
    Whether a chart stays closed although its dataset opens: only the grant opens
    the dataset, the user does not edit that workspace, and no published dashboard
    shows the chart.

    :param chart: The chart
    :param datasource: The dataset of the chart, which the user can access
    """
    if not grants_dataset(datasource):
        return False
    return (
        not _is_in(datasource.id, _edited_dataset_ids(get_user_id()))
        and not _is_in(chart.id, _published_chart_ids())
        and not _reads_outside_the_grant(datasource)
    )


def grant_clause(base_model: Any) -> sa.sql.elements.ColumnElement[bool] | None:
    """
    SQL condition for the list filters: the rows of ``base_model`` (datasets or
    the charts that use them) that the workspace grant covers, or None.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.utils.core import DatasourceType

    granted = granted_dataset_ids()
    if granted is None:
        return None
    if base_model is SqlaTable:
        return SqlaTable.id.in_(granted)
    return sa.and_(
        base_model.datasource_type == DatasourceType.TABLE,
        base_model.datasource_id.in_(granted),
        sa.or_(
            base_model.datasource_id.in_(_edited_dataset_ids(get_user_id())),
            base_model.id.in_(_published_chart_ids()),
        ),
    )
