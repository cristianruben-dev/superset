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
What the assistant spends, added up from the cost stored with each answer.

The month, the rounding and the limits are defined here and nowhere else. A month is a
calendar month of the clock that stamps ``AssistantMessage.created_on`` (the naive local
time of the server, UTC in the images), from its first instant up to but not including
the first instant of the next. Amounts are ``Decimal`` to the millionth of a dollar, the
precision of the column, so a limit is compared exactly and a total never drifts.

Only rows of the role ``assistant`` hold a cost, and those include the turns refused or
interrupted: what the API reported was spent.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import sqlalchemy as sa

from superset import security_manager
from superset.auradata.models import AssistantMessage, Workspace
from superset.extensions import db

USD_STEP = Decimal("0.000001")
WARNING_SHARE = Decimal("0.8")
MONTHS_SHOWN = 12

LEVEL_OK = "ok"
LEVEL_WARNING = "warning"
LEVEL_STOPPED = "stopped"
_SEVERITY = (LEVEL_OK, LEVEL_WARNING, LEVEL_STOPPED)

SCOPE_GLOBAL = "global"
SCOPE_WORKSPACE = "workspace"


@dataclass(frozen=True)
class BudgetState:
    """How close the assistant is to a limit. It holds no amounts: anyone reads it."""

    level: str = LEVEL_OK
    # Which limit that level comes from
    scope: str | None = None


def usd(value: Any) -> Decimal:
    """An amount in dollars, to the precision everything here is compared at."""
    return Decimal(str(value or 0)).quantize(USD_STEP, ROUND_HALF_UP)


def month_start(moment: datetime) -> datetime:
    """The first instant of the month of ``moment``."""
    return moment.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_month(start: datetime) -> datetime:
    """The first instant of the month after ``start``, which starts a month."""
    if start.month == 12:
        return start.replace(year=start.year + 1, month=1)
    return start.replace(month=start.month + 1)


def previous_month(start: datetime) -> datetime:
    """The first instant of the month before ``start``, which starts a month."""
    if start.month == 1:
        return start.replace(year=start.year - 1, month=12)
    return start.replace(month=start.month - 1)


def month_key(start: datetime) -> str:
    return start.strftime("%Y-%m")


def parse_month(key: str) -> datetime:
    """The start of a month written ``YYYY-MM``. A bad one raises ``ValueError``."""
    return month_start(datetime.strptime(key, "%Y-%m"))


def budget_level(spent: Decimal, budget: float | None) -> str:
    """
    Where a month's spending stands against a limit. None sets no limit, and a limit of
    zero stops the assistant from the start.
    """
    if budget is None:
        return LEVEL_OK
    limit = usd(budget)
    if spent >= limit:
        return LEVEL_STOPPED
    return LEVEL_WARNING if spent >= limit * WARNING_SHARE else LEVEL_OK


def _answers_of(start: datetime) -> tuple[Any, ...]:
    """The rows that count for the month that begins at ``start``."""
    return (
        AssistantMessage.role == "assistant",
        AssistantMessage.created_on >= start,
        AssistantMessage.created_on < next_month(start),
    )


def spent_usd(start: datetime, workspace_id: int | None = None) -> Decimal:
    """What a month cost, in all or in one workspace."""
    query = db.session.query(sa.func.sum(AssistantMessage.cost_usd)).filter(
        *_answers_of(start)
    )
    if workspace_id is not None:
        query = query.filter(AssistantMessage.workspace_id == workspace_id)
    return usd(query.scalar())


def budget_state(
    global_budget: float | None,
    workspace_id: int | None = None,
    workspace_budget: float | None = None,
    now: datetime | None = None,
) -> BudgetState:
    """The state of this month: the nearest limit decides."""
    start = month_start(now or datetime.now())
    state = BudgetState()
    if global_budget is not None:
        level = budget_level(spent_usd(start), global_budget)
        state = BudgetState(level, SCOPE_GLOBAL if level != LEVEL_OK else None)
    if workspace_id is not None and workspace_budget is not None:
        level = budget_level(spent_usd(start, workspace_id), workspace_budget)
        if _SEVERITY.index(level) > _SEVERITY.index(state.level):
            state = BudgetState(level, SCOPE_WORKSPACE)
    return state


def _money(value: Any) -> float:
    return float(usd(value))


def _grouped(start: datetime, *columns: Any) -> list[Any]:
    """A month's cost, tokens and answers by ``columns``, the most expensive first."""
    cost = sa.func.sum(AssistantMessage.cost_usd)
    return (
        db.session.query(
            *columns,
            cost.label("cost"),
            sa.func.sum(
                AssistantMessage.input_tokens
                + AssistantMessage.output_tokens
                + AssistantMessage.cache_read_input_tokens
                + AssistantMessage.cache_creation_input_tokens
            ).label("tokens"),
            sa.func.count(AssistantMessage.id).label("answers"),
        )
        .filter(*_answers_of(start))
        .group_by(*columns)
        .order_by(cost.desc())
        .all()
    )


def _amounts(row: Any) -> dict[str, Any]:
    return {
        "cost_usd": _money(row.cost),
        "tokens": int(row.tokens or 0),
        "answers": row.answers,
    }


def _full_name(user: Any) -> str:
    return " ".join(part for part in (user.first_name, user.last_name) if part) or (
        user.username
    )


def usage_report(start: datetime, now: datetime | None = None) -> dict[str, Any]:
    """
    The usage of a month by model, workspace and user, and the total of the last months.
    A user or a workspace that no longer exists comes with a ``null`` id and name.
    """
    user_model = security_manager.user_model
    by_workspace = _grouped(start, AssistantMessage.workspace_id)
    by_user = _grouped(start, AssistantMessage.user_id)
    names = dict(
        db.session.query(Workspace.id, Workspace.name)
        .filter(Workspace.id.in_([row.workspace_id for row in by_workspace]))
        .all()
    )
    users = {
        user.id: user
        for user in db.session.query(user_model)
        .filter(user_model.id.in_([row.user_id for row in by_user]))
        .all()
    }
    months = []
    moment = month_start(now or datetime.now())
    for _ in range(MONTHS_SHOWN):
        months.append(
            {"month": month_key(moment), "cost_usd": _money(spent_usd(moment))}
        )
        moment = previous_month(moment)
    return {
        "month": month_key(start),
        "total_usd": _money(spent_usd(start)),
        "months": months,
        "by_model": [
            {"model": row.model, **_amounts(row)}
            for row in _grouped(start, AssistantMessage.model)
        ],
        "by_workspace": [
            {
                "workspace_id": row.workspace_id,
                "name": names.get(row.workspace_id),
                **_amounts(row),
            }
            for row in by_workspace
        ],
        "by_user": [
            {
                "user_id": row.user_id,
                "name": _full_name(users[row.user_id])
                if row.user_id in users
                else None,
                **_amounts(row),
            }
            for row in by_user
        ],
    }
