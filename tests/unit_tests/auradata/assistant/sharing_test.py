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
A document shared inside its workspace, through the real endpoints: who reads it, what
reaches them and when it closes. The world is the one of the assistant: Ana and Ada work
in «Ventas», Vera is a viewer there, Carlos is in «Finanzas», Dani in no workspace and
Root is a Superset admin who belongs to neither. After a document is written, nobody
keeps a data permission (``only_the_grant``), so the real access checks decide.
"""

from typing import Any
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset import security_manager
from superset.auradata import workspaces
from superset.auradata.action_log import ASSISTANT_DOCUMENT, select_records
from superset.auradata.assistant import sharing
from superset.auradata.assistant.turns import open_dashboard as real_open_dashboard
from superset.auradata.models import (
    AssistantArtifact,
    AssistantArtifactVersion,
    WorkspaceMember,
)
from superset.commands.dashboard.exceptions import DashboardAccessDeniedError
from superset.connectors.sqla.models import SqlMetric
from superset.daos.dashboard import DashboardDAO
from superset.extensions import event_logger
from superset.utils import json
from tests.unit_tests.auradata.assistant.artifacts_test import (
    change_call,
    document,
    figure_block,
    run,
    stored_result,
    table_block,
    text_block,
)
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    login,
    session_engine,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text, tool_use

WRITTEN_TEXT = "Las ventas de ACME fueron 1.234,50 en marzo."
HIDDEN_LABEL = "Margen secreto de la cuenta ACME"


def page(client: Any, artifact_id: str) -> Any:
    return client.get(f"{URL}documents/{artifact_id}/")


def share(client: Any, artifact_id: str, version: int = 1) -> Any:
    return client.post(
        f"{URL}artifacts/{artifact_id}/share/", json={"version": version}
    )


def only_the_grant(world: dict[str, Any], mocker: MockerFixture) -> None:  # noqa: F811
    """From here on nobody holds a data permission: as a Gamma role over the classes."""
    allowed = {
        ("can_read", "Dashboard"),
        ("can_read", "Chart"),
        ("can_read", "Dataset"),
        ("can_get_drill_info", "Dataset"),
    }
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: (permission, view) in allowed,
    )
    for check in ("can_access_schema", "can_access_all_datasources"):
        mocker.patch.object(security_manager, check, return_value=False)
    mocker.patch.object(security_manager, "can_access_database", return_value=False)


@pytest.fixture
def shared(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> dict[str, Any]:
    """A document of Ana: a text, a block she reaches and one of a shared dataset."""
    login(world, "Ana")
    world["compartido"].metrics.append(SqlMetric(metric_name="total", expression="1"))
    world["session"].commit()
    secret = {**figure_block(world["compartido"].id), "label": HIDDEN_LABEL}
    artifact, conversation_id = document(
        client,
        world,
        mocker,
        text_block(WRITTEN_TEXT),
        table_block(world["ventas"].id),
        secret,
    )
    assert share(client, artifact["id"]).status_code == 200
    only_the_grant(world, mocker)
    return {"id": artifact["id"], "conversation": conversation_id}


def test_a_member_reads_the_text_and_who_wrote_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")
    response = page(client, shared["id"])

    assert response.status_code == 200
    result = response.json["result"]
    assert result["reader"] is True
    assert result["author"] == "Ana T"
    assert result["written_on"]
    assert result["shared_on"]
    assert result["blocks"][0]["text"] == WRITTEN_TEXT


def test_a_reader_gets_no_conversation_no_history_and_no_owner_fields(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")
    result = page(client, shared["id"]).json["result"]

    assert not {"conversation_id", "versions", "share"} & set(result)
    assert client.get(f"{URL}artifacts/{shared['id']}/versions/1/").status_code == 404
    assert client.get(f"{URL}artifacts/{shared['id']}/").status_code == 404
    assert (
        client.get(f"{URL}conversations/{shared['conversation']}/").status_code == 404
    )


@pytest.mark.parametrize("name", ["Carlos", "Dani", "Root"])
def test_outside_the_workspace_a_document_does_not_exist(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    name: str,
) -> None:
    login(world, name)

    assert page(client, shared["id"]).status_code == 404


def test_an_anonymous_visitor_gets_the_same_404(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.auradata.assistant.api._session_user_only", return_value=False
    )

    assert page(client, shared["id"]).status_code == 404


def test_a_document_of_nobody_shared_is_a_404_too(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    login(world, "Vera")

    assert page(client, artifact["id"]).status_code == 404


def test_a_block_out_of_reach_shows_nothing_of_itself(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")
    response = page(client, shared["id"])
    blocks = response.json["result"]["blocks"]

    assert [block["type"] for block in blocks] == ["text", "table", "refused"]
    assert set(blocks[2]) == {"id", "type"}
    body = response.get_data(as_text=True)
    assert HIDDEN_LABEL not in body
    assert "compartido" not in body
    assert str(world["compartido"].id) not in response.json["result"]["sources"]


def test_a_block_within_reach_carries_its_query_and_no_number(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")
    result = page(client, shared["id"]).json["result"]

    assert result["sources"] == {str(world["ventas"].id): "ventas"}
    assert result["blocks"][1]["query"]["dataset_id"] == world["ventas"].id
    assert "rows" not in result["blocks"][1]


def test_a_reader_stays_on_the_version_shared(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    blocks = client.get(f"{URL}artifacts/{shared['id']}/").json["result"]["blocks"]
    mocker.patch.object(security_manager, "can_access", return_value=True)
    run(
        client,
        world,
        mocker,
        change_call(
            {"id": shared["id"], "version": 1},
            {
                "action": "replace",
                "block_id": blocks[0]["id"],
                "block": text_block("Un secreto escrito después."),
            },
        ),
        conversation_id=shared["conversation"],
    )
    login(world, "Vera")

    result = page(client, shared["id"]).json["result"]
    assert result["version"] == 1
    assert result["blocks"][0]["text"] == WRITTEN_TEXT


def test_a_reader_writes_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    session: Any,
) -> None:
    login(world, "Vera")
    url = f"{URL}artifacts/{shared['id']}"

    assert client.get(f"{url}/share/").status_code == 404
    assert share(client, shared["id"]).status_code == 404
    assert client.delete(f"{url}/share/").status_code == 404
    assert client.post(f"{url}/restore/", json={"version": 1}).status_code == 404
    assert client.post(f"{url}/export/").status_code == 404
    assert session.query(AssistantArtifactVersion).count() == 1
    assert session.get(AssistantArtifact, UUID(shared["id"])).shared_version == 1


def test_a_shared_document_never_reaches_the_model_of_a_reader(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    login(world, "Vera")
    mocker.patch.object(security_manager, "can_access", return_value=True)
    use_model(
        mocker,
        reply(
            tool_use("read_artifact", {"artifact_id": shared["id"]}),
            stop_reason="tool_use",
        ),
        reply(text("No lo veo")),
    )

    ask(client, world["dashboard"], message="Lee el documento")

    assert "does not exist" in stored_result(world)
    assert WRITTEN_TEXT not in stored_result(world)


def test_unsharing_closes_it_at_once(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Ana")
    assert client.delete(f"{URL}artifacts/{shared['id']}/share/").status_code == 200

    login(world, "Vera")
    assert page(client, shared["id"]).status_code == 404
    login(world, "Ana")
    assert page(client, shared["id"]).status_code == 200


def test_a_member_who_leaves_stops_reading(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")
    workspaces.remove_member(world["ventas_ws"].id, world["users"]["Vera"].id)

    assert page(client, shared["id"]).status_code == 404


def test_when_its_author_leaves_the_share_ends_for_good(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    session: Any,
) -> None:
    login(world, "Ana")
    workspaces.remove_member(world["ventas_ws"].id, world["users"]["Ana"].id)
    login(world, "Vera")
    assert page(client, shared["id"]).status_code == 404

    session.add(
        WorkspaceMember(
            workspace_id=world["ventas_ws"].id,
            user_id=world["users"]["Ana"].id,
            role="contributor",
        )
    )
    session.commit()
    assert page(client, shared["id"]).status_code == 404


def test_a_report_that_moves_closes_the_share_for_good(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    login(world, "Ada")
    mocker.patch.object(security_manager, "raise_for_editorship")
    mocker.patch.object(workspaces, "datasets_of_other_workspaces", return_value=[])
    dashboard_id = world["dashboard"].id
    workspaces.move_dashboards(world["ventas_ws"].id, {"remove": [dashboard_id]})
    login(world, "Vera")
    assert page(client, shared["id"]).status_code == 404

    login(world, "Ada")
    workspaces.move_dashboards(world["ventas_ws"].id, {"add": [dashboard_id]})
    login(world, "Vera")
    assert page(client, shared["id"]).status_code == 404


def test_a_share_whose_report_moved_by_another_path_stays_closed(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    session: Any,
) -> None:
    artifact = session.get(AssistantArtifact, UUID(shared["id"]))
    artifact.shared_workspace_id = world["finanzas_ws"].id
    session.commit()
    login(world, "Vera")

    assert page(client, shared["id"]).status_code == 404


def test_a_document_of_a_draft_stays_with_those_who_see_the_draft(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    def only_contributors(*_args: Any) -> Any:
        if not sharing.is_member(world["ventas_ws"].id, world["signed_in"]):
            raise DashboardAccessDeniedError
        if world["signed_in"] == world["users"]["Vera"].id:
            raise DashboardAccessDeniedError
        return world["dashboard"]

    mocker.patch.object(
        DashboardDAO, "get_by_id_or_slug", side_effect=only_contributors
    )
    login(world, "Vera")
    assert real_open_dashboard(world["dashboard"].id) is None
    assert page(client, shared["id"]).status_code == 404

    login(world, "Ada")
    assert page(client, shared["id"]).status_code == 200


def test_the_card_says_what_the_text_includes(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    filtered = {
        **table_block(world["ventas"].id),
    }
    filtered["query"] = {
        **filtered["query"],
        "filters": [{"col": "region", "op": "==", "val": "Norte"}],
    }
    artifact, _ = document(
        client,
        world,
        mocker,
        text_block("Sin cifras."),
        text_block(WRITTEN_TEXT),
        filtered,
    )

    card = client.get(f"{URL}artifacts/{artifact['id']}/share/").json["result"]

    assert card["workspace"] == "Ventas"
    assert card["members"] == 3
    assert card["text_blocks"] == 2
    assert card["numbers"] == 1
    assert card["passages"] == [WRITTEN_TEXT]
    assert card["filters"] == [{"column": "region", "values": ["Norte"]}]
    assert card["datasets"] == [{"name": "ventas", "for_every_member": True}]
    assert card["problem"] is None


def test_what_was_not_on_the_card_is_not_shared(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())

    assert share(client, artifact["id"], version=2).status_code == 409


def test_a_report_out_of_a_workspace_has_nowhere_to_share(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    session: Any,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    mocker.patch.object(sharing, "workspace_id_of", return_value=None)

    assert (
        client.get(f"{URL}artifacts/{artifact['id']}/share/").json["result"]["problem"]
        == sharing.NO_WORKSPACE
    )
    assert share(client, artifact["id"]).status_code == 422
    assert session.get(AssistantArtifact, UUID(artifact["id"])).shared_version is None


def test_the_owner_sees_where_it_is_shared(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Ana")

    found = client.get(f"{URL}artifacts/{shared['id']}/").json["result"]["share"]

    assert found["version"] == 1
    assert found["workspace"] == "Ventas"


def test_a_reader_with_only_gamma_data_rights_reads_the_blocks_of_the_workspace(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    login(world, "Vera")

    types = [
        item["type"] for item in page(client, shared["id"]).json["result"]["blocks"]
    ]

    assert types == ["text", "table", "refused"]


def test_a_role_kept_out_of_the_data_model_gets_every_block_hidden(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    """Its queries name columns and filter values, which that role does not get."""
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, view: (permission, view)
        == ("can_read", "Dashboard"),
    )
    login(world, "Vera")

    result = page(client, shared["id"]).json["result"]

    assert [item["type"] for item in result["blocks"]] == [
        "text",
        "refused",
        "refused",
    ]
    assert result["sources"] == {}


def test_an_author_who_lost_the_report_can_still_stop_sharing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
    session: Any,
) -> None:
    mocker.patch("superset.auradata.assistant.api.open_dashboard", return_value=None)
    mocker.patch(
        "superset.auradata.assistant.turns.DashboardDAO.get_by_id_or_slug",
        side_effect=DashboardAccessDeniedError,
    )
    login(world, "Ana")
    listed = client.get(f"{URL}documents/?workspace_id={world['ventas_ws'].id}")
    assert [item["opens"] for item in listed.json["result"]] == [False]

    assert client.delete(f"{URL}artifacts/{shared['id']}/share/").status_code == 200

    assert session.get(AssistantArtifact, UUID(shared["id"])).shared_version is None
    login(world, "Vera")
    assert client.delete(f"{URL}artifacts/{shared['id']}/share/").status_code == 404


def test_a_workspace_lists_what_each_member_reads(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
) -> None:
    url = f"{URL}documents/?workspace_id={world['ventas_ws'].id}"
    login(world, "Vera")
    assert [item["id"] for item in client.get(url).json["result"]] == [shared["id"]]

    login(world, "Carlos")
    assert client.get(url).status_code == 404


def test_the_action_log_keeps_who_shared_what_and_the_model(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    log = mocker.patch.object(event_logger, "log")
    login(world, "Ana")
    client.delete(f"{URL}artifacts/{shared['id']}/share/")

    payload = log.call_args.kwargs["curated_payload"]
    assert log.call_args.kwargs["action"] == ASSISTANT_DOCUMENT
    assert payload["action"] == sharing.ACTION_UNSHARE
    assert payload["model"]
    assert WRITTEN_TEXT not in json.dumps(payload)
    assert select_records(ASSISTANT_DOCUMENT, [{"a": 1}]) == [{"a": 1}]


def test_going_back_keeps_the_model_that_wrote_it(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    artifact, _ = document(client, world, mocker, text_block())
    run_id = artifact["id"]
    blocks = client.get(f"{URL}artifacts/{run_id}/").json["result"]["blocks"]
    conversation = client.get(f"{URL}artifacts/{run_id}/").json["result"][
        "conversation_id"
    ]
    run(
        client,
        world,
        mocker,
        change_call(
            artifact,
            {
                "action": "replace",
                "block_id": blocks[0]["id"],
                "block": text_block("Otro texto."),
            },
        ),
        conversation_id=conversation,
    )

    restored = client.post(
        f"{URL}artifacts/{run_id}/restore/", json={"version": 1}
    ).json["result"]

    assert restored["model_name"] == "Claude Sonnet 5.5"
    assert restored["versions"][-1]["model"] == restored["versions"][0]["model"]


def test_an_api_key_reads_no_document_of_its_owner_either(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    shared: dict[str, Any],
    mocker: MockerFixture,
) -> None:
    login(world, "Vera")
    mocker.patch.object(
        security_manager, "extract_api_key_from_request", return_value="sst_x"
    )

    assert page(client, shared["id"]).status_code == 404
