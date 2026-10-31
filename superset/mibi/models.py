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
"""Workspaces: named groups of dashboards with a picture and a description."""

from __future__ import annotations

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import deferred, relationship

from superset.models.helpers import AuditMixinNullable, UUIDMixin

WORKSPACES_TABLE = "mibi_workspaces"
WORKSPACE_DASHBOARDS_TABLE = "mibi_workspace_dashboards"
WORKSPACE_MEMBERS_TABLE = "mibi_workspace_members"

# Workspace roles, from the least to the most rights
ROLE_VIEWER = "viewer"
ROLE_CONTRIBUTOR = "contributor"
ROLE_ADMIN = "admin"
ROLES = (ROLE_VIEWER, ROLE_CONTRIBUTOR, ROLE_ADMIN)


class Workspace(AuditMixinNullable, UUIDMixin, Model):
    """A place where dashboards live, like a Power BI workspace."""

    __tablename__ = WORKSPACES_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(250), nullable=False)
    description = sa.Column(sa.Text, nullable=True)
    color = sa.Column(sa.String(16), nullable=True)
    # The picture is small (see MAX_IMAGE_BYTES in the API) and lives in the
    # metadata database, so it works the same on every deployment
    image = deferred(sa.Column(sa.LargeBinary, nullable=True))
    image_type = sa.Column(sa.String(50), nullable=True)
    # The format theme its new dashboards start with
    format_theme_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("mibi_format_themes.id", ondelete="SET NULL"),
        nullable=True,
    )

    format_theme = relationship("FormatTheme")
    dashboards = relationship(
        "WorkspaceDashboard",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    members = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class WorkspaceDashboard(Model):
    """Links a dashboard to its workspace. A dashboard is in one workspace at most."""

    __tablename__ = WORKSPACE_DASHBOARDS_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    workspace = relationship("Workspace", back_populates="dashboards")


class WorkspaceMember(Model):
    """A user with a role in a workspace.

    * viewer: sees the workspace and its dashboards
    * contributor: also adds, creates and edits its dashboards and charts
    * admin: also changes the workspace and who belongs to it
    """

    __tablename__ = WORKSPACE_MEMBERS_TABLE
    __table_args__ = (
        sa.UniqueConstraint(
            "workspace_id", "user_id", name="uq_mibi_workspace_members"
        ),
    )

    id = sa.Column(sa.Integer, primary_key=True)
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = sa.Column(
        sa.Integer, sa.ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False
    )
    role = sa.Column(sa.String(20), nullable=False, default=ROLE_VIEWER)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


DASHBOARD_BACKGROUNDS_TABLE = "mibi_dashboard_backgrounds"


class DashboardBackground(Model):
    """The background picture of a dashboard canvas, set in the Format pane."""

    __tablename__ = DASHBOARD_BACKGROUNDS_TABLE

    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        primary_key=True,
    )
    image = deferred(sa.Column(sa.LargeBinary, nullable=False))
    image_type = sa.Column(sa.String(50), nullable=False)
    changed_on = sa.Column(sa.DateTime, nullable=False)


DASHBOARD_IMAGES_TABLE = "mibi_dashboard_images"


class DashboardImage(Model):
    """A picture shown by an image element of a dashboard."""

    __tablename__ = DASHBOARD_IMAGES_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image = deferred(sa.Column(sa.LargeBinary, nullable=False))
    image_type = sa.Column(sa.String(50), nullable=False)
    created_on = sa.Column(sa.DateTime, nullable=False)


FORMAT_THEMES_TABLE = "mibi_format_themes"


class FormatTheme(AuditMixinNullable, UUIDMixin, Model):
    """
    A named dashboard style saved from the Format pane: canvas, the style every
    chart shares and the color palette, as JSON (see superset/mibi/format_themes.py).
    """

    __tablename__ = FORMAT_THEMES_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(250), nullable=False)
    theme = sa.Column(sa.Text, nullable=False)
