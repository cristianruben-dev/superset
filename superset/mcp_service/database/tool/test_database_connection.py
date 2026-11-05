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
Test an existing database connection (FastMCP tool).

The test runs on the server with the connection's stored credentials, through
the same command as the web's "Test connection" button. Credentials never pass
through the conversation: an admin creates and edits connections in the web.
"""

import logging
from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset import security_manager
from superset.extensions import event_logger
from superset.mcp_service.database.schemas import (
    SECRET_MASK,
    TestDatabaseConnectionRequest,
    TestDatabaseConnectionResponse,
)

logger = logging.getLogger(__name__)

CONNECTIONS_PATH = "/databaseview/list/"


def connections_url() -> str:
    """The web's Connections page, where admins manage connections."""
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    return f"{get_superset_base_url()}{CONNECTIONS_PATH}"


def can_test_connections() -> bool:
    """Whether the user may test connections, as the REST endpoint requires."""
    return security_manager.is_admin() or bool(
        security_manager.can_access("can_write", "Database")
    )


def connection_properties(database: Any) -> dict[str, Any]:
    """
    The web's test request for a stored connection: the masked URI and extra
    secrets, which the command swaps back for the stored ones on the server.
    """
    from superset.utils.ssh_tunnel import mask_password_info

    properties: dict[str, Any] = {
        "database_name": database.database_name,
        "sqlalchemy_uri": database.safe_sqlalchemy_uri(),
        "extra": database.extra or "{}",
        "impersonate_user": bool(database.impersonate_user),
        "server_cert": database.server_cert or "",
        "masked_encrypted_extra": database.masked_encrypted_extra or "{}",
    }
    if tunnel := getattr(database, "ssh_tunnel", None):
        properties["ssh_tunnel"] = mask_password_info(dict(tunnel.data))
    return properties


def scrub(message: str, database: Any) -> str:
    """Remove the connection's password and full URI from a message."""
    secrets = [database.sqlalchemy_uri_decrypted, database.password]
    for secret in secrets:
        if secret and len(secret) > 2:
            message = message.replace(secret, SECRET_MASK)
    return message


def failure_message(exc: Exception) -> str:
    """The readable reason of a failed test, from the command's exception."""
    from superset.exceptions import (
        SupersetErrorException,
        SupersetErrorsException,
        SupersetException,
    )

    if isinstance(exc, SupersetErrorsException) and exc.errors:
        return " ".join(error.message for error in exc.errors if error.message)
    if isinstance(exc, SupersetErrorException):
        return exc.error.message
    if isinstance(exc, SupersetException) and exc.message:
        return str(exc.message)
    return f"The connection test failed ({type(exc).__name__})."


@tool(
    tags=["discovery"],
    class_permission_name="Database",
    # The REST test_connection endpoint is a write route, so only those who
    # manage connections (admins) may run it.
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Test database connection",
        readOnlyHint=True,
        destructiveHint=False,
        openWorldHint=False,
    ),
)
async def test_database_connection(
    request: TestDatabaseConnectionRequest, ctx: Context
) -> TestDatabaseConnectionResponse:
    """Test an existing database connection with its stored credentials.

    Runs the web's "Test connection" on the server: the database is reached with
    the settings an admin saved, and only the outcome comes back, never a
    password or URI. Only users who manage connections (admins) can test them.

    This tool cannot create or edit connections: database credentials never
    pass through the chat. To add a connection, send the user to the
    Connections page of the web (``connections_url`` in the response).

    Example usage:
    ```json
    {"database_id": 1}
    ```
    """
    await ctx.info(
        "Testing database connection: database_id=%s" % (request.database_id,)
    )
    url = connections_url()

    if not can_test_connections():
        await ctx.warning("Database connection test forbidden")
        return TestDatabaseConnectionResponse(
            database_id=request.database_id,
            error="Only users who manage database connections (admins) can "
            "test them. Ask an admin, who can do it on the Connections page.",
            error_type="Forbidden",
            connections_url=url,
        )

    from superset.commands.database.test_connection import (
        TestConnectionDatabaseCommand,
    )
    from superset.daos.database import DatabaseDAO
    from superset.exceptions import OAuth2RedirectError

    database = DatabaseDAO.find_by_id(request.database_id)
    if database is None:
        await ctx.warning("Database not found: %s" % (request.database_id,))
        return TestDatabaseConnectionResponse(
            database_id=request.database_id,
            error=f"No database connection with ID {request.database_id}. "
            "Use list_databases to find one.",
            error_type="NotFound",
            connections_url=url,
        )

    response = TestDatabaseConnectionResponse(
        database_id=database.id,
        database_name=database.database_name,
        backend=database.backend,
        connections_url=url,
    )
    try:
        with event_logger.log_context(action="mcp.test_database_connection"):
            TestConnectionDatabaseCommand(connection_properties(database)).run()
    except OAuth2RedirectError:
        response.ok = True
        response.message = (
            "The connection works; each user signs in to the database with "
            "OAuth the first time they query it."
        )
        return response
    except Exception as exc:  # pylint: disable=broad-except
        logger.info("Database connection test failed", exc_info=True)
        response.error = scrub(failure_message(exc), database)
        response.error_type = "ConnectionFailed"
        await ctx.warning("Database connection test failed: %s" % (response.error,))
        return response

    response.ok = True
    response.message = "The database answered: the connection works."
    await ctx.info("Database connection OK: database_id=%s" % (database.id,))
    return response
