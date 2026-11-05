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
Catalog of the Anthropic models the assistant can use.

The list of models comes from the Models API, so a new model shows up without a
release. The API does not say what a model costs or how each one must be called, so
``MODEL_TABLE`` holds that: the rest of the assistant reads a ``ModelSpec`` and never
asks which model it is talking to.

Values come from the Claude API reference, cached 2026-10-06. The table is keyed by
exact model id because versions of one family reject each other's requests. A model
it does not know gets ``PRUDENT_SPEC``: nothing optional is sent and it is priced as
the most expensive model, so a spending limit never undercounts it.

``anthropic`` is imported where the client is built: this module loads with the web
app, and a process without the SDK must only lose the live list.
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from threading import Lock
from types import MappingProxyType
from typing import Any

from flask import current_app

logger = logging.getLogger(__name__)

EFFORTS = ("low", "medium", "high", "xhigh", "max")
EFFORTS_WITHOUT_XHIGH = ("low", "medium", "high", "max")

# Beta header of the ``fallbacks: "default"`` form; the array form takes another one
REFUSAL_FALLBACK_BETA = "server-side-fallback-2026-07-01"  # noqa: S105

# Multipliers of the input price for prompt cache writes, by time to live
CACHE_WRITE_5M = 1.25
CACHE_WRITE_1H = 2.0

STATUS_CURRENT = "current"  # noqa: S105
STATUS_AVAILABLE = "available"  # noqa: S105
STATUS_RESTRICTED = "restricted"  # noqa: S105

SOURCE_LIVE = "live"  # noqa: S105
SOURCE_TABLE = "table"  # noqa: S105

PROBLEM_NO_API_KEY = "no_api_key"  # noqa: S105
PROBLEM_SDK_MISSING = "sdk_missing"  # noqa: S105
PROBLEM_REJECTED_KEY = "rejected_key"  # noqa: S105
PROBLEM_UNREACHABLE = "unreachable"  # noqa: S105
PROBLEM_UNAVAILABLE = "unavailable"  # noqa: S105

FAMILIES = ("haiku", "sonnet", "opus", "fable", "mythos")

LIST_TIMEOUT_SECONDS = 10.0
LIVE_TTL_SECONDS = 3600.0
PROBLEM_TTL_SECONDS = 300.0

_ADAPTIVE: Mapping[str, Any] = MappingProxyType({"type": "adaptive"})
_DISABLED: Mapping[str, Any] = MappingProxyType({"type": "disabled"})
_BETWEEN_TOOLS: Mapping[str, Any] = MappingProxyType({"type": "between_tools"})
_DATE_SUFFIX = re.compile(r"-\d{8}$")


@dataclass(frozen=True)
class ModelPrice:
    """Dollars per million tokens. Cache writes follow ``CACHE_WRITE_*``."""

    input: float
    output: float
    cache_read: float
    # Above this many prompt tokens a request bills at the long prices
    long_prompt_tokens: int | None = None
    long_input: float | None = None
    long_output: float | None = None


@dataclass(frozen=True)
class ModelSpec:
    """What the API does not say about a model."""

    display_name: str
    family: str
    status: str
    price: ModelPrice
    # Value of ``thinking`` to think, and to stop thinking. None leaves it out
    thinking_on: Mapping[str, Any] | None = field(default_factory=lambda: _ADAPTIVE)
    thinking_off: Mapping[str, Any] | None = field(default_factory=lambda: _DISABLED)
    # Thinking cannot be stopped: lower the effort instead
    thinking_always_on: bool = False
    # Highest effort that accepts ``thinking_off``; None when any effort does
    thinking_off_max_effort: str | None = None
    # Values of ``output_config.effort``; empty when the model rejects the parameter
    efforts: tuple[str, ...] = EFFORTS
    default_effort: str | None = "high"
    # Whether ``tool_choice`` accepts ``any`` and a named tool
    forced_tool_choice: bool = True
    # Value of ``fallbacks`` that retries a refused request; None when there is none
    refusal_fallback: str | None = None

    def refusal_fallback_params(self) -> dict[str, Any]:
        """Request arguments that opt into the refusal fallback of this model."""
        if self.refusal_fallback is None:
            return {}
        return {
            "betas": [REFUSAL_FALLBACK_BETA],
            "fallbacks": self.refusal_fallback,
        }


def _cached_at_a_tenth(input_price: float, output_price: float) -> ModelPrice:
    """The usual price: cache reads at a tenth of the input price."""
    return ModelPrice(input_price, output_price, round(input_price * 0.1, 4))


