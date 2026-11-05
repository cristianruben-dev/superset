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
"""The production settings of the Docker image keep the tasks Superset schedules."""

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest

from superset.config import CeleryConfig as DefaultCeleryConfig

PROD_CONFIG = (
    Path(__file__).parents[3] / "docker" / "pythonpath_prod" / "superset_config.py"
)


@pytest.fixture
def prod_config(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    """Load docker/pythonpath_prod/superset_config.py with a minimal environment."""
    monkeypatch.setenv("SUPERSET_SECRET_KEY", "test-secret")
    monkeypatch.setenv("POSTGRES_USER", "auradata")
    monkeypatch.setenv("POSTGRES_PASSWORD", "pw")
    monkeypatch.setenv("POSTGRES_DB", "auradata")
    spec = importlib.util.spec_from_file_location("auradata_prod_config", PROD_CONFIG)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_celery_runs_every_task_superset_schedules(prod_config: ModuleType) -> None:
    """The soft delete and version history purges must not be lost to the override."""
    celery = prod_config.CELERY_CONFIG
    assert set(celery.beat_schedule) == set(DefaultCeleryConfig.beat_schedule)
    assert "deletion_retention.purge_soft_deleted" in celery.beat_schedule
    assert "version_history.prune_old_versions" in celery.beat_schedule
    assert set(celery.imports) == set(DefaultCeleryConfig.imports)
    assert "superset.tasks.export_dashboard_excel" in celery.imports


def test_celery_uses_redis(prod_config: ModuleType) -> None:
    """Only the broker and the result backend change from Superset's defaults."""
    celery = prod_config.CELERY_CONFIG
    assert celery.broker_url.startswith("redis://")
    assert celery.result_backend.startswith("redis://")
