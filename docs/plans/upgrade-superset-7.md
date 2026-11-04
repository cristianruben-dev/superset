# Plan: actualizar AuraData BI a Apache Superset 7.0

Fecha: 2026-11-03 · Rama: `claude/upgrade-superset-7-502890`, cortada de `main` local (`7d0f17dfd6`, 153 commits
sin subir) · Upstream: `upstream/7.0` en `ceef26f901` (7.0.0rc2).

El fork es `upstream/6.1` (`c37118edd0`, entero) más 319 commits propios. La base del merge con 7.0 es
`bc99b710bd` (master), así que 7.0 trae 4182 commits y el fork aporta 577 desde esa base. Muchos conflictos no son
del fork: son la deriva entre la rama 6.1 y master.

## Fases

Una sesión por fase, una tras otra. Las suites de tests nunca corren en paralelo.

| Fase | Qué | Listo cuando |
| ---: | --- | --- |
| 0 | Preparación y línea base | Este documento con la línea base, commiteado antes del merge |
| 1 | Merge de `upstream/7.0` | Merge commiteado, sin marcadores de conflicto, bitácora de cada área |
| 2 | Backend: SQLAlchemy 2.0 y Flask 3, migraciones, `superset/mibi` | `superset` importa, `db upgrade` en una base nueva y en una existente, `pytest tests/unit_tests/mibi/` en verde |
| 3 | Frontend base: TypeScript 7, oxlint, lockfile regenerado con npm, build | `tsc` y `oxlint` sin errores nuevos, `npm run build` funciona, Jest de `src/mibi` como en la base |
| 4 | Funciones de 7.0 que pisan las nuestras | Cada choque de la lista «Abiertos para la fase 4» decidido y probado |
| 5 | Infraestructura | `Dockerfile` (imagen -lean), drivers, informes de Playwright, SSL de MySQL |
| 6 | Traducciones al español y marca | Cadenas nuevas de 7.0 en `es/messages.po`, ninguna marca de Superset a la vista |
| 7 | QA completo y PR | QA en el navegador, Playwright experimental, PR contra `main` |

## Línea base (fase 0)

Tomada en la rama antes del merge (`7d0f17dfd6`), una suite tras otra.

- **Montaje:** el worktree no tiene `node_modules`. Se enlazaron los del checkout principal (mismo commit) y se
  copiaron sus carpetas `lib/` de paquetes y plugins para que `tsc` resuelva las referencias de proyecto. Las
  dependencias de JavaScript son, por tanto, las de 6.1. Tras el merge se usa el mismo montaje, salvo `lib/`, que se
  reconstruye.
- **Ojo con Jest y los enlaces:** el `jest.config.js` del repo resuelve `@superset-ui/*` a través de `node_modules`,
  que apunta al checkout principal. Así una prueba carga dos copias de `@superset-ui/core` (dos `SupersetClient`) y
  fallan 23 pruebas que no tienen nada roto. Hay que correr Jest con un config que mapee `@superset-ui/*` a
  `packages/*/src` y `plugins/*/src` del worktree (guardado en la carpeta de notas de la sesión como
  `jest.worktree.config.js`).
- **Jest `src/mibi`** (`jest -c jest.worktree.config.js --max-workers=3 src/mibi`): 53 suites, 404 tests.
  **402 pasan, 2 fallan**, ambos previos al merge:
  - `format/editing.test.tsx`: «places a pasted object in its row when it fits, else in a row below», `GRID_ID`
    indefinido.
  - `format/columns.test.tsx`: «a legacy layout in 24 columns keeps its shares», espera 7 y recibe 6.
- **pytest `tests/unit_tests/mibi/`** (en el contenedor, sobre un `git archive` de la rama): **82 pasan, 0 fallan.**
- **`tsc --noEmit -p .`:** **39 errores**, ninguno en `src/mibi`: 21 en `plugin-chart-ag-grid-table` (`totals`,
  `UseColDefsProps`), 13 en `DatabaseModal/index.test.tsx` y uno en `Header.test.tsx`, `PropertiesModal`,
  `dashboardInfo.test.ts`, `VizTypeGallery.tsx` y `ThemeController.ts`. Parte puede venir de las `lib/` copiadas.
