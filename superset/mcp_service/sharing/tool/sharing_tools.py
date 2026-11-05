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
Publish a report and share it: the link to send, who opens it and the tools
that give more people access. Who edits or views a report is changed with the
governance tools (manage_dashboard_owners, manage_dashboard_roles) and the
workspace tools; these tools don't re-implement them.
"""

import logging
from typing import Any

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.extensions import event_logger
from superset.mcp_service.dashboard.tool.governance_utils import dashboard_url
from superset.mcp_service.report_layout.editing import (
    find_dashboard,
    LayoutEditError,
    load_layout,
    Report,
    resolve_page,
)
from superset.mcp_service.sharing.schemas import (
    PublishDashboardRequest,
    PublishDashboardResponse,
    ShareDashboardRequest,
    ShareDashboardResponse,
    WorkspaceRef,
)
from superset.mcp_service.system.schemas import serialize_subject_object
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)

DRAFT_AUDIENCE = "its editors, Admins and the contributors and admins of its workspace"


def _rollback() -> None:
    from superset import db

    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
    except SQLAlchemyError:
        logger.warning("Rollback failed after a sharing error")


def _workspace(dashboard_id: int) -> WorkspaceRef | None:
    """The report's workspace, only when the caller belongs to it."""
    from superset.auradata.workspaces import workspace_of_dashboard, WorkspaceError

    try:
        found = workspace_of_dashboard(dashboard_id)
    except WorkspaceError:
        return None
    if found is None:
        return None
    workspace, role = found
    return WorkspaceRef(id=workspace.id, name=workspace.name, your_role=role)


def _in_a_workspace(dashboard_id: int) -> bool:
    from superset import db
    from superset.auradata.models import WorkspaceDashboard

    return (
        db.session.query(WorkspaceDashboard.id)
        .filter(WorkspaceDashboard.dashboard_id == dashboard_id)
        .first()
        is not None
    )


def _audience(dashboard: Any, workspace: WorkspaceRef | None) -> str:
    in_workspace = workspace is not None or _in_a_workspace(dashboard.id)
    if not dashboard.published:
        return f"A draft: only {DRAFT_AUDIENCE} open it."
    if in_workspace:
        return (
            "Published: the members of its workspace open it, and people the "
            "report names as viewers; they still need access to its data."
        )
    return (
        "Published: its editors, Admins and anyone with access to its data or "
        "named as a viewer open it."
    )


