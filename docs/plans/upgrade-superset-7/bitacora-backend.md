# Bitácora upgrade 7.0 — área backend

Nota general: `rerere` está activo (rr-cache con 824 resoluciones) y dejó varios archivos de la lista sin marcadores
pero en estado UU. Los revisé uno a uno contra `upstream/7.0` y el diff del fork; no los di por buenos sin mirar.

## superset/app.py
- Fork: quitó la siembra de temas del sistema (`SeedSystemThemesCommand`).
- 7.0: añade `LegacyPrefixRedirectMiddleware` como envoltorio WSGI final.
- Decisión: versión de 7.0 + quitar la siembra de temas. Quité el `# noqa: C901` que traía nuestro lado (7.0 no lo usa).

## superset/commands/dashboard/export.py
- Fork: no exporta `theme_uuid` ni el tema del dashboard.
- 7.0: `_stabilize_chart_ids` y `seen` compartido en el export del tema.
- Decisión: 7.0 con `_stabilize_chart_ids`, sin `theme_uuid` y sin `ExportThemesCommand`.

## superset/commands/dashboard/importers/v1/__init__.py
- Fork: sin importación de temas (`themes/`, `theme_uuid` → se descartan `theme_uuid`/`theme_id` de exports viejos);
  `assert_single_dashboard` tras escribir `dashboard_slices` con Core.
- 7.0: la pertenencia dashboard→gráficos pasa por el ORM (`dashboard.slices = ...`, por Continuum), `default_viewers`,
  `overwrite_assets`, importación de temas con `seen`.
- Decisión: 7.0 sin nada de temas; mantengo el `pop` de `theme_uuid`/`theme_id`. Como ya no existe `dashboard_chart_ids`,
  acumulo los `target_chart_ids` de cada dashboard en `attached_chart_ids` y llamo `assert_single_dashboard` después del
  bucle (el listener ORM sigue siendo la red de seguridad).

## superset/commands/dashboard/importers/v1/utils.py
- Fork: `remap_bookmark_chart_ids(position, id_map)`; quita la nota de `theme_id`.
- Decisión: imports de 7.0 + import del fork; el resto ya lo combinó git.

## superset/commands/dashboard/importers/dispatcher.py, superset/commands/dataset/importers/dispatcher.py
- rerere los dejó idénticos a 7.0. 7.0 también quitó los importadores v0, igual que el fork. Correcto sin cambios.

## superset/commands/dashboard/update.py
- Fork: `validate_dashboard_layout` (un dashboard por gráfico) dentro de `validate`.
- 7.0: `no_autoflush`, `repair_position`, `json_metadata` fuera del update genérico, `compute_subjects` (sustituye roles),
  `validate_css` solo si cambia, `_validate_layout_chart_access`, emails a `editors`.
- Decisión: partir de 7.0 y añadir `validate_dashboard_layout` antes de `if exceptions:`.

## superset/commands/chart/create.py, chart/update.py, explore/get.py
- rerere los resolvió: 7.0 + validaciones del fork (`validate_chart_dashboards`, `validate_chart_dataset`, `can_edit` del slice
  en explore). Revisados contra el diff del fork: completos.

## superset/commands/importers/v1/assets.py
- Fork: `assert_single_dashboard` tras el insert Core en `dashboard_slices`.
- 7.0: relación ORM + flush + tags.
- Decisión: 7.0 y `assert_single_dashboard(set(slice_ids))` tras el flush.

## superset/commands/report/execute.py, superset/commands/sql_lab/results.py
- Fork: solo un comentario pylint (execute) y el cherry-pick de #43371 (results), ambos ya en 7.0.
- Decisión: versión de 7.0 íntegra.

## superset/common/query_context_processor.py
- rerere: 7.0 sin `get_native_annotation_data` ni `AnnotationLayerDAO` (el fork quitó las capas de anotación). Correcto.

## superset/daos/key_value.py
- Fork: cherry-pick de upstream #45059/#45102 (no están en 7.0): `get_entry(..., lock: RowLock)`; lo usa
  `commands/dashboard/permalink/create.py` con `RowLock(read=True)`.
- 7.0: `get_entry(..., for_update: bool)`; lo usa `commands/distributed_lock/release.py`.
- Decisión: acepto los dos parámetros; `for_update=True` equivale a `RowLock()`. (Upstream master unificó en `lock=RowLock()`.)

