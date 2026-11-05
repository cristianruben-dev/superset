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
The trash and version history tools answer the same people as the web: Dani
edits the dashboard and its chart as their editor, Ana and Ada as contributor
and admin of its workspace, Vera only views it, Carlos is in another workspace
and Root is a Superset admin.

The version rows themselves come from Continuum, which the in-memory database
does not run: the tests give the history a fixed list of versions and the
restore engine a fixed change, and keep every permission check real.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset.auradata.models import Workspace, WorkspaceDataset
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.subjects.utils import get_or_create_user_subject
from superset.versioning.queries import derive_version_uuid
from superset.versioning.restore import RestoreResult
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

READERS = ["Dani", "Ana", "Ada", "Root"]


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    subject = get_or_create_user_subject(world["users"]["Dani"].id)
    world["dashboard"].editors = [subject]
    world["chart"].editors = [subject]
    session.commit()
    return world


def fresh(world: dict[str, Any], model: type, pk: int) -> Any:
    session = world["session"]
    session.expire_all()
    return session.get(model, pk)


def fake_history(mocker: MockerFixture) -> None:
    """Every entity has three versions: created, retitled, a chart added."""

    def list_versions(
        model_cls: type, entity_uuid: UUID, *, entity: Any = None
    ) -> list[dict[str, Any]]:
        changes = [
            [],
            [
                {
                    "kind": "field",
                    "operation": "edit",
                    "path": ["dashboard_title"],
                    "from_value": "Ventas",
                    "to_value": "Ventas Q4",
                }
            ],
            [
                {
                    "kind": "chart",
                    "operation": "add",
                    "path": ["slices", "kpi"],
                    "from_value": None,
                    "to_value": "kpi",
                }
            ],
        ]
        return [
            {
                "version_uuid": derive_version_uuid(entity_uuid, tx),
                "version_number": number,
                "transaction_id": tx,
                "operation_type": "baseline" if number == 0 else "update",
                "issued_at": datetime(2026, 11, 5, 10, number),
                "changed_by": {"id": 1, "first_name": "Dani", "last_name": "T"},
                "changes": changes[number],
            }
            for number, tx in enumerate((10, 11, 12))
        ]

    mocker.patch(
        "superset.daos.version.VersionDAO.list_versions", side_effect=list_versions
    )


def fake_restore(mocker: MockerFixture, change: Any = None) -> Any:
    """The restore engine applies ``change`` to the entity, as a version would."""

    def restore(model_cls: type, uuid: UUID, tx: int, *, entity: Any) -> Any:
        if change is not None:
            change(entity)
        return RestoreResult(entity=entity, skipped_slice_ids=[])

    mocker.patch("superset.commands.version_restore.capture_enabled", return_value=True)
    mocker.patch(
        "superset.commands.version_restore.resolve_version", return_value=(1, 11)
    )
    return mocker.patch(
        "superset.commands.version_restore.restore_version", side_effect=restore
    )


def trash(world: dict[str, Any], *entities: Any) -> None:
    for entity in entities:
        entity.deleted_at = datetime(2026, 11, 5, 9, 0)
    world["session"].commit()


def other_workspace_dataset(world: dict[str, Any]) -> SqlaTable:
    """A dataset of Finanzas, which the Ventas dashboard can't use."""
    session = world["session"]
    dataset = SqlaTable(table_name="gastos", database=world["ventas"].database)
    session.add(dataset)
    session.flush()
    finanzas = session.get(Workspace, world["finanzas_ws"].id)
    finanzas.datasets.append(WorkspaceDataset(dataset_id=dataset.id))
    session.commit()
    return dataset


