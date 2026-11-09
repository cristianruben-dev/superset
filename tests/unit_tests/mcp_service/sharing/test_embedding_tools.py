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
The embedding tools answer the same people as the web: Dani edits the
dashboard "Ventas", Ana and Ada contribute to and administer its workspace,
Vera views it, Carlos is in another workspace and Root is a Superset admin.
"""

import logging
from typing import Any

import jwt
import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from superset import security_manager
from superset.mcp_service.sharing.tool.embedding_tools import origin_of
from superset.models.dashboard import Dashboard
from superset.subjects.utils import get_or_create_user_subject
from tests.unit_tests.mcp_service.workspace.world import (
    as_user,
    build_world,
    call,
    shared_engine,
)

FLAG = "superset.mcp_service.sharing.tool.embedding_tools.is_feature_enabled"
SECRET = "a-guest-token-secret-for-the-embedding-tests"  # noqa: S105


@pytest.fixture
def session_engine() -> Engine:
    return shared_engine()


@pytest.fixture
def world(mocker: MockerFixture, session: Session) -> dict[str, Any]:
    world = build_world(session, mocker)
    world["dashboard"].editors = [get_or_create_user_subject(world["users"]["Dani"].id)]
    session.commit()
    mocker.patch(FLAG, return_value=True)
    mocker.patch.dict(
        current_app.config,
        {
            "GUEST_TOKEN_JWT_SECRET": SECRET,
            "GUEST_TOKEN_JWT_AUDIENCE": "auradata",
            "WEBDRIVER_BASEURL_USER_FRIENDLY": "https://bi.example.com/",
        },
    )
    return world


def embedded_of(world: dict[str, Any]) -> Any:
    session = world["session"]
    session.expire_all()
    dashboard = session.get(Dashboard, world["dashboard"].id)
    return dashboard.embedded[0] if dashboard.embedded else None


async def embed(world: dict[str, Any], *domains: str) -> dict[str, Any]:
    as_user(world, "Root")
    return await call(
        "set_dashboard_embedding",
        {"dashboard": world["dashboard"].id, "allowed_domains": list(domains)},
    )


# set_dashboard_embedding


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada", "Root"])
async def test_who_edits_the_report_embeds_it(world: dict[str, Any], name: str) -> None:
    as_user(world, name)
    result = await call(
        "set_dashboard_embedding",
        {
            "dashboard": world["dashboard"].id,
            "allowed_domains": [
                "https://Intranet.Example.com/",
                "http://localhost:3000",
            ],
        },
    )

    assert result.get("error") is None, result
    assert result["changed"] is True
    assert result["embedded"] is True
    uuid = str(embedded_of(world).uuid)
    assert result["embedded_uuid"] == uuid
    assert result["allowed_domains"] == [
        "https://intranet.example.com",
        "http://localhost:3000",
    ]
    assert result["embed_url"] == f"https://bi.example.com/embedded/{uuid}"
    assert f'id: "{uuid}"' in result["sdk_snippet"]
    assert 'supersetDomain: "https://bi.example.com"' in result["sdk_snippet"]
    steps = result["guest_token_steps"]
    assert any("/api/v1/security/guest_token/" in step for step in steps)


@pytest.mark.asyncio
async def test_a_viewer_does_not_embed(world: dict[str, Any]) -> None:
    as_user(world, "Vera")
    result = await call(
        "set_dashboard_embedding",
        {"dashboard": world["dashboard"].id, "allowed_domains": ["https://a.example"]},
    )

    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert embedded_of(world) is None


@pytest.mark.asyncio
async def test_another_workspace_does_not_see_it(world: dict[str, Any]) -> None:
    as_user(world, "Carlos")
    result = await call(
        "set_dashboard_embedding",
        {"dashboard": world["dashboard"].id, "allowed_domains": ["https://a.example"]},
    )

    assert result["error_type"] == "NotFound"
    assert embedded_of(world) is None


@pytest.mark.asyncio
async def test_an_editor_without_the_embed_permission_does_not_embed(
    world: dict[str, Any],
) -> None:
    """The web's route permission (can_set_embedded) is Admin only by default."""
    world["mocker"].patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: permission != "can_set_embedded",
    )
    as_user(world, "Dani")
    result = await call(
        "set_dashboard_embedding",
        {"dashboard": world["dashboard"].id, "allowed_domains": ["https://a.example"]},
    )

    assert result["error_type"] == "Forbidden"
    assert embedded_of(world) is None


