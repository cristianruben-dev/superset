# Plan: datos y SQL dentro del tablero (modelo Power BI)

Fecha: 2026-11-01 · Rama base: `main`

**Estado:** fases 1–6 implementadas (sin commit). Diferencias con el plan: los datasets del
espacio son una sección «Conjuntos de datos» bajo los tableros, no una pestaña; no hay botón
«Asignar datasets compartidos» para admins (se asignan creando el dataset desde un tablero o con
`PUT /api/v1/workspace/<id>/datasets/`); falta la prueba E2E de Playwright.

## Objetivo

Fuera del tablero solo hay **Inicio, Espacios de trabajo, Tableros y Administración**.
Todo lo que sirve para construir un informe (conexiones, conjuntos de datos, editor SQL,
consultas guardadas) se abre **desde el tablero**, en un panel lateral, igual que ya pasa
con los gráficos (`ChartEditorPanel` + `ExploreGate`).

Los conjuntos de datos pasan a **pertenecer a un espacio de trabajo** (como los modelos
semánticos de Power BI), y un gráfico solo puede usar conjuntos de datos de su espacio.

## Decisiones tomadas (cámbialas antes de empezar si no te cuadran)

| # | Decisión | Valor por defecto |
|---|---|---|
| D1 | Dueño de los conjuntos de datos | El **espacio de trabajo** (no cada tablero) |
| D2 | Conjuntos de datos sin espacio | Se consideran **compartidos**: cualquier tablero los puede usar (según permisos). Así no rompemos nada al migrar; un admin puede asignarlos luego |
| D3 | Tableros fuera de un espacio | Solo usan conjuntos de datos compartidos (sin espacio) |
| D4 | Botones de Datos/SQL en el tablero | Solo en **modo edición** y para quien puede editar (como Power BI Desktop) |
| D5 | Consultas guardadas | Siguen siendo de cada usuario; se ven dentro del panel SQL, no tienen pantalla propia |
| D6 | Conexiones (bases de datos) | Globales, en **Administración → Conexiones**; también se pueden crear desde «Obtener datos» del tablero |
| D7 | Lista de grupos (Security → List Groups) | Se elimina en la fase 1 (pendiente de tu confirmación) |
| D8 | Pestaña «Datos» en la página del espacio | Sí: lista los conjuntos de datos del espacio (ver, editar, borrar), como los modelos semánticos en el área de trabajo de Power BI |

Todo lo nuevo va detrás de una opción `MIBI_WORKSPACE_DATASETS = True` en
`superset/mibi_config.py`, como `MIBI_SINGLE_DASHBOARD_CHARTS`.

---

## Fase 1 — Navegación y pantalla principal (solo frontend)

**Resultado:** dentro del tablero no hay barra lateral; fuera, no aparecen Datos ni SQL.

1. **Tablero sin barra lateral** — `superset-frontend/src/mibi/shell/AppShell.tsx`
   - Nueva función `isReportRoute(pathname)` en `navigation.ts` (`/superset/dashboard/…`).
   - En esa ruta no se renderiza `<Sidebar>` y `Main` usa `$offset={0}`.
   - `TopBar` recibe `report` y muestra a la izquierda el logo (`ProductTag`) como enlace a
     Inicio y la migaja «Espacio › Tablero» (reusar `DashboardWorkspaceChip`). Se mantiene
     búsqueda (⌘K), «Nuevo» y menú de usuario.
   - El buscador (`CommandPalette`) sigue funcionando en el tablero para salir a otras pantallas.
2. **Menú lateral** — `superset-frontend/src/mibi/shell/navigation.ts`
   - Quitar la entrada «Datos» (`DATA_MENUS`, `DATA_URL`, `DATA_PATHS`) y la sección `sql`.
   - Mantener esos menús en `known` para que no caigan en la sección «Más».
   - Mover «Databases» a la sección `admin` con la etiqueta «Conexiones» (`/databaseview/list/`).
   - Quitar `List Groups` de `ICONS` (D7).
