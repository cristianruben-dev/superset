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
Documents of the assistant, from the real endpoints to the real tools and tables: what a
block can hold, who reaches a document, and that each change is a new version.
"""

from typing import Any
from uuid import UUID, uuid4

import pytest
from pydantic import TypeAdapter, ValidationError
from pytest_mock import MockerFixture

from superset.auradata.assistant import artifacts as artifacts_module
from superset.auradata.assistant.artifact_blocks import (
    Block,
    ChangeArtifact,
    CreateArtifact,
    MAX_BLOCKS,
    MAX_ROWS,
    MAX_TEXT_CHARS,
)
from superset.auradata.assistant.artifact_tools import log_params, OWN_TOOLS
from superset.auradata.assistant.artifacts import (
    ARTIFACT_TOOLS,
    CHANGE_ARTIFACT,
    CREATE_ARTIFACT,
    MAX_PER_CONVERSATION,
    READ_ARTIFACT,
)
from superset.auradata.assistant.conversations import (
    ConversationLog,
    erase_conversations,
    find_conversation,
    records_of,
)
from superset.auradata.assistant.tools import MODE_READ, ToolBox
from superset.auradata.models import (
    AssistantArtifact,
    AssistantArtifactVersion,
    AssistantMessage,
)
from superset.extensions import db
from superset.mcp_service.app import mcp
from superset.utils import json
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    login,
    payloads,
    session_engine,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text, tool_use

ADAPTER: TypeAdapter[Any] = TypeAdapter(Block)


def text_block(value: str = "Las ventas subieron.") -> dict[str, Any]:
    return {"type": "text", "text": value}


def query(dataset_id: int, **fields: Any) -> dict[str, Any]:
    return {"dataset_id": dataset_id, "metrics": ["total"], **fields}


def figure_block(dataset_id: int, **fields: Any) -> dict[str, Any]:
    return {
        "type": "figure",
        "label": "Ventas",
        "query": query(dataset_id, **fields),
    }


def chart_block(dataset_id: int, chart: str = "bar") -> dict[str, Any]:
    return {
        "type": "chart",
        "title": "Por región",
        "chart": chart,
        "query": query(dataset_id, columns=["region"]),
    }


def table_block(dataset_id: int) -> dict[str, Any]:
    return {
        "type": "table",
        "title": "Regiones",
        "query": query(dataset_id, columns=["region"]),
    }


def create(*blocks: dict[str, Any], title: str = "Resumen") -> dict[str, Any]:
    return tool_use(CREATE_ARTIFACT, {"title": title, "blocks": list(blocks)})


def run(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    call: dict[str, Any],
    **fields: Any,
) -> tuple[Any, str]:
    """A turn in which the model makes this call, with its result and conversation."""
    use_model(mocker, reply(call, stop_reason="tool_use"), reply(text("Listo")))
    response = ask(client, world["dashboard"], **fields)
    conversation_id = conversation_id_of(response)
    return result_of(response), conversation_id


def result_of(response: Any) -> dict[str, Any]:
    """The tool_end of the only call of a turn."""
    return payloads(response, "tool_end")[0]


def stored_result(world: dict[str, Any]) -> str:  # noqa: F811
    """What the last call answered the model."""
    rows = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.role == "user")
        .all()
    )
    blocks = [
        block
        for row in rows
        for block in json.loads(row.content)
        if block["type"] == "tool_result"
    ]
    return blocks[-1]["content"][0]["text"]


def document(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    *blocks: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    """A document made by a turn. Gives what the chat learned, and the conversation."""
    ended, conversation_id = run(client, world, mocker, create(*blocks))
    assert not ended["is_error"], stored_result(world)
    return ended["artifact"], conversation_id


def read(client: Any, artifact_id: str) -> Any:
    return client.get(f"{URL}artifacts/{artifact_id}/")


def change_call(
    artifact: dict[str, Any], *changes: dict[str, Any], **fields: Any
) -> dict[str, Any]:
    return tool_use(
        CHANGE_ARTIFACT,
        {
            "artifact_id": artifact["id"],
            "version": artifact["version"],
            "changes": list(changes),
            **fields,
        },
    )


def refuse_datasets(mocker: MockerFixture) -> None:
    """A person who opens the report, and whom every dataset refuses."""
    guard = mocker.MagicMock()
    guard.raise_for_access.side_effect = artifacts_module.SupersetSecurityException(
        mocker.MagicMock()
    )
    mocker.patch.object(artifacts_module, "security_manager", guard)


# What a block can hold


@pytest.mark.parametrize(
    "block",
    [
        {"type": "video", "url": "x"},
        {"type": "text", "text": "hola", "written_on": "2020-01-01"},
        {"type": "text", "text": "hola", "id": "mine"},
        {"type": "text", "text": "   "},
        {"type": "text", "text": "x" * (MAX_TEXT_CHARS + 1)},
        {"type": "text", "text": "<b>hola</b>"},
        {"type": "text", "text": "<https://otro.example/x>"},
        {"type": "text", "text": "![a](https://otro.example/x.png)"},
        {"type": "text", "text": "![a](/static/x.png)"},
        {"type": "text", "text": "[a](https://otro.example)"},
        {"type": "text", "text": "[a](//otro.example)"},
        {"type": "text", "text": "[a](javascript:alert(1))"},
        {"type": "figure", "label": "x", "value": 10, "query": query(1)},
        {"type": "figure", "label": "x", "query": {**query(1), "rows": [{"a": 1}]}},
        {"type": "figure", "label": "x", "query": query(1, columns=["a"])},
        {"type": "figure", "label": "x", "query": {"dataset_id": 1}},
        {"type": "figure", "label": "a\nb", "query": query(1)},
        {"type": "figure", "label": "x", "format": "html", "query": query(1)},
        {"type": "chart", "title": "x", "chart": "radar", "query": query(1)},
        {"type": "chart", "title": "x", "chart": "bar", "query": query(1)},
        {
            "type": "chart",
            "title": "x",
            "chart": "pie",
            "query": query(1, columns=["a", "b"]),
        },
        {"type": "table", "title": "x", "query": {"dataset_id": 1}},
        {
            "type": "table",
            "title": "x",
            "query": query(1, row_limit=MAX_ROWS + 1),
        },
        {
            "type": "table",
            "title": "x",
            "query": query(1, sql="SELECT 1"),
        },
        {
            "type": "table",
            "title": "x",
            "query": query(1, filters=[{"col": "a", "op": "DROP", "val": 1}]),
        },
        {
            "type": "table",
            "title": "x",
            "query": query(1, filters=[{"col": "a", "op": "==", "val": {"a": 1}}]),
        },
        {
            "type": "table",
            "title": "x",
            "query": query(1, filters=[{"col": "a", "op": "==", "x": 1}]),
        },
        {
            "type": "table",
            "title": "x",
            "query": query(1, aggregates=[{"column": "a", "aggregate": "DROP"}]),
        },
        {"type": "table", "title": "x", "query": query("uno")},
        {"type": "table", "title": "x", "query": query(0)},
        {"type": "table", "title": "x", "query": query(1, time_range="ayer o algo")},
    ],
)
def test_a_block_that_does_not_fit_is_refused(block: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        ADAPTER.validate_python(block)


@pytest.mark.parametrize(
    "block",
    [
        text_block("## Ventas\n\n**Subieron** si a < b, según [el informe](/x/)."),
        figure_block(1),
        figure_block(1, time_range="Last year") | {"format": "currency"},
        chart_block(1, "line"),
        chart_block(1, "pie"),
        table_block(1),
    ],
)
def test_the_blocks_a_document_is_made_of(block: dict[str, Any]) -> None:
    assert ADAPTER.validate_python(block).type == block["type"]


def test_a_document_has_a_limit_of_blocks() -> None:
    with pytest.raises(ValidationError):
        CreateArtifact.model_validate(
            {"title": "x", "blocks": [text_block()] * (MAX_BLOCKS + 1)}
        )


def test_a_change_has_no_field_for_an_owner() -> None:
    with pytest.raises(ValidationError):
        ChangeArtifact.model_validate(
            {"artifact_id": "x", "version": 1, "user_id": 1, "changes": []}
        )


# The tools


def test_the_tools_stay_out_of_the_mcp_catalog() -> None:
    import asyncio

    names = {tool.name for tool in asyncio.run(mcp.list_tools(run_middleware=False))}
    assert not names & ARTIFACT_TOOLS
    assert set(OWN_TOOLS) == ARTIFACT_TOOLS


def test_they_are_offered_in_read_mode_with_no_card(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    fake = use_model(mocker, reply(text("Hola")))

    assert ask(client, world["dashboard"], mode=MODE_READ).status_code == 200

    tools = {tool["name"]: tool for tool in fake.requests[0]["tools"]}
    assert ARTIFACT_TOOLS <= set(tools)
    assert not any(tools[name].get("defer_loading") for name in ARTIFACT_TOOLS)
    box = ToolBox("ana", MODE_READ)
    for name in ARTIFACT_TOOLS:
        assert not box.needs_confirmation(name)
        assert not box.changes_something(name)


def test_a_document_is_created_from_a_turn_of_read_mode(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    dataset = world["ventas"].id

    response_end, conversation_id = run(
        client,
        world,
        mocker,
        create(
            text_block(),
            figure_block(dataset),
            chart_block(dataset),
            table_block(dataset),
        ),
    )

    assert response_end["artifact"]["title"] == "Resumen"
    assert response_end["artifact"]["version"] == 1
    assert "changed" not in response_end or response_end["changed"] is False
    found = read(client, response_end["artifact"]["id"]).json["result"]
    assert found["conversation_id"] == conversation_id
    assert [block["type"] for block in found["blocks"]] == [
        "text",
        "figure",
        "chart",
        "table",
    ]
    assert all(block["id"] for block in found["blocks"])
    assert found["blocks"][0]["written_on"]
    assert found["sources"] == {str(dataset): "ventas"}
    assert [item["origin"] for item in found["versions"]] == ["created"]


def test_a_data_block_stores_its_query_and_no_number(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, figure_block(world["ventas"].id))

    version = world["session"].query(AssistantArtifactVersion).one()
    stored = json.loads(version.blocks)[0]

    assert stored["query"]["metrics"] == ["total"]
    assert set(stored) == {"id", "type", "label", "format", "query"}
    assert read(client, artifact["id"]).json["result"]["blocks"] == [stored]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("metrics", ["inventada"]),
        ("columns", ["inventada"]),
        ("filters", [{"col": "inventada", "op": "==", "val": 1}]),
        ("order_by", ["inventada"]),
        ("aggregates", [{"column": "inventada", "aggregate": "SUM"}]),
    ],
)
def test_a_query_is_held_against_its_dataset(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    field: str,
    value: Any,
) -> None:
    login(world, "Ana")
    block = table_block(world["ventas"].id)
    block["query"][field] = value

    ended, _ = run(client, world, mocker, create(block))

    assert ended["is_error"]
    assert world["session"].query(AssistantArtifact).count() == 0


def test_a_time_range_stores_the_column_it_reads(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    world["ventas"].main_dttm_col = "region"
    world["session"].commit()

    artifact, _ = document(
        client,
        world,
        mocker,
        figure_block(world["ventas"].id, time_range="Last year"),
    )

    block = read(client, artifact["id"]).json["result"]["blocks"][0]
    assert block["query"]["time_column"] == "region"


def test_a_dataset_the_person_cannot_reach_is_refused_when_stored(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    refuse_datasets(mocker)

    ended, _ = run(client, world, mocker, create(figure_block(world["ventas"].id)))

    assert ended["is_error"]
    assert "No dataset you can reach" in stored_result(world)
    assert world["session"].query(AssistantArtifact).count() == 0


def test_a_person_without_data_model_access_cannot_name_a_dataset(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    mocker.patch(
        "superset.mcp_service.privacy.user_can_view_data_model_metadata",
        return_value=False,
    )

    ended, _ = run(client, world, mocker, create(figure_block(world["ventas"].id)))

    assert ended["is_error"]


def test_a_dataset_of_another_workspace_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Root")
    use_model(
        mocker,
        reply(create(figure_block(world["ventas"].id)), stop_reason="tool_use"),
        reply(text("Listo")),
    )

    response = ask(client, world["shared_dashboard"])

    assert result_of(response)["is_error"]
    assert "another workspace" in stored_result(world)


def test_each_change_is_a_new_version_and_old_ones_stay(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))
    first = read(client, artifact["id"]).json["result"]
    block_id = first["blocks"][0]["id"]

    ended, _ = run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {
                "action": "replace",
                "block_id": block_id,
                "block": text_block("Dos"),
            },
            {"action": "add", "after": block_id, "block": text_block("Tres")},
            title="Nuevo",
        ),
        conversation_id=conversation_id,
    )

    assert not ended["is_error"], stored_result(world)
    assert ended["artifact"] == {
        "id": artifact["id"],
        "title": "Nuevo",
        "version": 2,
    }
    found = read(client, artifact["id"]).json["result"]
    assert found["title"] == "Nuevo"
    assert [block["text"] for block in found["blocks"]] == ["Dos", "Tres"]
    assert found["blocks"][0]["id"] == block_id
    old = client.get(f"{URL}artifacts/{artifact['id']}/versions/1/").json["result"]
    assert old["title"] == "Resumen"
    assert [block["text"] for block in old["blocks"]] == ["Uno"]


def test_changes_remove_and_move_blocks(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(
        client, world, mocker, text_block("a"), text_block("b"), text_block("c")
    )
    a, b, c = [
        block["id"] for block in read(client, artifact["id"]).json["result"]["blocks"]
    ]

    run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {"action": "remove", "block_id": b},
            {"action": "move", "block_id": c, "after": None},
        ),
        conversation_id=conversation_id,
    )

    blocks = read(client, artifact["id"]).json["result"]["blocks"]
    assert [block["id"] for block in blocks] == [c, a]


def test_a_text_that_stays_keeps_its_date(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))
    block = read(client, artifact["id"]).json["result"]["blocks"][0]

    run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {
                "action": "replace",
                "block_id": block["id"],
                "block": text_block("Uno"),
            },
        ),
        conversation_id=conversation_id,
    )

    again = read(client, artifact["id"]).json["result"]["blocks"][0]
    assert again["written_on"] == block["written_on"]


def test_a_change_on_a_version_that_moved_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))
    assert (
        client.post(
            f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1}
        ).status_code
        == 200
    )

    ended, _ = run(
        client,
        world,
        mocker,
        change_call(artifact, title="Otro"),
        conversation_id=conversation_id,
    )

    assert ended["is_error"]
    assert "version 2" in stored_result(world)
    assert world["session"].query(AssistantArtifactVersion).count() == 2


def test_a_change_that_fails_halfway_stores_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))

    ended, _ = run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {"action": "add", "after": None, "block": text_block("Dos")},
            {"action": "remove", "block_id": "nope"},
        ),
        conversation_id=conversation_id,
    )

    assert ended["is_error"]
    assert world["session"].query(AssistantArtifactVersion).count() == 1


def test_a_document_cannot_lose_every_block(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))
    block_id = read(client, artifact["id"]).json["result"]["blocks"][0]["id"]

    ended, _ = run(
        client,
        world,
        mocker,
        change_call(artifact, {"action": "remove", "block_id": block_id}),
        conversation_id=conversation_id,
    )

    assert ended["is_error"]


def test_a_conversation_has_a_limit_of_documents(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    mocker.patch.object(artifacts_module, "MAX_PER_CONVERSATION", 1)
    _, conversation_id = document(client, world, mocker, text_block())

    ended, _ = run(
        client,
        world,
        mocker,
        create(text_block()),
        conversation_id=conversation_id,
    )

    assert ended["is_error"]
    assert MAX_PER_CONVERSATION > 1


def test_read_returns_the_whole_document_and_lists_without_an_id(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))

    run(
        client,
        world,
        mocker,
        tool_use(READ_ARTIFACT, {"artifact_id": artifact["id"]}),
        conversation_id=conversation_id,
    )
    whole = json.loads(stored_result(world))
    run(
        client,
        world,
        mocker,
        tool_use(READ_ARTIFACT, {}),
        conversation_id=conversation_id,
    )
    listed = json.loads(stored_result(world))

    assert whole["blocks"][0]["text"] == "Uno"
    assert listed["artifacts"] == [artifact]


def test_the_action_log_keeps_no_content() -> None:
    params = log_params(
        {
            "artifact_id": "a",
            "version": 2,
            "title": "secreto",
            "changes": [
                {"action": "replace", "block_id": "b", "block": text_block("secreto")}
            ],
        }
    )

    assert "secreto" not in json.dumps(params)
    assert params["changes"] == [{"action": "replace", "block_id": "b"}]


def test_a_document_of_someone_else_reads_as_one_that_does_not_exist(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ada")
    artifact, _ = document(client, world, mocker, text_block("Mío"))
    missing = str(uuid4())

    login(world, "Ana")
    ended, _ = run(client, world, mocker, change_call(artifact, title="Robado"))
    theirs = stored_result(world)
    ended_missing, _ = run(
        client, world, mocker, change_call({**artifact, "id": missing}, title="x")
    )

    assert ended["is_error"]
    assert ended_missing["is_error"]
    assert theirs == stored_result(world)
    assert world["session"].query(AssistantArtifactVersion).count() == 1


def test_a_document_of_another_conversation_of_the_same_person_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block("Uno"))

    ended, _ = run(client, world, mocker, change_call(artifact, title="Otro"))

    assert ended["is_error"]
    assert world["session"].query(AssistantArtifactVersion).count() == 1


# The endpoints


def test_only_the_owner_reads_a_document_an_admin_neither(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block())

    assert read(client, artifact["id"]).status_code == 200
    for name in ("Vera", "Root"):
        login(world, name)
        assert read(client, artifact["id"]).status_code == 404
        assert (
            client.get(f"{URL}artifacts/{artifact['id']}/versions/1/").status_code
            == 404
        )
        assert (
            client.post(
                f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1}
            ).status_code
            == 404
        )
        assert client.get(f"{URL}conversations/{conversation_id}/").status_code == 404


def test_a_document_closes_with_its_report(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    mocker.patch("superset.auradata.assistant.api.open_dashboard", return_value=None)

    assert read(client, artifact["id"]).status_code == 404


def test_a_key_or_a_guest_reads_no_document(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    mocker.patch(
        "superset.auradata.assistant.api._session_user_only", return_value=False
    )

    assert read(client, artifact["id"]).status_code == 403


def test_sources_only_name_the_datasets_the_reader_reaches(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, figure_block(world["ventas"].id))
    refuse_datasets(mocker)

    found = read(client, artifact["id"]).json["result"]

    assert found["sources"] == {}
    assert found["blocks"][0]["query"]["dataset_id"] == world["ventas"].id


def test_going_back_adds_a_version_with_the_old_content(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Uno"))
    block = read(client, artifact["id"]).json["result"]["blocks"][0]
    run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {
                "action": "replace",
                "block_id": block["id"],
                "block": text_block("Dos"),
            },
        ),
        conversation_id=conversation_id,
    )

    response = client.post(
        f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1}
    )

    result = response.json["result"]
    assert response.status_code == 200
    assert result["version"] == 3
    assert result["blocks"] == [block]
    assert [
        (v["number"], v["origin"], v["restored_from"]) for v in result["versions"]
    ] == [
        (1, "created", None),
        (2, "changed", None),
        (3, "restored", 1),
    ]
    conversation = find_conversation(UUID(conversation_id), world["users"]["Ana"].id)
    assert records_of(conversation)[-1]["type"] == "artifact_restored"


def test_going_back_during_a_turn_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    turn_memory: Any,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block())
    mocker.patch("superset.auradata.assistant.api.settle_turn")
    assert turn_memory.acquire(conversation_id, "another")

    response = client.post(
        f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1}
    )

    assert response.status_code == 409
    assert world["session"].query(AssistantArtifactVersion).count() == 1


def test_going_back_to_data_out_of_reach_is_refused(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, figure_block(world["ventas"].id))
    mocker.patch.object(artifacts_module, "can_reach", return_value=False)

    response = client.post(
        f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1}
    )

    assert response.status_code == 422
    assert world["session"].query(AssistantArtifactVersion).count() == 1


def test_a_version_that_does_not_exist_is_a_404(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())

    url = f"{URL}artifacts/{artifact['id']}/"
    assert client.post(f"{url}restore/", json={"version": 9}).status_code == 404
    assert client.get(f"{url}versions/9/").status_code == 404


def test_a_stored_conversation_says_which_documents_it_has(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block())

    stored = client.get(f"{URL}conversations/{conversation_id}/").json["result"]

    assert stored["artifacts"] == [artifact]
    assert stored["artifact_calls"] == {"toolu_1": artifact}


# The selected block


def page_context_of(fake: Any) -> dict[str, Any]:
    blocks = fake.requests[0]["messages"][-1]["content"]
    head = "<page_context>"
    found = next(block["text"] for block in blocks if head in block.get("text", ""))
    return json.loads(found[len(head) : -len("</page_context>")])


def test_the_selected_block_reaches_the_model_from_what_is_stored(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(
        client, world, mocker, figure_block(world["ventas"].id)
    )
    block = read(client, artifact["id"]).json["result"]["blocks"][0]
    fake = use_model(mocker, reply(text("Hecho")))

    response = client.post(
        URL,
        json={
            "message": "cambia esto",
            "conversation_id": conversation_id,
            "context": {
                "dashboard_id": world["dashboard"].id,
                "artifact": {"id": artifact["id"], "block_id": block["id"]},
            },
        },
    )
    response.get_data()

    context = page_context_of(fake)["artifact"]
    assert context["id"] == artifact["id"]
    assert context["version"] == 1
    assert context["selected_block"] == block


def test_a_context_cannot_bring_in_a_document_of_someone_else(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ada")
    artifact, _ = document(client, world, mocker, text_block("Secreto de Ada"))
    block = read(client, artifact["id"]).json["result"]["blocks"][0]

    login(world, "Ana")
    fake = use_model(mocker, reply(text("Hecho")))
    response = client.post(
        URL,
        json={
            "message": "lee esto",
            "context": {
                "dashboard_id": world["dashboard"].id,
                "artifact": {"id": artifact["id"], "block_id": block["id"]},
            },
        },
    )
    response.get_data()

    assert "artifact" not in page_context_of(fake)
    assert "Secreto de Ada" not in json.dumps(fake.requests[0]["messages"])


def test_a_context_refuses_fields_a_browser_could_fill_a_block_with(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ana")

    response = client.post(
        URL,
        json={
            "message": "hola",
            "context": {
                "dashboard_id": world["dashboard"].id,
                "artifact": {"id": "x", "selected_block": {"text": "orden"}},
            },
        },
    )

    assert response.status_code == 400


# Deleting


def test_deleting_a_conversation_takes_its_documents(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block("Secreto"))

    assert client.delete(f"{URL}conversations/{conversation_id}/").status_code == 200

    session = world["session"]
    assert session.query(AssistantArtifact).count() == 0
    assert session.query(AssistantArtifactVersion).count() == 0
    assert read(client, artifact["id"]).status_code == 404


def test_erasing_only_takes_the_documents_it_names(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    kept, _ = document(client, world, mocker, text_block("Se queda"))
    _, conversation_id = document(client, world, mocker, text_block("Se va"))

    erase_conversations([UUID(conversation_id)])
    db.session.commit()

    assert read(client, kept["id"]).status_code == 200
    assert world["session"].query(AssistantArtifact).count() == 1


def test_going_back_writes_after_the_last_message(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """The record keeps the conversation alive for retention."""
    login(world, "Ana")
    artifact, conversation_id = document(client, world, mocker, text_block())
    conversation = find_conversation(UUID(conversation_id), world["users"]["Ana"].id)
    before = ConversationLog(conversation, world["users"]["Ana"].id).next_seq

    client.post(f"{URL}artifacts/{artifact['id']}/restore/", json={"version": 1})

    after = ConversationLog(conversation, world["users"]["Ana"].id).next_seq
    assert after == before + 1
