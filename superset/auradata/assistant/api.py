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
The API of the AI assistant and the administration page.

Administration is for admins only. It rides on the ``Dashboard`` read permission, which
every admin holds and which needs no permission sync, and
``security_manager.is_admin()`` is the check that decides: a non admin gets a 403
whatever else their role grants. The key of Anthropic is never part of a response:
only ``has_api_key`` is.

The chat rides on the same permission, held by anyone who can open a dashboard, and
takes only a browser session: it spends the server's key, and an API key must not reach
it. The user comes from that session and from nowhere in the request.

A decision on a pending call names only the call: what runs is what the conversation
stored, and it is checked again for the person deciding, at that moment. The context of
a message is read by the model as data, and ``dashboard_id`` is the only part of it that
the server acts on.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any
from uuid import UUID

from flask import abort, current_app, g, request, Response, stream_with_context
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe
from flask_appbuilder.security.decorators import has_access, permission_name
from flask_babel import gettext as _
from marshmallow import fields, Schema, validate, ValidationError

from superset import security_manager
from superset.auradata.assistant.agent import (
    build_client,
    KEEP_ALIVE,
    resume_after_decisions,
    run_conversation,
)
from superset.auradata.assistant.conversations import (
    context_tokens_of,
    conversation_json,
    conversation_messages,
    ConversationBusyError,
    ConversationLog,
    create_conversation,
    find_conversation,
    history_of,
    list_conversations,
    not_run_results,
    pending_json,
    pending_turn,
    rejected_calls,
    uses_tool_search,
)
from superset.auradata.assistant.figures import figures_in
from superset.auradata.assistant.models import (
    Catalog,
    CatalogModel,
    get_catalog,
    relative_price,
)
from superset.auradata.assistant.prompt import context_block, system_prompt
from superset.auradata.assistant.settings import (
    AssistantSettings,
    AssistantSettingsError,
    get_assistant_settings,
    has_api_key,
    offered_models,
    save_assistant_settings,
)
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ, MODES, ToolBox
from superset.auradata.assistant.undo import (
    can_undo,
    report_versions,
    undo_last_turn,
    UndoConflictError,
    UndoError,
    UNDONE_NOTE,
)
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,
    DashboardNotFoundError,
)
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

MAX_MESSAGE_CHARS = 20_000
MAX_CONTEXT_CHARS = 8_000


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


class AssistantObjectSchema(Schema):
    """An object of the page the user has selected, as the editor describes it."""

    id = fields.String(required=True, validate=validate.Length(max=250))
    type = fields.String(validate=validate.Length(max=64))
    chart_id = fields.Integer()
    name = fields.String(validate=validate.Length(max=250))
    format = fields.Dict()


class AssistantContextSchema(Schema):
    """
    Where the user is. All of it reaches the AI, as data. It comes from the browser, so
    it never decides what a tool may do: only ``dashboard_id`` is read here, to check
    the person can open that dashboard.
    """

    dashboard_id = fields.Integer(required=True)
    page = fields.String(validate=validate.Length(max=250))
    page_id = fields.String(validate=validate.Length(max=250))
    selection = fields.List(fields.Nested(AssistantObjectSchema))
    filters = fields.Dict()


class AssistantChatSchema(Schema):
    """A message for the assistant."""

    message = fields.String(
        required=True, validate=validate.Length(min=1, max=MAX_MESSAGE_CHARS)
    )
    conversation_id = fields.UUID(load_default=None)
    model = fields.String(load_default=None, validate=validate.Length(max=128))
    mode = fields.String(load_default=MODE_READ, validate=validate.OneOf(MODES))
    context = fields.Nested(AssistantContextSchema, required=True)


class AssistantDecisionSchema(Schema):
    """
    A person's answer to one pending call. It names the call and nothing about what
    the call does: that stays as the conversation stored it.
    """

    tool_use_id = fields.String(required=True, validate=validate.Length(min=1, max=128))
    approved = fields.Boolean(required=True)
    model = fields.String(load_default=None, validate=validate.Length(max=128))


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _keep_alive() -> str:
    """A comment of the SSE format: proxies count it, and readers skip it."""
    return ": keep-alive\n\n"


def _open_dashboard(dashboard_id: int | None) -> Dashboard | None:
    """The dashboard if this user can open it. None hides whether it exists."""
    if dashboard_id is None:
        return None
    try:
        return DashboardDAO.get_by_id_or_slug(dashboard_id)
    except (
        DashboardNotFoundError,
        DashboardAccessDeniedError,
        SupersetSecurityException,
    ):
        return None


