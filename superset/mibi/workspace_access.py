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
Who sees and who changes what in Mi BI workspaces.

Membership is the privacy boundary of a workspace, as in Power BI:

* A workspace is visible to its members and to Superset admins.
* A dashboard inside a workspace is hidden from users who are neither members of
  that workspace nor owners of the dashboard. Membership never grants data access:
  the charts still need access to their datasets.
* Contributors and admins of a workspace edit its dashboards and their charts, as
  if they owned them.

``MIBI_WORKSPACE_ACCESS = False`` turns the dashboard rules off; workspaces then
only group dashboards.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from flask import current_app
from sqlalchemy.sql.elements import ColumnElement

from superset import db, security_manager
from superset.mibi.models import (
    ROLE_ADMIN,
    ROLE_CONTRIBUTOR,
    ROLES,
    WorkspaceDashboard,
    WorkspaceMember,
)
from superset.utils.core import get_user_id

EDITOR_ROLES = (ROLE_CONTRIBUTOR, ROLE_ADMIN)


def enabled() -> bool:
    """Whether workspace membership restricts dashboards."""
    return bool(current_app.config.get("MIBI_WORKSPACE_ACCESS", True))


def role_rank(role: str | None) -> int:
    """0 for no role, then viewer < contributor < admin."""
    return ROLES.index(role) + 1 if role in ROLES else 0


def workspace_role(workspace_id: int) -> str | None:
    """The current user's role in a workspace; Superset admins administer all."""
    if security_manager.is_admin():
        return ROLE_ADMIN
    user_id = get_user_id()
    if user_id is None:
        return None
    return (
        db.session.query(WorkspaceMember.role)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .scalar()
    )


def member_workspace_ids(user_id: int | None) -> Any:
    """Subquery with the workspaces a user belongs to."""
    return sa.select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id
    )


def dashboard_visibility_filter(dashboard_id: Any) -> ColumnElement | None:
    """
    SQL condition that keeps dashboards outside workspaces and the ones in the
    current user's workspaces. None when no restriction applies.
    """
    if not enabled() or security_manager.is_admin():
        return None
    if security_manager.is_guest_user():
        # Embedded dashboards are granted by their guest token
        return None
    in_any_workspace = sa.select(WorkspaceDashboard.dashboard_id)
    in_my_workspaces = sa.select(WorkspaceDashboard.dashboard_id).where(
        WorkspaceDashboard.workspace_id.in_(member_workspace_ids(get_user_id()))
    )
    return sa.or_(
        ~dashboard_id.in_(in_any_workspace),
        dashboard_id.in_(in_my_workspaces),
    )


def can_see_dashboard(dashboard_id: int) -> bool:
    """False when the dashboard is in a workspace the user does not belong to."""
    if not enabled() or security_manager.is_admin():
        return True
    link = (
        db.session.query(WorkspaceDashboard.workspace_id)
        .filter(WorkspaceDashboard.dashboard_id == dashboard_id)
        .scalar()
    )
    return link is None or workspace_role(link) is not None


def edits_as_workspace_member(resource: Any) -> bool:
    """
    Whether the current user edits a dashboard or chart through a workspace role.
    Charts follow the dashboard they belong to.
    """
    from superset.models.dashboard import Dashboard, dashboard_slices
    from superset.models.slice import Slice

    if not enabled():
        return False
    user_id = get_user_id()
    if user_id is None or getattr(resource, "id", None) is None:
        return False

    editable_workspaces = sa.select(WorkspaceMember.workspace_id).where(
        WorkspaceMember.user_id == user_id,
        WorkspaceMember.role.in_(EDITOR_ROLES),
    )
    if isinstance(resource, Dashboard):
        dashboard_ids: Any = sa.select(sa.literal(resource.id))
    elif isinstance(resource, Slice):
        dashboard_ids = sa.select(dashboard_slices.c.dashboard_id).where(
            dashboard_slices.c.slice_id == resource.id
        )
    else:
        return False
    return (
        db.session.query(WorkspaceDashboard.id)
        .filter(
            WorkspaceDashboard.dashboard_id.in_(dashboard_ids),
            WorkspaceDashboard.workspace_id.in_(editable_workspaces),
        )
        .first()
        is not None
    )
