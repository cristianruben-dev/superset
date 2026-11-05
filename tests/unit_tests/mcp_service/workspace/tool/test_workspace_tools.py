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
"""Workspace tools follow the workspace roles, as the REST API does."""

from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.auradata.models import Workspace, WorkspaceDashboard, WorkspaceDataset
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from tests.unit_tests.mcp_service.workspace.world import as_user, build_world, call


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    return build_world(session, mocker)


@pytest.mark.asyncio
async def test_list_workspaces_shows_only_the_users_workspaces(
    world: dict[str, Any],
) -> None:
    as_user(world, "Ana")
    result = await call("list_workspaces", {})
    assert [ws["name"] for ws in result["workspaces"]] == ["Ventas"]
    assert result["workspaces"][0]["role"] == "contributor"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Vera", ["Ventas"]),
        ("Carlos", ["Finanzas"]),
        ("Dani", []),
        ("Root", ["Finanzas", "Ventas"]),
    ],
)
async def test_list_workspaces_per_person(
    world: dict[str, Any], name: str, expected: list[str]
) -> None:
    as_user(world, name)
    result = await call("list_workspaces", {})
    assert [ws["name"] for ws in result["workspaces"]] == expected
    assert result["count"] == len(expected)


@pytest.mark.asyncio
async def test_list_workspaces_search(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    result = await call("list_workspaces", {"search": "fin"})
    assert [ws["name"] for ws in result["workspaces"]] == ["Finanzas"]


@pytest.mark.asyncio
async def test_get_workspace_lists_its_dashboards_and_datasets(
    world: dict[str, Any],
) -> None:
    as_user(world, "Vera")
    result = await call("get_workspace", {"workspace_id": world["ventas_ws"].id})

    assert result["workspace"]["role"] == "viewer"
    assert result["workspace"]["can_contribute"] is False
    assert [d["dashboard_title"] for d in result["dashboards"]] == ["Ventas"]
    assert result["dashboards"][0]["can_edit"] is False
    assert [d["table_name"] for d in result["datasets"]] == ["ventas"]


@pytest.mark.asyncio
async def test_a_member_of_another_workspace_does_not_see_it(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    result = await call("get_workspace", {"workspace_id": world["ventas_ws"].id})
    assert result["error_type"] == "NotFound"
    assert result["workspace"] is None


@pytest.mark.asyncio
async def test_create_workspace_makes_the_creator_its_admin(
    world: dict[str, Any],
) -> None:
    as_user(world, "Dani")
    result = await call(
        "create_workspace", {"name": "  Marketing ", "color": "#2563EB"}
    )

    assert result["success"] is True
    assert result["workspace"]["name"] == "Marketing"
    assert result["workspace"]["role"] == "admin"
    assert result["workspace"]["member_count"] == 1


@pytest.mark.asyncio
async def test_create_workspace_validates(world: dict[str, Any]) -> None:
    as_user(world, "Dani")
    result = await call("create_workspace", {"name": " ", "color": "blue"})

    assert result["success"] is False
    assert result["error_type"] == "InvalidRequest"
    assert "name" in result["error"]
    assert "color" in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "error_type"),
    [
        ("Ada", None),
        ("Root", None),
        ("Ana", "Forbidden"),
        ("Vera", "Forbidden"),
        ("Carlos", "NotFound"),
    ],
)
async def test_only_workspace_admins_update_it(
    world: dict[str, Any], name: str, error_type: str | None
) -> None:
    as_user(world, name)
    result = await call(
        "update_workspace",
        {"workspace_id": world["ventas_ws"].id, "description": "Equipo comercial"},
    )

    assert result["error_type"] == error_type
    assert result["success"] is (error_type is None)
    assert result["permission_denied"] is (error_type == "Forbidden")
    world["session"].refresh(world["ventas_ws"])
    assert (world["ventas_ws"].description == "Equipo comercial") is (
        error_type is None
    )


@pytest.mark.asyncio
async def test_delete_workspace_keeps_its_dashboards(world: dict[str, Any]) -> None:
    pk = world["ventas_ws"].id
    as_user(world, "Ana")
    denied = await call("delete_workspace", {"workspace_id": pk})
    assert denied["error_type"] == "Forbidden"

    as_user(world, "Ada")
    result = await call("delete_workspace", {"workspace_id": pk})
    assert result == {
        **result,
        "success": True,
        "deleted_id": pk,
        "deleted_name": "Ventas",
    }
    session = world["session"]
    assert session.get(Workspace, pk) is None
    assert session.get(Dashboard, world["dashboard"].id) is not None


