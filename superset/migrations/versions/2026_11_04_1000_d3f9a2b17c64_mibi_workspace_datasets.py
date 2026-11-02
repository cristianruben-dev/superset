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
"""Mi BI datasets that belong to a workspace

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations.

Existing datasets go to a workspace when every dashboard that uses them is in that
same workspace. The others stay shared: any dashboard can use them.

Revision ID: d3f9a2b17c64
Revises: c5f08a1d7e42
Create Date: 2026-11-04 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, Integer

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_index,
    drop_table,
)

revision = "d3f9a2b17c64"
down_revision = "c5f08a1d7e42"

WORKSPACE_DATASETS_TABLE = "mibi_workspace_datasets"


def upgrade():
    create_table(
        WORKSPACE_DATASETS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("workspace_id", Integer, nullable=False),
        Column("dataset_id", Integer, nullable=False, unique=True),
    )
    create_index(
        WORKSPACE_DATASETS_TABLE,
        "idx_mibi_workspace_datasets_workspace_id",
        ["workspace_id"],
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_datasets_workspace_id",
        table_name=WORKSPACE_DATASETS_TABLE,
        referenced_table="mibi_workspaces",
        local_cols=["workspace_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_workspace_datasets_dataset_id",
        table_name=WORKSPACE_DATASETS_TABLE,
        referenced_table="tables",
        local_cols=["dataset_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    assign_existing_datasets()


def assign_existing_datasets() -> None:
    """Give each dataset the workspace that all its dashboards share, if any."""
    tables = sa.table("tables", sa.column("id", sa.Integer))
    slices = sa.table(
        "slices",
        sa.column("id", sa.Integer),
        sa.column("datasource_id", sa.Integer),
        sa.column("datasource_type", sa.String),
    )
    dashboard_slices = sa.table(
        "dashboard_slices",
        sa.column("dashboard_id", sa.Integer),
        sa.column("slice_id", sa.Integer),
    )
    workspace_dashboards = sa.table(
        "mibi_workspace_dashboards",
        sa.column("workspace_id", sa.Integer),
        sa.column("dashboard_id", sa.Integer),
    )
    workspace_datasets = sa.table(
        WORKSPACE_DATASETS_TABLE,
        sa.column("workspace_id", sa.Integer),
        sa.column("dataset_id", sa.Integer),
    )

    workspace_id = workspace_dashboards.c.workspace_id
    # A dashboard outside any workspace keeps the dataset shared
    outside_workspaces = sa.func.sum(sa.case((workspace_id.is_(None), 1), else_=0))
    usage = (
        sa.select(
            slices.c.datasource_id.label("dataset_id"),
            sa.func.min(workspace_id).label("workspace_id"),
        )
        .select_from(
            slices.join(tables, tables.c.id == slices.c.datasource_id)
            .join(dashboard_slices, dashboard_slices.c.slice_id == slices.c.id)
            .outerjoin(
                workspace_dashboards,
                workspace_dashboards.c.dashboard_id == dashboard_slices.c.dashboard_id,
            )
        )
        .where(slices.c.datasource_type == "table")
        .group_by(slices.c.datasource_id)
        .having(
            sa.and_(
                outside_workspaces == 0,
                sa.func.count(sa.distinct(workspace_id)) == 1,
            )
        )
    )
    op.execute(
        workspace_datasets.insert().from_select(["dataset_id", "workspace_id"], usage)
    )


def downgrade():
    drop_fks_for_table(
        WORKSPACE_DATASETS_TABLE,
        [
            "fk_mibi_workspace_datasets_workspace_id",
            "fk_mibi_workspace_datasets_dataset_id",
        ],
    )
    drop_index(WORKSPACE_DATASETS_TABLE, "idx_mibi_workspace_datasets_workspace_id")
    drop_table(WORKSPACE_DATASETS_TABLE)
