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
"""The format a visual shows. Mirrors ``mergeVisualFormat`` of ``styles.ts``."""

from typing import Any

from superset.auradata.layout._js import as_dict, truthy
from superset.auradata.layout.grid import canvas_format
from superset.auradata.layout.keys import (
    ELEMENT_KEY,
    element_kind,
    VISUAL_FORMAT_KEY,
)

# Settings merged one level deeper, setting by setting
_NESTED = ("title", "header", "chart")


def merge_visual_format(shared: Any, own: Any) -> Any:
    """
    The style every chart shares, overridden by the chart's own format setting
    by setting (title, header icons and chart settings included).
    """
    if shared is None:
        return own
    if own is None:
        return shared
    merged = {**as_dict(shared), **as_dict(own)}
    for key in _NESTED:
        if truthy(as_dict(shared).get(key)) or truthy(as_dict(own).get(key)):
            merged[key] = {
                **as_dict(as_dict(shared).get(key)),
                **as_dict(as_dict(own).get(key)),
            }
    return merged


def shared_visual_format(layout: dict[str, Any]) -> Any:
    """The style every chart of the report shares (``auradataCanvas.visuals``)."""
    return as_dict(canvas_format(layout)).get("visuals")


def visual_format_of(layout: dict[str, Any], component_id: str) -> Any:
    """The format the object shows: shared style plus its own format."""
    meta = as_dict(as_dict(layout.get(component_id)).get("meta"))
    own = meta.get(VISUAL_FORMAT_KEY)
    return merge_visual_format(shared_visual_format(layout), own)


# What a format says about one chart, and what another object can take. These
# mirror ``chartFormatSettings.ts`` (``sharableFormat``, ``ownFormat``,
# ``withOwnFormat``) and ``formatPainter.ts`` (``formatOf``, ``pastedMeta``).

# The settings of an element that are content rather than formatting
ELEMENT_CONTENT_KEYS: dict[str, tuple[str, ...]] = {
    "image": ("src", "imageId", "alt", "action"),
    "shape": ("shape", "text", "action"),
    "button": ("label", "icon", "action"),
    "text": ("html",),
    "filter": ("filterId", "showInFilterBar"),
    "navigator": (),
}


def _own_settings() -> frozenset[str]:
    from superset.auradata.catalog import own_chart_settings

    return own_chart_settings()


def _pick_chart(chart: Any, keep: bool) -> dict[str, Any] | None:
    if not truthy(chart) or not isinstance(chart, dict):
        return None
    own = _own_settings()
    picked = {key: value for key, value in chart.items() if (key in own) == keep}
    return picked or None


def sharable_chart_format(chart: Any) -> dict[str, Any] | None:
    """The chart settings another chart can take."""
    return _pick_chart(chart, keep=False)


def own_chart_format(chart: Any) -> dict[str, Any] | None:
    """The chart settings a chart keeps when it takes the format of another."""
    return _pick_chart(chart, keep=True)


def sharable_format(fmt: Any) -> Any:
    """A format as another object can take it: without its subtitle, header
    help text, link, action button and own chart settings."""
    if not truthy(fmt) or not isinstance(fmt, dict):
        return fmt
    shared = {
        key: value
        for key, value in fmt.items()
        if key not in ("chart", "link", "actionButton")
    }
    sharable = sharable_chart_format(fmt.get("chart"))
    if sharable:
        shared["chart"] = sharable
    title = shared.get("title")
    if isinstance(title, dict) and "subtitle" in title:
        shared["title"] = {k: v for k, v in title.items() if k != "subtitle"}
    header = shared.get("header")
    tooltip = as_dict(as_dict(header).get("tooltip"))
    if "text" in tooltip:
        shared["header"] = {
            **as_dict(header),
            "tooltip": {k: v for k, v in tooltip.items() if k != "text"},
        }
    return shared


def own_format(fmt: Any) -> dict[str, Any] | None:
    """What a chart keeps of its own format when it takes that of another."""
    fmt = as_dict(fmt)
    kept: dict[str, Any] = {}
    subtitle = as_dict(fmt.get("title")).get("subtitle")
    if truthy(subtitle):
        kept["title"] = {"subtitle": subtitle}
    text = as_dict(as_dict(fmt.get("header")).get("tooltip")).get("text")
    if truthy(text):
        kept["header"] = {"tooltip": {"text": text}}
    for key in ("link", "actionButton"):
        if truthy(fmt.get(key)):
            kept[key] = fmt[key]
    chart = own_chart_format(fmt.get("chart"))
    if chart:
        kept["chart"] = chart
    return kept or None


def with_own_format(shared: Any, own: Any) -> Any:
    """A shared format with what a chart keeps of its own on top."""
    if not truthy(own):
        return shared
    base = as_dict(shared)
    own = as_dict(own)
    merged = {**base, **own}
    if truthy(own.get("title")):
        merged["title"] = {**as_dict(base.get("title")), **as_dict(own["title"])}
    if truthy(own.get("header")):
        shared_header = as_dict(base.get("header"))
        own_header = as_dict(own["header"])
        merged["header"] = {
            **shared_header,
            **own_header,
            "tooltip": {
                **as_dict(shared_header.get("tooltip")),
                **as_dict(own_header.get("tooltip")),
            },
        }
    if truthy(own.get("chart")):
        merged["chart"] = {**as_dict(base.get("chart")), **as_dict(own["chart"])}
    return merged


def _source_of(item: dict[str, Any]) -> str:
    return element_kind(as_dict(item.get("meta")).get("componentKey")) or "chart"


def format_of(item: dict[str, Any]) -> dict[str, Any]:
    """The formatting of an object, without its content (the format painter
    copies this)."""
    meta = as_dict(item.get("meta"))
    source = _source_of(item)
    copied: dict[str, Any] = {"sourceId": item.get("id"), "source": source}
    element = meta.get(ELEMENT_KEY)
    if source != "chart" and truthy(element):
        copied["style"] = {
            key: value
            for key, value in as_dict(element).items()
            if key not in ELEMENT_CONTENT_KEYS[source]
        }
    box = sharable_format(meta.get(VISUAL_FORMAT_KEY))
    # The title of an element is its own text, not a template of its kind
    title = as_dict(as_dict(box).get("title"))
    if source != "chart" and "template" in title:
        box = {
            **box,
            "title": {k: v for k, v in title.items() if k != "template"},
        }
    if box is not None:
        copied["box"] = box
    return copied


def pasted_meta(item: dict[str, Any], copied: dict[str, Any]) -> dict[str, Any]:
    """The meta of an object once it takes a copied format: the copied box with
    what belongs to it on top and, between elements of a kind, their style."""
    meta = dict(as_dict(item.get("meta")))
    current = meta.get(VISUAL_FORMAT_KEY)
    box = with_own_format(copied.get("box"), own_format(current))
    title = as_dict(as_dict(current).get("title"))
    source = _source_of(item)
    if source != "chart" and "template" in title:
        box = {
            **as_dict(box),
            "title": {
                **as_dict(as_dict(box).get("title")),
                "template": title["template"],
            },
        }
    if truthy(box):
        meta[VISUAL_FORMAT_KEY] = box
    else:
        meta.pop(VISUAL_FORMAT_KEY, None)
    if truthy(copied.get("style")) and copied.get("source") == source:
        meta[ELEMENT_KEY] = {**as_dict(meta.get(ELEMENT_KEY)), **copied["style"]}
    return meta