## superset/config.py
- Fork: favicon y `APP_ICON` AuraData, `DASHBOARD_VIRTUALIZATION=False`, sin `CSS_TEMPLATES`, `LISTVIEWS_DEFAULT_CARD_VIEW=True`,
  sin `ENABLE_UI_THEME_ADMINISTRATION` y comentario de temas solo por configuración, fuentes en `connect-src` del CSP (export
  PDF/PNG), `from superset.mibi_config import *` antes de "STOP EDITING" (MIBI_*, `BABEL_DEFAULT_LOCALE="es"`, `LANGUAGES`,
  `THEME_DEFAULT`/`THEME_DARK`, paletas). `DATA_CACHE_MAX_VALUE_SIZE` ya viene en 7.0.
- 7.0: muchos ajustes nuevos (`THEME_DEFAULT_MODE`, `_THEME_DEFAULT_BASE`/`sync_theme_logo_href`, SOFT_DELETE, VERSION_HISTORY,
  MOBILE_CONSUMPTION_MODE, CSP de mapas nuevo, retención de versiones...).
- Decisión: partir de 7.0 y reaplicar a mano cada cambio del fork (el `connect-src` en TALISMAN_CONFIG y TALISMAN_DEV_CONFIG).

## superset/connectors/sqla/models.py
- Fork: quita `AnnotationDatasource` (y los imports `timedelta`, `QueryStatus`, `Annotation`); añade `x_axis` a
  `COLUMN_FORM_DATA_PARAMS` (gráficos sin query_context mandan su columna de eje X).
- 7.0: muchísimos cambios (capas semánticas, soft delete, etc.).
- Decisión: partir de 7.0 y reaplicar los cuatro cambios del fork.

## superset/daos/dashboard.py
- Fork: copiar un dashboard siempre clona sus gráficos con `MIBI_SINGLE_DASHBOARD_CHARTS`; remapea ids de gráficos en
  bookmarks, `json_metadata` y `params` (`superset/mibi/chart_refs.py`).
- 7.0: `set_dash_metadata(..., allowed_chart_ids=...)` y su propio `_remap_filter_scopes` (scopes, chart_configuration,
  chartsInScope), `editor` en vez de `owner` en filtros, `repair_position`.
- Decisión: imports y llamada de 7.0 + bloque del fork antes de `set_dash_metadata`. El auto-merge había duplicado
  `apply_column_operators` (versión 6.1 con `owner`); lo quité y dejé solo el de 7.0.
- Nota: nuestro `remap_metadata_chart_ids` y el `_remap_filter_scopes` de 7.0 remapean en parte lo mismo
  (`chart_configuration`, `scope.excluded`). Es inocuo (los ids nuevos nunca coinciden con ids viejos y 7.0 usa
  `.get(id, id)`), pero conviene dejar uno solo en la fase 2.

## superset/dashboards/filters.py
- Fork: en `DashboardAccessFilter`, los dashboards de un workspace solo para miembros (y owners).
- 7.0: el filtro pasa de owners/roles a sujetos (editores/visores) y `EXTRA_ACCESS_QUERY_FILTERS`.
- Decisión: código de 7.0 y, al final, el filtro de workspace en AND, con los editores (`editor_query`) en lugar de los
  owners como excepción.

## superset/dashboards/schemas.py
- Fork: `filter_bar_auto_apply`; sin `ThemeSchema`/`theme`/`theme_id`/`theme_uuid`; `can_edit` en el GET.
- 7.0: `validate_css`, editors/viewers, `async_mode`, `OneOf`...
- Decisión: 7.0 sin nada de temas. `can_edit` ahora usa `security_manager.is_editor(original)` porque 7.0 eliminó
  `is_owner` (ver security/manager.py).

## superset/databases/api.py
- Fork (a84d21f228): quita el endpoint obsoleto `table_extra_metadata_deprecated`.
- Decisión: 7.0 sin ese endpoint ni sus imports (`cast`, `deprecated`, `parse_js_uri_path_item`).

## superset/datasets/api.py, superset/models/core.py, superset/db_engine_specs/README.md
- rerere: 7.0 + filtros de workspace del fork (datasets); sin `CssTemplate` ni `Theme` (core); tabla de motores sin los
  motores quitados por el fork (README). Revisados: correctos.

## superset/db_engine_specs/base.py
- Fork: solo un comentario pylint, ya presente en 7.0. Decisión: 7.0 íntegro.

