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
Helpers shared by the trash and version history tools.

They answer the same principals as the REST API: the trash reuses the queries
and filters of ``/api/v1/workspace/<id>/trash/`` and of the ``*_deleted_state``
list filters (Administration › Trash), and the history goes through
``find_history_entity``, the gate of the ``/versions/`` endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, TypeVar
from uuid import UUID

from superset.mcp_service.history.schemas import (
    EntityType,
    HistoryOutcome,
    TrashItem,
    VersionAuthor,
    VersionItem,
)

R = TypeVar("R", bound=HistoryOutcome)

#: The FAB permission class of each kind, which its REST routes check
PERMISSION_CLASSES: dict[str, str] = {
    "dashboard": "Dashboard",
    "chart": "Chart",
    "dataset": "Dataset",
}

#: The MCP tool that restores a deleted entity of each kind from the trash
RESTORE_TOOLS: dict[str, str | None] = {
    "dashboard": "restore_dashboard",
    "chart": "restore_chart",
    "dataset": None,
}


class HistoryError(Exception):
    """A trash or history request that can't be served."""

    def __init__(self, error_type: str, message: str) -> None:
        super().__init__(message)
        self.error_type = error_type
        self.message = message


def not_found(entity_type: str, identifier: Any) -> HistoryError:
    return HistoryError(
        "NotFound",
        f"No {entity_type} found with identifier {str(identifier)[:200]}, or you "
        "can't read its history.",
    )


def forbidden(entity_type: str) -> HistoryError:
    return HistoryError(
        "Forbidden",
        f"You can't read or change the history of this {entity_type}: only its "
        "editors and the contributors and admins of its workspace can (do not "
        "retry; ask the user).",
    )


def from_workspace_error(error: Any) -> HistoryError:
    """The ``HistoryError`` of a ``WorkspaceError``, as the workspace tools word it."""
    from superset.mcp_service.workspace.utils import (
        DEFAULT_MESSAGES,
        error_text,
        ERROR_TYPES,
    )

    status = getattr(error, "status", 400)
    message = getattr(error, "message", None)
    return HistoryError(
        ERROR_TYPES.get(status, "InvalidRequest"),
        error_text(message) if message else DEFAULT_MESSAGES.get(status, ""),
    )


def error_response(response_cls: type[R], error: HistoryError, **fields: Any) -> R:
    """The tool response of a ``HistoryError``."""
    return response_cls(
        error=error.message,
        error_type=error.error_type,
        permission_denied=error.error_type == "Forbidden",
        **fields,
    )


