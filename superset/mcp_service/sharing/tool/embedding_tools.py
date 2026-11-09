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
Embed a report in another site, as the web's «Embed dashboard» does: the
embedding of a dashboard (its uuid and the sites allowed to frame it), the
frontend code of the embedding SDK and the guest tokens a host backend mints.

Enabling and disabling take the route permission of the web (``set_embedded``,
Admins unless granted) and, as every report write, ``can_edit_resource``.
A guest token runs the checks of ``POST /api/v1/security/guest_token/``.
"""

import logging
from typing import Any
from urllib.parse import urlparse

from fastmcp import Context
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import is_feature_enabled, security_manager
from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import find_dashboard, LayoutEditError
from superset.mcp_service.sharing.schemas import (
    CreateEmbedGuestTokenRequest,
    DisableDashboardEmbeddingRequest,
    EmbeddingOutcome,
    GetDashboardEmbeddingRequest,
    GuestTokenResponse,
    SetDashboardEmbeddingRequest,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

UNAVAILABLE = (
    "This installation does not serve embedded reports: an operator turns on "
    "the EMBEDDED_SUPERSET feature flag with a GUEST_TOKEN_JWT_SECRET of its own."
)


def _available() -> bool:
    return bool(is_feature_enabled("EMBEDDED_SUPERSET"))


def _may_change(dashboard: Any) -> bool:
    """The web's route permission plus editing the report."""
    return bool(
        security_manager.can_access("can_set_embedded", "Dashboard")
        and security_manager.can_edit_resource(dashboard)
    )


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Rollback failed after an embedding error")


def origin_of(raw: str) -> str:
    """
    A site allowed to embed, as the origin the embedded view compares with the
    Referer (scheme, host and port). Raises ValueError for anything else.
    """
    value = raw.strip()
    parsed = urlparse(value)
    if (
        parsed.scheme not in ("http", "https")
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path not in ("", "/")
        or parsed.params
        or parsed.query
        or parsed.fragment
        or "*" in value
    ):
        raise ValueError(
            f"{raw!r} is not a site origin such as https://intranet.example.com"
        )
    port = parsed.port  # raises ValueError on a bad port
    host = parsed.hostname.lower()
    if ":" in host:
        host = f"[{host}]"
    return f"{parsed.scheme}://{host}" + (f":{port}" if port else "")


def _snippet(uuid: str, domain: str, expires: int) -> str:
    return (
        'import { embedDashboard } from "@superset-ui/embedded-sdk";\n\n'
        "embedDashboard({\n"
        f"  id: {json.dumps(uuid)},\n"
        f"  supersetDomain: {json.dumps(domain)},\n"
        '  mountPoint: document.getElementById("auradata-report"),\n'
        f"  // Your backend mints a guest token (it lasts {expires} s); the SDK\n"
        "  // calls this again before it expires. Never mint it in the browser.\n"
        "  fetchGuestToken: () =>\n"
        '    fetch("/api/auradata/guest-token")\n'
        "      .then(response => response.json())\n"
        "      .then(data => data.token),\n"
        "  dashboardUiConfig: { hideTitle: true, filters: { expanded: false } },\n"
        "});\n"
    )


def _token_steps(uuid: str, domain: str, expires: int) -> list[str]:
    return [
        "Your backend signs in to AuraData BI as a service account with the "
        f"grant_guest_token permission (POST {domain}/api/v1/security/login), "
        "keeping its credentials on the server, never in the browser.",
        f"For each visitor it calls POST {domain}/api/v1/security/guest_token/ "
        f'with {{"resources": [{{"type": "dashboard", "id": "{uuid}"}}], '
        '"rls": [{"clause": "region = \'Norte\'"}], "user": {"username": '
        '"guest"}} and returns the token to fetchGuestToken.',
        f"A token lasts {expires} s. The guest sees what the service account "
        "sees of the report, narrowed by the rls clauses.",
        "The host page's address must be one of allowed_domains (when any are "
        "set): those sites, and only those, may frame the report.",
    ]


def _outcome(dashboard: Any, **extra: Any) -> EmbeddingOutcome:
    embedded = dashboard.embedded[0] if dashboard.embedded else None
    available = _available()
    domain = get_superset_base_url()
    expires = int(current_app.config.get("GUEST_TOKEN_JWT_EXP_SECONDS", 300))
    warnings: list[str] = list(extra.pop("warnings", []))
    if not available:
        warnings.append(UNAVAILABLE)
    fields: dict[str, Any] = {
        "dashboard_id": dashboard.id,
        "title": dashboard.dashboard_title,
        "published": bool(dashboard.published),
        "embedding_available": available,
        "embedded": embedded is not None,
        "superset_domain": domain,
        "can_change": _may_change(dashboard),
    }
    if embedded is not None:
        uuid = str(embedded.uuid)
        fields.update(
            embedded_uuid=uuid,
            allowed_domains=embedded.allowed_domains,
            embed_url=f"{domain}/embedded/{uuid}",
            sdk_snippet=_snippet(uuid, domain, expires),
            guest_token_steps=_token_steps(uuid, domain, expires),
        )
        if not embedded.allowed_domains:
            warnings.append("No allowed_domains: any site may embed it.")
        if not dashboard.published:
            warnings.append(
                "The report is a draft: publish_dashboard publishes it before "
                "people outside see it."
            )
    return EmbeddingOutcome(**fields, warnings=warnings, **extra)