## superset/examples/world_bank.py
- Fork: `bubble_v2` y sin el ejemplo "Parallel Coordinates" (tipo `para` quitado). 7.0 ya trae `bubble_v2`.
- Decisión: 7.0 (`non_echarts_defaults`) sin el ejemplo `para`.

## superset/initialization/__init__.py
- Fork: sin APIs/vistas de capas de anotación, plantillas CSS, temas y grupos (`GroupsListView`); registra
  `MibiRestApi`, `WorkspaceRestApi`, `DashboardBackgroundRestApi`, `DashboardImageRestApi`, `WorkspaceView`, `DataView`;
  "Charts" sin menú con `MIBI_SINGLE_DASHBOARD_CHARTS`; `configure_single_dashboard_charts()` (listeners ORM).
- 7.0: `configure_subjects`, `configure_websocket`, `init_versioning`, etc.
- Decisión: partir de 7.0 y reaplicar todo lo anterior. Comprobé que todos los módulos importados existen.

## superset/mibi/__init__.py, superset/mibi/data_views.py
- Falsos conflictos por detección de renombres: el fork borró `RELEASING/requirements.txt` y `superset/views/groups.py`
  y git los emparejó con estos archivos, metiendo los cambios de 7.0 de esos archivos aquí.
- Decisión: versión del fork (main) íntegra. `views/groups.py` y `RELEASING/requirements.txt` siguen borrados.

## superset/security/manager.py
- Fork: sin permisos de CssTemplate/Theme/Annotation (Gamma, Alpha, Public), sin `can_sqllab_history`; dashboards de un
  workspace solo para miembros en `raise_for_access` (`can_see_dashboard`); contribuidores de workspace editan
  (`edits_as_workspace_member` en `raise_for_ownership`); cherry-pick #42864 (comparar el payload del invitado contra todos
  los controles guardados, `superset/security/guest_payload.py`).
- 7.0: reescritura enorme. Owners → sujetos (editors/viewers): ya no existen `is_owner` ni `raise_for_ownership`, ahora
  `is_editor`/`raise_for_editorship`. `query_context_modified` pasa a comparadores (`_columns_metrics_modified` con sus
  propios `_STORED_METRIC_PARAMS`/`_STORED_COLUMN_PARAMS`, orderby, filtros SQL, capas de anotación...).
- Decisión: partir de 7.0 y reaplicar: quitar `CssTemplate`/`Theme` de Gamma (7.0 añadía `Theme`), "Annotation Layers"/
  "Annotation" de Alpha y Public, `can_sqllab_history`, los permisos públicos de CSS/temas/anotaciones;
  `can_see_dashboard` justo después de `is_admin() or is_editor(dashboard)`; el gancho de workspace va ahora dentro de
  `is_editor` (después de admin), así cubre también `raise_for_editorship`.
- La comparación del invitado se queda con la de 7.0 (fix paralelo). `superset/security/guest_payload.py` del fork queda
  sin usar (ver fase 2).

## superset/commands/explore/get.py (ajuste)
- `can_edit` del slice usa `security_manager.is_editor(slc)` (7.0 no tiene `is_owner`).

