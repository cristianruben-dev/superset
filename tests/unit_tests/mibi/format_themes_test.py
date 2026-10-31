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
"""Tests for superset/mibi/format_themes.py."""

from typing import Any

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.exceptions import SupersetSecurityException
from superset.mibi.format_themes import apply_theme, clean_theme
from superset.mibi.models import FormatTheme
from superset.models.dashboard import Dashboard
from superset.utils import json

THEME = {
    "canvas": {"background": {"type": "color", "color": "#101820"}, "gap": 24},
    "visuals": {"radius": 4, "title": {"size": 18, "subtitle": "Solo de uno"}},
    "colorScheme": "mibiNeon",
}

LAYOUT = {
    "DASHBOARD_VERSION_KEY": "v2",
    "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
    "GRID_ID": {"type": "GRID", "id": "GRID_ID", "children": ["CHART-1"]},
    "CHART-1": {
        "type": "CHART",
        "id": "CHART-1",
        "children": [],
        "meta": {
            "chartId": 1,
            "mibiFormat": {"background": "#fff", "title": {"subtitle": "Mes"}},
        },
    },
    "CHART-2": {
        "type": "CHART",
        "id": "CHART-2",
        "children": [],
        "meta": {"chartId": 2, "mibiFormat": {"radius": 30}},
    },
}


