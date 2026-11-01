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
AuraData BI defaults: branding, theme, languages, chart palettes and hidden chart types.

The brand follows the AuraData guidelines (https://auradata.mx/brand-guidelines):
the Continua logo, Outfit with Geist Mono for data, and the Aura blue, violet and
green accents over neutral surfaces.

Imported at the end of superset/config.py (before the superset_config override), so a
deployment can still override any of these values. Kept in its own module so rebasing
the fork onto new Superset releases only touches one line of config.py.

Colors live in the theme tokens; the global stylesheet
(superset-frontend/src/assets/mibi/skin.css) only handles structure, spacing and type,
so light/dark mode and per-dashboard themes keep working.
"""

from typing import Any

from superset.themes.types import Theme

# --- Branding ---------------------------------------------------------------

APP_NAME = "AuraData BI"
APP_ICON = "/static/assets/images/auradata/logo.svg"
FAVICONS = [
    {
        "href": "/static/assets/images/auradata/favicon-32.png",
        "sizes": "32x32",
        "type": "image/png",
    },
    {
        "href": "/static/assets/images/auradata/favicon-16.png",
        "sizes": "16x16",
        "type": "image/png",
    },
    {
        "href": "/static/assets/images/auradata/apple-touch-icon.png",
        "rel": "apple-touch-icon",
        "sizes": "180x180",
        "type": "image/png",
    },
]
# The navbar's "Powered by Apache Superset" watermark
MIBI_SHOW_POWERED_BY = False

# --- Charts -----------------------------------------------------------------
# Every chart belongs to at most one dashboard, as in Power BI, instead of being a
# standalone object that several dashboards reuse.
# See superset/mibi/single_dashboard.py.

MIBI_SINGLE_DASHBOARD_CHARTS = True

# --- Workspaces ---------------------------------------------------------------
# Dashboards inside a workspace are only for its members (viewers, contributors and
# admins) and their owners; contributors and admins edit them. With False,
# workspaces only group dashboards. See superset/mibi/workspace_access.py.

MIBI_WORKSPACE_ACCESS = True

# --- Databases --------------------------------------------------------------
# Presto is not offered, but its engine spec stays: Hive, Spark and Databricks
# build on it. The Hive driver (pyhive) also registers the Presto dialect, so it
# is hidden from the "Connect a database" list here.

DBS_AVAILABLE_DENYLIST: dict[str, set[str | None]] = {"presto": {None}}

# --- Languages --------------------------------------------------------------
# The navbar shows a language selector when there is more than one language.
# Languages other than English need BUILD_TRANSLATIONS=true in the Docker build.

BABEL_DEFAULT_LOCALE = "es"
LANGUAGES = {
    "es": {"flag": "es", "name": "Español"},
    "en": {"flag": "us", "name": "English"},
}

# --- Theme ------------------------------------------------------------------

_BASE_TOKENS: dict[str, Any] = {
    "brandAppName": APP_NAME,
    "brandLogoAlt": "AuraData",
    "brandLogoUrl": APP_ICON,
    "brandLogoHref": "/dashboard/list/",
    "brandLogoHeight": "26px",
    "brandLogoMargin": "16px 0",
    "brandIconMaxWidth": 120,
    "fontUrls": [
        "https://fonts.googleapis.com/css2?family=Outfit:wght@300..700"
        "&family=Geist+Mono:wght@400..600&display=swap",
    ],
    "fontFamily": "Outfit, -apple-system, 'Segoe UI', sans-serif",
    "fontFamilyCode": "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
    "fontSize": 14,
    "fontWeightNormal": "400",
    "fontWeightStrong": "600",
    "borderRadius": 8,
    "borderRadiusLG": 14,
    "borderRadiusSM": 6,
    "controlHeight": 34,
    "transitionTiming": 0.18,
    # The ease of auradata.mx: quick start, long soft landing
    "motionEaseOut": "cubic-bezier(0.32, 0.72, 0, 1)",
}

THEME_DEFAULT: Theme = {
    "token": {
        **_BASE_TOKENS,
        # Azul Aura; violet and green are accents of the skin and the palette
        "colorPrimary": "#2563EB",
        "colorLink": "#2563EB",
        "colorInfo": "#2563EB",
        "colorSuccess": "#059669",
        "colorWarning": "#D97706",
        "colorError": "#DC2626",
        "colorBgLayout": "#F5F5F5",
        "colorBgContainer": "#FFFFFF",
        "colorBgElevated": "#FFFFFF",
        "colorBorder": "#E5E5E5",
        "colorBorderSecondary": "#EDEDED",
        "colorText": "#0A0A0F",
        "colorTextSecondary": "#666666",
        # Darker than the site's #9B9B9B so small labels stay readable (4.7:1)
        "colorTextTertiary": "#737373",
        "colorFillSecondary": "#F5F5F5",
        "colorEditorSelection": "#DBEAFE",
        "boxShadow": (
            "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.08)"
        ),
        "boxShadowSecondary": (
            "0 1px 2px rgba(0, 0, 0, 0.04), 0 24px 48px -16px rgba(15, 23, 42, 0.18)"
        ),
    },
    "algorithm": "default",
}

THEME_DARK: Theme = {
    "token": {
        **_BASE_TOKENS,
        "brandLogoUrl": "/static/assets/images/auradata/logo-dark.svg",
        # A lighter Azul Aura that reads on the night background (5.4:1)
        "colorPrimary": "#3B82F6",
        "colorLink": "#60A5FA",
        "colorInfo": "#3B82F6",
        "colorSuccess": "#34D399",
        "colorWarning": "#F5B544",
        "colorError": "#F87171",
        "colorBgLayout": "#0A0A0F",
        "colorBgContainer": "#111117",
        "colorBgElevated": "#191921",
        "colorBorder": "#26262F",
        "colorBorderSecondary": "#1D1D25",
        "colorText": "#F5F5F7",
        "colorTextSecondary": "#A3A3AD",
        "colorTextTertiary": "#8B8B96",
        "colorFillSecondary": "#1C1C24",
        "colorEditorSelection": "#1E3A8A",
        "boxShadow": "0 1px 2px rgba(0, 0, 0, 0.4)",
        "boxShadowSecondary": (
            "0 16px 40px -12px rgba(0, 0, 0, 0.7), 0 2px 6px rgba(0, 0, 0, 0.4)"
        ),
    },
    "algorithm": "dark",
}

# --- Chart types ------------------------------------------------------------
# Hidden from the chart gallery: the ones Superset marks as deprecated
# (Bubble Chart (legacy) and Time-series Percent Change).

VIZ_TYPE_DENYLIST: list[str] = ["bubble", "compare"]

# --- Chart palettes ---------------------------------------------------------
# "AuraData" is the default; each dashboard can pick another one. Its id stays
# "mibi" because saved dashboards refer to their palette by id.

EXTRA_CATEGORICAL_COLOR_SCHEMES: list[dict[str, Any]] = [
    {
        "id": "mibi",
        "label": "AuraData",
        "isDefault": True,
        "colors": [
            "#2563EB",
            "#7C3AED",
            "#10B981",
            "#F59E0B",
            "#EC4899",
            "#06B6D4",
            "#F97316",
            "#64748B",
        ],
    },
    {
        "id": "aura_suave",
        "label": "Aura suave",
        "colors": [
            "#93C5FD",
            "#C4B5FD",
            "#6EE7B7",
            "#FCD34D",
            "#F9A8D4",
            "#67E8F9",
            "#FDBA74",
            "#CBD5E1",
        ],
    },
    {
        "id": "corporativo",
        "label": "Corporativo",
        "colors": [
            "#1E3A8A",
            "#3B82F6",
            "#94A3B8",
            "#0EA5E9",
            "#64748B",
            "#1D4ED8",
            "#CBD5E1",
        ],
    },
    {
        "id": "neon",
        "label": "Neón",
        "colors": [
            "#F72585",
            "#4CC9F0",
            "#B5179E",
            "#7209B7",
            "#4361EE",
            "#3A0CA3",
            "#4895EF",
        ],
    },
    {
        "id": "fresco",
        "label": "Fresco",
        "colors": [
            "#10B981",
            "#F59E0B",
            "#14B8A6",
            "#F97316",
            "#84CC16",
            "#06B6D4",
            "#FB7185",
        ],
    },
]
