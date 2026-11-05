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
Checking a format change against the format catalog before it reaches the
layout, the way the Format pane would build it:

- chart settings (Visual and Analytics levels) must be look controls of the
  chart type, with a value of their kind; they replace the saved value whole;
- General settings follow the catalog's description of ``VisualFormat``; nested
  objects merge key by key;
- ``None`` resets a setting.

Colors, links and pictures are checked so a format never points the report, or
the server that takes its screenshots, at another site.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any

from superset.auradata import catalog
from superset.auradata.layout._js import is_number
from superset.auradata.layout.keys import SAMPLING_FORMAT_KEY, TOOLTIP_FORMAT_KEY


class FormatPatchError(ValueError):
    """A format change the catalog refuses; ``problems`` says why, per key."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


@dataclass
class ReportRefs:
    """Ids of the report a format may point at (pages and bookmarks)."""

    pages: set[str] = field(default_factory=set)
    bookmarks: set[str] = field(default_factory=set)


_HEX = re.compile(r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
# Named colors, hex and functional notations; never url(), quotes or ';'
_CSS_COLOR = re.compile(r"^[#a-zA-Z0-9(),.%\s/+-]{1,64}$")
_SAFE_URL = re.compile(r"^(?:https?://|mailto:|/(?!/))", re.IGNORECASE)
_SITE_IMAGE = re.compile(
    r"^(?:/(?![/\\])|data:image/(?:png|jpeg|gif|webp);base64,)", re.IGNORECASE
)


def is_css_color(value: Any) -> bool:
    """A CSS color a style can hold without reaching for anything else."""
    return (
        isinstance(value, str)
        and bool(_CSS_COLOR.match(value.strip()))
        and "url" not in value.lower()
    )


def is_safe_url(value: Any) -> bool:
    """``isSafeUrl`` of the elements: http(s), mailto or a path of this site."""
    return isinstance(value, str) and bool(_SAFE_URL.match(value.strip()))


def is_site_image(value: Any) -> bool:
    """A picture of this site or a raster data address: nothing the server or
    a viewer's browser would fetch from another host."""
    return isinstance(value, str) and bool(_SITE_IMAGE.match(value.strip()))


def to_rgba(value: Any) -> dict[str, Any] | None:
    """A color as ``ColorPickerControl`` saves it (``{r, g, b, a}``), from a hex
    string or such an object; None when it is not a color."""
    if isinstance(value, dict):
        try:
            rgba = {k: value[k] for k in ("r", "g", "b")}
        except KeyError:
            return None
        rgba["a"] = value.get("a", 1)
        channels_ok = all(
            is_number(rgba[k]) and 0 <= rgba[k] <= 255 for k in ("r", "g", "b")
        )
        alpha_ok = is_number(rgba["a"]) and 0 <= rgba["a"] <= 1
        return rgba if channels_ok and alpha_ok else None
    if isinstance(value, str) and _HEX.match(value.strip()):
        digits = value.strip()[1:]
        if len(digits) in (3, 4):
            digits = "".join(c * 2 for c in digits)
        r, g, b = (int(digits[i : i + 2], 16) for i in (0, 2, 4))
        a = round(int(digits[6:8], 16) / 255, 3) if len(digits) == 8 else 1
        return {"r": r, "g": g, "b": b, "a": a}
    return None


def _number_problem(value: Any, spec: dict[str, Any]) -> str | None:
    if not is_number(value) or not math.isfinite(value):
        return "must be a number"
    if spec.get("integer") and value != int(value):
        return "must be a whole number"
    if "min" in spec and value < spec["min"]:
        return f"must be at least {spec['min']}"
    if "max" in spec and value > spec["max"]:
        return f"must be at most {spec['max']}"
    return None


def _check_images(key: str, value: Any) -> str | None:
    """Image settings of charts (donut center, plot area) take site pictures."""
    if "image" in key.lower() and isinstance(value, str) and value.strip():
        if not is_site_image(value):
            return (
                "must be a picture of this site (a path starting with /) or a "
                "data:image address; upload it first"
            )
    return None


