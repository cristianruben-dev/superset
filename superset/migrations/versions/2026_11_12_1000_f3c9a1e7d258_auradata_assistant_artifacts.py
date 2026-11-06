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
"""Documents of the AI assistant and their versions

Only adds two tables. Downgrading deletes the documents; the conversations that wrote
them stay, with their calls, and can still be sent to the model.

Revision ID: f3c9a1e7d258
Revises: d47b1e9a6c30
Create Date: 2026-11-12 10:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_index,
    create_table,
    drop_fks_for_table,
    drop_table,
)
from superset.utils.core import MediumText

# revision identifiers, used by Alembic.
revision = "f3c9a1e7d258"
down_revision = "d47b1e9a6c30"

ARTIFACTS = "auradata_assistant_artifacts"
VERSIONS = "auradata_assistant_artifact_versions"

ARTIFACT_KEYS = {
    "fk_auradata_assistant_artifacts_conversation_id": (
        "conversation_id",
        "auradata_assistant_conversations",
        "CASCADE",
    ),
    "fk_auradata_assistant_artifacts_user_id_ab_user": (
        "user_id",
        "ab_user",
        "SET NULL",
    ),
    "fk_auradata_assistant_artifacts_dashboard_id_dashboards": (
        "dashboard_id",
        "dashboards",
        "SET NULL",
    ),
}
VERSION_KEYS = {
    "fk_auradata_assistant_artifact_versions_artifact_id": (
        "artifact_id",
        ARTIFACTS,
        "CASCADE",
    ),
}


def _add_keys(table: str, keys: dict[str, tuple[str, str, str]]) -> None:
    for name, (column, referenced_table, ondelete) in keys.items():
        create_fks_for_table(
            foreign_key_name=name,
            table_name=table,
            referenced_table=referenced_table,
            local_cols=[column],
            remote_cols=["id"],
            ondelete=ondelete,
        )


def upgrade():
    create_table(
        ARTIFACTS,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("conversation_id", UUIDType(binary=True), nullable=False),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("dashboard_id", sa.Integer, nullable=True),
        sa.Column("created_on", sa.DateTime, nullable=False),
    )
    create_index(
        ARTIFACTS,
        "ix_auradata_assistant_artifacts_conversation_id",
        ["conversation_id"],
    )
    create_index(ARTIFACTS, "ix_auradata_assistant_artifacts_user_id", ["user_id"])
    create_index(
        ARTIFACTS, "ix_auradata_assistant_artifacts_dashboard_id", ["dashboard_id"]
    )
    _add_keys(ARTIFACTS, ARTIFACT_KEYS)

    create_table(
        VERSIONS,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("artifact_id", UUIDType(binary=True), nullable=False),
        sa.Column("number", sa.Integer, nullable=False),
        sa.Column("title", sa.String(250), nullable=False),
        sa.Column("blocks", MediumText(), nullable=False),
        sa.Column("origin", sa.String(16), nullable=False),
        sa.Column("restored_from", sa.Integer, nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("created_on", sa.DateTime, nullable=False),
        sa.UniqueConstraint(
            "artifact_id", "number", name="uq_auradata_assistant_artifact_versions"
        ),
    )
    _add_keys(VERSIONS, VERSION_KEYS)


def downgrade():
    drop_fks_for_table(VERSIONS, list(VERSION_KEYS))
    drop_table(VERSIONS)
    drop_fks_for_table(ARTIFACTS, list(ARTIFACT_KEYS))
    drop_table(ARTIFACTS)
