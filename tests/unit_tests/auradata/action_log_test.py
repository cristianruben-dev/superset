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
"""Tests for what the action log keeps."""

import pytest

from superset.auradata.action_log import is_recorded_action, select_records
from superset.utils.log import AbstractEventLogger, DBEventLogger


@pytest.mark.parametrize(
    "action",
    [
        "DashboardRestApi.post",
        "DashboardRestApi.put",
        "DashboardRestApi.delete",
        "DashboardRestApi.import_",
        "DashboardRestApi.export",
        "DatasetRestApi.bulk_delete",
        "DashboardRestApi.restore",
        "ChartRestApi.restore_version",
        "WorkspaceRestApi.put_member",
        "WorkspaceRestApi.put_dashboards",
    ],
)
def test_writes_and_exports_are_recorded(action: str) -> None:
    assert is_recorded_action(action)


@pytest.mark.parametrize(
    "action",
    [
        "DashboardRestApi.get_list",
        "DashboardRestApi.get",
        "DashboardRestApi.favorite_status",
        "DashboardRestApi.thumbnail",
        "ChartDataRestApi.data",
        "ChartDataRestApi.json_dumps",
        "DashboardFilterStateRestApi.post",
        "ExploreFormDataRestApi.put",
        "LogRestApi.post",
        "execute_sql",
        "load_into_dataframe",
        "csrf_token",
        "language_pack",
        "welcome",
        "screenshot.cache.dashboard",
    ],
)
def test_reads_and_internal_steps_are_dropped(action: str) -> None:
    assert not is_recorded_action(action)
    assert select_records(action, [{"a": 1}]) == []


def test_browser_batch_keeps_only_meaningful_events() -> None:
    records = [
        {"event_name": "mount_dashboard", "dashboard_id": 1},
        {"event_name": "load_chart"},
        {"event_name": "render_chart"},
        {"event_name": "spa_navigation"},
        {"event_name": "chart_download_as_csv"},
        {"event_name": "hide_browser_tab"},
    ]
    kept = select_records("log", records)
    assert [r["event_name"] for r in kept] == [
        "mount_dashboard",
        "chart_download_as_csv",
    ]


def test_only_the_db_logger_filters() -> None:
    records = [{"event_name": "load_chart"}]
    assert DBEventLogger().select_records("log", records) == []
    assert AbstractEventLogger.select_records(DBEventLogger(), "log", records) == (
        records
    )