def _next_steps(dashboard: Any, workspace: WorkspaceRef | None) -> list[str]:
    steps: list[str] = []
    ref = dashboard.id
    if not dashboard.published:
        steps.append(
            f"publish_dashboard(dashboard={ref}) lets viewers open it; a draft "
            f"only opens for {DRAFT_AUDIENCE}."
        )
    if workspace is None:
        if not _in_a_workspace(dashboard.id):
            steps.append(
                f"move_dashboard_to_workspace(dashboard={ref}, workspace_id=...) "
                "shares it with the members of a workspace."
            )
    elif workspace.your_role == "admin":
        steps.append(
            f"set_workspace_member(workspace_id={workspace.id}, user=..., "
            "role='viewer' or 'contributor') gives someone every report of "
            f"workspace '{workspace.name}'; list_member_candidates finds them."
        )
    else:
        steps.append(
            f"Ask an admin of workspace '{workspace.name}' to add the person "
            "(set_workspace_member)."
        )
    steps.append(
        f"manage_dashboard_owners(identifier={ref}) adds an editor, and "
        f"manage_dashboard_roles(identifier={ref}) lets a role view it; both "
        "need a real editor of the report."
    )
    return steps


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=ToolAnnotations(
        title="Publish dashboard",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def publish_dashboard(
    request: PublishDashboardRequest, ctx: Context
) -> PublishDashboardResponse:
    """
    Publish a report (published=true) so its viewers open it, or turn it back
    into a draft (published=false), which only its editors, Admins and the
    contributors and admins of its workspace open. Same rule as the web:
    whoever edits the report publishes it.
    """
    from superset.commands.dashboard.exceptions import (
        DashboardForbiddenError,
        DashboardNotFoundError,
    )
    from superset.commands.dashboard.update import UpdateDashboardCommand

    await ctx.info(
        f"Publish dashboard={request.dashboard} published={request.published}"
    )
    try:
        dashboard = find_dashboard(request.dashboard)
    except LayoutEditError as ex:
        return PublishDashboardResponse(error=ex.message, error_type=ex.error_type)
    dashboard_id, title = dashboard.id, dashboard.dashboard_title
    previous = bool(dashboard.published)
    warnings: list[str] = []
    with event_logger.log_context(action="mcp.publish_dashboard"):
        if previous != request.published:
            try:
                UpdateDashboardCommand(
                    dashboard_id, {"published": request.published}
                ).run()
            except DashboardForbiddenError:
                return PublishDashboardResponse(
                    dashboard_id=dashboard_id,
                    title=title,
                    published=previous,
                    permission_denied=True,
                    error=(
                        f"You don't have permission to edit dashboard '{title}' "
                        f"(ID: {dashboard_id}); its editors publish it."
                    ),
                    error_type="Forbidden",
                )
            except DashboardNotFoundError:
                return PublishDashboardResponse(
                    error=f"Dashboard not found: {request.dashboard!r}",
                    error_type="NotFound",
                )
            except (CommandException, SQLAlchemyError) as ex:
                _rollback()
                logger.warning("publish_dashboard failed: %s", ex)
                return PublishDashboardResponse(
                    dashboard_id=dashboard_id,
                    title=title,
                    published=previous,
                    error="The dashboard could not be saved.",
                    error_type=type(ex).__name__,
                )
            if not request.published:
                warnings.extend(_draft_report_warnings(dashboard_id))
        else:
            warnings.append(
                "The report was already " + ("published." if previous else "a draft.")
            )
    dashboard = find_dashboard(dashboard_id)
    return PublishDashboardResponse(
        dashboard_id=dashboard_id,
        title=title,
        published=bool(dashboard.published),
        changed=previous != request.published,
        url=dashboard_url(dashboard),
        warnings=warnings,
    )


def _draft_report_warnings(dashboard_id: int) -> list[str]:
    """Scheduled reports of a report turned draft that will stop running."""
    from superset.mcp_service.report.scheduling import reports_that_lose_access

    return [
        f"Scheduled report '{name}' (id={pk}) runs as {executor}, who can't open "
        "the draft: it stops running until the report is published again or "
        f"{executor} becomes its editor or a contributor of its workspace."
        for pk, name, executor in reports_that_lose_access(dashboard_id)
    ]


@tool(
    tags=["mutate", "sharing"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Share dashboard",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def share_dashboard(
    request: ShareDashboardRequest, ctx: Context
) -> ShareDashboardResponse:
    """
    The link to send for a report and who can open it: published or draft,
    its editors and viewers, its workspace (when you belong to it), plus the
    tools that give more people access. With page, the link is a permanent
    link that opens on that page.
    """
    await ctx.info(f"Share dashboard={request.dashboard} page={request.page}")
    try:
        with event_logger.log_context(action="mcp.share_dashboard"):
            dashboard = find_dashboard(request.dashboard)
            url = dashboard_url(dashboard)
            page_id = permalink = None
            if request.page is not None:
                report = Report(dashboard, load_layout(dashboard))
                page_id = resolve_page(report, request.page)
                from superset.mcp_service.dashboard.permalink import (
                    create_page_permalink,
                )

                key = create_page_permalink(dashboard.id, page_id)
                permalink = f"{get_superset_base_url()}/dashboard/p/{key}/"
    except LayoutEditError as ex:
        return ShareDashboardResponse(error=ex.message, error_type=ex.error_type)
    except (CommandException, SQLAlchemyError) as ex:
        _rollback()
        logger.warning("share_dashboard could not create the link: %s", ex)
        return ShareDashboardResponse(
            error="The link could not be created.", error_type="LinkFailed"
        )
    workspace = _workspace(dashboard.id)
    return ShareDashboardResponse(
        dashboard_id=dashboard.id,
        title=dashboard.dashboard_title,
        published=bool(dashboard.published),
        url=url,
        link=permalink or url,
        permalink=permalink,
        page=page_id,
        audience=_audience(dashboard, workspace),
        editors=[s for e in dashboard.editors if (s := serialize_subject_object(e))],
        viewers=[
            s for v in (dashboard.viewers or []) if (s := serialize_subject_object(v))
        ],
        workspace=workspace,
        next_steps=_next_steps(dashboard, workspace),
    )
