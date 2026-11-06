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
A document of the assistant shared inside its workspace.

The owner shares one version, the one a card just showed them, so what the assistant
writes later reaches nobody until they share again. Nothing is copied: the columns of
the document say which version and which workspace, and a read decides from scratch,
every time, whether that still holds (``reads_share``):

* The document is shared and its report is still in that workspace.
* Its owner is still an active member of that workspace.
* The reader has a membership row of their own. A Superset admin is not a member of
  everything here: a document stays private to who it was shared with.
* The reader opens the report as themselves, so a document of a draft stays with those
  who can see the draft.

Leaving a workspace and moving a report also end the share for good
(``end_shares_of_member``, ``end_moved_shares``), so coming back does not reopen it.

A reader gets a view built here, never the row. It has one version, no conversation and
no history, and a block of data whose dataset they do not reach arrives as
``{id, type: "refused"}``: its query, title and label stay on the server, because
filter values and names say what the numbers would. A block they do reach keeps its
query, which they run themselves through the chart data API, with their permissions and
row level security. Text is the part no permission reaches: it says what its author saw.
So the card warns the author with the figures it holds, and the view says whose access
wrote it.

Nothing here writes on a read, and nothing reaches the model: ``read_artifact`` stays
with the owner, so a shared text never enters the conversation of a reader.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Iterable, Sequence
from uuid import UUID

from superset import security_manager
from superset.auradata.action_log import ASSISTANT_DOCUMENT
from superset.auradata.assistant.artifacts import (
    blocks_of,
    DATA_BLOCKS,
    model_name,
    oldest_text,
    sources_of,
    version_of,
)
from superset.auradata.assistant.conversations import workspace_id_of
from superset.auradata.models import (
    AssistantArtifact,
    AssistantArtifactVersion,
    Workspace,
    WorkspaceDataset,
    WorkspaceMember,
)
from superset.extensions import db, event_logger
from superset.models.dashboard import Dashboard
from superset.utils.core import get_user_id

REFUSED = "refused"

ACTION_SHARE = "share"
ACTION_UNSHARE = "unshare"

NO_WORKSPACE = "no_workspace"
NOT_A_MEMBER = "not_a_member"

MAX_LISTED = 50
# What the card repeats of a text: enough to recognize it
MAX_PASSAGES = 12
MAX_PASSAGE_CHARS = 220
MAX_FILTER_VALUES = 8

_NUMBER = re.compile(r"\d[\d.,]*")
_SENTENCE = re.compile(r"(?<=[.!?:;])\s+|\n+")


def is_member(workspace_id: int, user_id: int | None) -> bool:
    """A membership row: a role of Superset never stands for one."""
    return (
        user_id is not None
        and db.session.query(WorkspaceMember.user_id)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .first()
        is not None
    )


def _author(artifact: AssistantArtifact) -> Any | None:
    if artifact.user_id is None:
        return None
    return db.session.get(security_manager.user_model, artifact.user_id)


def is_live(artifact: AssistantArtifact) -> bool:
    """Whether a share still holds, for anyone: it does not depend on who is asking."""
    workspace_id = artifact.shared_workspace_id
    if artifact.shared_version is None or workspace_id is None:
        return False
    author = _author(artifact)
    return (
        author is not None
        and author.is_active
        and workspace_id_of(artifact.dashboard_id) == workspace_id
        and is_member(workspace_id, artifact.user_id)
    )


def reads_share(artifact: AssistantArtifact, user_id: int) -> bool:
    """Whether this person, the current user, reads this document as shared."""
    # pylint: disable=import-outside-toplevel
    from superset.auradata.assistant.turns import open_dashboard

    return (
        is_live(artifact)
        and is_member(artifact.shared_workspace_id, user_id)
        and open_dashboard(artifact.dashboard_id) is not None
    )


def find_shared(artifact_id: UUID, user_id: int) -> AssistantArtifact | None:
    """A document shared with this person. Any other is as one that does not exist."""
    artifact = db.session.get(AssistantArtifact, artifact_id)
    if artifact is None or not reads_share(artifact, user_id):
        return None
    return artifact


def _name_of(user: Any | None) -> str | None:
    if user is None:
        return None
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.username


