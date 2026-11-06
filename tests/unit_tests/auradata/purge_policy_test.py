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
The purge policy of Superset 7.0 and the tables of AuraData BI.

A permanent delete of a dashboard or dataset, by hand or by the retention job,
refuses to run when its policy does not name every table that points at the
row. The fork adds tables (workspace links, backgrounds, element images) and
drops the one of themes, so each root must still be covered exactly.
"""

import superset.auradata.models  # noqa: F401  registers the tables of the fork
from superset.commands.deletion_retention.purge_policy import (
    DependencyClassification,
    get_purge_policy,
    purge_policy_registry,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard


def test_purge_policy_covers_every_table() -> None:
    """Every root has a complete policy, with no missing or stale table."""
    for model in purge_policy_registry():
        assert get_purge_policy(model).model is model


def owned_tables(model: type) -> set[str]:
    """Return the tables deleted together with the root."""
    return {
        dependency.key.related_table
        for dependency in get_purge_policy(model).dependencies
        if dependency.classification is DependencyClassification.OWNED
    }


def test_dashboard_purge_removes_its_format_and_workspace_link() -> None:
    """A dashboard takes its backgrounds, images and workspace link with it."""
    assert {
        "auradata_dashboard_backgrounds",
        "auradata_dashboard_images",
        "auradata_workspace_dashboards",
    } <= owned_tables(Dashboard)


def test_dashboard_purge_leaves_the_assistant_records_to_their_retention() -> None:
    """Their dashboard goes NULL and the assistant's retention erases them."""
    assert not {
        "auradata_assistant_artifacts",
        "auradata_assistant_conversations",
    } & owned_tables(Dashboard)


def test_dataset_purge_removes_its_workspace_link() -> None:
    """A dataset takes its workspace link with it."""
    assert "auradata_workspace_datasets" in owned_tables(SqlaTable)