## superset/sql/parse.py, utils/cache.py, utils/database.py, utils/excel.py
- Fork: solo cherry-picks de 6.2 (#43005, #42570, #43371, #43560), todos en 7.0. Decisión: 7.0 íntegro.

## superset/utils/webdriver.py
- Fork: cherry-pick #44898 (binary_location anidado en Selenium). 7.0 quitó Selenium (solo Playwright), así que el arreglo ya
  no aplica. Decisión: 7.0 íntegro.

## superset/templates/superset/spa.html
- Fork: título por defecto `appbuilder.app_name`, `<meta viewport>` siempre (diseño móvil), manifest `?v=5`.
- 7.0: viewport solo con `MOBILE_CONSUMPTION_MODE`, manifest dinámico (`PwaManifestView`), etiquetas og:*.
- Decisión: 7.0 + título del fork + viewport siempre (lo necesita `mibiMobile`). Manifest dinámico de 7.0 (el
  `pwa-manifest.json` estático lo borra 7.0), pero `superset/views/pwa_manifest.py` dice "Apache Superset" (fase 2).

## superset/views/base.py
- Fork: sin `ThemeDAO`/`ThemeModel`/`_load_theme_from_model`/`ENABLE_UI_THEME_ADMINISTRATION`/`enableUiThemeAdministration`;
  marca de agua según `MIBI_SHOW_POWERED_BY`.
- 7.0: fusiona THEME_DEFAULT/THEME_DARK con `_THEME_DEFAULT_BASE`/`_THEME_DARK_BASE`, `enforce_theme_algorithm`, `defaultMode`.
- Decisión: 7.0 sin nada de temas guardados. Conservo la fusión con la base de 7.0 (nuestros tokens ganan; solo rellena
  los que no definimos) y `defaultMode`.

## superset/views/core.py
- Fork: valida un dashboard por gráfico al guardar desde Explore (`save_or_overwrite_slice`); quita `warm_up_cache` y
  `sqllab_history` obsoletos; `language_pack` público con `max_age=0`.
- 7.0: `language_pack` ya es público y añade `language_pack_script` versionado; editors/viewers al "save as".
- Decisión: partir de 7.0 y reaplicar los cambios del fork (el pack JSON sigue con `max_age=0`).

## superset/views/datasource/views.py
- Fork (a84d21f228): quita los endpoints obsoletos `/datasource/save/` y `/datasource/get/`.
- 7.0: endurece `save` con `_authorize_repoint` y ayudantes `_repoints_*`, `_requested_target`.
- Decisión: 7.0 sin `save`/`get` ni esos ayudantes (solo los usaba `save`); limpié imports sin usar. El frontend no llama
  a ninguno de los endpoints quitados (grep).

## superset/viz.py, tests/integration_tests/viz_tests.py (UD)
- Fork: solo quitó las visualizaciones legacy de los tipos eliminados (8400673c2b). 7.0 borra el pipeline legacy
  `explore_json` (#41714) y estos dos archivos.
- Decisión: **quedan borrados** (borrados en disco). Nada en `superset/`, `superset/mibi`, `tests/` ni `scripts/` importa
  `superset.viz` (grep de `superset.viz`, `from superset import viz`, `BaseViz`).

## superset/commands/dashboard/importers/dispatcher.py, superset/commands/dataset/importers/dispatcher.py (ajuste)
- 7.0 conserva `v0.py` para los comandos CLI `legacy_import_*`; el fork lo borró (sigue borrado y la CLI no lo usa).
  Cambié el comentario de 7.0 que remitía a esos comandos por uno que dice que AuraData BI quitó el formato v0.

# Tests

## tests/integration_tests/charts/data/api_tests.py, dashboards/commands_tests.py, datasets/api_tests.py,
## datasource_tests.py, fixtures/importexport.py, tests/unit_tests/initialization_test.py
- Los resolvió rerere, pero mal en parte; corregido a mano:
  - charts/data: imports de 6.1 que 7.0 ya no usa (`async_query_manager_factory`, `test_client`) → los de 7.0.
  - dashboards/commands_tests: faltaban `SqlaTable` y `Database` (un test nuevo de 7.0 los usa).
  - datasets/api_tests: `test_create_dataset_with_currency_code_column` duplicado (quedó una copia); vuelve el import
    `dataset_ui_export` (lo usa el test de 7.0 que comprueba que la API rechaza exports v0, válido también para nosotros).
  - fixtures/importexport.py: queda igual que 7.0 (con los fixtures v0, que usan esos tests de rechazo).
  - datasource_tests: quito los tests de `/datasource/save/` y `/datasource/get/` (endpoints quitados por el fork).
  - initialization_test: sobraba una línea `mock_feature_flag_manager...` sin definir; sin siembra de temas.

## tests/integration_tests/core_tests.py
- Fork: sin `test_warm_up_cache_error` (endpoint quitado); `/chart/list/` redirige a `/dashboard/list/`.
- Decisión: imports de 7.0 sin los que solo usaba el test de warm_up_cache.

## tests/integration_tests/dashboards/api_tests.py
- Fork: sin `theme` en la respuesta GET; sin el test de import v0.
- 7.0: el test v0 ahora comprueba que la API rechaza v0 (422) y la respuesta GET trae `description`.
- Decisión: sin `theme`, con `description`; conservo el test de rechazo v0 (con el import `dashboard_export`) y ajusté su
  docstring (ya no existe el comando CLI v0).

## tests/integration_tests/model_tests.py
- Fork: sin `test_impersonate_user_trino` (motor Trino quitado). Decisión: sin ese test.

## tests/integration_tests/security_tests.py
- Fork: sin Annotation/CssTemplate/can_sqllab_history en los conjuntos esperados; Public sin permisos extra.
- Decisión: 7.0 con esos cambios; el bloque en conflicto eran tests 6.1 (`test_raise_for_access_viz`, `_rbac`) que 7.0
  reescribió: versión de 7.0.

## tests/integration_tests/sql_lab/commands_tests.py, tests/unit_tests/utils/{cache_test,excel_tests,webdriver_test}.py
- Fork: solo cherry-picks ya en 7.0 (o de Selenium, que 7.0 quitó). Decisión: 7.0 íntegros. Los tests del fork de
  `binary_location` de Selenium desaparecen (no aplica).

## tests/unit_tests/security/manager_test.py
- Fork: 28 tests añadidos del cherry-pick #42864 (comparación del invitado contra todos los controles guardados).
- Decisión: 7.0 + esos 28 tests añadidos al final, sin tocar. OJO: el código es el de 7.0, con listas de controles más
  cortas, así que es probable que fallen algunos (mixed timeseries `*_b`, deck.gl spatial, `point_radius_fixed`,
  cartodiagram, `selected_chart`, `groupbyRows`, `order_by_cols`...). Ver fase 2.

## tests/unit_tests/connectors/sqla/models_test.py
- Fork: test de `x_axis` en `data_for_slices` sin query_context.
- 7.0: `data_for_slices` lee `slc.query_context` con `_extract_query_context_columns`.
- Decisión: 7.0 + test del fork adaptado (`mock_slice.query_context = None` en vez de `get_query_context`).

## tests/unit_tests/dashboards/schema_tests.py (AA)
- Falso emparejamiento por renombre con un test de Kylin (motor quitado). Decisión: archivo de 7.0 + los dos tests
  del fork de `filter_bar_auto_apply`.

## tests/unit_tests/jinja_context_test.py, models/core_test.py, models/helpers_test.py
- Fork: Trino → Presto en tests que dependían del motor; sin Pinot en el test de `type_probe_needs_row`.
- Decisión: 7.0 + esos cambios exactos. 7.0 añadió más tests con `trino://` que no dependen del motor (caché de engines,
  impersonación por email): los dejo, igual que el fork dejó los suyos.

## tests/unit_tests/views/datasource/views_test.py (AA)
- Decisión: 7.0 sin los tests de `save`/`get` (24 tests y ayudantes), imports limpios.

## tests/unit_tests/views/test_base_theme_helpers.py
- Fork: sin temas guardados; tests de "solo temas de configuración".
- Decisión: 7.0 sin los tests de `ThemeDAO`/`_load_theme_from_model`/caché del modelo `Theme`; los asserts de
  `enableUiThemeAdministration is False` pasan a "la clave no está"; añado los dos tests del fork adaptados a la fusión
  con la base de 7.0 (comprueban el color, no el dict exacto).

# Abierto fase 2 (backend)
1. **`is_owner`/`raise_for_ownership` ya no existen en 7.0** (owners → sujetos editors/viewers). Los usan
   `superset/mibi/workspaces.py` (l. ~549, 615, 701, 767) y `superset/mibi/backgrounds.py` (l. 55): fallarán en tiempo de
   ejecución. Pasar a `is_editor`/`raise_for_editorship`. También `.owners` en `superset/mibi/workspace_datasets.py`
   (`SqlaTable.owners.any(...)`, l. 87) y `superset/mibi/split_shared_charts.py` (l. 61): 7.0 usa `editors`.
2. Gancho de workspace movido a `SupersetSecurityManager.is_editor` (antes en `raise_for_ownership`). Verificar que no
   cuesta demasiado (hace una consulta por llamada) y que los listados/filtros que usan `is_editor` siguen bien.
3. `DashboardAccessFilter`: el filtro de workspace ahora exime a los editores (antes owners). Revisar con datos reales.
4. Comparación del payload de invitados embebidos: nos quedamos con la de 7.0; `superset/security/guest_payload.py` del fork
   queda sin usar y sus 28 tests (en `tests/unit_tests/security/manager_test.py`) probablemente fallan. Decidir si se
   amplían `_STORED_METRIC_PARAMS`/`_STORED_COLUMN_PARAMS` de 7.0 con los controles del fork o se borra `guest_payload.py`.
5. `superset/daos/key_value.py` acepta `for_update` (7.0) y `lock: RowLock` (6.2): unificar en `lock` como upstream master
   (`release.py` → `lock=RowLock()`).
6. Copiar dashboard: `remap_metadata_chart_ids` (fork) y `_remap_filter_scopes` (7.0) remapean en parte lo mismo; dejar uno.
7. `superset/views/pwa_manifest.py` (nuevo en 7.0) sirve `name: "Apache Superset"`: ponerle la marca AuraData (APP_NAME e
   iconos), porque el `pwa-manifest.json` estático del fork lo borra 7.0.
8. `get_theme_bootstrap_data` fusiona nuestros THEME_DEFAULT/THEME_DARK con `_THEME_DEFAULT_BASE` de 7.0: añade tokens que
   no definimos (p. ej. `components.Tooltip.fontSize=12`). Confirmar que el aspecto no cambia.
9. `ImportV1DashboardSchema` ya no acepta `theme_uuid`/`theme_id` (como en el fork): los exports antiguos con tema fallarán
   la validación antes del `pop` del importador. Valorar aceptarlos y descartarlos.
10. Rutas: 7.0 pasa las vistas de `/superset/*` a la raíz (`LegacyPrefixRedirectMiddleware`, p. ej. `/warm_up_cache`,
    `/language_pack`). Revisar URLs del fork que apunten a `/superset/...`.
11. Ejecutar los tests tocados: los adaptados (`models_test` x_axis, `test_base_theme_helpers`, `core_test` con presto,
    `schema_tests`) no se han ejecutado.

# Abierto fase 3 (frontend)
1. El backend ya no envía `enableUiThemeAdministration` (como en el fork) y sí `defaultMode` (7.0).
2. `spa.html` emite siempre `<meta viewport>`; comprobar que no choca con el modo móvil de consumo de 7.0.
3. Endpoints quitados (`/datasource/save/`, `/datasource/get/`, `/superset/warm_up_cache/`, `/superset/sqllab/history/`,
   `table_extra/...`): ningún archivo del frontend los llama hoy (grep); confirmar tras resolver el frontend.

# Abierto fase 4 (choques de funcionalidades)
1. `MOBILE_CONSUMPTION_MODE` (7.0, flag off) frente a `mibiMobile`: el viewport ya no depende del flag.
2. `SOFT_DELETE` y `VERSION_HISTORY` vienen activados por defecto en 7.0 (config.py): sin revisar su interacción con un
   dashboard por gráfico, workspaces y el formato en `position_json`.
3. `can_edit` (GET de dashboard y explore) ahora sale de `is_editor` + workspace; revisar junto con editors/viewers de 7.0.

# Comprobaciones finales
- Revisados otra vez los archivos que rerere dejó sin marcadores, contra `:3:` (7.0) y el diff del fork: cada línea
  distinta de 7.0 corresponde a un cambio del fork (o a mi ajuste `is_editor`).
- `ENABLE_UI_THEME_ADMINISTRATION`: nadie lo lee con corchetes, solo `.get(...)`; quitarlo de config.py es seguro.
- **Grave (fase 2, bloqueante en ejecución):** 7.0 no tiene relaciones `owners` en `SqlaTable`, `Slice` ni `Dashboard`.
  `WorkspaceDatasetFilter` (`superset/mibi/workspace_datasets.py` l. 87, `SqlaTable.owners.any(...)`) está en
  `DatasetRestApi.base_filters`, así que **todo listado de datasets fallará** hasta adaptarlo a `editors`.
  Lo mismo `mibi/workspaces.py`/`mibi/backgrounds.py` (`is_owner`, `raise_for_ownership`) y `mibi/split_shared_charts.py`.
- **Seguridad (fase 2):** el gancho de workspace en `is_editor` alcanza llamadas nuevas de 7.0 que conceden acceso a
  datos: `raise_for_access` de un gráfico (`is_admin() or is_editor(chart)`, ~l. 5692), la comprobación de visor de
  slice (~l. 5465) y la emisión de guest tokens (~l. 6123, un editor se salta la comprobación por dataset). Con el
  gancho, un contribuidor de workspace obtiene ahí acceso a datos, contra la regla "la membresía nunca da acceso a
  datos". Opción: sacar el gancho de `is_editor` y ponerlo solo en `raise_for_editorship`/los puntos de edición.
  (En el fork `is_owner` llamaba a `raise_for_ownership`, donde estaba el gancho.)
