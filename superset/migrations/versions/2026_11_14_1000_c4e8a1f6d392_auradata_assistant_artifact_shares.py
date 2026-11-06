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
"""Share a document of the AI assistant inside a workspace

Only adds columns, empty for every document. Downgrading drops them, which closes every
share: the documents stay with their owners.

Revision ID: c4e8a1f6d392
Revises: b1d7e4f2a856
Create Date: 2026-11-14 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import (
    add_columns,
    create_fks_for_table,
    create_index,
    drop_columns,
    drop_fks_for_table,
    drop_index,
)

# revision identifiers, used by Alembic.
revision = "c4e8a1f6d392"
down_revision = "b1d7e4f2a856"

ARTIFACTS = "auradata_assistant_artifacts"
WORKSPACES = "auradata_workspaces"
KEY = "fk_auradata_assistant_artifacts_shared_workspace_id"
INDEX = "ix_auradata_assistant_artifacts_shared_workspace_id"


def upgrade() -> None:
    add_columns(
        ARTIFACTS,
        sa.Column("shared_workspace_id", sa.Integer(), nullable=True),
        sa.Column("shared_version", sa.Integer(), nullable=True),
        sa.Column("shared_on", sa.DateTime(), nullable=True),
    )
    create_fks_for_table(
        KEY, ARTIFACTS, WORKSPACES, ["shared_workspace_id"], ["id"], ondelete="SET NULL"
    )
    create_index(ARTIFACTS, INDEX, ["shared_workspace_id"])


def downgrade() -> None:
    drop_index(ARTIFACTS, INDEX)
    drop_fks_for_table(ARTIFACTS, [KEY])
    drop_columns(ARTIFACTS, "shared_workspace_id", "shared_version", "shared_on")
