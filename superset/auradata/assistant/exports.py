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
A document of the assistant as a PDF.

The file is a picture of its reading view, taken with the machinery of report exports
(``mcp_service/screenshot``), so the page draws what its owner sees: a browser signed in
as that person runs each query with their permissions. The browser lives in the workers
and opening one takes seconds, so a web request only queues the export, with a ticket
in Redis that says who asked (``save_export``), and the panel asks until it is done. The
task has no argument for a user, and the ticket is held against the owner of the
document again, as a turn does. The file stays in Redis for a few minutes, for whoever
asked: deleting the conversation deletes it too (``forget``), and serving it reads the
document again.

The reading view knows it is being captured: it lays its blocks out on sheets of
``SHEET_WIDTH`` by ``SHEET_HEIGHT`` so that none falls across two, and only then adds
``READY_CLASS``, which is what the capture waits for. Here that picture is cut into
sheets, one PDF page each.
"""

from __future__ import annotations

import base64
import io
import logging
import time
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from flask import current_app, g
from flask_babel import force_locale

from superset import security_manager
from superset.auradata.assistant.artifacts import find_artifact, version_of
from superset.auradata.assistant.sharing import log_document
from superset.auradata.assistant.tools import run_coroutine
from superset.auradata.assistant.turn_store import TurnStore
from superset.auradata.models import AssistantArtifact
from superset.extensions import db
from superset.mcp_service.report_layout.editing import LayoutEditError
from superset.mcp_service.screenshot.capture import capture_raw
from superset.mcp_service.screenshot.export import build_pdf, check_size, file_name
from superset.utils.core import override_user
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)

# A sheet of A4, in pixels of the reading view at this density
SHEET_WIDTH = 1000
SHEET_HEIGHT = 1414
SHEET_DPI = 121.0
MAX_SHEETS = 30
READY_CLASS = "auradata-document-ready"

# What an export waits for a worker, and then what it gets before Celery kills it. A
# person is waiting, but a file is worth more of a wait than a chat turn
EXPORT_SECONDS = 180
PENDING = "pending"
DONE = "done"
FAILED = "failed"

ACTION_EXPORT = "export_pdf"


def start_export(
    store: TurnStore, artifact: AssistantArtifact, user_id: int, locale: str | None
) -> str:
    """Write the ticket of an export and queue it. Says the id to ask for it by."""
    # pylint: disable=import-outside-toplevel
    from superset.auradata.assistant.turns import QUEUE
    from superset.tasks.assistant_export import run_assistant_export

    job_id = str(uuid4())
    store.save_export(
        job_id,
        {
            "status": PENDING,
            "artifact_id": str(artifact.id),
            "conversation_id": str(artifact.conversation_id),
            "user_id": user_id,
            "locale": locale,
            "opened_at": time.time(),
        },
    )
    run_assistant_export.apply_async(
        args=[job_id],
        queue=QUEUE,
        expires=EXPORT_SECONDS,
        time_limit=EXPORT_SECONDS,
        retry=False,
    )
    return job_id


def job_of(
    store: TurnStore, job_id: str, artifact_id: UUID, user_id: int
) -> dict[str, Any] | None:
    """An export of this person and this document. Any other is None."""
    job = store.export(job_id)
    if (
        job is None
        or job["artifact_id"] != str(artifact_id)
        or job["user_id"] != user_id
    ):
        return None
    if job["status"] == PENDING and _is_lost(job):
        return {**job, "status": FAILED}
    return job


def _is_lost(job: dict[str, Any]) -> bool:
    """No worker took it in time, or the one that did died: nothing will end it."""
    return time.time() - job["opened_at"] > EXPORT_SECONDS * 2


def sheets_of(png: bytes) -> list[Any]:
    """A picture of the reading view as whole sheets, the last one filled with white."""
    # pylint: disable=import-outside-toplevel
    from PIL import Image

    with Image.open(io.BytesIO(png)) as picture:
        whole = picture.convert("RGB")
    # A window of a higher pixel density gives more pixels for the same sheet
    width, height = whole.width, round(SHEET_HEIGHT * whole.width / SHEET_WIDTH)
    sheets = []
    for top in range(0, whole.height, height):
        sheet = Image.new("RGB", (width, height), "white")
        sheet.paste(whole.crop((0, top, width, top + height)), (0, 0))
        sheets.append(sheet)
    if len(sheets) > MAX_SHEETS:
        raise LayoutEditError(f"The document takes over {MAX_SHEETS} sheets.")
    return sheets


def document_pdf(artifact_id: UUID, title: str) -> bytes:
    """The reading view of a document as a PDF, as the current user sees it."""
    url = get_url_path("AssistantSettingsView.document", artifact_id=artifact_id)
    # In a thread of its own, as a tool takes a screenshot: sync Playwright leaves this
    # one with a running loop, and the turn this worker takes next could not call a tool
    picture = run_coroutine(capture_raw(url, READY_CLASS, (SHEET_WIDTH, SHEET_HEIGHT)))
    sheets = sheets_of(picture)
    resolution = SHEET_DPI * sheets[0].width / SHEET_WIDTH
    pdf = build_pdf(sheets, title, resolution=resolution)
    check_size(pdf)
    return pdf


def _export(job: dict[str, Any], user: Any) -> dict[str, Any]:
    """The finished ticket of an export. The document is read again, as the person."""
    # pylint: disable=import-outside-toplevel
    from superset.auradata.assistant.turns import open_dashboard

    artifact = find_artifact(UUID(job["artifact_id"]), user.id)
    version = version_of(artifact.id) if artifact else None
    if version is None or open_dashboard(artifact.dashboard_id) is None:
        return {**job, "status": FAILED}
    pdf = document_pdf(artifact.id, version.title)
    log_document(ACTION_EXPORT, artifact, version)
    return {
        **job,
        "status": DONE,
        "file_name": file_name(version.title, datetime.now(), "pdf"),
        "pdf": base64.b64encode(pdf).decode("ascii"),
    }


def run_export(store: TurnStore, job_id: str) -> None:
    """The body of the task: only a ticket the server wrote says who it acts for."""
    job = store.export(job_id)
    if job is None or job["status"] != PENDING:
        return
    user = db.session.get(security_manager.user_model, job["user_id"])
    if user is None or not user.is_active:
        store.save_export(job_id, {**job, "status": FAILED})
        return
    with (
        current_app.test_request_context(method="POST"),
        force_locale(job["locale"] or "es"),
        override_user(user),
    ):
        g._login_user = user  # pylint: disable=protected-access
        try:
            store.save_export(job_id, _export(job, user))
        except Exception:  # pylint: disable=broad-except
            logger.exception("A document could not be exported")
            store.save_export(job_id, {**job, "status": FAILED})