MODEL_TABLE: Mapping[str, ModelSpec] = MappingProxyType(
    {
        "claude-haiku-5-5": ModelSpec(
            display_name="Claude Haiku 5.5",
            family="haiku",
            status=STATUS_CURRENT,
            price=ModelPrice(
                0.10,
                0.50,
                0.01,
                long_prompt_tokens=100_000,
                long_input=0.50,
                long_output=2.50,
            ),
            thinking_off_max_effort="high",
            default_effort="medium",
        ),
        "claude-sonnet-5-5": ModelSpec(
            display_name="Claude Sonnet 5.5",
            family="sonnet",
            status=STATUS_CURRENT,
            price=_cached_at_a_tenth(2.00, 10.00),
            thinking_off=_BETWEEN_TOOLS,
            thinking_off_max_effort="high",
            forced_tool_choice=False,
            refusal_fallback="default",
        ),
        "claude-opus-5-5": ModelSpec(
            display_name="Claude Opus 5.5",
            family="opus",
            status=STATUS_CURRENT,
            price=ModelPrice(4.00, 20.00, 0.20),
            thinking_off=None,
            thinking_always_on=True,
            default_effort="medium",
            forced_tool_choice=False,
            refusal_fallback="default",
        ),
        "claude-fable-5-1": ModelSpec(
            display_name="Claude Fable 5.1",
            family="fable",
            status=STATUS_CURRENT,
            price=ModelPrice(10.00, 50.00, 0.25),
            thinking_off=None,
            thinking_always_on=True,
            forced_tool_choice=False,
            refusal_fallback="default",
        ),
        "claude-haiku-4-5": ModelSpec(
            display_name="Claude Haiku 4.5",
            family="haiku",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(1.00, 5.00),
            thinking_on=MappingProxyType({"type": "enabled", "budget_tokens": 4096}),
            thinking_off=None,
            efforts=(),
            default_effort=None,
        ),
        "claude-sonnet-5": ModelSpec(
            display_name="Claude Sonnet 5",
            family="sonnet",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(2.00, 10.00),
        ),
        "claude-sonnet-4-6": ModelSpec(
            display_name="Claude Sonnet 4.6",
            family="sonnet",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(3.00, 15.00),
            efforts=EFFORTS_WITHOUT_XHIGH,
        ),
        "claude-opus-5": ModelSpec(
            display_name="Claude Opus 5",
            family="opus",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(5.00, 25.00),
            thinking_off_max_effort="high",
            refusal_fallback="default",
        ),
        "claude-opus-4-8": ModelSpec(
            display_name="Claude Opus 4.8",
            family="opus",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(5.00, 25.00),
        ),
        "claude-opus-4-7": ModelSpec(
            display_name="Claude Opus 4.7",
            family="opus",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(5.00, 25.00),
        ),
        "claude-opus-4-6": ModelSpec(
            display_name="Claude Opus 4.6",
            family="opus",
            status=STATUS_AVAILABLE,
            price=_cached_at_a_tenth(5.00, 25.00),
            efforts=EFFORTS_WITHOUT_XHIGH,
        ),
        "claude-fable-5": ModelSpec(
            display_name="Claude Fable 5",
            family="fable",
            status=STATUS_AVAILABLE,
            price=ModelPrice(10.00, 50.00, 1.00),
            thinking_off=None,
            thinking_always_on=True,
            refusal_fallback="default",
        ),
        # Project Glasswing only: they show up when the API lists them
        "claude-mythos-5-1": ModelSpec(
            display_name="Claude Mythos 5.1",
            family="mythos",
            status=STATUS_RESTRICTED,
            price=ModelPrice(10.00, 50.00, 0.25),
            thinking_off=None,
            thinking_always_on=True,
            forced_tool_choice=False,
            refusal_fallback="default",
        ),
        "claude-mythos-5": ModelSpec(
            display_name="Claude Mythos 5",
            family="mythos",
            status=STATUS_RESTRICTED,
            price=ModelPrice(10.00, 50.00, 1.00),
            thinking_off=None,
            thinking_always_on=True,
        ),
    }
)

# Nothing optional goes in the request and the price is the highest of the table, so
# a limit of spending stops too early rather than too late.
PRUDENT_SPEC = ModelSpec(
    display_name="",
    family="other",
    status=STATUS_AVAILABLE,
    price=ModelPrice(
        max(spec.price.input for spec in MODEL_TABLE.values()),
        max(spec.price.output for spec in MODEL_TABLE.values()),
        max(spec.price.cache_read for spec in MODEL_TABLE.values()),
    ),
    thinking_on=None,
    thinking_off=None,
    efforts=(),
    default_effort=None,
    forced_tool_choice=False,
)


@dataclass(frozen=True)
class CatalogModel:
    """A model that can be offered, with what is known about it."""

    id: str
    spec: ModelSpec
    known: bool
    max_input_tokens: int | None = None
    max_output_tokens: int | None = None

    @property
    def display_name(self) -> str:
        return self.spec.display_name or self.id


@dataclass(frozen=True)
class Catalog:
    """The models of this moment and where the list came from."""

    models: tuple[CatalogModel, ...]
    source: str
    # Why the list is not the live one; None when it is
    problem: str | None = None
    fetched_at: datetime | None = None


class _CatalogUnavailableError(Exception):
    """The live list cannot be read, with the reason to show the admin."""

    def __init__(self, problem: str) -> None:
        super().__init__(problem)
        self.problem = problem


