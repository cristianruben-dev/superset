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
Design elements of a report (``src/auradata/elements``): the meta of a new
element as the editor's "Design elements" draggers make it, and the checks of
their settings against the descriptors the format catalog carries.
"""

from __future__ import annotations

import copy
import re
from html.parser import HTMLParser
from typing import Any

from superset.auradata import catalog
from superset.auradata.layout import keys
from superset.auradata.layout._js import is_number
from superset.auradata.layout.format_patch import (
    check_settings,
    FormatPatchError,
    is_safe_url,
    is_site_image,
    ReportRefs,
)

# What newComponentFactory gives every DYNAMIC component
BACKGROUND_TRANSPARENT = "BACKGROUND_TRANSPARENT"

# Settings the tools manage themselves: the filter a slicer shows and the
# uploaded picture of an image
MANAGED_SETTINGS = frozenset({"kind", "filterId", "imageId"})

# The label of a new button (t('Button') in the editor)
DEFAULT_BUTTON_LABEL = "Button"

_CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE | re.DOTALL)
_CSS_IMAGE_SET = re.compile(r"image-set\s*\(", re.IGNORECASE)


def new_element_meta(kind: str) -> dict[str, Any]:
    """The meta of a new element of a kind (``newElementMeta`` plus what
    ``newComponentFactory`` adds), without its place on the page."""
    defaults = copy.deepcopy(catalog.element_defaults(kind))
    element = defaults["element"]
    if kind == "button":
        element = {**element, "label": DEFAULT_BUTTON_LABEL}
    return {
        "background": BACKGROUND_TRANSPARENT,
        "componentKey": f"{keys.ELEMENT_PREFIX}{kind}",
        "width": defaults["width"],
        "height": defaults["height"],
        keys.VISUAL_FORMAT_KEY: defaults["format"],
        keys.ELEMENT_KEY: element,
    }


class _RichText(HTMLParser):
    """Collects what the rich text of a text element would load or open."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.problems: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            value = value or ""
            if name == "href" and value and not is_safe_url(value):
                self.problems.append(
                    f"html: link {value[:60]!r} must start with https://, "
                    "http://, mailto: or /"
                )
            if name == "style":
                self.problems.extend(_style_problems(value))


def _style_problems(style: str) -> list[str]:
    problems = []
    if "\\" in style:
        problems.append("html: backslash escapes are not allowed in styles")
    if _CSS_IMAGE_SET.search(style):
        problems.append("html: image-set() is not allowed in styles")
    for _, address in _CSS_URL.findall(style):
        if not is_site_image(address):
            problems.append(f"html: url({address[:60]}) must be a picture of this site")
    return problems


def check_rich_text(html: str) -> None:
    """Rich text loads no picture of another site and links only to safe
    addresses; the frontend sanitizes the rest (``sanitizeRichText``)."""
    parser = _RichText()
    parser.feed(html)
    parser.close()
    if parser.problems:
        raise FormatPatchError(parser.problems)


def check_element_patch(
    kind: str, patch: dict[str, Any], refs: ReportRefs | None = None
) -> dict[str, Any]:
    """A patch of the settings of an element of a kind, checked against the
    catalog; settings the tools manage are refused, None resets a setting."""
    managed = sorted(MANAGED_SETTINGS & set(patch))
    if managed:
        raise FormatPatchError(
            [f"{key}: set by the tools, not by a patch" for key in managed]
        )
    fields = {
        key: spec
        for key, spec in catalog.element_spec(kind).items()
        if key not in MANAGED_SETTINGS
    }
    clean = check_settings(fields, patch, refs)
    if isinstance(clean.get("html"), str):
        check_rich_text(clean["html"])
    return clean


def slicer_value_key(value: Any) -> str:
    """``slicerValueKey``: how a slicer names a value it leaves out, the way
    JavaScript's ``String()`` writes it."""
    if value is None:
        return "\u0000blank"
    if isinstance(value, bool):
        return "true" if value else "false"
    if is_number(value) and float(value).is_integer():
        return str(int(value))
    return str(value)