# An address a chart could load: a scheme with //, a protocol relative one,
# a data or blob address; ECharts takes pictures as "image://<address>" too
_ADDRESS = re.compile(r"^(?:[a-z][a-z0-9+.-]*:)?//|^(?:data|blob):", re.IGNORECASE)
_IMAGE_PREFIX = "image://"
# String literals of JavaScript object code (echart_options)
_JS_STRING = re.compile(
    r"'(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\"|`(?:[^`\\]|\\.)*`", re.DOTALL
)
_JS_ESCAPE = re.compile(
    r"\\(?:x([0-9a-fA-F]{2})|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|(.))", re.DOTALL
)
_JS_SIMPLE_ESCAPES = {
    "n": "\n",
    "t": "\t",
    "r": "\r",
    "b": "\b",
    "f": "\f",
    "v": "\v",
    "0": "\0",
}


def _js_unescape(text: str) -> str:
    """The value of a JavaScript string literal's body, escapes decoded."""

    def decode(match: re.Match[str]) -> str:
        hex2, braced, hex4, other = match.groups()
        code = hex2 or braced or hex4
        if code:
            try:
                return chr(int(code, 16))
            except (ValueError, OverflowError):
                return ""
        return _JS_SIMPLE_ESCAPES.get(other, other)

    return _JS_ESCAPE.sub(decode, text)


def _js_literals(text: str) -> list[str]:
    """The strings a piece of JavaScript object code holds; template literals
    keep their text, as the options parser does (``${}`` parts dropped)."""
    values = []
    for literal in _JS_STRING.findall(text):
        body = literal[1:-1]
        if literal[0] == "`":
            body = re.sub(r"\$\{[^}]*\}", "", body)
        values.append(_js_unescape(body))
    return values


def _foreign_address(value: str) -> str | None:
    """The address a string would make a chart load from another site, or
    None; the twin of ``sameOriginImage`` for values the server checks."""
    text = value.strip()
    if text.lower().startswith(_IMAGE_PREFIX):
        text = text[len(_IMAGE_PREFIX) :].strip()
    if _ADDRESS.match(text) and not is_site_image(text):
        return text[:80]
    return None


_CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.IGNORECASE | re.DOTALL)
# Attributes of HTML that load what they name
_LOADING_ATTRIBUTES = ("src", "poster", "background", "data")


