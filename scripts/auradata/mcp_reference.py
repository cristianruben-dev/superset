#!/usr/bin/env python3
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
Writes the MCP tool reference (docs/auradata/mcp/referencia.md) from the
registry, where Superset is installed:

    python scripts/auradata/mcp_reference.py

In the development stack, which does not mount docs/ or scripts/, render it in
the container and copy it out:

    docker exec -i superset-superset-1 python - --output /tmp/referencia.md \
        < scripts/auradata/mcp_reference.py
    docker cp superset-superset-1:/tmp/referencia.md docs/auradata/mcp/referencia.md

Without docs/, the staleness test of the reference skips itself there; it runs
wherever the whole repository is checked out.
"""

import argparse
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--output", help="Where to write it (the docs file by default)")
args = parser.parse_args()

# The app must exist before the tools are imported
from superset.mcp_service.flask_singleton import app  # noqa: E402,F401
from superset.mcp_service.reference import (  # noqa: E402
    REFERENCE_FILE,
    render_reference,
)

output = (
    Path(args.output)
    if args.output
    else Path(__file__).resolve().parents[2] / REFERENCE_FILE
)
output.write_text(render_reference(), encoding="utf-8")
print(f"Wrote {output}")
