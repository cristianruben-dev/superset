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
Documents of the assistant: a person's own, over one report, inside one conversation.

An artifact is written by the assistant through its own tools (``artifact_tools.py``)
and only read by its owner in this phase, so ``find_artifact`` is the only way to one
and answers None for anybody else's, an admin too. Each change is a new row of versions;
the last one is the document, and going back copies an earlier one as a new one.

A block of data stores a query and nothing it returned, and ``query_problem`` holds that
query against the dataset as the person, on every write. Its numbers are read when the
document opens, by the person looking, through the chart data API, which decides again.
So nothing here ever holds a figure, and ``sources_of`` only names the datasets the
reader reaches.

A document goes with its conversation, by ``delete_artifacts_of``: it says what the
answers said, so it cannot outlive them.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.exc import IntegrityError

from superset import security_manager
from superset.auradata.models import AssistantArtifact, AssistantArtifactVersion
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.utils import json

CREATE_ARTIFACT = "create_artifact"
CHANGE_ARTIFACT = "change_artifact"
READ_ARTIFACT = "read_artifact"
ARTIFACT_TOOLS = frozenset({CREATE_ARTIFACT, CHANGE_ARTIFACT, READ_ARTIFACT})
WRITING_TOOLS = frozenset({CREATE_ARTIFACT, CHANGE_ARTIFACT})

ORIGIN_CREATED = "created"
ORIGIN_CHANGED = "changed"
ORIGIN_RESTORED = "restored"

DATA_BLOCKS = frozenset({"figure", "chart", "table"})

MAX_PER_CONVERSATION = 10
MAX_VERSIONS = 200
MAX_CONTENT_CHARS = 200_000
BLOCK_ID_LENGTH = 8


class ArtifactRefusedError(Exception):
    """What was asked cannot be stored. Its text says why, for the model."""


class ArtifactMovedError(Exception):
    """Someone wrote a version first."""


def new_block_id() -> str:
    """The id of a block: short, for the model to repeat, and stable across versions."""
    return uuid4().hex[:BLOCK_ID_LENGTH]


def find_artifact(artifact_id: UUID, user_id: int) -> AssistantArtifact | None:
    """A document of this user. Anyone else's is None, like one that never was."""
    return (
        db.session.query(AssistantArtifact)
        .filter(
            AssistantArtifact.id == artifact_id,
            AssistantArtifact.user_id == user_id,
        )
        .one_or_none()
    )


def artifacts_of(conversation_id: UUID) -> list[AssistantArtifact]:
    """The documents of a conversation, the oldest first."""
    return (
        db.session.query(AssistantArtifact)
        .filter(AssistantArtifact.conversation_id == conversation_id)
        .order_by(AssistantArtifact.created_on, AssistantArtifact.id)
        .all()
    )


def versions_of(artifact_id: UUID) -> list[AssistantArtifactVersion]:
    """Every version of a document, the oldest first."""
    return (
        db.session.query(AssistantArtifactVersion)
        .filter(AssistantArtifactVersion.artifact_id == artifact_id)
        .order_by(AssistantArtifactVersion.number)
        .all()
    )


def version_of(
    artifact_id: UUID, number: int | None = None
) -> AssistantArtifactVersion | None:
    """One version of a document, by default the last one."""
    query = db.session.query(AssistantArtifactVersion).filter(
        AssistantArtifactVersion.artifact_id == artifact_id
    )
    if number is not None:
        return query.filter(AssistantArtifactVersion.number == number).one_or_none()
    return query.order_by(AssistantArtifactVersion.number.desc()).first()


def blocks_of(version: AssistantArtifactVersion) -> list[dict[str, Any]]:
    """The blocks of a version."""
    return json.loads(version.blocks)


def _dumped(title: str, blocks: list[dict[str, Any]]) -> str:
    text = json.dumps(blocks)
    if len(text) + len(title) > MAX_CONTENT_CHARS:
        raise ArtifactRefusedError("This document is too long. Make it shorter.")
    return text


def add_version(  # pylint: disable=too-many-arguments
    artifact_id: UUID,
    number: int,
    title: str,
    blocks: list[dict[str, Any]],
    origin: str,
    *,
    restored_from: int | None = None,
    model: str | None = None,
) -> AssistantArtifactVersion:
    """
    Add a version, in the transaction of the caller. Its number is unique, so of two
    writers only one gets through, and the other hears ``ArtifactMovedError``.
    """
    if number > MAX_VERSIONS:
        raise ArtifactRefusedError(
            "This document has too many versions. Start a new one."
        )
    version = AssistantArtifactVersion(
        id=uuid4(),
        artifact_id=artifact_id,
        number=number,
        title=title,
        blocks=_dumped(title, blocks),
        origin=origin,
        restored_from=restored_from,
        model=model,
    )
    db.session.add(version)
    try:
        db.session.flush()
    except IntegrityError as ex:
        db.session.rollback()
        raise ArtifactMovedError from ex
    return version


