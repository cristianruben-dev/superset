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
"""Shared running of the layout write tools."""

from typing import Callable

from fastmcp import Context

from superset.extensions import event_logger
from superset.mcp_service.report_layout.editing import LayoutEditError
from superset.mcp_service.report_layout.schemas import CellBox, LayoutChangeResponse


def error_response(ex: LayoutEditError) -> LayoutChangeResponse:
    return LayoutChangeResponse(
        error=ex.message,
        error_type=ex.error_type,
        permission_denied=ex.error_type == "Forbidden",
    )


async def run_write(
    name: str, ctx: Context, change: Callable[[], LayoutChangeResponse]
) -> LayoutChangeResponse:
    """Run a layout change, turning refusals into an error response."""
    await ctx.info(f"{name}: starting")
    try:
        with event_logger.log_context(action=f"mcp.{name}"):
            result = change()
    except LayoutEditError as ex:
        await ctx.warning(f"{name} refused: {ex.error_type}: {ex.message}")
        return error_response(ex)
    await ctx.info(f"{name}: changed {result.changed}")
    return result


def cell_box(x: int, y: int, width: int, height: int) -> CellBox:
    return CellBox(x=x, y=y, width=width, height=height)