- **oxlint** (`--quiet`): **5 errores**: 3 `no-use-before-define` en `src/mibi/format/useCellMove.ts`, 1 en
  `playwright/tests/experimental/dashboard/layout-ux.spec.ts` y 1 `escape-case` en `src/mibi/export/export.test.ts`.

## Forma del merge

Simulado con `git merge-tree`: 1199 archivos en conflicto.

| Tipo | Cuántos | Qué son |
| --- | ---: | --- |
| modify/delete | 597 | 577 borrados por el fork (o por 6.1) y cambiados en 7.0; 20 borrados por 7.0 y cambiados por el fork |
| rename/delete | 160 | 7.0 movió archivos que el fork había borrado (docs, plugins legacy renombrados, workflows) |
| content | 445 | 263 en archivos que el fork tocó; 182 solo deriva 6.1↔master |
| add/add | 55 | 16 tocados por el fork; 39 solo deriva |
| rename/rename | 1 | Emparejamiento falso (`dataset_list.test.ts` de Cypress) |

**Criterio general:**
- «Tocado por el fork» = cambia entre `upstream/6.1` y `main`. Si un archivo en conflicto no cambia ahí, el
  conflicto es solo deriva entre 6.1 y master: se toma la versión de 7.0.
- Los borrados del fork se atribuyen al commit que los hizo; si el motivo sigue vigente, siguen borrados.
- Lo que 7.0 añade dentro de áreas que el fork quitó (archivos nuevos que entran sin conflicto) también se quita,
  salvo que el código que queda lo importe.

## Bitácora de decisiones

Formato: área · decisión · por qué.

### Fase 0

- **Migraciones: repuntar o fusionar.** La tarea pide apuntar `8bc9e5b95335` a la cabeza de 7.0. Eso deja una
  cadena, pero una base ya en `d3f9a2b17c64` daría por aplicadas las 41 migraciones nuevas de 7.0. Se consultó a la
  sesión principal; la decisión queda en la sección de migraciones de la fase 1.

### Fase 1

`git merge --no-ff upstream/7.0` con `merge.renameLimit=100000` y `rerere` activado. Las bitácoras archivo por archivo
de cada área están en la carpeta de notas de la sesión (`upgrade-7-ledger*.md`); aquí va el resumen por área.

**Áreas que el fork quitó (modify/delete y añadidos limpios de 7.0): siguen fuera.** Cada borrado se atribuyó al commit
del fork que lo hizo, y su motivo sigue vigente:
- Docs (`docs/` salvo `plans`, `qa` y `upgrade-7.0`), Helm, `RESOURCES`, compose secundarios (`94f40e495b`,
  `9d7a285870`): 2 101 archivos nuevos de 7.0 en `docs/` y Helm no entran.
- Servidor WebSocket en Node (`0b2b012bb8`): fuera también su etapa del `Dockerfile`, el hook `oxfmt-websocket` y
  `docker/entrypoints/run-websocket.sh`. El módulo Python `superset/websocket/` de 7.0 entra (lo usa el backend).
- Storybook y stories (`c205048f4f`): fuera todos los `*.stories.tsx` nuevos, el job `test-storybook` y sus scripts.
- Cypress (`91b0c1b141`): fuera los jobs de Cypress de `superset-e2e.yml`; queda el de Playwright.
- Workflows de Apache (`97ce37733d`, `eb2b133954`, `2380dd039d`), archivos ASF y RELEASING: fuera los 14 workflows
  nuevos de 7.0, salvo `enforce-single-migration-head.yml`, que comprueba algo que sí nos importa. En los workflows
  que el fork conserva se tomó 7.0 y se volvió a quitar lo de Helm (setup-go, helm-docs) y Storybook.
- Traducciones salvo es/en (`fa605baaa8`): fuera las 8 lenguas nuevas de 7.0 y sus tests.
- Motores de BD poco usados, Trino y Presto (`87d0739f35`): fuera `datafusion` y `odps` nuevos, sus tests, los
  `tests/testcontainers/` (7.0 los añade con su workflow, que tampoco entra) y los extras de `pyproject.toml`.
- Temas guardados y plantillas CSS (`f1a729d78e`), capas de anotación (`660a568a4b`, `abd65f865a`): fuera las
  herramientas MCP nuevas `theme` y `annotation_layer`, `src/features/themes/utils.ts`, tests de plantillas CSS y de
  `AnnotationLayerControl`, y `playwright/tests/dashboard/theme.spec.ts`.
