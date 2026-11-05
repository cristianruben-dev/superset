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
Export a report as the web's Export does: each page at the fixed size of the
canvas (CELL px per cell), in page order, leaving out hidden and tooltip pages
unless one is asked for by name. The pages are taken on the server with the
screenshot machinery and put together as one PNG (pages one under another)
or one PDF (a page of the same size per page).
"""

import io
import re
from datetime import datetime
from typing import Any

from superset.auradata.layout import CELL
from superset.auradata.layout.pages import is_hidden_page, page_ids, page_title
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    Report,
    resolve_page,
)
from superset.mcp_service.screenshot.capture import CHROME_HEIGHT

#: Room beside the page in the report view (its gutter and the filter rail):
#: a window this much wider than the page shows it at its own size
EXPORT_SIDE_ROOM = 72
#: Room under the page for the page bar
EXPORT_BOTTOM_ROOM = 120
#: Pages of one export: each one opens a browser
MAX_EXPORT_PAGES = 10
#: Largest file one export returns
MAX_EXPORT_BYTES = 20 * 1024 * 1024
#: Space between pages of a PNG of several pages, in pixels
PAGE_GAP = 32
#: The element of the page in the report view
CANVAS_ELEMENT = "auradata-canvas"


def pages_to_export(
    report: Report, page: int | str | None, all_pages: bool
) -> tuple[list[str], list[str]]:
    """The pages to take, in order, and the visible ones over the limit."""
    if page is not None and all_pages:
        raise LayoutEditError("Give a page or all_pages, not both.")
    if page is not None:
        return [resolve_page(report, page)], []
    layout = report.layout
    pages = page_ids(layout)
    visible = [
        p for p in pages if not is_hidden_page((layout.get(p) or {}).get("meta"))
    ]
    if not visible:
        raise LayoutEditError(
            "Every page is hidden from viewers; name the page to export."
        )
    if not all_pages:
        return visible[:1], []
    return visible[:MAX_EXPORT_PAGES], visible[MAX_EXPORT_PAGES:]


def page_size(report: Report) -> tuple[int, int]:
    """The page in pixels: its cells times CELL."""
    return report.columns * CELL, report.rows * CELL


def export_window(report: Report) -> tuple[int, int]:
    """A window that shows the page at its own size, whole."""
    width, height = page_size(report)
    return width + EXPORT_SIDE_ROOM, height + CHROME_HEIGHT + EXPORT_BOTTOM_ROOM


def page_image(png: bytes, size: tuple[int, int]) -> Any:
    """A page as an RGB picture of exactly the page size."""
    from PIL import Image

    with Image.open(io.BytesIO(png)) as picture:
        picture = picture.convert("RGB")
        if picture.size != size:
            picture = picture.resize(size, Image.Resampling.LANCZOS)
        return picture


def build_png(pages: list[Any]) -> bytes:
    """The pages one under another, with a gap between them."""
    from PIL import Image

    width = max(page.width for page in pages)
    height = sum(page.height for page in pages) + PAGE_GAP * (len(pages) - 1)
    sheet = Image.new("RGB", (width, height), "white")
    top = 0
    for page in pages:
        sheet.paste(page, (0, top))
        top += page.height + PAGE_GAP
    out = io.BytesIO()
    sheet.save(out, format="PNG", optimize=True)
    return out.getvalue()


def build_pdf(pages: list[Any], title: str) -> bytes:
    """One PDF page per report page, of its size (96 px to the inch)."""
    out = io.BytesIO()
    pages[0].save(
        out,
        format="PDF",
        save_all=True,
        append_images=pages[1:],
        resolution=96.0,
        title=title,
        creator="AuraData BI",
    )
    return out.getvalue()


def file_name(title: str, when: datetime, extension: str) -> str:
    """A file name of the report title and the date."""
    stem = re.sub(r"[^\w-]+", "-", title.strip().lower()).strip("-") or "report"
    return f"{stem[:80]}-{when:%Y-%m-%d}.{extension}"


def names(report: Report, pages: list[str]) -> list[dict[str, str]]:
    return [{"id": p, "name": page_title(report.layout, p)} for p in pages]


def check_size(data: bytes) -> None:
    if len(data) > MAX_EXPORT_BYTES:
        raise LayoutEditError(
            f"The file is {len(data) // (1024 * 1024)} MB, over the "
            f"{MAX_EXPORT_BYTES // (1024 * 1024)} MB of one export; export fewer "
            "pages at a time.",
            "ExportTooLarge",
        )
