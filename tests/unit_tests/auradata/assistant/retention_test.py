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
The retention of the conversations: what goes, what stays whatever the dates say, and
that the accounting of the month does not move.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.auradata.assistant import retention
from superset.auradata.assistant.conversations import ConversationLog
from superset.auradata.assistant.retention import (
    purge_conversations,
    retention_days,
)
from superset.auradata.assistant.spending import month_start, spent_usd, usage_report
from superset.auradata.models import (
    AssistantConversation,
    AssistantMessage,
)
from superset.config import CeleryConfig
from superset.tasks.assistant_retention import purge_assistant_conversations
from tests.unit_tests.auradata.assistant.chat_test import (  # noqa: F401
    ask,
    conversation_id_of,
    login,
    session_engine,
    URL,
    use_model,
    world,
)
from tests.unit_tests.auradata.assistant.copilot_test import asks_to_delete
from tests.unit_tests.auradata.assistant.fake_anthropic import reply, text
from tests.unit_tests.auradata.assistant.feedback_test import answered, vote_url

DAYS = 90


def age(world: dict[str, Any], conversation: str, days: int) -> None:  # noqa: F811
    """A conversation whose last message is this old."""
    session = world["session"]
    moment = datetime.now() - timedelta(days=days)
    session.query(AssistantMessage).filter(
        AssistantMessage.conversation_id == UUID(conversation)
    ).update({"created_on": moment})
    session.query(AssistantConversation).filter(
        AssistantConversation.id == UUID(conversation)
    ).update({"created_on": moment})
    session.commit()


def exists(world: dict[str, Any], conversation: str) -> bool:  # noqa: F811
    return world["session"].get(AssistantConversation, UUID(conversation)) is not None


def contents(world: dict[str, Any]) -> list[str]:  # noqa: F811
    return [row.content for row in world["session"].query(AssistantMessage)]


def orphan(
    world: dict[str, Any],  # noqa: F811
    conversation: str,
    column: str = "dashboard_id",
) -> None:
    world["session"].query(AssistantConversation).filter(
        AssistantConversation.id == UUID(conversation)
    ).update({column: None})
    world["session"].commit()


