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
"""Images attached to the AI assistant

Only adds a table. Downgrading deletes the images, and the conversations that named them
can then no longer be sent to the model: delete those conversations first.

Revision ID: c8f2d6b4a917
Revises: e5a7c3f19d42
Create Date: 2026-11-10 10:00:00.000000

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
revision = "c8f2d6b4a917"
down_revision = "e5a7c3f19d42"

ATTACHMENTS = "auradata_assistant_attachments"

FOREIGN_KEYS = {
    "fk_auradata_assistant_attachments_conversation_id": (
        "conversation_id",
        "auradata_assistant_conversations",
        "CASCADE",
    ),
    "fk_auradata_assistant_attachments_user_id_ab_user": (
        "user_id",
        "ab_user",
        "SET NULL",
    ),
}


def upgrade():
    create_table(
        ATTACHMENTS,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("conversation_id", UUIDType(binary=True), nullable=True),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("image", sa.LargeBinary(length=2**24 - 1), nullable=False),
        sa.Column("image_type", sa.String(50), nullable=False),
        sa.Column("width", sa.Integer, nullable=False),
        sa.Column("height", sa.Integer, nullable=False),
        sa.Column("created_on", sa.DateTime, nullable=False),
    )
    create_index(
        ATTACHMENTS,
        "ix_auradata_assistant_attachments_conversation_id",
        ["conversation_id"],
    )
    create_index(ATTACHMENTS, "ix_auradata_assistant_attachments_user_id", ["user_id"])
    create_index(
        ATTACHMENTS, "ix_auradata_assistant_attachments_created_on", ["created_on"]
    )
    for name, (column, referenced_table, ondelete) in FOREIGN_KEYS.items():
        create_fks_for_table(
            foreign_key_name=name,
            table_name=ATTACHMENTS,
            referenced_table=referenced_table,
            local_cols=[column],
            remote_cols=["id"],
            ondelete=ondelete,
        )


def downgrade():
    drop_fks_for_table(ATTACHMENTS, list(FOREIGN_KEYS))
    drop_table(ATTACHMENTS)
