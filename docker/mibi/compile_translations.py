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
"""Compile the server-side .mo file of one Superset language.

Used by the Dockerfile instead of `pybabel compile`, which rejects some official .po
files over a few placeholder typos in rarely used messages and then leaves that
language untranslated. The web UI strings are built separately by
`npm run build-translation`.

  python compile_translations.py /app/superset/translations es
"""

import sys
from pathlib import Path

from babel.messages.mofile import write_mo
from babel.messages.pofile import read_po


def main(translations: str, lang: str) -> None:
    folder = Path(translations) / lang / "LC_MESSAGES"
    with open(folder / "messages.po", "rb") as po_file:
        catalog = read_po(po_file)
    with open(folder / "messages.mo", "wb") as mo_file:
        write_mo(mo_file, catalog)
    print(f"{lang}: {len(catalog)} messages compiled")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
