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

"""The committed MCP tool reference is the one the registry renders."""

from pathlib import Path

import pytest

from superset.mcp_service.reference import REFERENCE_FILE, render_reference

REPO_ROOT = Path(__file__).resolve().parents[3]
REGENERATE = (
    "Regenerate it with `python scripts/auradata/mcp_reference.py` "
    "(see the script for the development stack)."
)


@pytest.mark.skipif(
    not (REPO_ROOT / "docs").is_dir(),
    reason="docs/ is not in this checkout (the dev container does not mount it)",
)
def test_the_reference_is_up_to_date() -> None:
    path = REPO_ROOT / REFERENCE_FILE
    assert path.is_file(), f"{REFERENCE_FILE} is missing. {REGENERATE}"
    assert path.read_text(encoding="utf-8") == render_reference(), (
        f"{REFERENCE_FILE} is stale: a tool, prompt or resource changed. " + REGENERATE
    )


def test_every_tool_has_a_group_and_an_example() -> None:
    text = render_reference()

    assert "## Otras" not in text
    assert text.count("\nEjemplo:\n") == text.count("\n### `") - text.count(
        "\n### `", text.index("\n## Prompts")
    )
    assert "| `dashboard` | integer o string | sí |" in text
    assert "Scope de la clave: `superset:dashboard:write`" in text
