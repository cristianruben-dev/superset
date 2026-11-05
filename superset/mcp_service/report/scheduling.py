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
Scheduled reports and alerts of a report (dashboard), with Superset's report
commands and the rule of 7.0: a report runs as one of its editors
(``ALERT_REPORTS_EXECUTORS``), who needs to open the dashboard. A draft only
opens for its editors, Admins and the contributors and admins of its
workspace, so a report whose executor can't open it stops running. The rule is
checked before saving, with the same executor choice and access check the
worker makes.
"""

import logging
from dataclasses import dataclass, field
from typing import Any

from superset.mcp_service.report_layout.editing import LayoutEditError

logger = logging.getLogger(__name__)


@dataclass
class ScheduleStandIn:
    """What ``get_executor`` reads of a report: who made it and its editors."""

    created_by: Any
    changed_by: Any
    editors: list[Any] = field(default_factory=list)


def current_user() -> Any:
    from flask import g

    return getattr(g, "user", None)


def stand_in_for_new() -> ScheduleStandIn:
    """A report the caller creates: they make it and become its editor."""
    from superset.subjects.utils import get_or_create_user_subject

    user = current_user()
    return ScheduleStandIn(user, user, [get_or_create_user_subject(user.id)])


def stand_in_for_update(report: Any) -> ScheduleStandIn:
    """A report the caller changes: they become its last modifier."""
    return ScheduleStandIn(report.created_by, current_user(), list(report.editors))


def executor_of(model: Any) -> Any | None:
    """The user the report would run as, or None when nobody qualifies."""
    from flask import current_app

    from superset import security_manager
    from superset.tasks.exceptions import ExecutorNotFoundError
    from superset.tasks.utils import get_executor

    try:
        _, username = get_executor(current_app.config["ALERT_REPORTS_EXECUTORS"], model)
    except ExecutorNotFoundError:
        return None
    return security_manager.find_user(username=username)


def opens_dashboard(user: Any, dashboard: Any) -> bool:
    """Whether the user opens the dashboard, as the report worker will check."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException
    from superset.utils.core import override_user

    with override_user(user):
        try:
            security_manager.raise_for_access(dashboard=dashboard)
        except SupersetSecurityException:
            return False
    return True


def check_executor(model: Any, dashboard: Any) -> str:
    """
    The username the report will run as. Refuses, with what to do, when nobody
    qualifies or the executor can't open the dashboard.
    """
    title = f"'{dashboard.dashboard_title}' (ID: {dashboard.id})"
    executor = executor_of(model)
    if executor is None:
        raise LayoutEditError(
            "Nobody can run this report: it runs as one of its editors "
            "(ALERT_REPORTS_EXECUTORS) and none qualifies.",
            "ExecutorNotFound",
        )
    if not opens_dashboard(executor, dashboard):
        name = executor.username
        if not dashboard.published:
            message = (
                f"The report would run as {name}, who can't open dashboard "
                f"{title} because it is a draft. Publish it (publish_dashboard) "
                f"or make {name} an editor of the dashboard or a contributor of "
                "its workspace, then try again."
            )
        else:
            message = (
                f"The report would run as {name}, who can't open dashboard "
                f"{title}. Give {name} access to it (an editor, or a member of "
                "its workspace), then try again."
            )
        raise LayoutEditError(message, "ExecutorCannotOpenDashboard")
    return executor.username


def reports_that_lose_access(dashboard_id: int) -> list[tuple[int, str, str]]:
    """
    Active reports and alerts of a dashboard whose executor can't open it, as
    (id, name, executor): after it turns into a draft, they stop running.
    """
    from superset import db
    from superset.models.dashboard import Dashboard
    from superset.reports.models import ReportSchedule

    dashboard = db.session.get(Dashboard, dashboard_id)
    if dashboard is None:
        return []
    reports = (
        db.session.query(ReportSchedule)
        .filter(
            ReportSchedule.dashboard_id == dashboard_id,
            ReportSchedule.active.is_(True),
        )
        .all()
    )
    lost: list[tuple[int, str, str]] = []
    for report in reports:
        executor = executor_of(report)
        if executor is None or not opens_dashboard(executor, dashboard):
            name = executor.username if executor else "nobody"
            lost.append((report.id, report.name, name))
    return lost


def dry_run() -> bool:
    """Whether notifications are only logged (``ALERT_REPORTS_NOTIFICATION_DRY_RUN``,
    on unless ``AURADATA_SEND_REPORTS`` turns sending on)."""
    from flask import current_app

    return bool(current_app.config.get("ALERT_REPORTS_NOTIFICATION_DRY_RUN"))
