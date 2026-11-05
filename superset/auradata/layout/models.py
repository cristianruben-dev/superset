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
Pydantic models of the report settings the layout stores, mirroring
``src/auradata/format/types.ts``, ``src/auradata/elements/types.ts`` and
``src/auradata/report/types.ts``. Field names are snake case, read and written
under the camel case names of the frontend.

They read, validate and describe; writes keep the layout as plain dicts (dump
with ``by_alias=True, exclude_none=True`` when a model becomes a layout value),
so no key the frontend wrote is ever dropped. Every model allows extra keys:
long tails of settings, like the dozens of slicer styles, pass through untouched.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class LayoutModel(BaseModel):
    """A layout value: camel case keys, extra keys kept."""

    model_config = ConfigDict(
        alias_generator=to_camel, populate_by_name=True, extra="allow"
    )

    def to_layout(self) -> dict[str, Any]:
        """The value as the layout stores it."""
        return self.model_dump(by_alias=True, exclude_none=True)


# Format (format/types.ts)

ShadowLevel = Literal["none", "soft", "strong", "custom"]
TitleAlign = Literal["left", "center", "right"]


class ShadowDetail(LayoutModel):
    color: str | None = None
    opacity: float | None = None
    angle: float | None = None
    distance: float | None = None
    blur: float | None = None
    spread: float | None = None
    inset: bool | None = None


class BoxSides(LayoutModel):
    top: float | None = None
    right: float | None = None
    bottom: float | None = None
    left: float | None = None


class TitleFormat(LayoutModel):
    show: bool | None = None
    font_family: str | None = None
    size: float | None = None
    color: str | None = None
    align: TitleAlign | None = None
    background: str | None = None
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    wrap: bool | None = None
    heading: int | None = None
    template: str | None = None
    subtitle: str | None = None
    subtitle_size: float | None = None
    subtitle_color: str | None = None
    subtitle_align: TitleAlign | None = None
    divider: bool | None = None
    divider_color: str | None = None
    divider_width: float | None = None
    divider_style: Literal["solid", "dashed", "dotted"] | None = None
    gap: float | None = None


class HeaderFormat(LayoutModel):
    show: bool | None = None
    menu: bool | None = None
    badges: bool | None = None
    focus: bool | None = None
    see_data: bool | None = None
    copy_: bool | None = Field(None, alias="copy")
    info: bool | None = None
    warning: bool | None = None
    error: bool | None = None
    tooltip_icon: bool | None = None
    icon_color: str | None = None
    icon_background: str | None = None
    icon_border: str | None = None
    icon_opacity: float | None = None
    tooltip: dict[str, Any] | None = None


class ElementAction(LayoutModel):
    type: Literal["none", "page", "url", "reset-filters", "top", "bookmark", "back"]
    tab_id: str | None = None
    bookmark_id: str | None = None
    url: str | None = None
    new_tab: bool | None = None


class LinkFormat(LayoutModel):
    show: bool | None = None
    action: ElementAction | None = None
    tooltip: str | None = None
    disabled_tooltip: str | None = None


class VisualTooltipPage(LayoutModel):
    type: Literal["default", "page"] | None = None
    page: str | None = None


class VisualFormat(LayoutModel):
    """``meta.auradataFormat`` of an object, and the shared ``visuals`` style."""

    background: str | None = None
    background_opacity: float | None = None
    border_color: str | None = None
    border_width: float | None = None
    border_opacity: float | None = None
    radius: float | None = None
    shadow: ShadowLevel | None = None
    shadow_detail: ShadowDetail | None = None
    padding: float | None = None
    padding_sides: BoxSides | None = None
    title: TitleFormat | None = None
    value: dict[str, Any] | None = None
    label: dict[str, Any] | None = None
    header: HeaderFormat | None = None
    link: LinkFormat | None = None
    action_button: dict[str, Any] | None = None
    tooltip_page: VisualTooltipPage | None = None
    lock_aspect: bool | None = None
    keep_layer_order: bool | None = None
    chart: dict[str, Any] | None = None


class CanvasBackground(LayoutModel):
    type: Literal["none", "color", "gradient", "image"]
    color: str | None = None
    color2: str | None = None
    angle: float | None = None
    image: str | None = None
    fit: Literal["cover", "contain", "repeat"] | None = None
    opacity: float | None = None


class CanvasSize(LayoutModel):
    mode: Literal["16:9", "4:3", "letter", "custom"]
    width: float | None = None
    height: float | None = None


class AreaStyle(LayoutModel):
    background: str | None = None
    text: str | None = None
    accent: str | None = None


class CanvasFormat(LayoutModel):
    """``ROOT_ID.meta.auradataCanvas``: the page and the style charts share."""

    appearance: Literal["light", "dark", "app"] | None = None
    filter_bar: AreaStyle | None = None
    tabs: AreaStyle | None = None
    background: CanvasBackground | None = None
    size: CanvasSize | None = None
    visuals: VisualFormat | None = None


# Design elements (elements/types.ts)

ElementKind = Literal["image", "shape", "button", "text", "filter", "navigator"]


