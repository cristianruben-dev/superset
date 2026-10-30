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
"""Pages of the Mi BI "Data" section, rendered by the single-page app."""

from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access

from superset.superset_typing import FlaskResponse
from superset.views.base import BaseSupersetView


class DataView(BaseSupersetView):
    """Connections, datasets and file uploads on one page, and a page per dataset."""

    route_base = "/data"
    class_permission_name = "Dataset"
    method_permission_name = {"overview": "read", "dataset": "read"}

    @has_access
    @expose("/")
    def overview(self) -> FlaskResponse:
        return super().render_app_template()

    @has_access
    @expose("/dataset/<int:pk>/")
    def dataset(self, pk: int) -> FlaskResponse:  # pylint: disable=unused-argument
        return super().render_app_template()
