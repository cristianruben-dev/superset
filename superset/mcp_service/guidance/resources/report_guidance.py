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
"""Resources with the AuraData BI brand, report conventions and format catalog.

A client reads them before building a report so titles, layout and colors look
like AuraData BI made them.
"""

from superset.mcp_service.app import mcp
from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.guidance import content
from superset.utils import json


@mcp.resource("auradata://brand")
@mcp_auth_hook
def get_brand_resource() -> str:
    """AuraData brand: colors, fonts, when to use the gradient, tone and language.

    Read it before choosing colors or writing titles and labels of a report.
    """
    return json.dumps(content.brand(), indent=2)


@mcp.resource("auradata://report-conventions")
@mcp_auth_hook
def get_report_conventions_resource() -> str:
    """How a good AuraData BI report looks: page size and cells, margins, a
    standard page layout, visual hierarchy, naming, language and number formats.

    Read it before placing visuals on a page.
    """
    return json.dumps(content.report_conventions(), indent=2)


@mcp.resource("auradata://format-catalog")
@mcp_auth_hook
def get_format_catalog_resource() -> str:
    """What the format tools change: levels, chart types, element kinds and how
    to read the exact keys with get_format_options.
    """
    return json.dumps(content.format_catalog_summary(), indent=2)
