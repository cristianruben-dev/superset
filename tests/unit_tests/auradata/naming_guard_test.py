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
"""The old internal prefix of AuraData BI never comes back in the code.

Every persisted name (tables, layout keys, component keys, palette, form data
keys, CSS names, storage keys) is ``auradata``; only historical migrations keep
the old prefix. The walk stays on source folders and never enters dependencies
or build output.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OLD_PREFIX = "mi" + "bi"
# The prefix as a name of its own: "Namibia" and the like do not count.
PATTERN = re.compile(rf"(?<![A-Za-z0-9]){OLD_PREFIX}(?![a-z0-9])")

SOURCE_DIRS = [
    "superset",
    "tests",
    "scripts",
    "docker",
    "superset-frontend/src",
    "superset-frontend/spec",
    "superset-frontend/playwright",
    "superset-frontend/packages",
    "superset-frontend/plugins",
]
SKIPPED_DIRS = {
    "node_modules",
    "lib",
    "esm",
    "build",
    "dist",
    "__pycache__",
    "translations",
    "static",
}
SKIPPED_PATHS = {Path("superset/migrations/versions")}
EXTENSIONS = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
    ".less",
    ".html",
    ".yml",
    ".yaml",
    ".sh",
    ".example",
}


def _source_files() -> list[Path]:
    """List the source files to scan, without dependencies or build output."""
    files: list[Path] = []
    for base in SOURCE_DIRS:
        for folder, dirs, names in os.walk(ROOT / base):
            relative = Path(folder).relative_to(ROOT)
            dirs[:] = [
                name
                for name in dirs
                if name not in SKIPPED_DIRS and relative / name not in SKIPPED_PATHS
            ]
            files.extend(
                Path(folder) / name
                for name in names
                if Path(name).suffix in EXTENSIONS or name.startswith(".env")
            )
    return files


def test_old_prefix_is_gone() -> None:
    """No source file names anything with the old internal prefix."""
    found = []
    for path in _source_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for number, line in enumerate(text.splitlines(), start=1):
            if PATTERN.search(line):
                found.append(f"{path.relative_to(ROOT)}:{number}: {line.strip()}")
    assert not found, "\n".join(found)


def test_pattern_spares_other_words() -> None:
    """The guard flags the prefix, never a word that merely contains it."""
    assert PATTERN.search(f'"{OLD_PREFIX}Pos"')
    assert PATTERN.search(f".{OLD_PREFIX}-canvas")
    assert PATTERN.search(f"{OLD_PREFIX}_sort_by")
    assert not PATTERN.search("Namibia")
    assert not PATTERN.search("namibia.geojson")