3. **Inicio** — `superset-frontend/src/mibi/home/HomePage.tsx` (`HomeBanner`)
   - Quitar las tarjetas `database`, `dataset` y `sql`. Dejar «Nuevo tablero» y añadir
     «Nuevo espacio de trabajo» (abre `WorkspaceModal`).
4. **Botón «Nuevo»** — `superset-frontend/src/features/home/RightMenu.tsx`
   - Quitar el submenú «Datos» (conectar BD, crear dataset, Google Sheets, subir archivos) y
     «Consulta SQL». Queda «Tablero» y, dentro de un tablero, «Gráfico».
5. **Lista de grupos (D7)** — `superset/initialization/__init__.py` (quitar `add_view(GroupsListView…)`
   y su import), `superset-frontend/src/views/routes.tsx` (ruta `/list_groups/`), traducción.
6. **Pruebas:** `AppShell.test.tsx` (sin sidebar en `/superset/dashboard/1/`),
   `navigation.test.ts` (sin Datos/SQL, Conexiones en admin), `HomePage.test.tsx`.

## Fase 2 — Panel lateral del tablero: Datos y SQL (solo frontend)

**Resultado:** en modo edición, el tablero tiene un menú «Datos» que abre conexiones,
conjuntos de datos y el editor SQL en un panel, sin salir del tablero.

1. **Generalizar el panel** — `src/mibi/chartEditor.ts` y `src/mibi/dashboard/ChartEditorPanel.tsx`
   - Renombrar a `src/mibi/dashboard/DashboardSidePanel.tsx` (+ `sidePanel.ts`) con un tipo
     `kind: 'chart' | 'sql' | 'data'`. Mantener `openChartEditor` como atajo.
   - Nuevo evento `mibi:open-side-panel` con `{ kind, url }`.
   - Ancho: `chart` como hoy; `sql` y `data` casi a pantalla completa (≈ 90 vw) porque
     SQL Lab necesita espacio.
   - Al cerrar el panel de datos o SQL, refrescar los gráficos del tablero (los datasets pudieron cambiar).
2. **Menú «Datos» en el encabezado** — `src/dashboard/components/Header/index.tsx`
   - En modo edición, un `Dropdown` «Datos» (nuevo `src/mibi/dashboard/DataMenu.tsx`):
     - «Obtener datos» → panel `data` en `/data/` (conectar BD, subir CSV/Excel/columnar).
     - «Conjuntos de datos» → panel `data` en `/data/` con la lista del espacio.
     - «Editor SQL» → panel `sql` en `/sqllab/?new=true`. Solo con permiso `can_sqllab`.
   - Cada URL lleva `mibi_panel=1` y `mibi_workspace=<id>` (si el tablero está en un espacio).
3. **Navegación dentro del panel** — `src/mibi/data/DataPage.tsx`, `DatasetPage.tsx`,
   `features/datasets/AddDataset/Footer/index.tsx`
   - El modo panel se lee una vez al cargar y la navegación SPA lo conserva; revisar que
     ningún enlace haga recarga completa ni use `window.open`.
   - Tras crear un dataset (`AddDataset/Footer`, línea ~111): en modo panel, avisar al tablero
     con `postMessage({ type: 'mibi:dataset-created', datasetId })` en lugar de ir a
     `/chart/add` o `/tablemodelview/list/`.
4. **SQL Lab en modo panel** — `src/SqlLab/components/SaveDatasetModal/index.tsx`,
   `ExploreResultsButton`
   - «Guardar dataset y explorar» hace `window.open` (línea ~218). En modo panel: enviar
     `mibi:dataset-created` al tablero, que cierra el panel SQL y abre el editor de gráfico
     con ese dataset (`/explore/?datasource_type=table&datasource_id=X&dashboard_id=Y`).
   - Revisar en `assets/mibi/skin.css` (`body.mibi-panel`) que SQL Lab se vea compacto.
