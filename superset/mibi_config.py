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
Mi BI defaults: branding, theme, languages, chart palettes and hidden chart types.

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

APP_NAME = "Mi BI"
APP_ICON = "/static/assets/images/mibi/logo.svg"
FAVICONS = [{"href": "/static/assets/images/mibi/favicon.svg", "type": "image/svg+xml"}]
# The navbar's "Powered by Apache Superset" watermark
MIBI_SHOW_POWERED_BY = False

# --- Charts -----------------------------------------------------------------
# Every chart belongs to at most one dashboard, as in Power BI, instead of being a
# standalone object that several dashboards reuse.
# See superset/mibi/single_dashboard.py.

MIBI_SINGLE_DASHBOARD_CHARTS = True

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
    "brandLogoAlt": APP_NAME,
    "brandLogoUrl": APP_ICON,
    "brandLogoHref": "/dashboard/list/",
    "brandLogoHeight": "24px",
    "brandLogoMargin": "16px 0",
    "brandIconMaxWidth": 120,
    "fontUrls": [
        "https://fonts.googleapis.com/css2?family=Geist:wght@300..700"
        "&family=Geist+Mono:wght@400..600&display=swap",
    ],
    "fontFamily": "Geist, Inter, -apple-system, 'Segoe UI', sans-serif",
    "fontFamilyCode": "'Geist Mono', 'IBM Plex Mono', monospace",
    "fontSize": 14,
    "fontWeightNormal": "400",
    "fontWeightStrong": "600",
    "borderRadius": 8,
    "borderRadiusLG": 12,
    "borderRadiusSM": 6,
    "controlHeight": 34,
    "transitionTiming": 0.18,
}

THEME_DEFAULT: Theme = {
    "token": {
        **_BASE_TOKENS,
        "colorPrimary": "#5B5BD6",
        "colorLink": "#5B5BD6",
        "colorInfo": "#5B5BD6",
        "colorSuccess": "#16A34A",
        "colorWarning": "#D97706",
        "colorError": "#DC2626",
        "colorBgLayout": "#F8F8FA",
        "colorBgContainer": "#FFFFFF",
        "colorBgElevated": "#FFFFFF",
        "colorBorder": "#E4E4E9",
        "colorBorderSecondary": "#EEEEF1",
        "colorText": "#0A0A0F",
        "colorTextSecondary": "#55555F",
        "colorTextTertiary": "#8C8C96",
        "colorFillSecondary": "#F3F3F6",
        "colorEditorSelection": "#E6E6FB",
        "boxShadow": (
            "0 1px 2px rgba(10, 10, 15, 0.04), 0 8px 24px -12px rgba(10, 10, 15, 0.10)"
        ),
        "boxShadowSecondary": (
            "0 16px 40px -12px rgba(10, 10, 15, 0.18), 0 2px 6px rgba(10, 10, 15, 0.05)"
        ),
    },
    "algorithm": "default",
}

THEME_DARK: Theme = {
    "token": {
        **_BASE_TOKENS,
        "brandLogoUrl": "/static/assets/images/mibi/logo-dark.svg",
        "colorPrimary": "#8B8DF7",
        "colorLink": "#8B8DF7",
        "colorInfo": "#8B8DF7",
        "colorSuccess": "#3DD68C",
        "colorWarning": "#F5B544",
        "colorError": "#F87171",
        "colorBgLayout": "#09090B",
        "colorBgContainer": "#111114",
        "colorBgElevated": "#18181C",
        "colorBorder": "#27272D",
        "colorBorderSecondary": "#1E1E23",
        "colorText": "#F4F4F6",
        "colorTextSecondary": "#A1A1AB",
        "colorTextTertiary": "#71717B",
        "colorFillSecondary": "#1C1C21",
        "colorEditorSelection": "#2A2A55",
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
# "mibi" is the default; each dashboard can pick another one.

EXTRA_CATEGORICAL_COLOR_SCHEMES: list[dict[str, Any]] = [
    {
        "id": "mibi",
        "label": "Mi BI",
        "isDefault": True,
        "colors": [
            "#5B5BD6",
            "#22B8CF",
            "#F59E0B",
            "#EC4899",
            "#10B981",
            "#8B5CF6",
            "#F97316",
            "#0EA5E9",
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
