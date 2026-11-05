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
Administration of the AI assistant: the API and the page that uses it.

Both are for admins only. They ride on the ``Dashboard`` read permission, which every
admin holds and which needs no permission sync, and ``security_manager.is_admin()``
is the check that decides: a non admin gets a 403 whatever else their role grants.
The key of Anthropic is never part of a response: only ``has_api_key`` is.
"""

from __future__ import annotations

from typing import Any

from flask import abort, request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe
from flask_appbuilder.security.decorators import has_access, permission_name
from marshmallow import fields, Schema, validate, ValidationError

from superset import security_manager
from superset.auradata.assistant.models import Catalog, CatalogModel, get_catalog
from superset.auradata.assistant.settings import (
    AssistantSettings,
    AssistantSettingsError,
    get_assistant_settings,
    has_api_key,
    offered_models,
    save_assistant_settings,
)
from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, statsd_metrics


class AssistantSettingsSchema(Schema):
    """What the admin can change. Keys left out keep their value."""

    enabled = fields.Boolean()
    default_model = fields.String(validate=validate.Length(min=1, max=128))
    allowed_models = fields.List(
        fields.String(validate=validate.Length(min=1, max=128)),
        allow_none=True,
    )
    monthly_budget_usd = fields.Float(
        allow_none=True,
        allow_nan=False,
        validate=validate.Range(min=0),
    )


def _model_json(model: CatalogModel, offered: set[str]) -> dict[str, Any]:
    spec = model.spec
    return {
        "id": model.id,
        "display_name": model.display_name,
        "family": spec.family,
        "status": spec.status,
        "known": model.known,
        "offered": model.id in offered,
        "input_price": spec.price.input,
        "output_price": spec.price.output,
        "max_input_tokens": model.max_input_tokens,
    }


def _settings_json(settings: AssistantSettings, catalog: Catalog) -> dict[str, Any]:
    """The whole page: settings, models to choose from and the state of the list."""
    offered = {model.id for model in offered_models(settings, catalog)}
    return {
        "enabled": settings.enabled,
        "default_model": settings.default_model,
        "allowed_models": (
            None if settings.allowed_models is None else list(settings.allowed_models)
        ),
        "monthly_budget_usd": settings.monthly_budget_usd,
        "has_api_key": has_api_key(),
        "models": [_model_json(model, offered) for model in catalog.models],
        "models_source": catalog.source,
        "models_problem": catalog.problem,
        "models_fetched_at": (
            catalog.fetched_at.isoformat() if catalog.fetched_at else None
        ),
    }


class AssistantAdminRestApi(BaseSupersetApi):
    """Settings of the assistant, for administrators."""

    resource_name = "auradata_assistant"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {"get_settings": "read", "put_settings": "read"}
    openapi_spec_tag = "AuraData BI"

    @expose("/settings/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_settings(self) -> Response:
        """The settings of the assistant and the models to choose from.
        ---
        get:
          summary: Settings of the AI assistant and the model catalog
          parameters:
          - in: query
            name: refresh
            description: Ask Anthropic for the list again
            schema:
              type: boolean
          responses:
            200:
              description: Settings, models and where the list came from
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        if not security_manager.is_admin():
            return self.response_403()
        refresh = request.args.get("refresh", "").lower() in ("1", "true")
        catalog = get_catalog(refresh=refresh)
        return self.response(
            200,
            result=_settings_json(get_assistant_settings(), catalog),
        )

    @expose("/settings/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put_settings(self) -> Response:
        """Change the settings of the assistant.
        ---
        put:
          summary: Change the settings of the AI assistant
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: The settings in force
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            422:
              $ref: '#/components/responses/422'
        """
        if not security_manager.is_admin():
            return self.response_403()
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            values = AssistantSettingsSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        catalog = get_catalog()
        try:
            settings = save_assistant_settings(values, catalog)
        except AssistantSettingsError as ex:
            return self.response_422(message=ex.messages)
        return self.response(200, result=_settings_json(settings, catalog))


class AssistantSettingsView(BaseSupersetView):
    """The page «AI assistant» of Administration."""

    route_base = "/assistant"
    class_permission_name = "Dashboard"

    @expose("/settings/")
    @has_access
    @permission_name("read")
    def settings(self) -> FlaskResponse:
        if not security_manager.is_admin():
            abort(403)
        return super().render_app_template()
