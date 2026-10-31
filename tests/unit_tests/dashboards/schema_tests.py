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
import pytest
from marshmallow import ValidationError

from superset.dashboards.schemas import DashboardJSONMetadataSchema


@pytest.mark.parametrize("auto_apply", [True, False])
def test_json_metadata_accepts_filter_bar_auto_apply(auto_apply: bool) -> None:
    """
    The filter bar "apply filters instantly" setting round-trips through the
    dashboard JSON metadata schema.
    """
    loaded = DashboardJSONMetadataSchema().load({"filter_bar_auto_apply": auto_apply})
    assert loaded["filter_bar_auto_apply"] is auto_apply


def test_json_metadata_rejects_non_boolean_filter_bar_auto_apply() -> None:
    with pytest.raises(ValidationError):
        DashboardJSONMetadataSchema().load({"filter_bar_auto_apply": "sometimes"})
