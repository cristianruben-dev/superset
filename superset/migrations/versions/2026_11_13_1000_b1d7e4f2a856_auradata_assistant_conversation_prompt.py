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
"""The system prompt a conversation of the AI assistant started with

Only adds a column. A conversation that already exists keeps it empty, because nothing
recorded what it was sent: its next turn stores the prompt of that moment. Downgrading
drops what was stored, and each conversation then gets the prompt of the day again.

Revision ID: b1d7e4f2a856
Revises: f3c9a1e7d258
Create Date: 2026-11-13 10:00:00.000000

"""

import sqlalchemy as sa

from superset.migrations.shared.utils import add_columns, drop_columns
from superset.utils.core import MediumText

# revision identifiers, used by Alembic.
revision = "b1d7e4f2a856"
down_revision = "f3c9a1e7d258"

CONVERSATIONS = "auradata_assistant_conversations"


def upgrade() -> None:
    add_columns(CONVERSATIONS, sa.Column("system_prompt", MediumText(), nullable=True))


def downgrade() -> None:
    drop_columns(CONVERSATIONS, "system_prompt")