5. **Pruebas:** `DashboardSidePanel.test.tsx` (abre cada tipo, recibe mensajes),
   `DataMenu.test.tsx` (solo en edición, SQL según permiso).

## Fase 3 — Bloquear las pantallas sueltas (solo frontend)

**Resultado:** si alguien entra por URL a SQL o a las listas globales, lo manda a su lugar.

1. Generalizar `src/mibi/ExploreGate.tsx` a `src/mibi/PanelGate.tsx`
   (`<PanelGate fallback="/dashboard/list/">`). `ExploreGate` lo usa con su lógica de `slice_id`.
2. En `src/views/routes.tsx`, envolver con `PanelGate`:
   - `/sqllab/`, `/sqllab/history/`, `/savedqueryview/list/` → `/dashboard/list/`
   - `/data/`, `/tablemodelview/list/`, `/dataset/add/`, `/dataset/:datasetId` → `/workspace/list/`
   - `/data/dataset/:datasetId/` **no** se bloquea: se abre también desde la pestaña Datos del espacio (D8).
   - `/databaseview/list/` no se bloquea: vive en Administración (D6).
3. Backend: `superset/mibi/data_views.py` y las vistas de SQL Lab solo sirven el SPA; no
   hace falta cambiarlas. Las APIs siguen igual (el panel las usa).
4. **Pruebas:** `PanelGate.test.tsx` (redirige fuera del panel, renderiza dentro).

## Fase 4 — Conjuntos de datos por espacio de trabajo (backend)

**Resultado:** cada dataset puede pertenecer a un espacio; las listas y los gráficos lo respetan.

1. **Modelo** — `superset/mibi/models.py`
   - `WorkspaceDataset` (tabla `mibi_workspace_datasets`): `id`, `workspace_id` (FK
     `ON DELETE CASCADE`), `dataset_id` (FK `tables.id`, `ON DELETE CASCADE`, `unique=True`),
     igual que `WorkspaceDashboard`. Relación `Workspace.datasets`.
2. **Migración** — `superset/migrations/versions/2026_11_04_…_mibi_workspace_datasets.py`
   con `down_revision = "c5f08a1d7e42"`. Usar los helpers de `superset.migrations.shared.utils`.
   Actualizar la cadena en `CLAUDE.md`.
3. **Asignación inicial** — `superset/mibi/assign_workspace_datasets.py` (como
   `split_shared_charts.py`), llamada desde la migración: un dataset se asigna a un espacio
   si **todos** los tableros que lo usan están en ese mismo espacio. El resto queda compartido (D2).
4. **Visibilidad** — `superset/mibi/workspace_access.py`
   - `dataset_visibility_filter(dataset_id)`: datasets compartidos + los de mis espacios;
     `None` para admins o con `MIBI_WORKSPACE_ACCESS = False`. Igual que `dashboard_visibility_filter`.
   - Nuevo `WorkspaceDatasetFilter` añadido a `DatasetRestApi.base_filters`
     (`superset/datasets/api.py:102`). Esto filtra también el selector de Explore, la
     creación de gráficos (`ChartCreation`) y el modal de SQL Lab, que usan `/api/v1/dataset/`.
   - La pertenencia nunca da acceso a los datos: siguen haciendo falta los permisos del dataset.
5. **Regla de uso** — nuevo `superset/mibi/workspace_datasets.py`
   - `validate_chart_dataset(dashboard_ids, datasource_id)`: el dataset debe ser compartido
     o del espacio del tablero; si no, error 422 legible.
   - Llamarla en `superset/commands/chart/create.py` y `update.py` junto a `validate_chart_dashboards`.
   - Llamarla en las herramientas MCP (`mcp_service/dashboard/tool/generate_dashboard.py`,
     `add_chart_to_existing_dashboard.py`).
   - Al mover un tablero de espacio (`WorkspaceRestApi.put_dashboards`, `workspaces.py:516`):
     si sus gráficos usan datasets de otro espacio, error 422 con la lista de datasets.
