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
Who may use the assistant, where, and up to how much: switches, limits, usage and the
privacy notice, from the endpoints down, with only the model fake.
"""

from dataclasses import replace
from datetime import datetime
from decimal import Decimal
from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant import api as api_module, governance
from superset.auradata.assistant.conversations import (
    AssistantTurn,
    ConversationLog,
    create_conversation,
)
from superset.auradata.assistant.governance import (
    accept_privacy,
    accepted_privacy,
    EDIT_OFF,
    OFF_IN_WORKSPACE,
    save_workspace_settings,
    switched_off,
    workspace_settings,
    WorkspaceAssistantSettings,
)
from superset.auradata.assistant.models import TokenUsage
from superset.auradata.assistant.settings import AssistantSettings
from superset.auradata.assistant.spending import (
    budget_level,
    budget_state,
    BudgetState,
    LEVEL_OK,
    LEVEL_STOPPED,
    LEVEL_WARNING,
    month_key,
    month_start,
    next_month,
    parse_month,
    previous_month,
    SCOPE_GLOBAL,
    SCOPE_WORKSPACE,
    spent_usd,
    usage_report,
    usd,
)
from superset.auradata.assistant.tools import MODE_EDIT, MODE_READ
from superset.auradata.models import AssistantMessage
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    HAIKU,
    login,
    payloads,
    session_engine,
    SONNET,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import (
    add_page,
    asks_to_delete,
    decide,
    edited,
    undo,
    Versions,
)
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text

ADMIN_URL = "/api/v1/auradata_assistant"
NOW = datetime(2026, 11, 15, 12)


def set_settings(mocker: MockerFixture, **values: Any) -> None:
    mocker.patch.object(
        api_module,
        "get_assistant_settings",
        return_value=replace(AssistantSettings(True, SONNET, None, None), **values),
    )


def spend(
    world: dict[str, Any],  # noqa: F811
    cost: str,
    when: datetime | None = None,
    workspace_id: int | None = None,
    model: str = SONNET,
    user: str = "Ana",
) -> None:
    """An answer that already cost this much, stored as the chat stores it."""
    conversation = create_conversation(
        world["users"][user].id, world["dashboard"].id, MODE_READ, model, "t"
    )
    log = ConversationLog(conversation, world["users"][user].id)
    log.add_turn(
        AssistantTurn(
            [{"type": "text", "text": "x"}],
            model,
            "end_turn",
            TokenUsage(10, 5, 0, 0),
            Decimal(cost),
        )
    )
    row = (
        world["session"]
        .query(AssistantMessage)
        .filter(AssistantMessage.conversation_id == conversation.id)
        .one()
    )
    row.workspace_id = workspace_id
    if when is not None:
        row.created_on = when
    world["session"].commit()


# The month


@pytest.mark.parametrize(
    ("moment", "start", "following"),
    [
        (datetime(2026, 11, 5, 9), datetime(2026, 11, 1), datetime(2026, 12, 1)),
        (
            datetime(2026, 12, 31, 23, 59, 59, 999999),
            datetime(2026, 12, 1),
            datetime(2027, 1, 1),
        ),
        (datetime(2027, 1, 1), datetime(2027, 1, 1), datetime(2027, 2, 1)),
        (datetime(2028, 2, 29, 12), datetime(2028, 2, 1), datetime(2028, 3, 1)),
    ],
)
def test_a_month_goes_from_its_first_instant_to_the_next_one(
    moment: datetime, start: datetime, following: datetime
) -> None:
    assert month_start(moment) == start
    assert next_month(start) == following
    assert previous_month(following) == start


def test_a_month_is_written_one_way() -> None:
    assert month_key(datetime(2026, 1, 1)) == "2026-01"
    assert parse_month("2026-01") == datetime(2026, 1, 1)
    with pytest.raises(ValueError):  # noqa: PT011
        parse_month("enero")


def test_the_last_microsecond_counts_for_its_month_and_the_next_instant_does_not(
    world: dict[str, Any],  # noqa: F811
) -> None:
    spend(world, "1", datetime(2026, 10, 31, 23, 59, 59, 999999))
    spend(world, "2", datetime(2026, 11, 1))
    spend(world, "4", datetime(2026, 11, 30, 23, 59, 59, 999999))
    spend(world, "8", datetime(2026, 12, 1))

    assert spent_usd(datetime(2026, 10, 1)) == usd("1")
    assert spent_usd(datetime(2026, 11, 1)) == usd("6")
    assert spent_usd(datetime(2026, 12, 1)) == usd("8")


# Rounding and limits


def test_amounts_round_once_to_the_millionth() -> None:
    assert usd("0.0000015") == Decimal("0.000002")
    assert usd("0.0000014") == Decimal("0.000001")
    assert usd(None) == Decimal("0.000000")
    assert usd(0.1) + usd(0.2) == usd("0.3")


@pytest.mark.parametrize(
    ("spent", "budget", "level"),
    [
        ("79.999999", 100, LEVEL_OK),
        ("80", 100, LEVEL_WARNING),
        ("99.999999", 100, LEVEL_WARNING),
        ("100", 100, LEVEL_STOPPED),
        ("100.000001", 100, LEVEL_STOPPED),
        ("0.08", 0.1, LEVEL_WARNING),
        ("0.1", 0.1, LEVEL_STOPPED),
        ("0", 0, LEVEL_STOPPED),
        ("1000000", None, LEVEL_OK),
    ],
)
def test_a_limit_warns_at_80_and_stops_at_100_exactly(
    spent: str, budget: float | None, level: str
) -> None:
    assert budget_level(usd(spent), budget) == level


def test_the_nearest_limit_decides(world: dict[str, Any]) -> None:  # noqa: F811
    workspace = world["ventas_ws"].id
    spend(world, "9", NOW, workspace)
    spend(world, "1", NOW, world["finanzas_ws"].id)

    assert budget_state(None, now=NOW) == BudgetState()
    assert budget_state(12, now=NOW) == BudgetState(LEVEL_WARNING, SCOPE_GLOBAL)
    assert budget_state(100, workspace, 9, NOW) == BudgetState(
        LEVEL_STOPPED, SCOPE_WORKSPACE
    )
    assert budget_state(10, workspace, 9, NOW) == BudgetState(
        LEVEL_STOPPED, SCOPE_GLOBAL
    )
    # The rest of the platform never counts against a workspace
    assert budget_state(None, workspace, 10, NOW) == BudgetState(
        LEVEL_WARNING, SCOPE_WORKSPACE
    )


def test_refused_interrupted_and_record_rows_count_as_they_are(
    world: dict[str, Any],  # noqa: F811
) -> None:
    """A row of the app holds no cost, and a cut answer still cost what it says."""
    spend(world, "3", NOW)
    world["session"].query(AssistantMessage).update({"stop_reason": "interrupted"})
    conversation = create_conversation(
        world["users"]["Ana"].id, world["dashboard"].id, MODE_READ, SONNET, "t"
    )
    ConversationLog(conversation, world["users"]["Ana"].id).add_decision("x", True)

    assert spent_usd(month_start(NOW)) == usd(3)


# Switches


def test_a_workspace_starts_by_following_the_global_settings(
    world: dict[str, Any],  # noqa: F811
) -> None:
    assert workspace_settings(world["ventas_ws"].id) == WorkspaceAssistantSettings()


def test_saving_a_workspace_changes_only_that_workspace_and_those_keys(
    world: dict[str, Any],  # noqa: F811
) -> None:
    ventas = world["ventas_ws"].id
    save_workspace_settings(ventas, {"enabled": False})
    save_workspace_settings(ventas, {"monthly_budget_usd": 5.0})

    assert workspace_settings(ventas) == WorkspaceAssistantSettings(False, True, 5.0)
    assert workspace_settings(world["finanzas_ws"].id) == WorkspaceAssistantSettings()


@pytest.mark.parametrize(
    ("own", "global_edit", "mode", "reason"),
    [
        ({}, True, MODE_READ, None),
        ({}, True, MODE_EDIT, None),
        ({"enabled": False}, True, MODE_READ, OFF_IN_WORKSPACE),
        ({"enabled": False}, True, MODE_EDIT, OFF_IN_WORKSPACE),
        ({"edit_enabled": False}, True, MODE_READ, None),
        ({"edit_enabled": False}, True, MODE_EDIT, EDIT_OFF),
        ({}, False, MODE_READ, None),
        ({}, False, MODE_EDIT, EDIT_OFF),
        ({"edit_enabled": True}, False, MODE_EDIT, EDIT_OFF),
    ],
)
def test_a_workspace_can_only_narrow_the_global_switches(
    world: dict[str, Any],  # noqa: F811
    own: dict[str, bool],
    global_edit: bool,
    mode: str,
    reason: str | None,
) -> None:
    workspace = world["ventas_ws"].id
    save_workspace_settings(workspace, own)
    settings = AssistantSettings(True, SONNET, None, None, global_edit)

    assert switched_off(settings, workspace, mode) == reason


def test_a_dashboard_without_a_workspace_follows_the_global_switch(
    world: dict[str, Any],  # noqa: F811
) -> None:
    save_workspace_settings(world["ventas_ws"].id, {"enabled": False})

    on = AssistantSettings(True, SONNET, None, None)
    no_edit = AssistantSettings(True, SONNET, None, None, False)
    assert switched_off(on, None, MODE_EDIT) is None
    assert switched_off(no_edit, None, MODE_READ) is None
    assert switched_off(no_edit, None, MODE_EDIT) == EDIT_OFF


def test_the_chat_refuses_a_workspace_that_turned_it_off(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    save_workspace_settings(world["ventas_ws"].id, {"enabled": False})
    fake = use_model(mocker)

    response = ask(client, world["dashboard"])

    assert response.status_code == 403
    assert response.json["reason"] == OFF_IN_WORKSPACE
    assert fake.requests == []
    assert world["session"].query(AssistantMessage).count() == 0


def test_the_workspace_off_leaves_other_reports_alone(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    save_workspace_settings(world["ventas_ws"].id, {"enabled": False})
    fake = use_model(mocker, reply(text("Hola")))

    assert ask(client, world["shared_dashboard"]).status_code == 200
    assert len(fake.requests) == 1


def test_read_mode_stays_when_only_edit_is_off(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    save_workspace_settings(world["ventas_ws"].id, {"edit_enabled": False})
    fake = use_model(mocker, reply(text("Hola")))

    assert ask(client, world["dashboard"], mode=MODE_EDIT).status_code == 403
    assert fake.requests == []
    assert ask(client, world["dashboard"]).status_code == 200


def test_turning_it_off_stops_a_card_that_was_waiting(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    add_page(world)
    use_model(mocker, asks_to_delete(world))
    conversation_id = payloads(
        ask(client, world["dashboard"], mode=MODE_EDIT), "conversation"
    )[0]["id"]
    run = mocker.spy(api_module.ToolBox, "call")
    save_workspace_settings(world["ventas_ws"].id, {"edit_enabled": False})

    response = decide(client, conversation_id)

    assert response.status_code == 403
    assert response.json["reason"] == EDIT_OFF
    assert run.call_count == 0


def test_undo_stops_with_the_switches_and_never_with_the_limit(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    conversation_id = edited(client, world, mocker, Versions(mocker, world))
    save_workspace_settings(world["ventas_ws"].id, {"edit_enabled": False})

    assert undo(client, conversation_id).status_code == 403

    save_workspace_settings(
        world["ventas_ws"].id, {"edit_enabled": True, "monthly_budget_usd": 0}
    )
    assert undo(client, conversation_id).status_code == 200


def test_undo_stops_when_the_platform_turned_the_assistant_off(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    conversation_id = edited(client, world, mocker, Versions(mocker, world))
    mocker.patch.object(
        api_module,
        "get_assistant_settings",
        return_value=AssistantSettings(False, SONNET, None, None),
    )

    assert undo(client, conversation_id).status_code == 403


# Limits on the chat


def test_a_limit_reached_stops_a_new_turn_with_a_clear_message(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    set_settings(mocker, monthly_budget_usd=5.0)
    spend(world, "5", datetime.now(), world["ventas_ws"].id)
    fake = use_model(mocker)

    response = ask(client, world["dashboard"])

    assert response.status_code == 429
    assert response.json["reason"] == "budget"
    assert "$" not in response.json["message"]
    assert fake.requests == []


def test_the_limit_of_a_workspace_stops_only_that_workspace(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    save_workspace_settings(world["ventas_ws"].id, {"monthly_budget_usd": 1.0})
    spend(world, "1", datetime.now(), world["ventas_ws"].id)
    use_model(mocker, reply(text("Hola")))

    assert ask(client, world["dashboard"]).status_code == 429
    assert ask(client, world["shared_dashboard"]).status_code == 200


def test_a_turn_under_way_finishes_and_the_next_one_stops(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    """A card decided after the limit is the same turn: only a new message stops."""
    login(world, "Ana")
    add_page(world)
    use_model(mocker, asks_to_delete(world), reply(text("Hecho")))
    conversation_id = payloads(
        ask(client, world["dashboard"], mode=MODE_EDIT), "conversation"
    )[0]["id"]
    save_workspace_settings(world["ventas_ws"].id, {"monthly_budget_usd": 0})

    finished = decide(client, conversation_id)

    assert finished.status_code == 200
    assert payloads(finished, "done")[-1]["budget"]["level"] == LEVEL_STOPPED
    next_turn = ask(
        client,
        world["dashboard"],
        mode=MODE_EDIT,
        conversation_id=conversation_id,
    )
    assert next_turn.status_code == 429


def test_the_stream_says_where_the_month_stands_without_amounts(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    set_settings(mocker, monthly_budget_usd=10.0)
    spend(world, "8", datetime.now())
    use_model(mocker, reply(text("Hola")))

    done = payloads(ask(client, world["dashboard"]), "done")[0]

    assert done["budget"] == {"level": LEVEL_WARNING, "scope": SCOPE_GLOBAL}


# What the panel reads


def models_of(client: Any, dashboard_id: int) -> dict[str, Any]:
    return client.get(f"{URL}models/?dashboard_id={dashboard_id}").json["result"]


def test_the_panel_learns_the_switches_of_its_report(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    set_settings(mocker, monthly_budget_usd=10.0)
    spend(world, "9", datetime.now())
    dashboard = world["dashboard"].id

    found = models_of(client, dashboard)
    assert found["available"] is True
    assert found["edit_available"] is True
    assert found["budget"] == {"level": LEVEL_WARNING, "scope": SCOPE_GLOBAL}
    assert found["privacy_accepted"] is True

    save_workspace_settings(world["ventas_ws"].id, {"edit_enabled": False})
    assert models_of(client, dashboard)["edit_available"] is False

    save_workspace_settings(world["ventas_ws"].id, {"enabled": False})
    assert models_of(client, dashboard) == {"available": False, "models": []}


def test_a_report_the_person_cannot_open_offers_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Dani")

    assert models_of(client, world["dashboard"].id)["available"] is False


# The privacy notice


@pytest.fixture
def real_privacy(world: dict[str, Any], mocker: MockerFixture) -> None:  # noqa: F811
    """The notice as it really works: the shared fixture accepts it for everyone."""
    mocker.patch.object(api_module, "accepted_privacy", governance.accepted_privacy)


def test_the_chat_waits_for_the_notice_and_stores_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    real_privacy: None,
) -> None:
    login(world, "Ana")
    fake = use_model(mocker, reply(text("Hola")))

    refused = ask(client, world["dashboard"])

    assert refused.status_code == 403
    assert refused.json["reason"] == "privacy"
    assert fake.requests == []
    assert world["session"].query(AssistantMessage).count() == 0

    assert client.post(f"{URL}privacy/").status_code == 200
    assert ask(client, world["dashboard"]).status_code == 200
    assert len(fake.requests) == 1


def test_a_decision_waits_for_the_notice_too(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    real_privacy: None,
) -> None:
    login(world, "Ana")
    conversation = create_conversation(
        world["users"]["Ana"].id, world["dashboard"].id, MODE_EDIT, SONNET, "t"
    )

    assert decide(client, str(conversation.id)).status_code == 403


def test_accepting_counts_for_the_person_who_accepted(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    real_privacy: None,
) -> None:
    login(world, "Ana")
    client.post(f"{URL}privacy/")

    assert models_of(client, world["dashboard"].id)["privacy_accepted"] is True
    login(world, "Ada")
    assert models_of(client, world["dashboard"].id)["privacy_accepted"] is False


def test_a_new_notice_asks_everyone_again(
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    user = world["users"]["Ana"].id
    accept_privacy(user)
    assert accepted_privacy(user)

    mocker.patch.object(
        governance, "PRIVACY_NOTICE_VERSION", governance.PRIVACY_NOTICE_VERSION + 1
    )

    assert not accepted_privacy(user)


def test_only_a_browser_session_accepts_the_notice(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Ana")
    mocker.patch.object(api_module, "_session_user_only", return_value=False)
    accept = mocker.spy(api_module, "accept_privacy")

    assert client.post(f"{URL}privacy/").status_code == 403
    assert accept.call_count == 0


# Settings of a workspace


@pytest.mark.parametrize(
    ("name", "status"),
    [
        ("Ada", 200),
        ("Root", 200),
        ("Ana", 403),
        ("Vera", 403),
        ("Carlos", 404),
        ("Dani", 404),
    ],
)
def test_only_the_admins_of_a_workspace_reach_its_settings(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    name: str,
    status: int,
) -> None:
    login(world, name)
    workspace = world["ventas_ws"].id
    url = f"{ADMIN_URL}/workspace/{workspace}/"
    save = mocker.spy(api_module, "save_workspace_settings")

    assert client.get(url).status_code == status
    assert client.put(url, json={"enabled": False}).status_code == status
    assert save.call_count == (1 if status == 200 else 0)
    assert workspace_settings(workspace).enabled is (status != 200)


def test_the_admin_of_one_workspace_cannot_touch_another(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ada")
    finanzas = world["finanzas_ws"].id

    response = client.put(f"{ADMIN_URL}/workspace/{finanzas}/", json={"enabled": False})

    assert response.status_code == 404
    assert workspace_settings(finanzas).enabled is True


def test_a_workspace_admin_reads_the_month_of_that_workspace(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ada")
    workspace = world["ventas_ws"].id
    spend(world, "2.5", datetime.now(), workspace)
    spend(world, "7", datetime.now(), world["finanzas_ws"].id)

    found = client.get(f"{ADMIN_URL}/workspace/{workspace}/").json["result"]

    assert found["spent_usd"] == 2.5
    assert found["enabled"] is True
    assert found["monthly_budget_usd"] is None


def test_a_workspace_refuses_a_negative_limit(
    client: Any,
    world: dict[str, Any],  # noqa: F811
) -> None:
    login(world, "Ada")
    url = f"{ADMIN_URL}/workspace/{world['ventas_ws'].id}/"

    assert client.put(url, json={"monthly_budget_usd": -1}).status_code == 400


# Usage


def test_usage_adds_up_by_model_workspace_and_user(
    world: dict[str, Any],  # noqa: F811
) -> None:
    ventas = world["ventas_ws"].id
    spend(world, "3", NOW, ventas, SONNET, "Ana")
    spend(world, "2", NOW, ventas, HAIKU, "Ada")
    spend(world, "1", NOW, None, HAIKU, "Ada")
    spend(world, "9", datetime(2026, 10, 2), ventas, SONNET, "Ana")

    report = usage_report(month_start(NOW), NOW)

    assert report["month"] == "2026-11"
    assert report["total_usd"] == 6
    assert {row["model"]: row["cost_usd"] for row in report["by_model"]} == {
        HAIKU: 3,
        SONNET: 3,
    }
    assert [(row["name"], row["cost_usd"]) for row in report["by_workspace"]] == [
        ("Ventas", 5),
        (None, 1),
    ]
    assert {row["name"]: row["cost_usd"] for row in report["by_user"]} == {
        "Ada T": 3,
        "Ana T": 3,
    }
    assert {row["model"]: row["tokens"] for row in report["by_model"]} == {
        HAIKU: 30,
        SONNET: 15,
    }
    assert report["months"][:3] == [
        {"month": "2026-11", "cost_usd": 6, "tokens": 45, "answers": 3},
        {"month": "2026-10", "cost_usd": 9, "tokens": 15, "answers": 1},
        {"month": "2026-09", "cost_usd": 0, "tokens": 0, "answers": 0},
    ]
    assert len(report["months"]) == 12


def test_a_person_who_left_keeps_their_cost_under_no_name(
    world: dict[str, Any],  # noqa: F811
) -> None:
    spend(world, "4", NOW)
    world["session"].query(AssistantMessage).update({"user_id": None})
    world["session"].commit()

    row = usage_report(month_start(NOW), NOW)["by_user"][0]

    assert row == {
        "user_id": None,
        "name": None,
        "cost_usd": 4,
        "tokens": 15,
        "answers": 1,
    }


@pytest.mark.parametrize("name", ["Ada", "Ana", "Vera", "Dani"])
def test_usage_is_only_for_platform_admins(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    name: str,
) -> None:
    login(world, name)

    assert client.get(f"{ADMIN_URL}/usage/").status_code == 403


def test_usage_answers_an_admin_and_refuses_a_bad_month(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    login(world, "Root")
    set_settings(mocker, monthly_budget_usd=50.0)

    found = client.get(f"{ADMIN_URL}/usage/?month=2026-02").json["result"]

    assert found["month"] == "2026-02"
    assert found["monthly_budget_usd"] == 50.0
    assert client.get(f"{ADMIN_URL}/usage/?month=nope").status_code == 400
