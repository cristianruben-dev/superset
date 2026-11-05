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
"""The format a visual shows. Mirrors ``mergeVisualFormat`` of ``styles.ts``."""

from typing import Any

from superset.auradata.layout._js import as_dict, truthy
from superset.auradata.layout.grid import canvas_format
from superset.auradata.layout.keys import VISUAL_FORMAT_KEY

# Settings merged one level deeper, setting by setting
_NESTED = ("title", "header", "chart")


def merge_visual_format(shared: Any, own: Any) -> Any:
    """
    The style every chart shares, overridden by the chart's own format setting
    by setting (title, header icons and chart settings included).
    """
    if shared is None:
        return own
    if own is None:
        return shared
    merged = {**as_dict(shared), **as_dict(own)}
    for key in _NESTED:
        if truthy(as_dict(shared).get(key)) or truthy(as_dict(own).get(key)):
            merged[key] = {
                **as_dict(as_dict(shared).get(key)),
                **as_dict(as_dict(own).get(key)),
            }
    return merged


def shared_visual_format(layout: dict[str, Any]) -> Any:
    """The style every chart of the report shares (``auradataCanvas.visuals``)."""
    return as_dict(canvas_format(layout)).get("visuals")


def visual_format_of(layout: dict[str, Any], component_id: str) -> Any:
    """The format the object shows: shared style plus its own format."""
    meta = as_dict(as_dict(layout.get(component_id)).get("meta"))
    own = meta.get(VISUAL_FORMAT_KEY)
    return merge_visual_format(shared_visual_format(layout), own)