- Lista de gráficos (`238e54616e`), importación v0 (`a84d21f228`), tarjeta flotante de filtros (`89e9d0a995`),
  TimeTable (`0514bf8c4f`).

**Plugins de gráficos.** 7.0 renombra `legacy-plugin-chart-*` → `plugin-chart-*` y los pasa a la API de datos
(`superset/viz.py` desaparece); NVD3 desaparece (Bullet pasa a `EchartsBulletChartPlugin`) y map-box pasa a
`plugin-chart-point-cluster-map` (con la migración `ce6bd21901ab` que convierte los gráficos guardados).
- Se toman enteros de 7.0 calendar, chord, country-map, world-map, `preset-chart-deckgl` y point-cluster-map, sin
  stories. El color de marca que el fork puso en deck.gl (`PRIMARY_COLOR` = Azul Aura) se vuelve a aplicar en
  `preset-chart-deckgl/src/utilities/controls.ts`.
- Siguen fuera horizon, partition, paired-t-test, parallel-coordinates (7.0 los renombra) y Rose/TimePivot de ECharts
  (7.0 los reescribe en ECharts): el fork los quitó en `0514bf8c4f`. Fuera de `MainPreset.ts`, `package.json` y
  `tsconfig.json`. Butterfly (nuevo en 7.0) queda registrado; ver fase 4.

**Deriva 6.1↔master.** 216 conflictos de contenido o add/add en archivos que el fork no cambió desde 6.1 → versión de
7.0 (41 tests, 52 `superset/`, 71 `src/`, 23 plugins, 14 paquetes, 5 Playwright, 5 workflows y 5 sueltos).

**Raíz y build (resueltos a mano):**
- `README.md`: el del fork (resumen en español). `AGENTS.md`/`CLAUDE.md`: combinado sin conflicto (sección de
  seguridad y oxfmt de 7.0). `.gitmodules`: el del fork (sin acciones de Helm). `.gitignore`: 7.0.
- `.pre-commit-config.yaml`: hooks de 7.0 (oxfmt, stylelint, zizmor); fuera `oxlint-docs`, `feature-flags-sync`
  (escribe en `docs/`) y `oxfmt-websocket`.
- `pyproject.toml`: versiones de 7.0 (SQLAlchemy 2.0) para los extras que el fork conserva; se añaden `excel-export`,
  `mariadb` (alias de mysql) y `sqlite` de 7.0; fuera los extras de motores quitados. `requirements/development.in`:
  la lista de extras del fork, sin testcontainers. `requirements/development.txt`: el de 7.0 provisionalmente (hay
  que regenerarlo, fase 2).
- `Dockerfile`: compilador de traducciones tolerante del fork; target `dev` con la estructura de 7.0 más los drivers
  de AuraData (`postgres,mssql,databricks,redshift`); sin WebSocket. `docker/mibi/docker-init-prod.sh`: el del fork
  (git lo emparejó por error con `RELEASING/Dockerfile.make_tarball`).
- `docker/pythonpath_dev/superset_config.py`: miniaturas del fork y `ENABLE_EXTENSIONS`/`SEMANTIC_LAYERS` de 7.0;
  `MOBILE_CONSUMPTION_MODE` queda apagado (choca con `mibiMobile`).
- `superset-frontend/package.json`: versión 7.0.0 y dependencias de 7.0 (React 18, webpack-cli 7, dev-server 6…);
  fuera Storybook, `concurrently`/`wait-on` (solo los usaba Storybook) y los plugins quitados. `package-lock.json`:
  el de 7.0 sin tocar, **hay que regenerarlo con npm** (fase 3). `.eslintrc*.js`: borrados como en 7.0 (ESLint →
  oxlint). `tsconfig.json`, `webpack.config.js`: 7.0 sin los plugins quitados ni los arreglos de Storybook.
- `scripts/po2json.sh`: 7.0 (oxfmt) pero sin `--fuzzy`, que el fork quitó porque las entradas fuzzy en español eran
  incorrectas.
- Playwright: 7.0 sacó `tests/experimental/{dashboard,dataset,chart}` a `tests/`; las pruebas propias del fork
  (`format*`, `layout-ux`, `present`, `sort`, `export-file` y sus capturas) vuelven a `tests/experimental/dashboard/`,
  porque dependen de los datos de dev y son opt-in. El cambio del fork a `create-dataset.spec.ts` (los gráficos se
  crean desde un tablero) se porta al nuevo `tests/dataset/create-dataset.spec.ts`.

