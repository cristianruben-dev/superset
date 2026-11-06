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
"""Keep how much of the model's context each answer took

An answer can run the model several times, and its token columns add them all up, so
they cannot say how long a conversation is. Rows written before this one hold 0, which
the next answer of their conversation replaces.

Revision ID: d47b1e9a6c30
Revises: c8f2d6b4a917
Create Date: 2026-11-11 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d47b1e9a6c30"
down_revision = "c8f2d6b4a917"

MESSAGES = "auradata_assistant_messages"


def upgrade():
    with op.batch_alter_table(MESSAGES) as batch:
        batch.add_column(
            sa.Column(
                "context_tokens",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )


def downgrade():
    with op.batch_alter_table(MESSAGES) as batch:
        batch.drop_column("context_tokens")
