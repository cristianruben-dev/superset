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
"""The admin API of the assistant: who gets in and what it answers."""

from collections.abc import Iterator
from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.auradata.assistant import api as api_module, settings as settings_module
from superset.auradata.assistant.models import (
    Catalog,
    CatalogModel,
    MODEL_TABLE,
    PROBLEM_NO_API_KEY,
    PRUDENT_SPEC,
    SOURCE_TABLE,
)
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import SharedKey

SETTINGS_URL = "/api/v1/auradata_assistant/settings/"
SECRET = "test-key-that-must-not-leak"  # noqa: S105


@pytest.fixture
def catalog(mocker: MockerFixture) -> Catalog:
    current = Catalog(
        models=(
            CatalogModel(
                "claude-haiku-5-5", MODEL_TABLE["claude-haiku-5-5"], known=True
            ),
            CatalogModel(
                "claude-sonnet-5-5", MODEL_TABLE["claude-sonnet-5-5"], known=True
            ),
            CatalogModel("claude-new", PRUDENT_SPEC, known=False),
        ),
        source=SOURCE_TABLE,
        problem=PROBLEM_NO_API_KEY,
    )
    mocker.patch.object(api_module, "get_catalog", return_value=current)
    return current


@pytest.fixture
def admin(mocker: MockerFixture) -> None:
    mocker.patch.object(api_module.security_manager, "is_admin", return_value=True)


@pytest.fixture
def not_admin(mocker: MockerFixture) -> None:
    mocker.patch.object(api_module.security_manager, "is_admin", return_value=False)


@pytest.fixture
def store(mocker: MockerFixture) -> Iterator[dict[SharedKey, Any]]:
    values: dict[SharedKey, Any] = {}
    mocker.patch.object(settings_module, "get_shared_value", side_effect=values.get)
    mocker.patch.object(
        settings_module, "upsert_shared_value", side_effect=values.__setitem__
    )
    yield values


def test_a_non_admin_cannot_read_the_settings(
    client: Any, full_api_access: None, not_admin: None, catalog: Catalog
) -> None:
    assert client.get(SETTINGS_URL).status_code == 403


def test_a_non_admin_cannot_change_the_settings(
    client: Any,
    full_api_access: None,
    not_admin: None,
    catalog: Catalog,
    store: dict,
) -> None:
    response = client.put(SETTINGS_URL, json={"enabled": True})

    assert response.status_code == 403
    assert store == {}


def test_a_non_admin_cannot_open_the_page(
    client: Any, full_api_access: None, not_admin: None
) -> None:
    assert client.get("/assistant/settings/").status_code == 403


def test_the_admin_reads_settings_and_models_but_never_the_key(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    store: dict,
    mocker: MockerFixture,
) -> None:
    mocker.patch.dict(current_app.config, {"ANTHROPIC_API_KEY": SECRET})

    response = client.get(SETTINGS_URL)

    assert response.status_code == 200
    assert SECRET not in response.text
    result = response.json["result"]
    assert result["enabled"] is False
    assert result["default_model"] == "claude-sonnet-5-5"
    assert result["allowed_models"] is None
    assert result["monthly_budget_usd"] is None
    assert result["has_api_key"] is True
    assert result["models_source"] == SOURCE_TABLE
    assert result["models_problem"] == PROBLEM_NO_API_KEY
    assert [
        (model["id"], model["known"], model["offered"]) for model in result["models"]
    ] == [
        ("claude-haiku-5-5", True, True),
        ("claude-sonnet-5-5", True, True),
        ("claude-new", False, False),
    ]
    assert result["models"][1]["input_price"] == 2.00


def test_refresh_asks_for_the_list_again(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    store: dict,
) -> None:
    client.get(f"{SETTINGS_URL}?refresh=true")

    api_module.get_catalog.assert_called_once_with(refresh=True)


def test_the_admin_saves_models_and_default(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    store: dict,
) -> None:
    response = client.put(
        SETTINGS_URL,
        json={
            "enabled": True,
            "allowed_models": ["claude-haiku-5-5", "claude-sonnet-5-5"],
            "default_model": "claude-sonnet-5-5",
            "monthly_budget_usd": 50,
        },
    )

    assert response.status_code == 200
    result = response.json["result"]
    assert result["enabled"] is True
    assert result["monthly_budget_usd"] == 50
    assert store[SharedKey.AURADATA_ASSISTANT_SETTINGS]["default_model"] == (
        "claude-sonnet-5-5"
    )
    assert client.get(SETTINGS_URL).json["result"]["allowed_models"] == [
        "claude-haiku-5-5",
        "claude-sonnet-5-5",
    ]


def test_a_default_outside_the_allowed_models_is_refused(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    store: dict,
) -> None:
    response = client.put(
        SETTINGS_URL,
        json={
            "allowed_models": ["claude-haiku-5-5"],
            "default_model": "claude-sonnet-5-5",
        },
    )

    assert response.status_code == 422
    assert "default_model" in response.json["message"]
    assert store == {}


@pytest.mark.parametrize(
    "payload",
    [
        {"monthly_budget_usd": -1},
        {"enabled": "maybe"},
        {"default_model": ""},
        {"unexpected": True},
    ],
)
def test_malformed_settings_are_refused(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    store: dict,
    payload: dict[str, Any],
) -> None:
    response = client.put(SETTINGS_URL, json=payload)

    assert response.status_code == 400
    assert store == {}


def test_settings_survive_in_the_key_value_store(
    client: Any,
    full_api_access: None,
    admin: None,
    catalog: Catalog,
    session: Session,
) -> None:
    """The store takes the new key as it is: no table and no migration."""
    KeyValueEntry.metadata.create_all(session.get_bind())

    first = client.put(SETTINGS_URL, json={"monthly_budget_usd": 10})
    second = client.put(SETTINGS_URL, json={"enabled": True})

    assert first.status_code == second.status_code == 200
    result = client.get(SETTINGS_URL).json["result"]
    assert result["monthly_budget_usd"] == 10
    assert result["enabled"] is True
    assert session.query(KeyValueEntry).count() == 1
