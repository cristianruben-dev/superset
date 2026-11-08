# Referencia del MCP de AuraData BI

> Archivo generado desde el registro del MCP con
> `scripts/auradata/mcp_reference.py`: no lo edites a mano.
> `tests/unit_tests/mcp_service/test_reference_doc.py` falla si queda viejo.

Cada herramienta lista su grupo, sus etiquetas, el permiso que pide y el scope
de una clave de «Conectar IA» que la deja usarla. Las descripciones y los
parámetros salen tal cual del código, en inglés, el idioma en que la IA los
lee. Las reglas de AuraData BI que aplica cada herramienta (un tablero por
gráfico, datasets del workspace, quién edita) están en su descripción.

Todas las herramientas reciben sus parámetros dentro de un objeto `request`,
salvo las pocas que lo dicen en su ejemplo. La IA actúa como el dueño de la
clave: una herramienta nunca hace algo que esa persona no pueda hacer en la
web. Cómo conectar una IA: [conectar.md](conectar.md).

146 herramientas, 6 prompts y 9 recursos.

## Índice

- **Workspaces y miembros:** [`create_workspace`](#create_workspace), [`delete_workspace`](#delete_workspace), [`get_workspace`](#get_workspace), [`get_workspace_of_dashboard`](#get_workspace_of_dashboard), [`list_member_candidates`](#list_member_candidates), [`list_workspace_members`](#list_workspace_members), [`list_workspaces`](#list_workspaces), [`move_dashboard_to_workspace`](#move_dashboard_to_workspace), [`move_dataset_to_workspace`](#move_dataset_to_workspace), [`remove_workspace_member`](#remove_workspace_member), [`set_workspace_member`](#set_workspace_member), [`update_workspace`](#update_workspace)
- **Informe: estructura, páginas y objetos:** [`add_page`](#add_page), [`align_objects`](#align_objects), [`bring_to_front`](#bring_to_front), [`delete_page`](#delete_page), [`distribute_objects`](#distribute_objects), [`duplicate_page`](#duplicate_page), [`get_report_structure`](#get_report_structure), [`move_object`](#move_object), [`place_object`](#place_object), [`rename_page`](#rename_page), [`reorder_pages`](#reorder_pages), [`resize_object`](#resize_object), [`set_object_state`](#set_object_state), [`set_page_hidden`](#set_page_hidden)
- **Informe: visuales:** [`change_visual_dataset`](#change_visual_dataset), [`create_visual`](#create_visual), [`get_visual_fields`](#get_visual_fields), [`set_visual_fields`](#set_visual_fields), [`set_visual_sort`](#set_visual_sort)
- **Informe: formato:** [`copy_format`](#copy_format), [`format_visual`](#format_visual), [`get_format_options`](#get_format_options), [`set_canvas_format`](#set_canvas_format), [`set_dashboard_css`](#set_dashboard_css), [`set_shared_visual_format`](#set_shared_visual_format), [`upload_dashboard_background`](#upload_dashboard_background), [`upload_dashboard_image`](#upload_dashboard_image)
- **Informe: elementos y segmentadores:** [`add_element`](#add_element), [`add_slicer`](#add_slicer), [`format_element`](#format_element), [`format_slicer`](#format_slicer), [`remove_element`](#remove_element), [`update_element`](#update_element), [`update_slicer`](#update_slicer)
- **Informe: interactividad:** [`clear_drillthrough_page`](#clear_drillthrough_page), [`create_bookmark`](#create_bookmark), [`delete_bookmark`](#delete_bookmark), [`get_filter_defaults`](#get_filter_defaults), [`list_bookmarks`](#list_bookmarks), [`make_tooltip_page`](#make_tooltip_page), [`set_drillthrough_page`](#set_drillthrough_page), [`set_filter_bar_auto_apply`](#set_filter_bar_auto_apply), [`set_visual_interactions`](#set_visual_interactions), [`set_visual_tooltip`](#set_visual_tooltip), [`sync_slicer`](#sync_slicer), [`update_bookmark`](#update_bookmark)
- **Informe: diseño móvil:** [`clear_mobile_layout`](#clear_mobile_layout), [`generate_mobile_layout`](#generate_mobile_layout), [`set_mobile_layout`](#set_mobile_layout)
- **Capturas y exportación:** [`export_dashboard_image`](#export_dashboard_image), [`export_dashboard_pdf`](#export_dashboard_pdf), [`get_dashboard_screenshot`](#get_dashboard_screenshot), [`get_visual_screenshot`](#get_visual_screenshot)
- **Publicar y compartir:** [`publish_dashboard`](#publish_dashboard), [`share_dashboard`](#share_dashboard)
- **Informes y alertas programados:** [`create_alert`](#create_alert), [`create_report`](#create_report), [`delete_report`](#delete_report), [`get_report_info`](#get_report_info), [`list_reports`](#list_reports), [`update_report`](#update_report)
- **Papelera e historial de versiones:** [`get_version_diff`](#get_version_diff), [`list_trash`](#list_trash), [`list_versions`](#list_versions), [`restore_version`](#restore_version)
- **Tableros (herramientas de Superset):** [`add_chart_to_existing_dashboard`](#add_chart_to_existing_dashboard), [`delete_dashboard`](#delete_dashboard), [`duplicate_dashboard`](#duplicate_dashboard), [`generate_dashboard`](#generate_dashboard), [`get_dashboard_datasets`](#get_dashboard_datasets), [`get_dashboard_info`](#get_dashboard_info), [`get_dashboard_layout`](#get_dashboard_layout), [`list_dashboards`](#list_dashboards), [`manage_dashboard_certification`](#manage_dashboard_certification), [`manage_dashboard_owners`](#manage_dashboard_owners), [`manage_dashboard_roles`](#manage_dashboard_roles), [`manage_native_filters`](#manage_native_filters), [`remove_chart_from_dashboard`](#remove_chart_from_dashboard), [`restore_dashboard`](#restore_dashboard), [`update_dashboard`](#update_dashboard)
- **Gráficos (herramientas de Superset):** [`delete_chart`](#delete_chart), [`generate_chart`](#generate_chart), [`get_chart_data`](#get_chart_data), [`get_chart_info`](#get_chart_info), [`get_chart_preview`](#get_chart_preview), [`get_chart_sql`](#get_chart_sql), [`get_chart_type_schema`](#get_chart_type_schema), [`list_charts`](#list_charts), [`restore_chart`](#restore_chart), [`update_chart`](#update_chart), [`update_chart_preview`](#update_chart_preview)
- **Datasets y modelo de datos:** [`add_calculated_column`](#add_calculated_column), [`add_metric`](#add_metric), [`create_dataset`](#create_dataset), [`create_virtual_dataset`](#create_virtual_dataset), [`delete_calculated_column`](#delete_calculated_column), [`delete_metric`](#delete_metric), [`get_dataset_info`](#get_dataset_info), [`list_datasets`](#list_datasets), [`query_dataset`](#query_dataset), [`restore_dataset`](#restore_dataset), [`set_column_properties`](#set_column_properties), [`update_calculated_column`](#update_calculated_column), [`update_dataset_metric`](#update_dataset_metric)
- **Conexiones:** [`get_database_info`](#get_database_info), [`list_databases`](#list_databases), [`test_database_connection`](#test_database_connection)
- **SQL Lab y consultas:** [`execute_sql`](#execute_sql), [`get_query_info`](#get_query_info), [`get_saved_query_info`](#get_saved_query_info), [`list_queries`](#list_queries), [`list_saved_queries`](#list_saved_queries), [`open_sql_lab_with_context`](#open_sql_lab_with_context), [`save_sql_query`](#save_sql_query)
- **Explore:** [`generate_explore_link`](#generate_explore_link)
- **Capa semántica:** [`get_compatible_dimensions`](#get_compatible_dimensions), [`get_compatible_metrics`](#get_compatible_metrics), [`get_table`](#get_table), [`list_metrics`](#list_metrics)
- **Usuarios, roles y gobierno:** [`get_rls_filter_info`](#get_rls_filter_info), [`get_role_info`](#get_role_info), [`get_tag_info`](#get_tag_info), [`get_task_info`](#get_task_info), [`get_user_info`](#get_user_info), [`list_rls_filters`](#list_rls_filters), [`list_roles`](#list_roles), [`list_tags`](#list_tags), [`list_tasks`](#list_tasks), [`list_users`](#list_users)
- **Sistema:** [`find_users`](#find_users), [`generate_bug_report`](#generate_bug_report), [`get_instance_info`](#get_instance_info), [`get_schema`](#get_schema), [`health_check`](#health_check)
- **Prompts:** `create_chart_guided`, `diseno_movil`, `informe_desde_dataset`, `quickstart`, `replicar_informe_power_bi`, `revisar_informe`
- **Recursos:** `auradata://brand`, `auradata://format-catalog`, `auradata://report-conventions`, `chart://configs`, `instance://metadata`, `superset://schema/all`, `superset://schema/chart`, `superset://schema/dashboard`, `superset://schema/dataset`

## Workspaces y miembros

### `create_workspace`

*Create workspace*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Create a workspace; you become its admin.

Example: {"name": "Ventas", "color": "#2563EB"}

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `name` | string | sí |  | Name (1-250 characters) |
| `description` | string |  |  | Up to 1000 characters |
| `color` | string |  |  | Hex color like #2563EB |

Ejemplo:

```json
{"request": {"name": "Ventas"}}
```

### `delete_workspace`

*Delete workspace*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Delete a workspace (its admins). Ask the user first.

Its dashboards and datasets are kept, outside any workspace: the
dashboards are then visible to anyone with access, and the datasets
become shared.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |

Ejemplo:

```json
{"request": {"workspace_id": 1}}
```

### `get_workspace`

*Get workspace*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `workspace`

Get a workspace you belong to, with its dashboards and datasets.

Lists only the dashboards and datasets you can access.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |

Ejemplo:

```json
{"request": {"workspace_id": 1}}
```

### `get_workspace_of_dashboard`

*Get workspace of dashboard*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `workspace`

Get the workspace a dashboard lives in, and your role there.

Null when it has no workspace, or it is in one you do not belong to.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer | sí |  | Dashboard ID |

Ejemplo:

```json
{"request": {"dashboard_id": 1}}
```

### `list_member_candidates`

*List member candidates*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `workspace`

Find up to 20 active users who are not members of a workspace yet.

Only admins of the workspace can search, to add them with
set_workspace_member.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |
| `search` | string |  |  | Name, username or email text |

Ejemplo:

```json
{"request": {"workspace_id": 1}}
```

### `list_workspace_members`

*List workspace members*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `workspace`

List the members of a workspace you belong to and their roles.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |

Ejemplo:

```json
{"request": {"workspace_id": 1}}
```

### `list_workspaces`

*List workspaces*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `workspace`

List the workspaces you belong to (all of them for admins), by name.

A workspace groups dashboards and datasets, with members as viewer,
contributor or admin. Contributors and admins edit its dashboards.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `search` | string |  |  | Text the name contains |

Ejemplo:

```json
{"request": {}}
```

### `move_dashboard_to_workspace`

*Move dashboard to workspace*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Move a dashboard into a workspace, or out of any (workspace_id null).

Needs a contributor or admin role in the workspace it enters (and the
right to edit the dashboard) or in the one it leaves. Its charts may
only use datasets of the new workspace or shared ones; otherwise share
or move those datasets first.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer | sí |  | Dashboard ID |
| `workspace_id` | integer |  |  | Target workspace; null takes it out of any workspace |

Ejemplo:

```json
{"request": {"dashboard_id": 1}}
```

### `move_dataset_to_workspace`

*Move dataset to workspace*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Move a dataset into a workspace, or make it shared (workspace_id null).

Entering needs a contributor or admin role in the workspace and real
editorship of the dataset, and no dashboard outside the workspace may use
it. Sharing needs that role in the workspace it leaves.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dataset_id` | integer | sí |  | Dataset ID |
| `workspace_id` | integer |  |  | Target workspace; null makes it shared |

Ejemplo:

```json
{"request": {"dataset_id": 1}}
```

### `remove_workspace_member`

*Remove workspace member*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Remove a member from a workspace (its admins), or leave it yourself.

The last admin of a workspace cannot be removed.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |
| `user_id` | integer | sí |  | Member to remove (yourself to leave) |

Ejemplo:

```json
{"request": {"workspace_id": 1, "user_id": 1}}
```

### `set_workspace_member`

*Set workspace member*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Add a user to a workspace, or change their role (its admins).

viewer reads; contributor also edits its dashboards and charts and reads
its datasets; admin also manages the workspace and its members. A
workspace keeps at least one admin.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |
| `user_id` | integer | sí |  | User ID (see list_member_candidates) |
| `role` | "viewer" \| "contributor" \| "admin" | sí |  | viewer, contributor or admin |

Ejemplo:

```json
{"request": {"workspace_id": 1, "user_id": 1, "role": "viewer"}}
```

### `update_workspace`

*Update workspace*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `workspace`

Change the name, description or color of a workspace (its admins).

Only the fields given change. Example: {"workspace_id": 3, "name": "Ventas"}

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer | sí |  | Workspace ID |
| `name` | string |  |  |  |
| `description` | string |  |  |  |
| `color` | string |  |  | Hex color like #2563EB |

Ejemplo:

```json
{"request": {"workspace_id": 1}}
```

## Informe: estructura, páginas y objetos

### `add_page`

*Add a report page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Add a page to a report (a top level tab). A report of one page keeps
what it holds as its first page. Returns the new page id.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `name` | string |  |  | Page name; 'Página N' by default |
| `position` | integer |  |  | Place from 1 among the pages; last by default |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `align_objects`

*Align objects*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Line two or more objects of a page up against the left, right, top or
bottom edge of them all, or their center or middle. Locked ones stay.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `objects` | lista de integer o string | sí |  | Objects of a page |
| `mode` | "left" \| "center" \| "right" \| "top" \| "middle" \| "bottom" | sí |  |  |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "objects": [], "mode": "left"}}
```

### `bring_to_front`

*Change the stack order of an object*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Bring an object to the front of its page, send it to the back, or move
it one step forward or backward in the stack.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `move` | "front" \| "back" \| "forward" \| "backward" |  | `"front"` |  |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `delete_page`

*Delete a report page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Delete a page and what it holds. Its charts leave the dashboard (they are
not deleted; restore an earlier version from the history to undo). A
report keeps at least one page.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1}}
```

### `distribute_objects`

*Distribute objects*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Space three or more objects of a page evenly between the outer two,
across (horizontal) or down (vertical). Locked ones stay.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `objects` | lista de integer o string | sí |  | Objects of a page |
| `axis` | "horizontal" \| "vertical" | sí |  |  |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "objects": [], "axis": "horizontal"}}
```

### `duplicate_page`

*Duplicate a report page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Copy a page right after itself. A chart belongs to one place of one
dashboard, so the page's charts are copied too (same names).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |
| `name` | string |  |  | Name of the copy |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1}}
```

### `get_report_structure`

*Get report structure*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `layout`

Describe a report (dashboard) as the editor shows it: its page size in
cells, its pages (hidden and tooltip pages included) and, on each page,
its objects (charts, text boxes, slicers, images, shapes, buttons) with
their box in cells of 32 px from the top left, stack layer, state and
resolved format, plus its native filters and bookmarks. Use the page and
object ids with the page and object tools.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `include_format` | boolean |  | `true` | Include each object's resolved format |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `move_object`

*Move an object*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Move an object to a cell (x, y) of its page, or by dx and dy cells.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `x` | integer |  |  | New column cell |
| `y` | integer |  |  | New row cell |
| `dx` | integer |  | `0` | Cells to move right (negative: left) |
| `dy` | integer |  | `0` | Cells to move down (negative: up) |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `place_object`

*Place an object on a page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Put a chart, element or text box at a cell of a page, optionally moving
it to another page and resizing it. Without x and y it takes the first free
cell of the page for its size.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `page` | integer o string |  |  | Page to move it to; its own page by default |
| `x` | integer |  |  | Column cell; first free if unset |
| `y` | integer |  |  | Row cell; first free if unset |
| `width` | integer |  |  | Width in cells |
| `height` | integer |  |  | Height in cells |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `rename_page`

*Rename a report page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Rename a page of a report.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |
| `name` | string | sí |  |  |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1, "name": "Ventas"}}
```

### `reorder_pages`

*Reorder report pages*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Put the pages of a report in a new order; name every page once.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `order` | lista de integer o string | sí |  | Every page, new order |

Ejemplo:

```json
{"request": {"dashboard": 1, "order": []}}
```

### `resize_object`

*Resize an object*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Resize an object in cells, keeping its top left corner. Charts are at
least 4 x 3 cells, other objects 2 x 2, and none outgrows the page.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `width` | integer |  |  | Width in cells |
| `height` | integer |  |  | Height in cells |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `set_object_state`

*Set object state*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Hide an object from viewers (editors still see it faded), lock it so it
cannot be moved, resized or removed, or set its screen reader text.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `hidden` | boolean |  |  | Hide it from viewers |
| `locked` | boolean |  |  | Keep it from moving |
| `alt_text` | string |  |  | Screen reader text; empty clears it |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `set_page_hidden`

*Hide or show a report page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`

Hide a page from viewers' tabs, or show it again. Links, buttons and
drill through still open a hidden page.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |
| `hidden` | boolean | sí |  | Hide the page from viewers' tabs |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1, "hidden": true}}
```

## Informe: visuales

### `change_visual_dataset`

*Change the dataset of a visual*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`, `visual`

Move a chart of a report to another dataset of the dashboard's workspace
(or a shared one), as "Use this table in the chart" does: the fields and
filters the new dataset lacks leave the chart (listed in dropped). A well
left empty needs a replacement in fields, or the change is refused.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `dataset_id` | integer o string | sí |  | New dataset id or uuid: of the dashboard's workspace or shared |
| `fields` | objeto |  |  | Fields for the wells the new dataset empties, as set_visual_fields takes them. Without them a change that empties a well is refused. |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "dataset_id": 1}}
```

### `create_visual`

*Create a visual in a report*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`, `visual`

Create a chart inside a report and place it on a page, in one step, as
the report editor's side panel does: the chart belongs to this dashboard
only and uses a dataset of the dashboard's workspace or a shared one.

The spec is the one generate_chart takes (dataset_id + config with
chart_type); it is validated and its query compiled before anything is
saved. Without x and y the chart takes the first free cell of the page;
it never covers another object unless allow_overlap. Format it later with
format_visual, change its fields with set_visual_fields.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them); the first by default |
| `dataset_id` | integer o string | sí |  | Dataset id or uuid: one of the dashboard's workspace or shared |
| `config` | objeto | sí |  | Chart spec, as generate_chart takes it (get_chart_type_schema) |
| `time_filters` | lista de objeto |  |  | Time ranges the chart is limited to |
| `chart_name` | string |  |  | Chart title; generated by default |
| `x` | integer |  |  | Column cell; first free if unset |
| `y` | integer |  |  | Row cell; first free if unset |
| `width` | integer |  |  | Width in cells (12 by default) |
| `height` | integer |  |  | Height in cells (12 by default) |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |

Ejemplo:

```json
{"request": {"dashboard": 1, "dataset_id": 1, "config": {}}}
```

### `get_visual_fields`

*Read the fields of a visual*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `layout`, `visual`

The field wells of a chart of a report (as the Fields pane shows them),
what each takes, and its sort with the choices set_visual_sort accepts.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `set_visual_fields`

*Set the fields of a visual*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`, `visual`

Put fields in the wells of a chart of a report (axis, legend, values,
columns...), as the Fields pane and the Data pane do. The change is saved
on the chart after its query compiles; a value the report's layout held
over the chart moves to the chart, so the report shows the new fields.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `fields` | objeto | sí |  | Field wells by form data key (get_visual_fields lists them), as the Fields pane sets them. A column well takes column names (or an ad hoc column {"sql_expression": ..., "label": ...}); a value well takes saved metric names, {"name": column, "aggregate": "SUM"\|"AVG"\|...} or {"sql_expression": ..., "label": ...}; a plain number column name goes in as its SUM. A one-field well takes one value, the others a list; null empties a well. |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "fields": {}}}
```

### `set_visual_sort`

*Sort a visual*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mutate`, `visual`

Sort a chart of a report as its "Sort axis" menu does: bars, lines and
areas by the axis, a metric or a series aggregate; pie and funnel by the
metric or a dimension; tables by a column or metric; pivot tables by row
labels (key) or values. Saved on the chart.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `by` | string | sí |  | What to sort by: a column or metric label of the chart; for charts with series also name, sum, min, max or avg; for pivot tables key (row labels) or value. A refusal lists the choices. |
| `ascending` | boolean |  | `false` | Ascending; descending by default |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "by": "…"}}
```

## Informe: formato

### `copy_format`

*Copy a format*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Copy the format of one object to others, as the format painter does: the
targets take its box and chart settings but keep what belongs to each of
them (subtitle, help text, link, action button, own chart settings, the
title of an element); elements of the same kind also take its style.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `source` | integer o string | sí |  | Object whose format to copy |
| `targets` | lista de integer o string | sí |  |  |

Ejemplo:

```json
{"request": {"dashboard": 1, "source": 1, "targets": []}}
```

### `format_visual`

*Format a visual*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Format one object of a report, one level of the Format pane at a time.
Visual and Analytics: chart settings by key (labels, legend, axes, colors,
series, reference lines, trend line, tooltip fields, small multiples);
each replaces the chart's saved value and repaints without a query.
General: title, background, border, radius, shadow, padding, header icons,
link and action button, plus auradata_tooltip and auradata_sampling for
ECharts charts. null resets a setting. Returns the resolved format.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `level` | "visual" \| "general" \| "analytics" | sí |  | Level of the Format pane |
| `patch` | objeto | sí |  | Settings by key (get_format_options); null resets one. General objects merge key by key; chart settings replace their value |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "level": "visual", "patch": {}}}
```

### `get_format_options`

*Get format options*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `format`, `layout`

List the format settings of a chart type, as the Format pane shows them:
Visual and Analytics sections with each control's key, value kind, choices,
range and default, and the General settings every object shares (title,
background, border, shadow, padding, header icons, link, action button,
tooltip and sampling). Pass viz_type, or a dashboard and object to read
the chart type of a chart. Use the keys with format_visual. Pass
element (image, shape, button, text, navigator, filter) for the settings
of a design element or slicer.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `viz_type` | string |  |  | Chart type (e.g. echarts_timeseries_bar) |
| `dashboard` | integer o string |  |  | With object: read the chart type of that chart |
| `object` | integer o string |  |  | Object id from get_report_structure, or a chart id |
| `level` | "visual" \| "general" \| "analytics" |  |  | One level; all by default |
| `section` | string |  |  | Only this section id |
| `descriptions` | boolean |  | `false` | Include control descriptions (with section) |
| `element` | "image" \| "shape" \| "button" \| "text" \| "navigator" \| "filter" |  |  | Settings of a design element or slicer (filter) |

Ejemplo:

```json
{"request": {}}
```

### `set_canvas_format`

*Set the canvas format*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Set the page of a report: its size (16:9, 4:3, letter, or custom in cells
of 32 px), its background (color, gradient or a picture of this site; use
upload_dashboard_background for a new picture) and the colors of the
filter pane and page bar. A smaller page fits its objects back inside.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `size` | objeto |  |  | Page size; objects are fitted inside a smaller page |
| `background` | objeto |  |  |  |
| `filter_bar` | objeto |  |  | Filter pane colors |
| `tabs` | objeto |  |  | Page bar colors |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `set_dashboard_css`

*Set the dashboard CSS*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Set the custom CSS of a report (its own css field; the look of the app is
fixed by the product). An empty string clears it. CSS may not import
other files or load pictures from other sites.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `css` | string | sí |  | CSS; empty clears it |

Ejemplo:

```json
{"request": {"dashboard": 1, "css": "…"}}
```

### `set_shared_visual_format`

*Set the shared visual format*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Set the style every chart of the report shares ("Apply to all charts"),
kept on the canvas so charts added later take it too. Share the format of
from_object, change it with a patch of General settings (chart settings
under 'chart'), or both. A chart's own format wins over it, setting by
setting; with reset_charts (the default, as in the pane) charts drop their
own style but what names them (subtitle, help text, link, own settings).
Settings that belong to one chart are never shared.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `from_object` | integer o string |  |  | Share this chart's format, as 'Apply to all charts' |
| `patch` | objeto |  |  | General settings to change in the shared style; chart settings go under 'chart'. null resets one |
| `reset_charts` | boolean |  | `true` | Charts drop their own style (keeping titles, subtitles, links and their own chart settings), as the pane does |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `upload_dashboard_background`

*Upload a background*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Upload the background picture of a report from base64 (PNG, JPEG, GIF or
WebP, 2 MB at most) and show it on the page. The server never downloads
pictures from an address: send the file itself.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `image_base64` | string | sí |  | PNG, JPEG, GIF or WebP, 2 MB at most, as base64 |
| `fit` | "cover" \| "contain" \| "repeat" |  | `"cover"` |  |
| `opacity` | number |  |  |  |

Ejemplo:

```json
{"request": {"dashboard": 1, "image_base64": "…"}}
```

### `upload_dashboard_image`

*Upload an image*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `format`, `layout`, `mutate`

Upload a picture for the image elements of a report from base64 (PNG,
JPEG, GIF or WebP, 2 MB at most) and return its id and address, which also
serves chart settings that take a picture. With object, an image element
shows it. The server never downloads pictures from an address.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `image_base64` | string | sí |  | PNG, JPEG, GIF or WebP, 2 MB at most, as base64 |
| `object` | integer o string |  |  | An image element to show it; otherwise only uploaded |

Ejemplo:

```json
{"request": {"dashboard": 1, "image_base64": "…"}}
```

## Informe: elementos y segmentadores

### `add_element`

*Add a design element*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Add a design element to a page of a report, as the editor's Design
elements do: image, shape, button, text or page navigator, with its
settings over the defaults of a new one (get_format_options with element
lists them). A button acts with action: {type: page, page: <name or id>},
{type: bookmark, bookmarkId}, {type: back}, {type: url, url} or
reset-filters. An image takes image_base64 (never an address). Without x
and y it takes the first free cell of the page for its size.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them) |
| `x` | integer |  |  | Cell column; free cell by default |
| `y` | integer |  |  | Cell row; free cell by default |
| `width` | integer |  |  | Cells |
| `height` | integer |  |  | Cells |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |
| `kind` | "image" \| "shape" \| "button" \| "text" \| "navigator" | sí |  |  |
| `settings` | objeto |  |  | Element settings (get_format_options with element=&lt;kind> lists them); objects merge key by key, null resets |
| `format` | objeto |  |  | General box patch: title, background, border, radius, shadow, padding |
| `image_base64` | string |  |  | PNG, JPEG, GIF or WebP as base64, 2 MB at most; never an address |

Ejemplo:

```json
{"request": {"dashboard": 1, "kind": "image"}}
```

### `add_slicer`

*Add a slicer*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Add a slicer to a page: a new native filter of the dashboard and the
canvas element that draws it, saved together. list slicers (a column's
values) draw as dropdown, list, buttons or a text box (input); range
slicers as between boxes or a slider; time slicers as a relative date or
two days. Options: single, multi or ctrl selection, an Apply button, sort,
hidden values, show_in_filter_bar and a default value. scope "page"
filters only this page's charts; "report" (default) every chart. Values of
a list, buttons included, stack in a column as in the editor: pass
settings {"layout": "horizontal"} for a row of buttons, or "grid" with
"columns".

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `name` | string | sí |  | Filter name |
| `variant` | "dropdown" \| "list" \| "buttons" \| "input" |  |  | List filters only |
| `range_style` | "between" \| "slider" |  |  |  |
| `date_style` | "relative" \| "between" |  |  |  |
| `selection` | "multi" \| "single" \| "ctrl" |  |  | single, multi or ctrl (one per click, more with Ctrl) |
| `apply_button` | boolean |  |  | Wait for Apply |
| `sort` | "asc" \| "desc" |  |  |  |
| `hidden_values` | lista |  |  | Values left out |
| `show_in_filter_bar` | boolean |  |  |  |
| `default_value` | cualquiera |  |  | Default: a list of values (list), [min, max] (range), or a time range such as 'Last month' (time); null clears it |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them) |
| `x` | integer |  |  | Cell column; free cell by default |
| `y` | integer |  |  | Cell row; free cell by default |
| `width` | integer |  |  | Cells |
| `height` | integer |  |  | Cells |
| `allow_overlap` | boolean |  | `false` | Allow the object to cover others (off by default) |
| `filter_type` | "list" \| "range" \| "time" |  | `"list"` | list of values, numeric range, or time range |
| `dataset_id` | integer |  |  | Dataset (list and range) |
| `column` | string |  |  | Column (list and range) |
| `scope` | "page" \| "report" |  | `"report"` | Charts it filters: this page's or all |
| `settings` | objeto |  |  | Element settings (get_format_options with element=&lt;kind> lists them); objects merge key by key, null resets |

Ejemplo:

```json
{"request": {"name": "Ventas", "dashboard": 1}}
```

### `format_element`

*Format a design element*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Format the box of a design element or slicer (the General level of its
Format pane): title, background, border, radius, shadow, padding, header
icons and link. null resets a setting.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `patch` | objeto | sí |  | General box patch: title, background, border, radius, shadow, padding |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "patch": {}}}
```

### `format_slicer`

*Format a slicer*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Format a slicer, one level of its Format pane at a time. visual: the
header, values, selection, search box, dropdown list, chips and Apply
button (get_format_options with element=filter lists the keys). general:
its box (title, background, border, radius, shadow, padding).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `level` | "visual" \| "general" | sí |  | visual: look of the slicer; general: its box |
| `patch` | objeto | sí |  | visual: slicer settings; general: General box patch: title, background, border, radius, shadow, padding |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "level": "visual", "patch": {}}}
```

### `remove_element`

*Remove a design element*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Remove a design element or slicer from its page. A slicer's native filter
goes too (remove_filter, on by default) unless another slicer shows it;
an image's uploaded picture is deleted. Locked elements are refused.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `remove_filter` | boolean |  | `true` | A slicer's native filter goes too, if nothing else shows it |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `update_element`

*Update a design element*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Change the settings of a design element (image, shape, button, text,
navigator): its content, action and look, as a patch where objects merge
key by key and null resets a setting. image_base64 replaces the picture of
an image. Slicers change with update_slicer and format_slicer.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `settings` | objeto |  |  | Element settings (get_format_options with element=&lt;kind> lists them); objects merge key by key, null resets |
| `image_base64` | string |  |  | PNG, JPEG, GIF or WebP as base64, 2 MB at most; never an address |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `update_slicer`

*Update a slicer*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `elements`, `layout`, `mutate`

Change a slicer: its filter's name and default value (clear_default drops
it), and how it draws and picks values (variant, range or date style,
single, multi or ctrl selection, Apply button, sort, hidden values,
show_in_filter_bar). Its look goes with format_slicer.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `name` | string |  |  | Filter name |
| `variant` | "dropdown" \| "list" \| "buttons" \| "input" |  |  | List filters only |
| `range_style` | "between" \| "slider" |  |  |  |
| `date_style` | "relative" \| "between" |  |  |  |
| `selection` | "multi" \| "single" \| "ctrl" |  |  | single, multi or ctrl (one per click, more with Ctrl) |
| `apply_button` | boolean |  |  | Wait for Apply |
| `sort` | "asc" \| "desc" |  |  |  |
| `hidden_values` | lista |  |  | Values left out |
| `show_in_filter_bar` | boolean |  |  |  |
| `default_value` | cualquiera |  |  | Default: a list of values (list), [min, max] (range), or a time range such as 'Last month' (time); null clears it |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Object id from get_report_structure, or a chart id |
| `clear_default` | boolean |  | `false` | Drop the default value |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

## Informe: interactividad

### `clear_drillthrough_page`

*Clear a drill through page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Stop a page being a drill through target.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1}}
```

### `create_bookmark`

*Create a bookmark*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Add a bookmark, a saved view of the report as in Power BI: a page, filter
and slicer selections (others keep their defaults; cross-filters are
cleared when it is applied) and which charts and elements show. options
choose what it brings back (data, display, page). A button goes to it with
add_element or update_element: action {type: bookmark, bookmarkId}.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `name` | string | sí |  |  |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them); the first page by default |
| `filters` | objeto |  |  | Filter values by filter id or name: a list of values for list filters, [min, max] for ranges, a time range ('Last month') for time filters; null clears the filter. Others keep their default values |
| `hidden` | lista de integer o string |  |  | Objects the bookmark hides |
| `shown` | lista de integer o string |  |  | Objects the bookmark shows |
| `options` | objeto |  |  | What it brings back; everything by default |

Ejemplo:

```json
{"request": {"dashboard": 1, "name": "Ventas"}}
```

### `delete_bookmark`

*Delete a bookmark*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Delete a bookmark. Buttons and chart links that went to it are named in
the warnings: point them elsewhere with update_element or format_visual.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `bookmark` | string | sí |  | Bookmark id or name (list_bookmarks lists them) |

Ejemplo:

```json
{"request": {"dashboard": 1, "bookmark": "…"}}
```

### `get_filter_defaults`

*Get the filter defaults*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`, `interactivity`, `layout`

The values "Reset filters" brings a report back to: each filter and
slicer with its default value (null: none), its filter bar level and the
query filters the default applies. Reset also clears every cross-filter,
leaves a drill through and drops what bookmarks showed or hid.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `list_bookmarks`

*List the bookmarks*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`, `interactivity`, `layout`

The bookmarks of a report, in order: name, page, what each brings back
(options), its filter selections and the objects it hides.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `make_tooltip_page`

*Make a tooltip page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Make a page a tooltip, as in Power BI: viewers never see it in the tabs;
it shows, at this size in cells from its top left corner and filtered to
the mark, over the marks of the charts that use it (set_visual_tooltip).
columns are the fields it is made for: charts on Auto use the tooltip
page whose fields they have. enabled=false makes it a normal page again.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |
| `enabled` | boolean |  | `true` | false makes it a normal page again |
| `width` | integer |  |  | Tooltip width in cells (10 by default) |
| `height` | integer |  |  | Tooltip height in cells (8 by default) |
| `columns` | lista de string |  |  | Dataset columns of the report's charts it is made for; Auto charts match on them |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1}}
```

### `set_drillthrough_page`

*Set a drill through page*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Make a page a drill through target, as in Power BI: on another page,
right-clicking a data point and choosing "Drill through" opens this page
filtered to the point's values of these columns (only the charts whose
dataset has them).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string | sí |  | Page id, name or position from 1 (get_report_structure lists them) |
| `columns` | lista de string | sí |  | Dataset columns of the report's charts a data point passes to this page when drilled |

Ejemplo:

```json
{"request": {"dashboard": 1, "page": 1, "columns": []}}
```

### `set_filter_bar_auto_apply`

*Set whether filters apply at once*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Choose whether the filters of a report apply as soon as a viewer changes
them (true, the default of AuraData BI) or wait for the Apply button of
the filter bar (false). Filter levels (all pages, this page, visuals) are
set with manage_native_filters (scope_level, scope_pages).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `auto_apply` | boolean | sí |  | Filters apply as soon as they change (true) or on Apply (false) |

Ejemplo:

```json
{"request": {"dashboard": 1, "auto_apply": true}}
```

### `set_visual_interactions`

*Set visual interactions*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

"Edit interactions", as in Power BI: whether a chart's cross-filters
(clicking its marks) filter each other chart ("filter") or leave it alone
("none"). Charts cannot highlight one another, so there is no third mode.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `source` | integer o string | sí |  | Chart whose cross-filters change; Object id from get_report_structure, or a chart id |
| `interactions` | lista de objeto | sí |  |  |

Ejemplo:

```json
{"request": {"dashboard": 1, "source": 1, "interactions": []}}
```

### `set_visual_tooltip`

*Set the tooltip of a visual*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Choose the tooltip of a chart's marks: default (the chart's own), auto
(the tooltip page whose fields the chart uses) or page (a given tooltip
page, see make_tooltip_page).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | A chart; Object id from get_report_structure, or a chart id |
| `mode` | "default" \| "auto" \| "page" | sí |  | default: the chart's own tooltip; auto: the tooltip page with its fields; page: the given tooltip page |
| `page` | integer o string |  |  | Tooltip page for mode page |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1, "mode": "default"}}
```

### `sync_slicer`

*Sync a slicer across pages*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

"Sync slicers", as in Power BI, for a canvas slicer: filter_pages are the
pages whose charts it filters (its filter's scope; all of them is the
whole report) and visible_pages the pages that show it (a copy of the
slicer on each, sharing its selection; copies on other pages go). Both
are saved together.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | The slicer (canvas filter element) |
| `filter_pages` | lista de integer o string |  |  | Pages whose charts the slicer filters (all = the report) |
| `visible_pages` | lista de integer o string |  |  | Pages that show the slicer; copies come and go, its own page always keeps it |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

### `update_bookmark`

*Update a bookmark*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `interactivity`, `layout`, `mutate`

Change a bookmark: its name, page, options, filter selections (merged
over the saved ones; reset_filters starts from the filter defaults), the
objects it hides or shows, or its place in the list.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `bookmark` | string | sí |  | Bookmark id or name (list_bookmarks lists them) |
| `name` | string |  |  |  |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them) |
| `filters` | objeto |  |  | Filter values by filter id or name: a list of values for list filters, [min, max] for ranges, a time range ('Last month') for time filters; null clears the filter. Merged over the saved selections |
| `reset_filters` | boolean |  | `false` | Start the selections again from the filter defaults |
| `hidden` | lista de integer o string |  |  |  |
| `shown` | lista de integer o string |  |  |  |
| `options` | objeto |  |  |  |
| `position` | integer |  |  | New place in the bookmark list, from 1 |

Ejemplo:

```json
{"request": {"dashboard": 1, "bookmark": "…"}}
```

## Informe: diseño móvil

### `clear_mobile_layout`

*Clear a mobile layout*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mobile`, `mutate`

Remove the phone layout of a report page: phones show its scaled canvas.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them); the first by default |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `generate_mobile_layout`

