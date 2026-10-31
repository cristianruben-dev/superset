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
REST API for Mi BI format themes: a named dashboard style saved from the Format
pane and applied to other dashboards in one click.

A theme is JSON with three optional parts, all written by the frontend
(superset-frontend/src/mibi/format/themes.ts):

- ``canvas``: the canvas format (background, size, margins, gap), without a
  background picture, since pictures belong to one dashboard;
- ``visuals``: the style every chart shares (card, title, header icons);
- ``colorScheme``: the categorical palette of the charts.

Applying a theme writes it on the dashboard layout root (``mibiCanvas``), where
the dashboard reads the canvas format and the style every chart shares.
"""

from __future__ import annotations

from typing import Any

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe
from marshmallow import fields, pre_load, Schema, validate, ValidationError

from superset import db, security_manager
from superset.exceptions import SupersetSecurityException
from superset.mibi.models import FormatTheme, Workspace
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base_api import BaseSupersetApi, statsd_metrics

MAX_THEME_CHARS = 20_000
THEME_PARTS = ("canvas", "visuals", "colorScheme")
CANVAS_KEY = "mibiCanvas"
VISUAL_KEY = "mibiFormat"
ROOT_ID = "ROOT_ID"
GRID_ID = "GRID_ID"


def as_dict(value: Any) -> dict[str, Any]:
    """``value`` if it is a dict, else an empty one."""
    return value if isinstance(value, dict) else {}


def load_json_dict(text: str | None) -> dict[str, Any]:
    """The JSON object in ``text``, or an empty dict."""
    try:
        return as_dict(json.loads(text or "null"))
    except (TypeError, ValueError):
        return {}


def without_key(value: dict[str, Any], key: str) -> dict[str, Any]:
    return {k: v for k, v in value.items() if k != key}


def clean_canvas(canvas: dict[str, Any]) -> dict[str, Any]:
    """The canvas of a theme: no shared style (kept apart) and no picture."""
    canvas = without_key(canvas, "visuals")
    background = canvas.get("background")
    if isinstance(background, dict):
        background = without_key(background, "image")
        canvas["background"] = (
            {"type": "none"} if background.get("type") == "image" else background
        )
    return canvas


def clean_visuals(visuals: dict[str, Any]) -> dict[str, Any]:
    """The shared style of a theme: a subtitle is the text of one chart."""
    title = visuals.get("title")
    if isinstance(title, dict) and "subtitle" in title:
        return {**visuals, "title": without_key(title, "subtitle")}
    return visuals


def clean_theme(value: Any) -> dict[str, Any]:
    """The theme to store, or a ValidationError when it is not one."""
    if not isinstance(value, dict):
        raise ValidationError("A theme is an object")
    theme: dict[str, Any] = {}
    for part in THEME_PARTS:
        if value.get(part) is None:
            continue
        expected = str if part == "colorScheme" else dict
        if not isinstance(value[part], expected):
            raise ValidationError(f"Invalid {part}")
        theme[part] = value[part]
    if "canvas" in theme:
        theme["canvas"] = clean_canvas(theme["canvas"])
    if "visuals" in theme:
        theme["visuals"] = clean_visuals(theme["visuals"])
    if len(json.dumps(theme)) > MAX_THEME_CHARS:
        raise ValidationError("The theme is too large")
    return theme


def load_theme(theme: FormatTheme) -> dict[str, Any]:
    return load_json_dict(theme.theme)


def empty_layout() -> dict[str, Any]:
    """The layout of a dashboard nobody has edited, as the frontend builds it."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        ROOT_ID: {"type": "ROOT", "id": ROOT_ID, "children": [GRID_ID]},
        GRID_ID: {
            "type": "GRID",
            "id": GRID_ID,
            "children": [],
            "parents": [ROOT_ID],
        },
    }


def reset_chart_formats(position: dict[str, Any]) -> None:
    """Charts drop their own style, keeping their subtitle."""
    for item in position.values():
        item_meta = as_dict(item).get("meta")
        if as_dict(item).get("type") != "CHART" or not isinstance(item_meta, dict):
            continue
        own = as_dict(item_meta.pop(VISUAL_KEY, None))
        if subtitle := as_dict(own.get("title")).get("subtitle"):
            item_meta[VISUAL_KEY] = {"title": {"subtitle": subtitle}}


def apply_color_scheme(dashboard: Dashboard, scheme: str) -> None:
    metadata = load_json_dict(dashboard.json_metadata)
    metadata["color_scheme"] = scheme
    # Computed from the palette: the dashboard recomputes them on load
    metadata.pop("color_scheme_domain", None)
    metadata.pop("map_label_colors", None)
    dashboard.json_metadata = json.dumps(metadata)


def apply_theme(
    dashboard: Dashboard, theme: dict[str, Any], reset_visuals: bool = True
) -> None:
    """
    Give a dashboard the theme: its canvas, the style its charts share and the
    palette. With ``reset_visuals``, charts drop their own style (keeping their
    subtitle) so the theme shows on every chart.
    """
    position = load_json_dict(dashboard.position_json)
    if not isinstance(position.get(ROOT_ID), dict):
        position = empty_layout()
    root = position[ROOT_ID]
    meta = as_dict(root.get("meta"))
    canvas = dict(theme.get("canvas") or {})
    previous = as_dict(meta.get(CANVAS_KEY))
    if "background" not in canvas and previous.get("background"):
        # A theme without a background keeps the dashboard's own one
        canvas["background"] = previous["background"]
    if theme.get("visuals"):
        canvas["visuals"] = theme["visuals"]
    meta[CANVAS_KEY] = canvas
    root["meta"] = meta
    if reset_visuals:
        reset_chart_formats(position)
    dashboard.position_json = json.dumps(position)
    if scheme := theme.get("colorScheme"):
        apply_color_scheme(dashboard, scheme)


