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
Create, change and delete scheduled reports and alerts of a report, with the
commands of the reports REST API (``CreateReportScheduleCommand``,
``UpdateReportScheduleCommand``, ``DeleteReportScheduleCommand``) and the
executor rule of 7.0 checked up front (``report/scheduling.py``).
"""

import logging
from typing import Any

from fastmcp import Context
from marshmallow import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.report import scheduling
from superset.mcp_service.report.schedule_schemas import (
    AlertCondition,
    CreateAlertRequest,
    CreateReportRequest,
    DeleteReportRequest,
    ReportScheduleResponse,
    ScheduleFields,
    UpdateReportRequest,
)
from superset.mcp_service.report.schemas import serialize_report_object
from superset.mcp_service.report_layout.editing import (
    find_dashboard,
    LayoutEditError,
    load_layout,
    Report,
    resolve_page,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)

_WRITE: dict[str, Any] = {
    "readOnlyHint": False,
    "idempotentHint": False,
    "openWorldHint": False,
}


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Rollback failed after a report error")


def _list_url(report_type: str | None) -> str:
    path = "/alert/list/" if report_type == "Alert" else "/report/list/"
    return f"{get_superset_base_url()}{path}"


def _recipients(emails: list[str]) -> list[dict[str, Any]]:
    """The email recipients the user gave, in one Email recipient."""
    target = ",".join(email.strip() for email in emails if email.strip())
    if not target:
        raise LayoutEditError(
            "Give at least one email address; ask the user who receives it."
        )
    return [{"type": "Email", "recipient_config_json": {"target": target}}]


def _emails_of(report: Any) -> list[str]:
    emails: list[str] = []
    for recipient in getattr(report, "recipients", None) or []:
        try:
            config = json.loads(recipient.recipient_config_json or "{}")
        except (TypeError, ValueError):
            continue
        target = config.get("target") or ""
        emails += [e.strip() for e in target.replace(";", ",").split(",") if e]
    return emails


def _page_extra(dashboard: Any, page: int | str | None) -> dict[str, Any] | None:
    """``extra`` of a report of one page: its tab active and anchored."""
    if page is None:
        return None
    page_id = resolve_page(Report(dashboard, load_layout(dashboard)), page)
    if page_id == "GRID_ID":
        return None
    return {"dashboard": {"activeTabs": [page_id], "anchor": page_id}}


def _validator(condition: AlertCondition) -> dict[str, Any]:
    if condition.op == "not null":
        return {"validator_type": "not null", "validator_config_json": {}}
    if condition.threshold is None:
        raise LayoutEditError(f"An alert with op '{condition.op}' needs a threshold.")
    return {
        "validator_type": "operator",
        "validator_config_json": {"op": condition.op, "threshold": condition.threshold},
    }


def _shared_payload(fields: ScheduleFields, dashboard: Any | None) -> dict[str, Any]:
    """The fields the request sets, as the reports REST API names them."""
    payload: dict[str, Any] = {}
    for key, name in (
        ("crontab", "crontab"),
        ("timezone", "timezone"),
        ("format", "report_format"),
        ("email_subject", "email_subject"),
        ("description", "description"),
        ("active", "active"),
    ):
        if (value := getattr(fields, key)) is not None:
            payload[name] = value
    if fields.recipients is not None:
        payload["recipients"] = _recipients(fields.recipients)
    if fields.page is not None and dashboard is not None:
        payload["extra"] = _page_extra(dashboard, fields.page) or {}
    return payload


def _load(schema: Any, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return schema.load(payload)
    except ValidationError as ex:
        raise LayoutEditError(f"Invalid report: {ex.messages}") from ex


def _refusal(ex: Exception) -> ReportScheduleResponse:
    """The response of a refused write."""
    from superset.commands.report.exceptions import (
        ReportScheduleForbiddenError,
        ReportScheduleInvalidError,
        ReportScheduleNotFoundError,
    )

    _rollback()
    if isinstance(ex, LayoutEditError):
        return ReportScheduleResponse(error=ex.message, error_type=ex.error_type)
    if isinstance(ex, ReportScheduleForbiddenError):
        return ReportScheduleResponse(
            permission_denied=True,
            error="Only the report's editors and Admins change it; do not retry.",
            error_type="Forbidden",
        )
    if isinstance(ex, ReportScheduleNotFoundError):
        return ReportScheduleResponse(error="Report not found.", error_type="NotFound")
    if isinstance(ex, ReportScheduleInvalidError):
        return ReportScheduleResponse(
            error=f"Invalid report: {ex.normalized_messages()}",
            error_type="InvalidRequest",
        )
    if isinstance(ex, SQLAlchemyError):
        logger.warning("Report write failed: %s", ex)
        return ReportScheduleResponse(
            error="The report could not be saved due to a database error.",
            error_type="DatabaseError",
        )
    return ReportScheduleResponse(error=str(ex), error_type=type(ex).__name__)


def _outcome(
    model: Any, executor: str, dashboard: Any, warnings: list[str]
) -> ReportScheduleResponse:
    dry_run = scheduling.dry_run()
    if dry_run:
        warnings.append(
            "Emails are only logged, never sent: notifications are in dry run "
            "(AURADATA_SEND_REPORTS turns sending on)."
        )
    if not dashboard.published:
        warnings.append(
            f"The dashboard is a draft: the report runs only while {executor} can "
            "open it. Publishing it keeps the report running."
        )
    return ReportScheduleResponse(
        success=True,
        report=serialize_report_object(model),
        recipients=_emails_of(model),
        executor=executor,
        dry_run=dry_run,
        url=_list_url(getattr(model, "type", None)),
        warnings=warnings,
    )


def _create(
    request: CreateReportRequest, extra: dict[str, Any]
) -> ReportScheduleResponse:
    from superset.commands.report.create import CreateReportScheduleCommand
    from superset.reports.schemas import ReportSchedulePostSchema

    dashboard = find_dashboard(request.dashboard)
    payload = {
        "name": request.name,
        "dashboard": dashboard.id,
        "creation_method": "alerts_reports",
        "report_format": "PNG",
        "timezone": "UTC",
        **_shared_payload(request, dashboard),
        **extra,
    }
    item = _load(ReportSchedulePostSchema(), payload)
    executor = scheduling.check_executor(scheduling.stand_in_for_new(), dashboard)
    model = CreateReportScheduleCommand(item).run()
    return _outcome(model, executor, dashboard, [])


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Create scheduled report", destructiveHint=False, **_WRITE
    ),
)
async def create_report(
    request: CreateReportRequest, ctx: Context
) -> ReportScheduleResponse:
    """
    Schedule a report: email a picture (PNG) or a PDF of a dashboard, or of one
    of its pages, to the addresses the user gives, on a cron schedule. It runs
    as you (its editor): on a draft dashboard that only works while you can
    open it, so publishing the dashboard is safer. Says whether emails are
    only logged (dry run). Never invent recipients.
    """
    await ctx.info(f"Create report on dashboard={request.dashboard}")
    with event_logger.log_context(action="mcp.create_report"):
        try:
            return _create(request, {"type": "Report"})
        except (LayoutEditError, CommandException, SQLAlchemyError) as ex:
            return _refusal(ex)


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(title="Create alert", destructiveHint=False, **_WRITE),
)
async def create_alert(
    request: CreateAlertRequest, ctx: Context
) -> ReportScheduleResponse:
    """
    Create an alert: on its schedule, run one SQL query that returns a single
    value on a database, and when the condition holds email a picture or PDF
    of the dashboard (or a page) to the addresses the user gives. The query
    may only read tables you can read. Same executor rule as create_report.
    """
    await ctx.info(f"Create alert on dashboard={request.dashboard}")
    with event_logger.log_context(action="mcp.create_alert"):
        try:
            extra = {
                "type": "Alert",
                "database": request.database,
                "sql": request.sql,
                **_validator(request.condition),
            }
            return _create(request, extra)
        except (LayoutEditError, CommandException, SQLAlchemyError) as ex:
            return _refusal(ex)


def _find_report(report_id: int) -> Any:
    """A report the caller edits; others answer as not found or forbidden."""
    from superset import security_manager
    from superset.daos.report import ReportScheduleDAO
    from superset.exceptions import SupersetSecurityException

    model = ReportScheduleDAO.find_by_id(report_id)
    if model is None:
        raise LayoutEditError(f"Report not found: {report_id}", "NotFound")
    try:
        security_manager.raise_for_editorship(model)
    except SupersetSecurityException as ex:
        from superset.commands.report.exceptions import ReportScheduleForbiddenError

        raise ReportScheduleForbiddenError() from ex
    return model


def _update(request: UpdateReportRequest) -> ReportScheduleResponse:
    from superset.commands.report.update import UpdateReportScheduleCommand
    from superset.reports.schemas import ReportSchedulePutSchema

    model = _find_report(request.report)
    dashboard = model.dashboard
    if dashboard is None:
        raise LayoutEditError(
            "This report sends a chart; change it in the web, where it was made."
        )
    if request.recipients is not None and model.creation_method in (
        "charts",
        "dashboards",
    ):
        raise LayoutEditError(
            "This report was set up from the dashboard's own menu, so it always "
            "goes to whoever sets it up. Create another one with create_report "
            "to send it to other people."
        )
    is_alert = model.type == "Alert"
    if not is_alert and (request.sql is not None or request.condition is not None):
        raise LayoutEditError("sql and condition only apply to alerts.")
    payload = _shared_payload(request, dashboard)
    if request.name is not None:
        payload["name"] = request.name
    if request.sql is not None:
        payload["sql"] = request.sql
        payload["database"] = model.database_id
    if request.condition is not None:
        payload.update(_validator(request.condition))
    if not payload:
        raise LayoutEditError("Nothing to change: give at least one field.")
    item = _load(ReportSchedulePutSchema(), payload)
    executor = scheduling.check_executor(
        scheduling.stand_in_for_update(model), dashboard
    )
    updated = UpdateReportScheduleCommand(model.id, item).run()
    return _outcome(updated, executor, dashboard, [])


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Update scheduled report", destructiveHint=False, **_WRITE
    ),
)
async def update_report(
    request: UpdateReportRequest, ctx: Context
) -> ReportScheduleResponse:
    """
    Change a scheduled report or alert: only the fields given (schedule,
    recipients the user gives, page, format, active to pause or resume, and
    for alerts the query and condition). Afterwards it runs as you, so the
    executor rule is checked again. Only its editors and Admins change it.
    """
    await ctx.info(f"Update report={request.report}")
    with event_logger.log_context(action="mcp.update_report"):
        try:
            return _update(request)
        except (LayoutEditError, CommandException, SQLAlchemyError) as ex:
            return _refusal(ex)


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="ReportSchedule",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Delete scheduled report", destructiveHint=True, **_WRITE
    ),
)
async def delete_report(
    request: DeleteReportRequest, ctx: Context
) -> ReportScheduleResponse:
    """
    Delete a scheduled report or alert for good (it has no trash). Only its
    editors and Admins delete it. Confirm with the user before calling.
    """
    from superset.commands.report.delete import DeleteReportScheduleCommand

    await ctx.info(f"Delete report={request.report}")
    with event_logger.log_context(action="mcp.delete_report"):
        try:
            model = _find_report(request.report)
            report_type = model.type
            DeleteReportScheduleCommand([model.id]).run()
        except (LayoutEditError, CommandException, SQLAlchemyError) as ex:
            return _refusal(ex)
    return ReportScheduleResponse(
        success=True, deleted_id=request.report, url=_list_url(report_type)
    )
