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
"""Remove annotation layers and their annotations

A fork migration: when rebasing onto a new Superset release, keep it after the
other Mi BI migrations. Charts keep their formula, line and table annotation
layers, which live in the chart parameters; only the native layers and the
annotations stored in the database go away.

Revision ID: a91c5d27f3e8
Revises: e4ec3b61cadb
Create Date: 2026-11-02 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import Column, DateTime, Integer, String, Text

from superset.migrations.shared.utils import (
    create_fks_for_table,
    create_table,
    drop_table,
)
from superset.utils.core import MediumText

revision = "a91c5d27f3e8"
down_revision = "e4ec3b61cadb"

LAYERS_TABLE = "annotation_layer"
ANNOTATIONS_TABLE = "annotation"
INDEX_NAME = "ti_dag_state"
AUDIT_COLUMNS = ("created_by_fk", "changed_by_fk")
VIEW_MENUS = (
    "Annotation",
    "Annotation Layers",
    "AnnotationLayerRestApi",
    "AnnotationRestApi",
    "AnnotationLayerView",
)


def _delete_permissions() -> None:
    """Delete the permissions and menu entries of the removed views."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("ab_view_menu"):
        return
    names = ", ".join(f"'{name}'" for name in VIEW_MENUS)
    view_menus = f"SELECT id FROM ab_view_menu WHERE name IN ({names})"  # noqa: S608
    pvms = f"SELECT id FROM ab_permission_view WHERE view_menu_id IN ({view_menus})"  # noqa: S608
    bind.execute(
        sa.text(
            f"DELETE FROM ab_permission_view_role WHERE permission_view_id IN ({pvms})"  # noqa: S608
        )
    )
    bind.execute(
        sa.text(
            f"DELETE FROM ab_permission_view WHERE view_menu_id IN ({view_menus})"  # noqa: S608
        )
    )
    bind.execute(sa.text(f"DELETE FROM ab_view_menu WHERE name IN ({names})"))  # noqa: S608


def _audit_columns() -> list[Column]:
    return [
        Column("created_on", DateTime, nullable=True),
        Column("changed_on", DateTime, nullable=True),
        Column("created_by_fk", Integer, nullable=True),
        Column("changed_by_fk", Integer, nullable=True),
    ]


def _create_audit_fks(table_name: str) -> None:
    for audit_column in AUDIT_COLUMNS:
        create_fks_for_table(
            foreign_key_name=f"fk_{table_name}_{audit_column}_ab_user",
            table_name=table_name,
            referenced_table="ab_user",
            local_cols=[audit_column],
            remote_cols=["id"],
        )


def upgrade():
    _delete_permissions()
    drop_table(ANNOTATIONS_TABLE)
    drop_table(LAYERS_TABLE)


def downgrade():
    create_table(
        LAYERS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("name", String(250)),
        Column("descr", Text),
        *_audit_columns(),
    )
    _create_audit_fks(LAYERS_TABLE)
    create_table(
        ANNOTATIONS_TABLE,
        Column("id", Integer, primary_key=True),
        Column("start_dttm", DateTime),
        Column("end_dttm", DateTime),
        Column(
            "layer_id", Integer, sa.ForeignKey("annotation_layer.id"), nullable=False
        ),
        Column("short_descr", String(500)),
        Column("long_descr", Text),
        Column("json_metadata", MediumText()),
        *_audit_columns(),
    )
    _create_audit_fks(ANNOTATIONS_TABLE)
    op.create_index(
        INDEX_NAME, ANNOTATIONS_TABLE, ["layer_id", "start_dttm", "end_dttm"]
    )