def can_change(theme: FormatTheme) -> bool:
    """Whoever saved a theme, and admins, can rename, change or delete it."""
    return security_manager.is_admin() or (
        theme.created_by_fk is not None and theme.created_by_fk == get_user_id()
    )


def serialize(theme: FormatTheme) -> dict[str, Any]:
    creator = theme.created_by
    return {
        "id": theme.id,
        "uuid": str(theme.uuid) if theme.uuid else None,
        "name": theme.name,
        "theme": load_theme(theme),
        "created_by": {
            "id": creator.id,
            "first_name": creator.first_name,
            "last_name": creator.last_name,
        }
        if creator
        else None,
        "changed_on": theme.changed_on.isoformat() if theme.changed_on else None,
        "can_edit": can_change(theme),
    }


class FormatThemeSchema(Schema):
    """Fields a user can set on a format theme."""

    name = fields.String(required=True, validate=validate.Length(min=1, max=250))
    theme = fields.Raw(required=True)

    @pre_load
    def strip_name(self, data: Any, **kwargs: Any) -> Any:
        """Trim the name, so a blank name is rejected."""
        if isinstance(data, dict) and isinstance(data.get("name"), str):
            data = {**data, "name": data["name"].strip()}
        return data


class ApplyThemeSchema(Schema):
    """Dashboards to give a theme."""

    dashboard_ids = fields.List(
        fields.Integer(), required=True, validate=validate.Length(min=1, max=500)
    )
    reset_visuals = fields.Boolean(load_default=True)


def find_editable_dashboards(ids: list[int]) -> list[Dashboard]:
    """The dashboards among ``ids`` the current user can see and edit."""
    dashboards = db.session.query(Dashboard).filter(Dashboard.id.in_(ids)).all()
    editable = []
    for dashboard in dashboards:
        try:
            security_manager.raise_for_access(dashboard=dashboard)
            security_manager.raise_for_ownership(dashboard)
        except SupersetSecurityException:
            continue
        editable.append(dashboard)
    return editable


class FormatThemeRestApi(BaseSupersetApi):
    """Format themes. Everyone who edits dashboards sees and applies every
    theme; whoever saved one, and admins, change or delete it."""

    resource_name = "format_theme"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get_list": "read",
        "post": "write",
        "put": "write",
        "delete": "write",
        "apply": "write",
    }
    openapi_spec_tag = "Mi BI"

    def _find(
        self, pk: int, change: bool = False
    ) -> tuple[FormatTheme | None, Response | None]:
        theme = db.session.query(FormatTheme).filter(FormatTheme.id == pk).one_or_none()
        if theme is None:
            return None, self.response_404()
        if change and not can_change(theme):
            return None, self.response_403()
        return theme, None

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_list(self) -> Response:
        """List the format themes.
        ---
        get:
          summary: List the format themes
          responses:
            200:
              description: Format themes, ordered by name
            401:
              $ref: '#/components/responses/401'
        """
        themes = db.session.query(FormatTheme).order_by(FormatTheme.name).all()
        return self.response(200, result=[serialize(theme) for theme in themes])

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Save a format theme.
        ---
        post:
          summary: Save a format theme
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            201:
              description: The new theme
            400:
              $ref: '#/components/responses/400'
        """
        try:
            data = FormatThemeSchema().load(request.json or {})
            theme = clean_theme(data["theme"])
        except ValidationError as error:
            return self.response_400(message=error.messages)
        item = FormatTheme(name=data["name"], theme=json.dumps(theme))
        db.session.add(item)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(201, result=serialize(item))

    @expose("/<int:pk>/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:
        """Rename or change a format theme.
        ---
        put:
          summary: Rename or change a format theme
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
              description: The theme
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        item, error_response = self._find(pk, change=True)
        if item is None:
            return error_response
        try:
            data = FormatThemeSchema(partial=True).load(request.json or {})
            theme = clean_theme(data["theme"]) if "theme" in data else None
        except ValidationError as error:
            return self.response_400(message=error.messages)
        if "name" in data:
            item.name = data["name"]
        if theme is not None:
            item.theme = json.dumps(theme)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, result=serialize(item))

    @expose("/<int:pk>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:
        """Delete a format theme. Dashboards keep the style it gave them.
        ---
        delete:
          summary: Delete a format theme
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
        item, error_response = self._find(pk, change=True)
        if item is None:
            return error_response
        # Not left to the foreign key: SQLite does not enforce it by default
        db.session.query(Workspace).filter(Workspace.format_theme_id == pk).update(
            {Workspace.format_theme_id: None}, synchronize_session=False
        )
        db.session.delete(item)
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, message="OK")

    @expose("/<int:pk>/apply/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def apply(self, pk: int) -> Response:
        """Give dashboards a format theme.
        ---
        post:
          summary: Give dashboards a format theme
          description: >-
            Dashboards the user cannot edit are skipped; the response lists the
            ones that got the theme.
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
                    dashboard_ids:
                      type: array
                      items:
                        type: integer
                    reset_visuals:
                      type: boolean
          responses:
            200:
              description: Ids of the dashboards that got the theme
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        item, error_response = self._find(pk)
        if item is None:
            return error_response
        try:
            data = ApplyThemeSchema().load(request.json or {})
        except ValidationError as error:
            return self.response_400(message=error.messages)
        theme = load_theme(item)
        dashboards = find_editable_dashboards(data["dashboard_ids"])
        for dashboard in dashboards:
            apply_theme(dashboard, theme, data["reset_visuals"])
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(
            200, result=sorted(dashboard.id for dashboard in dashboards)
        )