def create_artifact(  # pylint: disable=too-many-arguments
    conversation_id: UUID,
    user_id: int,
    dashboard_id: int,
    title: str,
    blocks: list[dict[str, Any]],
    model: str | None,
) -> tuple[AssistantArtifact, AssistantArtifactVersion]:
    """A new document with its first version."""
    if len(artifacts_of(conversation_id)) >= MAX_PER_CONVERSATION:
        raise ArtifactRefusedError(
            "This conversation has too many documents. Change one of them."
        )
    artifact = AssistantArtifact(
        id=uuid4(),
        conversation_id=conversation_id,
        user_id=user_id,
        dashboard_id=dashboard_id,
    )
    db.session.add(artifact)
    db.session.flush()
    version = add_version(artifact.id, 1, title, blocks, ORIGIN_CREATED, model=model)
    db.session.commit()
    return artifact, version


def restore_version(
    artifact: AssistantArtifact, number: int
) -> AssistantArtifactVersion | None:
    """
    Go back to a version by copying it as a new one, blocks and dates of its text as
    they were: that text was written then. None when the version does not exist. Its
    queries are stored again, so they are held again as on any write.
    """
    source = version_of(artifact.id, number)
    latest = version_of(artifact.id)
    if source is None or latest is None:
        return None
    blocks = blocks_of(source)
    for block in blocks:
        if block["type"] in DATA_BLOCKS:
            if problem := query_problem(dict(block["query"]), artifact.dashboard_id):
                raise ArtifactRefusedError(problem)
    version = add_version(
        artifact.id,
        latest.number + 1,
        source.title,
        blocks,
        ORIGIN_RESTORED,
        restored_from=number,
    )
    db.session.commit()
    return version


def delete_artifacts_of(conversation_ids: Sequence[UUID]) -> None:
    """Delete the documents of conversations, in the transaction of the caller."""
    ids = [
        row.id
        for row in db.session.query(AssistantArtifact.id).filter(
            AssistantArtifact.conversation_id.in_(conversation_ids)
        )
    ]
    if not ids:
        return
    db.session.query(AssistantArtifactVersion).filter(
        AssistantArtifactVersion.artifact_id.in_(ids)
    ).delete(synchronize_session=False)
    db.session.query(AssistantArtifact).filter(AssistantArtifact.id.in_(ids)).delete(
        synchronize_session=False
    )


def _dataset(dataset_id: int) -> Any | None:
    """A dataset this user reaches, or None: not found and refused read the same."""
    # pylint: disable=import-outside-toplevel
    from superset.mcp_service.dataset.dataset_utils import resolve_dataset
    from superset.mcp_service.privacy import user_can_view_data_model_metadata

    if not user_can_view_data_model_metadata():
        return None
    dataset = resolve_dataset(dataset_id)
    if dataset is None:
        return None
    try:
        security_manager.raise_for_access(datasource=dataset)
    except SupersetSecurityException:
        return None
    return dataset


def _unknown_names(dataset: Any, query: dict[str, Any]) -> list[str]:
    """What a query names and its dataset does not have."""
    # pylint: disable=import-outside-toplevel
    from superset.common.tabular_query import validate_query_names
    from superset.mcp_service.dataset.schemas import aggregate_metric

    columns = {column.column_name for column in dataset.columns}
    metrics = {metric.metric_name for metric in dataset.metrics}
    aggregates = [
        aggregate_metric(item["column"], item["aggregate"])
        for item in query.get("aggregates", [])
    ]
    return validate_query_names(
        metrics | {metric["label"] for metric in aggregates},
        columns,
        metrics=[*query.get("metrics", []), *aggregates],
        dimensions=[
            *query.get("columns", []),
            *(item["column"] for item in query.get("aggregates", [])),
        ],
        filters=[{"col": item["col"]} for item in query.get("filters", [])],
        order_names=query.get("order_by"),
    )


def _time_column_of(dataset: Any, query: dict[str, Any]) -> str | None:
    """The column of a time range, which a block stores so that it never changes."""
    name = query.get("time_column") or getattr(dataset, "main_dttm_col", None)
    known = {column.column_name for column in dataset.columns}
    return name if name in known else None


