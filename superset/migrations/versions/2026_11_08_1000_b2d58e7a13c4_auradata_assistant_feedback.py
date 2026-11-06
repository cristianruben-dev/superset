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
"""Votes on the answers of the AI assistant

Revision ID: b2d58e7a13c4
Revises: c6a1f4e09b27
Create Date: 2026-11-08 10:00:00.000000

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

# revision identifiers, used by Alembic.
revision = "b2d58e7a13c4"
down_revision = "c6a1f4e09b27"

FEEDBACK = "auradata_assistant_feedback"

FOREIGN_KEYS = {
    "fk_auradata_assistant_feedback_message_id": (
        "message_id",
        "auradata_assistant_messages",
        "CASCADE",
    ),
    "fk_auradata_assistant_feedback_conversation_id": (
        "conversation_id",
        "auradata_assistant_conversations",
        "CASCADE",
    ),
    "fk_auradata_assistant_feedback_user_id_ab_user": (
        "user_id",
        "ab_user",
        "SET NULL",
    ),
}


def upgrade():
    create_table(
        FEEDBACK,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("message_id", UUIDType(binary=True), nullable=False),
        sa.Column("conversation_id", UUIDType(binary=True), nullable=False),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("vote", sa.String(8), nullable=False),
        sa.Column("reason", sa.String(32), nullable=True),
        sa.Column("created_on", sa.DateTime, nullable=False),
        sa.Column("changed_on", sa.DateTime, nullable=False),
        sa.UniqueConstraint(
            "message_id", "user_id", name="uq_auradata_assistant_feedback_vote"
        ),
    )
    create_index(
        FEEDBACK, "ix_auradata_assistant_feedback_conversation_id", ["conversation_id"]
    )
    create_index(FEEDBACK, "ix_auradata_assistant_feedback_user_id", ["user_id"])
    for name, (column, referenced_table, ondelete) in FOREIGN_KEYS.items():
        create_fks_for_table(
            foreign_key_name=name,
            table_name=FEEDBACK,
            referenced_table=referenced_table,
            local_cols=[column],
            remote_cols=["id"],
            ondelete=ondelete,
        )


def downgrade():
    drop_fks_for_table(FEEDBACK, list(FOREIGN_KEYS))
    drop_table(FEEDBACK)