def waiting_for_a_card(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> str:
    login(world, "Ana")
    use_model(mocker, asks_to_delete(world))
    return conversation_id_of(ask(client, world["dashboard"], mode="edit"))


def test_a_dry_run_counts_and_touches_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    expired, _ = answered(client, world, mocker)
    lost, _ = answered(client, world, mocker)
    recent, _ = answered(client, world, mocker)
    age(world, expired, DAYS + 1)
    orphan(world, lost)
    before = contents(world)

    report = purge_conversations(DAYS, dry_run=True)

    assert report["expired"] == 1
    assert report["orphaned"] == 1
    assert report["would_delete"] == 2
    assert report["deleted"] == 0
    assert exists(world, expired)
    assert exists(world, lost)
    assert exists(world, recent)
    assert contents(world) == before


def test_an_expired_conversation_goes_and_the_month_does_not_change(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    private = "Margen secreto"
    expired, message = answered(client, world, mocker, answer=private)
    client.put(vote_url(expired, message), json={"vote": "up"})
    age(world, expired, DAYS + 1)
    start = month_start(datetime.now() - timedelta(days=DAYS + 1))
    spent, report = spent_usd(start), usage_report(start)
    assert spent > 0

    result = purge_conversations(DAYS)

    assert result["deleted"] == 1
    assert not exists(world, expired)
    assert private not in "".join(contents(world))
    assert spent_usd(start) == spent
    assert usage_report(start) == report
    assert report["by_model"][0]["votes_up"] == 1


def test_a_recent_conversation_stays(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    recent, _ = answered(client, world, mocker)
    age(world, recent, DAYS - 1)

    assert purge_conversations(DAYS)["deleted"] == 0
    assert exists(world, recent)


def test_a_new_message_gives_an_old_conversation_more_time(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    age(world, conversation, DAYS + 30)
    use_model(mocker, reply(text("Sigo aquí")))
    ask(client, world["shared_dashboard"], "¿Y hoy?", conversation_id=conversation)

    assert purge_conversations(DAYS)["deleted"] == 0
    assert exists(world, conversation)


def test_someone_writing_during_the_pass_wins(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    age(world, conversation, DAYS + 1)
    real_lock = retention.lock_conversations

    def lock_after_a_message(ids: list[UUID], wait: bool = True) -> list[Any]:
        row = world["session"].get(AssistantConversation, UUID(conversation))
        ConversationLog(row, world["users"]["Ana"].id).add_turn_end({})
        return real_lock(ids, wait)

    mocker.patch.object(retention, "lock_conversations", lock_after_a_message)

    report = purge_conversations(DAYS)

    assert report["deleted"] == 0
    assert exists(world, conversation)


@pytest.mark.parametrize("column", ["dashboard_id", "user_id"])
def test_a_conversation_nobody_can_open_goes_whatever_its_age(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    column: str,
) -> None:
    lost, _ = answered(client, world, mocker)
    orphan(world, lost, column)

    report = purge_conversations(DAYS)

    assert report["orphaned"] == 1
    assert report["deleted"] == 1
    assert not exists(world, lost)


def test_a_report_in_the_trash_is_not_lost(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    conversation, _ = answered(client, world, mocker)
    world["shared_dashboard"].deleted_at = datetime.now()
    world["session"].commit()

    assert purge_conversations(DAYS)["orphaned"] == 0
    assert exists(world, conversation)


def test_a_conversation_with_a_card_stays_however_old(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    pending = waiting_for_a_card(client, world, mocker)
    age(world, pending, DAYS + 400)

    report = purge_conversations(DAYS)

    assert report["kept_pending"] == 1
    assert report["deleted"] == 0
    assert exists(world, pending)


def test_a_card_on_a_lost_report_stays_too(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    pending = waiting_for_a_card(client, world, mocker)
    orphan(world, pending)

    assert purge_conversations(DAYS)["kept_pending"] == 1
    assert exists(world, pending)


def test_a_turn_under_way_on_a_lost_report_stays(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    running, _ = answered(client, world, mocker)
    row = world["session"].get(AssistantConversation, UUID(running))
    ConversationLog(row, world["users"]["Ana"].id).add_user_message(
        [{"type": "text", "text": "¿Y ahora?"}]
    )
    orphan(world, running)

    assert purge_conversations(DAYS)["kept_under_way"] == 1
    assert exists(world, running)


def test_it_works_in_small_batches_and_a_failed_one_stays_whole(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(retention, "BATCH_SIZE", 2)
    expired = [answered(client, world, mocker)[0] for _ in range(3)]
    for conversation in expired:
        age(world, conversation, DAYS + 1)
    real_erase = retention.erase_conversations
    calls: list[int] = []

    def fail_the_second(ids: list[UUID]) -> None:
        calls.append(len(ids))
        real_erase(ids)
        if len(calls) == 2:
            raise RuntimeError("the database went away")

    mocker.patch.object(retention, "erase_conversations", fail_the_second)

    report = purge_conversations(DAYS)

    assert calls == [2, 1]
    assert report["deleted"] == 2
    assert report["failed"] == 1
    assert world["session"].query(AssistantConversation).count() == 1


@pytest.mark.parametrize("value", [None, 0, -1, "90", True])
def test_without_a_sensible_retention_the_task_deletes_nothing(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    app: Any,
    value: Any,
) -> None:
    expired, _ = answered(client, world, mocker)
    lost, _ = answered(client, world, mocker)
    age(world, expired, 4000)
    orphan(world, lost)
    mocker.patch.dict(app.config, {"AURADATA_ASSISTANT_RETENTION_DAYS": value})

    assert retention_days() is None
    assert purge_assistant_conversations() == {"skipped": 1}
    assert exists(world, expired)
    assert exists(world, lost)


def test_the_task_reads_the_setting_and_passes_dry_run(
    client: Any,
    world: dict[str, Any],  # noqa: F811
    mocker: MockerFixture,
    app: Any,
) -> None:
    expired, _ = answered(client, world, mocker)
    age(world, expired, 11)
    mocker.patch.dict(app.config, {"AURADATA_ASSISTANT_RETENTION_DAYS": 10})

    assert purge_assistant_conversations(dry_run=True)["would_delete"] == 1
    assert exists(world, expired)
    assert purge_assistant_conversations()["deleted"] == 1
    assert not exists(world, expired)


def test_the_setting_defaults_to_ninety_days_and_the_task_is_scheduled() -> None:
    from superset import auradata_config

    assert auradata_config.AURADATA_ASSISTANT_RETENTION_DAYS == 90
    assert "superset.tasks.assistant_retention" in CeleryConfig.imports
    assert (
        CeleryConfig.beat_schedule["auradata_assistant.purge_conversations"]["task"]
        == "auradata_assistant.purge_conversations"
    )
