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
from typing import Any

from flask import current_app, Response
from flask_appbuilder.api import expose, protect, rison, safe

from superset.auradata.previews import dashboard_preview
from superset.daos.dashboard import DashboardDAO
from superset.views.base_api import BaseSupersetApi, statsd_metrics

dashboard_previews_schema = {
    "type": "array",
    "items": {"type": "integer"},
    "maxItems": 100,
}


class AuraDataRestApi(BaseSupersetApi):
    """AuraData BI endpoints that Superset's own APIs do not cover."""

    resource_name = "auradata"
    allow_browser_login = True
    class_permission_name = "Dashboard"
    method_permission_name = {"dashboard_previews": "read", "mcp_connection": "read"}
    openapi_spec_tag = "AuraData BI"

    @expose("/dashboard_previews/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(dashboard_previews_schema)
    def dashboard_previews(self, **kwargs: Any) -> Response:
        """Layout previews of the requested dashboards.
        ---
        get:
          summary: Layout previews of dashboards, for their cards
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  type: array
                  items:
                    type: integer
          responses:
            200:
              description: One preview per dashboard the user can access
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
        """
        dashboards = DashboardDAO.find_by_ids(kwargs["rison"])
        return self.response(
            200,
            result=[
                {"id": dashboard.id, "rows": dashboard_preview(dashboard)}
                for dashboard in dashboards
            ],
        )

    @expose("/mcp_connection/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def mcp_connection(self) -> Response:
        """Where an AI client connects to the MCP service, for «Conectar IA».
        ---
        get:
          summary: Address of the MCP service and whether it takes API keys
          responses:
            200:
              description: The MCP address and the API key setting
            401:
              $ref: '#/components/responses/401'
        """
        return self.response(
            200,
            result={
                "url": mcp_client_url(),
                "api_keys_enabled": mcp_api_keys_enabled(),
            },
        )


# The web app does not import superset.mcp_service (it needs the fastmcp extra), so
# this mirrors get_mcp_api_key_enabled() of that package.
def mcp_client_url() -> str | None:
    """The MCP endpoint an AI client calls: ``MCP_SERVICE_URL`` ending in /mcp.

    None when it is not configured: the page then offers the app's own address
    followed by /mcp, where a proxy in front of both services would serve it.
    """
    if not (url := (current_app.config.get("MCP_SERVICE_URL") or "").rstrip("/")):
        return None
    return url if url.endswith("/mcp") else f"{url}/mcp"


def mcp_api_keys_enabled() -> bool:
    """Whether the MCP service takes API keys (``MCP_API_KEY_ENABLED`` wins)."""
    if (enabled := current_app.config.get("MCP_API_KEY_ENABLED")) is not None:
        return bool(enabled)
    return bool(current_app.config.get("FAB_API_KEY_ENABLED", False))