class TextStyle(LayoutModel):
    size: float | None = None
    color: str | None = None
    weight: Literal[400, 500, 600, 700] | None = None
    italic: bool | None = None
    align: Literal["left", "center", "right"] | None = None
    vertical_align: Literal["top", "middle", "bottom"] | None = None
    line_height: float | None = None
    letter_spacing: float | None = None
    uppercase: bool | None = None


class Fill(LayoutModel):
    type: Literal["solid", "gradient", "none"]
    color: str | None = None
    color2: str | None = None
    angle: float | None = None
    opacity: float | None = None


class ButtonState(LayoutModel):
    fill: str | None = None
    color: str | None = None
    border_color: str | None = None


class ImageElement(LayoutModel):
    kind: Literal["image"]
    src: str | None = None
    image_id: int | None = None
    fit: Literal["cover", "contain", "fill", "none"] | None = None
    position: Literal["center", "top", "bottom", "left", "right"] | None = None
    opacity: float | None = None
    grayscale: bool | None = None
    blur: float | None = None
    rotation: float | None = None
    flip: bool | None = None
    alt: str | None = None
    action: ElementAction | None = None
    hover_effect: Literal["none", "lift", "grow", "brighten"] | None = None
    tooltip: str | None = None


class ShapeElement(LayoutModel):
    kind: Literal["shape"]
    shape: Literal[
        "rectangle",
        "ellipse",
        "triangle",
        "diamond",
        "hexagon",
        "arrow",
        "chevron",
        "line",
        "star",
    ]
    fill: Fill | None = None
    stroke: dict[str, Any] | None = None
    radius: float | None = None
    rotation: float | None = None
    shadow: Literal["none", "soft", "strong"] | None = None
    text: str | None = None
    text_style: TextStyle | None = None
    action: ElementAction | None = None
    hover_fill: str | None = None
    hover_effect: Literal["none", "lift", "grow", "brighten"] | None = None
    tooltip: str | None = None


class ButtonElement(LayoutModel):
    kind: Literal["button"]
    label: str | None = None
    icon: str | None = None
    icon_position: Literal["left", "right", "only"] | None = None
    action: ElementAction | None = None
    normal: ButtonState | None = None
    hover: ButtonState | None = None
    pressed: ButtonState | None = None
    border_width: float | None = None
    radius: float | None = None
    shadow: Literal["none", "soft", "strong"] | None = None
    text_style: TextStyle | None = None
    hover_effect: Literal["none", "lift", "grow", "brighten"] | None = None
    tooltip: str | None = None


class TextElement(LayoutModel):
    kind: Literal["text"]
    html: str | None = None
    text_style: TextStyle | None = None


class FilterElement(LayoutModel):
    """A canvas slicer; its many style settings pass through as extra keys."""

    kind: Literal["filter"]
    filter_id: str | None = None
    show_in_filter_bar: bool | None = None
    variant: Literal["dropdown", "list", "buttons", "input"] | None = None
    selection: Literal["multi", "single", "ctrl"] | None = None
    range_style: Literal["between", "slider"] | None = None
    date_style: Literal["relative", "between"] | None = None
    hidden_values: list[str] | None = None
    apply_button: bool | None = None
    sort_values: Literal["asc", "desc"] | None = None


class NavigatorElement(LayoutModel):
    kind: Literal["navigator"]
    direction: Literal["row", "column"] | None = None
    gap: float | None = None
    radius: float | None = None
    normal: ButtonState | None = None
    active: ButtonState | None = None
    text_style: TextStyle | None = None


ElementConfig = (
    ImageElement
    | ShapeElement
    | ButtonElement
    | TextElement
    | FilterElement
    | NavigatorElement
)


class ElementSettings(BaseModel):
    """``meta.auradataElement``, picked by its ``kind``."""

    element: ElementConfig = Field(discriminator="kind")


# Report interactivity (report/types.ts) and mobile layout


class DrillthroughPage(LayoutModel):
    """``TAB-*.meta.auradataDrillthrough``: columns the page accepts."""

    columns: list[str]


class BookmarkOptions(LayoutModel):
    data: bool
    display: bool
    page: bool


class Bookmark(LayoutModel):
    """An item of ``ROOT_ID.meta.auradataBookmarks``."""

    id: str
    name: str
    options: BookmarkOptions
    page: str | None = None
    filters: dict[str, dict[str, Any]] | None = None
    visibility: dict[str, bool] | None = None


class TooltipPage(LayoutModel):
    """``TAB-*.meta.auradataTooltipPage``: the page is a tooltip of this size."""

    width: int = 10
    height: int = 8
    columns: list[str] = Field(default_factory=list)


class MobileBoxModel(LayoutModel):
    id: str
    x: int
    y: int
    width: int
    height: int


class MobileLayout(LayoutModel):
    """``TAB-*.meta.auradataMobile``: boxes on the phone page, back to front."""

    items: list[MobileBoxModel]


class CellPos(LayoutModel):
    """``meta.auradataPos``: the cell of an object, from the page's top left."""

    x: int = Field(ge=0)
    y: int = Field(ge=0)
