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
restore_dataset brings a dataset back from the trash for the same people as
the web: Dani edits the dataset "ventas", Ana and Ada contribute to and
administer its workspace (which doesn't make them its editors), Vera views it,
Carlos is in another workspace and Root is a Superset admin.
"""

from datetime import datetime
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.connectors.sqla.models import SqlaTable
from superset.models.helpers import skip_visibility_filter
from superset.subjects.utils import get_or_create_user_subject
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    world["ventas"].editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    world["ventas"].deleted_at = datetime(2026, 11, 5, 9, 0)
    session.commit()
    return world


def deleted_at(world: dict[str, Any]) -> datetime | None:
    session = world["session"]
    session.expire_all()
    with skip_visibility_filter(session, SqlaTable):
        return session.get(SqlaTable, world["ventas"].id).deleted_at


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Root"])
async def test_an_editor_or_admin_restores_the_dataset(
    world: dict[str, Any], name: str
) -> None:
    as_user(world, name)
    result = await call("restore_dataset", {"identifier": world["ventas"].id})

    assert result["success"] is True, result
    assert result["restored_id"] == world["ventas"].id
    assert result["restored_name"] == "ventas"
    assert deleted_at(world) is None


@pytest.mark.asyncio
async def test_restore_by_uuid(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call("restore_dataset", {"identifier": str(world["ventas"].uuid)})

    assert result["success"] is True, result
    assert deleted_at(world) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Ada", "Vera"])
async def test_workspace_members_who_dont_edit_it_are_refused(
    world: dict[str, Any], name: str
) -> None:
    """Workspace roles edit dashboards and charts, never datasets."""
    as_user(world, name)
    result = await call("restore_dataset", {"identifier": world["ventas"].id})

    assert result["success"] is False
    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert deleted_at(world) is not None


@pytest.mark.asyncio
async def test_another_workspace_does_not_learn_it_exists(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    result = await call("restore_dataset", {"identifier": world["ventas"].id})

    assert result["error_type"] == "NotFound"
    assert "ventas" not in result["error"]
    assert deleted_at(world) is not None


@pytest.mark.asyncio
async def test_a_live_dataset_has_nothing_to_restore(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    result = await call("restore_dataset", {"identifier": world["compartido"].id})

    assert result["success"] is False
    assert result["error_type"] == "NotDeleted"


@pytest.mark.asyncio
async def test_an_active_twin_blocks_the_restore(world: dict[str, Any]) -> None:
    session = world["session"]
    session.add(SqlaTable(table_name="ventas", database=world["ventas"].database))
    session.commit()
    as_user(world, "Dani")
    result = await call("restore_dataset", {"identifier": world["ventas"].id})

    assert result["success"] is False
    assert result["error_type"] == "Conflict"
    assert deleted_at(world) is not None


@pytest.mark.asyncio
async def test_the_trash_points_at_restore_dataset(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    result = await call("list_trash", {"entity_types": ["dataset"]})

    assert result.get("error") is None, result
    assert [(i["id"], i["restore_tool"]) for i in result["items"]] == [
        (world["ventas"].id, "restore_dataset")
    ]