def models() -> dict[str, type]:
    """The model of each kind."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    return {"dashboard": Dashboard, "chart": Slice, "dataset": SqlaTable}


def route_allowed(tool_name: str, entity_type: str, method: str) -> bool:
    """
    Whether the user holds the route permission of the REST endpoint of this kind
    (``can_read`` or ``can_write`` on Dashboard, Chart or Dataset). One tool serves
    the three kinds, so its own ``class_permission_name`` only covers dashboards.
    """
    from superset.mcp_service.auth import (
        check_tool_permission,
        CLASS_PERMISSION_ATTR,
        METHOD_PERMISSION_ATTR,
    )

    def probe() -> None:
        """Stands for the tool with the permission class of this kind."""

    probe.__name__ = tool_name
    setattr(probe, CLASS_PERMISSION_ATTR, PERMISSION_CLASSES[entity_type])
    setattr(probe, METHOD_PERMISSION_ATTR, method)
    return check_tool_permission(probe)


def entity_uuid_of(entity_type: str, identifier: int | str) -> UUID:
    """The UUID of a live entity given by ID or UUID."""
    from superset.extensions import db

    model = models()[entity_type]
    if isinstance(identifier, str) and not identifier.isdigit():
        try:
            return UUID(identifier)
        except ValueError as ex:
            raise not_found(entity_type, identifier) from ex
    found = db.session.query(model.uuid).filter(model.id == int(identifier)).scalar()
    if found is None:
        raise not_found(entity_type, identifier)
    return found if isinstance(found, UUID) else UUID(str(found))


def history_entity(
    tool_name: str, entity_type: str, identifier: int | str, method: str = "read"
) -> tuple[Any, UUID]:
    """
    The live entity whose history the user may read, and its UUID.

    :raises HistoryError: NotFound, or Forbidden for the route permission or the
        editorship gate of the ``/versions/`` endpoints
    """
    from superset.versioning.api_helpers import (
        find_history_entity,
        HistoryEntityForbiddenError,
        HistoryEntityNotFoundError,
    )

    if not route_allowed(tool_name, entity_type, method):
        raise forbidden(entity_type)
    entity_uuid = entity_uuid_of(entity_type, identifier)
    try:
        entity = find_history_entity(models()[entity_type], entity_uuid)
    except HistoryEntityForbiddenError as ex:
        raise forbidden(entity_type) from ex
    except HistoryEntityNotFoundError as ex:
        raise not_found(entity_type, identifier) from ex
    return entity, entity_uuid


def entity_versions(entity_type: str, entity: Any, entity_uuid: UUID) -> list[Any]:
    """The versions of an entity, oldest first, as the REST list returns them."""
    from superset.daos.version import VersionDAO

    return (
        VersionDAO.list_versions(models()[entity_type], entity_uuid, entity=entity)
        or []
    )


def find_version(
    versions: list[dict[str, Any]],
    version_uuid: str | None,
    version_number: int | None,
) -> dict[str, Any]:
    """
    One version, by UUID or number.

    :raises HistoryError: InvalidRequest without either, NotFound if absent
    """
    if version_uuid is None and version_number is None:
        raise HistoryError(
            "InvalidRequest", "Give version_uuid or version_number (list_versions)."
        )
    for version in versions:
        if version_uuid is not None and str(version["version_uuid"]) == version_uuid:
            return version
        if version_uuid is None and version["version_number"] == version_number:
            return version
    raise HistoryError(
        "NotFound", "That version is not in the history; use list_versions."
    )


def version_item(version: dict[str, Any]) -> VersionItem:
    """A version without its changes, with a summary of them."""
    changed_by = version.get("changed_by")
    issued_at = version.get("issued_at")
    changes = version.get("changes") or []
    return VersionItem(
        version_uuid=str(version["version_uuid"]),
        version_number=version["version_number"],
        operation_type=version["operation_type"],
        issued_at=issued_at.isoformat() if issued_at else None,
        changed_by=VersionAuthor(
            id=changed_by.get("id"),
            name=" ".join(
                part
                for part in (changed_by.get("first_name"), changed_by.get("last_name"))
                if part
            )
            or None,
        )
        if changed_by
        else None,
        change_count=len(changes),
        change_kinds=sorted({str(c.get("kind")) for c in changes if c.get("kind")}),
    )


@dataclass(frozen=True)
class TrashKind:
    """How the trash lists one kind: its DAO, filters and name."""

    dao: Any
    deleted_state_filter: type
    extra_filters: tuple[type, ...]
    name_attr: str


def trash_kinds() -> dict[str, TrashKind]:
    from superset.auradata.workspace_datasets import WorkspaceDatasetFilter
    from superset.charts.filters import ChartDeletedStateFilter
    from superset.daos.chart import ChartDAO
    from superset.daos.dashboard import DashboardDAO
    from superset.daos.dataset import DatasetDAO
    from superset.dashboards.filters import DashboardDeletedStateFilter
    from superset.datasets.filters import DatasetDeletedStateFilter

    return {
        "dashboard": TrashKind(
            DashboardDAO, DashboardDeletedStateFilter, (), "dashboard_title"
        ),
        "chart": TrashKind(ChartDAO, ChartDeletedStateFilter, (), "slice_name"),
        # The dataset REST list also applies the workspace filter
        "dataset": TrashKind(
            DatasetDAO,
            DatasetDeletedStateFilter,
            (WorkspaceDatasetFilter,),
            "table_name",
        ),
    }


def trash_item(entity_type: str, entity: Any, name_attr: str) -> TrashItem:
    from superset.auradata.workspaces import restore_blockers

    deleted_at = getattr(entity, "deleted_at", None)
    return TrashItem(
        entity_type=entity_type,  # type: ignore[arg-type]
        id=entity.id,
        uuid=str(entity.uuid),
        name=str(getattr(entity, name_attr) or ""),
        deleted_at=deleted_at.isoformat() if deleted_at else None,
        blocked_by=restore_blockers(entity) if entity_type == "dashboard" else None,
        restore_tool=RESTORE_TOOLS[entity_type],
    )


def global_trash(
    tool_name: str, entity_types: list[EntityType], limit: int
) -> list[TrashItem]:
    """
    The deleted entities the user can restore, most recently deleted first, as
    Administration › Trash lists them: the list endpoints with
    ``<kind>_deleted_state=only`` (everything for Superset admins, what they edit
    for others), on top of each DAO's access filter.
    """
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset.extensions import db
    from superset.mcp_service.mcp_core import BoundFilter, DeletedStateBoundFilter
    from superset.models.helpers import skip_visibility_filter

    items: list[TrashItem] = []
    for entity_type, kind in trash_kinds().items():
        if entity_type not in entity_types or not route_allowed(
            tool_name, entity_type, "read"
        ):
            continue
        model = kind.dao.model_cls
        datamodel = SQLAInterface(model, db.session)
        custom_filters: dict[str, Any] = {
            "deleted_state": DeletedStateBoundFilter(
                kind.deleted_state_filter("id", datamodel), "only", model
            )
        }
        for index, extra in enumerate(kind.extra_filters):
            custom_filters[f"extra_{index}"] = BoundFilter(extra("id", datamodel), None)
        # The soft-delete listener hides deleted rows at execution time; the
        # bypass covers this model only and ends with the block
        with skip_visibility_filter(db.session, model):
            rows, _ = kind.dao.list(
                order_column="deleted_at",
                order_direction="desc",
                page=0,
                page_size=limit,
                custom_filters=custom_filters,
            )
            items.extend(trash_item(entity_type, row, kind.name_attr) for row in rows)
    return sorted(items, key=lambda item: item.deleted_at or "", reverse=True)