# list_trash


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Ana", "Ada", "Root"])
async def test_workspace_trash_for_contributors_and_admins(
    world: dict[str, Any], name: str
) -> None:
    trash(world, world["dashboard"])
    as_user(world, name)
    result = await call("list_trash", {"workspace_id": world["ventas_ws"].id})

    assert result.get("error") is None, result
    assert [(i["entity_type"], i["id"]) for i in result["items"]] == [
        ("dashboard", world["dashboard"].id)
    ]
    item = result["items"][0]
    assert item["name"] == "Ventas"
    assert item["restore_tool"] == "restore_dashboard"
    assert item["blocked_by"] is None


@pytest.mark.asyncio
async def test_a_viewer_has_no_workspace_trash(world: dict[str, Any]) -> None:
    trash(world, world["dashboard"])
    as_user(world, "Vera")
    result = await call("list_trash", {"workspace_id": world["ventas_ws"].id})

    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert result["items"] == []


@pytest.mark.asyncio
async def test_another_workspace_does_not_see_the_trash(
    world: dict[str, Any],
) -> None:
    trash(world, world["dashboard"])
    as_user(world, "Carlos")
    result = await call("list_trash", {"workspace_id": world["ventas_ws"].id})

    assert result["error_type"] == "NotFound"
    assert result["items"] == []


@pytest.mark.asyncio
async def test_the_trash_says_which_charts_block_a_restore(
    world: dict[str, Any],
) -> None:
    trash(world, world["dashboard"])
    session = world["session"]
    # While Ventas is deleted, its chart joins the shared dashboard
    shared = session.get(Dashboard, world["shared_dashboard"].id)
    shared.slices = [*shared.slices, session.get(Slice, world["chart"].id)]
    session.commit()

    as_user(world, "Ana")
    result = await call("list_trash", {"workspace_id": world["ventas_ws"].id})

    assert '"kpi" is now in "Compartido"' in result["items"][0]["blocked_by"]


@pytest.mark.asyncio
async def test_the_whole_trash_of_an_admin(world: dict[str, Any]) -> None:
    trash(world, world["shared_dashboard"], world["shared_chart"])
    as_user(world, "Root")
    result = await call("list_trash", {})

    assert result.get("error") is None, result
    assert sorted((i["entity_type"], i["name"]) for i in result["items"]) == [
        ("chart", "kpi compartido"),
        ("dashboard", "Compartido"),
    ]
    restore_tools = {i["entity_type"]: i["restore_tool"] for i in result["items"]}
    assert restore_tools == {"chart": "restore_chart", "dashboard": "restore_dashboard"}


@pytest.mark.asyncio
async def test_the_whole_trash_of_others_holds_what_they_edit(
    world: dict[str, Any],
) -> None:
    trash(world, world["dashboard"], world["shared_dashboard"])

    as_user(world, "Dani")
    result = await call("list_trash", {"entity_types": ["dashboard"]})
    assert [i["name"] for i in result["items"]] == ["Ventas"]

    # A workspace role never makes anyone an editor: Ana uses the workspace trash
    as_user(world, "Ana")
    result = await call("list_trash", {})
    assert result["items"] == []


@pytest.mark.asyncio
async def test_the_trash_leaves_deleted_rows_hidden_afterwards(
    world: dict[str, Any],
) -> None:
    trash(world, world["shared_dashboard"])
    as_user(world, "Root")
    await call("list_trash", {})

    session = world["session"]
    session.expire_all()
    titles = [d.dashboard_title for d in session.query(Dashboard).all()]
    assert "Compartido" not in titles


# list_versions and get_version_diff


