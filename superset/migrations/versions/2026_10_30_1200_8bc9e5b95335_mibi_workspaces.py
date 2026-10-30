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
"""Mi BI workspaces

A fork migration: when rebasing onto a new Superset release, point
down_revision at the new upstream head.

Revision ID: 8bc9e5b95335
Revises: 4b2a8c9d3e1f
Create Date: 2026-10-30 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, LargeBinary, String, Text
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

revision = "8bc9e5b95335"
down_revision = "4b2a8c9d3e1f"

WORKSPACES_TABLE = "mibi_workspaces"
WORKSPACE_DASHBOARDS_TABLE = "mibi_workspace_dashboards"


def upgrade():
    create_table(
        WORKSPACES_TABLE,
        Column("id", Integer, primary_key=True),
        Column("uuid", UUIDType(binary=True), nullable=True, unique=True),
        Column("name", String(250), nullable=False),
        Column("description", Text, nullable=True),
        Column("color", String(16), nullable=True),
        Column("image", LargeBinary, nullable=True),
        Column("image_type", String(50), nullable=True),
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    )
    for column in ("created_by_fk", "changed_by_fk"):
        create_fks_for_table(
            foreign_key_name=f"fk_mibi_workspaces_{column}_ab_user",
            table_name=WORKSPACES_TABLE,
            referenced_table="ab_user",
            local_cols=[column],
            remote_cols=["id"],
            ondelete="SET NULL",
        )

    create_table(
        WORKSPACE_DASHBOARDS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("workspace_id", Integer, nullable=False),
        Column("dashboard_id", Integer, nullable=False, unique=True),
    )
    create_index(
        WORKSPACE_DASHBOARDS_TABLE,
        "idx_mibi_workspace_dashboards_workspace_id",
        ["workspace_id"],
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_dashboards_workspace_id",
        table_name=WORKSPACE_DASHBOARDS_TABLE,
        referenced_table=WORKSPACES_TABLE,
        local_cols=["workspace_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_dashboards_dashboard_id",
        table_name=WORKSPACE_DASHBOARDS_TABLE,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def downgrade():
    drop_fks_for_table(
        WORKSPACE_DASHBOARDS_TABLE,
        [
            "fk_mibi_workspace_dashboards_workspace_id",
            "fk_mibi_workspace_dashboards_dashboard_id",
        ],
    )
    drop_index(WORKSPACE_DASHBOARDS_TABLE, "idx_mibi_workspace_dashboards_workspace_id")
    drop_table(WORKSPACE_DASHBOARDS_TABLE)
    drop_fks_for_table(
        WORKSPACES_TABLE,
        [
            "fk_mibi_workspaces_created_by_fk_ab_user",
            "fk_mibi_workspaces_changed_by_fk_ab_user",
        ],
    )
    drop_table(WORKSPACES_TABLE)
