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
Who may use the assistant, and where.

Three decisions live here, each read by the API on the server, whatever the panel shows:

* **Switches.** The global ones are in the settings of the assistant. A workspace has
  its own and can only narrow them: it can turn the assistant off, or just its edit
  mode. A dashboard without a workspace follows the global ones.
* **The limit of a workspace,** next to the global limit (``spending``).
* **The privacy notice.** Nothing goes to Anthropic for a person who has not accepted
  it. Changing what the notice says means raising ``PRIVACY_NOTICE_VERSION``, and
  everyone is asked again.

Each workspace and each person has an entry of the key-value store of its own, so two
admins saving different workspaces never overwrite each other, and no table is needed.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid3

from superset.auradata.assistant.settings import AssistantSettings
from superset.auradata.assistant.spending import budget_state, BudgetState
from superset.auradata.assistant.tools import MODE_EDIT
from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.key_value.utils import get_uuid_namespace
from superset.utils.decorators import transaction

PRIVACY_NOTICE_VERSION = 2

RESOURCE = KeyValueResource.AURADATA_ASSISTANT
CODEC = JsonKeyValueCodec()

# Why the assistant does not answer on a report, for the panel
OFF_IN_WORKSPACE = "off_in_workspace"
EDIT_OFF = "edit_off"


@dataclass(frozen=True)
class WorkspaceAssistantSettings:
    """What the admins of a workspace chose. By default it follows the global ones."""

    enabled: bool = True
    edit_enabled: bool = True
    # None sets no limit of its own
    monthly_budget_usd: float | None = None


def _key(name: str) -> UUID:
    return uuid3(get_uuid_namespace(""), name)


def _workspace_key(workspace_id: int) -> UUID:
    return _key(f"workspace:{workspace_id}")


def _privacy_key(user_id: int) -> UUID:
    return _key(f"privacy:{user_id}")


def workspace_settings(workspace_id: int) -> WorkspaceAssistantSettings:
    """The settings of a workspace. Its keys left unset take the default."""
    stored = KeyValueDAO.get_value(RESOURCE, _workspace_key(workspace_id), CODEC) or {}
    defaults = asdict(WorkspaceAssistantSettings())
    return WorkspaceAssistantSettings(
        **{key: stored.get(key, value) for key, value in defaults.items()}
    )


@transaction()
def save_workspace_settings(
    workspace_id: int, values: dict[str, Any]
) -> WorkspaceAssistantSettings:
    """Change what ``values`` names and keep the rest."""
    merged = {**asdict(workspace_settings(workspace_id)), **values}
    KeyValueDAO.upsert_entry(RESOURCE, merged, CODEC, _workspace_key(workspace_id))
    return WorkspaceAssistantSettings(**merged)


def switched_off(
    settings: AssistantSettings, workspace_id: int | None, mode: str
) -> str | None:
    """
    Why this mode does not run on a report of this workspace, or None if it does. The
    global ``enabled`` is checked before there is a report to ask about.
    """
    own = (
        workspace_settings(workspace_id)
        if workspace_id is not None
        else WorkspaceAssistantSettings()
    )
    if not own.enabled:
        return OFF_IN_WORKSPACE
    if mode == MODE_EDIT and not (settings.edit_enabled and own.edit_enabled):
        return EDIT_OFF
    return None


def budget_of(
    settings: AssistantSettings,
    workspace_id: int | None,
    now: datetime | None = None,
) -> BudgetState:
    """Where this month stands for a report of this workspace."""
    own = workspace_settings(workspace_id) if workspace_id is not None else None
    return budget_state(
        settings.monthly_budget_usd,
        workspace_id,
        own.monthly_budget_usd if own else None,
        now,
    )


def accepted_privacy(user_id: int) -> bool:
    """Whether this person accepted the notice as it reads today."""
    stored = KeyValueDAO.get_value(RESOURCE, _privacy_key(user_id), CODEC)
    return bool(stored) and stored.get("version") == PRIVACY_NOTICE_VERSION


@transaction()
def accept_privacy(user_id: int) -> None:
    """Keep that this person read the notice, and when."""
    KeyValueDAO.upsert_entry(
        RESOURCE,
        {
            "version": PRIVACY_NOTICE_VERSION,
            "accepted_on": datetime.now(timezone.utc).isoformat(),
        },
        CODEC,
        _privacy_key(user_id),
    )
