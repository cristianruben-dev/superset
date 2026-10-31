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
"""Tests for superset/mibi/backgrounds.py."""

from io import BytesIO
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.exceptions import SupersetSecurityException
from superset.mibi.models import DashboardBackground, DashboardImage
from superset.models.dashboard import Dashboard

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16


@pytest.fixture
def dashboard(
    mocker: MockerFixture, session: Session, full_api_access: None
) -> Dashboard:
    """The Mi BI tables and a dashboard the user can see and edit."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    dashboard = Dashboard(dashboard_title="Ventas")
    session.add(dashboard)
    session.flush()
    mocker.patch.object(security_manager, "raise_for_access")
    mocker.patch.object(security_manager, "raise_for_ownership")
    return dashboard


def upload(client: Any, pk: int, data: bytes, name: str = "fondo.png") -> Any:
    return client.put(
        f"/api/v1/dashboard_background/{pk}/",
        data={"image": (BytesIO(data), name)},
        content_type="multipart/form-data",
    )


def test_upload_serve_replace_and_remove(
    client: Any, dashboard: Dashboard, session: Session
) -> None:
    assert (
        client.get(f"/api/v1/dashboard_background/{dashboard.id}/").status_code == 404
    )

    response = upload(client, dashboard.id, PNG)
    assert response.status_code == 200
    url = response.json["result"]["url"]
    assert url.startswith(f"/api/v1/dashboard_background/{dashboard.id}/?v=")

    served = client.get(url)
    assert served.status_code == 200
    assert served.data == PNG
    assert served.mimetype == "image/png"
    assert served.headers["X-Content-Type-Options"] == "nosniff"

    # One picture per dashboard: a new upload replaces it
    assert upload(client, dashboard.id, JPEG, "fondo.jpg").status_code == 200
    assert session.query(DashboardBackground).count() == 1
    assert client.get(url).mimetype == "image/jpeg"

    assert (
        client.delete(f"/api/v1/dashboard_background/{dashboard.id}/").status_code
        == 200
    )
    assert session.query(DashboardBackground).count() == 0
    assert client.get(url).status_code == 404


@pytest.mark.parametrize(
    "data, message",
    [
        (b"<svg onload='alert(1)'></svg>", "Use a PNG, JPEG, GIF or WebP image"),
        (PNG + b"\x00" * (2 * 1024 * 1024), "The image is larger than 2 MB"),
    ],
)
def test_upload_rejects_other_files(
    client: Any, dashboard: Dashboard, data: bytes, message: str
) -> None:
    response = upload(client, dashboard.id, data)
    assert response.status_code == 400
    assert response.json["message"] == message


def test_upload_needs_a_file(client: Any, dashboard: Dashboard) -> None:
    response = client.put(f"/api/v1/dashboard_background/{dashboard.id}/", data={})
    assert response.status_code == 400


def test_only_editors_change_the_picture(
    mocker: MockerFixture, client: Any, dashboard: Dashboard
) -> None:
    assert upload(client, dashboard.id, PNG).status_code == 200
    mocker.patch.object(
        security_manager,
        "raise_for_ownership",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )

    assert upload(client, dashboard.id, PNG).status_code == 403
    assert (
        client.delete(f"/api/v1/dashboard_background/{dashboard.id}/").status_code
        == 403
    )
    # Viewers still see it
    assert (
        client.get(f"/api/v1/dashboard_background/{dashboard.id}/").status_code == 200
    )


def test_hidden_dashboards_do_not_exist(
    mocker: MockerFixture, client: Any, dashboard: Dashboard
) -> None:
    assert upload(client, dashboard.id, PNG).status_code == 200
    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )

    assert (
        client.get(f"/api/v1/dashboard_background/{dashboard.id}/").status_code == 404
    )
    assert upload(client, dashboard.id, PNG).status_code == 404
    assert client.get("/api/v1/dashboard_background/999/").status_code == 404


def upload_image(client: Any, pk: int, data: bytes = PNG) -> Any:
    return client.post(
        f"/api/v1/dashboard_image/{pk}/",
        data={"image": (BytesIO(data), "foto.png")},
        content_type="multipart/form-data",
    )


def test_image_elements_upload_serve_and_remove(
    client: Any, dashboard: Dashboard, session: Session
) -> None:
    first = upload_image(client, dashboard.id)
    second = upload_image(client, dashboard.id, JPEG)
    assert first.status_code == 201
    assert second.status_code == 201
    url = first.json["result"]["url"]
    assert (
        url == f"/api/v1/dashboard_image/{dashboard.id}/{first.json['result']['id']}/"
    )

    served = client.get(url)
    assert served.status_code == 200
    assert served.data == PNG
    assert served.headers["X-Content-Type-Options"] == "nosniff"
    assert client.get(second.json["result"]["url"]).mimetype == "image/jpeg"

    assert client.delete(url).status_code == 200
    assert client.get(url).status_code == 404
    assert client.delete(url).status_code == 404
    assert session.query(DashboardImage).count() == 1


def test_image_elements_belong_to_their_dashboard(
    client: Any, dashboard: Dashboard, session: Session
) -> None:
    other = Dashboard(dashboard_title="Otro")
    session.add(other)
    session.flush()
    image_id = upload_image(client, dashboard.id).json["result"]["id"]

    assert (
        client.get(f"/api/v1/dashboard_image/{other.id}/{image_id}/").status_code == 404
    )
    assert (
        client.delete(f"/api/v1/dashboard_image/{other.id}/{image_id}/").status_code
        == 404
    )


def test_image_elements_check_access(
    mocker: MockerFixture, client: Any, dashboard: Dashboard
) -> None:
    assert upload_image(client, dashboard.id, b"GIF? no").status_code == 400
    url = upload_image(client, dashboard.id).json["result"]["url"]
    mocker.patch.object(
        security_manager,
        "raise_for_ownership",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )
    assert upload_image(client, dashboard.id).status_code == 403
    assert client.delete(url).status_code == 403
    assert client.get(url).status_code == 200

    mocker.patch.object(
        security_manager,
        "raise_for_access",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )
    assert client.get(url).status_code == 404
