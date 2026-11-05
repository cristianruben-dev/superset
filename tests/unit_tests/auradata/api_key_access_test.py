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
"""Every user manages their own API keys («Conectar IA»).

AuraData BI decided that AIs connect with personal API keys, so the key API is
not admin-only as in Superset: Gamma (and Alpha, built on it) list, create, read
and revoke keys. FAB's ApiKeyApi only ever shows or revokes the caller's keys.
"""

from unittest.mock import MagicMock

import pytest

from superset.security.manager import SupersetSecurityManager


@pytest.mark.parametrize(
    "permission", ["can_list", "can_create", "can_get", "can_revoke"]
)
def test_gamma_manages_its_own_api_keys(app_context: None, permission: str) -> None:
    from superset.extensions import appbuilder

    sm = SupersetSecurityManager(appbuilder)
    pvm = MagicMock()
    pvm.permission.name = permission
    pvm.view_menu.name = "ApiKey"

    assert sm._is_admin_only(pvm) is False
    assert sm._is_gamma_pvm(pvm) is True
