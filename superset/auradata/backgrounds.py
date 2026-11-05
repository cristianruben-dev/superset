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
"""REST APIs for the pictures of a dashboard: canvas background and image elements."""

from __future__ import annotations

from datetime import datetime

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import protect, safe

from superset import db, security_manager
from superset.auradata.models import DashboardBackground, DashboardImage
from superset.auradata.workspaces import MAX_IMAGE_BYTES, sniff_image_type
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.views.base_api import BaseSupersetApi, statsd_metrics


def background_url(background: DashboardBackground) -> str:
    """URL of the picture, changing whenever the picture changes."""
    version = int(background.changed_on.timestamp())
    return f"/api/v1/dashboard_background/{background.dashboard_id}/?v={version}"


def find_dashboard(
    api: BaseSupersetApi, pk: int, edit: bool = False
) -> tuple[Dashboard | None, Response | None]:
    """The dashboard, or the error to return: 404 when the user cannot see it,
    403 when they cannot edit it and ``edit`` is set."""
    dashboard = db.session.query(Dashboard).filter(Dashboard.id == pk).one_or_none()
    if dashboard is None:
        return None, api.response_404()
    try:
        security_manager.raise_for_access(dashboard=dashboard)
    except SupersetSecurityException:
        return None, api.response_404()
    if edit:
        try:
            security_manager.raise_for_editorship(dashboard)
        except SupersetSecurityException:
            return None, api.response_403()
    return dashboard, None


class ImageUploadError(ValueError):
    """A picture the report refuses, with the message to show."""


def check_image(data: bytes) -> str:
    """The media type of an uploaded picture; raises ImageUploadError when it
    is too large or not a PNG, JPEG, GIF or WebP image."""
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageUploadError("The image is larger than 2 MB")
    media_type = sniff_image_type(data)
    if media_type is None:
        raise ImageUploadError("Use a PNG, JPEG, GIF or WebP image")
    return media_type


def store_background(dashboard_id: int, data: bytes, media_type: str) -> str:
    """Saves the background picture of a dashboard and returns its URL. The
    caller checks that the user may edit the dashboard."""
    background = db.session.get(DashboardBackground, dashboard_id)
    if background is None:
        background = DashboardBackground(dashboard_id=dashboard_id)
        db.session.add(background)
    background.image = data
    background.image_type = media_type
    background.changed_on = datetime.now()
    db.session.commit()  # pylint: disable=consider-using-transaction
    return background_url(background)


def store_element_image(
    dashboard_id: int, data: bytes, media_type: str
) -> tuple[int, str]:
    """Saves a picture for an image element of a dashboard and returns its id
    and URL. The caller checks that the user may edit the dashboard."""
    image = DashboardImage(
        dashboard_id=dashboard_id,
        image=data,
        image_type=media_type,
        created_on=datetime.now(),
    )
    db.session.add(image)
    db.session.commit()  # pylint: disable=consider-using-transaction
    return image.id, dashboard_image_url(image)


def delete_element_image(dashboard_id: int, image_id: int) -> bool:
    """Deletes a picture of an image element of a dashboard; False when the
    dashboard has no such picture. The caller checks that the user may edit
    the dashboard."""
    deleted = (
        db.session.query(DashboardImage)
        .filter(
            DashboardImage.id == image_id,
            DashboardImage.dashboard_id == dashboard_id,
        )
        .delete()
    )
    db.session.commit()  # pylint: disable=consider-using-transaction
    return bool(deleted)


def read_upload(api: BaseSupersetApi) -> tuple[bytes, str] | Response:
    """The uploaded ``image`` and its media type, or the error to return."""
    upload = request.files.get("image")
    if upload is None:
        return api.response_400(message="Missing image")
    data = upload.read(MAX_IMAGE_BYTES + 1)
    try:
        return data, check_image(data)
    except ImageUploadError as ex:
        return api.response_400(message=str(ex))


def image_response(data: bytes, media_type: str) -> Response:
    response = Response(data, mimetype=media_type)
    response.headers["Cache-Control"] = "private, max-age=31536000"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'none'"
    return response