@pytest.fixture
def dashboards(
    mocker: MockerFixture, session: Session, full_api_access: None
) -> list[Dashboard]:
    """The Mi BI tables, two dashboards and an admin."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    items = [
        Dashboard(dashboard_title="Ventas", position_json=json.dumps(LAYOUT)),
        Dashboard(dashboard_title="Vacío"),
    ]
    session.add_all(items)
    session.flush()
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    mocker.patch.object(security_manager, "raise_for_access")
    mocker.patch.object(security_manager, "raise_for_ownership")
    return items


def test_clean_theme_drops_pictures_subtitles_and_unknown_parts() -> None:
    theme = clean_theme(
        {
            **THEME,
            "canvas": {
                "background": {"type": "image", "image": "/x.png", "fit": "cover"},
                "visuals": {"radius": 1},
            },
            "extra": True,
        }
    )
    assert set(theme) == {"canvas", "visuals", "colorScheme"}
    assert theme["canvas"] == {"background": {"type": "none"}}
    assert theme["visuals"] == {"radius": 4, "title": {"size": 18}}


@pytest.mark.parametrize(
    "value",
    [
        "texto",
        {"canvas": "rojo"},
        {"colorScheme": 3},
        {"visuals": {"title": "x" * 30_000}},
    ],
)
def test_clean_theme_rejects_what_is_not_a_theme(value: Any) -> None:
    with pytest.raises(ValidationError):
        clean_theme(value)


def test_apply_theme_sets_canvas_palette_and_resets_charts() -> None:
    dashboard = Dashboard(
        position_json=json.dumps(LAYOUT),
        json_metadata=json.dumps(
            {"color_scheme": "old", "map_label_colors": {"a": "#000"}}
        ),
    )
    apply_theme(dashboard, clean_theme(THEME))

    layout = json.loads(dashboard.position_json)
    canvas = layout["ROOT_ID"]["meta"]["mibiCanvas"]
    assert canvas["gap"] == 24
    assert canvas["visuals"] == {"radius": 4, "title": {"size": 18}}
    # Charts keep their subtitle, and nothing else of their own style
    assert layout["CHART-1"]["meta"]["mibiFormat"] == {"title": {"subtitle": "Mes"}}
    assert "mibiFormat" not in layout["CHART-2"]["meta"]
    metadata = json.loads(dashboard.json_metadata)
    assert metadata["color_scheme"] == "mibiNeon"
    assert "map_label_colors" not in metadata


def test_apply_theme_keeps_charts_and_background_when_asked() -> None:
    layout = json.loads(json.dumps(LAYOUT))
    layout["ROOT_ID"]["meta"] = {
        "mibiCanvas": {"background": {"type": "image", "image": "/bg.png"}}
    }
    dashboard = Dashboard(position_json=json.dumps(layout))
    apply_theme(dashboard, {"visuals": {"radius": 2}}, reset_visuals=False)

    result = json.loads(dashboard.position_json)
    assert result["ROOT_ID"]["meta"]["mibiCanvas"] == {
        "background": {"type": "image", "image": "/bg.png"},
        "visuals": {"radius": 2},
    }
    assert result["CHART-2"]["meta"]["mibiFormat"] == {"radius": 30}
    assert dashboard.json_metadata is None


def test_apply_theme_to_a_dashboard_without_layout() -> None:
    dashboard = Dashboard(position_json="not json")
    apply_theme(dashboard, {"canvas": {"padding": 8}})
    layout = json.loads(dashboard.position_json)
    assert layout["ROOT_ID"]["children"] == ["GRID_ID"]
    assert layout["GRID_ID"]["parents"] == ["ROOT_ID"]
    assert layout["ROOT_ID"]["meta"]["mibiCanvas"] == {"padding": 8}


def test_save_list_rename_and_delete(client: Any, dashboards: list[Dashboard]) -> None:
    response = client.post(
        "/api/v1/format_theme/", json={"name": "  Oscuro  ", "theme": THEME}
    )
    assert response.status_code == 201
    pk = response.json["result"]["id"]
    assert response.json["result"]["name"] == "Oscuro"
    assert "subtitle" not in response.json["result"]["theme"]["visuals"]["title"]

    listed = client.get("/api/v1/format_theme/").json["result"]
    assert [(item["name"], item["can_edit"]) for item in listed] == [("Oscuro", True)]

    response = client.put(f"/api/v1/format_theme/{pk}/", json={"name": "Noche"})
    assert response.json["result"]["name"] == "Noche"
    assert response.json["result"]["theme"]["colorScheme"] == "mibiNeon"

    assert client.delete(f"/api/v1/format_theme/{pk}/").status_code == 200
    assert client.get("/api/v1/format_theme/").json["result"] == []
    assert client.delete(f"/api/v1/format_theme/{pk}/").status_code == 404


@pytest.mark.parametrize(
    "body",
    [{"name": "", "theme": THEME}, {"name": "A"}, {"name": "A", "theme": []}],
)
def test_save_validates(client: Any, dashboards: list[Dashboard], body: Any) -> None:
    assert client.post("/api/v1/format_theme/", json=body).status_code == 400


def test_only_its_author_or_an_admin_changes_a_theme(
    mocker: MockerFixture, client: Any, dashboards: list[Dashboard], session: Session
) -> None:
    theme = FormatTheme(name="Ajeno", theme="{}", created_by_fk=99)
    session.add(theme)
    session.flush()
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    mocker.patch("superset.mibi.format_themes.get_user_id", return_value=5)

    assert client.get("/api/v1/format_theme/").json["result"][0]["can_edit"] is False
    response = client.put(f"/api/v1/format_theme/{theme.id}/", json={"name": "Mío"})
    assert response.status_code == 403
    assert client.delete(f"/api/v1/format_theme/{theme.id}/").status_code == 403


def test_apply_skips_dashboards_the_user_cannot_edit(
    mocker: MockerFixture, client: Any, dashboards: list[Dashboard]
) -> None:
    pk = client.post(
        "/api/v1/format_theme/", json={"name": "Oscuro", "theme": THEME}
    ).json["result"]["id"]
    ventas, vacio = dashboards

    def ownership(dashboard: Dashboard) -> None:
        if dashboard.id == vacio.id:
            raise SupersetSecurityException(mocker.MagicMock())

    mocker.patch.object(security_manager, "raise_for_ownership", side_effect=ownership)
    response = client.post(
        f"/api/v1/format_theme/{pk}/apply/",
        json={"dashboard_ids": [ventas.id, vacio.id, 999]},
    )
    assert response.status_code == 200
    assert response.json["result"] == [ventas.id]
    layout = json.loads(ventas.position_json)
    assert layout["ROOT_ID"]["meta"]["mibiCanvas"]["gap"] == 24
    assert vacio.position_json is None

    assert client.post(f"/api/v1/format_theme/{pk}/apply/", json={}).status_code == 400
    assert (
        client.post(
            "/api/v1/format_theme/999/apply/", json={"dashboard_ids": [ventas.id]}
        ).status_code
        == 404
    )


def test_a_workspace_keeps_its_theme(
    client: Any, dashboards: list[Dashboard], mocker: MockerFixture
) -> None:
    mocker.patch("superset.daos.dashboard.DashboardDAO.find_by_ids", return_value=[])
    pk = client.post(
        "/api/v1/format_theme/", json={"name": "Oscuro", "theme": THEME}
    ).json["result"]["id"]
    response = client.post(
        "/api/v1/workspace/", json={"name": "Ventas", "format_theme_id": pk}
    )
    assert response.status_code == 201
    workspace = response.json["result"]
    assert workspace["format_theme_id"] == pk
    assert workspace["format_theme_name"] == "Oscuro"

    unknown = client.put(
        f"/api/v1/workspace/{workspace['id']}/", json={"format_theme_id": 999}
    )
    assert unknown.status_code == 400

    # Deleting the theme leaves the workspace without one
    client.delete(f"/api/v1/format_theme/{pk}/")
    result = client.get(f"/api/v1/workspace/{workspace['id']}/").json["result"]
    assert result["format_theme_id"] is None