*Generate a mobile layout*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mobile`, `mutate`

Propose the phone layout of a report page from its canvas: cards and
slicers first (small cards two per row), then charts in reading order at
full width, text boxes kept before what followed them, hidden objects left
out. Returns the boxes; pass apply=true to save them as the page's mobile
layout. Look at it with get_dashboard_screenshot(device='phone').

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them); the first by default |
| `apply` | boolean |  | `false` | Save the proposal as the page's mobile layout (false: only return it) |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `set_mobile_layout`

*Set a mobile layout*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `layout`, `mobile`, `mutate`

Set the phone layout of a report page with explicit boxes, back to front,
in cells of a phone page 12 cells wide. Every object must be on that page
and appear once; objects left out do not show on phones. Boxes past the
phone page are fitted, with a warning.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (get_report_structure lists them); the first by default |
| `items` | lista de objeto | sí |  | Boxes back to front, in cells of 32 px on a phone page 12 cells wide. Objects left out do not show on phones |

Ejemplo:

```json
{"request": {"dashboard": 1, "items": []}}
```

## Capturas y exportación

### `export_dashboard_image`

*Export dashboard image*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `sharing`

Export a report as a PNG, as the web's Export does: one page, or with
all_pages every page viewers see (one under another), each at the full
size of its canvas (1920 x 1088 px for 16:9). Hidden and tooltip pages are
left out unless named. At most 10 pages and 20 MB per export.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (a hidden page too); the first visible page by default |
| `all_pages` | boolean |  | `false` | Every page viewers see, in order (hidden and tooltip pages left out); not with page |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `export_dashboard_pdf`

*Export dashboard PDF*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `sharing`

Export a report as a PDF, as the web's Export does: one PDF page per
report page, of the size of its canvas, in page order. One page, or with
all_pages every page viewers see; hidden and tooltip pages are left out
unless named. At most 10 pages and 20 MB per export. The file comes as an
embedded resource (application/pdf, base64).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1 (a hidden page too); the first visible page by default |
| `all_pages` | boolean |  | `false` | Every page viewers see, in order (hidden and tooltip pages left out); not with page |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `get_dashboard_screenshot`

*Get dashboard screenshot*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `layout`

Take a picture of a page of a report as viewers see it (JPEG, at most
1600 px on a side), to check the layout and format after changing them.
device='phone' shows it on a 393 pt wide phone: its mobile layout, or the
canvas scaled to the width when the page has none.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1; the first by default |
| `device` | "desktop" \| "phone" |  | `"desktop"` | phone: a 393 pt wide screen, as a phone viewer sees the page (its mobile layout, or the canvas scaled to the width) |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `get_visual_screenshot`

*Get visual screenshot*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `layout`

Take a picture of one chart as it shows on its report page, with the
report's format (JPEG, at most 1600 px on a side).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `object` | integer o string | sí |  | Chart object id from get_report_structure, or a chart id |

Ejemplo:

```json
{"request": {"dashboard": 1, "object": 1}}
```

## Publicar y compartir

### `publish_dashboard`

*Publish dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

Publish a report (published=true) so its viewers open it, or turn it back
into a draft (published=false), which only its editors, Admins and the
contributors and admins of its workspace open. Same rule as the web:
whoever edits the report publishes it.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `published` | boolean |  | `true` | true publishes the report, false turns it into a draft |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

### `share_dashboard`

*Share dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

The link to send for a report and who can open it: published or draft,
its editors and viewers, its workspace (when you belong to it), plus the
tools that give more people access. With page, the link is a permanent
link that opens on that page.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `page` | integer o string |  |  | Page id, name or position from 1: the link opens on that page. Without it the link opens the report on its first page. |

Ejemplo:

```json
{"request": {"dashboard": 1}}
```

## Informes y alertas programados

### `create_alert`

*Create alert*

- **Permiso:** `ReportSchedule`, escritura. Scope de la clave: `superset:report:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