_cache: tuple[float, Catalog] | None = None
_cache_lock = Lock()


def family_of(model_id: str) -> str:
    """The family named in a model id, or ``other``."""
    parts = model_id.split("-")
    return next((family for family in FAMILIES if family in parts), "other")


def spec_of(model_id: str) -> ModelSpec | None:
    """The table row of a model id, also when it comes with a date suffix."""
    return MODEL_TABLE.get(_DATE_SUFFIX.sub("", model_id))


def _sort_key(model: CatalogModel) -> tuple[int, int]:
    """Current models first, by family, then the rest as the source lists them."""
    if not model.known:
        rank = 2
    else:
        rank = 0 if model.spec.status == STATUS_CURRENT else 1
    family = model.spec.family
    return rank, FAMILIES.index(family) if family in FAMILIES else len(FAMILIES)


def _table_models() -> tuple[CatalogModel, ...]:
    """Every model of the table an account can use without a special program."""
    models = [
        CatalogModel(id=model_id, spec=spec, known=True)
        for model_id, spec in MODEL_TABLE.items()
        if spec.status != STATUS_RESTRICTED
    ]
    return tuple(sorted(models, key=_sort_key))


def _to_catalog_model(entry: Any) -> CatalogModel:
    """A catalog model from one entry of the Models API."""
    model_id = entry.id
    spec = spec_of(model_id)
    live_name = getattr(entry, "display_name", None)
    if spec is None:
        return CatalogModel(
            id=model_id,
            spec=replace(
                PRUDENT_SPEC,
                display_name=live_name or model_id,
                family=family_of(model_id),
            ),
            known=False,
            max_input_tokens=getattr(entry, "max_input_tokens", None),
            max_output_tokens=getattr(entry, "max_tokens", None),
        )
    return CatalogModel(
        id=model_id,
        spec=replace(spec, display_name=live_name or spec.display_name),
        known=True,
        max_input_tokens=getattr(entry, "max_input_tokens", None),
        max_output_tokens=getattr(entry, "max_tokens", None),
    )


def _build_client() -> Any:
    """A client with the key of the configuration, never ambient credentials."""
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise _CatalogUnavailableError(PROBLEM_NO_API_KEY)
    try:
        import anthropic  # pylint: disable=import-outside-toplevel
    except ImportError as ex:
        raise _CatalogUnavailableError(PROBLEM_SDK_MISSING) from ex
    return anthropic.Anthropic(
        api_key=api_key,
        timeout=LIST_TIMEOUT_SECONDS,
        max_retries=1,
    )


def _fetch_models() -> tuple[CatalogModel, ...]:
    """The live list of models, or ``_CatalogUnavailableError`` saying why not."""
    client = _build_client()
    import anthropic  # pylint: disable=import-outside-toplevel

    try:
        entries = [entry for entry in client.models.list() if entry.id]
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError) as ex:
        logger.warning("Anthropic rejected the API key: %s", type(ex).__name__)
        raise _CatalogUnavailableError(PROBLEM_REJECTED_KEY) from ex
    except anthropic.APIConnectionError as ex:
        logger.warning("Anthropic could not be reached: %s", type(ex).__name__)
        raise _CatalogUnavailableError(PROBLEM_UNREACHABLE) from ex
    except anthropic.APIStatusError as ex:
        logger.warning("The Models API failed with status %s", ex.status_code)
        raise _CatalogUnavailableError(PROBLEM_UNAVAILABLE) from ex
    if not entries:
        raise _CatalogUnavailableError(PROBLEM_UNAVAILABLE)
    return tuple(sorted(map(_to_catalog_model, entries), key=_sort_key))


def clear_catalog_cache() -> None:
    """Forget the remembered list, so the next read asks the API again."""
    global _cache  # pylint: disable=global-statement
    with _cache_lock:
        _cache = None


def get_catalog(refresh: bool = False) -> Catalog:
    """
    The models to offer: the live list, or the table when the API cannot be read.

    A live list is kept for an hour and a failure for a few minutes, so an admin page
    never waits on a network that is down. A missing key is not remembered: it costs
    nothing to check and the page must notice as soon as one is set.
    """
    global _cache  # pylint: disable=global-statement
    with _cache_lock:
        cached = _cache
    now = time.monotonic()
    if cached and not refresh and now < cached[0]:
        return cached[1]

    try:
        catalog = Catalog(
            models=_fetch_models(),
            source=SOURCE_LIVE,
            fetched_at=datetime.now(timezone.utc),
        )
        ttl = LIVE_TTL_SECONDS
    except _CatalogUnavailableError as ex:
        catalog = Catalog(
            models=_table_models(),
            source=SOURCE_TABLE,
            problem=ex.problem,
        )
        ttl = 0.0 if ex.problem == PROBLEM_NO_API_KEY else PROBLEM_TTL_SECONDS

    with _cache_lock:
        _cache = (now + ttl, catalog) if ttl else None
    return catalog