@pytest.mark.asyncio
async def test_nothing_is_embedded_while_the_installation_does_not_serve_it(
    world: dict[str, Any],
) -> None:
    world["mocker"].patch(FLAG, return_value=False)
    result = await embed(world, "https://a.example")

    assert result["error_type"] == "EmbeddingDisabled"
    assert result["embedding_available"] is False
    assert embedded_of(world) is None


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "domain",
    [
        "intranet.example.com",
        "ftp://a.example",
        "https://a.example/page",
        "https://a.example/?x=1",
        "https://user:pw@a.example",
        "https://*.example.com",
        "https://a.example:99999",
    ],
)
async def test_only_site_origins_are_allowed(
    world: dict[str, Any], domain: str
) -> None:
    result = await embed(world, domain)

    assert result["error_type"] == "InvalidRequest"
    assert embedded_of(world) is None


@pytest.mark.asyncio
async def test_any_site_takes_an_explicit_choice(world: dict[str, Any]) -> None:
    result = await embed(world)
    assert result["error_type"] == "InvalidRequest"
    assert embedded_of(world) is None

    result = await call(
        "set_dashboard_embedding",
        {"dashboard": world["dashboard"].id, "allow_any_domain": True},
    )
    assert result["embedded"] is True
    assert result["allowed_domains"] == []
    assert "No allowed_domains: any site may embed it." in result["warnings"]


@pytest.mark.asyncio
async def test_changing_the_sites_keeps_the_uuid(world: dict[str, Any]) -> None:
    first = await embed(world, "https://a.example")
    again = await embed(world, "https://a.example", "https://a.example/")
    second = await embed(world, "https://b.example")

    assert again["changed"] is False
    assert second["changed"] is True
    assert second["embedded_uuid"] == first["embedded_uuid"]
    assert embedded_of(world).allowed_domains == ["https://b.example"]


def test_origins_are_normalized() -> None:
    assert origin_of(" HTTPS://A.Example:8443/ ") == "https://a.example:8443"
    assert origin_of("http://[::1]:3000") == "http://[::1]:3000"


# get_dashboard_embedding


@pytest.mark.asyncio
async def test_whoever_opens_the_report_reads_its_embedding(
    world: dict[str, Any],
) -> None:
    as_user(world, "Vera")
    result = await call("get_dashboard_embedding", {"dashboard": world["dashboard"].id})
    assert result["embedded"] is False
    assert result["embedding_available"] is True
    assert result["can_change"] is False

    embedded = await embed(world, "https://a.example")
    as_user(world, "Vera")
    result = await call("get_dashboard_embedding", {"dashboard": world["dashboard"].id})
    assert result["embedded_uuid"] == embedded["embedded_uuid"]
    assert result["allowed_domains"] == ["https://a.example"]

    as_user(world, "Ana")
    result = await call("get_dashboard_embedding", {"dashboard": world["dashboard"].id})
    assert result["can_change"] is True

    as_user(world, "Carlos")
    result = await call("get_dashboard_embedding", {"dashboard": world["dashboard"].id})
    assert result["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_reading_says_when_the_installation_does_not_serve_it(
    world: dict[str, Any],
) -> None:
    world["mocker"].patch(FLAG, return_value=False)
    as_user(world, "Dani")
    result = await call("get_dashboard_embedding", {"dashboard": world["dashboard"].id})

    assert result["embedding_available"] is False
    assert any("EMBEDDED_SUPERSET" in w for w in result["warnings"])


# disable_dashboard_embedding


@pytest.mark.asyncio
@pytest.mark.parametrize("name", ["Dani", "Ana", "Ada", "Root"])
async def test_who_edits_the_report_stops_embedding(
    world: dict[str, Any], name: str
) -> None:
    await embed(world, "https://a.example")
    as_user(world, name)
    result = await call(
        "disable_dashboard_embedding", {"dashboard": world["dashboard"].id}
    )

    assert result.get("error") is None, result
    assert result["changed"] is True
    assert result["embedded"] is False
    assert embedded_of(world) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("name, error", [("Vera", "Forbidden"), ("Carlos", "NotFound")])