def query_problem(query: dict[str, Any], dashboard_id: int) -> str | None:
    """
    Why a query cannot go in a block, as the person asking: it can only name a dataset
    they reach and a chart of this report could use, and what that dataset has. It
    leaves in ``query`` the time column it resolved.
    """
    # pylint: disable=import-outside-toplevel
    from superset.auradata.workspace_datasets import validate_chart_dataset

    dataset = _dataset(query["dataset_id"])
    if dataset is None:
        return f"No dataset you can reach has the id {query['dataset_id']}."
    if validate_chart_dataset(dataset.id, "table", [dashboard_id]) is not None:
        return "This dataset belongs to another workspace."
    if errors := _unknown_names(dataset, query):
        return "; ".join(errors)
    if query.get("time_range"):
        column = _time_column_of(dataset, query)
        if column is None:
            return "time_range needs a time column this dataset has."
        query["time_column"] = column
    return None


def sources_of(blocks: Iterable[dict[str, Any]]) -> dict[str, str]:
    """
    The names of the datasets a reader reaches, by id: a block whose dataset is missing
    here says it is refused, without naming it.
    """
    ids = {
        block["query"]["dataset_id"] for block in blocks if block["type"] in DATA_BLOCKS
    }
    sources = {}
    for dataset_id in ids:
        dataset = _dataset(dataset_id)
        if dataset is not None:
            sources[str(dataset_id)] = dataset.table_name
    return sources


def version_json(version: AssistantArtifactVersion) -> dict[str, Any]:
    """A line of the history of a document."""
    return {
        "number": version.number,
        "title": version.title,
        "origin": version.origin,
        "restored_from": version.restored_from,
        "model": version.model,
        "created_on": version.created_on.isoformat(),
    }


def artifact_summary(
    artifact: AssistantArtifact, version: AssistantArtifactVersion
) -> dict[str, Any]:
    """What the chat says about a document."""
    return {
        "id": str(artifact.id),
        "title": version.title,
        "version": version.number,
    }


def artifact_json(
    artifact: AssistantArtifact, version: AssistantArtifactVersion
) -> dict[str, Any]:
    """A version of a document, for its owner."""
    blocks = blocks_of(version)
    return {
        **artifact_summary(artifact, version),
        "conversation_id": str(artifact.conversation_id),
        "dashboard_id": artifact.dashboard_id,
        "blocks": blocks,
        "sources": sources_of(blocks),
        "created_on": version.created_on.isoformat(),
        "versions": [version_json(item) for item in versions_of(artifact.id)],
    }


def summaries_of(conversation_id: UUID) -> list[dict[str, Any]]:
    """The documents of a conversation, the oldest first, for the panel."""
    found = []
    for artifact in artifacts_of(conversation_id):
        if version := version_of(artifact.id):
            found.append(artifact_summary(artifact, version))
    return found


def _result_text(result: dict[str, Any]) -> str | None:
    blocks = result.get("content") or []
    if result.get("is_error") or len(blocks) != 1 or blocks[0].get("type") != "text":
        return None
    return blocks[0].get("text")


def artifact_of(
    tool_use: dict[str, Any], tool_result: dict[str, Any]
) -> dict[str, Any] | None:
    """
    The document a stored call wrote, or None: the panel learns of a document from the
    call itself, so the stream and a conversation read later say the same.
    """
    if tool_use.get("name") not in WRITING_TOOLS:
        return None
    text = _result_text(tool_result)
    if text is None:
        return None
    try:
        result = json.loads(text)
    except ValueError:
        return None
    if not isinstance(result, dict) or "artifact_id" not in result:
        return None
    return {
        "id": result["artifact_id"],
        "title": result.get("title"),
        "version": result.get("version"),
    }


def artifact_calls(messages: Iterable[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """What the calls of a stored conversation wrote, by the id of the call."""
    calls: dict[str, dict[str, Any]] = {}
    written: dict[str, dict[str, Any]] = {}
    for message in messages:
        for block in message["content"]:
            if block.get("type") == "tool_use":
                calls[block["id"]] = block
            elif block.get("type") == "tool_result":
                call = calls.get(block["tool_use_id"])
                found = artifact_of(call, block) if call else None
                if found is not None:
                    written[block["tool_use_id"]] = found
    return written


def selected_context(
    artifact_id: str, block_id: str | None, user_id: int, conversation_id: UUID
) -> dict[str, Any] | None:
    """
    What the model reads about the document open beside the chat. The browser only names
    it: the server reads the document and the selected block, which must be of this
    person and this conversation. A block carries its query, never what it showed.
    """
    try:
        artifact = find_artifact(UUID(artifact_id), user_id)
    except ValueError:
        return None
    if artifact is None or artifact.conversation_id != conversation_id:
        return None
    version = version_of(artifact.id)
    if version is None:
        return None
    context = artifact_summary(artifact, version)
    if version.restored_from is not None:
        context["restored_from"] = version.restored_from
    selected = next(
        (block for block in blocks_of(version) if block["id"] == block_id), None
    )
    if selected is not None:
        context["selected_block"] = selected
    return context
