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
"""Settings of the assistant: defaults, what the admin stores and its validation."""

from collections.abc import Iterator
from typing import Any

import pytest
from flask import current_app, Flask
from flask_babel import Babel

from superset.auradata.assistant import settings as settings_module
from superset.auradata.assistant.models import (
    Catalog,
    CatalogModel,
    MODEL_TABLE,
    SOURCE_TABLE,
)
from superset.auradata.assistant.settings import (
    AssistantSettings,
    AssistantSettingsError,
    get_assistant_settings,
    has_api_key,
    offered_models,
    save_assistant_settings,
)
from superset.key_value.types import SharedKey


def catalog(*ids: str) -> Catalog:
    return Catalog(
        models=tuple(
            CatalogModel(id=model_id, spec=MODEL_TABLE[model_id], known=True)
            for model_id in ids
        ),
        source=SOURCE_TABLE,
    )


@pytest.fixture
def store(mocker: Any) -> Iterator[dict[SharedKey, Any]]:
    """The key-value store, in memory."""
    values: dict[SharedKey, Any] = {}
    mocker.patch.object(settings_module, "get_shared_value", side_effect=values.get)
    mocker.patch.object(
        settings_module, "upsert_shared_value", side_effect=values.__setitem__
    )
    app = Flask(__name__)
    Babel(app)
    app.config.update(
        ANTHROPIC_API_KEY=None,
        AURADATA_ASSISTANT_ENABLED=False,
        AURADATA_ASSISTANT_DEFAULT_MODEL="claude-sonnet-5-5",
        AURADATA_ASSISTANT_ALLOWED_MODELS=None,
        AURADATA_ASSISTANT_MONTHLY_BUDGET_USD=None,
        AURADATA_ASSISTANT_EDIT_ENABLED=True,
        AURADATA_ASSISTANT_EFFORT=None,
        AURADATA_ASSISTANT_THINKING=True,
    )
    with app.app_context():
        yield values


def test_without_a_stored_choice_the_configuration_decides(
    store: dict[str, Any],
) -> None:
    assert get_assistant_settings() == AssistantSettings(
        enabled=False,
        default_model="claude-sonnet-5-5",
        allowed_models=None,
        monthly_budget_usd=None,
    )


def test_what_the_admin_stored_wins_over_the_configuration(
    store: dict[str, Any],
) -> None:
    store[SharedKey.AURADATA_ASSISTANT_SETTINGS] = {
        "enabled": True,
        "allowed_models": ["claude-haiku-5-5", "claude-sonnet-5-5"],
    }

    settings = get_assistant_settings()

    assert settings.enabled is True
    assert settings.allowed_models == ("claude-haiku-5-5", "claude-sonnet-5-5")
    assert settings.default_model == "claude-sonnet-5-5"


def test_saving_writes_the_shared_key_and_reads_back(store: dict[str, Any]) -> None:
    saved = save_assistant_settings(
        {
            "enabled": True,
            "allowed_models": ["claude-haiku-5-5", "claude-sonnet-5-5"],
            "default_model": "claude-haiku-5-5",
            "monthly_budget_usd": 25.5,
        },
        catalog("claude-haiku-5-5", "claude-sonnet-5-5"),
    )

    assert saved == get_assistant_settings()
    assert saved.default_model == "claude-haiku-5-5"
    assert saved.monthly_budget_usd == 25.5
    assert store[SharedKey.AURADATA_ASSISTANT_SETTINGS]["enabled"] is True


def test_the_default_model_must_be_allowed(store: dict[str, Any]) -> None:
    with pytest.raises(AssistantSettingsError) as raised:
        save_assistant_settings(
            {
                "allowed_models": ["claude-haiku-5-5"],
                "default_model": "claude-sonnet-5-5",
            },
            catalog("claude-haiku-5-5", "claude-sonnet-5-5"),
        )

    assert list(raised.value.messages) == ["default_model"]
    assert SharedKey.AURADATA_ASSISTANT_SETTINGS not in store


def test_without_a_list_the_default_must_be_a_current_model(
    store: dict[str, Any],
) -> None:
    with pytest.raises(AssistantSettingsError) as raised:
        save_assistant_settings(
            {"default_model": "claude-opus-4-8"},
            catalog("claude-sonnet-5-5", "claude-opus-4-8"),
        )

    assert list(raised.value.messages) == ["default_model"]


def test_an_empty_allowed_list_is_refused(store: dict[str, Any]) -> None:
    with pytest.raises(AssistantSettingsError) as raised:
        save_assistant_settings(
            {"allowed_models": []},
            catalog("claude-sonnet-5-5"),
        )

    assert list(raised.value.messages) == ["allowed_models"]


def test_unknown_models_are_refused(store: dict[str, Any]) -> None:
    with pytest.raises(AssistantSettingsError) as raised:
        save_assistant_settings(
            {"allowed_models": ["claude-sonnet-5-5", "gpt-5"]},
            catalog("claude-sonnet-5-5"),
        )

    assert "gpt-5" in raised.value.messages["allowed_models"][0]


def test_models_stored_earlier_survive_a_shorter_catalog(store: dict[str, Any]) -> None:
    store[SharedKey.AURADATA_ASSISTANT_SETTINGS] = {
        "allowed_models": ["claude-sonnet-5-5", "claude-new-live-model"],
        "default_model": "claude-new-live-model",
    }

    saved = save_assistant_settings({"enabled": True}, catalog("claude-sonnet-5-5"))

    assert saved.default_model == "claude-new-live-model"
    assert saved.enabled is True


def test_by_default_only_current_models_are_offered(store: dict[str, Any]) -> None:
    models = offered_models(
        get_assistant_settings(),
        catalog("claude-sonnet-5-5", "claude-opus-4-8", "claude-opus-5-5"),
    )

    assert [model.id for model in models] == ["claude-sonnet-5-5", "claude-opus-5-5"]


def test_an_allowed_list_narrows_the_offer_to_what_the_catalog_has(
    store: dict[str, Any],
) -> None:
    settings = AssistantSettings(
        enabled=True,
        default_model="claude-opus-4-8",
        allowed_models=("claude-opus-4-8", "claude-retired"),
        monthly_budget_usd=None,
    )

    models = offered_models(
        settings,
        catalog("claude-sonnet-5-5", "claude-opus-4-8"),
    )

    assert [model.id for model in models] == ["claude-opus-4-8"]


def test_has_api_key_only_says_whether_there_is_one(store: dict[str, Any]) -> None:
    assert has_api_key() is False

    current_app.config["ANTHROPIC_API_KEY"] = "test-key"  # noqa: S105

    assert has_api_key() is True
