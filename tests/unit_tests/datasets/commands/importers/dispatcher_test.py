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
The HTTP-reachable dataset import dispatcher must never fall through to
the legacy v0 importer, which matched datasets purely by
(table_name, schema, database) and overrode them without any ownership
check. The fork removed the v0 format altogether (a84d21f228), so the importer
module must stay gone and the dispatcher must only list the versioned (v1)
command.
"""

import importlib

import pytest


def test_dataset_import_dispatcher_excludes_v0() -> None:
    """POST /api/v1/dataset/import/ only dispatches to the v1 importer."""
    from superset.commands.dataset.importers.dispatcher import command_versions
    from superset.commands.dataset.importers.v1 import ImportDatasetsCommand

    assert command_versions == [ImportDatasetsCommand]
    with pytest.raises(ModuleNotFoundError):
        importlib.import_module("superset.commands.dataset.importers.v0")
