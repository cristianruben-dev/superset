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
"""The model catalog: live list, fallback to the table and prudent values."""

from collections.abc import Iterator
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from flask import Flask

from superset.auradata.assistant import models as catalog_module
from superset.auradata.assistant.models import (
    cost_of_message,
    cost_of_tokens,
    EFFORTS_WITHOUT_XHIGH,
    get_catalog,
    MODEL_TABLE,
    ModelPrice,
    ModelSpec,
    PROBLEM_NO_API_KEY,
    PROBLEM_REJECTED_KEY,
    PROBLEM_UNAVAILABLE,
    PROBLEM_UNREACHABLE,
    PRUDENT_SPEC,
    REFUSAL_FALLBACK_BETA,
    SOURCE_LIVE,
    SOURCE_TABLE,
    spec_of,
    STATUS_CURRENT,
    TokenUsage,
    tuned_spec,
)


def entry(model_id: str, name: str | None = None) -> SimpleNamespace:
    """One model as the Models API returns it."""
    return SimpleNamespace(
        id=model_id,
        display_name=name or model_id,
        max_input_tokens=1_000_000,
        max_tokens=128_000,
    )


class FakeClient:
    """Stands for ``anthropic.Anthropic``: no test spends money."""

    def __init__(self, entries: Any = None, error: Exception | None = None) -> None:
        self.entries = entries or []
        self.error = error
        self.calls = 0
        self.models = self

    def list(self) -> list[SimpleNamespace]:
        self.calls += 1
        if self.error:
            raise self.error
        return self.entries


def status_error(cls: type[anthropic.APIStatusError], code: int) -> Exception:
    request = httpx2.Request("GET", "https://api.anthropic.com/v1/models")
    return cls("x", response=httpx2.Response(code, request=request), body=None)


@pytest.fixture
def app_with_key() -> Iterator[Flask]:
    app = Flask(__name__)
    app.config["ANTHROPIC_API_KEY"] = "test-key"  # noqa: S105
    catalog_module.clear_catalog_cache()
    with app.app_context():
        yield app
    catalog_module.clear_catalog_cache()


def use_client(mocker: Any, client: FakeClient) -> None:
    mocker.patch.object(catalog_module, "_build_client", return_value=client)


def test_live_list_uses_the_table_for_what_the_api_does_not_say(
    app_with_key: Flask, mocker: Any
) -> None:
    use_client(
        mocker,
        FakeClient(
            [
                entry("claude-opus-5-5", "Claude Opus 5.5"),
                entry("claude-sonnet-5-5", "Claude Sonnet 5.5"),
            ]
        ),
    )

    catalog = get_catalog()

    assert catalog.source == SOURCE_LIVE
    assert catalog.problem is None
    assert catalog.fetched_at is not None
    assert [model.id for model in catalog.models] == [
        "claude-sonnet-5-5",
        "claude-opus-5-5",
    ]
    sonnet = catalog.models[0]
    assert sonnet.known is True
    assert sonnet.max_input_tokens == 1_000_000
    assert sonnet.spec.price.input == 2.00


def test_a_date_suffix_still_finds_the_table_row() -> None:
    assert spec_of("claude-haiku-4-5-20251001") is MODEL_TABLE["claude-haiku-4-5"]
    assert spec_of("claude-haiku-4-5-2025") is None


def test_an_unknown_model_is_offered_with_prudent_values(
    app_with_key: Flask, mocker: Any
) -> None:
    use_client(mocker, FakeClient([entry("claude-sonnet-9", "Claude Sonnet 9")]))

    model = get_catalog().models[0]

    assert model.known is False
    assert model.display_name == "Claude Sonnet 9"
    assert model.spec.family == "sonnet"
    assert model.spec.thinking_on is None
    assert model.spec.thinking_off is None
    assert model.spec.efforts == ()
    assert model.spec.default_effort is None
    assert model.spec.refusal_fallback_params() == {}


def test_prudent_price_is_the_highest_of_the_table() -> None:
    prices = [spec.price for spec in MODEL_TABLE.values()]

    assert PRUDENT_SPEC.price.input == max(price.input for price in prices) == 10.00
    assert PRUDENT_SPEC.price.output == max(price.output for price in prices) == 50.00
    assert PRUDENT_SPEC.price.cache_read == 1.00


