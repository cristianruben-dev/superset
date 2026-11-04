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
Workspace datasets: a dataset belongs to one workspace at most, like a Power BI
semantic model, and the charts of that workspace's dashboards use it.

* A dataset without a workspace is shared: any dashboard can use it.
* A dataset of a workspace is listed for that workspace's members, its editors and
  Superset admins. Membership never grants data access: the dataset permissions
  still apply.
* A chart can only use a dataset of its dashboard's workspace, or a shared one.

``MIBI_WORKSPACE_DATASETS = False`` turns these rules off.
"""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

import sqlalchemy as sa
from flask import current_app, has_app_context
from flask_appbuilder.models.filters import BaseFilter
from flask_babel import gettext as __, lazy_gettext as _
from marshmallow import ValidationError
from sqlalchemy.orm import Query
from sqlalchemy.sql.elements import ColumnElement

from superset import db, security_manager
from superset.mibi import workspace_access
from superset.mibi.models import WorkspaceDashboard, WorkspaceDataset
from superset.utils.core import get_user_id

CONFIG_KEY = "MIBI_WORKSPACE_DATASETS"


def enabled() -> bool:
    """Whether datasets belong to workspaces."""
    return has_app_context() and bool(current_app.config.get(CONFIG_KEY, True))


def dataset_visibility_filter(dataset_id: Any) -> ColumnElement | None:
    """
    SQL condition that keeps shared datasets and the ones of the current user's
    workspaces. None when no restriction applies.
    """
    if not enabled() or not workspace_access.enabled():
        return None
    if security_manager.is_admin() or security_manager.is_guest_user():
        return None
    in_any_workspace = sa.select(WorkspaceDataset.dataset_id)
    in_my_workspaces = sa.select(WorkspaceDataset.dataset_id).where(
        WorkspaceDataset.workspace_id.in_(
            workspace_access.member_workspace_ids(get_user_id())
        )
    )
    return sa.or_(
        ~dataset_id.in_(in_any_workspace),
        dataset_id.in_(in_my_workspaces),
    )


class WorkspaceDatasetFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """Hides the datasets of workspaces the user is not a member of."""

    def apply(self, query: Query, value: Any) -> Query:
        from superset.connectors.sqla.models import SqlaTable
        from superset.subjects.filters import (
            subject_relation_exists_for_current_user,
        )
        from superset.subjects.models import sqlatable_editors

        if (condition := dataset_visibility_filter(SqlaTable.id)) is None:
            return query
        # Its editors keep seeing a dataset: the user, or a role or group of theirs
        edited = SqlaTable.id.in_(
            sa.select(sqlatable_editors.c.table_id).where(
                subject_relation_exists_for_current_user(sqlatable_editors)
            )
        )
        return query.filter(sa.or_(condition, edited))


class DatasetUsableInDashboardFilter(BaseFilter):  # pylint: disable=too-few-public-methods
    """The datasets a dashboard's charts can use: shared ones and its workspace's."""

    name = _("Usable in dashboard")
    arg_name = "dataset_usable_in_dashboard"

    def apply(self, query: Query, value: Any) -> Query:
        from superset.connectors.sqla.models import SqlaTable

        if not enabled():
            return query
        try:
            dashboard_id = int(value)
        except (TypeError, ValueError):
            return query
        workspace_id = (
            db.session.query(WorkspaceDashboard.workspace_id)
            .filter(WorkspaceDashboard.dashboard_id == dashboard_id)
            .scalar()
        )
        shared = ~SqlaTable.id.in_(sa.select(WorkspaceDataset.dataset_id))
        if workspace_id is None:
            return query.filter(shared)
        return query.filter(
            sa.or_(
                shared,
                SqlaTable.id.in_(
                    sa.select(WorkspaceDataset.dataset_id).where(
                        WorkspaceDataset.workspace_id == workspace_id
                    )
                ),
            )
        )


def dataset_workspace_id(dataset_id: int) -> int | None:
    """The workspace a dataset belongs to; None when it is shared."""
    return (
        db.session.query(WorkspaceDataset.workspace_id)
        .filter(WorkspaceDataset.dataset_id == dataset_id)
        .scalar()
    )


def dashboard_workspace_ids(dashboard_ids: Iterable[int | None]) -> set[int | None]:
    """The workspaces of these dashboards, with None for a dashboard outside any."""
    ids = {dashboard_id for dashboard_id in dashboard_ids if dashboard_id is not None}
    if not ids:
        return set()
    linked = dict(
        db.session.query(
            WorkspaceDashboard.dashboard_id, WorkspaceDashboard.workspace_id
        ).filter(WorkspaceDashboard.dashboard_id.in_(ids))
    )
    return {linked.get(dashboard_id) for dashboard_id in ids}


def validate_chart_dataset(
    datasource_id: int | None,
    datasource_type: str | None,
    dashboard_ids: Iterable[int | None],
    field_name: str = "datasource_id",
) -> ValidationError | None:
    """
    Validate that a chart only uses a dataset of its dashboard's workspace, or a
    shared one.

    :param datasource_id: The dataset the chart uses
    :param datasource_type: Its type; only tables belong to workspaces
    :param dashboard_ids: The dashboards of the chart
    :param field_name: The request field to attach the error to
    :returns: The validation error, or None if the chart is valid
    """
    if not enabled() or datasource_id is None or datasource_type != "table":
        return None
    workspace_id = dataset_workspace_id(datasource_id)
    if workspace_id is None:
        return None
    if dashboard_workspace_ids(dashboard_ids) - {workspace_id}:
        return ValidationError(
            __(
                "This dataset belongs to another workspace. A chart can only use "
                "the datasets of its dashboard's workspace or shared ones."
            ),
            field_name=field_name,
        )
    return None


def datasets_of_other_workspaces(
    dashboard_ids: Iterable[int], workspace_id: int | None
) -> list[str]:
    """
    The names of the datasets that the charts of these dashboards use and that
    belong to a workspace other than ``workspace_id``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    ids = list(dashboard_ids)
    if not enabled() or not ids:
        return []
    rows = (
        db.session.query(SqlaTable.table_name)
        .join(WorkspaceDataset, WorkspaceDataset.dataset_id == SqlaTable.id)
        .join(
            Slice,
            sa.and_(
                Slice.datasource_id == SqlaTable.id,
                Slice.datasource_type == "table",
            ),
        )
        .join(dashboard_slices, dashboard_slices.c.slice_id == Slice.id)
        .filter(dashboard_slices.c.dashboard_id.in_(ids))
        .filter(
            WorkspaceDataset.workspace_id != workspace_id
            if workspace_id is not None
            else sa.true()
        )
        .distinct()
    )
    return sorted(name for (name,) in rows)


def datasets_used_outside(dataset_ids: Iterable[int], workspace_id: int) -> list[str]:
    """
    The names of these datasets that charts of dashboards outside ``workspace_id``
    use, so they can't move into it.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import dashboard_slices
    from superset.models.slice import Slice

    ids = list(dataset_ids)
    if not enabled() or not ids:
        return []
    in_workspace = sa.select(WorkspaceDashboard.dashboard_id).where(
        WorkspaceDashboard.workspace_id == workspace_id
    )
    rows = (
        db.session.query(SqlaTable.table_name)
        .join(
            Slice,
            sa.and_(
                Slice.datasource_id == SqlaTable.id,
                Slice.datasource_type == "table",
            ),
        )
        .join(dashboard_slices, dashboard_slices.c.slice_id == Slice.id)
        .filter(SqlaTable.id.in_(ids))
        .filter(~dashboard_slices.c.dashboard_id.in_(in_workspace))
        .distinct()
    )
    return sorted(name for (name,) in rows)
