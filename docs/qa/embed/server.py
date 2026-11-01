#!/usr/bin/env python3
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
Host page for testing embedded AuraData BI dashboards.

Serves ``index.html`` and a ``/guest-token`` endpoint that signs in to the
AuraData BI backend as admin and mints a guest token, the way a customer's own
backend would. Development only: never expose it.

    python3 docs/qa/embed/server.py            # http://localhost:8787
    SUPERSET_URL=http://localhost:8188 python3 docs/qa/embed/server.py
"""
from __future__ import annotations

import http.cookiejar
import json  # noqa: TID251 - standalone script, runs without Superset installed
import os
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

SUPERSET_URL = os.environ.get("SUPERSET_URL", "http://localhost:8188")
ADMIN = (
    os.environ.get("ADMIN_USERNAME", "admin"),
    os.environ.get("ADMIN_PASSWORD", "admin"),
)
PORT = int(os.environ.get("PORT", "8787"))
HERE = os.path.dirname(os.path.abspath(__file__))


def _request(
    opener: urllib.request.OpenerDirector,
    method: str,
    path: str,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Send a JSON request to the AuraData BI backend and return the JSON reply."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(  # noqa: S310 - SUPERSET_URL is an http(s) URL
        SUPERSET_URL + path,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method=method,
    )
    with opener.open(req, timeout=60) as resp:
        return json.loads(resp.read())


def guest_token(
    uuid: str, rls: list[dict[str, str]], user: dict[str, str]
) -> dict[str, Any]:
    """Sign in as admin (JWT and CSRF token on one session) and mint a guest token."""
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
    )
    login = _request(
        opener,
        "POST",
        "/api/v1/security/login",
        {
            "username": ADMIN[0],
            "password": ADMIN[1],
            "provider": "db",
            "refresh": False,
        },
    )
    auth = {"Authorization": f"Bearer {login['access_token']}"}
    csrf = _request(opener, "GET", "/api/v1/security/csrf_token/", headers=auth)
    return _request(
        opener,
        "POST",
        "/api/v1/security/guest_token/",
        {"user": user, "resources": [{"type": "dashboard", "id": uuid}], "rls": rls},
        headers={**auth, "X-CSRFToken": csrf["result"], "Referer": SUPERSET_URL + "/"},
    )


class Handler(SimpleHTTPRequestHandler):
    """Serves the host page and answers ``/guest-token``."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=HERE, **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        url = urllib.parse.urlparse(self.path)
        if url.path != "/guest-token":
            super().do_GET()
            return
        q = urllib.parse.parse_qs(url.query)
        uuid = (q.get("uuid") or [""])[0]
        rls = [{"clause": c} for c in q.get("rls", []) if c]
        user = {
            "username": (q.get("user") or ["invitado"])[0],
            "first_name": "Invitado",
            "last_name": "Embebido",
        }
        try:
            payload = guest_token(uuid, rls, user)
            status = 200
        except urllib.error.HTTPError as exc:
            payload = {
                "error": exc.code,
                "detail": exc.read().decode(errors="replace"),
            }
            status = exc.code
        except Exception as exc:  # noqa: BLE001
            payload = {"error": str(exc)}
            status = 500
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: Any) -> None:  # quieter
        if "/guest-token" in (args[0] if args else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    print(f"Embed host on http://localhost:{PORT} -> {SUPERSET_URL}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