def test_without_a_key_it_falls_back_to_the_table_without_a_client(
    mocker: Any,
) -> None:
    app = Flask(__name__)
    app.config["ANTHROPIC_API_KEY"] = None
    constructor = mocker.patch("anthropic.Anthropic")
    catalog_module.clear_catalog_cache()

    with app.app_context():
        catalog = get_catalog()

    assert catalog.source == SOURCE_TABLE
    assert catalog.problem == PROBLEM_NO_API_KEY
    constructor.assert_not_called()
    assert "claude-sonnet-5-5" in {model.id for model in catalog.models}
    assert not {model.id for model in catalog.models} & {
        "claude-mythos-5-1",
        "claude-mythos-5",
    }


def test_the_client_takes_the_configured_key_and_bounds_the_wait(
    app_with_key: Flask, mocker: Any
) -> None:
    constructor = mocker.patch("anthropic.Anthropic")

    catalog_module._build_client()

    constructor.assert_called_once_with(
        api_key="test-key",  # noqa: S106
        timeout=catalog_module.LIST_TIMEOUT_SECONDS,
        max_retries=1,
    )


@pytest.mark.parametrize(
    "error, problem",
    [
        (
            status_error(anthropic.AuthenticationError, 401),
            PROBLEM_REJECTED_KEY,
        ),
        (
            status_error(anthropic.PermissionDeniedError, 403),
            PROBLEM_REJECTED_KEY,
        ),
        (
            anthropic.APIConnectionError(
                request=httpx2.Request("GET", "https://api.anthropic.com")
            ),
            PROBLEM_UNREACHABLE,
        ),
        (
            status_error(anthropic.InternalServerError, 500),
            PROBLEM_UNAVAILABLE,
        ),
    ],
)
def test_api_failures_say_why_and_keep_the_table(
    app_with_key: Flask, mocker: Any, error: Exception, problem: str
) -> None:
    use_client(mocker, FakeClient(error=error))

    catalog = get_catalog()

    assert catalog.source == SOURCE_TABLE
    assert catalog.problem == problem
    assert len(catalog.models) > 4


def test_an_empty_list_counts_as_unavailable(app_with_key: Flask, mocker: Any) -> None:
    use_client(mocker, FakeClient([]))

    catalog = get_catalog()

    assert catalog.source == SOURCE_TABLE
    assert catalog.problem == PROBLEM_UNAVAILABLE


def test_the_live_list_is_cached_until_refresh(
    app_with_key: Flask, mocker: Any
) -> None:
    client = FakeClient([entry("claude-sonnet-5-5")])
    use_client(mocker, client)

    get_catalog()
    get_catalog()
    assert client.calls == 1

    get_catalog(refresh=True)
    assert client.calls == 2


def test_a_failure_is_cached_for_a_short_while(
    app_with_key: Flask, mocker: Any
) -> None:
    client = FakeClient(error=status_error(anthropic.InternalServerError, 500))
    use_client(mocker, client)
    clock = mocker.patch.object(catalog_module.time, "monotonic", return_value=100.0)

    get_catalog()
    get_catalog()
    assert client.calls == 1

    clock.return_value = 100.0 + catalog_module.PROBLEM_TTL_SECONDS + 1
    get_catalog()
    assert client.calls == 2


def test_haiku_5_5_has_no_server_fallback() -> None:
    spec = MODEL_TABLE["claude-haiku-5-5"]

    assert spec.refusal_fallback_params() == {}
    assert spec.price.long_prompt_tokens == 100_000
    assert (spec.price.long_input, spec.price.long_output) == (0.50, 2.50)


def test_sonnet_5_5_stops_thinking_with_between_tools() -> None:
    spec = MODEL_TABLE["claude-sonnet-5-5"]

    assert spec.thinking_off == {"type": "between_tools"}
    assert spec.thinking_off_max_effort == "high"
    assert spec.refusal_fallback_params() == {
        "betas": [REFUSAL_FALLBACK_BETA],
        "fallbacks": "default",
    }


@pytest.mark.parametrize("model_id", ["claude-opus-5-5", "claude-fable-5-1"])
def test_models_that_always_think(model_id: str) -> None:
    spec = MODEL_TABLE[model_id]

    assert spec.thinking_always_on is True
    assert spec.thinking_off is None


def test_opus_5_stops_thinking_only_up_to_high_effort() -> None:
    spec = MODEL_TABLE["claude-opus-5"]

    assert spec.thinking_off == {"type": "disabled"}
    assert spec.thinking_off_max_effort == "high"


