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
What the action log keeps.

Superset logs every API call and every browser timing event, so the log fills
with reads and internal steps that say nothing about what people did. The
action log keeps only what changes data or takes data out, plus the two page
views the "Recent" section of the home page is built from.

The MCP service writes its own records (`mcp_tool_call` and friends) straight
to the logger, outside this filter, so what an AI does stays in the log. The
in-app assistant runs the same tools without that service, so it writes one
`assistant_tool_call` per call, which this filter keeps by name.
"""

from __future__ import annotations

from typing import Any

# Action name the browser uses to send its events in a batch.
CLIENT_ACTION = "log"

# One tool call of the in-app assistant. Its JSON names the tool and the model.
ASSISTANT_TOOL_CALL = "assistant_tool_call"

# Browser events that are kept. `mount_dashboard` and `mount_explorer` feed the
# "Recent" section of the home page.
RECORDED_CLIENT_EVENTS = frozenset(
    {
        "mount_dashboard",
        "mount_explorer",
        "confirm_overwrite_dashboard_metadata",
        "dashboard_download_as_image",
        "dashboard_download_as_pdf",
        "export_csv_dashboard_chart",
        "export_xlsx_dashboard_chart",
        "chart_download_as_image",
        "chart_download_as_csv",
        "chart_download_as_csv_pivoted",
        "chart_download_as_xls",
        "chart_download_as_json",
        "dataset_creation_success",
        "sqllab_run_query",
        "sqllab_create_table_as",
        "sqllab_create_view_as",
        "sqllab_save_query",
        "sqllab_save_dataset",
        "sqllab_download_csv",
        "sqllab_create_chart",
    }
)

# API methods (the part after `Class.` in the action) that write or export data.
RECORDED_API_METHODS = frozenset(
    {
        "post",
        "put",
        "delete",
        "bulk_delete",
        "import_",
        "export",
        "export_as_example",
        "copy_dash",
        "put_filters",
        "put_colors",
        "set_embedded",
        "delete_embedded",
        "execute_sql_query",
        "export_csv",
        "restore",
        "restore_version",
        "put_image",
        "delete_image",
        "put_dashboards",
        "put_datasets",
        "put_member",
        "delete_member",
    }
)

# API classes whose writes are transient UI state, not user actions.
IGNORED_API_CLASSES = frozenset(
    {
        "DashboardFilterStateRestApi",
        "ExploreFormDataRestApi",
        "ExplorePermalinkRestApi",
        "LogRestApi",
        "TabStateView",
    }
)


def is_recorded_action(action: str) -> bool:
    """Whether an API action (`Class.method`) is kept in the action log."""
    class_name, _, method = action.partition(".")
    if not method or class_name in IGNORED_API_CLASSES:
        return False
    return method in RECORDED_API_METHODS


def select_records(action: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    The records of an event the action log keeps.

    Browser batches are filtered event by event; API actions are kept or
    dropped whole. Actions outside the Superset API naming (`Class.method`)
    and the browser batch, such as internal steps, are dropped.
    """
    if action == ASSISTANT_TOOL_CALL:
        return records
    if action == CLIENT_ACTION:
        return [
            record
            for record in records
            if record.get("event_name") in RECORDED_CLIENT_EVENTS
        ]
    return records if is_recorded_action(action) else []
