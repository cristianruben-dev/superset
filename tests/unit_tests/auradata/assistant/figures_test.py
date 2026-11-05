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
"""What the panel draws from a query: only what ran, and only when it ran well."""

from typing import Any

import pytest

from superset.auradata.assistant.figures import figure_of, figures_in, MAX_ROWS
from superset.utils import json


def call(name: str = "query_dataset") -> dict[str, Any]:
    return {
        "type": "tool_use",
        "id": "toolu_1",
        "name": name,
        "input": {"metrics": ["total"], "columns": ["region"]},
    }


def result(body: Any, **fields: Any) -> dict[str, Any]:
    text = body if isinstance(body, str) else json.dumps(body)
    return {
        "type": "tool_result",
        "tool_use_id": "toolu_1",
        "content": [{"type": "text", "text": text}],
        **fields,
    }


ROWS = {
    "dataset_id": 7,
    "dataset_name": "ventas",
    "data": [{"region": "Norte", "total": 10}],
    "applied_filters": [{"col": "pais", "op": "==", "val": "MX"}],
}


def test_a_query_names_its_dataset_and_the_filters_that_ran() -> None:
    figure = figure_of(call(), result(ROWS))

    assert figure is not None
    assert figure["dataset_id"] == 7
    assert figure["dataset_name"] == "ventas"
    assert figure["filters"] == ROWS["applied_filters"]
    assert figure["columns"] == ["region"]
    assert figure["rows"] == ROWS["data"]
    assert figure["row_limit"] == 1000


def test_a_figure_keeps_the_limit_of_its_query() -> None:
    tool_use = call()
    tool_use["input"]["row_limit"] = 5

    figure = figure_of(tool_use, result(ROWS))

    assert figure is not None
    assert figure["row_limit"] == 5


def test_a_long_result_keeps_its_count_and_only_a_few_rows() -> None:
    rows = [{"region": str(index)} for index in range(MAX_ROWS + 5)]

    figure = figure_of(call(), result({**ROWS, "data": rows}))

    assert figure is not None
    assert len(figure["rows"]) == MAX_ROWS
    assert figure["row_count"] == MAX_ROWS + 5


@pytest.mark.parametrize(
    "tool_call, tool_result",
    [
        (call("get_chart_data"), result(ROWS)),
        (call(), result(ROWS, is_error=True)),
        (call(), result({**ROWS, "data": []})),
        (call(), result({"error": "No dataset found"})),
        (call(), result('{"data": [{"a": 1}]\n\n[Cut at 100000 characters')),
        (call(), {"tool_use_id": "toolu_1", "content": []}),
    ],
)
def test_nothing_is_drawn_without_a_good_result(
    tool_call: dict[str, Any], tool_result: dict[str, Any]
) -> None:
    assert figure_of(tool_call, tool_result) is None


def test_a_stored_conversation_gives_its_figures_by_call() -> None:
    messages = [
        {"role": "user", "content": [{"type": "text", "text": "Hola"}]},
        {"role": "assistant", "content": [call()]},
        {"role": "user", "content": [result(ROWS)]},
    ]

    assert list(figures_in(messages)) == ["toolu_1"]