async def test_others_do_not_stop_embedding(
    world: dict[str, Any], name: str, error: str
) -> None:
    await embed(world, "https://a.example")
    as_user(world, name)
    result = await call(
        "disable_dashboard_embedding", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == error
    assert embedded_of(world) is not None


@pytest.mark.asyncio
async def test_disabling_a_report_not_embedded_changes_nothing(
    world: dict[str, Any],
) -> None:
    as_user(world, "Dani")
    result = await call(
        "disable_dashboard_embedding", {"dashboard": world["dashboard"].id}
    )

    assert result["changed"] is False
    assert "The report was not embedded." in result["warnings"]


# create_embed_guest_token


@pytest.mark.asyncio
async def test_a_guest_token_names_the_embedded_report_and_its_rules(
    world: dict[str, Any], caplog: pytest.LogCaptureFixture
) -> None:
    embedded = await embed(world, "https://a.example")
    caplog.set_level(logging.INFO)
    result = await call(
        "create_embed_guest_token",
        {
            "dashboard": world["dashboard"].id,
            "rls": [{"clause": "region = 'Norte'", "dataset": world["ventas"].id}],
            "user": {"username": "visitante"},
        },
    )

    assert result.get("error") is None, result
    assert result["embedded_uuid"] == embedded["embedded_uuid"]
    assert result["header_name"] == "X-GuestToken"
    claims = jwt.decode(
        result["token"], SECRET, algorithms=["HS256"], audience="auradata"
    )
    assert claims["type"] == "guest"
    assert claims["resources"] == [
        {"type": "dashboard", "id": embedded["embedded_uuid"]}
    ]
    assert claims["rls_rules"] == [
        {"clause": "region = 'Norte'", "dataset": world["ventas"].id}
    ]
    assert claims["user"]["username"] == "visitante"
    assert "Guest token issued through the MCP" in caplog.text
    assert result["token"] not in caplog.text
    assert "Norte" not in caplog.text


@pytest.mark.asyncio
async def test_a_report_not_embedded_has_no_guest_token(world: dict[str, Any]) -> None:
    as_user(world, "Root")
    result = await call(
        "create_embed_guest_token", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == "NotEmbedded"
    assert result["token"] is None


@pytest.mark.asyncio
async def test_no_guest_token_while_the_installation_does_not_serve_it(
    world: dict[str, Any],
) -> None:
    await embed(world, "https://a.example")
    world["mocker"].patch(FLAG, return_value=False)
    result = await call(
        "create_embed_guest_token", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == "EmbeddingDisabled"
    assert result["token"] is None


@pytest.mark.asyncio
async def test_no_guest_token_for_a_report_you_cannot_open(
    world: dict[str, Any],
) -> None:
    await embed(world, "https://a.example")
    as_user(world, "Carlos")
    result = await call(
        "create_embed_guest_token", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == "NotFound"
    assert result["token"] is None


@pytest.mark.asyncio
async def test_no_guest_token_beyond_your_data(world: dict[str, Any]) -> None:
    """validate_guest_token_resources refuses what the minter cannot read."""
    await embed(world, "https://a.example")
    world["mocker"].patch.object(
        security_manager,
        "_raise_for_guest_token_datasource_access",
        side_effect=_denied,
    )
    result = await call(
        "create_embed_guest_token", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == "Forbidden"
    assert result["permission_denied"] is True
    assert result["token"] is None


@pytest.mark.asyncio
async def test_the_installation_hook_can_refuse_a_guest_token(
    world: dict[str, Any],
) -> None:
    await embed(world, "https://a.example")
    world["mocker"].patch.dict(
        current_app.config, {"GUEST_TOKEN_VALIDATOR_HOOK": lambda body: False}
    )
    result = await call(
        "create_embed_guest_token", {"dashboard": world["dashboard"].id}
    )

    assert result["error_type"] == "InvalidRequest"
    assert result["token"] is None


def test_the_assistant_never_offers_guest_tokens() -> None:
    from superset.auradata.assistant.tools import HIDDEN_TOOLS

    assert "create_embed_guest_token" in HIDDEN_TOOLS


def _denied(*args: Any, **kwargs: Any) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    raise SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
