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
"""Remove Mi BI format themes and the theme of each workspace

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations. Every dashboard keeps the format it already has; only
the saved themes go away.

Revision ID: e4ec3b61cadb
Revises: b7d41e0c9a23
Create Date: 2026-11-01 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_table,
    drop_columns,
    drop_fks_for_table,
    drop_table,
)

revision = "e4ec3b61cadb"
down_revision = "b7d41e0c9a23"

THEMES_TABLE = "mibi_format_themes"
WORKSPACES_TABLE = "mibi_workspaces"
WORKSPACE_THEME_FK = "fk_mibi_workspaces_format_theme_id"
AUDIT_COLUMNS = ("created_by_fk", "changed_by_fk")


def upgrade():
    drop_fks_for_table(WORKSPACES_TABLE, [WORKSPACE_THEME_FK])
    drop_columns(WORKSPACES_TABLE, "format_theme_id")
    drop_fks_for_table(
        THEMES_TABLE,
        [f"fk_mibi_format_themes_{column}_ab_user" for column in AUDIT_COLUMNS],
    )
    drop_table(THEMES_TABLE)


def downgrade():
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
    for audit_column in AUDIT_COLUMNS:
        create_fks_for_table(
            foreign_key_name=f"fk_mibi_format_themes_{audit_column}_ab_user",
            table_name=THEMES_TABLE,
            referenced_table="ab_user",
            local_cols=[audit_column],
            remote_cols=["id"],
            ondelete="SET NULL",
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
