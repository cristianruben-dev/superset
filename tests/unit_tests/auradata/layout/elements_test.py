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
Design elements in Python: the descriptors of the catalog cover every setting
the frontend declares (``elements/types.ts``), a new element gets the meta the
editor gives it, and patches keep pictures and links on this site.
"""

import re
from pathlib import Path

import pytest

from superset.auradata import catalog
from superset.auradata.layout.elements import (
    check_element_patch,
    check_rich_text,
    new_element_meta,
    slicer_value_key,
)
from superset.auradata.layout.format_patch import FormatPatchError

TYPES = (
    Path(__file__).parents[4]
    / "superset-frontend"
    / "src"
    / "auradata"
    / "elements"
    / "types.ts"
)

INTERFACES = {
    "image": "ImageElement",
    "shape": "ShapeElement",
    "button": "ButtonElement",
    "text": "TextElement",
    "filter": "FilterElement",
    "navigator": "NavigatorElement",
}


def interface_keys(source: str, name: str) -> set[str]:
    """Keys of a TypeScript interface, with those it extends (Interactive)."""
    match = re.search(
        rf"export interface {name}(?: extends (\w+))? \{{(.*?)\n\}}", source, re.S
    )
    assert match, name
    body = re.sub(r"/\*.*?\*/", "", match.group(2), flags=re.S)
    found = set(re.findall(r"^  (\w+)\??:", body, re.M))
    if match.group(1):
        found |= interface_keys(source, match.group(1))
    return found


@pytest.mark.skipif(not TYPES.exists(), reason="the frontend source is not here")
@pytest.mark.parametrize("kind", sorted(INTERFACES))
def test_catalog_describes_every_setting_of_the_frontend(kind: str) -> None:
    source = TYPES.read_text(encoding="utf-8")
    assert set(catalog.element_spec(kind)) == interface_keys(source, INTERFACES[kind])


def test_new_element_meta_is_the_editor_one() -> None:
    meta = new_element_meta("button")
    assert meta["componentKey"] == "auradata-button"
    assert meta["background"] == "BACKGROUND_TRANSPARENT"
    assert meta["auradataElement"]["label"] == "Button"
    assert (meta["width"], meta["height"]) == (8, 2)
    # Each call gives its own copy
    meta["auradataElement"]["label"] = "Otro"
    assert new_element_meta("button")["auradataElement"]["label"] == "Button"
    assert new_element_meta("filter")["auradataElement"] == {
        "kind": "filter",
        "showInFilterBar": True,
    }


def test_element_patches_are_checked_against_the_catalog() -> None:
    assert check_element_patch("shape", {"shape": "star", "radius": None}) == {
        "shape": "star",
        "radius": None,
    }
    with pytest.raises(FormatPatchError, match="shape: must be one of"):
        check_element_patch("shape", {"shape": "cloud"})
    with pytest.raises(FormatPatchError, match="set by the tools"):
        check_element_patch("filter", {"filterId": "NATIVE_FILTER-1"})
    with pytest.raises(FormatPatchError, match="must hold 4 values"):
        check_element_patch("filter", {"itemCorners": [1, 2]})
    with pytest.raises(FormatPatchError, match=r"hiddenValues\[0\]"):
        check_element_patch("filter", {"hiddenValues": [3]})
    assert check_element_patch("image", {"src": "/static/logo.png"})
    with pytest.raises(FormatPatchError, match="picture of this site"):
        check_element_patch("image", {"src": "//e.com/logo.png"})


@pytest.mark.parametrize(
    "html",
    [
        '<a href="javascript:alert(1)">x</a>',
        '<a href="//e.com">x</a>',
        '<p style="background:url(https://e.com/a.png)">x</p>',
        '<p style="background:url&#40;https://e.com/a.png)">x</p>',
        '<p style="background:image-set(&quot;a.png&quot; 1x)">x</p>',
        '<p style="background:\\75rl(https://e.com/a.png)">x</p>',
    ],
)
def test_rich_text_refuses_foreign_pictures_and_links(html: str) -> None:
    with pytest.raises(FormatPatchError):
        check_rich_text(html)


def test_rich_text_keeps_safe_formatting() -> None:
    check_rich_text(
        '<p style="color:#2563EB"><b>Ventas</b> <a href="/dashboard/1/">ver</a> '
        '<a href="mailto:a@b.mx">correo</a></p>'
    )


@pytest.mark.parametrize(
    ("value", "key"),
    [
        (None, "\u0000blank"),
        (True, "true"),
        (False, "false"),
        (2.0, "2"),
        (2.5, "2.5"),
        (7, "7"),
        ("Norte", "Norte"),
    ],
)
def test_slicer_value_key_is_javascript_string(value: object, key: str) -> None:
    assert slicer_value_key(value) == key
