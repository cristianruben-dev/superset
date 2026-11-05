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
Pictures of a report for the AI to look at what it built, with Superset's
screenshot machinery (``DashboardScreenshot`` and its Playwright driver, as
scheduled reports use). A page opens through a dashboard permalink whose
active tab is that page; a visual is the element of its chart on its page.
"""

import asyncio
import io
import logging
import math
from dataclasses import dataclass
from typing import Any

from superset.auradata.layout import (
    MOBILE_COLUMNS,
    mobile_layout_of,
    mobile_page_rows,
)
from superset.mcp_service.report_layout.editing import LayoutEditError, Report

logger = logging.getLogger(__name__)

# Largest side of the picture handed to the AI, in pixels
MAX_IMAGE_SIDE = 1600
JPEG_QUALITY = 80
# Room for the top bar of the report around its page, in pixels
CHROME_HEIGHT = 160
# A phone screen in CSS pixels (points): an iPhone 15, as the editor's preview
PHONE_WIDTH = 393
PHONE_HEIGHT = 852


@dataclass
class Picture:
    """A screenshot ready to return: JPEG bytes and their size in pixels."""

    data: bytes
    width: int
    height: int
    mime_type: str = "image/jpeg"


def page_url(report: Report, page_id: str | None) -> str:
    """The URL that opens the report on a page."""
    from superset.mcp_service.dashboard.permalink import create_page_permalink
    from superset.utils.urls import get_url_path

    dashboard = report.dashboard
    if not page_id or page_id == "GRID_ID":
        return get_url_path("Superset.dashboard", dashboard_id_or_slug=dashboard.id)
    # The anchor opens the page; active tabs alone only move the page bar
    key = create_page_permalink(dashboard.id, page_id)
    return get_url_path("Superset.dashboard_permalink", key=key)


def window_for(report: Report) -> tuple[int, int]:
    """A browser window that shows the whole page at its own size."""
    from superset.auradata.layout import CELL

    return report.columns * CELL, report.rows * CELL + CHROME_HEIGHT


def phone_window_for(report: Report, page_id: str) -> tuple[tuple[int, int], bool]:
    """
    A phone screen tall enough for the whole page as a phone shows it: its
    mobile layout when it has one, else the canvas scaled to the width. The
    page scrolls inside its own container, so a shorter window would cut it.
    Also says whether the page has a mobile layout.
    """
    # Both pages are scaled to the phone width, so their height is in proportion
    boxes = mobile_layout_of(report.layout, page_id)
    if boxes:
        height = mobile_page_rows(boxes) * PHONE_WIDTH / MOBILE_COLUMNS
    else:
        height = report.rows * PHONE_WIDTH / report.columns
    tall = max(PHONE_HEIGHT, math.ceil(height) + CHROME_HEIGHT)
    return (PHONE_WIDTH, tall), boxes is not None


def shrink(image: bytes) -> Picture:
    """The picture as a JPEG no larger than ``MAX_IMAGE_SIDE`` on a side."""
    from PIL import Image

    with Image.open(io.BytesIO(image)) as picture:
        picture = picture.convert("RGB")
        picture.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
        out = io.BytesIO()
        picture.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return Picture(out.getvalue(), picture.width, picture.height)


async def capture(url: str, element: str, window: tuple[int, int]) -> Picture:
    """
    Opens the URL as the current user and takes the picture of one element.
    Playwright's sync API refuses to run inside the server's event loop, so the
    browser works in a thread with its own app context.
    """
    from flask import current_app, g

    app = current_app._get_current_object()  # pylint: disable=protected-access
    user_id = g.user.id
    return await asyncio.to_thread(_capture, app, user_id, url, element, window)


def _capture(
    app: Any, user_id: int, url: str, element: str, window: tuple[int, int]
) -> Picture:
    with app.app_context():
        from flask import g

        from superset import security_manager

        user = security_manager.get_user_by_id(user_id)
        g.user = user
        return take_picture(url, element, window, user)


def take_picture(url: str, element: str, window: tuple[int, int], user: Any) -> Picture:
    """Takes the picture of one element of a page, as the user."""
    from superset.utils.screenshots import DashboardScreenshot

    screenshot = DashboardScreenshot(url, None, window_size=window, thumb_size=window)
    screenshot.element = element
    try:
        image = screenshot.get_screenshot(user=user, window_size=window)
    except RuntimeError as ex:
        logger.warning("Screenshot of %s failed: %s", url, ex)
        raise LayoutEditError(
            f"The screenshot could not be taken: {ex}", "ScreenshotUnavailable"
        ) from ex
    if not image:
        raise LayoutEditError(
            "The screenshot came back empty; try again in a moment.",
            "ScreenshotFailed",
        )
    return shrink(image)
