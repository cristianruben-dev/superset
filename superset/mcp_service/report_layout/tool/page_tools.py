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
"""Page tools: add, rename, reorder, duplicate, delete and hide pages."""

from typing import Any

from fastmcp import Context
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.mcp_service.report_layout import pages
from superset.mcp_service.report_layout.editing import (
    LayoutEditError,
    open_report,
    resolve_page,
    save_report,
)
from superset.mcp_service.report_layout.schemas import (
    AddPageRequest,
    DeletePageRequest,
    DuplicatePageRequest,
    LayoutChangeResponse,
    RenamePageRequest,
    ReorderPagesRequest,
    SetPageHiddenRequest,
)
from superset.mcp_service.report_layout.tool.common import run_write


def _annotations(title: str, destructive: bool = False) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        readOnlyHint=False,
        destructiveHint=destructive,
        idempotentHint=False,
        openWorldHint=False,
    )


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Add a report page"),
)
async def add_page(request: AddPageRequest, ctx: Context) -> LayoutChangeResponse:
    """Add a page to a report (a top level tab). A report of one page keeps
    what it holds as its first page. Returns the new page id."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = pages.add_page(report, request.name, request.position)
        save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id, changed=[page_id], page=page_id
        )

    return await run_write("add_page", ctx, change)


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Rename a report page"),
)
async def rename_page(request: RenamePageRequest, ctx: Context) -> LayoutChangeResponse:
    """Rename a page of a report."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = pages.rename_page(report, request.page, request.name)
        save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id, changed=[page_id], page=page_id
        )

    return await run_write("rename_page", ctx, change)


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Reorder report pages"),
)
async def reorder_pages(
    request: ReorderPagesRequest, ctx: Context
) -> LayoutChangeResponse:
    """Put the pages of a report in a new order; name every page once."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        order = pages.reorder_pages(report, list(request.order))
        save_report(report)
        return LayoutChangeResponse(dashboard_id=report.dashboard.id, changed=order)

    return await run_write("reorder_pages", ctx, change)


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Duplicate a report page"),
)
async def duplicate_page(
    request: DuplicatePageRequest, ctx: Context
) -> LayoutChangeResponse:
    """Copy a page right after itself. A chart belongs to one place of one
    dashboard, so the page's charts are copied too (same names)."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        pages.make_tabs(report)
        page_id = resolve_page(report, request.page)
        clones = _clone_charts(report.dashboard, pages.chart_ids_under(report, page_id))
        copy_id = pages.copy_page(report, page_id, request.name, clones)
        save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id,
            changed=[copy_id],
            page=copy_id,
            created_chart_ids=[clone.id for clone in clones.values()],
        )

    return await run_write("duplicate_page", ctx, change)


def _clone_charts(dashboard: Any, chart_ids: list[int]) -> dict[int, Any]:
    """New charts like these, on the same dashboard, through the create command."""
    from superset.commands.chart.create import CreateChartCommand
    from superset.commands.chart.exceptions import (
        ChartCreateFailedError,
        ChartInvalidError,
        DashboardsForbiddenError,
    )

    sources = {chart.id: chart for chart in dashboard.slices}
    clones: dict[int, Any] = {}
    for chart_id in chart_ids:
        source = sources.get(chart_id)
        if source is None:
            continue
        data = {
            "slice_name": source.slice_name,
            "viz_type": source.viz_type,
            "params": source.params,
            "datasource_id": source.datasource_id,
            "datasource_type": source.datasource_type,
            "description": source.description,
            "cache_timeout": source.cache_timeout,
            "dashboards": [dashboard.id],
        }
        try:
            clones[chart_id] = CreateChartCommand(data).run()
        except DashboardsForbiddenError as ex:
            raise LayoutEditError(
                "You don't have permission to add charts to this dashboard.",
                "Forbidden",
            ) from ex
        except ChartInvalidError as ex:
            raise LayoutEditError(
                f"A chart of the page cannot be copied: {ex.normalized_messages()}"
            ) from ex
        except ChartCreateFailedError as ex:
            raise LayoutEditError(
                "Failed to copy a chart of the page.", "DatabaseError"
            ) from ex
    return clones


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Delete a report page", destructive=True),
)
async def delete_page(request: DeletePageRequest, ctx: Context) -> LayoutChangeResponse:
    """Delete a page and what it holds. Its charts leave the dashboard (they are
    not deleted; restore an earlier version from the history to undo). A
    report keeps at least one page."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id, chart_ids = pages.delete_page(report, request.page)
        removed = set(chart_ids)
        remaining = [c for c in report.dashboard.slices if c.id not in removed]
        save_report(report, slices=remaining)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id,
            changed=[page_id],
            removed_chart_ids=chart_ids,
        )

    return await run_write("delete_page", ctx, change)


@tool(
    tags=["mutate", "layout"],
    class_permission_name="Dashboard",
    method_permission_name="write",
    annotations=_annotations("Hide or show a report page"),
)
async def set_page_hidden(
    request: SetPageHiddenRequest, ctx: Context
) -> LayoutChangeResponse:
    """Hide a page from viewers' tabs, or show it again. Links, buttons and
    drill through still open a hidden page."""

    def change() -> LayoutChangeResponse:
        report = open_report(request.dashboard, edit=True)
        page_id = pages.set_page_hidden(report, request.page, request.hidden)
        saved = save_report(report)
        return LayoutChangeResponse(
            dashboard_id=report.dashboard.id,
            changed=[page_id] if saved else [],
            page=page_id,
        )

    return await run_write("set_page_hidden", ctx, change)
