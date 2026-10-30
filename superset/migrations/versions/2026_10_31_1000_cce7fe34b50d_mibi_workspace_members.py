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
"""Mi BI workspace members and roles

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations.

Revision ID: cce7fe34b50d
Revises: 8bc9e5b95335
Create Date: 2026-10-31 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, Integer, String, UniqueConstraint

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

revision = "cce7fe34b50d"
down_revision = "8bc9e5b95335"

MEMBERS_TABLE = "mibi_workspace_members"


def upgrade():
    create_table(
        MEMBERS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("workspace_id", Integer, nullable=False),
        Column("user_id", Integer, nullable=False),
        Column("role", String(20), nullable=False),
        UniqueConstraint("workspace_id", "user_id", name="uq_mibi_workspace_members"),
    )
    create_index(MEMBERS_TABLE, "idx_mibi_workspace_members_user_id", ["user_id"])
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_members_workspace_id",
        table_name=MEMBERS_TABLE,
        referenced_table="mibi_workspaces",
        local_cols=["workspace_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_members_user_id_ab_user",
        table_name=MEMBERS_TABLE,
        referenced_table="ab_user",
        local_cols=["user_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )

    # Whoever created a workspace administers it
    workspaces = sa.table(
        "mibi_workspaces",
        sa.column("id", sa.Integer),
        sa.column("created_by_fk", sa.Integer),
    )
    members = sa.table(
        MEMBERS_TABLE,
        sa.column("workspace_id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("role", sa.String),
    )
    op.execute(
        members.insert().from_select(
            ["workspace_id", "user_id", "role"],
            sa.select(
                workspaces.c.id,
                workspaces.c.created_by_fk,
                sa.literal("admin"),
            ).where(workspaces.c.created_by_fk.isnot(None)),
        )
    )


def downgrade():
    drop_fks_for_table(
        MEMBERS_TABLE,
        [
            "fk_mibi_workspace_members_workspace_id",
            "fk_mibi_workspace_members_user_id_ab_user",
        ],
    )
    drop_index(MEMBERS_TABLE, "idx_mibi_workspace_members_user_id")
    drop_table(MEMBERS_TABLE)