def share_json(artifact: AssistantArtifact) -> dict[str, Any] | None:
    """What the owner reads about the share of their document, if it holds."""
    if not is_live(artifact):
        return None
    workspace = db.session.get(Workspace, artifact.shared_workspace_id)
    return {
        "version": artifact.shared_version,
        "shared_on": artifact.shared_on.isoformat(),
        "workspace": workspace.name if workspace else None,
    }


def _redacted(
    blocks: Iterable[dict[str, Any]], sources: dict[str, str]
) -> list[dict[str, Any]]:
    """
    The blocks a reader gets. Of a block out of their reach, only that it is there:
    whatever else it holds was written for someone who can read that data.
    """
    return [
        {"id": block["id"], "type": REFUSED}
        if block["type"] in DATA_BLOCKS
        and str(block["query"]["dataset_id"]) not in sources
        else block
        for block in blocks
    ]


def reader_json(artifact: AssistantArtifact) -> dict[str, Any] | None:
    """The shared version of a document, as the current user reads it."""
    version = version_of(artifact.id, artifact.shared_version)
    if version is None:
        return None
    blocks = blocks_of(version)
    sources = sources_of(blocks)
    return {
        "id": str(artifact.id),
        "title": version.title,
        "version": version.number,
        "dashboard_id": artifact.dashboard_id,
        "blocks": _redacted(blocks, sources),
        "sources": sources,
        "created_on": version.created_on.isoformat(),
        "model_name": model_name(version.model),
        "reader": True,
        "author": _name_of(_author(artifact)),
        "written_on": oldest_text(blocks),
        "shared_on": artifact.shared_on.isoformat(),
    }


def _passages(text: str) -> list[str]:
    """The sentences of a text that hold a number."""
    return [
        sentence.replace("*", "").strip()[:MAX_PASSAGE_CHARS]
        for sentence in _SENTENCE.split(text)
        if _NUMBER.search(sentence)
    ]


def _datasets(
    blocks: Sequence[dict[str, Any]], sources: dict[str, str], workspace_id: int
) -> list[dict[str, Any]]:
    """The datasets a document reads, and whether every member reads them too."""
    ids = {int(key) for key in sources}
    own = {
        row.dataset_id
        for row in db.session.query(WorkspaceDataset.dataset_id).filter(
            WorkspaceDataset.workspace_id == workspace_id,
            WorkspaceDataset.dataset_id.in_(ids),
        )
    }
    return [
        {"name": sources[str(dataset_id)], "for_every_member": dataset_id in own}
        for dataset_id in sorted(ids)
    ]


