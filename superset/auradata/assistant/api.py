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

Before a message reaches Anthropic the person must have accepted the privacy notice, the
switches must allow that mode on that report, now, and the month must be under its
limits. A decision goes on with a turn already running, so the limits do not stop it,
and an undo costs nothing, so they do not stop that either; the switches stop both.
Figures in dollars are for admins: a person using the panel only learns the level.

A vote is for an answer of the voter's own conversation, and anything else is a 404.
Votes live beside the conversation, which they never touch, and admins only read their
totals.

A conversation is renamed or deleted by its owner alone: anyone else gets a 404.
Deleting asks for no switch and no report: people can always remove what they said.

An image is uploaded on its own, cleaned there, and a message only names it: see
``attachments.py``. Only its owner reads it, and anyone else gets a 404.

A decision on a pending call names only the call: what runs is what the conversation
stored, and it is checked again for the person deciding, at that moment. The context of
a message is read by the model as data, and ``dashboard_id`` is the only part of it that
the server acts on.

An answer runs in a worker (``turns.py``). Chat and decide check all this, store what
the person said, take the turn of the conversation and read its stream. Anyone who may
read the conversation may read that stream, on each connection, and anyone else gets a
404: the same rules as the conversation, a report they can still open included. A stream
is found through the conversation, so its address names nothing else. Stopping is one
more request, and the owner of a conversation can always stop what it runs.
"""

from __future__ import annotations

import base64
import logging
import time
from collections.abc import Iterator
from datetime import datetime
from typing import Any, cast
from uuid import UUID, uuid4

from flask import abort, request, Response, stream_with_context
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe
from flask_appbuilder.security.decorators import has_access, permission_name
from flask_babel import get_locale, gettext as _
from marshmallow import fields, Schema, validate, ValidationError

from superset import security_manager
from superset.auradata.assistant import sharing
from superset.auradata.assistant.artifacts import (
    artifact_calls,
    artifact_json,
    ArtifactMovedError,
    ArtifactRefusedError,
    blocks_of,
    find_artifact,
    oldest_text,
    restore_version,
    selected_context,
    summaries_of,
    version_of,
)
from superset.auradata.assistant.attachments import (
    attachment_block,
    attachments_in,
    clean_image,
    delete_draft,
    find_attachment,
    has_drafts,
    ImageRefusedError,
    MAX_PER_CONVERSATION,
    MAX_PER_MESSAGE,
    MAX_UPLOAD_BYTES,
    save_draft,
)
from superset.auradata.assistant.conversations import (
    context_tokens_of,
    conversation_json,
    conversation_messages,
    ConversationBusyError,
    ConversationLog,
    create_conversation,
    delete_conversation,
    find_conversation,
    history_of,
    list_conversations,
    lost_turns,
    not_run_results,
    pending_json,
    pending_turn,
    rejected_calls,
    rename_conversation,
    TITLE_LENGTH,
    uses_tool_search,
    workspace_id_of,
)
from superset.auradata.assistant.feedback import (
    answer_of,
    clear_vote,
    feedback_of,
    REASONS,
    save_vote,
    VOTES,
)
from superset.auradata.assistant.figures import figures_in
from superset.auradata.assistant.governance import (
    accept_privacy,
    accepted_privacy,
    budget_of,
    OFF_IN_WORKSPACE,
    save_workspace_settings,
    switched_off,
    workspace_settings,
    WorkspaceAssistantSettings,
)
from superset.auradata.assistant.models import (
    Catalog,
    CatalogModel,
    EFFORTS,
    get_catalog,
    relative_price,
)
from superset.auradata.assistant.prompt import context_block
from superset.auradata.assistant.settings import (
    AssistantSettings,
    AssistantSettingsError,
    get_assistant_settings,
    has_api_key,
    offered_models,
    save_assistant_settings,
)
from superset.auradata.assistant.spending import (
    BudgetState,
    LEVEL_STOPPED,
    month_start,
    parse_month,
    SCOPE_WORKSPACE,
    spent_usd,
    usage_report,
)
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ, MODES
from superset.auradata.assistant.turn_store import (
    forget_streams,
    turn_store,
    TurnStore,
    TurnTicket,
)
from superset.auradata.assistant.turns import (
    answered_at_once,
    KIND_CHAT,
    KIND_DECIDE,
    offered_model,
    open_dashboard,
    relay,
    repair_conversation,
    settle_turn,
    start_turn,
)
from superset.auradata.assistant.undo import (
    can_undo,
    undo_last_turn,
    UndoConflictError,
    UndoError,
    UNDONE_NOTE,
)
from superset.auradata.backgrounds import image_response
from superset.auradata.models import (
    AssistantArtifact,
    AssistantArtifactVersion,
    AssistantConversation,
    AssistantMessage,
    ROLE_ADMIN,
)
from superset.auradata.workspaces import (
    find_workspace,
    WorkspaceForbiddenError,
    WorkspaceNotFoundError,
)
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

MAX_MESSAGE_CHARS = 20_000
MAX_CONTEXT_CHARS = 8_000
# What a form adds around the file it carries
UPLOAD_OVERHEAD_BYTES = 8_192


class AssistantSettingsSchema(Schema):
    """What the admin can change. Keys left out keep their value."""

    enabled = fields.Boolean()
    default_model = fields.String(validate=validate.Length(min=1, max=128))
    allowed_models = fields.List(
        fields.String(validate=validate.Length(min=1, max=128)),
        allow_none=True,
    )
    effort = fields.String(allow_none=True, validate=validate.OneOf(EFFORTS))
    thinking = fields.Boolean()
    monthly_budget_usd = fields.Float(
        allow_none=True,
        allow_nan=False,
        validate=validate.Range(min=0),
    )
    edit_enabled = fields.Boolean()


class WorkspaceAssistantSchema(Schema):
    """What the admins of a workspace can change. Keys left out keep their value."""

    enabled = fields.Boolean()
    edit_enabled = fields.Boolean()
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


class AssistantArtifactRefSchema(Schema):
    """The document open beside the chat, by name: the server reads what it holds."""

    id = fields.String(required=True, validate=validate.Length(max=36))
    block_id = fields.String(load_default=None, validate=validate.Length(max=36))


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
    artifact = fields.Nested(AssistantArtifactRefSchema)


class AssistantChatSchema(Schema):
    """A message for the assistant."""

    message = fields.String(
        load_default="", validate=validate.Length(max=MAX_MESSAGE_CHARS)
    )
    attachments = fields.List(
        fields.UUID(), load_default=list, validate=validate.Length(max=MAX_PER_MESSAGE)
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


class AssistantRenameSchema(Schema):
    """A new title for a conversation."""

    title = fields.String(
        required=True, validate=validate.Length(min=1, max=TITLE_LENGTH)
    )


class AssistantShareSchema(Schema):
    """The version a person read on the card."""

    version = fields.Integer(required=True, validate=validate.Range(min=1))


class AssistantRestoreSchema(Schema):
    """Which version of a document to go back to."""

    version = fields.Integer(required=True, validate=validate.Range(min=1))


class AssistantFeedbackSchema(Schema):
    """A vote on an answer. A reason only stays with a vote against."""

    vote = fields.String(required=True, validate=validate.OneOf(VOTES))
    reason = fields.String(
        load_default=None, allow_none=True, validate=validate.OneOf(REASONS)
    )


def _locale() -> str | None:
    """The language of the request: a worker has no session to read it from."""
    locale = get_locale()
    return str(locale) if locale is not None else None


def _session_user_only() -> bool:
    """A real user in a browser session, not a key, a guest or an anonymous visitor."""
    return (
        get_user_id() is not None
        and not security_manager.is_guest_user()
        and security_manager.extract_api_key_from_request() is None
    )


def _user_id() -> int:
    """The current user of a request that ``_session_user_only`` let through."""
    return cast(int, get_user_id())


def _open_store() -> TurnStore:
    """The turn store of a request that ``_refused_by_settings`` let through."""
    return cast(TurnStore, turn_store())


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
        "edit_enabled": settings.edit_enabled,
        "effort": settings.effort,
        "thinking": settings.thinking,
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


def _budget_json(state: BudgetState) -> dict[str, Any]:
    return {"level": state.level, "scope": state.scope}


def _workspace_json(
    workspace_id: int,
    own: WorkspaceAssistantSettings,
    settings: AssistantSettings,
) -> dict[str, Any]:
    """What the admins of a workspace see: its settings and what it spent."""
    return {
        "enabled": own.enabled,
        "edit_enabled": own.edit_enabled,
        "monthly_budget_usd": own.monthly_budget_usd,
        "spent_usd": float(spent_usd(month_start(datetime.now()), workspace_id)),
        "global_enabled": settings.enabled,
        "global_edit_enabled": settings.edit_enabled,
    }


def _is_available(settings: AssistantSettings) -> bool:
    return settings.enabled and has_api_key()


def _event_stream(events: Iterator[str]) -> Response:
    return Response(
        stream_with_context(events),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _no_tool_search_for(model: CatalogModel, history: list[dict[str, Any]]) -> bool:
    """A model without tool search cannot read a history of tools found by it."""
    return not model.spec.tool_search and uses_tool_search(history)


class AssistantAdminRestApi(BaseSupersetApi):
    """Settings of the assistant, for administrators."""

    resource_name = "auradata_assistant"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get_settings": "read",
        "put_settings": "read",
        "usage": "read",
        "get_workspace": "read",
        "put_workspace": "write",
    }
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

    @expose("/usage/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def usage(self) -> Response:
        """What the assistant spent, by month, model, workspace and user.
        ---
        get:
          summary: Spending of the AI assistant
          parameters:
          - in: query
            name: month
            description: The month to break down, as YYYY-MM. By default, this one
            schema:
              type: string
          responses:
            200:
              description: The month, its breakdowns and the last months
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        if not security_manager.is_admin():
            return self.response_403()
        now = datetime.now()
        try:
            start = (
                parse_month(request.args["month"])
                if "month" in request.args
                else month_start(now)
            )
        except ValueError:
            return self.response_400(message="The month must look like 2026-11")
        return self.response(
            200,
            result={
                **usage_report(start, now),
                "monthly_budget_usd": get_assistant_settings().monthly_budget_usd,
            },
        )

    def _workspace_refusal(self, pk: int) -> Response | None:
        """
        Only the admins of a workspace, and those of the platform, reach its settings.
        Someone outside it does not learn it exists.
        """
        try:
            find_workspace(pk, ROLE_ADMIN)
        except WorkspaceNotFoundError:
            return self.response_404()
        except WorkspaceForbiddenError:
            return self.response_403()
        return None

    @expose("/workspace/<int:pk>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_workspace(self, pk: int) -> Response:
        """The assistant in a workspace: its switches, its limit and its month.
        ---
        get:
          summary: The AI assistant in a workspace
          parameters:
          - in: path
            name: pk
            required: true
            schema:
              type: integer
          responses:
            200:
              description: The settings of the workspace
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if (refused := self._workspace_refusal(pk)) is not None:
            return refused
        return self.response(
            200,
            result=_workspace_json(
                pk, workspace_settings(pk), get_assistant_settings()
            ),
        )

    @expose("/workspace/<int:pk>/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put_workspace(self, pk: int) -> Response:
        """Change the assistant in a workspace.
        ---
        put:
          summary: Change the AI assistant in a workspace
          parameters:
          - in: path
            name: pk
            required: true
            schema:
              type: integer
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
            404:
              $ref: '#/components/responses/404'
        """
        if (refused := self._workspace_refusal(pk)) is not None:
            return refused
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            values = WorkspaceAssistantSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        return self.response(
            200,
            result=_workspace_json(
                pk, save_workspace_settings(pk, values), get_assistant_settings()
            ),
        )


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
        "rename": "read",
        "remove": "read",
        "decide": "read",
        "stream": "read",
        "stop": "read",
        "undo": "read",
        "privacy": "read",
        "feedback": "read",
        "clear_feedback": "read",
        "upload_attachment": "read",
        "attachment": "read",
        "remove_attachment": "read",
        "artifact": "read",
        "artifact_version": "read",
        "restore_artifact": "read",
        "document": "read",
        "documents": "read",
        "share_card": "read",
        "share_artifact": "read",
        "unshare_artifact": "read",
        "export_artifact": "read",
        "exported_artifact": "read",
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
            tool_start, tool_end, confirm, refusal, error, done and turn_end, the last
            one, each with its number as the id of the event. Comment lines only keep
            the connection open. A connection that ends without turn_end goes on at the
            stream endpoint of the conversation. A confirm event means a call waits for
            a decision: send it to the decide endpoint of the conversation.
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
        if (refused := self._refused_by_privacy()) is not None:
            return refused
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            data = AssistantChatSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        question = data["message"].strip()
        attachments = list(dict.fromkeys(data["attachments"]))
        if not question and not attachments:
            return self.response_400(message="The message is empty")
        context = data["context"]
        if len(json.dumps(context)) > MAX_CONTEXT_CHARS:
            return self.response_400(message="The context is too long")

        model = offered_model(settings, data["model"] or settings.default_model)
        if model is None:
            return self.response_422(message=_("This model is not available."))

        dashboard = open_dashboard(context["dashboard_id"])
        if dashboard is None:
            return self.response_404()
        store = _open_store()
        user_id = _user_id()
        conversation = None
        log = None
        mode = data["mode"]
        if data["conversation_id"] is not None:
            conversation = find_conversation(data["conversation_id"], user_id)
            if conversation is None:
                return self.response_404()
            settle_turn(store, conversation.id)
            if store.holder(conversation.id) is not None:
                return self._busy()
            # Before anything is read: what lands after this makes the write collide
            log = ConversationLog(conversation, user_id)
            if conversation.dashboard_id != dashboard.id or conversation.mode != mode:
                return self.response_422(
                    message=_("This conversation belongs to another report or mode.")
                )
        if mode == MODE_EDIT and not security_manager.can_edit_resource(dashboard):
            return self.response_403()
        dashboard_id = dashboard.id
        workspace_id = workspace_id_of(dashboard_id)
        if (refused := self._refused_here(settings, workspace_id, mode)) is not None:
            return refused
        if (refused := self._refused_by_budget(settings, workspace_id)) is not None:
            return refused
        if (refused := self._refused_images(attachments, conversation)) is not None:
            return refused
        history = history_of(conversation) if conversation else []
        if _no_tool_search_for(model, history):
            return self.response_422(message=self._tool_search_needed())
        pending = pending_turn(conversation) if conversation else None
        if (
            conversation is not None
            and pending is not None
            and not pending.undecided
        ):
            # Every call is decided and no turn holds them: what ran them is gone
            repair_conversation(conversation, user_id)
            pending = None
            log = ConversationLog(conversation, user_id)

        previous_model = conversation.model if conversation else model.id
        if conversation is None:
            conversation = create_conversation(
                user_id, dashboard_id, mode, model.id, question or _("Image")
            )
        conversation.model = model.id
        log = log or ConversationLog(conversation, user_id)
        reference = context.pop("artifact", None)
        if reference is not None:
            opened = selected_context(
                reference["id"], reference["block_id"], user_id, conversation.id
            )
            if opened is not None:
                context["artifact"] = opened
        # A person who writes instead of deciding has moved on: those calls never run,
        # and their answers go first, as the API asks of a user turn. Images go before
        # the text, where the model reads them best
        message = [
            *(not_run_results(pending) if pending else []),
            *[attachment_block(item) for item in attachments],
            context_block(context),
            *([{"type": "text", "text": question}] if question else []),
        ]
        conversation_id = conversation.id
        turn_id = str(uuid4())
        if not store.acquire(conversation_id, turn_id):
            return self._busy()
        try:
            log.add_user_message(message, attachments)
        except ConversationBusyError:
            store.release(conversation_id, turn_id)
            return self._busy()
        opening = [
            (
                "conversation",
                {"id": str(conversation_id), "mode": mode, "model": model.id},
            )
        ]
        if previous_model != model.id:
            # Prompt caches belong to one model: this turn starts them again
            opening.append(("model_changed", {"from": previous_model, "to": model.id}))
        return self._run(
            store,
            log,
            TurnTicket(
                turn_id=turn_id,
                conversation_id=str(conversation_id),
                user_id=user_id,
                kind=KIND_CHAT,
                mode=mode,
                model=model.id,
                dashboard_id=dashboard_id,
                locale=_locale(),
                after=store.last_event(conversation_id),
                seq=log.next_seq,
                opened_at=time.time(),
            ),
            opening,
        )

    @staticmethod
    def _run(
        store: TurnStore,
        log: ConversationLog,
        ticket: TurnTicket,
        opening: list[tuple[str, dict[str, Any]]],
    ) -> Response:
        """Hand a turn to the workers and start reading it."""
        start_turn(store, ticket, opening)
        return _event_stream(relay(store, ticket.conversation_id, ticket.after))

    def _refused_images(
        self, attachments: list[UUID], conversation: AssistantConversation | None
    ) -> Response | None:
        """Why these images cannot join this conversation, if they cannot."""
        if not attachments:
            return None
        if not has_drafts(attachments, _user_id()):
            return self.response_422(message=_("Attach your images again."))
        held = attachments_in(conversation.id) if conversation else 0
        if held + len(attachments) > MAX_PER_CONVERSATION:
            return self.response_422(
                message=_("This conversation cannot take more images. Start a new one.")
            )
        return None

    def _refused_by_settings(self, settings: AssistantSettings) -> Response | None:
        """Why the assistant cannot answer here, if it cannot."""
        if (refused := self._turned_off(settings)) is not None:
            return refused
        if not has_api_key():
            return self.response(503, message=_("The AI assistant has no API key."))
        if turn_store() is None:
            return self.response(
                503, message=_("The AI assistant has no place to run its answers.")
            )
        return None

    def _turned_off(self, settings: AssistantSettings) -> Response | None:
        if not settings.enabled:
            return self.response(403, message=_("The AI assistant is turned off."))
        return None

    def _refused_here(
        self, settings: AssistantSettings, workspace_id: int | None, mode: str
    ) -> Response | None:
        """Why this mode does not run on this report at this moment, if it does not."""
        reason = switched_off(settings, workspace_id, mode)
        if reason is None:
            return None
        return self.response(
            403,
            reason=reason,
            message=(
                _("The AI assistant is turned off in this workspace.")
                if reason == OFF_IN_WORKSPACE
                else _("The assistant cannot change reports here. It can still answer.")
            ),
        )

    def _refused_by_budget(
        self, settings: AssistantSettings, workspace_id: int | None
    ) -> Response | None:
        """Checked before each new turn. A turn under way finishes."""
        state = budget_of(settings, workspace_id)
        if state.level != LEVEL_STOPPED:
            return None
        return self.response(
            429,
            reason="budget",
            message=(
                _(
                    "This workspace used up its assistant budget for the month. Ask an "
                    "admin of the workspace, or wait for next month."
                )
                if state.scope == SCOPE_WORKSPACE
                else _(
                    "The assistant used up its budget for the month. Ask an admin, or "
                    "wait for next month."
                )
            ),
        )

    def _refused_by_privacy(self) -> Response | None:
        """Nothing travels to Anthropic for someone who has not read what travels."""
        if accepted_privacy(_user_id()):
            return None
        return self.response(
            403,
            reason="privacy",
            message=_("Accept the privacy notice of the assistant first."),
        )

    @staticmethod
    def _tool_search_needed() -> str:
        return _("This conversation needs a model that can search for tools.")

    def _busy(self) -> Response:
        return self.response(
            409, message=_("This conversation is answering another message.")
        )

    @staticmethod
    def _turn_runs(conversation_id: UUID) -> bool:
        """Whether a live turn holds a conversation. A dead one is closed here."""
        store = turn_store()
        if store is None:
            return False
        settle_turn(store, conversation_id)
        return store.holder(conversation_id) is not None

    @staticmethod
    def _running(conversation: AssistantConversation) -> TurnTicket | None:
        """The live turn of a conversation, if any. A dead one is closed here."""
        store = turn_store()
        if store is None:
            return None
        settle_turn(store, conversation.id)
        turn_id = store.holder(conversation.id)
        return store.ticket(turn_id) if turn_id else None

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
            the stored ones. Answers with the events of the chat, and goes on at the
            stream endpoint the same way. Once every pending call of the turn is
            decided, its tools run and the model goes on.
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
        if (refused := self._refused_by_privacy()) is not None:
            return refused
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            data = AssistantDecisionSchema().load(request.json)
        except ValidationError as ex:
            return self.response_400(message=ex.messages)

        user_id = _user_id()
        conversation = find_conversation(conversation_id, user_id)
        if conversation is None:
            return self.response_404()
        store = _open_store()
        settle_turn(store, conversation_id)
        # Before anything is read: a decision that lands after this collides with
        # this one, however long the checks below take
        log = ConversationLog(conversation, user_id)
        dashboard = open_dashboard(conversation.dashboard_id)
        if dashboard is None:
            return self.response_404()
        # Checked again here: rights can change while a card waits
        if conversation.mode != MODE_EDIT or not security_manager.can_edit_resource(
            dashboard
        ):
            return self.response_403()
        dashboard_id = dashboard.id
        workspace_id = workspace_id_of(dashboard_id)
        # A card can wait for days: the switches are read now
        if (
            refused := self._refused_here(settings, workspace_id, MODE_EDIT)
        ) is not None:
            return refused
        tool_use_id = data["tool_use_id"]
        pending = pending_turn(conversation)
        if pending is None or tool_use_id not in pending.undecided:
            return self.response(
                409, message=_("This action is no longer waiting for a decision.")
            )
        model = offered_model(settings, data["model"] or conversation.model)
        if model is None:
            return self.response_422(message=_("This model is not available."))
        if _no_tool_search_for(model, history_of(conversation)):
            return self.response_422(message=self._tool_search_needed())
        conversation.model = model.id
        turn_id = str(uuid4())
        if not store.acquire(conversation_id, turn_id):
            return self._busy()
        try:
            # Stored before anything runs: of two racing requests one stops here
            log.add_decision(tool_use_id, data["approved"])
        except ConversationBusyError:
            store.release(conversation_id, turn_id)
            return self._busy()
        decided = pending_turn(conversation)
        if decided is None or decided.undecided:
            # The rest of the cards are still up: nothing runs until they answer
            store.release(conversation_id, turn_id)
            if decided is None:
                return self._busy()
            return _event_stream(answered_at_once(context_tokens_of(conversation)))
        return self._run(
            store,
            log,
            TurnTicket(
                turn_id=turn_id,
                conversation_id=str(conversation_id),
                user_id=user_id,
                kind=KIND_DECIDE,
                mode=MODE_EDIT,
                model=model.id,
                dashboard_id=dashboard_id,
                locale=_locale(),
                after=store.last_event(conversation_id),
                seq=log.next_seq,
                opened_at=time.time(),
            ),
            [],
        )

    @expose("/conversations/<uuid:conversation_id>/stream/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def stream(self, conversation_id: UUID) -> Response:
        """The events of a conversation past a number, as they arrive.
        ---
        get:
          summary: Read the answer of the AI assistant, from where it was left
          description: >-
            The events of the chat with a number greater than after, for the owner of
            the conversation. Answers one connection: it ends with turn_end when the
            turn is over, and otherwise goes on in another request from the last
            number.
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          - in: query
            name: after
            description: The number of the last event read
            schema:
              type: integer
          responses:
            200:
              description: The stream of the answer
              content:
                text/event-stream:
                  schema:
                    type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            503:
              description: The assistant cannot run on this server
        """
        if not _session_user_only():
            return self.response_403()
        store = turn_store()
        if store is None:
            return self.response(
                503, message=_("The AI assistant has no place to run its answers.")
            )
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None or open_dashboard(conversation.dashboard_id) is None:
            return self.response_404()
        after = max(request.args.get("after", 0, type=int), 0)
        return _event_stream(relay(store, conversation_id, after))

    @expose("/conversations/<uuid:conversation_id>/stop/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def stop(self, conversation_id: UUID) -> Response:
        """Ask the turn of a conversation to stop.
        ---
        post:
          summary: Stop the answer of the AI assistant
          description: >-
            The turn stops at its next step, a running tool first finishes, and its
            stream ends as usual. With nothing running it does nothing.
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: Whether a turn was asked to stop
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        store = turn_store()
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None:
            return self.response_404()
        turn_id = store.holder(conversation_id) if store else None
        if store is not None and turn_id is not None:
            store.ask_to_stop(turn_id)
        return self.response(200, result={"stopping": turn_id is not None})

    @expose("/conversations/<uuid:conversation_id>/undo/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def undo(self, conversation_id: UUID) -> Response:  # noqa: C901
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
        settings = get_assistant_settings()
        if (refused := self._turned_off(settings)) is not None:
            return refused
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None:
            return self.response_404()
        if self._turn_runs(conversation_id):
            return self._busy()
        log = ConversationLog(conversation, _user_id())
        dashboard = open_dashboard(conversation.dashboard_id)
        if dashboard is None:
            return self.response_404()
        if conversation.mode != MODE_EDIT or not security_manager.can_edit_resource(
            dashboard
        ):
            return self.response_403()
        if (
            refused := self._refused_here(
                settings, workspace_id_of(dashboard.id), MODE_EDIT
            )
        ) is not None:
            return refused
        if pending_turn(conversation) is not None:
            return self.response(
                409, message=_("Answer the pending action before undoing.")
            )
        try:
            skipped = undo_last_turn(
                conversation,
                dashboard.id,
                log,
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
          parameters:
          - in: query
            name: dashboard_id
            description: The report asking. Its workspace has its own say
            schema:
              type: integer
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
        not_here = {"available": False, "models": []}
        if not _is_available(settings):
            return self.response(200, result=not_here)
        workspace_id = None
        dashboard_id = request.args.get("dashboard_id", type=int)
        if dashboard_id is not None:
            dashboard = open_dashboard(dashboard_id)
            if dashboard is None:
                return self.response(200, result=not_here)
            workspace_id = workspace_id_of(dashboard.id)
        if switched_off(settings, workspace_id, MODE_READ) is not None:
            return self.response(200, result=not_here)
        offered = offered_models(settings, get_catalog())
        return self.response(
            200,
            result={
                "available": bool(offered),
                "edit_available": bool(offered)
                and switched_off(settings, workspace_id, MODE_EDIT) is None,
                "privacy_accepted": accepted_privacy(_user_id()),
                "budget": _budget_json(budget_of(settings, workspace_id)),
                "models": [
                    _offered_model_json(model, settings.default_model)
                    for model in offered
                ],
            },
        )

    @expose("/privacy/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def privacy(self) -> Response:
        """Accept the privacy notice of the assistant, for the user of the session.
        ---
        post:
          summary: Accept the privacy notice of the AI assistant
          responses:
            200:
              description: It is stored
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        if not _session_user_only():
            return self.response_403()
        accept_privacy(_user_id())
        return self.response(200, result={"privacy_accepted": True})

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
        if open_dashboard(dashboard_id) is None:
            return self.response_404()
        return self.response(
            200,
            result=[
                {**conversation_json(item), "last_message_on": last.isoformat()}
                for item, last in list_conversations(_user_id(), dashboard_id)
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
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None or open_dashboard(conversation.dashboard_id) is None:
            return self.response_404()
        running = self._running(conversation)
        # Read after that: what a running turn stored comes again through its stream
        messages = conversation_messages(
            conversation, before=running.seq if running else None
        )
        return self.response(
            200,
            result={
                **conversation_json(conversation),
                "messages": messages,
                "figures": figures_in(messages),
                "artifact_calls": artifact_calls(messages),
                "artifacts": summaries_of(conversation.id),
                "context_tokens": context_tokens_of(conversation),
                "pending": [] if running else pending_json(pending_turn(conversation)),
                "rejected": rejected_calls(conversation),
                "can_undo": not running
                and conversation.mode == MODE_EDIT
                and can_undo(conversation),
                "feedback": feedback_of(conversation, _user_id()),
                "interrupted": lost_turns(conversation),
                "running": {"after": running.after} if running else None,
            },
        )

    @expose("/conversations/<uuid:conversation_id>/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def rename(self, conversation_id: UUID) -> Response:
        """Change the title of one of the user's conversations.
        ---
        put:
          summary: Rename a conversation of the current user
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
              description: The conversation with its new title
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
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None or open_dashboard(conversation.dashboard_id) is None:
            return self.response_404()
        try:
            title = AssistantRenameSchema().load(request.json or {})["title"].strip()
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        if not title:
            return self.response_400(message="The title is empty")
        rename_conversation(conversation, title)
        return self.response(200, result=conversation_json(conversation))

    @expose("/conversations/<uuid:conversation_id>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def remove(self, conversation_id: UUID) -> Response:
        """Delete one of the user's conversations and all it holds.
        ---
        delete:
          summary: Delete a conversation of the current user
          description: >-
            Removes what was said and the data it read. What its answers cost stays,
            without content, for the spending limits and the usage report.
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The conversation is gone
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: The assistant is answering in this conversation
        """
        if not _session_user_only():
            return self.response_403()
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None:
            return self.response_404()
        if self._turn_runs(conversation_id):
            return self._busy()
        try:
            delete_conversation(conversation)
        except ConversationBusyError:
            return self._busy()
        forget_streams(turn_store(), [conversation_id])
        return self.response(200, message="OK")

    @expose("/attachments/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def upload_attachment(self) -> Response:
        """Keep an image for the next message of the user of the session.
        ---
        post:
          summary: Upload an image for the AI assistant
          description: >-
            The server reads the real type from the content and stores a new image,
            without metadata. It waits for a message, which names it by its id.
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    image:
                      type: string
                      format: binary
          responses:
            200:
              description: The stored image
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            413:
              description: The file is too large
            422:
              description: The image is refused, and the message says why
            503:
              description: The assistant cannot run on this server
        """
        if not _session_user_only():
            return self.response_403()
        settings = get_assistant_settings()
        if (refused := self._refused_by_settings(settings)) is not None:
            return refused
        if (refused := self._refused_by_privacy()) is not None:
            return refused
        if (request.content_length or 0) > MAX_UPLOAD_BYTES + UPLOAD_OVERHEAD_BYTES:
            return self.response(413, message=_("This image is larger than 8 MB."))
        upload = request.files.get("image")
        if upload is None:
            return self.response_400(message="Missing image")
        try:
            draft = save_draft(
                _user_id(), clean_image(upload.read(MAX_UPLOAD_BYTES + 1))
            )
        except ImageRefusedError as ex:
            return self.response(422, message=str(ex))
        return self.response(
            200,
            result={
                "id": str(draft.id),
                "media_type": draft.image_type,
                "width": draft.width,
                "height": draft.height,
            },
        )

    @expose("/attachments/<uuid:attachment_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def attachment(self, attachment_id: UUID) -> Response:
        """An image of the user of the session.
        ---
        get:
          summary: An image attached to the AI assistant by the current user
          parameters:
          - in: path
            name: attachment_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The image
              content:
                image/*:
                  schema:
                    type: string
                    format: binary
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        user_id = _user_id()
        found = find_attachment(attachment_id, user_id)
        if found is None:
            return self.response_404()
        if found.conversation_id is not None:
            conversation = find_conversation(found.conversation_id, user_id)
            if (
                conversation is None
                or open_dashboard(conversation.dashboard_id) is None
            ):
                return self.response_404()
        response = image_response(found.image, found.image_type)
        # A deleted conversation must not live on in a cache
        response.headers["Cache-Control"] = "private, no-store"
        return response

    @expose("/attachments/<uuid:attachment_id>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def remove_attachment(self, attachment_id: UUID) -> Response:
        """Drop an image that was not sent yet.
        ---
        delete:
          summary: Delete an image of the current user that no message sent
          parameters:
          - in: path
            name: attachment_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The image is gone
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        if not delete_draft(attachment_id, _user_id()):
            return self.response_404()
        return self.response(200, message="OK")

    def _open_artifact(self, artifact_id: UUID) -> AssistantArtifact | None:
        """A document of this person, on a report they can still open."""
        artifact = find_artifact(artifact_id, _user_id())
        if artifact is None or open_dashboard(artifact.dashboard_id) is None:
            return None
        return artifact

    @expose("/artifacts/<uuid:artifact_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def artifact(self, artifact_id: UUID) -> Response:
        """A document of the user of the session, as it stands.
        ---
        get:
          summary: The last version of a document of the current user
          description: >-
            Its data blocks hold queries, never numbers: the reader runs them through
            the chart data API. sources names only the datasets the reader reaches.
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The document, with its history
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        artifact = self._open_artifact(artifact_id)
        version = version_of(artifact.id) if artifact else None
        if artifact is None or version is None:
            return self.response_404()
        return self.response(200, result=artifact_json(artifact, version))

    @expose("/artifacts/<uuid:artifact_id>/versions/<int:number>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def artifact_version(self, artifact_id: UUID, number: int) -> Response:
        """One version of a document of the user of the session.
        ---
        get:
          summary: A version of a document of the current user
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          - in: path
            name: number
            required: true
            schema:
              type: integer
          responses:
            200:
              description: That version of the document, with its history
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        artifact = self._open_artifact(artifact_id)
        version = version_of(artifact.id, number) if artifact else None
        if artifact is None or version is None:
            return self.response_404()
        return self.response(200, result=artifact_json(artifact, version))

    @expose("/artifacts/<uuid:artifact_id>/restore/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def restore_artifact(self, artifact_id: UUID) -> Response:
        """Go back to a version of a document, which adds a new one.
        ---
        post:
          summary: Go back to a version of a document of the current user
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    version:
                      type: integer
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The document, with the new version as its last
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: A turn is running on this conversation
            422:
              $ref: '#/components/responses/422'
        """
        if not _session_user_only():
            return self.response_403()
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            number = AssistantRestoreSchema().load(request.json)["version"]
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        user_id = _user_id()
        artifact = self._open_artifact(artifact_id)
        conversation = (
            find_conversation(artifact.conversation_id, user_id) if artifact else None
        )
        if artifact is None or conversation is None:
            return self.response_404()
        store = turn_store()
        if store is None:
            return self.response(
                503, message=_("The AI assistant has no place to run its answers.")
            )
        settle_turn(store, conversation.id)
        if store.holder(conversation.id) is not None:
            return self._busy()
        try:
            log = ConversationLog(conversation, user_id)
            version = restore_version(artifact, number)
            if version is None:
                return self.response_404()
            log.add_artifact_restored(artifact.id, version.number)
        except (ArtifactMovedError, ConversationBusyError):
            return self._busy()
        except ArtifactRefusedError:
            return self.response_422(
                message=_(
                    "This version cannot be restored: it uses data you can no longer "
                    "reach, or the document has too many versions."
                )
            )
        return self.response(200, result=artifact_json(artifact, version))

    @expose("/documents/<uuid:artifact_id>/", methods=("GET",))
    @safe
    @statsd_metrics
    def document(self, artifact_id: UUID) -> Response:
        """A document as it reads on its page, for its owner or who it is shared with.
        ---
        get:
          summary: The reading view of a document
          description: >-
            Its owner gets the last version. A member of the workspace it is shared
            with gets the shared version, without its conversation or its history, and
            of a block they do not reach only that it is there. Anyone else gets a 404,
            an anonymous visitor too, so nothing tells whether it exists: that is why
            this route has no protect(), whose 401 would come first.
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The document
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only() or not security_manager.can_access(
            "can_read", "Dashboard"
        ):
            return self.response_404()
        user_id = _user_id()
        artifact = self._open_artifact(artifact_id)
        version = version_of(artifact.id) if artifact else None
        if artifact is not None and version is not None:
            return self.response(
                200,
                result={
                    **artifact_json(artifact, version),
                    "author": None,
                    "written_on": oldest_text(blocks_of(version)),
                    "reader": False,
                },
            )
        shared = sharing.find_shared(artifact_id, user_id)
        document = sharing.reader_json(shared) if shared else None
        if document is None:
            return self.response_404()
        return self.response(200, result=document)

    @expose("/documents/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def documents(self) -> Response:
        """The documents shared in a workspace, for one of its members.
        ---
        get:
          summary: The documents shared in a workspace
          parameters:
          - in: query
            name: workspace_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: What the current user reads there
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        workspace_id = request.args.get("workspace_id", type=int)
        if workspace_id is None or not sharing.is_member(workspace_id, _user_id()):
            return self.response_404()
        return self.response(200, result=sharing.shared_in(workspace_id))

    def _last_version_of(
        self, artifact_id: UUID
    ) -> tuple[AssistantArtifact, AssistantArtifactVersion] | None:
        artifact = self._open_artifact(artifact_id)
        version = version_of(artifact.id) if artifact else None
        if artifact is None or version is None:
            return None
        return artifact, version

    @expose("/artifacts/<uuid:artifact_id>/share/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def share_card(self, artifact_id: UUID) -> Response:
        """What a person reads before sharing their document.
        ---
        get:
          summary: The card shown before sharing a document
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: What a reader would get, and what its text holds
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        found = self._last_version_of(artifact_id)
        if found is None:
            return self.response_404()
        return self.response(200, result=sharing.share_card(*found))

    @expose("/artifacts/<uuid:artifact_id>/share/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def share_artifact(self, artifact_id: UUID) -> Response:
        """Share a document inside the workspace of its report.
        ---
        post:
          summary: Share the version a person read on the card
          parameters:
          - in: path
            name: artifact_id
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
                  properties:
                    version:
                      type: integer
          responses:
            200:
              description: The document
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            409:
              description: The document moved on after the card
            422:
              $ref: '#/components/responses/422'
        """
        if not _session_user_only():
            return self.response_403()
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            number = AssistantShareSchema().load(request.json)["version"]
        except ValidationError as ex:
            return self.response_400(message=ex.messages)
        found = self._last_version_of(artifact_id)
        if found is None:
            return self.response_404()
        artifact, version = found
        if version.number != number:
            return self.response(
                409, message=_("The document changed. Read the card again.")
            )
        if sharing.share_card(artifact, version)["problem"] is not None:
            return self.response_422(
                message=_(
                    "Only a member of the workspace of this report can share this."
                )
            )
        sharing.share(artifact, version)
        sharing.log_document(sharing.ACTION_SHARE, artifact, version)
        return self.response(200, result=artifact_json(artifact, version))

    @expose("/artifacts/<uuid:artifact_id>/share/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def unshare_artifact(self, artifact_id: UUID) -> Response:
        """Close the share of a document, at once.
        ---
        delete:
          summary: Stop sharing a document
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: The document
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        # Not ``_open_artifact``: this only takes access away, so an author who lost the
        # report can still do it
        artifact = find_artifact(artifact_id, _user_id())
        version = version_of(artifact.id) if artifact else None
        if artifact is None or version is None:
            return self.response_404()
        sharing.log_document(sharing.ACTION_UNSHARE, artifact, version)
        sharing.unshare(artifact)
        return self.response(200, result=artifact_json(artifact, version))

    @expose("/artifacts/<uuid:artifact_id>/export/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def export_artifact(self, artifact_id: UUID) -> Response:
        """Ask for a document as a PDF, as the user of the session.
        ---
        post:
          summary: Queue the export of a document of the current user
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            202:
              description: Queued, with the id to ask for it by
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        # pylint: disable=import-outside-toplevel
        from superset.auradata.assistant.exports import start_export

        if not _session_user_only():
            return self.response_403()
        found = self._last_version_of(artifact_id)
        if found is None:
            return self.response_404()
        store = turn_store()
        if store is None:
            return self.response_422(message=_("Export is not available here."))
        job_id = start_export(store, found[0], _user_id(), _locale())
        return self.response(202, result={"job_id": job_id})

    @expose("/artifacts/<uuid:artifact_id>/export/<string:job_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def exported_artifact(self, artifact_id: UUID, job_id: str) -> Response:
        """The PDF of a document, once it is ready.
        ---
        get:
          summary: Ask for an export of the current user
          parameters:
          - in: path
            name: artifact_id
            required: true
            schema:
              type: string
              format: uuid
          - in: path
            name: job_id
            required: true
            schema:
              type: string
          responses:
            200:
              description: The file
              content:
                application/pdf:
                  schema:
                    type: string
                    format: binary
            202:
              description: Still working
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        # pylint: disable=import-outside-toplevel
        from superset.auradata.assistant.exports import DONE, FAILED, job_of

        if not _session_user_only():
            return self.response_403()
        store = turn_store()
        # The file holds what the document says, so it is read as the document is
        job = (
            job_of(store, job_id, artifact_id, _user_id())
            if store is not None and self._last_version_of(artifact_id) is not None
            else None
        )
        if job is None:
            return self.response_404()
        if job["status"] == FAILED:
            return self.response_422(message=_("The PDF could not be made."))
        if job["status"] != DONE:
            return self.response(202, message="Working")
        return Response(
            base64.b64decode(job["pdf"]),
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{job["file_name"]}"'
            },
        )

    def _answer_to_vote(
        self, conversation_id: UUID, message_id: UUID
    ) -> AssistantMessage | None:
        """An answer of a conversation of this person, on a report they can open."""
        conversation = find_conversation(conversation_id, _user_id())
        if conversation is None or open_dashboard(conversation.dashboard_id) is None:
            return None
        return answer_of(conversation, message_id)

    @expose(
        "/conversations/<uuid:conversation_id>/messages/<uuid:message_id>/feedback/",
        methods=("PUT",),
    )
    @protect()
    @safe
    @statsd_metrics
    def feedback(self, conversation_id: UUID, message_id: UUID) -> Response:
        """Vote on an answer, or change the vote.
        ---
        put:
          summary: Vote on an answer of the AI assistant
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          - in: path
            name: message_id
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
              description: The vote as it stands
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
        answer = self._answer_to_vote(conversation_id, message_id)
        if answer is None:
            return self.response_404()
        try:
            values = AssistantFeedbackSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        return self.response(
            200,
            result=save_vote(answer, _user_id(), values["vote"], values["reason"]),
        )

    @expose(
        "/conversations/<uuid:conversation_id>/messages/<uuid:message_id>/feedback/",
        methods=("DELETE",),
    )
    @protect()
    @safe
    @statsd_metrics
    def clear_feedback(self, conversation_id: UUID, message_id: UUID) -> Response:
        """Take a vote back.
        ---
        delete:
          summary: Remove a vote on an answer of the AI assistant
          parameters:
          - in: path
            name: conversation_id
            required: true
            schema:
              type: string
              format: uuid
          - in: path
            name: message_id
            required: true
            schema:
              type: string
              format: uuid
          responses:
            200:
              description: There is no vote any more
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        if not _session_user_only():
            return self.response_403()
        answer = self._answer_to_vote(conversation_id, message_id)
        if answer is None:
            return self.response_404()
        clear_vote(answer, _user_id())
        return self.response(200, message="OK")


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

    @expose("/document/<uuid:artifact_id>/")
    @has_access
    @permission_name("read")
    def document(
        self,
        artifact_id: UUID,  # pylint: disable=unused-argument
    ) -> FlaskResponse:
        """The reading view of a document, a shell: its data decides who reads."""
        return super().render_app_template()
