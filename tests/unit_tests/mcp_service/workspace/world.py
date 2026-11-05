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
A small AuraData BI world for MCP permission tests, on a real in-memory database.

"Ventas" holds the dataset "ventas" and the published dashboard "Ventas", whose
chart uses it. Ana contributes there, Ada administers it and Vera views it.
Carlos contributes to "Finanzas", Dani belongs to no workspace and Root is a
Superset admin. "Compartido" is a dashboard of no workspace over the shared
dataset "compartido".
"""

from typing import Any

from fastmcp import Client
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.auradata.models import (
    ROLE_ADMIN,
    ROLE_CONTRIBUTOR,
    ROLE_VIEWER,
    Workspace,
    WorkspaceDashboard,
    WorkspaceDataset,
    WorkspaceMember,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json

PEOPLE = ("Ana", "Ada", "Vera", "Carlos", "Dani", "Root")


def build_world(
    session: Session, mocker: MockerFixture, data_access: bool = True
) -> dict[str, Any]:
    """
    Build the world. With ``data_access``, every user reads every dataset
    through their Superset roles; without it nobody has data permissions, so
    only the workspace grant gives access.
    """
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    users = {
        name: security_manager.user_model(
            first_name=name,
            last_name="T",
            username=name.lower(),
            email=f"{name.lower()}@x",
            active=True,
        )
        for name in PEOPLE
    }
    database = Database(database_name="almacen", sqlalchemy_uri="sqlite://")
    ventas = SqlaTable(table_name="ventas", database=database)
    compartido = SqlaTable(table_name="compartido", database=database)
    session.add_all([*users.values(), database, ventas, compartido])
    session.flush()

    chart = Slice(
        slice_name="kpi",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=ventas.id,
    )
    shared_chart = Slice(
        slice_name="kpi compartido",
        viz_type="big_number_total",
        datasource_type="table",
        datasource_id=compartido.id,
    )
    dashboard = Dashboard(dashboard_title="Ventas", slices=[chart], published=True)
    shared_dashboard = Dashboard(
        dashboard_title="Compartido", slices=[shared_chart], published=True
    )
    session.add_all([chart, shared_chart, dashboard, shared_dashboard])
    session.flush()

    ventas_ws = Workspace(name="Ventas")
    ventas_ws.dashboards.append(WorkspaceDashboard(dashboard_id=dashboard.id))
    ventas_ws.datasets.append(WorkspaceDataset(dataset_id=ventas.id))
    for name, role in (
        ("Ana", ROLE_CONTRIBUTOR),
        ("Ada", ROLE_ADMIN),
        ("Vera", ROLE_VIEWER),
    ):
        ventas_ws.members.append(WorkspaceMember(user_id=users[name].id, role=role))
    finanzas_ws = Workspace(name="Finanzas")
    finanzas_ws.members.append(
        WorkspaceMember(user_id=users["Carlos"].id, role=ROLE_CONTRIBUTOR)
    )
    session.add_all([ventas_ws, finanzas_ws])
    session.commit()

    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch.object(security_manager, "can_access", return_value=data_access)
    mocker.patch.object(security_manager, "can_access_schema", return_value=data_access)
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=data_access
    )
    mocker.patch.object(
        security_manager, "can_access_database", return_value=data_access
    )
    mocker.patch.object(security_manager, "user_view_menu_names", return_value=set())
    mocker.patch.object(security_manager, "get_accessible_databases", return_value=[])
    return {
        "users": users,
        "ventas": ventas,
        "compartido": compartido,
        "chart": chart,
        "shared_chart": shared_chart,
        "dashboard": dashboard,
        "shared_dashboard": shared_dashboard,
        "ventas_ws": ventas_ws,
        "finanzas_ws": finanzas_ws,
        "mocker": mocker,
        "session": session,
    }


def as_user(world: dict[str, Any], name: str) -> None:
    """Make the MCP calls run as this user; Root is a Superset admin."""
    mocker = world["mocker"]
    mocker.patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=world["users"][name],
    )
    mocker.patch.object(security_manager, "is_admin", return_value=name == "Root")


async def call(tool: str, request: dict[str, Any]) -> dict[str, Any]:
    """Call a tool through the MCP server and return its JSON result."""
    from superset.mcp_service.app import mcp

    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
    return json.loads(result.content[0].text)