@pytest.mark.asyncio
async def test_members_are_listed_admins_first(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    result = await call(
        "list_workspace_members", {"workspace_id": world["ventas_ws"].id}
    )
    assert [(m["username"], m["role"]) for m in result["members"]] == [
        ("ada", "admin"),
        ("ana", "contributor"),
        ("vera", "viewer"),
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "error_type"),
    [("Ada", None), ("Root", None), ("Ana", "Forbidden"), ("Carlos", "NotFound")],
)
async def test_only_workspace_admins_set_members(
    world: dict[str, Any], name: str, error_type: str | None
) -> None:
    dani = world["users"]["Dani"]
    as_user(world, name)
    result = await call(
        "set_workspace_member",
        {"workspace_id": world["ventas_ws"].id, "user_id": dani.id, "role": "viewer"},
    )

    assert result["error_type"] == error_type
    if error_type is None:
        assert result["member"]["username"] == "dani"
        assert result["member"]["role"] == "viewer"
        assert result["workspace"]["member_count"] == 4


@pytest.mark.asyncio
async def test_set_workspace_member_rejects_unknown_roles_and_users(
    world: dict[str, Any],
) -> None:
    as_user(world, "Ada")
    pk = world["ventas_ws"].id
    with pytest.raises(Exception, match="role"):
        await call(
            "set_workspace_member",
            {"workspace_id": pk, "user_id": world["users"]["Dani"].id, "role": "owner"},
        )
    unknown = await call(
        "set_workspace_member", {"workspace_id": pk, "user_id": 9999, "role": "viewer"}
    )
    assert unknown["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_a_workspace_keeps_one_admin(world: dict[str, Any]) -> None:
    ada = world["users"]["Ada"]
    pk = world["ventas_ws"].id
    as_user(world, "Ada")

    demoted = await call(
        "set_workspace_member",
        {"workspace_id": pk, "user_id": ada.id, "role": "viewer"},
    )
    removed = await call(
        "remove_workspace_member", {"workspace_id": pk, "user_id": ada.id}
    )

    assert demoted["error_type"] == "InvalidRequest"
    assert "one admin" in demoted["error"]
    assert removed["error_type"] == "InvalidRequest"


@pytest.mark.asyncio
async def test_members_leave_and_admins_remove(world: dict[str, Any]) -> None:
    pk = world["ventas_ws"].id
    vera = world["users"]["Vera"]

    as_user(world, "Ana")
    denied = await call(
        "remove_workspace_member", {"workspace_id": pk, "user_id": vera.id}
    )
    assert denied["error_type"] == "Forbidden"

    as_user(world, "Vera")
    left = await call(
        "remove_workspace_member", {"workspace_id": pk, "user_id": vera.id}
    )
    assert left["success"] is True
    assert left["left_workspace"] is True

    as_user(world, "Ada")
    ana = world["users"]["Ana"]
    removed = await call(
        "remove_workspace_member", {"workspace_id": pk, "user_id": ana.id}
    )
    assert removed["success"] is True
    assert removed["left_workspace"] is False
    members = await call("list_workspace_members", {"workspace_id": pk})
    assert [m["username"] for m in members["members"]] == ["ada"]


@pytest.mark.asyncio
async def test_member_candidates_are_for_admins(world: dict[str, Any]) -> None:
    pk = world["ventas_ws"].id
    as_user(world, "Ada")
    result = await call("list_member_candidates", {"workspace_id": pk})
    assert {u["username"] for u in result["candidates"]} == {"carlos", "dani", "root"}

    found = await call("list_member_candidates", {"workspace_id": pk, "search": "car"})
    assert [u["username"] for u in found["candidates"]] == ["carlos"]

    as_user(world, "Ana")
    denied = await call("list_member_candidates", {"workspace_id": pk})
    assert denied["error_type"] == "Forbidden"
    assert denied["candidates"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "expected"),
    [("Vera", "viewer"), ("Ana", "contributor"), ("Ada", "admin"), ("Root", "admin")],
)
async def test_get_workspace_of_dashboard(
    world: dict[str, Any], name: str, expected: str
) -> None:
    as_user(world, name)
    result = await call(
        "get_workspace_of_dashboard", {"dashboard_id": world["dashboard"].id}
    )
    assert result["workspace_ref"]["name"] == "Ventas"
    assert result["workspace_ref"]["role"] == expected

    shared = await call(
        "get_workspace_of_dashboard", {"dashboard_id": world["shared_dashboard"].id}
    )
    assert shared["workspace_ref"] is None
    assert shared["error"] is None


@pytest.mark.asyncio
async def test_the_dashboard_of_another_workspace_is_not_found(
    world: dict[str, Any],
) -> None:
    as_user(world, "Carlos")
    result = await call(
        "get_workspace_of_dashboard", {"dashboard_id": world["dashboard"].id}
    )
    assert result["error_type"] == "NotFound"
    assert result["workspace_ref"] is None


def workspace_of(world: dict[str, Any], dashboard: Dashboard) -> int | None:
    session = world["session"]
    session.expire_all()
    return (
        session.query(WorkspaceDashboard.workspace_id)
        .filter(WorkspaceDashboard.dashboard_id == dashboard.id)
        .scalar()
    )


