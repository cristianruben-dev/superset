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
"""The sites a report allows are the ones that may frame its embedded page."""

import pytest
from flask import Flask
from flask_talisman import Talisman

from superset.auradata import embed_frames
from superset.auradata.embed_frames import (
    allow_framing_by,
    csp_source,
    frame_ancestors,
    with_frame_ancestors,
)


@pytest.mark.parametrize(
    ("domain", "source"),
    [
        ("https://intranet.example.com", "https://intranet.example.com"),
        ("https://Intranet.Example.com/", "https://intranet.example.com"),
        ("http://localhost:8999", "http://localhost:8999"),
        ("  https://a.mx  ", "https://a.mx"),
        ("https://[::1]:8443", "https://[::1]:8443"),
        # Anything but a site origin never reaches the header
        ("intranet.example.com", None),
        ("https://a.mx/report", None),
        ("https://a.mx?x=1", None),
        ("javascript:alert(1)", None),
        ("https://a.mx; script-src *", None),
        ("https://a.mx 'unsafe-inline'", None),
        ("https://user:pass@a.mx", None),
        ("https://*.a.mx", None),
        ("https://a.mx:99999", None),
        ("", None),
    ],
)
def test_csp_source_keeps_only_site_origins(domain: str, source: str | None) -> None:
    assert csp_source(domain) == source


def test_frame_ancestors_are_the_report_and_its_sites() -> None:
    assert (
        frame_ancestors(["https://a.mx", "https://A.mx/", "nonsense", "https://b.mx"])
        == "'self' https://a.mx https://b.mx"
    )


def test_an_embedding_without_sites_lets_any_site_frame_it() -> None:
    assert frame_ancestors([]) == "*"
    assert frame_ancestors(None) == "*"


def test_only_the_frame_ancestors_directive_changes() -> None:
    policy = "default-src 'self'; frame-ancestors 'self'; img-src data:"
    assert (
        with_frame_ancestors(policy, "'self' https://a.mx")
        == "default-src 'self'; img-src data:; frame-ancestors 'self' https://a.mx"
    )
    assert with_frame_ancestors("", "*") == "frame-ancestors *"


@pytest.fixture
def app() -> Flask:
    """An app with the hook registered before Talisman, as Superset does."""
    app = Flask(__name__)
    embed_frames.init_app(app)
    Talisman(
        app,
        force_https=False,
        content_security_policy={
            "default-src": "'self'",
            "frame-ancestors": "'self'",
        },
    )

    @app.route("/embedded")
    def embedded() -> str:
        allow_framing_by(["https://a.mx", "https://b.mx"])
        return "report"

    @app.route("/embedded-anywhere")
    def embedded_anywhere() -> str:
        allow_framing_by([])
        return "report"

    @app.route("/other")
    def other() -> str:
        return "page"

    return app


def test_an_embedded_report_lets_its_sites_frame_it(app: Flask) -> None:
    response = app.test_client().get("/embedded")
    policy = response.headers["Content-Security-Policy"]
    assert "frame-ancestors 'self' https://a.mx https://b.mx" in policy
    assert "default-src 'self'" in policy
    assert policy.count("frame-ancestors") == 1
    assert "X-Frame-Options" not in response.headers


def test_an_embedding_without_sites_is_framed_anywhere(app: Flask) -> None:
    response = app.test_client().get("/embedded-anywhere")
    assert "frame-ancestors *" in response.headers["Content-Security-Policy"]


def test_every_other_page_keeps_the_app_policy(app: Flask) -> None:
    response = app.test_client().get("/other")
    assert "frame-ancestors 'self'" in response.headers["Content-Security-Policy"]
    assert "https://a.mx" not in response.headers["Content-Security-Policy"]
    assert response.headers["X-Frame-Options"] == "SAMEORIGIN"