def test_haiku_4_5_uses_a_budget_and_rejects_effort() -> None:
    spec = MODEL_TABLE["claude-haiku-4-5"]

    assert spec.thinking_on == {"type": "enabled", "budget_tokens": 4096}
    assert spec.thinking_off is None
    assert spec.efforts == ()


def test_tokens_cost_what_the_table_says() -> None:
    usage = TokenUsage(1_000_000, 100_000, 2_000_000, 400_000)

    cost = cost_of_tokens(MODEL_TABLE["claude-sonnet-5-5"].price, usage)

    # Input 2, output 1, cache reads 0.40 and cache writes 1 (2 × 1.25 × 0.4)
    assert cost == Decimal("4.4")


def test_a_long_prompt_bills_at_the_long_prices() -> None:
    price = MODEL_TABLE["claude-haiku-5-5"].price

    short = cost_of_tokens(price, TokenUsage(100_000, 1_000_000))
    long = cost_of_tokens(price, TokenUsage(60_000, 1_000_000, 41_000))

    assert short == Decimal("0.51")
    assert long == Decimal("2.53041")


def test_a_message_without_iterations_uses_its_top_level_usage() -> None:
    usage = SimpleNamespace(
        input_tokens=1_000_000,
        output_tokens=0,
        cache_read_input_tokens=None,
        cache_creation_input_tokens=None,
        iterations=None,
    )

    tokens, cost = cost_of_message("claude-sonnet-5-5", usage)

    assert tokens == TokenUsage(1_000_000, 0, 0, 0)
    assert cost == Decimal(2)


def test_an_unknown_model_costs_the_most_expensive_price() -> None:
    usage = SimpleNamespace(
        input_tokens=1_000_000,
        output_tokens=0,
        cache_read_input_tokens=0,
        cache_creation_input_tokens=0,
    )

    assert cost_of_message("claude-new", usage)[1] == Decimal(
        str(PRUDENT_SPEC.price.input)
    )


def test_a_model_the_table_does_not_know_sends_nothing_optional() -> None:
    assert PRUDENT_SPEC.tool_search is False
    assert PRUDENT_SPEC.automatic_cache is False


def test_every_model_of_the_table_finds_tools_with_tool_search() -> None:
    assert all(spec.tool_search for spec in MODEL_TABLE.values())


@pytest.mark.parametrize(
    ("model_id", "effort", "thinking", "expected_thinking", "expected_effort"),
    [
        # Left alone, each model answers as its row says
        ("claude-sonnet-5-5", None, True, {"type": "adaptive"}, "high"),
        ("claude-opus-5-5", None, True, {"type": "adaptive"}, "medium"),
        ("claude-sonnet-5-5", "low", True, {"type": "adaptive"}, "low"),
        # Off, each model in its own terms
        ("claude-sonnet-5-5", None, False, {"type": "between_tools"}, "high"),
        ("claude-haiku-5-5", None, False, {"type": "disabled"}, "medium"),
        # Past the highest effort that takes it off
        ("claude-sonnet-5-5", "max", False, {"type": "between_tools"}, "high"),
        ("claude-haiku-5-5", "xhigh", False, {"type": "disabled"}, "high"),
        # Thinking that cannot stop stays on, and the effort is kept
        ("claude-opus-5-5", "low", False, {"type": "adaptive"}, "low"),
        ("claude-fable-5-1", "max", False, {"type": "adaptive"}, "max"),
    ],
)
def test_tuning_a_model_speaks_its_own_terms(
    model_id: str,
    effort: str | None,
    thinking: bool,
    expected_thinking: dict[str, str],
    expected_effort: str,
) -> None:
    tuned = tuned_spec(MODEL_TABLE[model_id], effort, thinking)

    assert tuned.thinking_on == expected_thinking
    assert tuned.default_effort == expected_effort


def test_an_effort_the_model_lacks_takes_the_closest_below() -> None:
    spec = ModelSpec(
        display_name="Test",
        family="opus",
        status=STATUS_CURRENT,
        price=ModelPrice(1.0, 1.0, 0.1),
        efforts=EFFORTS_WITHOUT_XHIGH,
    )

    assert tuned_spec(spec, "xhigh", True).default_effort == "high"


def test_a_model_without_effort_or_a_way_to_stop_thinking_leaves_both_out() -> None:
    tuned = tuned_spec(MODEL_TABLE["claude-haiku-4-5"], "low", False)

    assert tuned.thinking_on is None
    assert tuned.default_effort is None