def _session_user_only() -> bool:
    """A real user in a browser session, not a key, a guest or an anonymous visitor."""
    return (
        get_user_id() is not None
        and not security_manager.is_guest_user()
        and security_manager.extract_api_key_from_request() is None
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


def _offered_model_json(model: CatalogModel, default_model: str) -> dict[str, Any]:
    """A model as a user chooses it: what it is called and how it compares."""
    return {
        "id": model.id,
        "name": model.display_name,
        "family": model.spec.family,
        "price": relative_price(model.spec.price),
        "default": model.id == default_model,
        "tool_search": model.spec.tool_search,
        "max_input_tokens": model.max_input_tokens,
    }


def _is_available(settings: AssistantSettings) -> bool:
    return bool(
        current_app.config["AURADATA_ASSISTANT_ENABLED"]
        and settings.enabled
        and has_api_key()
    )


def _event_stream(events: Iterator[str]) -> Response:
    return Response(
        stream_with_context(events),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _no_tool_search_for(model: CatalogModel, history: list[dict[str, Any]]) -> bool:
    """A model without tool search cannot read a history of tools found by it."""
    return not model.spec.tool_search and uses_tool_search(history)


def _turn_stream(
    conversation: Any,
    log: ConversationLog,
    dashboard_id: int,
    mode: str,
    turn: Iterator[tuple[str, dict[str, Any]]],
) -> Iterator[str]:
    """
    The events of a turn, as server-sent events. In edit mode a turn that changed
    something records where it ended, even when the browser left first, so it can be
    undone, and ``done`` says so.
    """
    changed = False

    def end_turn() -> None:
        nonlocal changed
        versions = report_versions(dashboard_id) if changed else None
        changed = False
        if versions is not None:
            log.add_turn_end(versions)

    try:
        for event, payload in turn:
            if event == KEEP_ALIVE:
                yield _keep_alive()
                continue
            changed = changed or (event == "tool_end" and payload.get("changed", False))
            if event == "done":
                end_turn()
                payload = {
                    **payload,
                    "can_undo": mode == MODE_EDIT and can_undo(conversation),
                }
            yield _sse(event, payload)
    except ConversationBusyError:
        yield _sse(
            "error",
            {
                "code": "busy",
                "message": _("This conversation is answering another message."),
            },
        )
    except Exception:  # pylint: disable=broad-except
        # The stream is open: a status code can no longer say this
        logger.exception("The assistant failed in the middle of a stream")
        yield _sse(
            "error",
            {
                "code": "failed",
                "message": _(
                    "The AI service failed. Start a new conversation if this repeats."
                ),
            },
        )
    finally:
        end_turn()


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


class AssistantRestApi(BaseSupersetApi):
    """Talk to the assistant, as the user of the session."""

    resource_name = "auradata_assistant_chat"
    route_base = "/api/v1/auradata/assistant"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "chat": "read",
        "models": "read",
        "conversations": "read",
        "conversation": "read",
        "decide": "read",
        "undo": "read",
    }
    openapi_spec_tag = "AuraData BI"

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def chat(self) -> Response:  # noqa: C901
        """Send a message and stream the answer.
        ---
        post:
          summary: Send a message to the AI assistant
          description: >-
            Answers with server-sent events: conversation, model_changed, text,
            tool_start, tool_end, confirm, refusal, error and done. Comment lines only
            keep the connection open. A confirm event means a call waits for a
            decision: send it to the decide endpoint of the conversation.
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: The stream of the answer
              content:
                text/event-stream:
                  schema:
                    type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: Another request is writing to this conversation
            422:
              $ref: '#/components/responses/422'
            503:
              description: The assistant cannot run on this server
        """
        if not _session_user_only():
            return self.response_403()
        settings = get_assistant_settings()
        if (refused := self._refused_by_settings(settings)) is not None:
            return refused
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            data = AssistantChatSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        question = data["message"].strip()
        if not question:
            return self.response_400(message="The message is empty")
        context = data["context"]
        if len(json.dumps(context)) > MAX_CONTEXT_CHARS:
            return self.response_400(message="The context is too long")

        model = self._offered_model(settings, data["model"] or settings.default_model)
        if model is None:
            return self.response_422(message=_("This model is not available."))

        dashboard = _open_dashboard(context["dashboard_id"])
        if dashboard is None:
            return self.response_404()
        user_id = get_user_id()
        conversation = None
        mode = data["mode"]
        if data["conversation_id"] is not None:
            conversation = find_conversation(data["conversation_id"], user_id)
            if conversation is None:
                return self.response_404()
            if conversation.dashboard_id != dashboard.id or conversation.mode != mode:
                return self.response_422(
                    message=_("This conversation belongs to another report or mode.")
                )
        if mode == MODE_EDIT and not security_manager.can_edit_resource(dashboard):
            return self.response_403()
        history = history_of(conversation) if conversation else []
        if _no_tool_search_for(model, history):
            return self.response_422(message=self._tool_search_needed())
        pending = pending_turn(conversation) if conversation else None
        if pending is not None and not pending.undecided:
            # Every call is decided: its tools are running in another request
            return self._busy()

        prepared = self._prepare(model, mode)
        if prepared is None:
            return self.response(503, message=_("The AI assistant is not installed."))
        client, toolbox, system = prepared

        previous_model = conversation.model if conversation else model.id
        if conversation is None:
            conversation = create_conversation(
                user_id, dashboard.id, mode, model.id, question
            )
        conversation.model = model.id
        dashboard_id = dashboard.id
        log = ConversationLog(conversation, user_id)
        # A person who writes instead of deciding has moved on: those calls never run,
        # and their answers go first, as the API asks of a user turn
        message = [
            *(not_run_results(pending) if pending else []),
            context_block(context),
            {"type": "text", "text": question},
        ]
        try:
            log.add_user_message(
                message,
                report_versions(dashboard_id) if mode == MODE_EDIT else None,
            )
        except ConversationBusyError:
            return self.response(
                409, message=_("This conversation is answering another message.")
            )
        history.append({"role": "user", "content": message})

        def turn() -> Iterator[tuple[str, dict[str, Any]]]:
            yield from run_conversation(client, model, system, toolbox, log, history)

        def events() -> Iterator[str]:
            yield _sse(
                "conversation",
                {"id": str(conversation.id), "mode": mode, "model": model.id},
            )
            if previous_model != model.id:
                # Prompt caches belong to one model: this turn starts them again
                yield _sse("model_changed", {"from": previous_model, "to": model.id})
            yield from _turn_stream(conversation, log, dashboard_id, mode, turn())

        return _event_stream(events())

    def _refused_by_settings(self, settings: AssistantSettings) -> Response | None:
        """Why the assistant cannot answer here, if it cannot."""
        if not (current_app.config["AURADATA_ASSISTANT_ENABLED"] and settings.enabled):
            return self.response(403, message=_("The AI assistant is turned off."))
        if not has_api_key():
            return self.response(503, message=_("The AI assistant has no API key."))
        return None

    @staticmethod
    def _offered_model(
        settings: AssistantSettings, model_id: str
    ) -> CatalogModel | None:
        offered = offered_models(settings, get_catalog())
        return next((item for item in offered if item.id == model_id), None)

    @staticmethod
    def _prepare(model: CatalogModel, mode: str) -> tuple[Any, ToolBox, str] | None:
        """The client, the tools of the person asking and the system prompt."""
        try:
            client = build_client()
            toolbox = ToolBox(g.user.username, mode)
            return (
                client,
                toolbox,
                system_prompt(mode, toolbox.unavailable, model.spec.tool_search),
            )
        except ImportError:
            logger.warning("The assistant needs the anthropic and fastmcp packages")
            return None

    @staticmethod
    def _tool_search_needed() -> str:
        return _("This conversation needs a model that can search for tools.")

    def _busy(self) -> Response:
        return self.response(
            409, message=_("This conversation is answering another message.")
        )

    @expose("/conversations/<uuid:conversation_id>/decide/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def decide(self, conversation_id: UUID) -> Response:  # noqa: C901
        """Approve or reject a call that waits for a decision, and stream what follows.
        ---
        post:
          summary: Decide on a pending call of the AI assistant
          description: >-
            Takes the id of the call and the decision. The tool and its arguments are
            the stored ones. Answers with the events of the chat. Once every pending
            call of the turn is decided, its tools run and the model goes on.
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: The stream of the answer
              content:
                text/event-stream:
                  schema:
                    type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: That call does not wait for a decision
            422:
              $ref: '#/components/responses/422'
            503:
              description: The assistant cannot run on this server
        """
        if not _session_user_only():
            return self.response_403()
        settings = get_assistant_settings()
        if (refused := self._refused_by_settings(settings)) is not None:
            return refused
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            data = AssistantDecisionSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)

        user_id = get_user_id()
        conversation = find_conversation(conversation_id, user_id)
        if conversation is None:
            return self.response_404()
        dashboard = _open_dashboard(conversation.dashboard_id)
        if dashboard is None:
            return self.response_404()
        # Checked again here: rights can change while a card waits
        if conversation.mode != MODE_EDIT or not security_manager.can_edit_resource(
            dashboard
        ):
            return self.response_403()
        tool_use_id = data["tool_use_id"]
        pending = pending_turn(conversation)
        if pending is None or tool_use_id not in pending.undecided:
            return self.response(
                409, message=_("This action is no longer waiting for a decision.")
            )
        model = self._offered_model(settings, data["model"] or conversation.model)
        if model is None:
            return self.response_422(message=_("This model is not available."))
        if _no_tool_search_for(model, history_of(conversation)):
            return self.response_422(message=self._tool_search_needed())
        prepared = self._prepare(model, MODE_EDIT)
        if prepared is None:
            return self.response(503, message=_("The AI assistant is not installed."))
        client, toolbox, system = prepared

        conversation.model = model.id
        dashboard_id = dashboard.id
        log = ConversationLog(conversation, user_id)
        try:
            # Stored before anything runs: of two racing requests one stops here
            log.add_decision(tool_use_id, data["approved"])
        except ConversationBusyError:
            return self._busy()
        decided = pending_turn(conversation)

        def turn() -> Iterator[tuple[str, dict[str, Any]]]:
            if decided.undecided:
                # The rest of the cards are still up: nothing runs until they answer
                yield (
                    "done",
                    {
                        "stop_reason": "tool_use",
                        "context_tokens": context_tokens_of(conversation),
                    },
                )
                return
            yield from resume_after_decisions(
                client, model, system, toolbox, log, conversation, decided
            )

        return _event_stream(
            _turn_stream(conversation, log, dashboard_id, MODE_EDIT, turn())
        )

    @expose("/conversations/<uuid:conversation_id>/undo/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def undo(self, conversation_id: UUID) -> Response:
        """Go back to before the last turn of the assistant that changed the report.
        ---
        post:
          summary: Undo the last changes of the AI assistant
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: What is left to undo, and what could not be brought back
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: The report changed after that turn, or a call is pending
            422:
              $ref: '#/components/responses/422'
        """
        if not _session_user_only():
            return self.response_403()
        conversation = find_conversation(conversation_id, get_user_id())
        if conversation is None:
            return self.response_404()
        dashboard = _open_dashboard(conversation.dashboard_id)
        if dashboard is None:
            return self.response_404()
        if conversation.mode != MODE_EDIT or not security_manager.can_edit_resource(
            dashboard
        ):
            return self.response_403()
        if pending_turn(conversation) is not None:
            return self.response(
                409, message=_("Answer the pending action before undoing.")
            )
        try:
            skipped = undo_last_turn(
                conversation,
                dashboard.id,
                ConversationLog(conversation, get_user_id()),
                context_block({"note": UNDONE_NOTE}),
            )
        except UndoConflictError as ex:
            return self.response(409, message=str(ex))
        except UndoError as ex:
            return self.response_422(message=str(ex))
        except ConversationBusyError:
            return self._busy()
        return self.response(
            200,
            result={
                "skipped_charts": len(skipped),
                "can_undo": can_undo(conversation),
            },
        )

    @expose("/models/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def models(self) -> Response:
        """Whether the assistant answers here, and the models a user can pick.
        ---
        get:
          summary: Models of the AI assistant a user can pick
          responses:
            200:
              description: Whether it is available, and its models
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        if not _session_user_only():
            return self.response_403()
        settings = get_assistant_settings()
        if not _is_available(settings):
            return self.response(200, result={"available": False, "models": []})
        offered = offered_models(settings, get_catalog())
        return self.response(
            200,
            result={
                "available": bool(offered),
                "models": [
                    _offered_model_json(model, settings.default_model)
                    for model in offered
                ],
            },
        )

    @expose("/conversations/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def conversations(self) -> Response:
        """The user's conversations over a dashboard.
        ---
        get:
          summary: Conversations of the current user over a dashboard
          parameters:
          - in: query
            name: dashboard_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: The conversations, the latest first
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        dashboard_id = request.args.get("dashboard_id", type=int)
        if dashboard_id is None:
            return self.response_400(message="dashboard_id is required")
        if _open_dashboard(dashboard_id) is None:
            return self.response_404()
        return self.response(
            200,
            result=[
                conversation_json(item)
                for item in list_conversations(get_user_id(), dashboard_id)
            ],
        )

    @expose("/conversations/<uuid:conversation_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def conversation(self, conversation_id: UUID) -> Response:
        """One of the user's conversations with its messages.
        ---
        get:
          summary: A conversation of the current user with its messages
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The conversation
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        conversation = find_conversation(conversation_id, get_user_id())
        if conversation is None or _open_dashboard(conversation.dashboard_id) is None:
            return self.response_404()
        messages = conversation_messages(conversation)
        return self.response(
            200,
            result={
                **conversation_json(conversation),
                "messages": messages,
                "figures": figures_in(messages),
                "context_tokens": context_tokens_of(conversation),
                "pending": pending_json(pending_turn(conversation)),
                "rejected": rejected_calls(conversation),
                "can_undo": conversation.mode == MODE_EDIT and can_undo(conversation),
            },
        )


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
