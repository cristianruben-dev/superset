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
"""Workspaces: named groups of dashboards with a picture and a description."""

from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import deferred, relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable, UUIDMixin
from superset.utils.core import MediumText

WORKSPACES_TABLE = "auradata_workspaces"
WORKSPACE_DASHBOARDS_TABLE = "auradata_workspace_dashboards"
WORKSPACE_MEMBERS_TABLE = "auradata_workspace_members"
WORKSPACE_DATASETS_TABLE = "auradata_workspace_datasets"
ASSISTANT_CONVERSATIONS_TABLE = "auradata_assistant_conversations"
ASSISTANT_MESSAGES_TABLE = "auradata_assistant_messages"
ASSISTANT_FEEDBACK_TABLE = "auradata_assistant_feedback"
ASSISTANT_ATTACHMENTS_TABLE = "auradata_assistant_attachments"
ASSISTANT_ARTIFACTS_TABLE = "auradata_assistant_artifacts"
ASSISTANT_ARTIFACT_VERSIONS_TABLE = "auradata_assistant_artifact_versions"

# Workspace roles, from the least to the most rights
ROLE_VIEWER = "viewer"
ROLE_CONTRIBUTOR = "contributor"
ROLE_ADMIN = "admin"
ROLES = (ROLE_VIEWER, ROLE_CONTRIBUTOR, ROLE_ADMIN)


