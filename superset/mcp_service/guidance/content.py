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
"""The guidance an AI needs to build reports in AuraData BI's style.

Figures that the product already defines (palettes, fonts, page sizes, the
language, the format catalog) are read from the configuration and the layout
library, so this text cannot drift from what the app renders.
"""

from __future__ import annotations

from typing import Any

from flask import current_app, has_app_context

from superset import auradata_config
from superset.auradata import catalog
from superset.auradata.layout.grid import (
    CANVAS_PRESETS,
    CELL,
    DEFAULT_CANVAS_SIZE,
    DEFAULT_OBJECT_COLUMNS,
    DEFAULT_OBJECT_ROWS,
    MIN_CHART_COLUMNS,
    MIN_CHART_ROWS,
)

# Languages the guidance names when it tells the AI which one to write in.
LANGUAGE_NAMES = {"es": "Spanish", "en": "English"}

GRADIENT = "linear-gradient(100deg, #2563EB, #7C3AED, #10B981)"


def _config(key: str, default: Any) -> Any:
    """A configuration value, or the fork's default outside an app context."""
    if has_app_context():
        return current_app.config.get(key, default)
    return default


def default_language() -> str:
    """The language code reports are written in unless the user uses another."""
    locale = _config("BABEL_DEFAULT_LOCALE", auradata_config.BABEL_DEFAULT_LOCALE)
    return str(locale or "es").split("_")[0]


def language_name(code: str) -> str:
    """The English name of a language code, or the code itself."""
    return LANGUAGE_NAMES.get(code, code)


def language_rule() -> dict[str, str]:
    """Which language the AI writes titles, labels and replies in."""
    code = default_language()
    rule = {
        "default": code,
        "rule": "Write every title, label, page name and reply in the language "
        f"the user writes in; when unsure, use {language_name(code)}.",
    }
    if code == "es":
        rule["spanish_style"] = (
            "Neutral Latin American Spanish with informal «tú», «» quotes, "
            "sentence case (only the first word and proper names capitalized)."
        )
    return rule


def _palettes() -> list[dict[str, Any]]:
    schemes = _config(
        "EXTRA_CATEGORICAL_COLOR_SCHEMES",
        auradata_config.EXTRA_CATEGORICAL_COLOR_SCHEMES,
    )
    return [
        {
            "id": scheme.get("id"),
            "label": scheme.get("label"),
            "default": bool(scheme.get("isDefault")),
            "colors": list(scheme.get("colors") or []),
        }
        for scheme in schemes or []
        if isinstance(scheme, dict)
    ]


def _fonts() -> dict[str, str]:
    theme = _config("THEME_DEFAULT", auradata_config.THEME_DEFAULT) or {}
    tokens = theme.get("token", {}) if isinstance(theme, dict) else {}
    return {
        "text": str(tokens.get("fontFamily", "Outfit")),
        "data": str(tokens.get("fontFamilyCode", "'Geist Mono'")),
    }


def brand() -> dict[str, Any]:
    """The AuraData brand: names, colors, fonts, the gradient rule and tone."""
    return {
        "product": _config("APP_NAME", auradata_config.APP_NAME),
        "company": "AuraData (always capital A and D)",
        "guidelines": "https://auradata.mx/brand-guidelines",
        "colors": {
            "azul_aura": "#2563EB",
            "violet": "#7C3AED",
            "green": "#10B981",
            "text": "#0A0A0F",
            "secondary_text": "#666666",
            "border": "#E5E5E5",
            "page_background": "#FFFFFF",
            "usage": "Azul Aura is the main color: the first series, the accent "
            "and links. Violet and green are accents. Use the default «auradata» "
            "palette for categories; keep one color per meaning across a report.",
        },
        "fonts": {
            **_fonts(),
            "usage": "The app already renders text in Outfit and figures in Geist "
            "Mono; do not set other fonts unless the user asks.",
        },
        "gradient": {
            "css": GRADIENT,
            "rule": "Only as a headline accent (a title or a thin rule). Never as a "
            "chart fill, a page background, a card background or behind figures.",
        },
        "tone": "Clear, direct and concrete. Name things by what they measure. "
        "No hype, no emoji, no exclamation marks.",
        "palettes": _palettes(),
        "language": language_rule(),
    }


def _page_sizes() -> dict[str, dict[str, int]]:
    return {
        name: {
            "columns": width // CELL,
            "rows": height // CELL,
            "pixels_wide": width,
            "pixels_high": height,
        }
        for name, (width, height) in CANVAS_PRESETS.items()
    }


# A page of the default size (60 x 34 cells) built the recommended way: a
# 1-cell margin, 2 empty cells between objects, cards on top, the detail last.
STANDARD_PAGE = [
    {"what": "title (text element)", "x": 1, "y": 1, "width": 32, "height": 2},
    {"what": "slicer 1", "x": 35, "y": 1, "width": 11, "height": 2},
    {"what": "slicer 2", "x": 48, "y": 1, "width": 11, "height": 2},
    {"what": "card 1", "x": 1, "y": 5, "width": 13, "height": 5},
    {"what": "card 2", "x": 16, "y": 5, "width": 13, "height": 5},
    {"what": "card 3", "x": 31, "y": 5, "width": 13, "height": 5},
    {"what": "card 4", "x": 46, "y": 5, "width": 13, "height": 5},
    {"what": "main chart (trend)", "x": 1, "y": 12, "width": 28, "height": 10},
    {"what": "second chart (breakdown)", "x": 31, "y": 12, "width": 28, "height": 10},
    {"what": "detail (table or wide chart)", "x": 1, "y": 24, "width": 58, "height": 9},
]


