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
"""Mi BI format themes, and the theme of each workspace

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations.

Revision ID: b7d41e0c9a23
Revises: 06c8a16b9fe1
Create Date: 2026-10-31 16:00:00.000000

"""

from datetime import datetime
from uuid import uuid4

from alembic import op
from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import column, table
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_table,
    drop_columns,
    drop_fks_for_table,
    drop_table,
)
from superset.utils import json

revision = "b7d41e0c9a23"
down_revision = "06c8a16b9fe1"

THEMES_TABLE = "mibi_format_themes"
WORKSPACES_TABLE = "mibi_workspaces"
WORKSPACE_THEME_FK = "fk_mibi_workspaces_format_theme_id"

# Themes every installation starts with. Colors are tints and mid tones that
# read well in the light and the dark app theme; cards keep the app's color.
BUILT_IN_THEMES = [
    (
        "Corporativo",
        {
            "canvas": {
                "background": {"type": "color", "color": "rgba(30, 58, 138, 0.06)"},
                "gap": 12,
            },
            "visuals": {
                "radius": 4,
                "shadow": "none",
                "borderWidth": 1,
                "borderColor": "rgba(30, 58, 138, 0.18)",
                "title": {
                    "size": 14,
                    "color": "#3B82F6",
                    "divider": True,
                    "dividerColor": "rgba(30, 58, 138, 0.18)",
                },
            },
            "colorScheme": "corporativo",
        },
    ),
    (
        "Fresco",
        {
            "canvas": {
                "background": {
                    "type": "gradient",
                    "color": "rgba(16, 185, 129, 0.10)",
                    "color2": "rgba(6, 182, 212, 0.10)",
                    "angle": 135,
                },
                "gap": 20,
            },
            "visuals": {
                "radius": 18,
                "shadow": "soft",
                "borderWidth": 0,
                "title": {"color": "#10B981"},
            },
            "colorScheme": "fresco",
        },
    ),
    (
        "Vibrante",
        {
            "canvas": {
                "background": {
                    "type": "gradient",
                    "color": "rgba(247, 37, 133, 0.10)",
                    "color2": "rgba(67, 97, 238, 0.12)",
                    "angle": 120,
                },
                "gap": 20,
            },
            "visuals": {
                "radius": 22,
                "shadow": "strong",
                "borderWidth": 0,
                "title": {"size": 17, "color": "#B5179E"},
            },
            "colorScheme": "neon",
        },
    ),
    (
        "Minimalista",
        {
            "canvas": {"background": {"type": "none"}, "gap": 8},
            "visuals": {
                "background": "transparent",
                "borderWidth": 0,
                "shadow": "none",
                "radius": 0,
                "title": {"size": 13, "divider": True},
            },
            "colorScheme": "mibi",
        },
    ),
]


def upgrade():
    create_table(
        THEMES_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=True, unique=True),
        Column("name", String(250), nullable=False),
        Column("theme", Text, nullable=False),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )
    for audit_column in ("created_by_fk", "changed_by_fk"):
        create_fks_for_table(
            foreign_key_name=f"fk_mibi_format_themes_{audit_column}_ab_user",
            table_name=THEMES_TABLE,
            referenced_table="ab_user",
            local_cols=[audit_column],
            remote_cols=["id"],
            ondelete="SET NULL",
        )

    themes = table(
        THEMES_TABLE,
        column("uuid", UUIDType(binary=True)),
        column("name", String),
        column("theme", Text),
        column("created_on", DateTime),
        column("changed_on", DateTime),
    )
    now = datetime.now()
    op.bulk_insert(
        themes,
        [
            {
                "uuid": uuid4(),
                "name": name,
                "theme": json.dumps(theme),
                "created_on": now,
                "changed_on": now,
            }
            for name, theme in BUILT_IN_THEMES
        ],
    )

    add_columns(WORKSPACES_TABLE, Column("format_theme_id", Integer, nullable=True))
    create_fks_for_table(
        foreign_key_name=WORKSPACE_THEME_FK,
        table_name=WORKSPACES_TABLE,
        referenced_table=THEMES_TABLE,
        local_cols=["format_theme_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade():
    drop_fks_for_table(WORKSPACES_TABLE, [WORKSPACE_THEME_FK])
    drop_columns(WORKSPACES_TABLE, "format_theme_id")
    drop_fks_for_table(
        THEMES_TABLE,
        [
            "fk_mibi_format_themes_created_by_fk_ab_user",
            "fk_mibi_format_themes_changed_by_fk_ab_user",
        ],
    )
    drop_table(THEMES_TABLE)