class _HtmlLoads(HTMLParser):
    """Collects what a piece of HTML (a tooltip formatter) would load."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.addresses: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            value = (value or "").strip()
            if name in _LOADING_ATTRIBUTES and value:
                self.addresses.append(value)
            elif name == "srcset":
                self.addresses += [
                    part.split()[0] for part in value.split(",") if part.strip()
                ]
            elif name == "style":
                self.addresses += [url for _, url in _CSS_URL.findall(value)]


def _html_addresses(text: str) -> list[str]:
    """Addresses of other sites that HTML in a string would load."""
    if "<" not in text:
        return []
    parser = _HtmlLoads()
    parser.feed(text)
    parser.close()
    return [
        address[:80]
        for address in parser.addresses
        if (_ADDRESS.match(address) or address.lower().startswith(_IMAGE_PREFIX))
        and not is_site_image(address)
    ]


def foreign_addresses(value: Any) -> list[str]:
    """
    Addresses of other sites anywhere in a chart setting: every string at any
    depth (``graphic[].style.image``, ``symbol: 'image://...'``, pattern fills,
    rich text backgrounds, pictures in the HTML of a tooltip formatter), and
    every string literal of option code such as ``echart_options``. A picture
    must be a path of this site or a raster data address, so a viewer's
    browser never fetches one from another host and exports of the report
    keep working.
    """
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            found += foreign_addresses(key) + foreign_addresses(item)
    elif isinstance(value, list):
        for item in value:
            found += foreign_addresses(item)
    elif isinstance(value, str):
        code = value.lstrip().startswith(("{", "["))
        for text in (value, *(_js_literals(value) if code else [])):
            if address := _foreign_address(text):
                found.append(address)
            found += _html_addresses(text)
    return found


def _check_addresses(value: Any) -> str | None:
    if found := foreign_addresses(value):
        return (
            f"loads {found[0]!r} from another site; pictures must be a path of "
            "this site (upload them first) or a data:image address"
        )
    return None


def _choice_problem(
    kind: str, value: Any, choices: list[Any], free_form: bool | None
) -> str | None:
    if kind == "enum_list" and not isinstance(value, list):
        return "must be a list"
    values = value if kind == "enum_list" else [value]
    if not free_form and any(item not in choices for item in values):
        return f"must be one of {choices}"
    return None


def check_chart_value(control: dict[str, Any], value: Any) -> tuple[Any, str | None]:
    """The value a chart control saves, normalized, or why it is refused."""
    kind = control["value"]
    choices = control.get("choices")
    if kind == "boolean":
        return value, None if isinstance(value, bool) else "must be true or false"
    if kind == "number":
        if isinstance(value, str) and control.get("control") == "TextControl":
            return value, None
        return value, _number_problem(value, control)
    if kind == "string":
        if not isinstance(value, str):
            return value, "must be text"
        return value, _check_images(control["key"], value)
    if kind == "color":
        rgba = to_rgba(value)
        if rgba is None:
            return value, 'must be a color: "#2563EB" or {"r", "g", "b", "a"}'
        return rgba, None
    if kind in ("enum", "enum_list") and choices is not None:
        problem = _choice_problem(kind, value, choices, control.get("free_form"))
        if problem:
            return value, problem
    return value, _check_images(control["key"], value) or _check_addresses(value)


def check_chart_patch(
    viz_type: str, level: str | None, patch: dict[str, Any]
) -> dict[str, Any]:
    """Chart settings of a chart type, checked against its look controls; a
    ``None`` value resets the setting."""
    controls = catalog.controls_of(viz_type)
    if not controls:
        raise FormatPatchError([f"The format catalog has no chart type {viz_type!r}."])
    problems: list[str] = []
    clean: dict[str, Any] = {}
    for key, value in patch.items():
        control = controls.get(key)
        if control is None:
            problems.append(
                f"{key}: not a format setting of {viz_type} charts "
                "(see get_format_options)"
            )
            continue
        if level and control["level"] != level:
            problems.append(f"{key}: belongs to the {control['level']} level")
            continue
        if value is None:
            clean[key] = None
            continue
        normalized, problem = check_chart_value(control, value)
        if problem:
            problems.append(f"{key}: {problem}")
        else:
            clean[key] = normalized
    if problems:
        raise FormatPatchError(problems)
    return clean


def _string_problem(spec: dict[str, Any], value: Any, refs: ReportRefs) -> str | None:
    fmt = spec.get("format")
    if not isinstance(value, str):
        return "must be text"
    if fmt == "color" and not is_css_color(value):
        return 'must be a CSS color, like "#2563EB" or "transparent"'
    if fmt == "url" and value and not is_safe_url(value):
        return "must start with https://, http://, mailto: or /"
    if fmt == "page" and value and value not in refs.pages:
        return f"no page {value!r}; pages: {sorted(refs.pages)}"
    if fmt == "bookmark" and value and value not in refs.bookmarks:
        return f"no bookmark {value!r}"
    if fmt == "image" and value and not is_site_image(value):
        return (
            "must be a picture of this site (a path starting with /) or a "
            "data:image address; upload it first"
        )
    return None


def _scalar_problem(spec: dict[str, Any], value: Any, refs: ReportRefs) -> str | None:
    kind = spec["type"]
    if kind == "boolean":
        return None if isinstance(value, bool) else "must be true or false"
    if kind == "number":
        return _number_problem(value, spec)
    if kind == "enum":
        return None if value in spec["values"] else f"must be one of {spec['values']}"
    return _string_problem(spec, value, refs)


def _check_field(
    path: str,
    spec: dict[str, Any],
    value: Any,
    refs: ReportRefs,
    problems: list[str],
) -> Any:
    if value is None:
        return None
    kind = spec["type"]
    if kind == "object":
        if not isinstance(value, dict):
            problems.append(f"{path}: must be an object")
            return value
        return _check_object(path, spec["fields"], value, refs, problems)
    if kind == "array":
        return _check_array(path, spec, value, refs, problems)
    if kind == "map":
        if not isinstance(value, dict):
            problems.append(f"{path}: must be an object keyed by name")
            return value
        return {
            name: _check_field(f"{path}.{name}", spec["values"], item, refs, problems)
            for name, item in value.items()
        }
    problem = _scalar_problem(spec, value, refs)
    if problem:
        problems.append(f"{path}: {problem}")
    return value


def _check_array(
    path: str,
    spec: dict[str, Any],
    value: Any,
    refs: ReportRefs,
    problems: list[str],
) -> Any:
    if not isinstance(value, list):
        problems.append(f"{path}: must be a list")
        return value
    if "length" in spec and len(value) != spec["length"]:
        problems.append(f"{path}: must hold {spec['length']} values")
        return value
    return [
        _check_field(f"{path}[{index}]", spec["items"], item, refs, problems)
        for index, item in enumerate(value)
    ]


def _check_object(
    path: str,
    fields: dict[str, Any],
    value: dict[str, Any],
    refs: ReportRefs,
    problems: list[str],
) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, item in value.items():
        where = f"{path}.{key}" if path else key
        spec = fields.get(key)
        if spec is None:
            problems.append(f"{where}: unknown setting; known: {sorted(fields)}")
            continue
        clean[key] = _check_field(where, spec, item, refs, problems)
    return clean


def check_settings(
    fields: dict[str, Any], patch: dict[str, Any], refs: ReportRefs | None = None
) -> dict[str, Any]:
    """A patch of settings described by ``fields`` (a catalog descriptor),
    checked; a ``None`` value resets the setting."""
    problems: list[str] = []
    clean = _check_object("", fields, patch, refs or ReportRefs(), problems)
    if problems:
        raise FormatPatchError(problems)
    return clean


def check_general_patch(
    patch: dict[str, Any], refs: ReportRefs | None = None
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    General settings, checked against the catalog: the part kept in
    ``meta.auradataFormat`` and the chart settings it writes (the tooltip and
    sampling of ECharts charts, ``auradata_tooltip`` and ``auradata_sampling``).
    """
    refs = refs or ReportRefs()
    general = catalog.general_spec()
    chart_spec = catalog.general_chart_spec()
    problems: list[str] = []
    box = _check_object(
        "",
        general,
        {k: v for k, v in patch.items() if k not in chart_spec},
        refs,
        problems,
    )
    chart = _check_object(
        "",
        chart_spec,
        {k: v for k, v in patch.items() if k in chart_spec},
        refs,
        problems,
    )
    if problems:
        raise FormatPatchError(problems)
    return box, chart


def merge_patch(target: dict[str, Any] | None, patch: dict[str, Any]) -> dict[str, Any]:
    """``patch`` over ``target``: objects merge key by key, None removes."""
    merged = dict(target or {})
    for key, value in patch.items():
        if value is None:
            merged.pop(key, None)
        elif isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = merge_patch(merged[key], value)
            if not merged[key]:
                merged.pop(key)
        elif isinstance(value, dict):
            merged[key] = merge_patch(None, value)
        else:
            merged[key] = value
    return merged


def replace_settings(
    target: dict[str, Any] | None, patch: dict[str, Any]
) -> dict[str, Any]:
    """Chart settings of ``patch`` over ``target``: each replaced whole, as a
    control saves its value; None removes it."""
    merged = dict(target or {})
    for key, value in patch.items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    return merged


GENERAL_CHART_KEYS = (TOOLTIP_FORMAT_KEY, SAMPLING_FORMAT_KEY)
