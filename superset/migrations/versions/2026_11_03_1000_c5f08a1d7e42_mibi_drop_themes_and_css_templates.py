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
"""Remove saved themes and CSS templates

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations. The product has a fixed look defined in the
configuration (`THEME_DEFAULT`, `THEME_DARK`), so the database themes, the
theme each dashboard pointed to and the CSS templates go away. A dashboard keeps
its own `css`.

Revision ID: c5f08a1d7e42
Revises: a91c5d27f3e8
Create Date: 2026-11-03 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_index,
    create_table,
    drop_columns,
    drop_fks_for_table,
    drop_table,
    has_table,
    table_has_column,
)

revision = "c5f08a1d7e42"
down_revision = "a91c5d27f3e8"

THEMES_TABLE = "themes"
CSS_TEMPLATES_TABLE = "css_templates"
DASHBOARD_THEME_FK = "fk_dashboards_theme_id_themes"
VIEW_MENUS = (
    "CssTemplate",
    "CSS Templates",
    "CssTemplateRestApi",
    "CssTemplateModelView",
    "Theme",
    "Themes",
    "ThemeRestApi",
    "ThemeModelView",
)


def _delete_permissions() -> None:
    """Delete the permissions and menu entries of the removed views."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("ab_view_menu"):
        return
    names = ", ".join(f"'{name}'" for name in VIEW_MENUS)
    view_menus = f"SELECT id FROM ab_view_menu WHERE name IN ({names})"  # noqa: S608
    pvms = f"SELECT id FROM ab_permission_view WHERE view_menu_id IN ({view_menus})"  # noqa: S608
    bind.execute(
        sa.text(
            f"DELETE FROM ab_permission_view_role WHERE permission_view_id IN ({pvms})"  # noqa: S608
        )
    )
    bind.execute(
        sa.text(
            f"DELETE FROM ab_permission_view WHERE view_menu_id IN ({view_menus})"  # noqa: S608
        )
    )
    bind.execute(sa.text(f"DELETE FROM ab_view_menu WHERE name IN ({names})"))  # noqa: S608


def _audit_fks(table_name: str) -> None:
    for audit_column in ("created_by_fk", "changed_by_fk"):
        create_fks_for_table(
            foreign_key_name=f"fk_{table_name}_{audit_column}_ab_user",
            table_name=table_name,
            referenced_table="ab_user",
            local_cols=[audit_column],
            remote_cols=["id"],
        )


def upgrade():
    _delete_permissions()
    if table_has_column("dashboards", "theme_id"):
        drop_fks_for_table("dashboards", [DASHBOARD_THEME_FK])
        drop_columns("dashboards", "theme_id")
    if has_table(THEMES_TABLE):
        drop_table(THEMES_TABLE)
    if has_table(CSS_TEMPLATES_TABLE):
        drop_table(CSS_TEMPLATES_TABLE)


def downgrade():
    create_table(
        CSS_TEMPLATES_TABLE,
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("template_name", sa.String(length=250), nullable=True),
        sa.Column(
            "css",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("uuid", UUIDType(), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    _audit_fks(CSS_TEMPLATES_TABLE)

    create_table(
        THEMES_TABLE,
        sa.Column("uuid", UUIDType(), nullable=True),
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("theme_name", sa.String(length=250), nullable=True),
        sa.Column(
            "json_data",
            sa.Text().with_variant(mysql.MEDIUMTEXT(), "mysql"),
            nullable=True,
        ),
        sa.Column("is_system", sa.Boolean(), default=False, nullable=False),
        sa.Column(
            "is_system_default",
            sa.Boolean(),
            default=False,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_system_dark",
            sa.Boolean(),
            default=False,
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    _audit_fks(THEMES_TABLE)
    create_index(THEMES_TABLE, "idx_theme_is_system_default", ["is_system_default"])
    create_index(THEMES_TABLE, "idx_theme_is_system_dark", ["is_system_dark"])

    add_columns("dashboards", sa.Column("theme_id", sa.Integer(), nullable=True))
    create_fks_for_table(
        DASHBOARD_THEME_FK,
        "dashboards",
        THEMES_TABLE,
        ["theme_id"],
        ["id"],
    )
