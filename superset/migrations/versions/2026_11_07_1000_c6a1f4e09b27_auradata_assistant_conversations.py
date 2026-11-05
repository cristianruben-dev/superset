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
"""Conversations of the AI assistant and the messages they hold

Revision ID: c6a1f4e09b27
Revises: a7e3c91d4b60
Create Date: 2026-11-07 10:00:00.000000

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
revision = "c6a1f4e09b27"
down_revision = "a7e3c91d4b60"

CONVERSATIONS = "auradata_assistant_conversations"
MESSAGES = "auradata_assistant_messages"
WORKSPACES = "auradata_workspaces"

CONVERSATION_FKS = {
    "fk_auradata_assistant_conversations_user_id_ab_user": ("user_id", "ab_user"),
    "fk_auradata_assistant_conversations_dashboard_id": ("dashboard_id", "dashboards"),
}
MESSAGE_FKS = {
    "fk_auradata_assistant_messages_user_id_ab_user": ("user_id", "ab_user"),
    "fk_auradata_assistant_messages_workspace_id": ("workspace_id", WORKSPACES),
}


def upgrade():
    create_table(
        CONVERSATIONS,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("dashboard_id", sa.Integer, nullable=True),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("model", sa.String(128), nullable=False),
        sa.Column("title", sa.String(250), nullable=False),
        sa.Column("created_on", sa.DateTime, nullable=False),
        sa.Column("changed_on", sa.DateTime, nullable=False),
    )
    create_index(
        CONVERSATIONS, "ix_auradata_assistant_conversations_user_id", ["user_id"]
    )
    create_index(
        CONVERSATIONS,
        "ix_auradata_assistant_conversations_dashboard_id",
        ["dashboard_id"],
    )
    create_table(
        MESSAGES,
        sa.Column("id", UUIDType(binary=True), primary_key=True),
        sa.Column("conversation_id", UUIDType(binary=True), nullable=False),
        sa.Column("seq", sa.Integer, nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", MediumText(), nullable=False),
        sa.Column("stop_reason", sa.String(32), nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("user_id", sa.Integer, nullable=True),
        sa.Column("workspace_id", sa.Integer, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=False),
        sa.Column("output_tokens", sa.Integer, nullable=False),
        sa.Column("cache_read_input_tokens", sa.Integer, nullable=False),
        sa.Column("cache_creation_input_tokens", sa.Integer, nullable=False),
        sa.Column("cost_usd", sa.Numeric(14, 6), nullable=False),
        sa.Column("created_on", sa.DateTime, nullable=False),
        sa.UniqueConstraint(
            "conversation_id", "seq", name="uq_auradata_assistant_messages_seq"
        ),
    )
    create_index(MESSAGES, "ix_auradata_assistant_messages_user_id", ["user_id"])
    create_index(
        MESSAGES, "ix_auradata_assistant_messages_workspace_id", ["workspace_id"]
    )
    create_index(MESSAGES, "ix_auradata_assistant_messages_created_on", ["created_on"])
    create_fks_for_table(
        foreign_key_name="fk_auradata_assistant_messages_conversation_id",
        table_name=MESSAGES,
        referenced_table=CONVERSATIONS,
        local_cols=["conversation_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    for table, foreign_keys in (
        (CONVERSATIONS, CONVERSATION_FKS),
        (MESSAGES, MESSAGE_FKS),
    ):
        for name, (column, referenced_table) in foreign_keys.items():
            create_fks_for_table(
                foreign_key_name=name,
                table_name=table,
                referenced_table=referenced_table,
                local_cols=[column],
                remote_cols=["id"],
                ondelete="SET NULL",
            )


def downgrade():
    drop_fks_for_table(
        MESSAGES,
        ["fk_auradata_assistant_messages_conversation_id", *MESSAGE_FKS],
    )
    drop_table(MESSAGES)
    drop_fks_for_table(CONVERSATIONS, list(CONVERSATION_FKS))
    drop_table(CONVERSATIONS)
