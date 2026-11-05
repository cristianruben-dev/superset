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
"""Report structure, page, object, format, visual, element, slicer and
interactivity tools."""

from superset.mcp_service.report_layout.tool.element_tools import (
    add_element,
    add_slicer,
    format_element,
    format_slicer,
    remove_element,
    update_element,
    update_slicer,
)
from superset.mcp_service.report_layout.tool.format_tools import (
    copy_format,
    format_visual,
    get_format_options,
    set_canvas_format,
    set_dashboard_css,
    set_shared_visual_format,
    upload_dashboard_background,
    upload_dashboard_image,
)
from superset.mcp_service.report_layout.tool.get_report_structure import (
    get_report_structure,
)
from superset.mcp_service.report_layout.tool.interactivity_tools import (
    clear_drillthrough_page,
    create_bookmark,
    delete_bookmark,
    get_filter_defaults,
    list_bookmarks,
    make_tooltip_page,
    set_drillthrough_page,
    set_filter_bar_auto_apply,
    set_visual_interactions,
    set_visual_tooltip,
    sync_slicer,
    update_bookmark,
)
from superset.mcp_service.report_layout.tool.object_tools import (
    align_objects,
    bring_to_front,
    distribute_objects,
    move_object,
    place_object,
    resize_object,
    set_object_state,
)
from superset.mcp_service.report_layout.tool.page_tools import (
    add_page,
    delete_page,
    duplicate_page,
    rename_page,
    reorder_pages,
    set_page_hidden,
)
from superset.mcp_service.report_layout.tool.visual_tools import (
    change_visual_dataset,
    create_visual,
    get_visual_fields,
    set_visual_fields,
    set_visual_sort,
)

__all__ = [
    "add_page",
    "align_objects",
    "bring_to_front",
    "copy_format",
    "delete_page",
    "distribute_objects",
    "duplicate_page",
    "format_visual",
    "get_format_options",
    "get_report_structure",
    "move_object",
    "place_object",
    "rename_page",
    "reorder_pages",
    "resize_object",
    "set_canvas_format",
    "set_dashboard_css",
    "set_object_state",
    "set_page_hidden",
    "set_shared_visual_format",
    "upload_dashboard_background",
    "upload_dashboard_image",
    "change_visual_dataset",
    "create_visual",
    "get_visual_fields",
    "set_visual_fields",
    "set_visual_sort",
    "add_element",
    "add_slicer",
    "format_element",
    "format_slicer",
    "remove_element",
    "update_element",
    "update_slicer",
    "clear_drillthrough_page",
    "create_bookmark",
    "delete_bookmark",
    "get_filter_defaults",
    "list_bookmarks",
    "make_tooltip_page",
    "set_drillthrough_page",
    "set_filter_bar_auto_apply",
    "set_visual_interactions",
    "set_visual_tooltip",
    "sync_slicer",
    "update_bookmark",
]
