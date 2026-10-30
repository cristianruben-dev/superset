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
"""Tests for superset/mibi/workspaces.py."""

from io import BytesIO
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.exceptions import SupersetSecurityException
from superset.mibi.models import Workspace, WorkspaceDashboard
from superset.mibi.workspaces import sniff_image_type
from superset.models.dashboard import Dashboard

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


@pytest.fixture
def workspaces(
    mocker: MockerFixture, session: Session, full_api_access: None
) -> list[Dashboard]:
    """Workspace tables, two dashboards, and an admin that sees everything."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    dashboards = [Dashboard(dashboard_title="A"), Dashboard(dashboard_title="B")]
    session.add_all(dashboards)
    session.flush()
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_ids",
        side_effect=lambda ids, **kwargs: [d for d in dashboards if d.id in ids],
    )
    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id",
        side_effect=lambda pk, **kwargs: next(
            (d for d in dashboards if d.id == pk), None
        ),
    )
    return dashboards


def test_create_and_list(client: Any, workspaces: list[Dashboard]) -> None:
    response = client.post(
        "/api/v1/workspace/",
        json={"name": "Ventas", "description": "Equipo comercial", "color": "#5B5BD6"},
    )

    assert response.status_code == 201
    created = response.json["result"]
    assert created["name"] == "Ventas"
    assert created["dashboard_count"] == 0
    assert created["image_url"] is None
    assert created["can_edit"] is True

    listed = client.get("/api/v1/workspace/").json["result"]
    assert [ws["name"] for ws in listed] == ["Ventas"]


@pytest.mark.parametrize(
    "payload",
    [{}, {"name": ""}, {"name": "x" * 251}, {"name": "x", "color": "red"}],
)
def test_create_validates(
    client: Any, workspaces: list[Dashboard], payload: dict[str, Any]
) -> None:
    assert client.post("/api/v1/workspace/", json=payload).status_code == 400


def test_update_and_delete(
    client: Any, workspaces: list[Dashboard], session: Session
) -> None:
    pk = client.post("/api/v1/workspace/", json={"name": "Ventas"}).json["result"]["id"]

    response = client.put(f"/api/v1/workspace/{pk}/", json={"description": "Nueva"})
    assert response.status_code == 200
    assert response.json["result"]["description"] == "Nueva"
    assert response.json["result"]["name"] == "Ventas"

    assert client.delete(f"/api/v1/workspace/{pk}/").status_code == 200
    assert session.query(Workspace).count() == 0
    assert client.get(f"/api/v1/workspace/{pk}/").status_code == 404


def test_dashboards_move_between_workspaces(
    client: Any, workspaces: list[Dashboard], session: Session
) -> None:
    first = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]
    second = client.post("/api/v1/workspace/", json={"name": "Dos"}).json["result"]
    a, b = (d.id for d in workspaces)

    response = client.put(
        f"/api/v1/workspace/{first['id']}/dashboards/", json={"add": [a, b]}
    )
    assert response.json["result"]["dashboard_ids"] == [a, b]

    # A dashboard lives in one workspace: adding it to another one moves it
    response = client.put(
        f"/api/v1/workspace/{second['id']}/dashboards/", json={"add": [b]}
    )
    assert response.json["result"]["dashboard_ids"] == [b]
    assert client.get(f"/api/v1/workspace/{first['id']}/").json["result"][
        "dashboard_ids"
    ] == [a]
    assert session.query(WorkspaceDashboard).count() == 2

    response = client.put(
        f"/api/v1/workspace/{first['id']}/dashboards/", json={"remove": [a]}
    )
    assert response.json["result"]["dashboard_ids"] == []

    of_dashboard = client.get(f"/api/v1/workspace/of_dashboard/{b}/").json
    assert of_dashboard["result"]["name"] == "Dos"
    assert client.get(f"/api/v1/workspace/of_dashboard/{a}/").json["result"] is None


def test_moving_a_dashboard_needs_ownership(
    mocker: MockerFixture, client: Any, workspaces: list[Dashboard]
) -> None:
    pk = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]["id"]
    mocker.patch.object(
        security_manager,
        "raise_for_ownership",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )

    response = client.put(
        f"/api/v1/workspace/{pk}/dashboards/", json={"add": [workspaces[0].id]}
    )

    assert response.status_code == 403


def test_unknown_dashboards_are_rejected(
    client: Any, workspaces: list[Dashboard]
) -> None:
    pk = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]["id"]

    response = client.put(f"/api/v1/workspace/{pk}/dashboards/", json={"add": [404]})

    assert response.status_code == 404


def test_image_upload_and_download(client: Any, workspaces: list[Dashboard]) -> None:
    pk = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]["id"]

    response = client.put(
        f"/api/v1/workspace/{pk}/image/",
        data={"image": (BytesIO(PNG), "logo.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    url = response.json["result"]["image_url"]
    assert url.startswith(f"/api/v1/workspace/{pk}/image/?v=")

    image = client.get(url)
    assert image.status_code == 200
    assert image.mimetype == "image/png"
    assert image.data == PNG
    assert image.headers["X-Content-Type-Options"] == "nosniff"

    response = client.delete(f"/api/v1/workspace/{pk}/image/")
    assert response.json["result"]["image_url"] is None
    assert client.get(f"/api/v1/workspace/{pk}/image/").status_code == 404


@pytest.mark.parametrize(
    "data",
    [b"<svg onload='alert(1)'></svg>", b"plain text", PNG + b"\x00" * (2 << 20)],
)
def test_image_upload_rejects_other_files(
    client: Any, workspaces: list[Dashboard], data: bytes
) -> None:
    pk = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]["id"]

    response = client.put(
        f"/api/v1/workspace/{pk}/image/",
        data={"image": (BytesIO(data), "file")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (PNG, "image/png"),
        (b"\xff\xd8\xff\xe0rest", "image/jpeg"),
        (b"GIF89a...", "image/gif"),
        (b"RIFF\x00\x00\x00\x00WEBPVP8 ", "image/webp"),
        (b"<svg/>", None),
    ],
)
def test_sniff_image_type(data: bytes, expected: str | None) -> None:
    assert sniff_image_type(data) == expected


def test_workspace_dashboards(
    mocker: MockerFixture, client: Any, workspaces: list[Dashboard]
) -> None:
    mocker.patch.object(security_manager, "is_owner", return_value=True)
    pk = client.post("/api/v1/workspace/", json={"name": "Uno"}).json["result"]["id"]
    a, b = workspaces
    client.put(f"/api/v1/workspace/{pk}/dashboards/", json={"add": [a.id]})

    response = client.get(f"/api/v1/workspace/{pk}/dashboards/")

    assert response.status_code == 200
    assert [d["id"] for d in response.json["result"]] == [a.id]
    assert response.json["result"][0]["dashboard_title"] == "A"
    assert response.json["result"][0]["url"] == a.url
    assert client.get("/api/v1/workspace/404/dashboards/").status_code == 404


# --------------------------------------------------------------------- members


@pytest.fixture
def people(session: Session, workspaces: list[Dashboard]) -> dict[str, Any]:
    """Three users; the API acts as whoever ``as_user`` picks (admin by default)."""
    user_model = security_manager.user_model
    users = {
        name: user_model(
            first_name=name.title(),
            last_name="Test",
            username=name,
            email=f"{name}@example.com",
            active=True,
        )
        for name in ("ana", "bea", "carlos")
    }
    session.add_all(users.values())
    session.flush()
    return users


def as_user(mocker: MockerFixture, user: Any | None) -> None:
    """Act as a regular user (not a Superset admin), or as an admin with None."""
    mocker.patch.object(security_manager, "is_admin", return_value=user is None)
    user_id = user.id if user else None
    mocker.patch("superset.mibi.workspaces.get_user_id", return_value=user_id)
    mocker.patch("superset.mibi.workspace_access.get_user_id", return_value=user_id)


def create_as(mocker: MockerFixture, client: Any, user: Any, name: str) -> int:
    as_user(mocker, user)
    return client.post("/api/v1/workspace/", json={"name": name}).json["result"]["id"]


def test_creator_administers_the_workspace(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    pk = create_as(mocker, client, people["ana"], "Ventas")

    result = client.get(f"/api/v1/workspace/{pk}/").json["result"]

    assert result["role"] == "admin"
    assert result["can_edit"] is True
    assert result["can_contribute"] is True
    assert result["member_count"] == 1
    members = client.get(f"/api/v1/workspace/{pk}/members/").json["result"]
    assert [(m["id"], m["role"]) for m in members] == [(people["ana"].id, "admin")]


def test_workspaces_are_private_to_their_members(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    pk = create_as(mocker, client, people["ana"], "Ventas")
    create_as(mocker, client, people["bea"], "Finanzas")

    as_user(mocker, people["ana"])
    assert [w["name"] for w in client.get("/api/v1/workspace/").json["result"]] == [
        "Ventas"
    ]

    as_user(mocker, people["bea"])
    assert client.get(f"/api/v1/workspace/{pk}/").status_code == 404
    assert client.get(f"/api/v1/workspace/{pk}/dashboards/").status_code == 404
    assert client.get(f"/api/v1/workspace/{pk}/members/").status_code == 404

    # Superset admins see every workspace
    as_user(mocker, None)
    assert len(client.get("/api/v1/workspace/").json["result"]) == 2


def test_roles_decide_what_members_can_do(
    mocker: MockerFixture,
    client: Any,
    people: dict[str, Any],
    workspaces: list[Dashboard],
) -> None:
    ana, bea, carlos = people["ana"], people["bea"], people["carlos"]
    pk = create_as(mocker, client, ana, "Ventas")
    client.put(
        f"/api/v1/workspace/{pk}/members/", json={"user_id": bea.id, "role": "viewer"}
    )
    client.put(
        f"/api/v1/workspace/{pk}/members/",
        json={"user_id": carlos.id, "role": "contributor"},
    )
    mocker.patch.object(security_manager, "raise_for_ownership")
    dashboard = workspaces[0].id

    as_user(mocker, bea)
    viewer = client.get(f"/api/v1/workspace/{pk}/").json["result"]
    assert (viewer["role"], viewer["can_contribute"]) == ("viewer", False)
    move = {"add": [dashboard]}
    assert (
        client.put(f"/api/v1/workspace/{pk}/dashboards/", json=move).status_code == 403
    )
    assert client.put(f"/api/v1/workspace/{pk}/", json={"name": "X"}).status_code == 403

    as_user(mocker, carlos)
    assert (
        client.put(f"/api/v1/workspace/{pk}/dashboards/", json=move).status_code == 200
    )
    assert client.put(f"/api/v1/workspace/{pk}/", json={"name": "X"}).status_code == 403
    member = {"user_id": bea.id, "role": "admin"}
    assert (
        client.put(f"/api/v1/workspace/{pk}/members/", json=member).status_code == 403
    )

    as_user(mocker, ana)
    assert client.put(f"/api/v1/workspace/{pk}/", json={"name": "X"}).status_code == 200


def test_member_roles_are_validated(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    pk = create_as(mocker, client, people["ana"], "Ventas")
    url = f"/api/v1/workspace/{pk}/members/"

    assert (
        client.put(url, json={"user_id": people["bea"].id, "role": "owner"}).status_code
        == 400
    )
    assert client.put(url, json={"user_id": 9999, "role": "viewer"}).status_code == 404


def test_a_workspace_keeps_one_admin(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    ana, bea = people["ana"], people["bea"]
    pk = create_as(mocker, client, ana, "Ventas")
    url = f"/api/v1/workspace/{pk}/members/"

    assert (
        client.put(url, json={"user_id": ana.id, "role": "viewer"}).status_code == 400
    )
    assert client.delete(f"{url}{ana.id}/").status_code == 400

    client.put(url, json={"user_id": bea.id, "role": "admin"})
    assert (
        client.put(url, json={"user_id": ana.id, "role": "viewer"}).status_code == 200
    )


def test_members_can_leave(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    ana, bea = people["ana"], people["bea"]
    pk = create_as(mocker, client, ana, "Ventas")
    client.put(
        f"/api/v1/workspace/{pk}/members/", json={"user_id": bea.id, "role": "viewer"}
    )

    as_user(mocker, bea)
    assert client.delete(f"/api/v1/workspace/{pk}/members/{ana.id}/").status_code == 403
    response = client.delete(f"/api/v1/workspace/{pk}/members/{bea.id}/")

    assert response.status_code == 200
    assert response.json["result"] is None
    assert client.get(f"/api/v1/workspace/{pk}/").status_code == 404


def test_member_candidates(
    mocker: MockerFixture, client: Any, people: dict[str, Any]
) -> None:
    pk = create_as(mocker, client, people["ana"], "Ventas")

    names = [
        u["username"]
        for u in client.get(f"/api/v1/workspace/{pk}/member_candidates/?q=a").json[
            "result"
        ]
    ]

    assert "ana" not in names
    assert {"bea", "carlos"} <= set(names)
    only = client.get(f"/api/v1/workspace/{pk}/member_candidates/?q=carl").json
    assert [u["username"] for u in only["result"]] == ["carlos"]


def test_of_dashboard_hides_foreign_workspaces(
    mocker: MockerFixture,
    client: Any,
    people: dict[str, Any],
    workspaces: list[Dashboard],
) -> None:
    pk = create_as(mocker, client, people["ana"], "Ventas")
    mocker.patch.object(security_manager, "raise_for_ownership")
    dashboard = workspaces[0].id
    client.put(f"/api/v1/workspace/{pk}/dashboards/", json={"add": [dashboard]})

    assert (
        client.get(f"/api/v1/workspace/of_dashboard/{dashboard}/").json["result"][
            "role"
        ]
        == "admin"
    )
    as_user(mocker, people["bea"])
    assert (
        client.get(f"/api/v1/workspace/of_dashboard/{dashboard}/").json["result"]
        is None
    )
