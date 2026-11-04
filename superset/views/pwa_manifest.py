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
PWA web app manifest served dynamically.

`APPLICATION_ROOT` and `STATIC_ASSETS_PREFIX` are resolved at request
time so PWA install works under root, subdirectory, and split
static-prefix / app-root deployments. Replaces the static
`superset-frontend/src/pwa-manifest.json` whose hard-coded `/superset/`
literals broke install under non-`/superset` deployments (C5 in PR #39925).
"""

from __future__ import annotations

from typing import Any

from flask import current_app, Response
from flask_appbuilder import expose

from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.base import BaseSupersetView

_MANIFEST_MIMETYPE = "application/manifest+json"
_MANIFEST_CACHE_CONTROL = "public, max-age=0, must-revalidate"


def _normalize_app_root(application_root: str) -> str:
    """Collapse trailing slash so `f"{root}/path"` never doubles the separator.

    `/` and empty string both become empty (the leading `/` of each path is
    preserved exactly once); `/superset` and `/superset/` both become
    `/superset`.
    """
    stripped = application_root.rstrip("/")
    # `/` rstrip yields empty; that's what we want for root deployments.
    return stripped


#: AuraData BI brand colors: the page background and Azul Aura.
_BACKGROUND_COLOR = "#F5F5F5"
_THEME_COLOR = "#2563EB"


def _build_manifest(
    application_root: str,
    static_assets_prefix: str,
    app_name: str = "AuraData BI",
) -> dict[str, Any]:
    """Return the PWA manifest dict for the given prefix configuration.

    `start_url`, `scope`, and `file_handlers[].action` are app-root-prefixed
    (and literal-corrected from the legacy `/superset/...` form).
    `icons[].src` are static-prefixed (which may be a separate CDN host).

    AuraData BI: the app is named after `APP_NAME`, described in Spanish (the
    product's first language) and drawn with the AuraData icons, whose maskable
    version is a separate file with the safe-zone padding. Superset's
    screenshots are not shipped.
    """
    root = _normalize_app_root(application_root)
    static_prefix = static_assets_prefix.rstrip("/")
    icons = f"{static_prefix}/static/assets/images/pwa"
    return {
        "name": app_name,
        "short_name": app_name,
        "description": f"Paneles e informes de {app_name}",
        "start_url": f"{root}/welcome/",
        "scope": f"{root}/",
        "display": "standalone",
        "background_color": _BACKGROUND_COLOR,
        "theme_color": _THEME_COLOR,
        "icons": [
            {
                "src": f"{icons}/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": f"{icons}/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any",
            },
            {
                "src": f"{icons}/icon-maskable-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "maskable",
            },
        ],
        "file_handlers": [
            {
                "action": f"{root}/file-handler",
                "accept": {
                    "text/csv": [".csv"],
                    "application/vnd.ms-excel": [".xls"],
                    "application/vnd.openxmlformats-officedocument."
                    "spreadsheetml.sheet": [".xlsx"],
                    "application/vnd.apache.parquet": [".parquet"],
                },
            }
        ],
    }


class PwaManifestView(BaseSupersetView):
    """Serve the PWA web app manifest with deployment-aware prefixes.

    Unauthenticated (PWA install fetch has no session); mirrors the
    `RedirectView` precedent (`superset/views/redirect.py`).
    """

    route_base = ""

    @expose("/pwa-manifest.json")
    def manifest(self) -> FlaskResponse:
        application_root = current_app.config["APPLICATION_ROOT"]
        # `STATIC_ASSETS_PREFIX` defaults to `""`; under subdir, `app.py`
        # backfills it with `app_root` unless the operator set a CDN host.
        # We mirror that fallback so root deployments produce `/static/...`
        # rather than `/static/...` with an empty prefix gap.
        static_assets_prefix = (
            current_app.config["STATIC_ASSETS_PREFIX"] or application_root
        )
        manifest = _build_manifest(
            application_root,
            static_assets_prefix,
            current_app.config.get("APP_NAME") or "AuraData BI",
        )
        return Response(
            json.dumps(manifest, separators=(",", ":")),
            mimetype=_MANIFEST_MIMETYPE,
            headers={"Cache-Control": _MANIFEST_CACHE_CONTROL},
        )
