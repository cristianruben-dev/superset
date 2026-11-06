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
"""Keep what an answer cost after its conversation is deleted

The rows of the answers and their votes stay, without content and detached from the
conversation, so spending limits and usage keep their totals. The keys keep cascading:
only the deletion of ``conversations.py`` detaches a row first, and any other way of
deleting a conversation takes its content with it.

Downgrading deletes the detached rows, which cannot exist with the old columns, so the
totals of deleted conversations are lost. Upgrading again does not bring them back.

Revision ID: e5a7c3f19d42
Revises: b2d58e7a13c4
Create Date: 2026-11-09 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy_utils import UUIDType

# revision identifiers, used by Alembic.
revision = "e5a7c3f19d42"
down_revision = "b2d58e7a13c4"

MESSAGES = "auradata_assistant_messages"
FEEDBACK = "auradata_assistant_feedback"
TABLES = (MESSAGES, FEEDBACK)


def _set_nullable(table: str, nullable: bool) -> None:
    with op.batch_alter_table(table) as batch:
        batch.alter_column(
            "conversation_id",
            existing_type=UUIDType(binary=True),
            nullable=nullable,
        )


def upgrade():
    for table in TABLES:
        _set_nullable(table, True)


def downgrade():
    # Votes first: they point at the rows of the answers
    for table in reversed(TABLES):
        rows = sa.table(table, sa.column("conversation_id"))
        op.execute(rows.delete().where(rows.c.conversation_id.is_(None)))
    for table in TABLES:
        _set_nullable(table, False)
