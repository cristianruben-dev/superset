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
MCP tool: generate_dashboard

This tool creates a new dashboard with specified charts and layout configuration.
"""

import logging
from typing import Any, Dict, List

from fastmcp import Context
from flask import g
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.auradata.layout import (
    CANVAS_PRESETS,
    CELL,
    DEFAULT_OBJECT_ROWS,
    keys,
    MAX_CANVAS_CELLS,
)
from superset.dashboards.layout import repair_position
from superset.extensions import db, event_logger, security_manager
from superset.mcp_service.dashboard.constants import generate_id
from superset.mcp_service.dashboard.layout_validation import rebuild_parent_chains
from superset.mcp_service.dashboard.schemas import (
    DashboardInfo,
    GenerateDashboardRequest,
    GenerateDashboardResponse,
    serialize_chart_summary,
    serialize_tag_object,
)
from superset.mcp_service.privacy import user_can_view_data_model_metadata
from superset.mcp_service.system.schemas import serialize_subject_object
from superset.mcp_service.utils.response_utils import humanize_timestamp
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils import json

logger = logging.getLogger(__name__)


# Charts of a generated report: two per row, each half the page wide
GENERATED_CHARTS_PER_ROW = 2
GENERATED_CHART_ROWS = DEFAULT_OBJECT_ROWS


def _chart_component(chart: Any, parents: list[str], x: int, y: int) -> dict[str, Any]:
    width = CANVAS_PRESETS["16:9"][0] // CELL // GENERATED_CHARTS_PER_ROW
    return {
        "children": [],
        "id": f"CHART-{chart.id}",
        "meta": {
            "chartId": chart.id,
            "height": GENERATED_CHART_ROWS,
            "sliceName": chart.slice_name or f"Chart {chart.id}",
            "uuid": str(chart.uuid) if chart.uuid else f"chart-{chart.id}",
            "width": width,
            keys.POS_KEY: {"x": x, "y": y},
        },
        "parents": parents,
        "type": "CHART",
    }


def _create_dashboard_layout(chart_objects: List[Any]) -> Dict[str, Any]:
    """
    Create the layout of a new report, in cells as the editor saves it, so
    opening it converts nothing: a 16:9 page with two charts per row, each in a
    ROW and placed at its cell (``auradataPos``).

    When the charts do not fit the page it grows, as ``layoutToPositions`` does
    on load, up to the largest page (128 rows); the rest go to more pages.

    Args:
        chart_objects: List of Chart ORM objects (not IDs)
    """
    layout: Dict[str, Any] = {}
    page_columns, page_rows = (n // CELL for n in CANVAS_PRESETS["16:9"])
    rows_per_page = MAX_CANVAS_CELLS // GENERATED_CHART_ROWS
    per_page = rows_per_page * GENERATED_CHARTS_PER_ROW
    chunks = [
        chart_objects[i : i + per_page] for i in range(0, len(chart_objects), per_page)
    ] or [[]]
    width = page_columns // GENERATED_CHARTS_PER_ROW

    tabs_id = generate_id(keys.TABS_TYPE) if len(chunks) > 1 else None
    page_ids: list[str] = []
    bottom = 0
    for number, charts in enumerate(chunks, start=1):
        page_id = generate_id(keys.TAB_TYPE) if tabs_id else keys.GRID_ID
        page_parents = [keys.ROOT_ID, tabs_id] if tabs_id else [keys.ROOT_ID]
        row_ids: list[str] = []
        for index, chart in enumerate(charts):
            row_id = generate_id(keys.ROW_TYPE)
            row_ids.append(row_id)
            row, column = divmod(index, GENERATED_CHARTS_PER_ROW)
            y = row * GENERATED_CHART_ROWS
            bottom = max(bottom, y + GENERATED_CHART_ROWS)
            chart_parents = [*page_parents, page_id, row_id]
            layout[f"CHART-{chart.id}"] = _chart_component(
                chart, chart_parents, column * width, y
            )
            layout[row_id] = {
                "children": [f"CHART-{chart.id}"],
                "id": row_id,
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
                "parents": [*page_parents, page_id],
                "type": keys.ROW_TYPE,
            }
        if tabs_id:
            layout[page_id] = {
                "children": row_ids,
                "id": page_id,
                "meta": {
                    "text": f"Página {number}",
                    "defaultText": "Tab title",
                    "placeholder": "Tab title",
                },
                "parents": page_parents,
                "type": keys.TAB_TYPE,
            }
        else:
            layout[keys.GRID_ID] = {
                "children": row_ids,
                "id": keys.GRID_ID,
                "parents": [keys.ROOT_ID],
                "type": keys.GRID_TYPE,
            }
        page_ids.append(page_id)

    root_meta: dict[str, Any] = {keys.CELLS_KEY: True}
    if bottom > page_rows:
        root_meta[keys.CANVAS_FORMAT_KEY] = {
            "size": {
                "mode": "custom",
                "width": page_columns * CELL,
                "height": bottom * CELL,
            }
        }
    if tabs_id:
        layout[tabs_id] = {
            "children": page_ids,
            "id": tabs_id,
            "meta": {},
            "parents": [keys.ROOT_ID],
            "type": keys.TABS_TYPE,
        }
        layout[keys.GRID_ID] = {
            "children": [],
            "id": keys.GRID_ID,
            "parents": [keys.ROOT_ID],
            "type": keys.GRID_TYPE,
        }
    layout[keys.ROOT_ID] = {
        "children": [tabs_id or keys.GRID_ID],
        "id": keys.ROOT_ID,
        "meta": root_meta,
        "type": keys.ROOT_TYPE,
    }
    layout[keys.VERSION_KEY] = "v2"
    return layout


_DEFAULT_DASHBOARD_TITLE = "Dashboard"
_MAX_TITLE_LENGTH = 150


def _generate_title_from_charts(chart_objects: List[Any]) -> str:
    """
    Build a descriptive dashboard title from the included chart names.

    Joins up to three chart ``slice_name`` values with " & " (two charts)
    or ", " (three charts).  When there are more than three charts the
    remaining count is appended as "+ N more".  The result is capped at
    ``_MAX_TITLE_LENGTH`` characters.

    Returns ``"Dashboard"`` when *chart_objects* is empty or no chart has
    a usable name.
    """
    names = [
        c.slice_name
        for c in sorted(chart_objects, key=lambda c: getattr(c, "id", 0))
        if getattr(c, "slice_name", None)
    ]
    if not names:
        return _DEFAULT_DASHBOARD_TITLE

    if len(names) == 1:
        title = names[0]
    elif len(names) == 2:
        title = f"{names[0]} & {names[1]}"
    elif len(names) == 3:
        title = f"{names[0]}, {names[1]}, {names[2]}"
    else:
        title = f"{names[0]}, {names[1]}, {names[2]} + {len(names) - 3} more"

    if len(title) > _MAX_TITLE_LENGTH:
        title = title[: _MAX_TITLE_LENGTH - 1] + "\u2026"

    return title


@tool(
    tags=["mutate"],
    class_permission_name="Dashboard",
    annotations=ToolAnnotations(
        title="Create dashboard",
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
def generate_dashboard(  # noqa: C901
    request: GenerateDashboardRequest, ctx: Context
) -> GenerateDashboardResponse:
    """Create a NEW dashboard from chart IDs.

    IMPORTANT:
    - Use this tool ONLY when creating a brand-new dashboard.
    - To add a chart to an EXISTING dashboard, use add_chart_to_existing_dashboard.
      Never use this tool as a fallback when add_chart_to_existing_dashboard fails.
    - All charts must exist and be accessible to current user
    - workspace_id creates it inside a workspace you contribute to, so its
      charts may use that workspace's datasets. Leave chart_ids empty to
      start an empty report and add charts with create_visual.
    - Layout: by default, charts go two per row on a 16:9 page of cells
      (30 x 12 cells each); arrange them later with place_object and the
      other layout tools. When ``position_json`` is supplied, that explicit
      layout is used instead and the auto-generated one is skipped — use
      this to compose custom rows, header bands, or MARKDOWN/HEADER components. Each
      component's ``parents`` is recomputed from its ``children`` edges
      before saving, so an omitted or incomplete ``parents`` array is fine.

    Returns:
    - Dashboard ID and URL
    """
    # Advisory messages (e.g. title sanitization) surfaced to the caller
    # alongside the created dashboard so they can tell when their input
    # was altered.
    sanitization_warnings = list(getattr(request, "sanitization_warnings", []) or [])

    try:
        # The workspace to create the report in, where the user contributes
        if request.workspace_id is not None:
            from superset.auradata.workspaces import (
                find_workspace,
                ROLE_CONTRIBUTOR,
                WorkspaceError,
            )

            try:
                find_workspace(request.workspace_id, ROLE_CONTRIBUTOR)
            except WorkspaceError as ex:
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        f"Workspace {request.workspace_id} not found. Use "
                        "list_workspaces."
                        if ex.status == 404
                        else "You must be a contributor or admin of workspace "
                        f"{request.workspace_id} to create a dashboard in it."
                    ),
                )

        # avoids ImportError before Flask app initialisation:
        # `Exception: App not initialized yet. Please call init_app first`
        # raised from superset.utils.encrypt when Slice's encrypted Column
        # types are instantiated at model-class definition time.
        from superset.models.slice import Slice

        with event_logger.log_context(action="mcp.generate_dashboard.chart_validation"):
            chart_objects = (
                db.session.query(Slice)
                .filter(Slice.id.in_(request.chart_ids))
                .order_by(Slice.id)
                .all()
            )
            found_chart_ids = [chart.id for chart in chart_objects]

            # Check if all requested charts were found
            missing_chart_ids = set(request.chart_ids) - set(found_chart_ids)
            if missing_chart_ids:
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        f"Charts not found: {sorted(missing_chart_ids)}."
                        " Use list_charts to get valid chart IDs."
                    ),
                )

            # Charts can belong to a single dashboard (AuraData BI)
            from superset.auradata.single_dashboard import (
                find_charts_in_other_dashboards,
                is_enabled,
            )

            if is_enabled() and (
                conflicts := find_charts_in_other_dashboards(found_chart_ids, None)
            ):
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        "A chart can only belong to one dashboard. These charts "
                        f"already belong to another dashboard: {sorted(conflicts)}"
                    ),
                )

            # Charts use the datasets of their dashboard's workspace or shared
            # ones (AuraData BI)
            from superset.auradata.workspace_datasets import chart_datasets_outside

            if foreign := chart_datasets_outside(found_chart_ids, request.workspace_id):
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=(
                        "These charts use datasets of another workspace: "
                        f"{', '.join(foreign)}. A dashboard only uses the datasets "
                        "of its workspace (workspace_id) or shared ones."
                    ),
                )

            # Validate dataset access as well as chart visibility.
            # check_chart_data_access is the centralized data-level
            # permission check that complements the class-level RBAC
            # enforced by mcp_auth_hook.
            from superset.mcp_service.auth import check_chart_data_access

            for chart in chart_objects:
                if not security_manager.can_access_chart(chart):
                    return GenerateDashboardResponse(
                        dashboard=None,
                        dashboard_url=None,
                        error=f"You don't have permission to access chart {chart.id}.",
                    )
                validation = check_chart_data_access(chart)
                if not validation.is_valid:
                    return GenerateDashboardResponse(
                        dashboard=None,
                        dashboard_url=None,
                        error=(
                            f"Chart {chart.id} is not accessible: {validation.error}"
                        ),
                    )

        # Create dashboard layout with chart objects.
        # If the caller provided an explicit position_json, use its
        # children/meta as given; otherwise auto-generate a packed-grid
        # layout from the chart ids (which already carries correct parents).
        with event_logger.log_context(action="mcp.generate_dashboard.layout"):
            if request.position_json:
                # A caller-supplied layout may carry only an immediate
                # parent (or omit `parents` altogether); rebuild the full
                # ancestor chains so server-side filter-scope derivation
                # sees the same tree the frontend would after hydration.
                # See superset.dashboards.filter_scope.get_chart_ids_in_scope.
                layout = rebuild_parent_chains(repair_position(request.position_json))
            else:
                layout = _create_dashboard_layout(chart_objects)

        # Resolve dashboard title: use provided title or derive from chart names
        dashboard_title = (
            request.dashboard_title
            if request.dashboard_title is not None
            else _generate_title_from_charts(chart_objects)
        )

        # Create the dashboard directly with db.session instead of using
        # CreateDashboardCommand.  The command's @transaction decorator
        # may operate in a different SQLAlchemy scoped-session than the
        # one g.user and chart ORM objects are bound to in the MCP
        # context, causing "Object is already attached to session X
        # (this is Y)" errors.  By re-querying all ORM objects in the
        # tool's own db.session we keep everything in a single session.
        from sqlalchemy.orm import subqueryload

        from superset.models.dashboard import Dashboard

        with event_logger.log_context(action="mcp.generate_dashboard.db_write"):
            # Build the default json_metadata that every new dashboard gets.
            # When the caller supplied json_metadata_overrides, merge those
            # in shallowly so the LLM can override label_colors / color_scheme
            # / cross_filters_enabled without re-specifying the whole shape.
            json_metadata_dict: Dict[str, Any] = {
                "filter_scopes": {},
                "expanded_slices": {},
                "refresh_frequency": 0,
                "timed_refresh_immune_slices": [],
                "color_scheme": None,
                "label_colors": {},
                "shared_label_colors": {},
                "color_scheme_domain": [],
                # On, as a dashboard the editor creates: charts filter each
                # other (set_visual_interactions narrows it per chart)
                "cross_filters_enabled": True,
                "native_filter_configuration": [],
                "global_chart_configuration": {
                    "scope": {
                        "rootPath": ["ROOT_ID"],
                        "excluded": [],
                    }
                },
                "chart_configuration": {},
            }
            if request.json_metadata_overrides:
                json_metadata_dict.update(request.json_metadata_overrides)
            json_metadata = json.dumps(json_metadata_dict)

            try:
                dashboard = Dashboard()
                dashboard.dashboard_title = dashboard_title
                dashboard.json_metadata = json_metadata
                dashboard.position_json = json.dumps(layout)
                dashboard.published = request.published

                if request.description:
                    dashboard.description = request.description

                if request.slug:
                    dashboard.slug = request.slug

                if request.css:
                    dashboard.css = request.css

                # Re-query the current user and charts directly in the
                # current db.session.  g.user was loaded in a Flask
                # app_context that has since been torn down (the
                # middleware's ``with flask_app.app_context()`` exits
                # before the tool function runs), so the User object
                # is bound to a dead/different scoped session.
                # Querying fresh avoids all cross-session errors.
                current_user = (
                    db.session.query(security_manager.user_model)
                    .filter_by(id=g.user.id)
                    .first()
                )
                if current_user:
                    from superset.subjects.utils import (
                        get_default_viewers_for_new_asset,
                        get_user_subject,
                    )

                    subj = get_user_subject(current_user.id)
                    if subj:
                        dashboard.editors = [subj]
                    dashboard.viewers = get_default_viewers_for_new_asset(
                        current_user.id
                    )

                fresh_charts = (
                    db.session.query(Slice)
                    .filter(Slice.id.in_(request.chart_ids))
                    .order_by(Slice.id)
                    .all()
                )
                dashboard.slices = fresh_charts

                db.session.add(dashboard)
                if request.workspace_id is not None:
                    from superset.auradata.models import WorkspaceDashboard

                    db.session.flush()
                    db.session.add(
                        WorkspaceDashboard(
                            workspace_id=request.workspace_id,
                            dashboard_id=dashboard.id,
                        )
                    )
                db.session.commit()  # pylint: disable=consider-using-transaction
                try:
                    db.session.refresh(dashboard)
                except SQLAlchemyError:
                    logger.warning(
                        "Dashboard %s created but refresh failed; "
                        "continuing with current values",
                        dashboard.id,
                        exc_info=True,
                    )
            except IntegrityError as db_err:
                try:
                    db.session.rollback()  # pylint: disable=consider-using-transaction
                except SQLAlchemyError:
                    logger.warning(
                        "Database rollback failed during error handling",
                        exc_info=True,
                    )
                logger.error("Dashboard creation failed: %s", db_err, exc_info=True)
                # Slug uniqueness is the only IntegrityError a caller
                # can fix on retry; surface a clear, structured message
                # so the LLM can propose a different slug. Detection
                # scans both the Postgres constraint name
                # (``dashboards_slug_key``) and the SQLite phrasing
                # (``UNIQUE constraint failed: dashboards.slug``).
                err_text = str(db_err).lower()
                if request.slug and "slug" in err_text:
                    return GenerateDashboardResponse(
                        dashboard=None,
                        dashboard_url=None,
                        error=(
                            f"Slug {request.slug!r} is already in use by "
                            "another dashboard. Choose a different slug "
                            "and retry, or omit the slug to get a "
                            "generated URL."
                        ),
                    )
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error=("Failed to create dashboard due to a database constraint."),
                )
            except SQLAlchemyError as db_err:
                try:
                    db.session.rollback()  # pylint: disable=consider-using-transaction
                except SQLAlchemyError:
                    logger.warning(
                        "Database rollback failed during error handling",
                        exc_info=True,
                    )
                logger.error(
                    "Dashboard creation failed: %s",
                    db_err,
                    exc_info=True,
                )
                return GenerateDashboardResponse(
                    dashboard=None,
                    dashboard_url=None,
                    error="Failed to create dashboard due to a database error.",
                )

        # ``dashboard.id`` is fixed at create-commit time; the post-commit
        # re-fetch below either returns the same row or fails — in either
        # outcome the URL doesn't change. Bind it once so the three
        # downstream consumers (partial response, DashboardInfo.url,
        # response.dashboard_url) share a single source. Prefer the slug
        # over the id to match ``update_dashboard``'s canonical URL shape.
        dashboard_url = (
            f"{get_superset_base_url()}/dashboard/{dashboard.slug or dashboard.id}/"
        )

        # Re-fetch with eager-loaded relationships for serialization.
        # The preceding commit may invalidate the session in multi-tenant
        # environments, causing "Can't reconnect until invalid transaction
        # is rolled back".  Wrap the DAO re-fetch in try/except; on failure,
        # return a minimal response using only scalar attributes that are
        # already loaded — relationship fields (editors, tags, slices) would
        # trigger lazy-loading on the same dead session.
        from superset.daos.dashboard import DashboardDAO

        try:
            dashboard = (
                DashboardDAO.find_by_id(
                    dashboard.id,
                    query_options=[
                        subqueryload(Dashboard.slices).subqueryload(Slice.editors),
                        subqueryload(Dashboard.slices).subqueryload(Slice.tags),
                        subqueryload(Dashboard.editors),
                        subqueryload(Dashboard.tags),
                    ],
                )
                or dashboard
            )
        except SQLAlchemyError:
            logger.warning(
                "Re-fetch of dashboard %s failed; returning minimal response",
                dashboard.id,
                exc_info=True,
            )
            try:
                db.session.rollback()  # pylint: disable=consider-using-transaction
            except SQLAlchemyError:
                logger.warning(
                    "Database rollback failed during dashboard re-fetch error handling",
                    exc_info=True,
                )
            return GenerateDashboardResponse(
                dashboard=DashboardInfo(
                    id=dashboard.id,
                    dashboard_title=dashboard.dashboard_title,
                    url=dashboard_url,
                    chart_count=len(request.chart_ids),
                    published=dashboard.published,
                ),
                dashboard_url=dashboard_url,
                error=None,
                warnings=sanitization_warnings
                + [
                    "Dashboard created but response metadata is partial "
                    "(post-create refresh failed); some fields are omitted. "
                    "Call get_dashboard_info to retrieve the full record."
                ],
            )

        # Convert to our response format
        include_data_model_metadata = user_can_view_data_model_metadata()
        dashboard_info = DashboardInfo(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title,
            slug=dashboard.slug,
            description=dashboard.description,
            published=dashboard.published,
            created_on=dashboard.created_on,
            changed_on=dashboard.changed_on,
            created_on_humanized=humanize_timestamp(dashboard.created_on),
            changed_on_humanized=humanize_timestamp(dashboard.changed_on),
            created_by=dashboard.created_by_name or None,
            changed_by=dashboard.changed_by_name or None,
            uuid=str(dashboard.uuid) if dashboard.uuid else None,
            url=dashboard_url,
            chart_count=len(request.chart_ids),
            editors=[
                serialize_subject_object(editor)
                for editor in getattr(dashboard, "editors", [])
                if serialize_subject_object(editor) is not None
            ],
            tags=[
                serialize_tag_object(tag)
                for tag in getattr(dashboard, "tags", [])
                if serialize_tag_object(tag) is not None
            ],
            charts=[
                obj
                for chart in getattr(dashboard, "slices", [])
                if (
                    obj := serialize_chart_summary(
                        chart,
                        include_data_model_metadata=include_data_model_metadata,
                    )
                )
                is not None
            ],
        )

        logger.info(
            "Created dashboard %s with %s charts", dashboard.id, len(request.chart_ids)
        )

        return GenerateDashboardResponse(
            dashboard=dashboard_info,
            dashboard_url=dashboard_url,
            error=None,
            warnings=sanitization_warnings,
        )

    except (SQLAlchemyError, ValueError, AttributeError, ValidationError) as e:
        try:
            db.session.rollback()  # pylint: disable=consider-using-transaction
        except SQLAlchemyError:
            logger.warning(
                "Database rollback failed during error handling", exc_info=True
            )
        # ``str(e)`` on SQLAlchemyError frequently contains table/column/
        # constraint names that should not leak to the MCP response.
        # The raw exception is captured above via ``logger.error`` with
        # ``exc_info=True``; the response surfaces a generic message.
        logger.error("Error creating dashboard: %s", e, exc_info=True)
        return GenerateDashboardResponse(
            dashboard=None,
            dashboard_url=None,
            error="Failed to create dashboard due to an internal error.",
        )