6. **API** — `superset/mibi/workspaces.py`
   - `GET/PUT /api/v1/workspace/<pk>/datasets/` (listar, asignar/quitar; editor del espacio).
   - `GET /api/v1/workspace/of_dataset/<dataset_id>/`.
   - Añadir `datasets` (conteo) a `serialize()`.
7. **Opción** — `MIBI_WORKSPACE_DATASETS = True` en `superset/mibi_config.py`.
8. **Pruebas:** `tests/unit_tests/mibi/test_workspace_datasets.py` (filtro, regla de uso,
   asignación inicial, API, mover tablero).

## Fase 5 — Conectar el frontend con los espacios

1. **Asignar al crear** — nuevo `src/mibi/workspaces/datasets.ts` con
   `linkDatasetToWorkspace(datasetId)`, que lee `mibi_workspace` de la URL del panel y llama
   a `PUT /api/v1/workspace/<id>/datasets/`. Llamarla en:
   - `features/datasets/AddDataset/Footer` (crear dataset),
   - `SqlLab/components/SaveDatasetModal` (guardar resultado como dataset),
   - el modal de subida de archivos (`features/databases/UploadDataModel`), con el dataset que crea.
2. **Pestaña Datos del espacio (D8)** — `src/mibi/workspaces/WorkspacePage.tsx`
   - Pestañas «Tableros» y «Datos». «Datos» lista los datasets del espacio (reusar la tabla de
     `DataPage.tsx`) con abrir (`/data/dataset/:id/`), quitar del espacio y borrar.
   - Admins: botón «Asignar datasets compartidos».
3. **`DataPage` en el panel** — mostrar solo los datasets del espacio del tablero y los
   compartidos, con una etiqueta «Compartido» en estos.
4. **Pruebas:** `workspaces.test.tsx`, `data.test.tsx`.

## Fase 6 — Cierre

1. **Traducciones** — `superset/translations/es/LC_MESSAGES/messages.po` (tuteo, «»):
   «Obtener datos», «Editor SQL», «Conexiones», «Compartido», «Asignar datasets compartidos»,
   errores 422, pestañas del espacio. `npm run build-translation`.
2. **Docs** — `CLAUDE.md` (tabla «Where the code lives», reglas de producto, cadena de
   migraciones) y `README.md`.
3. **E2E** — `superset-frontend/playwright/tests/experimental/dashboard/data-panel.spec.ts`:
   abrir tablero (sin sidebar) → editar → Datos → crear dataset desde SQL → crear gráfico con él.
4. **Validación** — `npm run lint`, `npm run type`, `npm run test`,
   `pytest tests/unit_tests/mibi/`, `pre-commit run --all-files`.

## Orden y commits sugeridos

| Fase | Commit(s) |
|---|---|
| 1 | `feat(shell): hide the sidebar inside dashboards` · `feat(shell): remove data and SQL from the main navigation` · `refactor(security): remove the groups list` |
| 2 | `feat(dashboard): open data and SQL Lab in the dashboard side panel` |
| 3 | `feat(shell): send standalone data and SQL pages to their dashboard` |
| 4 | `feat(workspaces): datasets belong to a workspace` (modelo, migración, API, reglas) |
| 5 | `feat(workspaces): link new datasets and list them on the workspace page` |
| 6 | `docs(mibi): document dashboard-centric data` · traducciones con cada fase |

Las fases 1–3 son independientes del backend y se pueden entregar primero.
La 5 depende de la 4.

## Riesgos

- **SQL Lab en un iframe:** es la pantalla más pesada; hay que probar memoria y el atajo
  ⌘K/⌘Enter dentro del panel.
- **Datasets ya usados por varios espacios:** quedan compartidos (D2); si quieres que todo
  tenga dueño, habría que duplicarlos como hicimos con los gráficos (`split_shared_charts.py`).
- **Embebidos e invitados:** el filtro debe devolver `None` para usuarios invitados, como el de tableros.