class DashboardBackgroundRestApi(BaseSupersetApi):
    """The picture behind a dashboard canvas. Viewers of the dashboard can see
    it and the people who can edit the dashboard can change it."""

    resource_name = "dashboard_background"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get": "read",
        "put": "write",
        "delete": "write",
    }
    openapi_spec_tag = "AuraData BI"

    def _dashboard(
        self, pk: int, edit: bool = False
    ) -> tuple[Dashboard | None, Response | None]:
        return find_dashboard(self, pk, edit)

    @expose("/<int:pk>/", methods=("GET",))
    @protect()
    @safe
    def get(self, pk: int) -> Response:
        """The background picture of a dashboard.
        ---
        get:
          summary: Get the background picture of a dashboard
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
        dashboard, error_response = self._dashboard(pk)
        if dashboard is None:
            return error_response
        background = db.session.get(DashboardBackground, pk)
        if background is None:
            return self.response_404()
        return image_response(background.image, background.image_type)

    @expose("/<int:pk>/", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:
        """Upload the background picture (PNG, JPEG, GIF or WebP, 2 MB at most).
        ---
        put:
          summary: Upload the background picture of a dashboard
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
              description: The URL of the picture
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        dashboard, error_response = self._dashboard(pk, edit=True)
        if dashboard is None:
            return error_response
        upload = read_upload(self)
        if isinstance(upload, Response):
            return upload
        data, media_type = upload
        url = store_background(pk, data, media_type)
        return self.response(200, result={"url": url})

    @expose("/<int:pk>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:
        """Remove the background picture.
        ---
        delete:
          summary: Remove the background picture of a dashboard
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          responses:
            200:
              description: Removed
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        dashboard, error_response = self._dashboard(pk, edit=True)
        if dashboard is None:
            return error_response
        db.session.query(DashboardBackground).filter(
            DashboardBackground.dashboard_id == pk
        ).delete()
        db.session.commit()  # pylint: disable=consider-using-transaction
        return self.response(200, message="OK")


def dashboard_image_url(image: DashboardImage) -> str:
    return f"/api/v1/dashboard_image/{image.dashboard_id}/{image.id}/"


class DashboardImageRestApi(BaseSupersetApi):
    """Pictures of the image elements of a dashboard. Viewers of the dashboard
    can see them and the people who can edit it can add and remove them."""

    resource_name = "dashboard_image"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {
        "get": "read",
        "post": "write",
        "delete": "write",
    }
    openapi_spec_tag = "AuraData BI"

    @expose("/<int:pk>/<int:image_id>/", methods=("GET",))
    @protect()
    @safe
    def get(self, pk: int, image_id: int) -> Response:
        """A picture of an image element.
        ---
        get:
          summary: Get a picture of a dashboard image element
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: integer
            name: image_id
          responses:
            200:
              description: The image
            404:
              $ref: '#/components/responses/404'
        """
        dashboard, error_response = find_dashboard(self, pk)
        if dashboard is None:
            return error_response
        image = db.session.get(DashboardImage, image_id)
        if image is None or image.dashboard_id != pk:
            return self.response_404()
        return image_response(image.image, image.image_type)

    @expose("/<int:pk>/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self, pk: int) -> Response:
        """Upload a picture for an image element (PNG, JPEG, GIF or WebP, 2 MB).
        ---
        post:
          summary: Upload a picture for a dashboard image element
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
            201:
              description: The id and URL of the picture
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        dashboard, error_response = find_dashboard(self, pk, edit=True)
        if dashboard is None:
            return error_response
        upload = read_upload(self)
        if isinstance(upload, Response):
            return upload
        data, media_type = upload
        image_id, url = store_element_image(pk, data, media_type)
        return self.response(201, result={"id": image_id, "url": url})

    @expose("/<int:pk>/<int:image_id>/", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int, image_id: int) -> Response:
        """Remove a picture of an image element.
        ---
        delete:
          summary: Remove a picture of a dashboard image element
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: integer
            name: image_id
          responses:
            200:
              description: Removed
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        dashboard, error_response = find_dashboard(self, pk, edit=True)
        if dashboard is None:
            return error_response
        if not delete_element_image(pk, image_id):
            return self.response_404()
        return self.response(200, message="OK")