def report_conventions() -> dict[str, Any]:
    """How a good AuraData BI report is laid out, named and formatted."""
    default_columns, default_rows = (
        CANVAS_PRESETS[DEFAULT_CANVAS_SIZE][0] // CELL,
        CANVAS_PRESETS[DEFAULT_CANVAS_SIZE][1] // CELL,
    )
    return {
        "model": [
            "A report is a dashboard; its tabs are pages of a fixed size, like "
            "Power BI pages. A phone shows the same page scaled unless the page "
            "has a mobile layout.",
            f"Pages are grids of square cells of {CELL} px. Every x, y, width and "
            "height is in cells from the page's top-left corner.",
            "Objects never get gaps or margins automatically: leave empty cells "
            "yourself.",
        ],
        "page": {
            "default_size": DEFAULT_CANVAS_SIZE,
            "sizes": _page_sizes(),
            "margin": "Leave 1 empty cell around the page edge.",
            "gap": "Leave 2 empty cells between neighbouring objects, the same on "
            "the whole page (on 60 columns: 4 cards of 13, 3 charts of 18 or 2 of "
            "28).",
            "smallest_chart": {"width": MIN_CHART_COLUMNS, "height": MIN_CHART_ROWS},
            "default_object": {
                "width": DEFAULT_OBJECT_COLUMNS,
                "height": DEFAULT_OBJECT_ROWS,
            },
            "standard_layout": {
                "size": f"{default_columns} x {default_rows} cells",
                "objects": STANDARD_PAGE,
            },
        },
        "hierarchy": [
            "One idea per page: a page answers one question (overview, trend, "
            "detail of one area). Split anything else into another page.",
            "Read order is top-left to bottom-right: title, KPI cards, the main "
            "chart, then breakdowns, then the detail table at the bottom.",
            "3 to 5 KPI cards in one row at the top, all the same size.",
            "At most 6 to 8 visuals per page.",
            "Slicers go in a row at the top right or in a column on the left, in "
            "the same place on every page; sync them across pages instead of "
            "adding different ones per page.",
            "Objects of one row share the same height; siblings share the same "
            "width. Align and distribute them on the grid.",
            "Pick the chart by the question: a line for change over time, bars "
            "for comparing categories (sorted by value), a card for one number, "
            "a table for detail, a donut only for 2 to 5 parts of a whole.",
            "Keep the page background white and the chart backgrounds plain; use "
            "color for meaning, not decoration.",
        ],
        "naming": [
            "Report title: what it covers, e.g. «Ventas 2026», not «Dashboard de "
            "ventas».",
            "Page names: one or two words, e.g. «Resumen», «Tendencia», «Detalle».",
            "Chart titles say the measure and the cut, e.g. «Ventas por región»; "
            "add the unit when it is not obvious, e.g. «Ingresos (MXN)».",
            "Use the column labels (verbose names), never raw names such as "
            "total_amt; give the dataset columns labels when they are missing.",
        ],
        "numbers": {
            "separators": "Thousands with a comma and decimals with a point "
            "(1,234.56), as the app renders them.",
            "formats": {
                "large numbers": "SMART_NUMBER (1.2k, 3.4M) on cards and axes",
                "amounts": ",.2f, or $,.2f for money",
                "integers": ",d",
                "percentages": ".1%",
                "dates": "%d/%m/%Y for days, %b %Y for months",
            },
            "rule": "Use the same format for the same measure everywhere in the "
            "report; month and day names follow the app's language.",
        },
        "language": language_rule(),
        "check": "After building, look at every page with get_dashboard_screenshot "
        "and fix overlaps, cut labels, empty charts and uneven sizes.",
    }


def format_catalog_summary() -> dict[str, Any]:
    """What the format tools can change, read from the format catalog."""
    data = catalog.load_catalog()
    return {
        "how": [
            "get_format_options(viz_type=..., level=...) lists the keys, types and "
            "choices of one chart type and level; element=<kind> lists those of a "
            "design element. Read it before formatting.",
            "format_visual(object, level, patch) changes one object; "
            "set_shared_visual_format sets the style every chart shares; "
            "copy_format repeats one object's look on others.",
            "set_canvas_format sets the page size, background and the colors of "
            "the filter pane and page bar.",
            "Formats live in the report layout, so they save, undo and export "
            "with the dashboard.",
        ],
        "levels": {
            catalog.VISUAL: "Look of the chart itself: labels, legend, axes, "
            "series colors, data labels, conditional formatting.",
            catalog.GENERAL: "The box around any object: title, background, "
            "border, shadow, padding, header icons, tooltips.",
            catalog.ANALYTICS: "Reference lines, trend lines, zoom and extra "
            "tooltip fields.",
        },
        "chart_types": sorted(data.get("charts", {})),
        "general_settings": sorted(data.get("general", {})),
        "elements": sorted(data.get("elements", {})),
        "own_chart_settings": "Settings tied to one chart (targets, labels, "
        "category mappings) stay out of copy_format and the shared style.",
    }
