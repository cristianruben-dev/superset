# Bitácora del merge de Superset 7.0: área `mcp`

## Diagnóstico general
- El fork en `superset/mcp_service` y `tests/unit_tests/mcp_service` es `upstream/6.2` (llegó con el merge de 6.2) más unos pocos
  cambios propios. `git diff upstream/6.2 main` solo toca: `CLAUDE.md`, `README.md`, `chart/tool/get_chart_data.py`
  (bubble_v2), `common/schema_discovery.py` (`theme_id`), `dashboard/constants.py` (densidad de rejilla),
  `dashboard/tool/add_chart_to_existing_dashboard.py` y `generate_dashboard.py` (un dashboard por gráfico), sus tests y
  `test_grid_density.py`.
- Todos los commits MCP de la rama 6.2 están en 7.0 (con otro SHA), salvo tres que solo viven en 6.2:
  `a812670ec7` («sql» como parámetro sensible), `309aec3dab` (desenvolver `call_tool`/`request` para sacar ids y
  `dataset_id` de `create_virtual_dataset`) y `dacbdaa709` (fixture que resetea `_mcp_user_id_var` en los tests).
- Estrategia: cada archivo de la lista parte de `upstream/7.0` y se le vuelven a aplicar a mano solo esos deltas.

## Por archivo

### Tomados de 7.0 sin cambios (el fork == 6.2 y 7.0 ya trae esos arreglos)
`__main__.py`, `auth.py`, `chart/schemas.py`, `chart/tool/generate_chart.py`, `chart/tool/update_chart.py`,
`chart/tool/update_chart_preview.py`, `chart/validation/pipeline.py` (UU sin marcadores), `constants.py`,
`dashboard/schemas.py`, `dashboard/tool/get_dashboard_info.py`, `explore/tool/generate_explore_link.py`, `server.py`,
y los tests `chart/test_chart_schemas.py`, `chart/tool/test_update_chart.py`,
`chart/validation/test_pipeline_error_surface.py`, `dashboard/test_dashboard_schemas.py`,
`dashboard/tool/test_dashboard_tools.py`, `test_auth_user_resolution.py`, `test_mcp_config.py`, `test_mcp_server.py`.
- `dashboard/schemas.py`: el «theme» de 7.0 son `json_metadata_overrides` (colores, `label_colors`), no `theme_id`. El
  modelo `Dashboard` del fork no tiene `theme_id` y los schemas tampoco, así que no hay nada que quitar. `css` se queda,
  que el fork lo conserva por dashboard.

### `app.py`
- 7.0 registra las herramientas de capas de anotación (`annotation_layer.tool`) y de temas (`theme.tool`). Esas carpetas
  ya están borradas en el fork. Quité los dos imports y los bloques «Annotation Layers» y «Theme Management» de
  `DEFAULT_INSTRUCTIONS`. En la línea de `update_dashboard` cambié «layout/theme/CSS» por «layout/colors/CSS».

### `mcp_config.py`
- 7.0 tal cual, menos `"create_theme"` en `excluded_tools` de la caché (la herramienta ya no existe).

### `middleware.py`
- 7.0 más el puerto de los dos commits que solo estaban en 6.2:
  - `"sql"` en `_SENSITIVE_PARAM_KEYS`.
  - `_unwrap_params_for_id_extraction` (atraviesa `{"name","arguments"}` del proxy `call_tool` y `{"request": ...}`) usado
    en `_extract_context_info`, y `_DATASET_CREATE_TOOLS` para rellenar `dataset_id` desde la respuesta de
    `create_virtual_dataset` (`_extract_output_ids(tool_name, result)` y `_backfill_output_ids` devuelven tres ids).
  - El nombre de la herramienta: 7.0 ya resuelve la herramienta real en un campo aparte, `mcp_tool`, y deja
    `tool="call_tool"`. Mantengo ese diseño de 7.0 (no sobrescribo `tool` como hacía 309aec3dab); para elegir si se
    extrae `dataset_id` uso `mcp_tool or tool_name`.

### `test_middleware_logging.py`, `test_middleware.py`
- 7.0 más los tests de 309aec3dab, adaptados: las llamadas a `_extract_output_ids` reciben el nombre de la herramienta y
  devuelven tres valores; tests de desenvolver `request` y el proxy; test de `dataset_id` por el proxy, que comprueba
  `curated_payload["mcp_tool"]` (diseño de 7.0) en lugar de `tool`. `TestResolveToolName` ya existía en 7.0: no lo
  dupliqué. En `test_middleware.py` añadí `test_redacts_sql` en `TestSanitizeParams`.

### `conftest.py` (UU sin marcadores)
- 7.0 más el fixture autouse `reset_mcp_user_id_var` de dacbdaa709 (`_mcp_user_id_var` sigue en `auth.py` de 7.0).

### `CLAUDE.md`
- 7.0 (guía ampliada) más la sección «AuraData BI: One Dashboard per Chart» y sin la mención a `.rat-excludes`.

### `common/schema_discovery.py`
- 7.0 sin la descripción de la columna `theme_id`.