@pytest.mark.asyncio
@pytest.mark.parametrize("name", READERS)
async def test_editors_and_workspace_members_read_the_history(
    world: dict[str, Any], mocker: MockerFixture, name: str
) -> None:
    fake_history(mocker)
    as_user(world, name)
    result = await call(
        "list_versions",
        {"entity_type": "dashboard", "identifier": world["dashboard"].id},
    )

    assert result.get("error") is None, result
    assert result["total_count"] == 3
    assert result["current_version_number"] == 2
    assert [v["version_number"] for v in result["versions"]] == [2, 1, 0]
    assert result["versions"][0]["change_kinds"] == ["chart"]
    assert result["versions"][0]["changed_by"]["name"] == "Dani T"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("name", "error_type"), [("Vera", "Forbidden"), ("Carlos", "Forbidden")]
)
async def test_viewers_and_others_do_not_read_the_history(
    world: dict[str, Any], mocker: MockerFixture, name: str, error_type: str
) -> None:
    fake_history(mocker)
    as_user(world, name)
    for tool, extra in (
        ("list_versions", {}),
        ("get_version_diff", {"version_number": 1}),
    ):
        result = await call(
            tool,
            {"entity_type": "dashboard", "identifier": world["dashboard"].id, **extra},
        )
        assert result["error_type"] == error_type, (tool, result)
        assert result["permission_denied"] is True


@pytest.mark.asyncio
@pytest.mark.parametrize("name", READERS)
async def test_the_history_of_a_chart_follows_its_dashboard(
    world: dict[str, Any], mocker: MockerFixture, name: str
) -> None:
    fake_history(mocker)
    as_user(world, name)
    result = await call(
        "list_versions",
        {"entity_type": "chart", "identifier": str(world["chart"].uuid)},
    )

    assert result.get("error") is None, result
    assert result["entity_id"] == world["chart"].id


