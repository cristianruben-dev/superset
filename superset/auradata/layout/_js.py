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
JavaScript arithmetic and coercion, so the layout functions give the numbers
the frontend gives for the same layout. Python rounds halves to even and treats
``{}`` as false; JavaScript rounds them up and treats ``{}`` as true.
"""

import math
from typing import Any

Number = int | float


def is_number(value: Any) -> bool:
    """``typeof value === 'number'``: an int or float, never a bool."""
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def is_finite(value: Any) -> bool:
    """``Number.isFinite(value)``, which never coerces."""
    return is_number(value) and math.isfinite(value)


def _tidy(value: float) -> Number:
    return int(value) if math.isfinite(value) and value == int(value) else value


def js_round(value: float) -> int:
    """``Math.round``: halves go up, toward positive infinity."""
    return int(math.floor(value + 0.5))


def to_number(value: Any) -> float:
    """``Number(value)``: NaN when the value is not a number."""
    if value is None:
        return 0.0
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if is_number(value):
        return float(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return 0.0
        try:
            return float(text)
        except ValueError:
            return math.nan
    return math.nan


def number_or(value: Any, fallback: Number) -> Number:
    """``Number(value) || fallback``: zero and NaN take the fallback."""
    number = to_number(value)
    if not number or math.isnan(number):
        return fallback
    return _tidy(number)


def truthy(value: Any) -> bool:
    """Whether JavaScript treats the value as true (``{}`` and ``[]`` are)."""
    if value is None or value is False:
        return False
    if is_number(value):
        return value != 0 and not math.isnan(value)
    if isinstance(value, str):
        return value != ""
    return True


def as_dict(value: Any) -> dict[str, Any]:
    """The value when it is an object, else an empty one (``value ?? {}``)."""
    return value if isinstance(value, dict) else {}
