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
The sites that may frame an embedded report are the report's own allowed domains.

The browser lets a page into an iframe by its ``frame-ancestors`` directive. The
policy of the app is fixed (``'self'``), so the embedded page of a report replaces
that one directive with the origins its embedding allows: adding a site is a
change to the report (in the web or through the MCP), never to the deployment, and
a report only goes into the sites named for it.
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from flask import Flask, g, Response

CSP_HEADER = "Content-Security-Policy"

# A host name, an IPv4 address or an IPv6 address (urlparse lowercases it)
_HOST = re.compile(r"[a-z0-9.-]+|[0-9a-f:.]+")

#: Set by the embedded view for its own response only
_FRAME_ANCESTORS = "auradata_frame_ancestors"


def csp_source(domain: str) -> str | None:
    """
    An allowed domain as a CSP source (``https://host[:port]``), or None when it
    is not a plain site origin. Nothing but a scheme, a host and a port gets into
    the header, so a stored value can never add a directive of its own.
    """
    value = domain.strip()
    try:
        parsed = urlparse(value)
        port = parsed.port
    except ValueError:
        return None
    host = parsed.hostname
    if (
        parsed.scheme not in ("http", "https")
        or not host
        or parsed.username
        or parsed.password
        or parsed.path not in ("", "/")
        or parsed.params
        or parsed.query
        or parsed.fragment
        or not _HOST.fullmatch(host)
    ):
        return None
    if ":" in host:
        host = f"[{host}]"
    return f"{parsed.scheme}://{host}" + (f":{port}" if port else "")


def frame_ancestors(allowed_domains: list[str] | None) -> str:
    """
    The ``frame-ancestors`` sources of a report: itself plus its allowed domains,
    or any site when it names none (an embedding with no domains lets any site
    in, as its view does).
    """
    if not allowed_domains:
        return "*"
    sources = ["'self'"]
    for domain in allowed_domains:
        if (source := csp_source(domain)) and source not in sources:
            sources.append(source)
    return " ".join(sources)


def allow_framing_by(allowed_domains: list[str] | None) -> None:
    """Let the sites of an embedding frame the response of this request."""
    setattr(g, _FRAME_ANCESTORS, frame_ancestors(allowed_domains))


def with_frame_ancestors(policy: str, sources: str) -> str:
    """``policy`` with its ``frame-ancestors`` directive set to ``sources``."""
    directives = [
        part.strip()
        for part in policy.split(";")
        if part.strip() and part.strip().split()[0].lower() != "frame-ancestors"
    ]
    directives.append(f"frame-ancestors {sources}")
    return "; ".join(directives)


def _apply(response: Response) -> Response:
    sources = g.get(_FRAME_ANCESTORS)
    if sources is None:
        return response
    response.headers[CSP_HEADER] = with_frame_ancestors(
        response.headers.get(CSP_HEADER, ""), sources
    )
    # frame-ancestors decides; an older X-Frame-Options would still say no
    response.headers.pop("X-Frame-Options", None)
    return response


def init_app(app: Flask) -> None:
    """
    Register the hook before Talisman: Flask runs ``after_request`` functions in
    the reverse order of registration, so this one runs after Talisman writes its
    policy and replaces only the directive it owns.
    """
    app.after_request(_apply)
