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
"""REST API and pages for Mi BI workspaces."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe
from flask_appbuilder.security.decorators import has_access
from marshmallow import fields, pre_load, Schema, validate, ValidationError
from sqlalchemy import or_

from superset import db, security_manager
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.mibi.models import (
    ROLE_ADMIN,
    ROLE_CONTRIBUTOR,
    ROLE_VIEWER,
    ROLES,
    Workspace,
    WorkspaceDashboard,
    WorkspaceMember,
)
from superset.mibi.workspace_access import (
    member_workspace_ids,
    role_rank,
    workspace_role,
)
from superset.superset_typing import FlaskResponse
from superset.utils.core import get_user_id
from superset.views.base import BaseSupersetView
from superset.views.base_api import BaseSupersetApi, statsd_metrics

MAX_IMAGE_BYTES = 2 * 1024 * 1024

# Raster formats only: an SVG could carry scripts
IMAGE_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}


def sniff_image_type(data: bytes) -> str | None:
    """Return the image media type from the file signature, or None."""
    for media_type, signatures in IMAGE_SIGNATURES.items():
        if any(data.startswith(signature) for signature in signatures):
            return media_type
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


class WorkspaceSchema(Schema):
    """Fields a user can set on a workspace."""

    name = fields.String(required=True, validate=validate.Length(min=1, max=250))
    description = fields.String(allow_none=True, validate=validate.Length(max=1000))
    color = fields.String(
        allow_none=True, validate=validate.Regexp(r"^#[0-9a-fA-F]{6}$")
    )

    @pre_load
    def strip_text(self, data: Any, **kwargs: Any) -> Any:
        """Trim names and descriptions, so a blank name is rejected."""
        if not isinstance(data, dict):
            return data
        data = dict(data)
        for key in ("name", "description"):
            if isinstance(data.get(key), str):
                data[key] = data[key].strip()
        return data


class WorkspaceMemberSchema(Schema):
    """A user and the role to give them."""

    user_id = fields.Integer(required=True)
    role = fields.String(required=True, validate=validate.OneOf(ROLES))


class WorkspaceDashboardsSchema(Schema):
    """Dashboards to move into or out of a workspace."""

    add = fields.List(fields.Integer(), load_default=list)
    remove = fields.List(fields.Integer(), load_default=list)


def accessible_dashboard_ids(workspace: Workspace) -> list[int]:
    """Ids of the workspace dashboards the current user can see."""
    ids = [link.dashboard_id for link in workspace.dashboards]
    if not ids:
        return []
    return sorted(dashboard.id for dashboard in DashboardDAO.find_by_ids(ids))


def image_url(workspace: Workspace) -> str | None:
    if not workspace.image_type:
        return None
    version = int((workspace.changed_on or datetime.now()).timestamp())
    return f"/api/v1/workspace/{workspace.id}/image/?v={version}"


def user_dict(user: Any) -> dict[str, Any]:
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def serialize(workspace: Workspace, role: str | None = None) -> dict[str, Any]:
    """The workspace as the API returns it, with the current user's rights."""
    role = role or workspace_role(workspace.id)
    dashboard_ids = accessible_dashboard_ids(workspace)
    members = sorted(
        workspace.members,
        key=lambda member: (-role_rank(member.role), member.user_id),
    )
    return {
        "id": workspace.id,
        "uuid": str(workspace.uuid) if workspace.uuid else None,
        "name": workspace.name,
        "description": workspace.description,
        "color": workspace.color,
        "image_url": image_url(workspace),
        "dashboard_ids": dashboard_ids,
        "dashboard_count": len(dashboard_ids),
        "changed_on": workspace.changed_on.isoformat()
        if workspace.changed_on
        else None,
        "created_by": user_dict(workspace.created_by) if workspace.created_by else None,
        "role": role,
        "can_edit": role == ROLE_ADMIN,
        "can_contribute": role_rank(role) >= role_rank(ROLE_CONTRIBUTOR),
        "member_count": len(members),
        "members": [
            {**user_dict(member.user), "role": member.role}
            for member in members[:5]
            if member.user
        ],
    }