**Traducciones.** `messages.pot`, `en` y `es` se combinan por entrada con Babel (no por texto): queda la traducción del
fork en todo mensaje que ya tenía y se añaden los nuevos de 7.0 (1 162 en el `.pot`, 988 en `es`, con la traducción de
7.0, que usa «usted» y hay que revisar en la fase 6). `msgfmt -c` da los mismos 8 errores de formato que ya había en
`main`.

**Conflictos de código por área.** Resueltos archivo por archivo (partiendo de 7.0 y reaplicando a mano lo del fork
donde 7.0 reescribió el archivo); el detalle, en las bitácoras:
[backend](upgrade-superset-7/bitacora-backend.md) (63 archivos), [MCP](upgrade-superset-7/bitacora-mcp.md) (34),
[dashboard](upgrade-superset-7/bitacora-dashboard.md) (52), [gráficos y paquetes](upgrade-superset-7/bitacora-charts.md) (48),
[resto del frontend](upgrade-superset-7/bitacora-appfe.md) (70).
- `rerere` estaba activo y traía resoluciones de un intento anterior de la misma actualización: dejó varios archivos
  sin marcadores pero con errores (código duplicado, imports viejos, iconos vacíos). Se revisaron todos contra `:2:`
  y `:3:`, no solo los que tenían marcadores.
- Git emparejó por renombrado archivos sin relación (p. ej. `superset/mibi/__init__.py` con `RELEASING/requirements.txt`,
  `src/mibi/time.ts` con `superset-websocket`, `mcp_service/database/tool/__init__.py` con `ibmi.py`, con marcadores de
  8 caracteres): quedan con su contenido real.
- `superset/viz.py`, `tests/integration_tests/viz_tests.py`, `mcp_service/utils/token_utils.py` (ahora
  `response_size_utils.py`) y `src/pwa-manifest.json` (ahora `superset/views/pwa_manifest.py`) quedan borrados como en 7.0.
- Archivos que el fork no tocó pero difieren de 7.0: algunos arreglos que solo están en la rama 6.1 entraron sin
  conflicto (`ToastPresenter.tsx`, tests de `getExploreUrl`, `urlUtils`, `DatasetList.permissions`,
  `DrillDetailTableControls`). Se dejan; los tests de `getExploreUrl` con `explore_json` fallarán (7.0 quitó ese endpoint).

**Migraciones.** 7.0 deja su cabeza en `88a01c781622` y el fork en `d3f9a2b17c64`. En lugar de mover
`8bc9e5b95335` detrás de la cabeza de 7.0, se añade la revisión de merge `f1c7a9e2b305` con
`down_revision = ("88a01c781622", "d3f9a2b17c64")`: una sola cabeza, y una base que ya está en `d3f9a2b17c64` (la de dev,
cualquier despliegue) aplica las 41 migraciones de 7.0 en `db upgrade` en vez de darlas por hechas. Ninguna migración
de 7.0 toca tablas que el fork borró; la de versionado crea `dashboards_version.theme_id` sin clave ajena.

## Estado al cerrar la fase 1

- Merge commiteado sin marcadores (`git grep` con 7 u 8 caracteres) y una sola cabeza de migraciones.
- No se ejecutaron suites de tests (la máquina se traba con ellas). La comprobación de import del backend y de
  compilación del frontend está en el informe de la sesión.
- `main` avanzó 2 commits después de cortar esta rama (`4f8736327f`, `4fb893edd9`): mezclar `main` en la rama antes de
  la fase 7.

## Abiertos para la fase 2 (backend)

Lista completa en las bitácoras de [backend](upgrade-superset-7/bitacora-backend.md) y [MCP](upgrade-superset-7/bitacora-mcp.md).

1. **Bloqueante: owners → editors/viewers.** 7.0 quita `owners`, `is_owner` y `raise_for_ownership`. Fallan
   `WorkspaceDatasetFilter` (`mibi/workspace_datasets.py`, filtro base de la API de datasets: **todo listado de datasets
   falla**), `mibi/workspaces.py`, `mibi/backgrounds.py` y `mibi/split_shared_charts.py`.
