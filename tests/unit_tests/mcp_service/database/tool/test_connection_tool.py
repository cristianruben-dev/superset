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
test_database_connection tests a stored connection on the server, for those
who manage connections (admins), and no database tool returns a credential.
"""

import sqlite3
from pathlib import Path
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.mcp_service.database.schemas import SECRET_MASK
from superset.models.core import Database
from superset.utils import json
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

SECRETS = ("s3cretpw", "cpw-secret", "pk-secret")


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session, tmp_path: Path) -> dict[str, Any]:
    world = build_world(session, mocker)
    path = tmp_path / "almacen.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE ventas (region TEXT)")
    working = Database(database_name="local", sqlalchemy_uri=f"sqlite:///{path}")
    secret = Database(
        database_name="secreta",
        extra=json.dumps(
            {"engine_params": {"connect_args": {"password": "cpw-secret"}}}
        ),
        encrypted_extra=json.dumps({"credentials_info": {"private_key": "pk-secret"}}),
    )
    secret.set_sqlalchemy_uri("postgresql://ana:s3cretpw@127.0.0.1:1/almacen")
    session.add_all([working, secret])
    session.commit()
    world.update(working=working, secret=secret)
    return world


def no_database_writes(world: dict[str, Any]) -> None:
    """Superset roles below admin read databases but never write them."""
    world["mocker"].patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: not (
            view == "Database" and permission == "can_write"
        ),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Ada", "Vera", "Dani"])
async def test_only_connection_managers_test_connections(
    world: dict[str, Any], name: str
) -> None:
    no_database_writes(world)
    as_user(world, name)
    result = await call(
        "test_database_connection", {"database_id": world["working"].id}
    )
    assert result["ok"] is False
    assert result["error_type"] == "Forbidden"
    assert result["connections_url"].endswith("/databaseview/list/")


@pytest.mark.asyncio
async def test_admin_tests_a_working_connection(world: dict[str, Any]) -> None:
    no_database_writes(world)
    as_user(world, "Root")
    result = await call(
        "test_database_connection", {"database_id": world["working"].id}
    )
    assert result["ok"] is True, result
    assert result["database_name"] == "local"
    assert result["error"] is None


@pytest.mark.asyncio
async def test_unknown_connection_is_not_found(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    result = await call("test_database_connection", {"database_id": 9999})
    assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_failure_is_readable_and_without_secrets(
    world: dict[str, Any],
) -> None:
    """A driver that echoes the URI still never hands the password back."""
    as_user(world, "Root")
    uri = world["secret"].sqlalchemy_uri_decrypted
    world["mocker"].patch(
        "superset.commands.database.test_connection.TestConnectionDatabaseCommand.run",
        side_effect=RuntimeError(f"could not connect to {uri}"),
    )
    world["mocker"].patch(
        "superset.mcp_service.database.tool.test_database_connection.failure_message",
        side_effect=lambda exc: str(exc),
    )
    result = await call("test_database_connection", {"database_id": world["secret"].id})
    assert result["ok"] is False
    assert result["error_type"] == "ConnectionFailed"
    assert "could not connect" in result["error"]
    assert not any(secret in json.dumps(result) for secret in SECRETS)


@pytest.mark.asyncio
async def test_unreachable_connection_reports_without_secrets(
    world: dict[str, Any],
) -> None:
    """A real failed attempt, against a closed port."""
    as_user(world, "Root")
    result = await call("test_database_connection", {"database_id": world["secret"].id})
    assert result["ok"] is False
    assert result["error"]
    assert not any(secret in json.dumps(result) for secret in SECRETS)


@pytest.mark.asyncio
async def test_database_reads_never_return_credentials(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    info = await call("get_database_info", {"identifier": world["secret"].id})
    assert info["database_name"] == "secreta", info
    assert info["extra"]["engine_params"]["connect_args"]["password"] == SECRET_MASK
    listed = await call(
        "list_databases",
        {"page_size": 50, "select_columns": ["id", "database_name", "extra"]},
    )
    secreta = next(d for d in listed["databases"] if d["database_name"] == "secreta")
    assert secreta["extra"]["engine_params"]["connect_args"]["password"] == SECRET_MASK
    for result in (info, listed):
        text = json.dumps(result)
        assert not any(secret in text for secret in SECRETS)
        assert "encrypted_extra" not in text
        assert "sqlalchemy_uri" not in text