class Workspace(AuditMixinNullable, UUIDMixin, Model):
    """A place where dashboards live, like a Power BI workspace."""

    __tablename__ = WORKSPACES_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    name = sa.Column(sa.String(250), nullable=False)
    description = sa.Column(sa.Text, nullable=True)
    color = sa.Column(sa.String(16), nullable=True)
    # The picture is small (see MAX_IMAGE_BYTES in the API) and lives in the
    # metadata database, so it works the same on every deployment
    image = deferred(sa.Column(sa.LargeBinary, nullable=True))
    image_type = sa.Column(sa.String(50), nullable=True)

    dashboards = relationship(
        "WorkspaceDashboard",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    members = relationship(
        "WorkspaceMember",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    datasets = relationship(
        "WorkspaceDataset",
        back_populates="workspace",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class WorkspaceDashboard(Model):
    """Links a dashboard to its workspace. A dashboard is in one workspace at most."""

    __tablename__ = WORKSPACE_DASHBOARDS_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    workspace = relationship("Workspace", back_populates="dashboards")


class WorkspaceDataset(Model):
    """
    Links a dataset to the workspace it belongs to, like a Power BI semantic model.
    A dataset is in one workspace at most; one without a workspace is shared.
    """

    __tablename__ = WORKSPACE_DATASETS_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    dataset_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("tables.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    workspace = relationship("Workspace", back_populates="datasets")


class WorkspaceMember(Model):
    """A user with a role in a workspace.

    * viewer: sees the workspace and its dashboards
    * contributor: also adds, creates and edits its dashboards and charts
    * admin: also changes the workspace and who belongs to it
    """

    __tablename__ = WORKSPACE_MEMBERS_TABLE
    __table_args__ = (
        sa.UniqueConstraint(
            "workspace_id", "user_id", name="uq_auradata_workspace_members"
        ),
    )

    id = sa.Column(sa.Integer, primary_key=True)
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = sa.Column(
        sa.Integer, sa.ForeignKey("ab_user.id", ondelete="CASCADE"), nullable=False
    )
    role = sa.Column(sa.String(20), nullable=False, default=ROLE_VIEWER)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])


DASHBOARD_BACKGROUNDS_TABLE = "auradata_dashboard_backgrounds"


class DashboardBackground(Model):
    """The background picture of a dashboard canvas, set in the Format pane."""

    __tablename__ = DASHBOARD_BACKGROUNDS_TABLE

    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        primary_key=True,
    )
    image = deferred(sa.Column(sa.LargeBinary, nullable=False))
    image_type = sa.Column(sa.String(50), nullable=False)
    changed_on = sa.Column(sa.DateTime, nullable=False)


DASHBOARD_IMAGES_TABLE = "auradata_dashboard_images"


class DashboardImage(Model):
    """A picture shown by an image element of a dashboard."""

    __tablename__ = DASHBOARD_IMAGES_TABLE

    id = sa.Column(sa.Integer, primary_key=True)
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    image = deferred(sa.Column(sa.LargeBinary, nullable=False))
    image_type = sa.Column(sa.String(50), nullable=False)
    created_on = sa.Column(sa.DateTime, nullable=False)


class AssistantConversation(Model):
    """
    A conversation with the AI assistant, of one user over one dashboard.

    Its mode never changes: a conversation holds references to the tools it found,
    and another mode offers other tools. Deleting the user or the dashboard leaves
    the row without an owner, unreadable, until the retention task removes it. Delete
    one with ``conversations.erase_conversations``, which keeps what its answers cost:
    the keys that point here cascade, so any other way takes those totals with it.
    """

    __tablename__ = ASSISTANT_CONVERSATIONS_TABLE

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    user_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    mode = sa.Column(sa.String(16), nullable=False)
    model = sa.Column(sa.String(128), nullable=False)
    title = sa.Column(sa.String(250), nullable=False)
    # The system prompt of its first turn, sent unchanged from then on: what the model
    # thought is bound to it. Empty until that turn
    system_prompt = sa.Column(MediumText(), nullable=True)
    created_on = sa.Column(sa.DateTime, nullable=False, default=datetime.now)
    changed_on = sa.Column(
        sa.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    messages = relationship(
        "AssistantMessage",
        back_populates="conversation",
        order_by="AssistantMessage.seq",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class AssistantMessage(Model):
    """
    One message of a conversation, as the API received or returned it. Rows are only
    ever added: ``content`` is sent back unchanged on later turns, because editing a
    turn invalidates the thinking stored after it.

    Assistant messages carry what they cost, with the user and the workspace of that
    moment, so spending adds up by user and by workspace without walking back to a
    dashboard that may have moved. When their conversation is deleted these rows stay
    with no content and no ``conversation_id``, for those totals.
    """

    __tablename__ = ASSISTANT_MESSAGES_TABLE
    __table_args__ = (
        sa.UniqueConstraint(
            "conversation_id", "seq", name="uq_auradata_assistant_messages_seq"
        ),
    )

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    conversation_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_CONVERSATIONS_TABLE}.id", ondelete="CASCADE"),
        nullable=True,
    )
    seq = sa.Column(sa.Integer, nullable=False)
    role = sa.Column(sa.String(16), nullable=False)
    # JSON list of the content blocks
    content = sa.Column(MediumText(), nullable=False)
    stop_reason = sa.Column(sa.String(32), nullable=True)
    model = sa.Column(sa.String(128), nullable=True)
    user_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    input_tokens = sa.Column(sa.Integer, nullable=False, default=0)
    output_tokens = sa.Column(sa.Integer, nullable=False, default=0)
    cache_read_input_tokens = sa.Column(sa.Integer, nullable=False, default=0)
    cache_creation_input_tokens = sa.Column(sa.Integer, nullable=False, default=0)
    # What the model read the last time it ran for this answer. The token columns add
    # up every time, which is what it costs and not how long the conversation is
    context_tokens = sa.Column(
        sa.Integer, nullable=False, default=0, server_default="0"
    )
    cost_usd = sa.Column(sa.Numeric(14, 6), nullable=False, default=0)
    created_on = sa.Column(
        sa.DateTime, nullable=False, default=datetime.now, index=True
    )

    conversation = relationship("AssistantConversation", back_populates="messages")


class AssistantAttachment(Model):
    """
    An image attached to the assistant, as ``attachments.clean_image`` left it. A
    message only names it, by id: these bytes go out on every later request, and the
    history is read many times in a turn. Nothing here changes after the upload.

    Without ``conversation_id`` it is a draft, which only its ``user_id`` can read: it
    joins a conversation with the message that sends it. A draft nobody sent is deleted
    by the retention task. No name of a file, and no metadata, ever reaches this table.
    """

    __tablename__ = ASSISTANT_ATTACHMENTS_TABLE

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    conversation_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_CONVERSATIONS_TABLE}.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # A length, because a plain BLOB of MySQL stops at 64 KB
    image = deferred(sa.Column(sa.LargeBinary(length=2**24 - 1), nullable=False))
    image_type = sa.Column(sa.String(50), nullable=False)
    width = sa.Column(sa.Integer, nullable=False)
    height = sa.Column(sa.Integer, nullable=False)
    created_on = sa.Column(
        sa.DateTime, nullable=False, default=datetime.now, index=True
    )