2. **Seguridad.** El gancho de workspace quedó en `SupersetSecurityManager.is_editor`, que 7.0 también usa para dar
   acceso a datos (`raise_for_access` de gráficos, visor de slices, guest tokens). Un contribuidor de workspace
   obtendría acceso a datos: llevar el gancho solo a los puntos de edición.
3. SQLAlchemy 2.0 y Flask 3: instalar las dependencias de 7.0 en el contenedor y regenerar
   `requirements/development.txt` desde `development.in` (se tomó el de 7.0 provisionalmente).
4. `db upgrade` en una base nueva y en la de dev (en `d3f9a2b17c64`) por la revisión de merge `f1c7a9e2b305`.
5. Marca AuraData en `superset/views/pwa_manifest.py` (nombre, descripción en español, `start_url`, colores, icono
   maskable); rutas sin `/superset/` emitidas por el backend del fork.
6. Comparación del payload de invitados embebidos: decidir entre la lista de 7.0 y `security/guest_payload.py` del fork
   (sus 28 tests probablemente fallan). `daos/key_value.py`: unificar `for_update` y `lock`.
7. MCP: `update_dashboard.py` (nuevo) no valida un dashboard por gráfico; tests de MCP que nombran temas y capas de
   anotación; las herramientas no colocan `mibiPos`.
8. Tests de 7.0 que importan motores quitados: `test_cancel_query_validation.py`, `test_grouping_sets_capability.py`,
   `test_base.py` (impala).

## Abiertos para la fase 3 (frontend)

Detalle en las bitácoras de [dashboard](upgrade-superset-7/bitacora-dashboard.md), [gráficos](upgrade-superset-7/bitacora-charts.md)
y [resto del frontend](upgrade-superset-7/bitacora-appfe.md).

1. **Regenerar `package-lock.json` con npm** (se tomó el de 7.0 sin tocar), reconstruir las `lib/` de los paquetes,
   `tsc`, oxlint y build. React 17 → 18, antd 6, TypeScript de 7.0.
2. **Rutas sin `/superset/`:** `REPORT_PATH`/`isReportRoute` en `src/mibi/shell/navigation.ts` ya no reconoce
   `/dashboard/<id>/` (los tableros salen con barra lateral) y hay rutas fijas en `ExploreGate.tsx`, `HOME_URL`,
   `WorkspacePage.tsx` y `DatasetPage.tsx`.
3. Código del fork que lee `owners` (`ChartFieldsSections.tsx`, `chartFields.ts`).
4. Explore pasó de react-dnd a dnd-kit: comprobar el arrastre desde el panel Datos/Campos.
5. Selectores de antd 5 en `skin.css` y `dashboard/styles.ts`.
6. Portados a mano y sin probar: `TableRenderers.tsx` del pivot (7.0 lo pasó a hooks), `EchartsTimeseries.tsx`,
   `Timeseries/transformProps.ts`, `SliceAdder`, `DashboardGrid`, `Markdown`, `Vertical`, `PropertiesModal`,
   `SaveModal`, `ChartRenderer`, `ChartCreation`. Pasar Jest de `src/mibi` y de esos archivos con
   `jest.worktree.config.js`.
7. `ControlForm` de 7.0 descarta lo pendiente al desmontar (el fork lo enviaba). `/list_groups/` sigue fuera
   (lo quitó el fork en `b36833af36` sin decirlo): confirmar.

## Abiertos para la fase 4 (funciones que chocan)

1. Modo móvil de consumo de 7.0 (`MOBILE_CONSUMPTION_MODE`, apagado) frente a `mibiMobile`: incluido pero inerte en
   varios componentes; decidir si se quita.
2. Historial de versiones y soft delete (activos por defecto en 7.0): columna nueva en la rejilla, el panel de filtros
   acoplado no se bloquea al previsualizar y la vista previa hidrata un tema (no hay temas).
3. ECharts: leyenda HTML de Timeseries (vuelve con Todo/Invertir y sin nuestro formato de leyenda), `gridlines`/`axisTicks`
   de 7.0 frente a `gridline_*`, etiquetas de barras «Auto», donut con arcos parciales y `showTotal`, Butterfly y Bullet.
4. Pivot: `showValuesAs` frente al formato de columna. Table V2 sin nuestro formato.
5. Tooltip de descripción del gráfico (no adoptado, lo cubre `HeaderExtras`), color picker del formato condicional,
   capas semánticas frente a datasets por workspace en `ChartCreation`.
