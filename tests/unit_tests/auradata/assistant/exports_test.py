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
A document as a PDF: the ticket says who asked, the picture is taken as that person, and
the file only goes to them.
"""

import asyncio
import base64
import io
import time
from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest
from PIL import Image
from pytest_mock import MockerFixture

from superset.auradata.assistant import exports
from superset.auradata.assistant.exports import (
    DONE,
    EXPORT_SECONDS,
    FAILED,
    MAX_SHEETS,
    run_export,
    SHEET_HEIGHT,
    SHEET_WIDTH,
    sheets_of,
    start_export,
)
from superset.auradata.assistant.tools import run_coroutine
from superset.mcp_service.report_layout.editing import LayoutEditError
from tests.unit_tests.auradata.assistant.artifacts_test import document, text_block
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    login,
    session_engine,
    URL,
    world,
)
from tests.unit_tests.auradata.assistant.memory_store import MemoryTurnStore


def picture(height: int, width: int = SHEET_WIDTH) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(out, format="PNG")
    return out.getvalue()


@pytest.fixture
def queued(mocker: MockerFixture) -> Any:
    """Nothing goes to a real broker: the worker of a test runs when told."""
    return mocker.patch(
        "superset.tasks.assistant_export.run_assistant_export.apply_async"
    )


def test_a_picture_is_cut_into_whole_sheets() -> None:
    sheets = sheets_of(picture(SHEET_HEIGHT * 2 + 100))

    assert len(sheets) == 3
    assert all(sheet.size == (SHEET_WIDTH, SHEET_HEIGHT) for sheet in sheets)


def test_a_denser_window_gives_the_same_sheets_with_more_pixels() -> None:
    sheets = sheets_of(picture(SHEET_HEIGHT * 2 * 2, width=SHEET_WIDTH * 2))

    assert len(sheets) == 2
    assert sheets[0].size == (SHEET_WIDTH * 2, SHEET_HEIGHT * 2)


def test_a_document_has_a_limit_of_sheets() -> None:
    with pytest.raises(LayoutEditError):
        sheets_of(picture(SHEET_HEIGHT * (MAX_SHEETS + 1)))


def test_the_task_only_carries_the_id_of_a_ticket(
    world: dict[str, Any],  # noqa: F811
    queued: Any,
) -> None:
    store = MemoryTurnStore()

    artifact = SimpleNamespace(id=UUID(int=1), conversation_id=UUID(int=2))

    job_id = start_export(store, artifact, world["users"]["Ana"].id, "es")

    assert queued.call_args.kwargs["args"] == [job_id]
    assert store.export(job_id)["user_id"] == world["users"]["Ana"].id


def test_only_the_owner_exports_and_gets_the_file(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: MemoryTurnStore,
    queued: Any,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    url = f"{URL}artifacts/{artifact['id']}/export/"

    response = client.post(url)
    assert response.status_code == 202
    job = response.json["result"]["job_id"]
    assert client.get(f"{url}{job}/").status_code == 202

    pdf = mocker.patch.object(exports, "document_pdf", return_value=b"%PDF-1.4")
    log = mocker.patch.object(exports, "log_document")
    run_export(turn_memory, job)
    pdf.assert_called_once()
    log.assert_called_once()

    done = client.get(f"{url}{job}/")
    assert done.status_code == 200
    assert done.mimetype == "application/pdf"
    assert done.data == b"%PDF-1.4"
    assert "attachment" in done.headers["Content-Disposition"]

    login(world, "Vera")
    assert client.get(f"{url}{job}/").status_code == 404
    assert client.post(url).status_code == 404


def test_a_file_is_served_only_while_its_owner_reaches_the_document(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: MemoryTurnStore,
    queued: Any,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    url = f"{URL}artifacts/{artifact['id']}/export/"
    job = client.post(url).json["result"]["job_id"]
    mocker.patch.object(exports, "document_pdf", return_value=b"%PDF-1.4")
    mocker.patch.object(exports, "log_document")
    run_export(turn_memory, job)
    assert client.get(f"{url}{job}/").status_code == 200

    mocker.patch("superset.auradata.assistant.api.open_dashboard", return_value=None)

    assert client.get(f"{url}{job}/").status_code == 404


def test_a_deleted_conversation_takes_its_exports_with_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: MemoryTurnStore,
    queued: Any,
) -> None:
    login(world, "Ana")
    artifact, conversation = document(client, world, mocker, text_block())
    url = f"{URL}artifacts/{artifact['id']}/export/"
    job = client.post(url).json["result"]["job_id"]
    mocker.patch.object(exports, "document_pdf", return_value=b"%PDF-1.4")
    mocker.patch.object(exports, "log_document")
    run_export(turn_memory, job)
    assert turn_memory.export(job) is not None

    assert client.delete(f"{URL}conversations/{conversation}/").status_code == 200

    assert turn_memory.export(job) is None
    assert client.get(f"{url}{job}/").status_code == 404


def test_a_ticket_is_held_against_the_document_again(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: MemoryTurnStore,
    queued: Any,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    pdf = mocker.patch.object(exports, "document_pdf")
    turn_memory.save_export(
        "stolen",
        {
            "status": exports.PENDING,
            "artifact_id": artifact["id"],
            "conversation_id": str(UUID(int=9)),
            "user_id": world["users"]["Vera"].id,
            "locale": "es",
            "opened_at": time.time(),
        },
    )

    run_export(turn_memory, "stolen")

    pdf.assert_not_called()
    assert turn_memory.export("stolen")["status"] == FAILED


def test_a_failed_capture_says_so_and_a_lost_one_stops_waiting(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: MemoryTurnStore,
    queued: Any,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    url = f"{URL}artifacts/{artifact['id']}/export/"
    mocker.patch.object(exports, "document_pdf", side_effect=LayoutEditError("No"))

    failed = client.post(url).json["result"]["job_id"]
    run_export(turn_memory, failed)
    assert client.get(f"{url}{failed}/").status_code == 422

    lost = client.post(url).json["result"]["job_id"]
    job = turn_memory.export(lost)
    turn_memory.save_export(
        lost, {**job, "opened_at": time.time() - EXPORT_SECONDS * 3}
    )
    assert client.get(f"{url}{lost}/").status_code == 422


def test_the_file_of_a_finished_ticket_is_the_one_stored() -> None:
    store = MemoryTurnStore()
    store.save_export(
        "x",
        {
            "status": DONE,
            "artifact_id": str(UUID(int=2)),
            "user_id": 1,
            "pdf": base64.b64encode(b"a").decode(),
        },
    )

    assert exports.job_of(store, "x", UUID(int=2), 1)["status"] == DONE
    assert exports.job_of(store, "x", UUID(int=2), 2) is None
    assert exports.job_of(store, "x", UUID(int=3), 1) is None


def test_a_tool_runs_on_a_thread_where_playwright_left_a_loop_running() -> None:
    async def inner() -> int:
        return 7

    async def thread_with_a_running_loop() -> int:
        return run_coroutine(inner())

    assert asyncio.run(thread_with_a_running_loop()) == 7
    assert run_coroutine(inner()) == 7
