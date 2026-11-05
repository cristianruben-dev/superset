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
"""Rename the persisted mibi names to auradata

AuraData BI started with the internal prefix ``mibi``. This revision renames what
the database keeps under that prefix:

- the fork tables (``mibi_workspaces``...) and, on PostgreSQL, their constraints,
  indexes and sequences;
- the layout keys (``meta.mibiPos``...), component keys (``mibi-filter``...), the
  ``mibi`` palette, form data keys (``mibi_sort_by``...) and the
  ``mibi-drillthrough`` data mask in dashboards, charts, their saved versions and
  the dashboard and explore permalinks;
- the ``.mibi-*`` classes, ``data-mibi-*`` attributes and ``--mibi-*`` variables
  in the CSS of dashboards.

Text is rewritten with patterns anchored on a JSON quote (or a CSS selector), so
the JSON keeps its formatting and words that merely contain "mibi" stay. The
downgrade applies the exact inverse patterns.

Revision ID: a7e3c91d4b60
Revises: f1c7a9e2b305
Create Date: 2026-11-06 10:00:00.000000

"""

from __future__ import annotations

import re
from typing import Callable

import sqlalchemy as sa
from alembic import op

from superset.migrations.shared.utils import has_table

# revision identifiers, used by Alembic.
revision = "a7e3c91d4b60"
down_revision = "f1c7a9e2b305"

OLD = "mibi"
NEW = "auradata"
BATCH_SIZE = 500

TABLES = [
    "workspaces",
    "workspace_dashboards",
    "workspace_members",
    "workspace_datasets",
    "dashboard_backgrounds",
    "dashboard_images",
]

PERMALINK_RESOURCES = ("dashboard_permalink", "explore_permalink")


def _json_rewriter(old: str, new: str) -> Callable[[str], str]:
    """Rename keys and values that start with ``old`` inside JSON text."""
    pattern = re.compile(rf'"{old}(?=[A-Z_\-"])')
    return lambda text: pattern.sub(f'"{new}', text)


def _css_rewriter(old: str, new: str) -> Callable[[str], str]:
    """Rename classes, data attributes and custom properties in CSS."""
    pattern = re.compile(rf"(\.|data-|--){old}-")
    return lambda text: pattern.sub(rf"\g<1>{new}-", text)


def _rewrite_text_columns(
    table: str,
    keys: list[str],
    columns: dict[str, Callable[[str], str]],
    marker: str,
) -> None:
    """Rewrite text columns of every row that mentions ``marker``, in batches."""
    if not has_table(table):
        return
    bind = op.get_bind()
    tbl = sa.table(table, *[sa.column(name) for name in [*keys, *columns]])
    key_cols = [tbl.c[name] for name in keys]
    mentions = sa.or_(*[tbl.c[name].like(f"%{marker}%") for name in columns])
    last: tuple[object, ...] | None = None
    while True:
        query = sa.select(*key_cols, *[tbl.c[name] for name in columns]).where(mentions)
        if last is not None:
            query = query.where(sa.tuple_(*key_cols) > sa.tuple_(*last))
        rows = bind.execute(query.order_by(*key_cols).limit(BATCH_SIZE)).fetchall()
        if not rows:
            break
        for row in rows:
            key = tuple(row[: len(keys)])
            values = {}
            for index, (name, rewrite) in enumerate(columns.items()):
                current = row[len(keys) + index]
                if current:
                    updated = rewrite(current)
                    if updated != current:
                        values[name] = updated
            if values:
                bind.execute(
                    tbl.update()
                    .where(
                        *[
                            col == value
                            for col, value in zip(key_cols, key, strict=True)
                        ]
                    )
                    .values(**values)
                )
        last = tuple(rows[-1][: len(keys)])


def _rewrite_permalinks(rewrite: Callable[[str], str], marker: str) -> None:
    """Rewrite the JSON state of dashboard and explore permalinks."""
    if not has_table("key_value"):
        return
    bind = op.get_bind()
    tbl = sa.table(
        "key_value", sa.column("id"), sa.column("resource"), sa.column("value")
    )
    last = 0
    while True:
        rows = bind.execute(
            sa.select(tbl.c.id, tbl.c.value)
            .where(tbl.c.resource.in_(PERMALINK_RESOURCES), tbl.c.id > last)
            .order_by(tbl.c.id)
            .limit(BATCH_SIZE)
        ).fetchall()
        if not rows:
            break
        for row_id, value in rows:
            try:
                text = bytes(value).decode("utf-8")
            except (TypeError, UnicodeDecodeError):
                continue
            if marker not in text:
                continue
            updated = rewrite(text)
            if updated != text:
                bind.execute(
                    tbl.update()
                    .where(tbl.c.id == row_id)
                    .values(value=updated.encode("utf-8"))
                )
        last = rows[-1][0]


def _rename_schema(old: str, new: str) -> None:
    """Rename the fork tables, plus their constraints, indexes and sequences."""
    bind = op.get_bind()
    for name in TABLES:
        if has_table(f"{old}_{name}"):
            op.rename_table(f"{old}_{name}", f"{new}_{name}")
    if bind.dialect.name != "postgresql":
        return
    tables = [f"{new}_{name}" for name in TABLES]
    constraints = bind.execute(
        sa.text(
            "SELECT c.relname, con.conname FROM pg_constraint con "
            "JOIN pg_class c ON c.oid = con.conrelid "
            "WHERE c.relname = ANY(:tables) AND con.conname LIKE :pattern"
        ),
        {"tables": tables, "pattern": f"%{old}%"},
    ).fetchall()
    for table, constraint in constraints:
        op.execute(
            f'ALTER TABLE "{table}" RENAME CONSTRAINT "{constraint}" '
            f'TO "{constraint.replace(old, new)}"'
        )
    # Constraint indexes were renamed with their constraint; these are the rest.
    indexes = bind.execute(
        sa.text(
            "SELECT indexname FROM pg_indexes "
            "WHERE tablename = ANY(:tables) AND indexname LIKE :pattern"
        ),
        {"tables": tables, "pattern": f"%{old}%"},
    ).fetchall()
    for (index,) in indexes:
        op.execute(f'ALTER INDEX "{index}" RENAME TO "{index.replace(old, new)}"')
    sequences = bind.execute(
        sa.text(
            "SELECT sequence_name FROM information_schema.sequences "
            "WHERE sequence_name LIKE :pattern"
        ),
        {"pattern": f"{old}\\_%"},
    ).fetchall()
    for (sequence,) in sequences:
        op.execute(
            f'ALTER SEQUENCE "{sequence}" RENAME TO "{sequence.replace(old, new, 1)}"'
        )


def _rename_data(old: str, new: str) -> None:
    """Rewrite the persisted names in dashboards, charts and permalinks."""
    json_text = _json_rewriter(old, new)
    css_text = _css_rewriter(old, new)
    dashboard_columns = {
        "position_json": json_text,
        "json_metadata": json_text,
        "css": css_text,
    }
    _rewrite_text_columns("dashboards", ["id"], dashboard_columns, old)
    _rewrite_text_columns(
        "dashboards_version", ["id", "transaction_id"], dashboard_columns, old
    )
    _rewrite_text_columns(
        "slices", ["id"], {"params": json_text, "query_context": json_text}, old
    )
    _rewrite_text_columns(
        "slices_version", ["id", "transaction_id"], {"params": json_text}, old
    )
    _rewrite_permalinks(json_text, old)


def upgrade() -> None:
    _rename_schema(OLD, NEW)
    _rename_data(OLD, NEW)


def downgrade() -> None:
    _rename_data(NEW, OLD)
    _rename_schema(NEW, OLD)
