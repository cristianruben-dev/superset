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
from typing import Any

from superset.auradata.layout.mobile import mobile_layout_of


def _layout(items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "TAB-1": {
            "id": "TAB-1",
            "type": "TAB",
            "children": ["CHART-A", "CHART-B", "CHART-C"],
            "meta": {"auradataMobile": {"items": items}},
        },
        "CHART-A": {
            "id": "CHART-A",
            "type": "CHART",
            "meta": {"width": 12, "height": 8},
        },
        "CHART-B": {
            "id": "CHART-B",
            "type": "CHART",
            "meta": {"width": 12, "height": 8},
        },
        "CHART-C": {
            "id": "CHART-C",
            "type": "CHART",
            "meta": {"width": 12, "height": 8, "auradataHidden": True},
        },
    }


def test_a_visible_object_without_a_mobile_item_goes_at_the_end() -> None:
    """A chart the author never placed on the phone is added below the others."""
    layout = _layout([{"id": "CHART-A", "x": 0, "y": 0, "width": 12, "height": 8}])
    boxes = mobile_layout_of(layout, "TAB-1")
    assert boxes is not None
    by_id = {box["id"]: box for box in boxes}
    assert set(by_id) == {"CHART-A", "CHART-B"}
    assert by_id["CHART-B"]["y"] == by_id["CHART-A"]["y"] + by_id["CHART-A"]["height"]
    assert by_id["CHART-B"]["x"] == 0


def test_a_hidden_object_stays_off_the_phone() -> None:
    """Hidden objects are left out, as the MCP proposal leaves them out."""
    layout = _layout([{"id": "CHART-A", "x": 0, "y": 0, "width": 12, "height": 8}])
    boxes = mobile_layout_of(layout, "TAB-1")
    assert boxes is not None
    assert "CHART-C" not in {box["id"] for box in boxes}


def test_no_layout_stays_none() -> None:
    """A page with no mobile layout has none, so nothing is placed by default."""
    layout = _layout([])
    assert mobile_layout_of(layout, "TAB-1") is None