@pytest.mark.asyncio
async def test_a_contributor_does_not_read_the_history_of_a_dataset(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    """Editing a dataset keeps its normal permissions, as in the web."""
    fake_history(mocker)
    request = {"entity_type": "dataset", "identifier": world["ventas"].id}

    as_user(world, "Ana")
    assert (await call("list_versions", request))["error_type"] == "Forbidden"
    as_user(world, "Root")
    assert (await call("list_versions", request)).get("error") is None


@pytest.mark.asyncio
async def test_the_diff_of_a_version(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    fake_history(mocker)
    as_user(world, "Ana")
    request = {"entity_type": "dashboard", "identifier": world["dashboard"].id}
    result = await call("get_version_diff", {**request, "version_number": 1})

    assert result.get("error") is None, result
    assert result["version"]["version_number"] == 1
    assert result["changes"] == [
        {
            "kind": "field",
            "operation": "edit",
            "path": ["dashboard_title"],
            "from_value": "Ventas",
            "to_value": "Ventas Q4",
        }
    ]

    by_uuid = await call(
        "get_version_diff",
        {**request, "version_uuid": result["version"]["version_uuid"]},
    )
    assert by_uuid["changes"] == result["changes"]

    missing = await call("get_version_diff", {**request, "version_number": 7})
    assert missing["error_type"] == "NotFound"
    neither = await call("get_version_diff", request)
    assert neither["error_type"] == "InvalidRequest"


@pytest.mark.asyncio
async def test_an_unknown_entity_has_no_history(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    fake_history(mocker)
    as_user(world, "Root")
    result = await call("list_versions", {"entity_type": "chart", "identifier": 9999})

    assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_the_history_needs_the_route_permission_of_its_kind(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    """One tool serves three kinds; each needs the permission of its REST route."""
    from superset import security_manager

    fake_history(mocker)
    mocker.patch.dict(current_app.config, {"MCP_RBAC_ENABLED": True})
    mocker.patch.object(
        security_manager, "can_access", side_effect=lambda _perm, view: view != "Chart"
    )
    as_user(world, "Root")

    chart = await call(
        "list_versions", {"entity_type": "chart", "identifier": world["chart"].id}
    )
    assert chart["error_type"] == "Forbidden"
    dashboard = await call(
        "list_versions",
        {"entity_type": "dashboard", "identifier": world["dashboard"].id},
    )
    assert dashboard.get("error") is None, dashboard


# restore_version


@pytest.mark.asyncio
@pytest.mark.parametrize("name", READERS)
async def test_editors_and_workspace_members_restore_a_version(
    world: dict[str, Any], mocker: MockerFixture, name: str
) -> None:
    fake_history(mocker)
    engine = fake_restore(
        mocker, lambda dashboard: setattr(dashboard, "dashboard_title", "Ventas Q4")
    )
    as_user(world, name)
    result = await call(
        "restore_version",
        {
            "entity_type": "dashboard",
            "identifier": world["dashboard"].id,
            "version_number": 1,
        },
    )

    assert result.get("error") is None, result
    assert result["success"] is True
    assert result["restored_version_number"] == 1
    assert fresh(world, Dashboard, world["dashboard"].id).dashboard_title == (
        "Ventas Q4"
    )
    assert engine.call_args.args[2] == 11
    # A workspace role never makes anyone an editor
    editors = fresh(world, Dashboard, world["dashboard"].id).editors
    assert [s.user_id for s in editors] == [world["users"]["Dani"].id]


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Vera", "Carlos"])
async def test_viewers_and_others_do_not_restore(
    world: dict[str, Any], mocker: MockerFixture, name: str
) -> None:
    fake_history(mocker)
    engine = fake_restore(
        mocker, lambda dashboard: setattr(dashboard, "dashboard_title", "Ventas Q4")
    )
    as_user(world, name)
    result = await call(
        "restore_version",
        {
            "entity_type": "dashboard",
            "identifier": world["dashboard"].id,
            "version_number": 1,
        },
    )

    assert result["permission_denied"] is True
    assert result["success"] is False
    engine.assert_not_called()
    assert fresh(world, Dashboard, world["dashboard"].id).dashboard_title == "Ventas"


@pytest.mark.asyncio
async def test_a_chart_version_with_a_dataset_of_another_workspace(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    gastos = other_workspace_dataset(world)
    fake_history(mocker)
    fake_restore(mocker, lambda chart: setattr(chart, "datasource_id", gastos.id))
    as_user(world, "Ana")
    result = await call(
        "restore_version",
        {"entity_type": "chart", "identifier": world["chart"].id, "version_number": 1},
    )

    assert result["error_type"] == "Conflict", result
    assert "belongs to another workspace" in result["error"]
    assert fresh(world, Slice, world["chart"].id).datasource_id == world["ventas"].id


@pytest.mark.asyncio
async def test_a_dashboard_version_bringing_a_chart_of_another_workspace(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    session = world["session"]
    gastos = other_workspace_dataset(world)
    loose = Slice(
        slice_name="gastos",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=gastos.id,
    )
    session.add(loose)
    session.commit()
    loose_id = loose.id

    def bring_back(dashboard: Any) -> None:
        dashboard.slices = [*dashboard.slices, session.get(Slice, loose_id)]

    fake_history(mocker)
    fake_restore(mocker, bring_back)
    as_user(world, "Ana")
    result = await call(
        "restore_version",
        {
            "entity_type": "dashboard",
            "identifier": world["dashboard"].id,
            "version_number": 1,
        },
    )

    assert result["error_type"] == "Conflict", result
    assert "gastos" in result["error"]
    slices = fresh(world, Dashboard, world["dashboard"].id).slices
    assert [s.id for s in slices] == [world["chart"].id]


@pytest.mark.asyncio
async def test_a_dashboard_version_bringing_a_chart_now_elsewhere(
    world: dict[str, Any], mocker: MockerFixture
) -> None:
    session = world["session"]
    shared_chart_id = world["shared_chart"].id

    def bring_back(dashboard: Any) -> None:
        dashboard.slices = [*dashboard.slices, session.get(Slice, shared_chart_id)]

    fake_history(mocker)
    fake_restore(mocker, bring_back)
    as_user(world, "Root")
    result = await call(
        "restore_version",
        {
            "entity_type": "dashboard",
            "identifier": world["dashboard"].id,
            "version_number": 1,
        },
    )

    assert result["error_type"] == "Conflict", result
    assert "belong to another dashboard" in result["error"]
    slices = fresh(world, Dashboard, world["dashboard"].id).slices
    assert [s.id for s in slices] == [world["chart"].id]
