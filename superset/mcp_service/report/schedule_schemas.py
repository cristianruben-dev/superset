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
"""Schemas of the tools that create, change and delete reports and alerts."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from superset.mcp_service.report.schemas import ReportInfo

EMAILS_DESCRIPTION = (
    "Email addresses that receive it, exactly as the user gave them; never "
    "make one up. Ask the user when they gave none."
)


def _no_bool(value: object) -> object:
    if isinstance(value, bool):
        raise ValueError("expected an id, not true/false")
    return value


class ScheduleFields(BaseModel):
    """What a report and an alert share."""

    model_config = ConfigDict(extra="forbid")

    page: int | str | None = Field(
        None,
        description="Only this page (id, name or position from 1); the whole "
        "report by default",
    )
    crontab: str | None = Field(
        None, description="When it runs, as a cron expression: '0 8 * * 1' (Mon 8:00)"
    )
    timezone: str | None = Field(None, description="Time zone of the crontab: UTC")
    recipients: list[str] | None = Field(None, description=EMAILS_DESCRIPTION)
    format: Literal["PNG", "PDF"] | None = Field(
        None, description="What the email carries: a picture (PNG) or a PDF"
    )
    email_subject: str | None = Field(None, max_length=255)
    description: str | None = None
    active: bool | None = Field(None, description="false pauses it")


class CreateReportRequest(ScheduleFields):
    name: str = Field(min_length=1, max_length=150)
    dashboard: int | str = Field(description="Dashboard id, uuid or slug")
    crontab: str = Field(
        description="When it runs, as a cron expression: '0 8 * * 1' (Mon 8:00)"
    )
    recipients: list[str] = Field(
        min_length=1, max_length=50, description=EMAILS_DESCRIPTION
    )

    _dashboard = field_validator("dashboard", mode="before")(_no_bool)


class AlertCondition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: Literal["<", "<=", ">", ">=", "==", "!=", "not null"] = Field(
        description="Compare the query's single value with threshold, or "
        "'not null': alert when the query returns a value"
    )
    threshold: float | None = Field(None, description="Needed unless op is 'not null'")


class CreateAlertRequest(CreateReportRequest):
    database: int = Field(description="Database the alert's query runs on")
    sql: str = Field(min_length=1, description="One SELECT that returns a single value")
    condition: AlertCondition

    _database = field_validator("database", mode="before")(_no_bool)


class UpdateReportRequest(ScheduleFields):
    report: int = Field(description="Report or alert id (list_reports)")
    name: str | None = Field(None, min_length=1, max_length=150)
    sql: str | None = Field(None, min_length=1, description="Alerts only")
    condition: AlertCondition | None = Field(None, description="Alerts only")

    _report = field_validator("report", mode="before")(_no_bool)


class DeleteReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report: int = Field(description="Report or alert id (list_reports)")

    _report = field_validator("report", mode="before")(_no_bool)


class ReportScheduleResponse(BaseModel):
    success: bool = False
    report: ReportInfo | None = None
    recipients: list[str] = Field(default_factory=list)
    executor: str | None = Field(None, description="The user it runs as")
    dry_run: bool | None = Field(
        None,
        description="True: emails are only logged, never sent "
        "(ALERT_REPORTS_NOTIFICATION_DRY_RUN; AURADATA_SEND_REPORTS turns "
        "sending on)",
    )
    url: str | None = Field(None, description="The list of reports in the web")
    deleted_id: int | None = None
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    error_type: str | None = None
    permission_denied: bool = False