@pytest.mark.asyncio
async def test_a_dashboard_cannot_leave_with_a_dataset_of_its_workspace(
    world: dict[str, Any],
) -> None:
    """Its chart uses "ventas", which only the Ventas workspace may use."""
    as_user(world, "Ana")
    result = await call(
        "move_dashboard_to_workspace",
        {"dashboard_id": world["dashboard"].id, "workspace_id": None},
    )

    assert result["error_type"] == "Conflict"
    assert "ventas" in result["error"]
    assert workspace_of(world, world["dashboard"]) == world["ventas_ws"].id


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "error_type"),
    [
        ("Root", None),
        # Contributors bring in only the dashboards they may edit
        ("Ana", "Forbidden"),
        ("Vera", "Forbidden"),
        ("Carlos", "NotFound"),
        ("Dani", "NotFound"),
    ],
)
async def test_move_a_dashboard_into_a_workspace(
    world: dict[str, Any], name: str, error_type: str | None
) -> None:
    as_user(world, name)
    result = await call(
        "move_dashboard_to_workspace",
        {
            "dashboard_id": world["shared_dashboard"].id,
            "workspace_id": world["ventas_ws"].id,
        },
    )

    assert result["error_type"] == error_type
    expected = world["ventas_ws"].id if error_type is None else None
    assert workspace_of(world, world["shared_dashboard"]) == expected
    if error_type is None:
        assert result["previous_workspace_id"] is None
        assert result["workspace"]["name"] == "Ventas"


@pytest.mark.asyncio
async def test_a_contributor_takes_a_dashboard_out_of_the_workspace(
    world: dict[str, Any],
) -> None:
    session = world["session"]
    link = session.query(WorkspaceDashboard).one()
    link.dashboard_id = world["shared_dashboard"].id
    session.commit()

    as_user(world, "Vera")
    denied = await call(
        "move_dashboard_to_workspace",
        {"dashboard_id": world["shared_dashboard"].id, "workspace_id": None},
    )
    assert denied["error_type"] == "Forbidden"

    as_user(world, "Ana")
    result = await call(
        "move_dashboard_to_workspace",
        {"dashboard_id": world["shared_dashboard"].id, "workspace_id": None},
    )
    assert result["success"] is True
    assert result["previous_workspace_id"] == world["ventas_ws"].id
    assert result["workspace"] is None
    assert workspace_of(world, world["shared_dashboard"]) is None


@pytest.mark.asyncio
async def test_moving_a_dashboard_where_it_is_changes_nothing(
    world: dict[str, Any],
) -> None:
    as_user(world, "Vera")
    result = await call(
        "move_dashboard_to_workspace",
        {"dashboard_id": world["dashboard"].id, "workspace_id": world["ventas_ws"].id},
    )
    assert result["success"] is True
    assert result["message"] == "The dashboard is already in this workspace."


def dataset_workspace(world: dict[str, Any], dataset: SqlaTable) -> int | None:
    session = world["session"]
    session.expire_all()
    return (
        session.query(WorkspaceDataset.workspace_id)
        .filter(WorkspaceDataset.dataset_id == dataset.id)
        .scalar()
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "error_type"),
    [
        ("Ana", None),
        ("Ada", None),
        ("Root", None),
        ("Vera", "Forbidden"),
        ("Carlos", "NotFound"),
    ],
)
async def test_contributors_share_a_dataset_of_their_workspace(
    world: dict[str, Any], name: str, error_type: str | None
) -> None:
    as_user(world, name)
    result = await call(
        "move_dataset_to_workspace",
        {"dataset_id": world["ventas"].id, "workspace_id": None},
    )

    assert result["error_type"] == error_type
    expected = None if error_type is None else world["ventas_ws"].id
    assert dataset_workspace(world, world["ventas"]) == expected


@pytest.mark.asyncio
async def test_a_dataset_used_outside_cannot_enter_a_workspace(
    world: dict[str, Any],
) -> None:
    """The "Compartido" dashboard, outside Ventas, uses "compartido"."""
    as_user(world, "Root")
    result = await call(
        "move_dataset_to_workspace",
        {"dataset_id": world["compartido"].id, "workspace_id": world["ventas_ws"].id},
    )

    assert result["error_type"] == "Conflict"
    assert "compartido" in result["error"]
    assert dataset_workspace(world, world["compartido"]) is None


@pytest.mark.asyncio
async def test_bringing_a_dataset_in_needs_real_editorship(
    world: dict[str, Any],
) -> None:
    """A workspace role never lets anyone take over a dataset they cannot edit."""
    as_user(world, "Ana")
    result = await call(
        "move_dataset_to_workspace",
        {"dataset_id": world["compartido"].id, "workspace_id": world["ventas_ws"].id},
    )

    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert dataset_workspace(world, world["compartido"]) is None


@pytest.mark.asyncio
async def test_an_admin_moves_an_unused_dataset_in(world: dict[str, Any]) -> None:
    session = world["session"]
    unused = SqlaTable(table_name="nuevo", database=world["ventas"].database)
    session.add(unused)
    session.commit()

    as_user(world, "Root")
    result = await call(
        "move_dataset_to_workspace",
        {"dataset_id": unused.id, "workspace_id": world["ventas_ws"].id},
    )

    assert result["success"] is True
    assert result["workspace"]["dataset_count"] == 2
    assert dataset_workspace(world, unused) == world["ventas_ws"].id
