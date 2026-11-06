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
Settings of the assistant: the configuration, overlaid by what the admin chose.

The choices live in the key-value store, under one shared key, so they need no
table of their own. Keys the store does not hold take their configuration value.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from flask import current_app
from flask_babel import gettext as _

from superset.auradata.assistant.models import (
    Catalog,
    CatalogModel,
    STATUS_CURRENT,
)
from superset.key_value.shared_entries import get_shared_value, upsert_shared_value
from superset.key_value.types import SharedKey


@dataclass(frozen=True)
class AssistantSettings:
    """What decides whether the assistant runs and which models it offers."""

    enabled: bool
    default_model: str
    # None offers the current models of each family
    allowed_models: tuple[str, ...] | None
    # None sets no limit
    monthly_budget_usd: float | None
    # The editor's copilot, apart from the read panel
    edit_enabled: bool = True
    # None is the default of each model
    effort: str | None = None
    thinking: bool = True


class AssistantSettingsError(ValueError):
    """Settings that cannot be saved, by the field that holds the mistake."""

    def __init__(self, messages: dict[str, list[str]]) -> None:
        super().__init__(str(messages))
        self.messages = messages


def _config_defaults() -> dict[str, Any]:
    """The static defaults of the configuration."""
    config = current_app.config
    return {
        "enabled": bool(config["AURADATA_ASSISTANT_ENABLED"]),
        "default_model": config["AURADATA_ASSISTANT_DEFAULT_MODEL"],
        "allowed_models": config["AURADATA_ASSISTANT_ALLOWED_MODELS"],
        "monthly_budget_usd": config["AURADATA_ASSISTANT_MONTHLY_BUDGET_USD"],
        "edit_enabled": bool(config["AURADATA_ASSISTANT_EDIT_ENABLED"]),
        "effort": config["AURADATA_ASSISTANT_EFFORT"],
        "thinking": bool(config["AURADATA_ASSISTANT_THINKING"]),
    }


def _settings_from(values: dict[str, Any]) -> AssistantSettings:
    allowed = values["allowed_models"]
    return AssistantSettings(
        enabled=values["enabled"],
        default_model=values["default_model"],
        allowed_models=None if allowed is None else tuple(allowed),
        monthly_budget_usd=values["monthly_budget_usd"],
        edit_enabled=values["edit_enabled"],
        effort=values["effort"],
        thinking=values["thinking"],
    )


def get_assistant_settings() -> AssistantSettings:
    """The settings in force."""
    defaults = _config_defaults()
    stored = get_shared_value(SharedKey.AURADATA_ASSISTANT_SETTINGS) or {}
    return _settings_from(
        {**defaults, **{key: stored[key] for key in defaults if key in stored}}
    )


def has_api_key() -> bool:
    """Whether the server holds a key. The key itself never leaves the server."""
    return bool(current_app.config.get("ANTHROPIC_API_KEY"))


def offered_models(
    settings: AssistantSettings,
    catalog: Catalog,
) -> list[CatalogModel]:
    """The models of the catalog that users may pick."""
    allowed = (
        _current_model_ids(catalog)
        if settings.allowed_models is None
        else set(settings.allowed_models)
    )
    return [model for model in catalog.models if model.id in allowed]


def _current_model_ids(catalog: Catalog) -> set[str]:
    """The models offered when the admin has not narrowed the list."""
    return {model.id for model in catalog.models if model.spec.status == STATUS_CURRENT}


def _validate(
    values: dict[str, Any],
    valid_ids: set[str],
    catalog: Catalog,
) -> None:
    """Refuse settings that would leave the assistant with no model to use."""
    allowed = values["allowed_models"]
    default = values["default_model"]
    offered = _current_model_ids(catalog) if allowed is None else set(allowed)
    errors: dict[str, list[str]] = {}
    if allowed is not None:
        if not allowed:
            errors["allowed_models"] = [_("Choose at least one model.")]
        elif unknown := sorted(set(allowed) - valid_ids):
            errors["allowed_models"] = [
                _("Unknown models: %(models)s", models=", ".join(unknown))
            ]
    if default not in valid_ids:
        errors["default_model"] = [
            _("Unknown model: %(model)s", model=default),
        ]
    elif offered and default not in offered:
        errors["default_model"] = [_("The default model must be an allowed model.")]
    if errors:
        raise AssistantSettingsError(errors)


def save_assistant_settings(
    values: dict[str, Any],
    catalog: Catalog,
) -> AssistantSettings:
    """
    Validate and store what the admin chose.

    Models stored earlier stay valid: while the live list cannot be read the catalog
    only holds the table, and that must not stop an admin from saving.
    """
    current = get_assistant_settings()
    valid_ids = {model.id for model in catalog.models}
    valid_ids.update(current.allowed_models or ())
    valid_ids.add(current.default_model)
    merged = {**asdict(current), **values}
    _validate(merged, valid_ids, catalog)
    upsert_shared_value(SharedKey.AURADATA_ASSISTANT_SETTINGS, merged)
    return _settings_from(merged)