class AssistantFeedback(Model):
    """
    What a person thought of an answer: one row per message and user, and a vote that
    can change. It lives beside the conversation, which only grows, so voting never
    touches a message.

    ``message_id`` is the first row of the answer, the one the panel shows it under.
    A vote outlives its conversation like the cost of that answer, detached and without
    its reason, for the totals of the usage report. Deleting the user keeps the vote,
    without owner, for the same reason.
    """

    __tablename__ = ASSISTANT_FEEDBACK_TABLE
    __table_args__ = (
        sa.UniqueConstraint(
            "message_id", "user_id", name="uq_auradata_assistant_feedback_vote"
        ),
    )

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    message_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_MESSAGES_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    conversation_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_CONVERSATIONS_TABLE}.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    user_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    vote = sa.Column(sa.String(8), nullable=False)
    # One of a fixed list, never free text: nothing a person pastes ends up here
    reason = sa.Column(sa.String(32), nullable=True)
    created_on = sa.Column(sa.DateTime, nullable=False, default=datetime.now)
    changed_on = sa.Column(
        sa.DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class AssistantArtifact(Model):
    """
    A document the assistant wrote for one person, over one report, in one conversation.

    The row only says whose it is, where it lives and who else may read which version:
    what it holds is in its versions, and the last one is the document. It goes with its
    conversation (``conversations.erase_conversations``), and like one it is unreadable
    once it loses its owner or its report, until the retention task removes that
    conversation.
    """

    __tablename__ = ASSISTANT_ARTIFACTS_TABLE

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    conversation_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_CONVERSATIONS_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("ab_user.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    dashboard_id = sa.Column(
        sa.Integer,
        sa.ForeignKey("dashboards.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_on = sa.Column(sa.DateTime, nullable=False, default=datetime.now)
    # Shared inside this workspace, at this version, which the owner read on a card.
    # ``sharing.py`` decides on every read whether it still holds
    shared_workspace_id = sa.Column(
        sa.Integer,
        sa.ForeignKey(f"{WORKSPACES_TABLE}.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    shared_version = sa.Column(sa.Integer, nullable=True)
    shared_on = sa.Column(sa.DateTime, nullable=True)


class AssistantArtifactVersion(Model):
    """
    One state of a document, whole. Rows are only ever added: going back to an earlier
    version copies it as a new one, and the unique ``number`` lets one of two racing
    writers through.

    ``blocks`` is a JSON list that ``artifact_blocks.py`` validated. A block of data
    holds its query and never a number, so no row here keeps figures of a reader.
    """

    __tablename__ = ASSISTANT_ARTIFACT_VERSIONS_TABLE
    __table_args__ = (
        sa.UniqueConstraint(
            "artifact_id", "number", name="uq_auradata_assistant_artifact_versions"
        ),
    )

    id = sa.Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)
    artifact_id = sa.Column(
        UUIDType(binary=True),
        sa.ForeignKey(f"{ASSISTANT_ARTIFACTS_TABLE}.id", ondelete="CASCADE"),
        nullable=False,
    )
    number = sa.Column(sa.Integer, nullable=False)
    title = sa.Column(sa.String(250), nullable=False)
    blocks = sa.Column(MediumText(), nullable=False)
    # How it came to be: created, changed or restored
    origin = sa.Column(sa.String(16), nullable=False)
    # The version a restored one copies
    restored_from = sa.Column(sa.Integer, nullable=True)
    # The model that wrote it, when one did
    model = sa.Column(sa.String(128), nullable=True)
    created_on = sa.Column(sa.DateTime, nullable=False, default=datetime.now)