Create an alert: on its schedule, run one SQL query that returns a single
value on a database, and when the condition holds email a picture or PDF
of the dashboard (or a page) to the addresses the user gives. The query
may only read tables you can read. Same executor rule as create_report.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `page` | integer o string |  |  | Only this page (id, name or position from 1); the whole report by default |
| `crontab` | string | sí |  | When it runs, as a cron expression: '0 8 * * 1' (Mon 8:00) |
| `timezone` | string |  |  | Time zone of the crontab: UTC |
| `recipients` | lista de string | sí |  | Email addresses that receive it, exactly as the user gave them; never make one up. Ask the user when they gave none. |
| `format` | "PNG" \| "PDF" |  |  | What the email carries: a picture (PNG) or a PDF |
| `email_subject` | string |  |  |  |
| `description` | string |  |  |  |
| `active` | boolean |  |  | false pauses it |
| `name` | string | sí |  |  |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |
| `database` | integer | sí |  | Database the alert's query runs on |
| `sql` | string | sí |  | One SELECT that returns a single value |
| `condition` | objeto | sí |  |  |

Ejemplo:

```json
{"request": {"crontab": "…", "recipients": [], "name": "Ventas", "dashboard": 1, "database": 1, "sql": "…", "condition": {}}}
```

### `create_report`

*Create scheduled report*

- **Permiso:** `ReportSchedule`, escritura. Scope de la clave: `superset:report:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

Schedule a report: email a picture (PNG) or a PDF of a dashboard, or of one
of its pages, to the addresses the user gives, on a cron schedule. It runs
as you (its editor): on a draft dashboard that only works while you can
open it, so publishing the dashboard is safer. Says whether emails are
only logged (dry run). Never invent recipients.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `page` | integer o string |  |  | Only this page (id, name or position from 1); the whole report by default |
| `crontab` | string | sí |  | When it runs, as a cron expression: '0 8 * * 1' (Mon 8:00) |
| `timezone` | string |  |  | Time zone of the crontab: UTC |
| `recipients` | lista de string | sí |  | Email addresses that receive it, exactly as the user gave them; never make one up. Ask the user when they gave none. |
| `format` | "PNG" \| "PDF" |  |  | What the email carries: a picture (PNG) or a PDF |
| `email_subject` | string |  |  |  |
| `description` | string |  |  |  |
| `active` | boolean |  |  | false pauses it |
| `name` | string | sí |  |  |
| `dashboard` | integer o string | sí |  | Dashboard id, uuid or slug |

Ejemplo:

```json
{"request": {"crontab": "…", "recipients": [], "name": "Ventas", "dashboard": 1}}
```

### `delete_report`

*Delete scheduled report*

- **Permiso:** `ReportSchedule`, escritura. Scope de la clave: `superset:report:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

Delete a scheduled report or alert for good (it has no trash). Only its
editors and Admins delete it. Confirm with the user before calling.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `report` | integer | sí |  | Report or alert id (list_reports) |

Ejemplo:

```json
{"request": {"report": 1}}
```

### `get_report_info`

*Get report info*