def _refused(dashboard: Any, verb: str) -> EmbeddingOutcome:
    return EmbeddingOutcome(
        dashboard_id=dashboard.id,
        title=dashboard.dashboard_title,
        embedding_available=_available(),
        embedded=bool(dashboard.embedded),
        permission_denied=True,
        error=(
            f"You may not {verb} embedding of dashboard '{dashboard.dashboard_title}'"
            f" (ID: {dashboard.id}): it takes an editor of the report with the "
            "permission to embed dashboards (Admins unless granted)."
        ),
        error_type="Forbidden",
    )


@tool(
    tags=["embedding"],
    class_permission_name="Dashboard",
    method_permission_name="read",
    annotations=ToolAnnotations(
        title="Get dashboard embedding",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def get_dashboard_embedding(
    request: GetDashboardEmbeddingRequest, ctx: Context
) -> EmbeddingOutcome:
    """
    Whether a report can be embedded in another site, and what that site needs:
    its embedded uuid, the allowed domains, the embedded address, the
    @superset-ui/embedded-sdk code for the page and how its backend mints guest
    tokens. Also says whether this installation serves embedded reports and
    whether you may change it (set_dashboard_embedding).
    """
    await ctx.info(f"Get embedding of dashboard={request.dashboard}")
    try:
        with event_logger.log_context(action="mcp.get_dashboard_embedding"):
            dashboard = find_dashboard(request.dashboard)
            return _outcome(dashboard)
    except LayoutEditError as ex:
        return EmbeddingOutcome(error=ex.message, error_type=ex.error_type)


@tool(
    tags=["mutate", "sharing", "embedding"],
    class_permission_name="Dashboard",
    method_permission_name="set_embedded",
    annotations=ToolAnnotations(
        title="Set dashboard embedding",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def set_dashboard_embedding(
    request: SetDashboardEmbeddingRequest, ctx: Context
) -> EmbeddingOutcome:
    """
    Let a report be embedded in other sites, or change which ones: the origins
    in allowed_domains (allow_any_domain=true with none lets any site). Keeps
    the embedded uuid. Returns what get_dashboard_embedding does, with the SDK
    code. Takes an editor of the report with the permission to embed.
    """
    from superset import db
    from superset.daos.dashboard import EmbeddedDashboardDAO

    await ctx.info(
        f"Set embedding of dashboard={request.dashboard} "
        f"domains={len(request.allowed_domains)}"
    )
    try:
        dashboard = find_dashboard(request.dashboard)
    except LayoutEditError as ex:
        return EmbeddingOutcome(error=ex.message, error_type=ex.error_type)
    if not _available():
        return _outcome(dashboard, error=UNAVAILABLE, error_type="EmbeddingDisabled")
    if not _may_change(dashboard):
        return _refused(dashboard, "change")
    try:
        domains = list(dict.fromkeys(origin_of(d) for d in request.allowed_domains))
    except ValueError as ex:
        return _outcome(dashboard, error=str(ex), error_type="InvalidRequest")
    if not domains and not request.allow_any_domain:
        return _outcome(
            dashboard,
            error="Name the sites in allowed_domains, or set allow_any_domain=true "
            "to let any site embed the report.",
            error_type="InvalidRequest",
        )
    current = dashboard.embedded[0] if dashboard.embedded else None
    changed = current is None or current.allowed_domains != domains
    with event_logger.log_context(action="mcp.set_dashboard_embedding"):
        if changed:
            try:
                EmbeddedDashboardDAO.upsert(dashboard, domains)
                db.session.commit()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError as ex:
                _rollback()
                logger.warning("set_dashboard_embedding failed: %s", ex)
                return EmbeddingOutcome(
                    dashboard_id=dashboard.id,
                    error="The embedding could not be saved.",
                    error_type=type(ex).__name__,
                )
    return _outcome(find_dashboard(dashboard.id), changed=changed)


@tool(
    tags=["mutate", "sharing", "embedding"],
    class_permission_name="Dashboard",
    method_permission_name="set_embedded",
    annotations=ToolAnnotations(
        title="Disable dashboard embedding",
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def disable_dashboard_embedding(
    request: DisableDashboardEmbeddingRequest, ctx: Context
) -> EmbeddingOutcome:
    """
    Stop a report from being embedded: sites that embed it stop showing it and
    its embedded uuid is gone (enabling it again gives a new one). Takes an
    editor of the report with the permission to embed.
    """
    from superset.commands.dashboard.delete import DeleteEmbeddedDashboardCommand
    from superset.commands.dashboard.exceptions import DashboardForbiddenError

    await ctx.info(f"Disable embedding of dashboard={request.dashboard}")
    try:
        dashboard = find_dashboard(request.dashboard)
    except LayoutEditError as ex:
        return EmbeddingOutcome(error=ex.message, error_type=ex.error_type)
    if not _may_change(dashboard):
        return _refused(dashboard, "disable")
    if not dashboard.embedded:
        return _outcome(dashboard, warnings=["The report was not embedded."])
    with event_logger.log_context(action="mcp.disable_dashboard_embedding"):
        try:
            DeleteEmbeddedDashboardCommand(dashboard).run()
        except DashboardForbiddenError:
            return _refused(dashboard, "disable")
        except (CommandException, SQLAlchemyError) as ex:
            _rollback()
            logger.warning("disable_dashboard_embedding failed: %s", ex)
            return EmbeddingOutcome(
                dashboard_id=dashboard.id,
                error="The embedding could not be removed.",
                error_type=type(ex).__name__,
            )
    return _outcome(find_dashboard(dashboard.id), changed=True)


@tool(
    tags=["mutate", "sharing", "embedding"],
    class_permission_name="SecurityRestApi",
    method_permission_name="grant_guest_token",
    annotations=ToolAnnotations(
        title="Create embed guest token",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def create_embed_guest_token(
    request: CreateEmbedGuestTokenRequest, ctx: Context
) -> GuestTokenResponse:
    """
    Mint a guest token for an embedded report, to try an embedding or hand to
    a host page: a secret, read-only pass that lasts minutes. A real host mints
    them from its backend for each visitor (get_dashboard_embedding explains
    how). rls narrows the rows the guest sees. Same checks as the web's guest
    token endpoint: the grant_guest_token permission and access to the report.
    """
    from marshmallow import ValidationError

    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardAccessDeniedError,
        EmbeddedDashboardNotFoundError,
    )
    from superset.security.api import guest_token_create_schema
    from superset.security.guest_token import build_guest_token_audit_payload
    from superset.utils.core import get_user_id

    await ctx.info(f"Create a guest token for dashboard={request.dashboard}")
    try:
        dashboard = find_dashboard(request.dashboard)
    except LayoutEditError as ex:
        return GuestTokenResponse(error=ex.message, error_type=ex.error_type)
    if not _available():
        return GuestTokenResponse(
            dashboard_id=dashboard.id, error=UNAVAILABLE, error_type="EmbeddingDisabled"
        )
    if not dashboard.embedded:
        return GuestTokenResponse(
            dashboard_id=dashboard.id,
            error="The report is not embedded: set_dashboard_embedding enables it.",
            error_type="NotEmbedded",
        )
    uuid = str(dashboard.embedded[0].uuid)
    config = current_app.config
    try:
        body = guest_token_create_schema.load(
            {
                "user": request.user.model_dump(),
                "resources": [{"type": "dashboard", "id": uuid}],
                "rls": [rule.model_dump(exclude_none=True) for rule in request.rls],
                "datasets": request.datasets,
            }
        )
        with event_logger.log_context(action="mcp.create_embed_guest_token"):
            security_manager.validate_guest_token_resources(
                body["resources"], datasets=body.get("datasets")
            )
            hook = config.get("GUEST_TOKEN_VALIDATOR_HOOK")
            if hook is not None and (not callable(hook) or not hook(body)):
                return GuestTokenResponse(
                    dashboard_id=dashboard.id,
                    error="The installation's guest token validator refused it.",
                    error_type="InvalidRequest",
                )
            token = security_manager.create_guest_access_token(
                body.get("user", {}),
                body["resources"],
                body["rls"],
                **({"datasets": body["datasets"]} if "datasets" in body else {}),
            )
    except EmbeddedDashboardAccessDeniedError:
        return GuestTokenResponse(
            dashboard_id=dashboard.id,
            permission_denied=True,
            error="You may not mint a guest token for this report or its datasets.",
            error_type="Forbidden",
        )
    except EmbeddedDashboardNotFoundError:
        return GuestTokenResponse(
            dashboard_id=dashboard.id,
            error="The report is not embedded.",
            error_type="NotEmbedded",
        )
    except ValidationError as ex:
        return GuestTokenResponse(
            dashboard_id=dashboard.id,
            error=f"Invalid guest token request: {ex.messages}",
            error_type="InvalidRequest",
        )
    text = token.decode() if isinstance(token, bytes) else str(token)
    audit = build_guest_token_audit_payload(
        issuer_user_id=get_user_id(),
        source_ip=None,
        body=body,
        token=text,
        header_name=config["GUEST_TOKEN_HEADER_NAME"],
        header_budget_bytes=config["GUEST_TOKEN_HEADER_MAX_BYTES"],
    )
    logger.info("Guest token issued through the MCP: %s", audit)
    warnings = ["The token is a secret: give it only to the page that embeds."]
    if audit["header_budget_exceeded"]:
        warnings.append("The token is longer than the header budget of this server.")
    return GuestTokenResponse(
        dashboard_id=dashboard.id,
        embedded_uuid=uuid,
        token=text,
        expires_in_seconds=int(config.get("GUEST_TOKEN_JWT_EXP_SECONDS", 300)),
        header_name=config["GUEST_TOKEN_HEADER_NAME"],
        warnings=warnings,
    )
