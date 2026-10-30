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


def test_only_creator_or_admin_can_edit(
    mocker: MockerFixture, client: Any, workspaces: list[Dashboard], session: Session
) -> None:
    workspace = Workspace(name="Otro", created_by_fk=999)
    session.add(workspace)
    session.flush()
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch("superset.mibi.workspaces.get_user_id", return_value=1)

    assert (
        client.get(f"/api/v1/workspace/{workspace.id}/").json["result"]["can_edit"]
        is False
    )
    response = client.put(f"/api/v1/workspace/{workspace.id}/", json={"name": "X"})
    assert response.status_code == 403
    assert client.delete(f"/api/v1/workspace/{workspace.id}/").status_code == 403


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