- **Permiso:** `ReportSchedule`, lectura. Scope de la clave: `superset:report:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get alert or report schedule metadata by numeric ID.

Returns schedule configuration including type (Alert/Report), active
status, cron expression, and associated dashboard or chart.

IMPORTANT FOR LLM CLIENTS:
- Use numeric ID (e.g., 123)
- To find a report ID, use the list_reports tool first
- Editor/access-list details are excluded by privacy controls

Example usage:
```json
{
    "identifier": 1
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `refresh_metadata` | boolean |  | `false` | Refresh metadata cache for schema changes |
| `identifier` | integer | sí |  | Report/Alert numeric ID |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `list_reports`

*List reports*

- **Permiso:** `ReportSchedule`, lectura. Scope de la clave: `superset:report:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List alerts and reports with filtering and search.

Returns schedule metadata including name, type (Alert/Report), active
status, and cron expression.

Sortable columns for order_column: id, name, type, active, last_eval_dttm,
changed_on, created_on

Ejemplo:

```json
{"request": {}}
```

### `update_report`

*Update scheduled report*

- **Permiso:** `ReportSchedule`, escritura. Scope de la clave: `superset:report:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`, `sharing`

Change a scheduled report or alert: only the fields given (schedule,
recipients the user gives, page, format, active to pause or resume, and
for alerts the query and condition). Afterwards it runs as you, so the
executor rule is checked again. Only its editors and Admins change it.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `page` | integer o string |  |  | Only this page (id, name or position from 1); the whole report by default |
| `crontab` | string |  |  | When it runs, as a cron expression: '0 8 * * 1' (Mon 8:00) |
| `timezone` | string |  |  | Time zone of the crontab: UTC |
| `recipients` | lista de string |  |  | Email addresses that receive it, exactly as the user gave them; never make one up. Ask the user when they gave none. |
| `format` | "PNG" \| "PDF" |  |  | What the email carries: a picture (PNG) or a PDF |
| `email_subject` | string |  |  |  |
| `description` | string |  |  |  |
| `active` | boolean |  |  | false pauses it |
| `report` | integer | sí |  | Report or alert id (list_reports) |
| `name` | string |  |  |  |
| `sql` | string |  |  | Alerts only |
| `condition` | objeto |  |  | Alerts only |

Ejemplo:

```json
{"request": {"report": 1}}
```

## Papelera e historial de versiones

### `get_version_diff`

*Get version diff*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `history`

What one version of a dashboard, chart or dataset changed.

Returns the field changes of that save (kind, operation, path, before
and after), the records the history panel of the web shows. Give the
version by version_uuid or version_number from list_versions.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `entity_type` | "dashboard" \| "chart" \| "dataset" | sí |  |  |
| `identifier` | integer o string | sí |  | ID or UUID |
| `version_uuid` | string |  |  | From list_versions |
| `version_number` | integer |  |  | Or its number |

Ejemplo:

```json
{"request": {"entity_type": "dashboard", "identifier": 1}}
```

### `list_trash`

*List trash*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `history`

List deleted dashboards, charts and datasets you can restore.

With workspace_id: the trash of that workspace page (its deleted
dashboards; contributors and admins only, viewers get Forbidden). Without
it: the trash of Administration, everything for Superset admins and what
you edit for others. Restore with the item's restore_tool;
blocked_by says why a dashboard can't come back yet.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `workspace_id` | integer |  |  | Workspace whose deleted dashboards to list (contributors and admins of it). Omit for the whole trash: everything for Superset admins, what they edit for others |
| `entity_types` | lista de "dashboard" \| "chart" \| "dataset" |  |  | Without workspace_id: kinds to list (default all) |
| `limit` | integer |  | `50` | Most per kind |

Ejemplo:

```json
{"request": {}}
```

### `list_versions`

*List versions*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`, `history`

List the saved versions of a dashboard, chart or dataset, newest first.

Each save is a version; the history of the web shows the same. Its
editors and the contributors and admins of its workspace read it.
Read one version's changes with get_version_diff; go back with
restore_version.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `entity_type` | "dashboard" \| "chart" \| "dataset" | sí |  |  |
| `identifier` | integer o string | sí |  | ID or UUID |
| `limit` | integer |  | `50` | Newest versions to return |

Ejemplo:

```json
{"request": {"entity_type": "dashboard", "identifier": 1}}
```

### `restore_version`

*Restore version*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `history`, `mutate`

Bring a dashboard, chart or dataset back to one of its versions.

The restore is itself a new version, so it can be undone the same way.
Who can edit it can restore it (its editors and the contributors and
admins of its workspace). A dashboard version brings back its charts
too, unless one now belongs to another dashboard or uses a dataset of
another workspace. Unsaved changes in an open editor are not kept.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `entity_type` | "dashboard" \| "chart" \| "dataset" | sí |  |  |
| `identifier` | integer o string | sí |  | ID or UUID |
| `version_uuid` | string |  |  | From list_versions |
| `version_number` | integer |  |  | Or its number |

Ejemplo:

```json
{"request": {"entity_type": "dashboard", "identifier": 1}}
```

## Tableros (herramientas de Superset)

### `add_chart_to_existing_dashboard`

*Add chart to dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add chart to existing dashboard. The chart takes 12 x 12 cells at the
first free cell of its page (of ``target_tab``, or the first page); move
or resize it later with place_object and the other layout tools.
Returns updated dashboard info.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer | sí |  | ID of the dashboard to add the chart to |
| `chart_id` | integer | sí |  | ID of the chart to add to the dashboard |
| `target_tab` | string |  |  | Tab to place the chart in. Accepts a tab display name (e.g. 'Sales') or a tab component ID (e.g. 'TAB-abc123'). Display-name matching is case-insensitive and strips all emoji; component ID matching is case-sensitive and exact. When not found, the error response lists all available tab names. When omitted on a tabbed dashboard the chart is placed in the first tab. |

Ejemplo:

```json
{"request": {"dashboard_id": 1, "chart_id": 1}}
```

### `delete_dashboard`

*Delete dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Delete a dashboard.

Identify the dashboard by numeric ID, UUID string, or slug. When the
``SOFT_DELETE`` feature flag is enabled the dashboard is moved to trash and
can be restored by an owner or Admin; otherwise the delete is permanent and
cannot be undone. The ``soft_deleted`` response field reports which
happened. It removes the dashboard container only — the charts on it are
NOT deleted. The caller must be an editor of the dashboard (owners and
Admins qualify); dashboards with attached alerts/reports cannot be
deleted until those are removed.

Example:
```json
{"identifier": 42}
```

Returns success with the deleted dashboard's id/title, or an error. When the
caller lacks permission, ``permission_denied`` is true — do not retry; ask
the user.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard identifier - numeric ID, UUID string, or slug. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `duplicate_dashboard`

*Duplicate dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Duplicate an existing dashboard under a new title.

AuraData BI charts belong to one dashboard, so the copy always gets
its own copies of the charts: edits to them never affect the
originals. The copy goes into the source's workspace; a contributor
or admin of that workspace who is not an editor of the source gets a
copy that keeps the source's editors and viewers instead of becoming
its editor.

The source dashboard can be identified by numeric ID, UUID, or slug.
Returns the new dashboard's ID, title, and URL.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer o string | sí |  | Source dashboard identifier - can be numeric ID, UUID string, or slug |
| `dashboard_title` | string | sí |  | Title for the new (duplicated) dashboard |
| `duplicate_slices` | boolean |  | `false` | When true, every chart on the source dashboard is deep-copied into a new chart object owned by the caller. AuraData BI charts belong to one dashboard, so while that rule is on (AURADATA_SINGLE_DASHBOARD_CHARTS) the charts are always copied, whatever this says; with the rule off, false (default) makes the new dashboard reference the same charts as the source. |

Ejemplo:

```json
{"request": {"dashboard_id": 1, "dashboard_title": "…"}}
```

### `generate_dashboard`

*Create dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Create a NEW dashboard from chart IDs.

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

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `chart_ids` | lista de integer |  |  | Chart IDs to include in the dashboard. Leave empty to start an empty report and add its charts with create_visual. |
| `workspace_id` | integer |  |  | Workspace to create the dashboard in (you must be a contributor or admin of it). Its charts may then use the workspace's datasets; outside a workspace they only use shared ones. |
| `dashboard_title` | string |  |  | Title for the new dashboard. When omitted a descriptive title is generated from the included chart names. |
| `description` | string |  |  | Description for the dashboard |
| `published` | boolean |  | `false` | Whether to publish the dashboard |
| `slug` | string |  |  | Optional URL slug for the dashboard. When set, the dashboard is reachable at /dashboard/&lt;slug>/ instead of /dashboard/&lt;id>/. Must be unique across the instance. |
| `position_json` | objeto |  |  | Optional explicit dashboard layout (Superset's position_json dict). When set, replaces the auto-generated layout entirely. Pass this when you need custom row composition, MARKDOWN blocks, HEADER components, or specific chart widths/heights. Omit to let the tool auto-generate a packed grid from chart_ids. |
| `json_metadata_overrides` | objeto |  |  | Optional overrides applied on top of the default json_metadata. Common fields: label_colors (per-series brand palette, e.g. {'Electronics': '#4C78A8'}), color_scheme (named Superset palette), cross_filters_enabled (bool, default True as in the editor; False turns cross-filters off), shared_label_colors (list of label names for cross-chart color consistency). Merged shallowly into the defaults; pass only the keys you want to override. |
| `css` | string |  |  | Optional dashboard-level CSS. Useful for hiding chart chrome (kebab menus, cross-filter chips) on print-ready dashboards, or tweaking padding/typography. Applied as-is to the dashboard's css field. |

Ejemplo:

```json
{"request": {}}
```

### `get_dashboard_datasets`

*Get dashboard datasets*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List the datasets and semantic views used by a dashboard's charts.

Look up the dashboard by ID, UUID, or slug. Each entry's datasource_type
distinguishes a table from a semantic_view, and name is its display name.
Views include semantic_layer (uuid, name), with table_name, schema and database
set to null.

Each dataset includes its table name, schema, database connection
(id, name, backend), columns (name, type, is_dttm, verbose_name) and
metrics (name, expression, verbose_name). Use this to understand which
columns and metrics are available before configuring native filters or
analyzing a dashboard's data model.

Datasets the current user cannot access, or whose semantic provider metadata
cannot be loaded, are excluded and reported via inaccessible_dataset_count.
Provider failures are logged. Column and metric lists are
capped per dataset; when truncated, columns_truncated/metrics_truncated
are set and total counts are reported.

Requires data-model metadata permission (same as the dataset tools); a
dashboard-only viewer without that permission receives a structured
privacy denial.

Example usage:
```json
{
    "identifier": 123
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard identifier - can be numeric ID, UUID string, or slug |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_dashboard_info`

*Get dashboard info*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get dashboard metadata by ID, UUID, slug, or dashboard permalink.

Returns title, charts, and layout details.

Before answering about a filtered dashboard, supply its permalink_key or
filter_state to this tool and use the returned filter_state as context.
Restricted users receive native_filter_values (names, types, selected values,
labels and exclusion flags), not raw dataMask or column targets. Check
native_filter_values_incomplete: unsupported filters and chart state cannot
be summarized safely. Missing state is not evidence of no filters.
These are snapshot values, not automatically enforced query predicates.
Respect filter scope; do not guess columns or query workspace-wide data when
the available context is insufficient. Ask for clarification instead.

For dashboards with many charts or native filters, the ``charts`` and
``native_filters`` lists may be capped below their true size (see
``chart_count`` for the real total, and ``_truncation_notes`` in the
response when truncation occurred). To retrieve the complete list of
charts on a large dashboard regardless of size, call ``list_charts``
with ``filters=[{"col": "dashboards", "opr": "eq", "value": <dashboard
id>}]`` and page through the results using ``page``/``page_size``.

If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
response includes the dashboard ID plus active tab and filter state.

Example usage:
```json
{
    "identifier": 123
}
```

With permalink (filter state from URL):
```json
{
    "permalink_key": "abc123def456"
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `refresh_metadata` | boolean |  | `false` | Refresh metadata cache for schema changes |
| `identifier` | integer o string |  |  | Dashboard ID, UUID, slug, bare permalink key, or a shared URL containing /superset/dashboard/p/&lt;key>/. Omit when permalink_key is provided. |
| `permalink_key` | string |  |  | Key from a shared dashboard URL such as '/superset/dashboard/p/&lt;key>/'. Resolves the dashboard and returns the shared active-tab and filter context; no identifier is required. |
| `filter_state` | objeto |  |  | Active filters supplied directly rather than via a permalink, so the tool can describe the dashboard as the user currently views it, filtered. Accepts dashboard dataMask state, e.g. {"dataMask": {"&lt;configured filter ID>": {"filterState": {"value": ["EMEA"]}}}}, or {"applied_filters": [{"col": "region", "op": "IN", "val": ["EMEA"]}]}. Native mask values are projected without column metadata for restricted users. Ignored when permalink_key is provided. |
| `select_columns` | lista de string |  |  | Top-level fields to include in the response. Defaults to a lean set that excludes 'css' (raw CSS, can be many KB) and 'filter_state' (only relevant when permalink_key is provided). Pass an explicit list to override, e.g. ['id','dashboard_title','charts'] for minimal output, or add 'css' to include raw dashboard CSS. |

Ejemplo:

```json
{"request": {}}
```

### `get_dashboard_layout`

*Get dashboard layout*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get parsed dashboard layout by ID, UUID, slug, or dashboard permalink.

Returns the tabs and chart positions extracted from the dashboard's
position_json. get_dashboard_info omits position_json to keep responses
small; call this tool when you need the structured layout (e.g. to
explain which charts live under which tab, or to locate a chart by
its parent tab).

If the user gives you a shared URL containing ``/dashboard/p/<key>/``, pass
the URL or bare key as ``identifier`` (or use ``permalink_key`` alone). The
response identifies the active tab and includes the shared filter state.

Example usage:
```json
{
    "identifier": 123
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string |  |  | Dashboard ID, UUID, slug, bare permalink key, or a shared URL containing /superset/dashboard/p/&lt;key>/. Omit when permalink_key is provided. |
| `permalink_key` | string |  |  | Key from a shared dashboard URL such as '/superset/dashboard/p/&lt;key>/'. Resolves the dashboard and includes the shared active-tab and filter context in the layout response. |

Ejemplo:

```json
{"request": {}}
```

### `list_dashboards`

*List dashboards*

- **Permiso:** `Dashboard`, lectura. Scope de la clave: `superset:dashboard:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List dashboards with filtering and search. Returns dashboard metadata
including title, slug, URL, and last modified time. Use select_columns to
request additional fields.

**IMPORTANT**: All parameters must be wrapped in a ``request`` object.
Do NOT pass ``search``, ``page``, ``page_size``, etc. as top-level
keyword arguments — they will be rejected. Use the ``request`` wrapper::

    # Correct usage
    list_dashboards(request={"search": "sales", "page": 1, "page_size": 10})
    list_dashboards(request={"filters": [{"col": "dashboard_title", "opr": "sw", "value": "exec"}]})
    list_dashboards()  # no arguments returns first page with defaults

    # Wrong — causes pydantic validation errors
    list_dashboards(search="sales", page=1)  # DO NOT DO THIS

Valid filter columns for ``filters[].col``:
    ``dashboard_title``, ``published``, ``editor``, ``favorite``,
    ``created_by_fk``, ``changed_by_fk``

Sortable columns for ``order_column``:
    ``id``, ``dashboard_title``, ``slug``, ``published``,
    ``changed_on``, ``changed_on_delta_humanized`` (alias for ``changed_on``),
    ``created_on``

To filter by a person (e.g. "dashboards Maxime is working on"), do NOT pass
the name as the search parameter — search matches titles and slugs only.
Instead, call find_users to resolve the name to a user ID, then pass it as
a filter: filters=[{"col": "created_by_fk", "opr": "eq", "value": <id>}]
(or "changed_by_fk" for "last modified by").

Ejemplo:

```json
{"request": {}}
```

### `manage_dashboard_certification`

*Manage dashboard certification*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Set or clear a dashboard's certification badge.

``certified_by`` and ``certification_details`` are independent optional
fields: omit (None) to leave a field unchanged, pass an empty string to
clear it, or pass a value to set it. Certification surfaces as a badge
next to the dashboard title in the UI.

Externally managed dashboards refuse set/clear — the response carries
``managed_externally=True``; the refusal is structural (the badge is
owned by the external system), so granting permissions cannot resolve
it and the call should not be retried. The no-field inspect call
still returns current values for such dashboards.

Example::

    manage_dashboard_certification(request={
        "identifier": 42,
        "certified_by": "Data Platform Team",
        "certification_details": "Verified against source-of-truth metrics.",
    })

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard ID (integer), UUID, or slug. Same identifier shape accepted by ``get_dashboard_info``. |
| `certified_by` | string |  |  | Person or team certifying this dashboard. Pass an empty string to clear. Omit (None) to leave unchanged. |
| `certification_details` | string |  |  | Details of the certification (why/how it was certified). Pass an empty string to clear. Omit (None) to leave unchanged. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `manage_dashboard_owners`

*Manage dashboard owners*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add or remove dashboard owners with explicit, safe operations.

Owners can edit the dashboard, manage its charts, and delete it. Unlike
``update_dashboard``'s dropped ``owners`` field, this tool never accepts
a full-replacement list — only ``add_owner_ids``/``remove_owner_ids`` —
and rejects any change that would leave the dashboard with zero owners.

Owners are the USER-type entries in the dashboard's Subject-based
``editors`` list. Any ROLE- or GROUP-type editors already on the
dashboard are left untouched.

A non-admin caller who removes themselves is automatically re-added
(mirrors the same self-protection ``update_dashboard``'s editorship
check relies on) unless an ``EXTRA_EDITORS_RESOLVER`` is configured on
the instance; the response's ``warnings`` reports when this happens.

Privacy: the returned ``owners`` list is sanctioned only as confirmation
of the add/remove operation the caller explicitly requested on this
dashboard. Do not use it to answer "who owns X" for a dashboard the
caller did not ask to modify, and do not call this tool merely to look
up current owners — those remain off-limits per the server instructions.
A request that has no effective change (e.g. "adding" an ID that is
already an owner) returns an empty ``owners`` list rather than the full
current set, so this tool cannot be used as a disguised directory
lookup.

Example::

    manage_dashboard_owners(request={
        "identifier": 42,
        "add_owner_ids": [7],
        "remove_owner_ids": [3],
    })

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard ID (integer), UUID, or slug. Same identifier shape accepted by ``get_dashboard_info``. |
| `add_owner_ids` | lista de integer |  |  | User IDs to add as dashboard owners. Discover IDs with ``find_users``. |
| `remove_owner_ids` | lista de integer |  |  | User IDs to remove from dashboard owners. Rejected if it would leave the dashboard with zero owners, or if an ID is not currently an owner. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `manage_dashboard_roles`

*Manage dashboard access roles*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add or remove dashboard access roles with explicit operations.

Dashboard access roles restrict who can view a dashboard to members of
the listed roles, on top of normal Superset permissions. An empty roles
list means "no role restriction" — the dashboard is visible per standard
permissions instead. This only takes effect when the ``ENABLE_VIEWERS``
feature flag is enabled; the response's ``viewers_enabled`` field
reports whether it is, and ``warnings`` notes when a change was applied
but has no live effect.

Roles are the ROLE-type entries in the dashboard's Subject-based
``viewers`` list. Any USER- or GROUP-type viewers already on the
dashboard are left untouched.

Unlike ``update_dashboard``'s dropped ``roles`` field, this tool never
accepts a full-replacement list — only
``add_role_ids``/``remove_role_ids``.

Privacy: the returned ``roles`` list is sanctioned only as confirmation
of the add/remove operation the caller explicitly requested on this
dashboard. Do not use it to answer "who can access X" for a dashboard
the caller did not ask to modify, and do not call this tool merely to
look up current roles — those remain off-limits per the server
instructions. A request that has no effective change (e.g. "adding" a
role that is already assigned) returns an empty ``roles`` list rather
than the full current set, so this tool cannot be used as a disguised
directory lookup.

Example::

    manage_dashboard_roles(request={
        "identifier": 42,
        "add_role_ids": [5],
    })

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard ID (integer), UUID, or slug. Same identifier shape accepted by ``get_dashboard_info``. |
| `add_role_ids` | lista de integer |  |  | Role IDs to grant dashboard access to. Discover IDs with ``list_roles``. |
| `remove_role_ids` | lista de integer |  |  | Role IDs to revoke dashboard access from. Rejected if an ID is not currently assigned to the dashboard. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `manage_native_filters`

*Manage dashboard native filters*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add, update, remove, and reorder native filters on a dashboard.

Supported filter types for new filters: filter_select (dropdown backed
by a dataset column) and filter_time (time range). scope_level puts a
filter in a section of the filter bar: all pages (report), some pages
(page, with scope_pages) or some charts (visual, with scope_chart_ids).
Other filter types (numerical range, time column, time grain) are not
yet supported.
Filter IDs are generated by the server and returned in the response.

Concurrency note: the filter-list snapshot used for validation is read
outside the DAO write transaction.  A ``reorder`` that is valid against
the snapshot can silently drop a filter added by a concurrent writer
between the snapshot read and the write commit.  This mirrors existing
REST write behaviour; callers that expect concurrent edits should
re-read the filter list and retry if the returned filter set differs
from what was requested.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer | sí |  | ID of the dashboard to modify |
| `add` | lista de objeto |  |  | New filters to create. Supported types: filter_select (dropdown) and filter_time (time range). Other filter types (numerical range, time column, time grain) are not yet supported by this tool. |
| `update` | lista de objeto |  |  | Partial updates to existing filters, addressed by filter ID |
| `remove` | lista de string |  |  | IDs of filters to delete from the dashboard |
| `reorder` | lista de string |  |  | Complete ordered list of filter IDs defining the new filter order. Must include every filter that remains on the dashboard (after removals); newly added filters are appended automatically and may be omitted. |

Ejemplo:

```json
{"request": {"dashboard_id": 1}}
```

### `remove_chart_from_dashboard`

*Remove chart from dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Remove a chart from an existing dashboard.

Deletes the chart's layout component(s) from the dashboard (all
occurrences, including under tabs), prunes rows/columns left empty by
the removal, detaches the chart from the dashboard, and cleans stale
chart references from dashboard metadata (expanded_slices,
timed_refresh_immune_slices, filter_scopes, default_filters). The chart
itself is NOT deleted and remains available to other dashboards.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dashboard_id` | integer | sí |  | ID of the dashboard to remove the chart from |
| `chart_id` | integer | sí |  | ID of the chart to remove from the dashboard |

Ejemplo:

```json
{"request": {"dashboard_id": 1, "chart_id": 1}}
```

### `restore_dashboard`

*Restore dashboard*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Restore a soft-deleted dashboard from trash.

Identify the dashboard by numeric ID or UUID string (slug lookup does not
cover trashed dashboards). Only dashboards that were soft-deleted (moved
to trash while the ``SOFT_DELETE`` feature flag was enabled) can be
restored; permanently deleted dashboards are unrecoverable. The caller
must be an editor of the dashboard (owners and Admins qualify).

Example:
```json
{"identifier": 42}
```

Returns success with the restored dashboard's id/title, or an error. When
the caller lacks permission, ``permission_denied`` is true — do not retry;
ask the user.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard identifier - numeric ID or UUID string. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `update_dashboard`

*Update dashboard layout/theme/CSS/metadata*

- **Permiso:** `Dashboard`, escritura. Scope de la clave: `superset:dashboard:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Patch an existing dashboard's layout, theme, styling, or metadata.

Companion to ``generate_dashboard`` for incremental metadata and styling
edits. An LLM can:

  - Replace ``position_json`` only when it already has the complete raw tree
  - Apply brand ``label_colors`` and ``color_scheme`` via
    ``json_metadata_overrides``
  - Inject ``css`` to hide chrome on print-ready dashboards
  - Update ``dashboard_title``, ``description``, ``slug``, ``published``
  - Replace the dashboard's ``tags`` (FULL list of IDs; find them with
    ``list_tags``)
  - Toggle ``cross_filters_enabled``, ``refresh_frequency``, or
    ``filter_bar_orientation`` via typed fields (no need to hand-build
    ``json_metadata_overrides``)

Only the fields explicitly passed are applied; other fields are left
unchanged. ``json_metadata_overrides`` is merged shallowly with the
existing json_metadata — pass only the keys you want to change. A key may
not be set via both a typed field and ``json_metadata_overrides``.

Example::

    update_dashboard(request={
        "identifier": 42,
        "tags": [3, 7],
        "refresh_frequency": 300,
        "css": ".header-controls {display: none;}",
    })

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dashboard ID (integer), UUID, or slug. Same identifier shape accepted by ``get_dashboard_info``. |
| `dashboard_title` | string |  |  | Optional new dashboard title. |
| `description` | string |  |  | Optional new dashboard description. |
| `slug` | string |  |  | Optional new URL slug. Pass empty string to clear a slug. |
| `published` | boolean |  |  | Optional published flag. |
| `position_json` | objeto |  |  | Optional replacement layout (Superset's position_json dict). When set, fully replaces the existing layout and must keep every dashboard chart reachable from ROOT_ID, with consistent children and parents. Do not use this field for incremental edits: MCP does not currently expose the complete raw layout tree needed to safely round-trip a replacement. Prefer purpose-built dashboard tools. |
| `json_metadata_overrides` | objeto |  |  | Optional overrides applied on top of the existing json_metadata. Merged shallowly — pass only the keys you want to change (e.g. label_colors, color_scheme, cross_filters_enabled). |
| `css` | string |  |  | Optional new dashboard CSS. Pass empty string to clear existing CSS. |
| `tags` | lista de integer |  |  | Optional FULL-REPLACEMENT list of tag IDs to associate with the dashboard. Discover IDs with ``list_tags``. An empty list clears all custom tags. Omit (None) to leave tags unchanged. |
| `cross_filters_enabled` | boolean |  |  | Optional toggle for dashboard-wide cross filtering. Typed convenience for the ``cross_filters_enabled`` json_metadata key. |
| `refresh_frequency` | integer |  |  | Optional auto-refresh interval in seconds (0 = off). Typed convenience for the ``refresh_frequency`` json_metadata key. |
| `filter_bar_orientation` | "VERTICAL" \| "HORIZONTAL" |  |  | Optional native filter bar orientation. Typed convenience for the ``filter_bar_orientation`` json_metadata key. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

## Gráficos (herramientas de Superset)

### `delete_chart`

*Delete chart*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Delete a saved chart.

Identify the chart by numeric ID or UUID string (NOT chart name). When the
``SOFT_DELETE`` feature flag is enabled the chart is moved to trash and can
be restored by an owner or Admin; otherwise the delete is permanent and
cannot be undone. The ``soft_deleted`` response field reports which
happened. The caller must be an editor of the chart (owners and Admins
qualify); charts with attached alerts/reports cannot be deleted until
those are removed.

Example:
```json
{"identifier": 123}
```

Returns success with the deleted chart's id/name, or an error. When the
caller lacks permission, ``permission_denied`` is true — do not retry; ask
the user.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Chart identifier - numeric ID or UUID string (charts have no slug). |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `generate_chart`

*Create chart*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Create a chart preview in Superset, optionally saving it permanently.

IMPORTANT BEHAVIOR:
- Charts are NOT saved by default (save_chart=False) - preview only
- Set save_chart=True to permanently save the chart
- LLM clients MUST display returned chart URL to users
- Use numeric dataset ID or UUID (NOT schema.table_name format)
- MUST include chart_type in config (one of: 'xy', 'table', 'pie',
  'gauge', 'treemap_v2', 'pivot_table', 'mixed_timeseries',
  'handlebars',
  'big_number', 'histogram', 'box_plot', 'waterfall',
  'point_cluster_map', 'deck_scatter', 'deck_heatmap', 'country_map',
  plus host-gated
  types returned by get_chart_type_schema such as 'interactive_pivot')

IMPORTANT: The 'chart_type' field in the config is a DISCRIMINATOR that determines
which chart configuration schema to use. It MUST be included and MUST match the
other fields in your configuration. Values such as 'line', 'bar', 'area',
and 'scatter' are 'kind' values WITHIN chart_type='xy', not chart_type
values themselves. Call get_chart_type_schema to confirm host-gated types:

- chart_type='xy' for charts with x and y axes (line, bar, area, scatter).
  Required fields: y (x is optional — defaults to dataset's primary
  datetime column). Use 'kind' to pick line/bar/area/scatter
  (default kind='line').

- chart_type='table' for tabular visualizations.
  Required fields: columns

- chart_type='pie' for pie/donut charts.
  Required fields: dimension, metric

- chart_type='pivot_table' for pivot table visualizations.
  Required fields: rows, metrics (columns is optional, for cross-tabs)

- chart_type='interactive_pivot' for an extension-provided AG Grid pivot.
  Required fields: rows, metrics (columns is optional). This is distinct
  from pivot_table/pivot_table_v2 and is rejected when its host feature is
  unavailable. Call get_chart_type_schema('interactive_pivot') first.

- chart_type='mixed_timeseries' for dual-axis time-series charts.
  Required fields: x, y (primary metrics), y_secondary (secondary metrics)

- chart_type='handlebars' for custom template-based visualizations.
  Required fields: handlebars_template

- chart_type='big_number' for single KPI metric displays.
  Required fields: metric

- chart_type='gauge' for a dial/gauge display of a metric.
  Required fields: metric; optional: groupby (one dial per value),
  min_val, max_val

- chart_type='treemap_v2' for hierarchical part-to-whole.
  Required fields: groupby (ordered hierarchy), metric

- chart_type='histogram' for value-distribution charts.
  Required fields: column (numeric); optional: bins, groupby, normalize,
  cumulative

- chart_type='box_plot' for statistical spread comparisons.
  Required fields: metrics, distribute_across (the sample axis, e.g. a
  temporal column); use dimensions to split into one box per value;
  optional whisker_type ('tukey'|'min_max'|'percentile')
- Use chart_type='waterfall' for cumulative increase/decrease breakdowns
  Required fields: x_axis, metric; optional: breakdown (single category
  column, alias: groupby), show_total
- Maps need no API key and fit their view to the points:
  chart_type='deck_scatter' (a circle per row; optional color_by, point_size),
  'point_cluster_map' (points grouped into clusters) and 'deck_heatmap'
  (density) take numeric latitude and longitude columns;
  'country_map' colors one country's regions (country, region column of
  ISO 3166-2 codes such as 'MX-QUE', metric)

Quick lookup — natural-language ask -> chart_type (+ kind if applicable):
- "bar chart" / "line chart" / "area chart" / "scatter plot"
  -> chart_type='xy', kind='bar'/'line'/'area'/'scatter'
- "pie chart" / "donut chart" -> chart_type='pie'
- "table" / "data grid" -> chart_type='table'
- "pivot table" / "cross-tab" -> chart_type='pivot_table'
- "interactive pivot" / "AG Grid pivot" -> chart_type='interactive_pivot'
  only when get_chart_type_schema confirms it is available
- "compare two metrics over time" -> chart_type='mixed_timeseries'
- "single number" / "KPI" / "scorecard" -> chart_type='big_number'
- "gauge" / "dial" / "speedometer" -> chart_type='gauge'
- "treemap" / "hierarchy" -> chart_type='treemap_v2'
- "custom HTML template" -> chart_type='handlebars'
- "histogram" / "distribution" -> chart_type='histogram'
- "box plot" / "box and whisker" -> chart_type='box_plot'
- "map" / "points on a map" -> chart_type='deck_scatter'
- "heat map of locations" -> chart_type='deck_heatmap'
- "clustered map" -> chart_type='point_cluster_map'
- "map by state" / "choropleth" -> chart_type='country_map'

Example usage for XY chart (bar/line/area/scatter):
```json
{
    "dataset_id": 123,
    "config": {
        "chart_type": "xy",
        "x": {"name": "order_date"},
        "y": [{"name": "revenue", "aggregate": "SUM"}],
        "kind": "line"
    }
}
```

Example usage for Table chart:
```json
{
    "dataset_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "config": {
        "chart_type": "table",
        "columns": [
            {"name": "product_name"},
            {"name": "quantity", "aggregate": "SUM"},
            {"name": "revenue", "aggregate": "SUM", "label": "Total Revenue"}
        ]
    }
}
```

Example usage for Pie chart:
```json
{
    "dataset_id": 123,
    "config": {
        "chart_type": "pie",
        "dimension": {"name": "product_category"},
        "metric": {"name": "revenue", "aggregate": "SUM"}
    }
}
```

Example usage with a custom SQL metric (ratios, conditional aggregations,
unit conversions). Pass 'sql_expression' instead of 'name'+'aggregate'.
A 'label' is required and serves as the metric's display name:
```json
{
    "dataset_id": 123,
    "config": {
        "chart_type": "xy",
        "x": {"name": "order_date"},
        "y": [{
            "sql_expression":
                "COUNT(CASE WHEN closed_won THEN 1 END)::numeric / "
                "NULLIF(COUNT(*), 0)",
            "label": "Win Rate"
        }],
        "kind": "line"
    }
}
```

VALIDATION:
- 5-layer pipeline: Schema, business logic, dataset, Superset compatibility, runtime
- XSS/SQL injection prevention
- Column existence validation with fuzzy match suggestions
- Aggregate function type compatibility checking

Returns:
- Chart ID and metadata (if saved)
- Preview URL and explore URL
- Detailed validation errors with suggestions

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_timeout` | integer |  |  | Cache timeout override in seconds (0 to disable) |
| `dataset_id` | integer o string | sí |  | Dataset identifier (ID, UUID) |
| `config` | objeto | sí |  | Chart configuration |
| `chart_name` | string |  |  | Auto-generates if omitted |
| `save_chart` | boolean |  | `false` | Save permanently in Superset |
| `generate_preview` | boolean |  | `true` |  |
| `preview_formats` | lista de "url" \| "ascii" \| "vega_lite" \| "table" |  |  |  |

Ejemplo:

```json
{"request": {"dataset_id": 1, "config": {}}}
```

### `get_chart_data`

*Get chart data*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`

Get chart data by ID or UUID.

Returns the actual data behind a chart for LLM analysis without image rendering.

Supports:
- Numeric ID or UUID lookup
- Multiple formats: json, csv, excel
- Cache control: use_cache, force_refresh, cache_timeout
- Optional row limit override (respects chart's configured limits)
- form_data_key: retrieves data using unsaved chart configuration from Explore

When form_data_key is provided, the tool uses the cached (unsaved) chart
configuration to query data, allowing you to get data for what the user
actually sees in the Explore view (not the saved version).

Returns underlying data in requested format with cache status.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_timeout` | integer |  |  | Cache timeout override in seconds (0 to disable) |
| `identifier` | integer o string |  |  | Chart identifier (ID, UUID). Optional when form_data_key is provided (for unsaved charts). |
| `form_data_key` | string |  |  | Cache key for retrieving unsaved chart state. When a user edits a chart in Explore but hasn't saved, the current state is stored with this key. If provided, the tool uses this configuration to query data instead of the saved chart configuration. Can be used alone (without identifier) for unsaved charts. |
| `limit` | integer |  |  | Maximum number of data rows to return. If not specified, uses the chart's configured row limit. |
| `extra_form_data` | objeto |  |  | Extra form data to merge into the chart query, typically from dashboard native filters. Format: {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]} |
| `format` | "json" \| "csv" \| "excel" |  | `"json"` | Data export format |

Ejemplo:

```json
{"request": {}}
```

### `get_chart_info`

*Get chart info*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get chart metadata by ID or UUID.

IMPORTANT FOR LLM CLIENTS:
- URL field links to the chart's explore page in Superset
- Use numeric ID or UUID string (NOT chart name)
- To find a chart ID, use the list_charts tool first
- When form_data_key is provided, returns the unsaved chart configuration
  (what the user sees in Explore) instead of the saved version

Example usage:
```json
{
    "identifier": 123
}
```

Or with UUID:
```json
{
    "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

With unsaved state (form_data_key from Explore URL):
```json
{
    "identifier": 123,
    "form_data_key": "abc123def456"
}
```

With dashboard context to resolve applied dashboard-level filters:
```json
{
    "identifier": 123,
    "dashboard_id": 45
}
```
When dashboard_id is provided, the response's filters.dashboard_filters
lists native filters (with column, operator, and value) that are in scope
for this chart on that dashboard.

Returns chart details including name, type, and URL.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string |  |  | Chart identifier - can be numeric ID or UUID string. Optional when form_data_key is provided (for unsaved charts). |
| `form_data_key` | string |  |  | Cache key for retrieving unsaved chart state. When a user edits a chart in Explore but hasn't saved, the current state is stored with this key. If provided, the tool returns the current unsaved configuration instead of the saved version. Can be used alone (without identifier) for unsaved charts. |
| `dashboard_id` | integer |  |  | When provided, resolves dashboard-level native filters that are in scope for this chart on the given dashboard and returns them under filters.dashboard_filters. Requires the chart to be on the dashboard and the caller to have dashboard access. |
| `extra_form_data` | objeto |  |  | Active dashboard filters the user currently has applied to this chart, forwarded so the response reports the chart as the user actually views it. Surfaced under filters.active_filters; this is not a query (get_chart_info returns metadata only). Format: {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]} |
| `select_columns` | lista de string |  |  | Top-level fields to include in the response. Defaults to a lean set that excludes 'form_data' (the full chart config, can be 50KB+). Add 'form_data' explicitly when you need the raw chart configuration. |

Ejemplo:

```json
{"request": {}}
```

### `get_chart_preview`

*Get chart preview*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`

Get chart preview by ID or UUID.

Returns preview URL or formatted content (ascii, table, vega_lite).

Pass extra_form_data (e.g. a dashboard's active native filters) to render
the preview over the filtered data rather than the full dataset.

When format includes 'url', the returned preview_url uses the same scheme
as the configured instance URL (HTTPS in production/staging, HTTP in local
development).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_timeout` | integer |  |  | Cache timeout override in seconds (0 to disable) |
| `identifier` | integer o string |  |  | Chart identifier (ID, UUID). Optional when form_data_key is provided (for unsaved charts). |
| `form_data_key` | string |  |  | Cache key for retrieving unsaved chart state. When a user edits a chart in Explore but hasn't saved, the current state is stored with this key. If provided, the tool renders a preview using this configuration instead of the saved chart configuration. Can be used alone (without identifier) for unsaved charts. |
| `format` | "url" \| "ascii" \| "table" \| "vega_lite" |  | `"ascii"` | Preview format: 'ascii' for text art (default), 'url' for explore link, 'table' for data table, 'vega_lite' for interactive JSON specification |
| `width` | integer |  | `800` | Preview width in pixels (for url and vega_lite formats) |
| `height` | integer |  | `600` | Preview height in pixels (for url and vega_lite formats) |
| `ascii_width` | integer |  | `80` | ASCII chart width in characters (for ascii format) |
| `ascii_height` | integer |  | `20` | ASCII chart height in lines (for ascii format) |
| `extra_form_data` | objeto |  |  | Extra form data to merge into the preview query, typically from dashboard native filters, so the preview reflects the filtered view. Format: {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]} |

Ejemplo:

```json
{"request": {}}
```

### `get_chart_sql`

*Get chart SQL*

- **Permiso:** `SQLLab`, escritura. Scope de la clave: `superset:sqllab:write`.
- **Cambia datos:** no.
- **Etiquetas:** `data`

Get the rendered SQL query for a chart without executing it.

Returns the SQL that a chart would execute, similar to the "View Query"
feature in the Superset UI. Useful for understanding, debugging, or
auditing the SQL generated by a chart's configuration.

Note: The returned SQL is RLS-scoped to the caller and contains
table/schema names. Same disclosure surface as the Superset UI
"View Query" modal. Consumers should not log or share the output
without considering data-access implications.

Supports:
- Numeric ID or UUID lookup
- form_data_key: get SQL for unsaved chart state from Explore view
- extra_form_data: preview SQL with dashboard-filter-style predicates merged
  in, same format accepted by get_chart_data

Example usage:
```json
{
    "identifier": 123
}
```

Returns the SQL query string and metadata about the chart.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string |  |  | Chart identifier - can be numeric ID or UUID string. Optional when form_data_key is provided (for unsaved charts). |
| `form_data_key` | string |  |  | Cache key for retrieving unsaved chart state. When a user edits a chart in Explore but hasn't saved, the current state is stored with this key. If provided, the tool returns the SQL for the unsaved configuration instead of the saved version. Can be used alone (without identifier) for unsaved charts. |
| `extra_form_data` | objeto |  |  | Extra form data to merge into the chart query before rendering SQL, typically from dashboard native filters. Same format accepted by get_chart_data. Format: {"filters": [{"col": "country", "op": "IN", "val": ["US"]}]} |

Ejemplo:

```json
{"request": {}}
```

### `get_chart_type_schema`

*Get chart type schema*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get the full JSON Schema and examples for a specific chart type.

Use this tool to discover the exact fields, types, and constraints
for a chart configuration before calling generate_chart or update_chart.

Valid chart_type values depend on the host deployment. Core types are xy,
table, pie, gauge, treemap_v2, pivot_table, mixed_timeseries, handlebars,
big_number, histogram, box_plot, and waterfall. Deployments that enable an
AG Grid
pivot extension also expose interactive_pivot.

Returns the JSON Schema for the requested chart type, optionally
with working examples.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `chart_type` | string | sí |  |  |
| `include_examples` | boolean |  | `true` |  |

Ejemplo:

```json
{"chart_type": "…"}
```

### `list_charts`

*List charts*

- **Permiso:** `Chart`, lectura. Scope de la clave: `superset:chart:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List charts with filtering and search.

Returns chart metadata including id, name, viz_type, URL, and last
modified time. Set ``request.certified`` to true to return only governed
charts; false returns only uncertified charts, while omitting it preserves
the unfiltered behavior.

**IMPORTANT**: All parameters must be wrapped in a ``request`` object.
Do NOT pass ``search``, ``page``, ``page_size``, etc. as top-level
keyword arguments — they will be rejected. Use the ``request`` wrapper::

    # Correct usage
    list_charts(request={"search": "revenue", "page": 1, "page_size": 10})
    list_charts(request={"filters": [{"col": "slice_name", "opr": "sw", "value": "sales"}]})
    list_charts()  # no arguments returns first page with defaults

    # Wrong — causes pydantic validation errors
    list_charts(search="revenue", page=1)  # DO NOT DO THIS

Valid filter columns for ``filters[].col``:
    ``slice_name``, ``viz_type``, ``datasource_name``, ``editor``,
    ``created_by_fk``, ``changed_by_fk``, ``dashboards``

Sortable columns for ``order_column``:
    ``id``, ``slice_name``, ``viz_type``, ``description``,
    ``changed_on``, ``changed_on_delta_humanized`` (alias for ``changed_on``),
    ``created_on``

To filter by a person, call find_users to resolve the name to a user ID,
then pass it as a filter: filters=[{"col": "created_by_fk", "opr": "eq",
"value": <id>}] (or "changed_by_fk"). Do not pass the name as search.

Ejemplo:

```json
{"request": {}}
```

### `restore_chart`

*Restore chart*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Restore a soft-deleted chart from trash.

Identify the chart by numeric ID or UUID string (NOT chart name). Only
charts that were soft-deleted (moved to trash while the ``SOFT_DELETE``
feature flag was enabled) can be restored; permanently deleted charts are
unrecoverable. The caller must be an editor of the chart (owners and
Admins qualify).

Example:
```json
{"identifier": 123}
```

Returns success with the restored chart's id/name, or an error. When the
caller lacks permission, ``permission_denied`` is true — do not retry; ask
the user.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Chart identifier - numeric ID or UUID string (charts have no slug). |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `update_chart`

*Update chart*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Update existing chart with new configuration.

IMPORTANT BEHAVIOR:
- By default (generate_preview=True), a preview explore URL is returned
  so the user can review changes and click Save to overwrite the original
  chart (if they have permission).
- Set generate_preview=False to persist the update immediately.
- LLM clients MUST display the returned explore URL to users.
- Use numeric ID or UUID string to identify the chart (NOT chart name).
- config is optional — omit it to rename a chart without changing its visualization
- To append table columns without restating the existing list, use add_columns

Example usage (preview, default):
```json
{
    "identifier": 123,
    "config": {
        "chart_type": "xy",
        "x": {"name": "date"},
        "y": [{"name": "sales", "aggregate": "SUM"}],
        "kind": "line"
    }
}
```

Rename only (no config required):
```json
{
    "identifier": 123,
    "chart_name": "Q1 Revenue"
}
```

Example usage (persist immediately):
```json
{
    "identifier": 123,
    "generate_preview": false,
    "config": {"chart_type": "table", "columns": [{"name": "region"}]}
}
```

Add a table column while preserving existing columns and metrics:
```json
{
    "identifier": 123,
    "add_columns": [{"name": "go_live_date", "aggregate": "MIN"}]
}
```

add_columns combines with chart_name to append and rename in one call.
Columns already on the chart are ignored, so repeating a column is safe:
```json
{
    "identifier": 123,
    "chart_name": "Go-Live Tracker",
    "add_columns": [{"name": "region"}]
}
```

Example usage with a custom SQL metric (ratios, conditional aggregations,
unit conversions). Pass 'sql_expression' instead of 'name'+'aggregate'.
A 'label' is required:
```json
{
    "identifier": 123,
    "config": {
        "chart_type": "xy",
        "x": {"name": "date"},
        "y": [{
            "sql_expression":
                "COUNT(CASE WHEN closed_won THEN 1 END)::numeric / "
                "NULLIF(COUNT(*), 0)",
            "label": "Win Rate"
        }],
        "kind": "line"
    }
}
```

Use when:
- Modifying existing saved chart
- Updating title, filters, or visualization settings
- Changing chart type or data columns

Returns:
- Updated chart info, form_data (reflects what was saved), and metadata
- Preview URL and explore URL for further editing

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_timeout` | integer |  |  | Cache timeout override in seconds (0 to disable) |
| `identifier` | integer o string | sí |  | Chart ID or UUID |
| `config` | objeto |  |  | Chart configuration. Optional; omit to only update chart_name. |
| `add_columns` | lista de objeto |  |  | Table columns or metrics to append while preserving every existing column and metric. Use this instead of config.columns when adding columns to an existing table chart. |
| `chart_name` | string |  |  | Auto-generates if omitted |
| `dataset_id` | integer |  |  | Target dataset ID to rebind the chart to a different dataset. When omitted, the chart retains its existing dataset. Can be combined with config to simultaneously change the dataset and visualization, or used alone to rebind without altering the config. |
| `generate_preview` | boolean |  | `true` | When True (default), returns a preview explore URL so the user can review changes before saving. When False, persists the update immediately. |
| `preview_formats` | lista de "url" \| "ascii" \| "vega_lite" \| "table" |  |  | Extra preview formats to render after saving. Only used when generate_preview=False. When generate_preview=True, the preview is always an explore URL. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `update_chart_preview`

*Update chart preview*

- **Permiso:** `Chart`, escritura. Scope de la clave: `superset:chart:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Update cached chart preview without saving.

IMPORTANT:
- Modifies cached form_data from generate_chart (save_chart=False)
- Original form_data_key (when provided) is invalidated, new one returned
- LLM clients MUST display explore_url to users

Use when:
- Creating a fresh preview from config + dataset_id (omit form_data_key)
- Modifying preview before deciding to save
- Iterating on chart design without creating permanent charts
- Testing different configurations

Returns new form_data_key, preview images, and explore URL. The explore_url
scheme matches the configured instance URL (HTTPS in production/staging,
HTTP in local development).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_form_data` | boolean |  | `true` | Cache form data for future use |
| `form_data_key` | string |  |  | Existing form_data_key to update (omit for fresh preview from config + dataset_id) |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `config` | objeto | sí |  | Chart configuration |
| `generate_preview` | boolean |  | `true` |  |
| `preview_formats` | lista de "url" \| "ascii" \| "vega_lite" \| "table" |  |  |  |

Ejemplo:

```json
{"request": {"dataset_id": 1, "config": {}}}
```

## Datasets y modelo de datos

### `add_calculated_column`

*Add calculated column*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add a calculated column to a dataset: a row-level SQL expression.

The expression runs once on the dataset before it is saved, so a typo comes
back as an error. Only the dataset's editors (and admins) change its model;
a workspace role does not allow it.

A saved metric cannot use this column by name: Superset does not expand
calculated columns inside metric expressions, so write the column's
expression inline in the metric (SUM(CASE ... END), not SUM(size)).

Example:
```json
{"dataset_id": 12, "column_name": "size",
 "expression": "CASE WHEN total > 100 THEN 'big' ELSE 'small' END"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `verbose_name` | string |  |  | Display label shown in charts |
| `description` | string |  |  | Column description |
| `is_dttm` | boolean |  |  | Mark the column as a time column (for time charts) |
| `groupby` | boolean |  |  | Whether charts can group by the column |
| `filterable` | boolean |  |  | Whether filters can use the column |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `column_name` | string | sí |  | Name of the new column |
| `expression` | string | sí |  | Row-level SQL expression in the database's dialect, e.g. "CASE WHEN total > 100 THEN 'big' ELSE 'small' END" |
| `type` | string |  |  | Column type, e.g. VARCHAR or NUMERIC |

Ejemplo:

```json
{"request": {"dataset_id": 1, "column_name": "…", "expression": "…"}}
```

### `add_metric`

*Add dataset metric*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Add a saved metric to a dataset: a named aggregate such as SUM(total).

The expression runs once on the dataset before it is saved. Charts then use
it as ``{"name": "<metric_name>", "saved_metric": true}``. Change it later
with update_dataset_metric.

Use physical columns only: a calculated column is not expanded inside a
metric, so its name fails. Repeat its expression inline instead, e.g.
SUM(CASE WHEN total > 100 THEN total ELSE 0 END).

Example:
```json
{"dataset_id": 12, "metric_name": "revenue", "expression": "SUM(total)",
 "d3format": ",.2f"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `metric_name` | string | sí |  | Name of the metric |
| `expression` | string | sí |  | Aggregate SQL expression for the metric, e.g. SUM(amount). Use physical columns: calculated columns are not expanded in metrics, so write their expression inline |
| `verbose_name` | string |  |  |  |
| `description` | string |  |  |  |
| `metric_type` | string |  |  |  |
| `d3format` | string |  |  |  |
| `warning_text` | string |  |  |  |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |

Ejemplo:

```json
{"request": {"metric_name": "…", "expression": "…", "dataset_id": 1}}
```

### `create_dataset`

*Register physical table as dataset*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Register a physical table as a Superset dataset.

Wraps POST /api/v1/dataset/ — the same endpoint the UI uses when you click
Data → Datasets → +Dataset.  Returns full dataset metadata (same shape as
get_dataset_info) so you can pass the resulting dataset_id straight into
generate_chart.

Required fields:
- database_id: ID of the existing database connection
- table_name: Exact name of the physical table to register

Optional fields:
- schema: Schema/namespace where the table lives (e.g. "public"). Omit for
  databases without schema namespaces (e.g. SQLite).
- catalog: Catalog where the table lives. Omit for databases without catalog
  support.
- editors: List of user IDs to set as editors (defaults to calling user)
- workspace_id: Workspace the dataset joins, so the charts of that
  workspace's dashboards can use it (contributors and admins of the
  workspace). Without it the dataset is shared.

Example:
```json
{
    "database_id": 1,
    "schema": "public",
    "table_name": "orders"
}
```

Returns DatasetInfo on success or DatasetError on failure.
Use list_databases to find the correct database_id.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_id` | integer | sí |  | ID of the database connection to register the table against |
| `schema` | string |  |  | Schema (namespace) where the table lives, e.g. 'public'. Omit or pass None for databases without schema namespaces (e.g. SQLite). |
| `catalog` | string |  |  | Catalog where the table lives. Omit for databases without catalog support. |
| `table_name` | string | sí |  | Name of the physical table to register as a dataset |
| `editors` | lista de integer |  |  | Optional list of editor user IDs. Defaults to the calling user. |
| `workspace_id` | integer |  |  | Workspace the new dataset joins, so the charts of its dashboards can use it (you must be a contributor or admin there). Omit it for a shared dataset, usable in every dashboard. |

Ejemplo:

```json
{"request": {"database_id": 1, "table_name": "…"}}
```

### `create_virtual_dataset`

*Create virtual dataset from SQL*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Save a SQL query as a virtual dataset so it can be charted.

Use this tool when a user wants to visualize data from a SQL query
(e.g., a JOIN or complex aggregation) that doesn't map to a single
physical table.

Workflow:
1. Call this tool with the SQL query and a dataset name
2. Use the returned ``id`` as the ``dataset_id`` in generate_chart or
   generate_explore_link
3. Use the returned ``columns`` list to pick columns for the chart config

Pass ``workspace_id`` to create it inside a workspace (contributors and
admins of the workspace), so the charts of its dashboards can use it.
Without it the dataset is shared.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_id` | integer | sí |  | ID of the database connection to use. Use list_databases to find valid IDs. |
| `sql` | string | sí |  | SQL query to save as a virtual dataset. Can be a JOIN, CTE, aggregation, or any valid SELECT. |
| `dataset_name` | string | sí |  | Name for the new virtual dataset. |
| `schema` | string |  |  | Schema to associate with the dataset (optional). |
| `catalog` | string |  |  | Catalog to associate with the dataset (optional). |
| `description` | string |  |  | Human-readable description of the dataset (optional). |
| `metrics` | lista de objeto |  |  | Optional list of saved metrics to create. Each metric must have 'metric_name' and 'expression'. |
| `calculated_columns` | lista de objeto |  |  | Optional list of calculated columns to create. Each column must have 'column_name' and 'expression'. |
| `workspace_id` | integer |  |  | Workspace the new dataset joins, so the charts of its dashboards can use it (you must be a contributor or admin there). Omit it for a shared dataset, usable in every dashboard. |

Ejemplo:

```json
{"request": {"database_id": 1, "sql": "…", "dataset_name": "…"}}
```

### `delete_calculated_column`

*Delete calculated column*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Delete a calculated column of a dataset.

Charts that use it stop finding it. Columns of the table itself cannot be
deleted: they come from the database.

Example:
```json
{"dataset_id": 12, "name": "size"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `name` | integer o string | sí |  | Column or metric to change: its numeric ID or its name. Use get_dataset_info to see them. |

Ejemplo:

```json
{"request": {"dataset_id": 1, "name": "Ventas"}}
```

### `delete_metric`

*Delete dataset metric*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Delete a saved metric of a dataset. Charts that use it stop finding it.

Example:
```json
{"dataset_id": 12, "name": "revenue"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `name` | integer o string | sí |  | Column or metric to change: its numeric ID or its name. Use get_dataset_info to see them. |

Ejemplo:

```json
{"request": {"dataset_id": 1, "name": "Ventas"}}
```

### `get_dataset_info`

*Get dataset info*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get dataset metadata by ID or UUID.

Returns columns, metrics, and schema details.

IMPORTANT FOR LLM CLIENTS:
- Use numeric ID (e.g., 123) or UUID string (e.g., "a1b2c3d4-...")
- DO NOT use schema.table_name format (e.g., "public.customers")
- To find a dataset ID, use the list_datasets tool first

IMPORTANT - Saved Metrics vs Columns:
The response includes both 'columns' (raw database columns) and 'metrics'
(pre-defined saved metrics). When building chart configs, use saved_metric=true
for metrics — do not treat them as columns. See instructions for details.

The select_columns parameter controls which top-level fields are returned.
Default fields: 'id', 'table_name', 'schema', 'database_name', 'database_id',
'uuid', 'is_virtual', 'description', 'main_dttm_col', 'sql', 'url',
'columns', 'metrics'.
Additional fields available on request: 'certified_by', 'certification_details',
'changed_on', 'changed_on_humanized', 'created_on', 'created_on_humanized',
'tags', 'schema_perm', 'offset', 'cache_timeout', 'params', 'template_params',
'extra', 'is_favorite'.

Example usage:
```json
{
    "identifier": 123
}
```

Or with UUID:
```json
{
    "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

Or to fetch only columns metadata:
```json
{
    "identifier": 123,
    "select_columns": ["columns"]
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `refresh_metadata` | boolean |  | `false` | Refresh metadata cache for schema changes |
| `identifier` | integer o string | sí |  | Dataset identifier - can be numeric ID or UUID string |
| `select_columns` | lista de string |  |  | Top-level fields to include in the response. Default set: 'id', 'table_name', 'schema', 'database_name', 'database_id', 'uuid', 'is_virtual', 'description', 'main_dttm_col', 'sql', 'url', 'columns', 'metrics'. Additional available fields: 'certified_by', 'certification_details', 'changed_on', 'changed_on_humanized', 'created_on', 'created_on_humanized', 'tags', 'schema_perm', 'offset', 'cache_timeout', 'params', 'template_params', 'extra', 'is_favorite'. Pass an explicit list to select only what you need (e.g. ['id', 'table_name', 'columns', 'metrics']). |
| `column_fields` | lista de string |  |  | Per-column fields to include for entries in 'columns'. Defaults to ['column_name','type','is_dttm']. Pass a wider list to include 'verbose_name','groupby','filterable','description' when needed. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `list_datasets`

*List datasets*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List datasets with filtering and search.

Returns dataset metadata including table name, schema, and last modified
time. Set ``request.certified`` to true to return only governed,
semantic-layer datasets; false returns only uncertified datasets, while
omitting it preserves the unfiltered behavior.

**IMPORTANT**: All parameters must be wrapped in a ``request`` object.
Do NOT pass ``search``, ``page``, ``page_size``, etc. as top-level
keyword arguments — they will be rejected. Use the ``request`` wrapper::

    # Correct usage
    list_datasets(request={"search": "sales", "page": 1, "page_size": 10})
    list_datasets(request={"filters": [{"col": "table_name", "opr": "sw", "value": "orders"}]})
    list_datasets()  # no arguments returns first page with defaults

    # Wrong — causes pydantic validation errors
    list_datasets(search="sales", page=1)  # DO NOT DO THIS

Valid filter columns for ``filters[].col``:
    ``table_name``, ``schema``, ``database_name``,
    ``created_by_fk``, ``changed_by_fk``

Sortable columns for ``order_column``:
    ``id``, ``table_name``, ``schema``, ``changed_on``,
    ``changed_on_delta_humanized`` (alias for ``changed_on``), ``created_on``

To filter by a person, call find_users to resolve the name to a user ID,
then pass it as a filter: filters=[{"col": "created_by_fk", "opr": "eq",
"value": <id>}] (or "changed_by_fk"). Do not pass the name as search.

Ejemplo:

```json
{"request": {}}
```

### `query_dataset`

*Query dataset*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`

Query a dataset using its semantic layer (saved metrics, dimensions, filters).

Returns tabular data without requiring a saved chart. Use this when you want
to compute saved metrics, group by dimensions, or apply filters directly
against a dataset's curated semantic layer.

Metrics must be saved metric names from get_dataset_info; ad-hoc
expressions such as "SUM(col)" are not accepted. When the dataset has no
saved metric for the aggregate you need, use execute_sql instead.

When reporting results, state the returned from_dttm (inclusive) and
to_dttm (exclusive) primary bounds rather than guessing dates from the
relative expression. Additional filters can further constrain the range.

Workflow:
1. list_datasets -> find a dataset
2. get_dataset_info -> discover available columns and metrics
3. query_dataset -> query using metric names and column names

Example:
```json
{
    "dataset_id": 123,
    "metrics": ["count", "avg_revenue"],
    "aggregates": [{"column": "price", "aggregate": "SUM"}],
    "columns": ["product_category"],
    "time_range": "Last 7 days",
    "row_limit": 100
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_timeout` | integer |  |  | Cache timeout override in seconds (0 to disable) |
| `dataset_id` | integer o string | sí |  | Dataset identifier — numeric ID or UUID string. |
| `metrics` | lista de string |  |  | Saved metric names to compute (e.g. ['count', 'avg_revenue']). Use get_dataset_info to discover available metrics. |
| `aggregates` | lista de objeto |  |  | Aggregates over columns, for what no saved metric covers (e.g. [{"column": "sales", "aggregate": "SUM"}]). Each result is named like SUM(sales), which order_by takes too. |
| `columns` | lista de string |  |  | Column/dimension names for GROUP BY or SELECT (e.g. ['category', 'region']). Use get_dataset_info to discover available columns. |
| `filters` | lista de objeto |  |  | Filter conditions (e.g. [{"col": "status", "op": "==", "val": "active"}]). |
| `time_range` | string |  |  | Time range filter. Use Superset relative shorthands like 'Last 7 days', 'Last month', 'Last year', 'Last quarter', 'Current week', 'previous calendar year', or an ISO-8601 range like '2024-01-01 : 2024-12-31'. Requires a temporal column on the dataset. Bracket shorthands like '[year]' or '[quarter]' are also accepted and normalized to the equivalent 'Last &lt;unit>' form. |
| `time_column` | string |  |  | Temporal column to apply time_range to. Defaults to the dataset's main datetime column. |
| `order_by` | lista de string |  |  | Column or metric names to sort results by. |
| `order_desc` | boolean |  | `true` | Sort descending (True) or ascending (False). |
| `row_limit` | integer |  | `1000` | Maximum number of rows to return (default 1000, max 50000). |

Ejemplo:

```json
{"request": {"dataset_id": 1}}
```

### `restore_dataset`

*Restore dataset*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Restore a soft-deleted dataset from trash.

Identify the dataset by numeric ID or UUID string, as list_trash returns
it. Only datasets moved to trash can be restored; the caller must be an
editor of the dataset or an Admin (workspace roles don't edit datasets).
It keeps its workspace. A restore is refused when another active dataset
already points at the same table.

Example:
```json
{"identifier": 42}
```

When the caller lacks permission, ``permission_denied`` is true — do not
retry; ask the user.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Dataset identifier - numeric ID or UUID string. |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `set_column_properties`

*Set column properties*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Set the label, description and flags of any dataset column.

Sets ``verbose_name``, ``description``, ``is_dttm`` (time column),
``groupby``, ``filterable`` and ``python_date_format`` (for a time column
stored as text). Only the properties you pass change.

Example:
```json
{"dataset_id": 12, "column": "order_date", "is_dttm": true,
 "python_date_format": "%Y-%m-%d", "verbose_name": "Order date"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `verbose_name` | string |  |  | Display label shown in charts |
| `description` | string |  |  | Column description |
| `is_dttm` | boolean |  |  | Mark the column as a time column (for time charts) |
| `groupby` | boolean |  |  | Whether charts can group by the column |
| `filterable` | boolean |  |  | Whether filters can use the column |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `column` | integer o string | sí |  | Column or metric to change: its numeric ID or its name. Use get_dataset_info to see them. |
| `python_date_format` | string |  |  | Python strftime format of a time column stored as text (e.g. '%Y-%m-%d'), or 'epoch_s' / 'epoch_ms' for numbers |

Ejemplo:

```json
{"request": {"dataset_id": 1, "column": 1}}
```

### `update_calculated_column`

*Update calculated column*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Change a calculated column of a dataset: expression, name, label or flags.

Only the settings you pass change. A new expression runs once before it is
saved. Physical columns have no expression: use set_column_properties for
their label and flags. Renaming breaks charts that use the old name.

Example:
```json
{"dataset_id": 12, "column": "size", "expression": "total > 100"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `verbose_name` | string |  |  | Display label shown in charts |
| `description` | string |  |  | Column description |
| `is_dttm` | boolean |  |  | Mark the column as a time column (for time charts) |
| `groupby` | boolean |  |  | Whether charts can group by the column |
| `filterable` | boolean |  |  | Whether filters can use the column |
| `dataset_id` | integer o string | sí |  | Dataset ID or UUID |
| `column` | integer o string | sí |  | Column or metric to change: its numeric ID or its name. Use get_dataset_info to see them. |
| `column_name` | string |  |  | New name; charts that use the old one stop finding it |
| `expression` | string |  |  | New expression |
| `type` | string |  |  | Column type |

Ejemplo:

```json
{"request": {"dataset_id": 1, "column": 1}}
```

### `update_dataset_metric`

*Update dataset metric*

- **Permiso:** `Dataset`, escritura. Scope de la clave: `superset:dataset:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Update a saved metric on a dataset.

Modifies properties of an existing saved metric (the named, reusable
aggregations stored on a dataset, e.g. SUM(revenue)) — such as its SQL
expression, name, display label, or number format. Changes apply to
every chart that uses the metric.

Only the properties you pass are changed; everything else on the metric,
and all other metrics on the dataset, is left untouched. This tool cannot
create or delete metrics. Requires ownership of the dataset (or Admin).

Workflow:
1. Call get_dataset_info to inspect the dataset's saved metrics
2. Call this tool with the dataset ID, the metric identifier, and only
   the properties to change

Example usage:
```json
{
    "dataset_id": 123,
    "metric": "sum_revenue",
    "expression": "SUM(net_revenue)",
    "d3format": "$,.2f"
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dataset_id` | integer o string | sí |  | Dataset identifier — numeric ID or UUID string. Use list_datasets to find valid IDs. |
| `metric` | integer o string | sí |  | Metric to update — numeric metric ID, metric UUID, or metric_name (e.g. 'sum_revenue'). Numeric strings are treated as IDs. Use get_dataset_info to discover a dataset's saved metrics. |
| `metric_name` | string |  |  | New metric name, unique within the dataset. Only pass this to rename the metric. |
| `expression` | string |  |  | New SQL aggregation expression (e.g. 'SUM(revenue)'). Calculated columns are not expanded here: write their expression inline. |
| `verbose_name` | string |  |  | Human-friendly display label. |
| `description` | string |  |  | Metric description. |
| `d3format` | string |  |  | D3 number format string (e.g. ',.2f', '.1%'). |
| `metric_type` | string |  |  | Metric type (e.g. 'count', 'sum'). |
| `currency` | objeto |  |  | Currency formatting configuration. |
| `warning_text` | string |  |  | Warning shown to users of this metric. |
| `extra` | string |  |  | JSON-encoded string with extra metric metadata. |

Ejemplo:

```json
{"request": {"dataset_id": 1, "metric": 1}}
```

## Conexiones

### `get_database_info`

*Get database info*

- **Permiso:** `Database`, lectura. Scope de la clave: `superset:database:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get database connection metadata by ID or UUID.

Returns database configuration including backend type and capabilities
(allow_ctas, allow_dml, expose_in_sqllab, etc.).

IMPORTANT FOR LLM CLIENTS:
- Use numeric ID (e.g., 123) or UUID string (e.g., "a1b2c3d4-...")
- To find a database ID, use the list_databases tool first

Example usage:
```json
{
    "identifier": 1
}
```

Or with UUID:
```json
{
    "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `refresh_metadata` | boolean |  | `false` | Refresh metadata cache for schema changes |
| `identifier` | integer o string | sí |  | Database identifier - can be numeric ID or UUID string |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `list_databases`

*List databases*

- **Permiso:** `Database`, lectura. Scope de la clave: `superset:database:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List database connections with filtering and search.

Returns database metadata including name, backend type, and permissions.

Sortable columns for order_column: id, database_name, changed_on,
created_on

Ejemplo:

```json
{"request": {}}
```

### `test_database_connection`

*Test database connection*

- **Permiso:** `Database`, escritura. Scope de la clave: `superset:database:write`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Test an existing database connection with its stored credentials.

Runs the web's "Test connection" on the server: the database is reached with
the settings an admin saved, and only the outcome comes back, never a
password or URI. Only users who manage connections (admins) can test them.

This tool cannot create or edit connections: database credentials never
pass through the chat. To add a connection, send the user to the
Connections page of the web (``connections_url`` in the response).

Example usage:
```json
{"database_id": 1}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_id` | integer | sí |  | ID of an existing database connection. Use list_databases to find it. |

Ejemplo:

```json
{"request": {"database_id": 1}}
```

## SQL Lab y consultas

### `execute_sql`

*Execute SQL query*

- **Permiso:** `SQLLab`, escritura. Scope de la clave: `superset:sqllab:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Execute SQL query against database using the unified Database.execute() API.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_id` | integer | sí |  | Database connection ID to execute query against |
| `sql` | string | sí |  | SQL query to execute (supports Jinja2 {{ var }} template syntax) |
| `schema` | string |  |  | Schema to use for query execution |
| `catalog` | string |  |  | Catalog name for query execution |
| `limit` | integer |  |  | Maximum number of rows to return. If not specified, respects the LIMIT in your SQL query. If specified, overrides any SQL LIMIT clause. |
| `timeout` | integer |  | `30` | Query timeout in seconds |
| `template_params` | objeto |  |  | Jinja2 template parameters for SQL rendering |
| `dry_run` | boolean |  | `false` | Return transformed SQL without executing (for debugging) |
| `force_refresh` | boolean |  | `false` | Bypass cache and re-execute query. IMPORTANT: Only set to true when the user EXPLICITLY requests fresh/updated data (e.g., 'refresh', 'get latest', 're-run'). Default to false to reduce database load. |

Ejemplo:

```json
{"request": {"database_id": 1, "sql": "…"}}
```

### `get_query_info`

*Get query info*

- **Permiso:** `Query`, lectura. Scope de la clave: `superset:query:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get SQL query history details by ID.

Returns query details including SQL text, execution status, timing,
row count, and any error messages.

IMPORTANT FOR LLM CLIENTS:
- Use numeric ID (e.g., 123)
- To find a query ID, use the list_queries tool first

Example usage:
```json
{
    "identifier": 123
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer | sí |  | Query ID (numeric) |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_saved_query_info`

*Get saved query info*

- **Permiso:** `SavedQuery`, lectura. Scope de la clave: `superset:savedquery:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get saved query details by ID or UUID.

Returns the full saved query including SQL text, label, database,
schema, and timestamps.

IMPORTANT FOR LLM CLIENTS:
- Use numeric ID (e.g., 42) or UUID string (e.g., "a1b2c3d4-...")
- To find a saved query ID, use the list_saved_queries tool first

Example usage:
```json
{
    "identifier": 42
}
```

Or with UUID:
```json
{
    "identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Saved query identifier - can be numeric ID or UUID string |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `list_queries`

*List queries*

- **Permiso:** `Query`, lectura. Scope de la clave: `superset:query:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List SQL query history with filtering and search.

Returns recent queries executed by the current user (or all queries for
admins), including SQL text, status, timing, and database information.
Results are ordered by changed_on descending by default (start_time is not
always populated for all query records).

Sortable columns for order_column: id, start_time, end_time, status,
database_id, changed_on

Ejemplo:

```json
{"request": {}}
```

### `list_saved_queries`

*List saved queries*

- **Permiso:** `SavedQuery`, lectura. Scope de la clave: `superset:savedquery:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List saved SQL queries with filtering and search.

Returns saved queries owned by the current user, including label, SQL,
database ID, and schema.

Sortable columns for order_column: id, label, db_id, schema,
changed_on, created_on

Ejemplo:

```json
{"request": {}}
```

### `open_sql_lab_with_context`

*Open SQL Lab with context*

- **Permiso:** `SQLLab`, lectura. Scope de la clave: `superset:sqllab:read`.
- **Cambia datos:** no.
- **Etiquetas:** `explore`

Generate SQL Lab URL with pre-populated sql and context.

Pass the sql parameter to pre-fill the editor. Returns URL for direct navigation.
The URL scheme matches the configured instance URL (HTTPS in production/staging,
HTTP in local development).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_connection_id` | integer | sí |  | Database connection ID to use in SQL Lab |
| `schema` | string |  |  | Default schema to select in SQL Lab |
| `dataset_in_context` | string |  |  | Dataset name/table to provide as context |
| `sql` | string |  |  | SQL to pre-populate in the editor |
| `title` | string |  |  | Title for the SQL Lab tab. Generate a succinct, descriptive label (roughly 3-6 words) from the conversation context or the query intent — e.g. 'Top customers by revenue Q3' — instead of leaving the tab untitled. Avoid generic names like 'Untitled Query'. |

Ejemplo:

```json
{"request": {"database_connection_id": 1}}
```

### `save_sql_query`

*Save SQL query*

- **Permiso:** `SavedQuery`, escritura. Scope de la clave: `superset:savedquery:write`.
- **Cambia datos:** sí.
- **Etiquetas:** `mutate`

Save a SQL query so it appears in SQL Lab's Saved Queries list.

Creates a persistent SavedQuery that the user can reload from
SQL Lab, share via URL, and find in the Saved Queries page.
Requires a database_id, a label (name), and the SQL text.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `database_id` | integer | sí |  | Database connection ID the query runs against |
| `label` | string | sí |  | Name for the saved query (shown in Saved Queries list) |
| `sql` | string | sí |  | SQL query text to save |
| `schema` | string |  |  | Schema the query targets |
| `catalog` | string |  |  | Catalog name (if applicable) |
| `description` | string |  |  | Optional description of the query |

Ejemplo:

```json
{"request": {"database_id": 1, "label": "…", "sql": "…"}}
```

## Explore

### `generate_explore_link`

*Generate explore link*

- **Permiso:** `Explore`, lectura. Scope de la clave: `superset:explore:read`.
- **Cambia datos:** sí.
- **Etiquetas:** `explore`

Generate explore URL for interactive visualization.

PREFERRED TOOL for most visualization requests.

Use this tool for:
- "Show me a chart of [data]"
- "Visualize [data]"
- General data exploration
- When user wants to SEE data visually
- Opening a dataset in Explore without a preconfigured chart (omit config)

IMPORTANT:
- Use numeric dataset ID or UUID (NOT schema.table_name format)
- When config is provided, MUST include chart_type (e.g. 'xy' or 'table')
- Omit config entirely to return a default explore URL for the dataset

Example usage:
```json
{
    "dataset_id": 123,
    "config": {
        "chart_type": "xy",
        "x": {"name": "date"},
        "y": [{"name": "sales", "aggregate": "SUM"}],
        "kind": "bar"
    }
}
```

Or with no config to simply open the dataset in Explore:
```json
{"dataset_id": 123}
```

Better UX because:
- Users can interact with chart before saving
- Easy to modify parameters instantly
- No database clutter from exploration

Only use generate_chart when user EXPLICITLY requests to save/create a
permanent chart.

Returns explore URL for immediate use. The URL scheme matches the configured
instance URL (HTTPS in production/staging, HTTP in local development).

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `use_cache` | boolean |  | `true` | Use cache if available |
| `force_refresh` | boolean |  | `false` | Invalidate cache and fetch fresh data |
| `cache_form_data` | boolean |  | `true` | Cache form data for future use |
| `dataset_id` | integer o string | sí |  | Dataset identifier (ID, UUID) |
| `config` | objeto |  |  | Chart configuration. Optional; omit to get a default explore URL that opens the dataset in Superset without a preconfigured chart. |

Ejemplo:

```json
{"request": {"dataset_id": 1}}
```

## Capa semántica

### `get_compatible_dimensions`

*Get compatible dimensions*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`, `semantic`

Return dimensions compatible with the current metric/dimension selection.

Used to drive progressive disclosure in query builders: after the user
selects one or more metrics (and optionally some dimensions), this tool
returns the dimensions that can validly be added without breaking the
underlying query.

Provide exactly one of ``dataset_id`` (built-in) or ``view_id`` (external).

For built-in datasets, returns all groupby-enabled columns from the dataset.
SQL datasets have no semantic compatibility constraints between metrics and
dimensions, so all groupby columns are returned for any valid selection.
Unknown names in ``selected_metrics`` or ``selected_dimensions`` are
rejected with a ValidationError.

For external semantic views, delegates to the view's
``get_compatible_dimensions`` implementation.

Example:
```json
{
    "selected_metrics": ["revenue"],
    "selected_dimensions": [],
    "view_id": 5
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `selected_metrics` | lista de string |  |  | Metric names already selected. |
| `selected_dimensions` | lista de string |  |  | Dimension names already selected. |
| `dataset_id` | integer |  |  | Built-in dataset ID to query. Provide either this or view_id. |
| `view_id` | integer |  |  | Semantic view ID to query. Provide either this or dataset_id. |

Ejemplo:

```json
{"request": {}}
```

### `get_compatible_metrics`

*Get compatible metrics*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`, `semantic`

Return metrics compatible with the current dimension/metric selection.

Used to progressively refine a query: given a set of already-selected
metrics and dimensions, returns the additional metrics that can be
combined without breaking the underlying semantic constraints.

Provide exactly one of ``dataset_id`` (built-in) or ``view_id`` (external).

For built-in datasets, all metrics from the dataset are considered
compatible (SQL GROUP BY imposes no metric-level constraints). Unknown
names in ``selected_metrics`` or ``selected_dimensions`` are rejected
with a ValidationError.

For external semantic views, delegates to the view's
``get_compatible_metrics`` implementation.

Example:
```json
{
    "selected_metrics": [],
    "selected_dimensions": ["region"],
    "view_id": 5
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `selected_metrics` | lista de string |  |  | Metric names already selected. |
| `selected_dimensions` | lista de string |  |  | Dimension names already selected. |
| `dataset_id` | integer |  |  | Built-in dataset ID to query. Provide either this or view_id. |
| `view_id` | integer |  |  | Semantic view ID to query. Provide either this or dataset_id. |

Ejemplo:

```json
{"request": {}}
```

### `get_table`

*Get table*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`, `semantic`

Query a data source using metrics and dimensions, returning tabular results.

Works with both built-in datasets and external semantic views. The
``dataset_id`` or ``view_id`` comes from the ``list_metrics`` response.

Semantic views accept time_grain as an ISO duration or grain name, applied
to time_column or the single selected temporal dimension. For example:
{"view_id": 1, "metrics": ["revenue"], "dimensions": ["metric_time"],
 "time_grain": "P1M"}.

When reporting results, state the returned from_dttm (inclusive) and
to_dttm (exclusive) primary bounds rather than guessing dates from the
relative expression. Additional filters can further constrain the range.

Workflow:
1. list_metrics -> discover metrics
2. get_compatible_dimensions -> discover dimensions for the chosen metrics
3. get_table -> query with chosen metrics and dimensions

Example (built-in):
```json
{
    "dataset_id": 42,
    "metrics": ["revenue"],
    "dimensions": ["region", "product_category"],
    "time_range": "Last 30 days",
    "row_limit": 500
}
```

Example (external):
```json
{
    "view_id": 5,
    "metrics": ["bookings"],
    "dimensions": ["listing__country_name"],
    "row_limit": 100
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `dataset_id` | integer |  |  | Built-in dataset ID to query. Obtained from list_metrics response when source='builtin'. Provide either this or view_id. |
| `view_id` | integer |  |  | External semantic view ID to query. Obtained from list_metrics response when source='external'. Provide either this or dataset_id. |
| `metrics` | lista de string |  |  | Metric names to compute. All metrics must come from the same data source (dataset or semantic view). |
| `dimensions` | lista de string |  |  | Dimension or column names to group by. |
| `filters` | lista de objeto |  |  | Optional filters to apply. |
| `time_range` | string |  |  | Optional time range string. Use Superset relative shorthands like 'Last 7 days', 'Last 30 days', 'Last year', 'Current week', 'previous calendar year', or an ISO-8601 range like '2024-01-01 : 2024-12-31'. Requires a temporal dimension. Bracket shorthands like '[year]' or '[quarter]' are also accepted and normalized to the equivalent 'Last &lt;unit>' form. |
| `time_column` | string |  |  | Name of the temporal column/dimension to apply time_range to. Inferred from the dataset's main_dttm_col when omitted. |
| `time_grain` | string |  |  | Optional time grain for the temporal dimension, as an ISO-8601 duration (P1D, P1W, P1M, P3M, P1Y, PT1H, PT1M, PT1S) or its name (day, week, month, quarter, year, hour, minute, second). Applies to time_column when set, otherwise to the single temporal dimension in dimensions. Semantic views only; a view's queryable grains are listed in get_table validation errors. |
| `row_limit` | integer |  | `1000` | Maximum number of rows to return. |
| `order_by` | lista de string |  |  | Column/metric names to sort by. |
| `order_desc` | boolean |  | `true` | Sort descending when True (default). |
| `use_cache` | boolean |  | `true` | Use query cache when available. |
| `force_refresh` | boolean |  | `false` | Force a cache refresh even when cached results exist. |

Ejemplo:

```json
{"request": {}}
```

### `list_metrics`

*List metrics*

- **Permiso:** `Dataset`, lectura. Scope de la clave: `superset:dataset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `data`, `semantic`

List available metrics across built-in datasets and external semantic views.

This is the primary entry point for semantic layer exploration. Returns a
unified list of metrics from all data sources the current user can access,
with compatible dimensions embedded only on request.

Workflow:
1. list_metrics -> discover available metrics
2. get_compatible_dimensions -> discover dimensions for the chosen metric
3. get_table -> query data using chosen metrics and dimensions

Use ``search`` to filter by metric name or description. Use ``dataset_id``
or ``view_id`` to scope to a specific data source.

Example:
```json
{"search": "revenue", "page": 1}
```

Ejemplo:

```json
{"request": {}}
```

## Usuarios, roles y gobierno

### `get_rls_filter_info`

*Get RLS filter info*

- **Permiso:** `Row Level Security`, lectura. Scope de la clave: `superset:rls:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get row level security filter details by ID. Requires admin access.

Returns full RLS filter configuration including name, type, tables, subjects,
and clause.

Example usage:
```json
{"identifier": 1}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer | sí |  | RLS filter ID |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_role_info`

*Get role info*

- **Permiso:** `Role`, lectura. Scope de la clave: `superset:role:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get role details by ID. Admin only.

Returns role metadata including id and name.

Example usage:
```json
{
    "identifier": 1
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer | sí |  | Role ID (integer) |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_tag_info`

*Get tag info*

- **Permiso:** `Tag`, lectura. Scope de la clave: `superset:tag:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get tag metadata by numeric ID.

Returns tag details including name, type, and description.

Tag types: custom (user-created), type (implicit by object type),
editor (implicit by editorship), favorited_by (implicit by favorites).

To find a tag ID, use the list_tags tool first.

Example usage:
```json
{
    "identifier": 1
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer | sí |  | Tag identifier — numeric ID |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_task_info`

*Get task info*

- **Permiso:** `Task`, lectura. Scope de la clave: `superset:task:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get details for a single async task by ID or UUID.

Returns task_type, status, scope, and timestamps for the specified task.
Non-admin users can only retrieve tasks they are subscribed to.

Use list_tasks to discover task IDs and UUIDs.

Example usage:
```json
{"identifier": 42}
```

Or with UUID:
```json
{"identifier": "a1b2c3d4-5678-90ab-cdef-1234567890ab"}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer o string | sí |  | Task identifier — numeric ID or UUID string |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `get_user_info`

*Get user info*

- **Permiso:** `User`, lectura. Scope de la clave: `superset:user:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get user details by ID. Admin only.

Returns user metadata including username, name, and active status.
Sensitive fields (email, roles) are only included when the caller has
data model metadata access.

Example usage:
```json
{
    "identifier": 1
}
```

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `identifier` | integer | sí |  | User ID (integer) |

Ejemplo:

```json
{"request": {"identifier": 1}}
```

### `list_rls_filters`

*List RLS filters*

- **Permiso:** `Row Level Security`, lectura. Scope de la clave: `superset:rls:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List row level security filters. Requires admin access.

Returns RLS filter metadata including name, filter type, tables, subjects, and clause.

Sortable columns for order_column: id, name, filter_type, changed_on

Ejemplo:

```json
{"request": {}}
```

### `list_roles`

*List roles*

- **Permiso:** `Role`, lectura. Scope de la clave: `superset:role:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List roles with filtering and search. Admin only.

Returns role metadata including id and name.

Sortable columns for order_column: id, name

Ejemplo:

```json
{"request": {}}
```

### `list_tags`

*List tags*

- **Permiso:** `Tag`, lectura. Scope de la clave: `superset:tag:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List tags with filtering and search.

Returns tag metadata including name, type, and description.

Tag types: custom (user-created), type (implicit by object type),
editor (implicit by editorship), favorited_by (implicit by favorites).

Sortable columns for order_column: id, name, changed_on, created_on

Ejemplo:

```json
{"request": {}}
```

### `list_tasks`

*List tasks*

- **Permiso:** `Task`, lectura. Scope de la clave: `superset:task:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List async tasks with filtering and pagination.

Returns tasks visible to the current user. Non-admin users only see tasks
they are subscribed to (task creators are auto-subscribed). Admins see all
tasks.

Sortable columns for order_column: task_type, scope, status, created_on, changed_on, started_at, ended_at
Filter columns: task_type, status, scope
Search columns (via search=): task_type, task_key, task_name, status, scope

Common task_type values: sql_execution, thumbnail, report
Common status values: pending, in_progress, success, failure, aborted
Common scope values: private, shared, system

Ejemplo:

```json
{"request": {}}
```

### `list_users`

*List users*

- **Permiso:** `User`, lectura. Scope de la clave: `superset:user:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

List users with filtering and search. Admin only.

Returns user metadata. Sensitive fields (email, roles) are only included
when the caller has data model metadata access.

Sortable columns for order_column: id, username, first_name, last_name,
active, changed_on

Ejemplo:

```json
{"request": {}}
```

## Sistema

### `find_users`

*Find users*

- **Permiso:** ninguna clase: la abre cualquier usuario. Scope de la clave: `superset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

Resolve a person's name to user IDs so they can be used as filter values.

Use this when the caller asks "show me <person>'s dashboards/charts/datasets"
or "what is <person> working on". Take the matching user.id and pass it as
the value for a created_by_fk or changed_by_fk filter on list_dashboards,
list_charts, or list_datasets.

Matches case-insensitively against username, first_name, and last_name.
Email is deliberately not matched, and an email-shaped query is rejected
outright rather than falling through to the username column: since
usernames are frequently email addresses under OAuth provisioning, a
plain column exclusion would still let an email lookup confirm whether
an address has an account (and resolve it to a person), a directory
capability the web API reserves for admins. The query is required and
non-empty; this tool does not enumerate the full user directory.

Privacy: returning a user's identity here is sanctioned only for resolving
filter values. Do not use the response to answer "who owns X", "who can
access X", or any access-list question — those remain off-limits per the
server instructions.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `query` | string | sí |  | Substring to match (case-insensitive) against username, first_name, and last_name (never email; email-shaped queries are rejected). Required and non-empty: this tool does not enumerate the full user directory. |
| `page_size` | integer |  | `10` | Maximum number of matches to return (max 100). |

Ejemplo:

```json
{"request": {"query": "…"}}
```

### `generate_bug_report`

*Generate bug report*

- **Permiso:** ninguna clase: la abre cualquier usuario. Scope de la clave: `superset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

Generate a copy-pasteable bug report for whoever runs this MCP.

Use this tool when something goes wrong with the MCP service and the
user wants to report it. The tool collects a safe snapshot of the
environment, combines it with the context the user provides (tool
that failed, error seen, LLM / client in use, optional free-text
notes) and returns a markdown report the user can paste into their
support channel.

PII and secrets are redacted from every user-supplied field before
they are written to the report (emails, IP addresses, bearer tokens,
API keys, credentialed URLs, JWTs, long hex blobs, key/value
secrets). The response lists every category that was actually
redacted so the user can spot-check.

The support contact in the response is configurable via the
``MCP_BUG_REPORT_CONTACT`` setting in ``superset_config.py`` so each
deployment can point users at the right channel. The default points
at the user's Superset administrator and the Apache Superset issue
tracker.

All request fields are optional — the tool still produces a useful
report when the user only remembers part of what happened.

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `tool_name` | string |  |  | The MCP tool the user was using when the issue occurred (e.g. 'generate_chart', 'execute_sql'). |
| `error_message` | string |  |  | The error message or unexpected behavior the user encountered. Emails, IPs, tokens and similar secrets are automatically redacted. |
| `llm_used` | string |  |  | The LLM / client the user was running when the issue occurred (e.g. 'Claude Sonnet 4.6', 'ChatGPT', 'Cursor + GPT-4'). |
| `steps_to_reproduce` | string |  |  | Optional free-text description of what the user was trying to do. |
| `additional_context` | string |  |  | Any other information the user wants to include. PII and secrets are sanitized before being written to the report. |
| `mcp_call_id` | string |  |  | Optional MCP call ID from a previous tool invocation. When provided, it will be included in the bug report for server-side log correlation. |

Ejemplo:

```json
{"request": {}}
```

### `get_instance_info`

*Get instance info*

- **Permiso:** ninguna clase: la abre cualquier usuario. Scope de la clave: `superset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

Get instance statistics.

Returns counts, activity metrics, and database types.

Ejemplo:

```json
{"request": {}}
```

### `get_schema`

*Get schema*

- **Permiso:** ninguna clase: la abre cualquier usuario. Scope de la clave: `superset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `discovery`

Get comprehensive schema metadata for a model type.

Returns all information needed to construct valid queries:
- select_columns: All columns available for selection (dynamically extracted)
- filter_columns: Filterable columns with their operators
- sortable_columns: Columns valid for order_column
- default_select: Columns returned when select_columns not specified
- search_columns: Columns searched by the search parameter

This unified tool consolidates discovery, reducing API calls and token usage.
Column metadata is extracted dynamically from SQLAlchemy models.

Args:
    model_type: One of "chart", "dataset", "dashboard", "database", or "report"

Returns:
    Comprehensive schema information for the requested model type

| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |
| --- | --- | :---: | --- | --- |
| `model_type` | "chart" \| "dataset" \| "dashboard" \| "database" \| "report" | sí |  | Model type to get schema for |

Ejemplo:

```json
{"request": {"model_type": "chart"}}
```

### `health_check`

*Health check*

- **Permiso:** ninguna clase: la abre cualquier usuario. Scope de la clave: `superset:read`.
- **Cambia datos:** no.
- **Etiquetas:** `core`

Simple health check tool for testing the MCP service.

IMPORTANT: This tool takes NO parameters. Call it without any arguments.

Returns basic system information and confirms the service is running.
This is useful for testing connectivity and basic functionality.

Parameters:
    None - This tool does not accept any parameters

Returns:
    HealthCheckResponse: Health status and system information including:
        - status: "healthy" or "error"
        - timestamp: ISO format timestamp
        - service: Service name derived from APP_NAME config
        - version: Application version string
        - python_version: Python version
        - platform: Operating system platform

Example:
    # Correct - no parameters
    health_check()

    # Incorrect - do not pass any arguments
    # health_check(request={})  # This will cause validation errors

Ejemplo:

```json
{}
```

## Prompts

Encargos guiados que el cliente ofrece al usuario (en Claude, el menú «/»).

### `create_chart_guided`

Guided chart creation with step-by-step workflow.

Args:
    chart_type: Preferred chart type (auto, line, bar, table, scatter, area)
    business_goal: Purpose (exploration, reporting, monitoring, presentation)

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `chart_type` |  | Preferred chart type (auto, line, bar, table, scatter, area) |
| `business_goal` |  | Purpose (exploration, reporting, monitoring, presentation) |

### `diseno_movil`

*Diseño móvil de este informe*

Give each page of a report a phone layout: cards and slicers first, charts stacked, checked on a phone screenshot.

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `dashboard` |  | Report id, slug or title; empty to ask the user |
| `idioma` |  | Language code for titles and replies; empty for the default |

### `informe_desde_dataset`

*Informe desde un dataset*

Build a complete AuraData BI report from one dataset, step by step, in AuraData BI's style.

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `dataset` |  | Dataset id or name; empty to choose one with the user |
| `workspace` |  | Workspace id or name for the report; empty to choose one |
| `tema` |  | What the report should answer, e.g. "ventas por región" |
| `idioma` |  | Language code for titles and replies; empty for the default |

### `quickstart`

Guide new users through their first experience with the platform.

Args:
    user_type: Type of user (analyst, executive, developer)
    focus_area: Area of interest (sales, marketing, operations, general)

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `user_type` |  | Type of user (analyst, executive, developer) |
| `focus_area` |  | Area of interest (sales, marketing, operations, general) |

### `replicar_informe_power_bi`

*Replicar un informe de Power BI desde una captura*

Rebuild a Power BI report page from a screenshot the user attaches, mapping its layout to AuraData BI's cell grid.

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `dashboard` |  | An existing report to add the page to; empty for a new one |
| `workspace` |  | Workspace id or name for a new report |
| `idioma` |  | Language code for titles and replies; empty for the default |

### `revisar_informe`

*Revisar y pulir un informe*

Look at every page of a report, critique it against AuraData BI's conventions and fix what is off.

| Argumento | Obligatorio | Descripción |
| --- | :---: | --- |
| `dashboard` |  | Report id, slug or title; empty to ask the user |
| `idioma` |  | Language code for titles and replies; empty for the default |

## Recursos

Textos que la IA lee cuando los necesita, por su URI.

### `auradata://brand`

AuraData brand: colors, fonts, when to use the gradient, tone and language.

Read it before choosing colors or writing titles and labels of a report.

### `auradata://format-catalog`

What the format tools change: levels, chart types, element kinds and how
to read the exact keys with get_format_options.

### `auradata://report-conventions`

How a good AuraData BI report looks: page size and cells, margins, a
standard page layout, visual hierarchy, naming, language and number formats.

Read it before placing visuals on a page.

### `chart://configs`

Provide valid ChartConfig examples that match the exact schema.

This resource gives LLMs access to:
- Valid ChartConfig examples for XYChartConfig and TableChartConfig
- Working configurations that pass schema validation
- Examples with proper ColumnRef, FilterConfig, AxisConfig, and LegendConfig
- Best practices for each chart type configuration

### `instance://metadata`

Provide instance metadata with available dataset and database IDs.

This resource gives LLMs context about:
- Instance summary stats (counts of dashboards, charts, datasets)
- Available database connections with their IDs (for execute_sql)
- Available datasets with IDs and table names (for get_dataset_info)
- Dashboard and chart statistics

### `superset://schema/all`

Combined schema metadata for all model types (chart, dataset, dashboard).

Returns comprehensive information in a single resource, reducing the need
for multiple resource fetches. Includes:
- Available columns for select_columns parameter
- Default columns returned when select_columns is not specified
- Sortable columns for order_column parameter
- Search columns used by the search parameter

Use this resource when you need schema info for multiple model types.

### `superset://schema/chart`

Schema metadata for chart model.

Returns comprehensive information about:
- Available columns for select_columns parameter
- Default columns returned when select_columns is not specified
- Sortable columns for order_column parameter
- Search columns used by the search parameter

Use this resource to understand what columns are valid for chart queries.

### `superset://schema/dashboard`

Schema metadata for dashboard model.

Returns comprehensive information about:
- Available columns for select_columns parameter
- Default columns returned when select_columns is not specified
- Sortable columns for order_column parameter
- Search columns used by the search parameter

Use this resource to understand what columns are valid for dashboard queries.

### `superset://schema/dataset`

Schema metadata for dataset model.

Returns comprehensive information about:
- Available columns for select_columns parameter
- Default columns returned when select_columns is not specified
- Sortable columns for order_column parameter
- Search columns used by the search parameter

Use this resource to understand what columns are valid for dataset queries.
