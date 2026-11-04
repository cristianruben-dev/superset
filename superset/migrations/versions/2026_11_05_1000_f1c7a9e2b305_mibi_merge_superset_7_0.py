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
"""Join the AuraData BI migrations with the Superset 7.0 ones

A merge revision instead of moving the first fork migration (8bc9e5b95335) after
the 7.0 head: a database that already ran the fork migrations on top of 6.1 would
otherwise count every 7.0 migration as applied and skip them. With this merge,
`superset db upgrade` applies whichever branch a database is missing.

Revision ID: f1c7a9e2b305
Revises: ('88a01c781622', 'd3f9a2b17c64')
Create Date: 2026-11-05 10:00:00.000000

"""

# revision identifiers, used by Alembic.
revision = "f1c7a9e2b305"
down_revision = ("88a01c781622", "d3f9a2b17c64")


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