### `chart/tool/get_chart_data.py`, `chart/chart_helpers.py`, `test_get_chart_data.py`
- El fork cambió `viz_type == "bubble"` por `"bubble_v2"` (las burbujas son ECharts; la migración pasa `bubble` →
  `bubble_v2`). En 7.0 esa lógica salió de `get_chart_data.py` a `chart_helpers.resolve_metrics`. Porté el arreglo allí
  (acepta `bubble` y `bubble_v2`). `chart_helpers.py` no estaba en la lista (es nuevo de 7.0, estado `A`), pero es donde
  vive ahora la lógica. En `get_chart_data.py` añadí `"bubble_v2": "bubble"` al mapa de categorías de sugerencias. En el
  test, el espejo `_extract_metrics_and_groupby` acepta los dos y los casos de `TestBubbleChartFallback` usan `bubble_v2`
  como en el fork.

### `dashboard/tool/add_chart_to_existing_dashboard.py`
- 7.0 más: ancho en la densidad del dashboard (`layout_column_count`/`scaled_width` de `dashboard/constants.py`, que
  sigue en disco) y la comprobación `find_charts_in_other_dashboards([chart_id], dashboard.id)` con su error legible,
  después de «already in dashboard».

### `dashboard/tool/generate_dashboard.py`
- 7.0 más la comprobación `find_charts_in_other_dashboards(found_chart_ids, None)` tras validar que existen los charts.

### `utils/token_utils.py`, `tests/.../utils/test_token_utils.py`: BORRADOS
- 7.0 los renombró a `utils/response_size_utils.py` y `test_response_size_utils.py` (#44508, quita tiktoken y mide en
  bytes). El fork no tenía cambios propios en `token_utils.py` frente a 6.2 (solo el #42244, que 7.0 ya trae en
  `response_size_utils`: `DATA_QUERY_TOOLS`, `truncate_query_result`, `_ROW_LIMIT_ADVICE`...). Nada que portar. Los dos
  archivos quedan borrados en disco y nada importa `token_utils`.

## Comprobaciones hechas
- Sin marcadores en la lista; `py_compile` OK en todos los `.py`; todos los módulos `superset.*` importados existen.
- `superset.mibi.single_dashboard` se sigue usando en `generate_dashboard.py` y `add_chart_to_existing_dashboard.py`.
- `duplicate_dashboard` (nuevo de 7.0) usa `CopyDashboardCommand` → `DashboardDAO.copy_dashboard`, que en el fork ya
  fuerza `duplicate_slices` cuando la regla de un dashboard por gráfico está activa: cubierto.

## Abierto fase 2 (backend)
- Quedan referencias a temas y anotaciones fuera de mi lista, que fallarán o están de más:
  - `superset/mcp_service/utils/response_size_utils.py:431` (`"create_theme": _spec("theme", ...)`, inocuo pero sobra).
  - Tests: `test_tool_inventory.py` (create_theme, get_theme_info, list_themes, *annotation*), `test_mcp_tool_registration.py`
    (las mismas), `test_rbac_tool_enforcement.py` (importa `superset.mcp_service.theme.tool.create_theme` y
    `superset.daos.theme`: falla), `test_guest_token_auth.py:370` (`list_annotation_layers`),
    `test_result_value_contract.py` (`annotation_layers[]`, `ThemeInfo.*`, `CreateThemeResponse.*`), `test_auth_rbac.py:584` («Theme»).
  - `dashboard/tool/update_dashboard.py` describe «layout/theme/CSS» (docstring y título); revisar el texto.
- `dashboard/constants.py` sigue con la densidad 12/24/48 (`mibiColumns`), heredada de main; el layout del fork es ya una
  cuadrícula de celdas (`mibiCells`, `mibiPos`). Los tools MCP que crean o editan layouts (generate_dashboard,
  add_chart_to_existing_dashboard, update_dashboard, remove_chart_from_dashboard) no colocan `mibiPos`; el frontend lo
  arregla al cargar (`layoutToPositions`/`freeCell`). No es regresión del merge, pero conviene revisarlo.
- `dashboard/tool/update_dashboard.py` (nuevo de 7.0, fuera de mi lista) escribe `dashboard.position_json` directamente, sin
  `UpdateDashboardCommand`: un `position_json` con un `CHART-*` de otro dashboard solo lo para el listener del ORM, sin
  error legible. Hay que validarlo con `superset.mibi.single_dashboard` (p. ej. `validate_dashboard_layout`) como pide
  `mcp_service/CLAUDE.md`.
- `DEFAULT_INSTRUCTIONS` de `app.py` describe `duplicate_dashboard` como «optionally deep-copying its charts»; en el fork
  la copia profunda es forzosa (la impone el DAO). Es solo texto.
- `test_grid_density.py` sigue siendo compatible con la firma de 7.0 de `_add_chart_to_layout` (5 argumentos, tupla de 3).
- Falta un test de `resolve_metrics` con `bubble_v2` en `tests/unit_tests/mcp_service/chart/test_chart_helpers.py`.
- Correr `pytest tests/unit_tests/mcp_service/` (no lo ejecuté, por la regla 7). Puntos de riesgo: los tests nuevos de
  7.0 de `generate_dashboard`/`add_chart_to_existing_dashboard` con mocks frente a la comprobación de un dashboard por
  gráfico (`MIBI_SINGLE_DASHBOARD_CHARTS = True` en `mibi_config.py`, que `config.py` importa, así que está activa en la
  app de tests y `find_charts_in_other_dashboards` consultará la BD), y la redacción de `sql` en logs.

## Abierto fase 3 (frontend)
- Nada.

## Abierto fase 4
- Nada específico del MCP.
