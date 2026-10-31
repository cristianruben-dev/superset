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
"""Mi BI dashboard background pictures

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations.

Revision ID: 3a90eb47d506
Revises: cce7fe34b50d
Create Date: 2026-10-31 12:00:00.000000

"""

from sqlalchemy import Column, DateTime, Integer, LargeBinary, String

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_fks_for_table,
    drop_table,
)

revision = "3a90eb47d506"
down_revision = "cce7fe34b50d"

TABLE = "mibi_dashboard_backgrounds"


def upgrade():
    create_table(
        TABLE,
        Column("dashboard_id", Integer, primary_key=True),
        Column("image", LargeBinary, nullable=False),
        Column("image_type", String(50), nullable=False),
        Column("changed_on", DateTime, nullable=False),
    )
    create_fks_for_table(
        foreign_key_name="fk_mibi_dashboard_backgrounds_dashboard_id",
        table_name=TABLE,
        referenced_table="dashboards",
        local_cols=["dashboard_id"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def downgrade():
    drop_fks_for_table(TABLE, ["fk_mibi_dashboard_backgrounds_dashboard_id"])
    drop_table(TABLE)