def _filters(blocks: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """The values a document filters by, which a reader sees under each block."""
    found: dict[str, list[Any]] = {}
    for block in blocks:
        if block["type"] not in DATA_BLOCKS:
            continue
        for item in block["query"].get("filters", []):
            value = item.get("val")
            values = value if isinstance(value, list) else [value]
            known = found.setdefault(item["col"], [])
            known.extend(v for v in values if v is not None and v not in known)
    return [
        {"column": column, "values": values[:MAX_FILTER_VALUES]}
        for column, values in found.items()
        if values
    ]


def share_card(
    artifact: AssistantArtifact, version: AssistantArtifactVersion
) -> dict[str, Any]:
    """
    What the owner reads before sharing: the numbers its text holds, as they were
    written, and what else a reader will see. ``problem`` says why it cannot be shared.
    """
    blocks = blocks_of(version)
    texts = [block["text"] for block in blocks if block["type"] == "text"]
    names = [
        block.get("title") or block.get("label")
        for block in blocks
        if block["type"] in DATA_BLOCKS
    ]
    passages = [line for text in texts for line in _passages(text)]
    passages += [name for name in names if _NUMBER.search(name)]
    workspace_id = workspace_id_of(artifact.dashboard_id)
    workspace = db.session.get(Workspace, workspace_id) if workspace_id else None
    dashboard = db.session.get(Dashboard, artifact.dashboard_id)
    card: dict[str, Any] = {
        "version": version.number,
        "title": version.title,
        "workspace": workspace.name if workspace else None,
        "members": len(workspace.members) if workspace else 0,
        "draft": not dashboard.published,
        "text_blocks": len(texts),
        "numbers": sum(len(_NUMBER.findall(text)) for text in [*texts, *names]),
        "passages": passages[:MAX_PASSAGES],
        "more_passages": max(len(passages) - MAX_PASSAGES, 0),
        "filters": _filters(blocks),
        "datasets": [],
        "problem": None,
    }
    if workspace is None:
        return {**card, "problem": NO_WORKSPACE}
    if not is_member(workspace.id, artifact.user_id):
        return {**card, "problem": NOT_A_MEMBER}
    card["datasets"] = _datasets(blocks, sources_of(blocks), workspace.id)
    return card


def share(artifact: AssistantArtifact, version: AssistantArtifactVersion) -> None:
    """Share this version, in place of any other. The caller read the card with it."""
    artifact.shared_workspace_id = workspace_id_of(artifact.dashboard_id)
    artifact.shared_version = version.number
    artifact.shared_on = datetime.now()
    db.session.commit()  # pylint: disable=consider-using-transaction


def _close(artifact: AssistantArtifact) -> None:
    artifact.shared_workspace_id = None
    artifact.shared_version = None
    artifact.shared_on = None


def unshare(artifact: AssistantArtifact) -> None:
    """Close a share: the next read of anyone finds nothing."""
    _close(artifact)
    db.session.commit()  # pylint: disable=consider-using-transaction


def end_shares_of_member(workspace_id: int, user_id: int) -> None:
    """Who leaves a workspace takes their shares with them, in the caller's commit."""
    for artifact in db.session.query(AssistantArtifact).filter(
        AssistantArtifact.shared_workspace_id == workspace_id,
        AssistantArtifact.user_id == user_id,
    ):
        _close(artifact)


def end_moved_shares(dashboard_ids: Iterable[int]) -> None:
    """A report that left a workspace closes its shares, in the caller's commit."""
    for artifact in db.session.query(AssistantArtifact).filter(
        AssistantArtifact.dashboard_id.in_(list(dashboard_ids)),
        AssistantArtifact.shared_version.isnot(None),
    ):
        if workspace_id_of(artifact.dashboard_id) != artifact.shared_workspace_id:
            _close(artifact)


def end_shares_of_conversations(conversation_ids: Sequence[UUID]) -> None:
    """A conversation kept past its retention keeps its text from anyone else."""
    for artifact in db.session.query(AssistantArtifact).filter(
        AssistantArtifact.conversation_id.in_(conversation_ids),
        AssistantArtifact.shared_version.isnot(None),
    ):
        _close(artifact)


def shared_in(workspace_id: int) -> list[dict[str, Any]]:
    """
    What the current user reads as shared in a workspace, the last shared first. An
    author who lost the report still finds theirs, to stop sharing it: see ``opens``.
    """
    # pylint: disable=import-outside-toplevel
    from superset.auradata.assistant.turns import open_dashboard

    user_id = get_user_id()
    found = []
    for artifact in (
        db.session.query(AssistantArtifact)
        .filter(
            AssistantArtifact.shared_workspace_id == workspace_id,
            AssistantArtifact.shared_version.isnot(None),
        )
        .order_by(AssistantArtifact.shared_on.desc())
        .limit(MAX_LISTED)
    ):
        if artifact.user_id != user_id and not reads_share(artifact, user_id):
            continue
        version = version_of(artifact.id, artifact.shared_version)
        if version is not None and is_live(artifact):
            found.append(
                {
                    "id": str(artifact.id),
                    "title": version.title,
                    "author": _name_of(_author(artifact)),
                    "dashboard_id": artifact.dashboard_id,
                    "shared_on": artifact.shared_on.isoformat(),
                    "opens": open_dashboard(artifact.dashboard_id) is not None,
                }
            )
    return found


def log_document(
    action: str, artifact: AssistantArtifact, version: AssistantArtifactVersion
) -> None:
    """One row of the action log for what a person did with a document."""
    event_logger.log(
        user_id=get_user_id(),
        action=ASSISTANT_DOCUMENT,
        dashboard_id=artifact.dashboard_id,
        duration_ms=None,
        slice_id=None,
        referrer=None,
        curated_payload={
            "action": action,
            "artifact_id": str(artifact.id),
            "version": version.number,
            "model": version.model,
            "workspace_id": artifact.shared_workspace_id,
        },
    )