class WorkspaceRestApi(BaseSupersetApi):
    """Workspaces group dashboards, each with a name, picture and description."""

    resource_name = "workspace"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get_list": "read",
        "get": "read",
        "get_image": "read",
        "of_dashboard": "read",
        "get_dashboards": "read",
        "get_members": "read",
        "put_member": "write",
        "delete_member": "write",
        "member_candidates": "write",
        "post": "write",
        "put": "write",
        "delete": "write",
        "put_image": "write",
        "delete_image": "write",
        "put_dashboards": "write",
    }
    openapi_spec_tag = "Mi BI"

    def _find(
        self, pk: int, min_role: str = ROLE_VIEWER
    ) -> tuple[Workspace | None, str | None, Response | None]:
        """
        The workspace, the user's role in it, or the error to return: 404 when the
        user does not belong to it, 403 when their role is below ``min_role``.
        """
        workspace = db.session.query(Workspace).filter(Workspace.id == pk).one_or_none()
        role = workspace_role(pk) if workspace else None
        if workspace is None or role is None:
            return None, None, self.response_404()
        if role_rank(role) < role_rank(min_role):
            return None, None, self.response_403()
        return workspace, role, None

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_list(self) -> Response:
        """List the workspaces.
        ---
        get:
          summary: List the workspaces
          responses:
            200:
              description: Workspaces, ordered by name
            401:
              $ref: '#/components/responses/401'
        """
        query = db.session.query(Workspace)
        if not security_manager.is_admin():
            query = query.filter(Workspace.id.in_(member_workspace_ids(get_user_id())))
        workspaces = query.order_by(Workspace.name).all()
        return self.response(200, result=[serialize(ws) for ws in workspaces])

    @expose("/<int:pk>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get(self, pk: int) -> Response:
        """Get a workspace.
        ---
        get:
          summary: Get a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: The workspace
            404:
              $ref: '#/components/responses/404'
        """
        workspace, role, error_response = self._find(pk)
        if workspace is None:
            return error_response
        return self.response(200, result=serialize(workspace, role))

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Create a workspace.
        ---
        post:
          summary: Create a workspace
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            201:
              description: The new workspace
            400:
              $ref: '#/components/responses/400'
        """
        try:
            data = WorkspaceSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        workspace = Workspace(**data)
        if user_id := get_user_id():
            # Whoever creates a workspace administers it
            workspace.members.append(WorkspaceMember(user_id=user_id, role=ROLE_ADMIN))
        db.session.add(workspace)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(201, result=serialize(workspace))

    @expose("/<int:pk>/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:
        """Change a workspace.
        ---
        put:
          summary: Change the name, description or color of a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: The workspace
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        try:
            data = WorkspaceSchema(partial=True).load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        for key, value in data.items():
            setattr(workspace, key, value)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=serialize(workspace))

    @expose("/<int:pk>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:
        """Delete a workspace. Its dashboards are kept, outside any workspace.
        ---
        delete:
          summary: Delete a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Deleted
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        db.session.delete(workspace)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, message="OK")

    @expose("/<int:pk>/image/", methods=("GET",))
    @protect()
    @safe
    def get_image(self, pk: int) -> Response:
        """The workspace picture.
        ---
        get:
          summary: Get the workspace picture
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: The image
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, _ = self._find(pk)
        if workspace is None or not workspace.image or not workspace.image_type:
            return self.response_404()
        response = Response(workspace.image, mimetype=workspace.image_type)
        response.headers["Cache-Control"] = "private, max-age=31536000"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        return response

    @expose("/<int:pk>/image/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put_image(self, pk: int) -> Response:
        """Upload the workspace picture (PNG, JPEG, GIF or WebP, 2 MB at most).
        ---
        put:
          summary: Upload the workspace picture
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              multipart/form-data:
                schema:
                  type: object
                  properties:
                    image:
                      type: string
                      format: binary
          responses:
            200:
              description: The workspace
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        upload = request.files.get("image")
        if upload is None:
            return self.response_400(message="Missing image")
        data = upload.read(MAX_IMAGE_BYTES + 1)
        if len(data) > MAX_IMAGE_BYTES:
            return self.response_400(message="The image is larger than 2 MB")
        media_type = sniff_image_type(data)
        if media_type is None:
            return self.response_400(message="Use a PNG, JPEG, GIF or WebP image")
        workspace.image = data
        workspace.image_type = media_type
        workspace.changed_on = datetime.now()
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=serialize(workspace))

    @expose("/<int:pk>/image/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete_image(self, pk: int) -> Response:
        """Remove the workspace picture.
        ---
        delete:
          summary: Remove the workspace picture
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: The workspace
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        workspace.image = None
        workspace.image_type = None
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=serialize(workspace))

    @expose("/<int:pk>/dashboards/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_dashboards(self, pk: int) -> Response:
        """The dashboards of a workspace that the user can access.
        ---
        get:
          summary: List the dashboards of a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Dashboards, most recently changed first
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk)
        if workspace is None:
            return error_response
        ids = [link.dashboard_id for link in workspace.dashboards]
        dashboards = DashboardDAO.find_by_ids(ids) if ids else []
        dashboards = sorted(
            dashboards,
            key=lambda dashboard: dashboard.changed_on or datetime.min,
            reverse=True,
        )
        return self.response(
            200,
            result=[
                {
                    "id": dashboard.id,
                    "dashboard_title": dashboard.dashboard_title,
                    "url": dashboard.url,
                    "published": dashboard.published,
                    "changed_on_delta_humanized": dashboard.changed_on_humanized,
                    "can_edit": security_manager.is_owner(dashboard),
                }
                for dashboard in dashboards
            ],
        )

    @expose("/<int:pk>/dashboards/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put_dashboards(self, pk: int) -> Response:
        """Move dashboards into or out of a workspace.

        A dashboard lives in one workspace: adding it here takes it out of the
        previous one. Contributors and admins of the workspace move dashboards, and
        adding one also needs the right to change it.
        ---
        put:
          summary: Move dashboards into or out of a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    add:
                      type: array
                      items:
                        type: integer
                    remove:
                      type: array
                      items:
                        type: integer
          responses:
            200:
              description: The workspace
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_CONTRIBUTOR)
        if workspace is None:
            return error_response
        try:
            data = WorkspaceDashboardsSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)

        requested = set(data["add"]) | set(data["remove"])
        dashboards = {d.id: d for d in DashboardDAO.find_by_ids(list(requested))}
        if set(dashboards) != requested:
            return self.response_404()
        try:
            # Bringing a dashboard in needs the right to change it; taking one
            # out only needs a contributor role here
            for dashboard_id in data["add"]:
                security_manager.raise_for_ownership(dashboards[dashboard_id])
        except SupersetSecurityException:
            return self.response_403()

        links = (
            db.session.query(WorkspaceDashboard)
            .filter(WorkspaceDashboard.dashboard_id.in_(requested))
            .all()
        )
        for link in links:
            if link.dashboard_id in data["add"]:
                link.workspace_id = workspace.id
            elif link.workspace_id == workspace.id:
                db.session.delete(link)
        linked = {link.dashboard_id for link in links}
        for dashboard_id in set(data["add"]) - linked:
            db.session.add(
                WorkspaceDashboard(workspace_id=workspace.id, dashboard_id=dashboard_id)
            )
        db.session.commit()  # pylint: disable=consider-using-transaction
        db.session.refresh(workspace)
        return self.response(200, result=serialize(workspace))

    @expose("/of_dashboard/<int:dashboard_id>/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def of_dashboard(self, dashboard_id: int) -> Response:
        """The workspace a dashboard lives in.
        ---
        get:
          summary: Get the workspace of a dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: dashboard_id
          responses:
            200:
              description: The workspace, or null when the dashboard has none
            404:
              $ref: '#/components/responses/404'
        """
        if DashboardDAO.find_by_id(dashboard_id) is None:
            return self.response_404()
        link = (
            db.session.query(WorkspaceDashboard)
            .filter(WorkspaceDashboard.dashboard_id == dashboard_id)
            .one_or_none()
        )
        role = workspace_role(link.workspace_id) if link else None
        if link is None or role is None:
            # Workspaces the user does not belong to stay private
            return self.response(200, result=None)
        workspace = link.workspace
        return self.response(
            200,
            result={
                "id": workspace.id,
                "name": workspace.name,
                "color": workspace.color,
                "image_url": image_url(workspace),
                "role": role,
            },
        )

    @expose("/<int:pk>/members/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_members(self, pk: int) -> Response:
        """The members of a workspace and their roles.
        ---
        get:
          summary: List the members of a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Members, admins first
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk)
        if workspace is None:
            return error_response
        members = sorted(
            (member for member in workspace.members if member.user),
            key=lambda member: (
                -role_rank(member.role),
                (member.user.first_name or "").lower(),
            ),
        )
        return self.response(
            200,
            result=[
                {
                    **user_dict(member.user),
                    "username": member.user.username,
                    "role": member.role,
                }
                for member in members
            ],
        )

    @expose("/<int:pk>/members/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put_member(self, pk: int) -> Response:
        """Add a member to a workspace, or change their role.
        ---
        put:
          summary: Add a member or change their role
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    user_id:
                      type: integer
                    role:
                      type: string
                      enum: [viewer, contributor, admin]
          responses:
            200:
              description: The workspace
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, role, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        try:
            data = WorkspaceMemberSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        user = (
            db.session.query(security_manager.user_model)
            .filter(security_manager.user_model.id == data["user_id"])
            .one_or_none()
        )
        if user is None or not user.active:
            return self.response_404()

        member = next(
            (m for m in workspace.members if m.user_id == data["user_id"]), None
        )
        if member is None:
            workspace.members.append(
                WorkspaceMember(user_id=user.id, role=data["role"])
            )
        else:
            if self._is_last_admin(workspace, member) and data["role"] != ROLE_ADMIN:
                return self.response_400(message="A workspace needs at least one admin")
            member.role = data["role"]
        db.session.commit()  # pylint: disable=consider-using-transaction
        db.session.refresh(workspace)
        return self.response(200, result=serialize(workspace, role))

    @expose("/<int:pk>/members/<int:user_id>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete_member(self, pk: int, user_id: int) -> Response:
        """Remove a member. Admins remove anyone; any member can leave.
        ---
        delete:
          summary: Remove a member from a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: integer
            name: user_id
          responses:
            200:
              description: The workspace, or null when the user left it
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        leaving = user_id == get_user_id()
        workspace, _, error_response = self._find(
            pk, ROLE_VIEWER if leaving else ROLE_ADMIN
        )
        if workspace is None:
            return error_response
        member = next((m for m in workspace.members if m.user_id == user_id), None)
        if member is None:
            return self.response_404()
        if self._is_last_admin(workspace, member):
            return self.response_400(message="A workspace needs at least one admin")
        workspace.members.remove(member)
        db.session.commit()  # pylint: disable=consider-using-transaction
        db.session.refresh(workspace)
        role = workspace_role(workspace.id)
        return self.response(200, result=serialize(workspace, role) if role else None)

    @expose("/<int:pk>/member_candidates/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def member_candidates(self, pk: int) -> Response:
        """Active users who are not members yet, to add to the workspace.
        ---
        get:
          summary: Search users to add to a workspace
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: query
            schema:
              type: string
            name: q
          responses:
            200:
              description: Up to 20 users
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        workspace, _, error_response = self._find(pk, ROLE_ADMIN)
        if workspace is None:
            return error_response
        user_model = security_manager.user_model
        query = db.session.query(user_model).filter(
            user_model.active.is_(True),
            ~user_model.id.in_([member.user_id for member in workspace.members]),
        )
        if text := (request.args.get("q") or "").strip():
            pattern = f"%{text}%"
            query = query.filter(
                or_(
                    user_model.first_name.ilike(pattern),
                    user_model.last_name.ilike(pattern),
                    user_model.username.ilike(pattern),
                    user_model.email.ilike(pattern),
                )
            )
        users = query.order_by(user_model.first_name).limit(20).all()
        return self.response(
            200,
            result=[{**user_dict(user), "username": user.username} for user in users],
        )

    @staticmethod
    def _is_last_admin(workspace: Workspace, member: WorkspaceMember) -> bool:
        admins = [m for m in workspace.members if m.role == ROLE_ADMIN]
        return member.role == ROLE_ADMIN and len(admins) == 1


class WorkspaceView(BaseSupersetView):
    """Serves the workspace pages of the single-page app."""

    route_base = "/workspace"
    class_permission_name = "Dashboard"
    method_permission_name = {"list": "read", "show": "read"}

    @has_access
    @expose("/list/")
    def list(self) -> FlaskResponse:
        return super().render_app_template()

    @has_access
    @expose("/<int:pk>/")
    def show(self, pk: int) -> FlaskResponse:  # pylint: disable=unused-argument
        return super().render_app_template()
