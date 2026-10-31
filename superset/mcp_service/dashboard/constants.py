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

"""
Shared constants for MCP dashboard tools.

Values match frontend defaults from
``superset-frontend/src/dashboard/util/constants.ts``.
"""

import uuid
from typing import Any

GRID_DEFAULT_CHART_WIDTH = 4
GRID_COLUMN_COUNT = 12


def generate_id(prefix: str) -> str:
    """
    Generate a component ID matching the frontend's nanoid-style pattern.

    Uses a UUID hex prefix to produce IDs like ``ROW-a1b2c3d4`` which are
    compatible with the frontend's ``nanoid()``-based ID generation.
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def layout_column_count(layout: dict[str, Any]) -> int:
    """
    The grid density of a dashboard layout. AuraData BI dashboards can use 24 or 48
    columns instead of 12, kept on the root component as ``mibiColumns``.
    """
    root = layout.get("ROOT_ID")
    meta = root.get("meta") if isinstance(root, dict) else None
    count = meta.get("mibiColumns") if isinstance(meta, dict) else None
    return count if count in (12, 24, 48) else GRID_COLUMN_COUNT


def scaled_width(width: int, column_count: int) -> int:
    """A width in 12-column units, with the same share of ``column_count``."""
    return max(1, round(width * column_count / GRID_COLUMN_COUNT))
