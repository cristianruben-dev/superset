# Plan: AuraData BI completo desde el MCP, documentado y sin «mibi»

Fecha: 2026-11-04 · Rama base: `main` (`6f7a66ca88`)

**Objetivo.** Que una IA conectada al MCP pueda hacer prácticamente todo lo que hace una persona en AuraData BI:
crear workspaces, conectar datos, armar un informe con páginas, gráficos, formato, segmentadores, marcadores,
páginas tooltip y diseño móvil, publicarlo, compartirlo y programar su envío. Y, en paralelo, documentar el
producto y quitar el nombre interno `mibi` de todo lo que se pueda quitar.

Tamaños: **S** (un día o menos), **M** (unos días), **L** (una semana o más).

## Dónde estamos

- El MCP es el de Superset 7.0 (`superset/mcp_service/`, unas 60 herramientas): gráficos, tableros, datasets,
  SQL Lab y lecturas de usuarios, roles, RLS, informes y tags.
- Del fork solo sabe dos cosas, en `generate_dashboard` y `add_chart_to_existing_dashboard`: la regla de un tablero
  por gráfico y la de datasets del workspace.
- Todo lo demás del fork (formato, cuadrícula de celdas, posiciones, elementos, segmentadores, marcadores, páginas
  tooltip, diseño móvil) **solo existe como tipos y lógica de TypeScript** (`src/mibi/format/types.ts`,
  `positions.ts`, `cells.ts`, `actions.ts`, `mobileLayout.ts`, `elements/types.ts`, `report/*`). El backend guarda
  `position_json` sin entenderlo. Por eso la pieza central del plan no es una herramienta: es una **biblioteca de
  layout en Python** que hable el mismo idioma que el frontend.

### Problemas ya encontrados

1. `update_dashboard` no valida la regla de un tablero por gráfico (pendiente 7 de `upgrade-superset-7.md`).
2. **Probable bug de tamaño.** `dashboard/constants.py:41` (`layout_column_count`) lee `mibiColumns`, la clave de
   antes de la cuadrícula de celdas:
   - Un tablero ya convertido (`mibiCells`, 60 columnas) devuelve 12.
   - `add_chart_to_existing_dashboard` añadiría entonces un gráfico de 4 celdas de ancho y sin `mibiPos`.
   - `generate_dashboard` escribe un layout de 12 columnas que el frontend convierte al abrir (`layoutToCells`).
     Funciona, pero queda guardado en el formato viejo hasta que alguien lo edita.
   - **Falta comprobarlo con un test** antes de darlo por bug.
3. `meta.mibiFormat.chart` gana sobre el `form_data` guardado. Si un gráfico tiene esa clave en el layout, un
   `update_chart` del MCP puede no cambiar nada en el tablero. Hace falta una regla (ver fase 4).
4. Carpetas vacías tras el upgrade: `mcp_service/theme/` y `mcp_service/annotation_layer/` (solo `__pycache__`) y
   `mcp_service/screenshot/` (solo `__init__.py`).
5. No hay exportación PNG/PDF de un tablero por MCP: la de AuraData (`src/mibi/export`) es del navegador.
   `get_chart_preview` solo cubre un gráfico.

## Principios

1. **Herramientas semánticas, no `position_json` crudo.** La IA pide «añade un segmentador de Región en la página
   Ventas, como botones, arriba a la izquierda». No escribe claves `meta.*` a mano. Así las claves internas (y su
   nombre) dejan de importar fuera del código.
2. **Una sola verdad para el layout.** Hay que crear `superset/auradata/layout/`: modelos pydantic de `CanvasFormat`,
   `VisualFormat`, elementos, marcadores, páginas tooltip y diseño móvil, más las funciones de `cells.ts`,
   `positions.ts` (`freeCell`), `columns.ts` y `mobileLayout.ts`.
   - **Guardia contra la deriva:** fixtures JSON compartidos (`tests/fixtures/auradata/layouts/*.json`) que pasan
     por Jest y por pytest y deben dar el mismo resultado.
   - Un test de contrato falla si TS añade una clave que Python no conoce.
3. **Las mismas reglas que la interfaz.** Toda escritura pasa por los comandos y validadores existentes:
   - un tablero por gráfico, datasets del workspace;
   - `can_edit_resource`/`raise_for_editorship` y `workspace_grants`, nunca solo `class_permission_name`, que es el
     permiso de ruta de FAB.
   - Así cada cambio queda en el historial de versiones, y deshacer es restaurar una versión.
4. **La IA tiene que poder ver lo que hizo.** Una captura del tablero o de una página (con el Chromium de Playwright
   que ya trae `prod`) cierra el ciclo: construir, mirar, corregir.
5. **Pocas herramientas ricas mejor que muchas pobres.** Por ejemplo, `format_visual` con un parche, en vez de una
   herramienta por opción. Con más de 100 herramientas, hay que activar `MCP_TOOL_SEARCH_CONFIG` (ya existe en
   `server.py`) y etiquetar por área.
6. **Cada herramienta nueva trae** su test de permisos (viewer, contributor, admin del workspace, otro workspace),
   su entrada en `test_tool_inventory.py`, `test_mcp_tool_registration.py` y `COMMITTED_WRITE_SPECS`, y su página
   en la referencia (fase D).
7. **El código nuevo nace como `auradata`**, nunca como `mibi` (ver bloque R).

## Inventario completo: qué hace AuraData BI y qué podrá hacer el MCP

Una fila por cada regla de «AuraData BI: What This Fork Changes» del `CLAUDE.md`. «Hoy» es lo que hace el MCP en
`6f7a66ca88`.

| # | Función del producto | Hoy | Hueco | Herramientas propuestas | Fase |
| ---: | --- | --- | --- | --- | :---: |
| 1 | Español primero | Descripciones y errores en inglés | Los textos que crea la IA (títulos, etiquetas) no saben el idioma del usuario | `get_instance_info` devuelve idioma y convenciones; prompt de estilo | 11 |
| 2 | Un tablero por gráfico | En crear y añadir | `update_dashboard` | Validar en `update_dashboard`, `duplicate_dashboard` y `restore_*` | 0 |
| 3 | Informes desde su tablero (sin lista de gráficos) | `list_charts` y `generate_chart` sueltos | Un gráfico sin tablero es un huérfano en este producto | `create_visual` (gráfico + lugar en la página en un paso); `generate_chart` exige o sugiere tablero | 4 |
| 4 | Workspaces, miembros y roles | Nada | Todo | `list/get/create/update/delete_workspace`, `list/set/remove_workspace_member`, `list_member_candidates`, `move_dashboard_to_workspace`, `get_workspace_of_dashboard`, imagen del workspace | 1 |
| 5 | Permisos de contributor sin ser editor | Las herramientas de gobierno piden editoría real | Un contributor no puede editar por MCP lo que sí edita en la web | Toda escritura de tablero o gráfico usa `can_edit_resource` | 1 |
| 6 | Concesión de datos por workspace | Parcial (lecturas de Superset) | `list_datasets`/`query_dataset` sin `WorkspaceDatasetFilter` ni la concesión | Mismos filtros que la API REST, con test | 1 |
| 7 | Flags fijados por el producto | n/a | Nada que exponer | — | — |
| 8 | Papelera e historial de versiones | `restore_chart`, `restore_dashboard` | No lista papelera ni versiones ni restaura una versión | `list_trash` (workspace y global), `list_versions`, `get_version_diff`, `restore_version` | 9 |
| 9 | Datasets por workspace | Validación al crear tablero | Crear un dataset dentro de un workspace, moverlo, compartirlo | `create_dataset(workspace_id)`, `move_dataset_to_workspace`, filtro `dataset_usable_in_dashboard` | 1 |
| 10 | Marca AuraData | n/a | La IA no conoce paleta ni tipografía | Recurso `auradata://brand` y prompt de diseño | 11 |
| 11 | Bases de datos ofrecidas (6 motores) | `list/get_database` | No puede crear conexiones | `test_connection`, `create_database` (solo admin; ver Decisiones) | 8 |
| 12 | Cinta (Inicio, Insertar, Diseño, Vista) | n/a | Es interfaz; sus comandos son acciones que sí hay que cubrir | Cubiertas por las fases 2–7 | — |
| 13 | Título y acciones en la barra superior, márgenes, crumbs, barra de menús, barra de estado | n/a | Interfaz pura | — | — |
| 14 | Aspecto fijo (claro/oscuro), `css` propio del tablero | `update_dashboard` toca `css`? sin comprobar | Editar el `css` del tablero | `set_dashboard_css` (con aviso de clases internas) | 3 |
| 15 | Lienzo de tamaño fijo (16:9, 4:3, carta, propio) | Nada | Todo | `set_canvas_format` (tamaño, fondo, papel tapiz, imagen) | 3 |
| 16 | Formato compartido de visuales («Aplicar a todos») | Nada | Todo | `set_shared_visual_format`, `copy_format` | 3 |
| 17 | Formato propio de un gráfico (`mibiFormat`) | Nada | Todo | `get_format_options(viz_type)`, `format_visual` (parche por nivel: Visual, General, Analítica) | 3 |
| 18 | Opciones del gráfico en el layout (`mibiFormat.chart`) | Nada; además puede tapar `update_chart` | Conflicto con `form_data` | Regla de fase 4; `format_visual` escribe ahí lo visual | 3–4 |
| 19 | Barras, líneas, combos: series, ejes, etiquetas, eje secundario, zoom | Parcial en `generate_chart` | Opciones de `chartFormatOptions.ts` | Catálogo generado (fase 3) + `format_series` | 3 |
| 20 | Tarjetas, KPI, gauge, donut, waterfall, tablas y matrices | Parcial | Opciones del fork | Catálogo generado | 3 |
| 21 | Encabezado, botón de acción, enlace, espaciado, tooltip y muestreo de ECharts | Nada | Todo | Dentro de `format_visual` (nivel General) | 3 |
| 22 | Elementos de diseño: imagen, forma, botón, texto | Nada | Todo | `add_element` (tipo + ajustes), `update_element`, subida de imágenes | 5 |
| 23 | Segmentador del lienzo (`mibi-filter`) y sus variantes | Nada | Todo | `add_slicer` (lista, desplegable, botones, texto, rango, fecha), `update_slicer`, `format_slicer` | 5 |
| 24 | Cuadrícula de celdas y posiciones absolutas | Escribe 12 columnas y sin posición | Bug probable (ver arriba) | `place_object`, `move_object`, `resize_object`, `align_objects`, `distribute_objects`, `bring_to_front` | 2 |
| 25 | Diseño móvil por página | Nada | Todo | `generate_mobile_layout` (automático), `set_mobile_layout`, `clear_mobile_layout` | 7 |
| 26 | Apariencia por color de fondo | n/a | Sale sola del fondo | — | — |
| 27 | Ocultos, bloqueados, texto alternativo, páginas ocultas | Nada | Todo | `set_object_state` (oculto, bloqueado, alt), `set_page_hidden` | 2 |
| 28 | Marcadores | Nada | Todo | `list/create/update/delete_bookmark`, botón a marcador | 6 |
| 29 | Obtener detalles (drill through) | Nada | Todo | `set_drillthrough_page`, `clear_drillthrough_page` | 6 |
| 30 | Editar interacciones | Nada | Todo | `set_visual_interactions` (filtra o nada, por par de visuales) | 6 |
| 31 | Sincronizar segmentadores | Nada | Todo | `sync_slicer` (alcance + copias en páginas) | 6 |
| 32 | Páginas tooltip | Nada | Todo | `make_tooltip_page`, `set_visual_tooltip` | 6 |
| 33 | Restablecer filtros | n/a | Es una acción del lector; la IA puede leer los valores por defecto | `get_filter_defaults` en lectura | 6 |
| 34 | Barra de páginas y panel de filtros | n/a | Interfaz | — | — |
| 35 | Filtros nativos por nivel (todas las páginas, esta página, visuales), aplicar al instante | `manage_native_filters` de Superset | Los niveles y `filter_bar_auto_apply` del fork | Extender `manage_native_filters` | 6 |
| 36 | Campos del gráfico (nivel Campos) y cambiar su dataset | `update_chart` | Mantener `query_context` al día y las reglas de `fieldsKeptBy` | `set_visual_fields`, `change_visual_dataset` | 4 |
| 37 | Orden de los visuales | Nada | Todo | `set_visual_sort` | 4 |
| 38 | Analítica: líneas de referencia, tendencia, campos de tooltip, multiples pequeños | Nada | Todo | Dentro de `format_visual` (nivel Analítica) | 3 |
| 39 | Páginas (añadir, renombrar, ordenar, duplicar, borrar) | Nada | Todo | `add_page`, `rename_page`, `reorder_pages`, `duplicate_page`, `delete_page` | 2 |
| 40 | Exportar PNG/PDF y presentar | Nada | Exportar sí; presentar es interfaz | `export_dashboard_image`, `export_dashboard_pdf` (servidor, Playwright) | 10 |
| 41 | Informes y alertas programados | Solo lectura | Crearlos | `create/update/delete_report`, `create_alert` | 10 |
| 42 | Compartir: enlace permanente, publicar, editores y visores | Parcial | Publicar y miembros del workspace | `publish_dashboard`, `share_dashboard` | 10 |
| 43 | Página de inicio, lista de tableros, recientes | `list_dashboards` | Recientes es del navegador | — | — |

**Lo que no se hará por MCP, a propósito:** preferencias del navegador («Bloquear objetos» del editor, vista del
diseño móvil, recientes), el modo presentación y todo lo que es solo interfaz (cinta, barras, crumbs). Sus efectos
sobre el informe sí están cubiertos.

## Orden propuesto

| Bloque | Qué | Tamaño | Por qué en este lugar |
| ---: | --- | :---: | --- |
| 0 | Arreglos del MCP actual | S | Agujeros de reglas del producto; corrección antes que funciones |
| R1–R2 | Renombrado del código y la configuración | M | Antes de escribir cientos de líneas nuevas que nacerían como `mibi` |
| R3–R4 | Renombrado de datos guardados (tablas, claves del layout, paleta, CSS, historial) | L | Decidido; tras R1 y antes de la fase 2, para que la biblioteca de layout nazca con las claves nuevas |
| 1 | Workspaces, permisos y datos por workspace | M | Es lo primero que necesita la IA para trabajar donde corresponde |
| 2 | Biblioteca de layout en Python + páginas y posiciones | L | Base de las fases 3–7 |
| 3 | Formato (catálogo generado, lienzo, visuales) | L | Lo que hace que un informe parezca Power BI |
| 4 | Visuales dentro del informe: crear, campos, dataset, orden | M | Junta `generate_chart` con el tablero |
| 5 | Elementos y segmentadores | L | |
| 6 | Interactividad: filtros por nivel, marcadores, drill through, interacciones, sincronizar, páginas tooltip | L | |
| 7 | Diseño móvil | M | |
| 8 | Conexiones y modelo de datos | M | Depende de la decisión sobre credenciales |
| 9 | Papelera e historial | S–M | |
| 10 | Captura, exportación, informes programados, compartir | M | La captura conviene adelantarla a la fase 2 (ver nota) |
| 11 | Prompts, recursos y guía de estilo para la IA | M | Que la IA no solo pueda, sino que haga buenos informes |
| 12 | Evaluación de punta a punta | M | Prueba que lo que escribe Python lo dibuja TS |
| D | Documentación | M, continua | Cada fase deja su parte; al final se ordena |

**Nota sobre la captura:** `get_dashboard_screenshot` vale más que su fase. Conviene hacerla al final de la fase 2,
para que las fases 3–7 se prueben mirando el resultado.

---

## 0. Arreglos del MCP actual (S)

1. `update_dashboard` valida un tablero por gráfico con `superset/mibi/single_dashboard.py`, como sus hermanos.
2. Un test que añada un gráfico a un tablero ya convertido a celdas:
   - Si sale de 4 celdas y sin `mibiPos`, arreglar `layout_column_count` con la lógica de `columnCountOf` (celdas
     primero, `mibiColumns` solo para layouts viejos).
   - Que `generate_dashboard` escriba directamente en celdas con posición.
3. Borrar `mcp_service/theme/`, `annotation_layer/` y `screenshot/` si siguen vacías.
4. `duplicate_dashboard` y `restore_*`: comprobar que respetan las dos reglas del fork.

**Listo cuando:** los tests de `tests/unit_tests/mcp_service/dashboard/` pasan, con los nuevos casos.

**Hecho (2026-11-04, rama `fix/mcp-phase-0`):**
1. `update_dashboard` **no tenía el agujero**. `validate_dashboard_layout` (de `mcp_service`) rechaza un layout que
   nombre un gráfico que el tablero no tiene, así que no puede traer uno de otro tablero. Queda fijado con un test.
2. **El bug de tamaño era real** (RED: el gráfico salía de 4 de ancho y sin `mibiPos`).
   - `constants.py` gana `is_in_cells`, `canvas_cells` y `free_cell`, calcados de `columnCountOf` y `freeCell`.
   - En un layout en celdas, `add_chart_to_existing_dashboard` pone el gráfico de 12 × 12 celdas en la primera celda
     libre de su página. El layout viejo sigue como estaba.
3. `generate_dashboard` sigue escribiendo el layout viejo, que el frontend convierte al abrir. Escribirlo en celdas
   obliga a decidir qué pasa cuando no entra en la página (`layoutToPositions` agranda el lienzo), así que pasa a la
   fase 2, con la biblioteca de layout.
4. Duplicar y restaurar ya respetan las reglas: `DashboardDAO.copy_dashboard` copia siempre los gráficos y deja la
   copia en el workspace del original, y `RestoreDashboardCommand` usa `find_charts_blocking_restore`. Lo que fallaba
   era la descripción que lee la IA (decía que la copia comparte los gráficos); ya está corregida.
5. Se borraron `mcp_service/theme/` y `annotation_layer/`, que solo tenían caché. `screenshot/__init__.py` se queda
   para las capturas de la fase 2.
6. Al pasarle el lint a los commits de la cinta apareció un `{ … }` sobrante en `TitleSections.tsx`; ya está
   arreglado.

## R. Renombrado de `mibi` a AuraData BI

El `CLAUDE.md` dice hoy: «Internal names keep the `mibi` prefix… saved dashboards and migrations depend on them».
Pediste quitarlo. Medido en `6f7a66ca88`:
- 275 rutas con `mibi` en el nombre;
- 2343 apariciones en 359 archivos (sin contar `.po`);
- 10 claves `MIBI_*`.

No todo pesa igual, así que va en cuatro capas:

| Capa | Qué | Riesgo | Cómo |
| --- | --- | --- | --- |
| R1 | Rutas y nombres del código: `superset/mibi` → `superset/auradata`, `src/mibi` → `src/auradata`, `mibi_config.py` → `auradata_config.py`, `MibiRestApi`, funciones, componentes, clases CSS no guardadas, tests, docs | Bajo; ningún dato | `git mv` + reemplazo mecánico, un commit por área (backend, frontend, CSS, docs). Antes: mergear o guardar los cambios abiertos en `main` (hay 14 archivos modificados) para no chocar |
| R2 | Configuración y entorno: `MIBI_SINGLE_DASHBOARD_CHARTS`, `MIBI_WORKSPACE_*`, `MIBI_SEND_REPORTS`, `MIBI_PUBLIC_URL`, `MIBI_PORT`, `MIBI_HTTPS`, `MIBI_IMAGE`… | Bajo: el producto no ha salido, no hay despliegues con `.env` viejos | Nombre nuevo `AURADATA_*`, sin leer el viejo (decidido 2026-11-04). Actualizar `docker/.env-prod.example`, compose, `Dockerfile`, README y el `.env` local de desarrollo |
| R3 | Tablas `mibi_workspaces`, `mibi_workspace_dashboards`, `mibi_workspace_members`, `mibi_workspace_datasets`, `mibi_dashboard_backgrounds` | Alto (dato guardado), pero mecánico | Migración Alembic `rename_table` sobre la cabeza del fork (`f1c7a9e2b305`), con `downgrade`; probar base nueva y copia en la cabeza anterior |
| R4 | Claves del layout `meta.mibi*` (en cada `position_json`), `componentKey` `mibi-*`, paleta `mibi` en `json_metadata`, clases `.mibi-*` que un usuario pudo usar en el `css` de su tablero | Alto | Decidido (2026-11-04): se renombran también. Diseño abajo |

**R1 hecho (2026-11-04):** código en `superset/auradata`, `src/auradata`, ids de test `auradata-*`
(`10d5eeacf0`…`ff69dc645d`).

**R2 hecho (2026-11-04, rama `refactor/rename-auradata-config`):** `MIBI_*` → `AURADATA_*` en código, tests,
configuración de producción y `.env-prod.example`, sin leer los nombres viejos; `docker/mibi` → `docker/auradata`,
anclas del compose y la imagen por defecto `auradata-bi:latest`. Los `.env` locales no usaban ninguna variable `MIBI_*`.

**R3 y R4 hechos (2026-11-04, rama `refactor/rename-auradata-data`):** todo nombre guardado pasa a `auradata`: tablas
`auradata_*` (con sus constraints, índices y secuencias en PostgreSQL), claves `meta.auradata*`, `componentKey`
`auradata-*`, paleta `auradata`, claves de form data `auradata_*`, data mask `auradata-drillthrough`, clases
`.auradata-*`, atributos `data-auradata-*`, variables `--auradata-*`, ids `__auradata*`, parámetros
`auradata_panel`/`auradata_dock` y claves `localStorage` `auradata.*` (las preferencias se reinician una vez). También
los restos de R2: `POSTGRES_DB/USER`, el remitente por defecto y los prefijos de caché de producción.
- Migración `a7e3c91d4b60` (sobre `f1c7a9e2b305`): renombra las tablas y reescribe `dashboards`, `slices`,
  `dashboards_version`, `slices_version` y los enlaces permanentes de `key_value` por lotes, con expresiones ancladas en
  la comilla JSON (o el selector CSS), sin reformatear el JSON ni tocar palabras como «Namibia». Usa SQL Core, no el
  ORM, para no saltarse las filas en la papelera ni crear versiones.
- Probada en una copia de la base de desarrollo: `upgrade` deja 0 claves viejas; `downgrade` devuelve las columnas
  reescritas byte a byte (md5 por tabla) y los mismos nombres de esquema; un enlace permanente sintético va y vuelve.
- Guardia: `tests/unit_tests/auradata/naming_guard_test.py` falla si el prefijo viejo vuelve al código.
- Se quitó el test de `workspace_datasets_test.py` que ejecutaba la migración histórica `d3f9a2b17c64`: escribe en las
  tablas `mibi_*`, que el esquema actual ya no tiene.

### R4: renombrar los datos guardados (decidido)

**Qué se guarda con `mibi` y dónde:**

| Dónde | Qué |
| --- | --- |
| `dashboards.position_json` | `meta.mibiFormat`, `mibiCanvas`, `mibiPos`, `mibiLocked`, `mibiHidden`, `mibiElement`, `mibiAltText`, `mibiTooltipPage`, `mibiMobile`, `mibiBookmarks`, `mibiDrillthrough`, `mibiHiddenPage`, `mibiCells`, `mibiFieldStep`, `mibiColumns` (de layouts viejos) y `componentKey` `mibi-*` |
| `dashboards.json_metadata` | paleta `mibi` (`color_scheme`, y en los ajustes de cada gráfico) |
| `dashboards.css` | clases `.mibi-*` que un usuario pudo usar |
| Marcadores (dentro de `mibiBookmarks`) | el data mask `mibi-drillthrough` |
| `dashboards_version`, `slices_version` | las mismas claves en las versiones guardadas (historial de 7.0) |
| `key_value` (enlaces permanentes) | estado del tablero con data masks `mibi-drillthrough` |
| `localStorage` de cada navegador | `mibi.clipboard`, `mibi.grid`, `mibi.mobileView`, `mibi.sidebarCollapsed`… |

**Cómo (simplificado el 2026-11-04: el producto no ha salido).** No hay despliegues, ZIP exportados ni enlaces
permanentes de terceros que cuidar, así que no hace falta un traductor permanente ni un lector doble:
1. **El código pasa a `auradata*` de una vez:** claves del layout, `componentKey`, paleta, clases CSS,
   `mibi-drillthrough` y claves de `localStorage`. Las preferencias del navegador (rejilla, portapapeles, barra
   lateral) se reinician una vez; no se migran.
2. **Una sola migración de datos** (Alembic, sobre la cabeza del fork), para que la base de desarrollo conserve sus
   tableros (142, 147…). Traduce `position_json`, `json_metadata` y `css` de `dashboards`, de
   `dashboards_version`/`slices_version` y de los enlaces de `key_value`. Va por lotes y tiene `downgrade`.
3. **Un test de guardia:** falla si vuelve a aparecer una clave `mibi` en el código.
4. **El orden importa.** R4 va después de R1 y junto al frontend que lee las claves nuevas: el build viejo con datos
   migrados perdería el formato.
5. **Pruebas,** en una base desechable copiada de la de desarrollo, nunca en la propia:
   - `upgrade` → abrir el tablero 147 sin cambios (formato, segmentadores, marcadores, diseño móvil, páginas
     tooltip) → `downgrade` → `upgrade`;
   - restaurar una versión de antes.

**Tamaño:** L. Riesgo item 1 (datos guardados): commit propio y verificación independiente.

**Listo cuando:** `git grep -i mibi` solo devuelve lo que la decisión de R4 deja, más los comentarios de migraciones
históricas. El `CLAUDE.md` del proyecto y el de `mcp_service` reescriben su regla de nombres.

## 1. Workspaces, permisos y datos por workspace (M)

- Herramientas de la fila 4, sobre `WorkspaceRestApi` (reutilizar sus comandos y filtros, no reescribirlos).
- `move_dashboard_to_workspace` y `move_dataset_to_workspace` validan como la web: un gráfico solo usa datasets de
  su workspace o compartidos.
- Pasar las escrituras de tablero y gráfico del MCP a `can_edit_resource` (fila 5).
- `list_datasets`, `get_dataset_info` y `query_dataset` con `WorkspaceDatasetFilter` y la concesión de
  `workspace_grants.py`. Probarlo con un viewer, que no lee datasets del workspace.
- **Listo cuando:** un contributor hace por MCP lo mismo que en la web, y un viewer no hace más.

**Hecho (2026-11-04, rama `feat/mcp-workspaces`):**
1. `84a5f69362`: la lógica de `WorkspaceRestApi` sale de sus handlers a funciones de `superset/auradata/workspaces.py`
   (`find_workspace`, `move_dashboards`, `move_datasets`, `set_member`, `remove_member`, `member_candidates`...),
   que lanzan errores con su código HTTP. La API REST y el MCP usan las mismas.
2. `5f5bde014b`: módulo `mcp_service/workspace/` con las 12 herramientas de la fila 4 (sin la imagen del workspace),
   etiquetadas `workspace`. Mover un tablero o un dataset a `null` lo saca de su workspace (dataset compartido).
   Tests de permisos con base real: viewer, contributor, admin del workspace, otro workspace y admin global.
3. `4638655f8b`: **las escrituras de tablero y gráfico ya respetaban el rol de workspace** (todas pasan por
   `raise_for_editorship`, que incluye el rol). No hizo falta cambiar código: quedan fijadas con tests (editar,
   añadir y quitar gráficos, filtros nativos, copiar, borrar), y que el contributor no pasa a ser editor.
   Certificar, dueños y roles siguen pidiendo editoría real (decisión de `591bd8a88b`).
4. `74a1143244`: **el agujero de datos era real**. Un usuario con permisos de datos que no es miembro veía los
   datasets de un workspace en `list_datasets`, `get_dataset_info` y `query_dataset`. Ahora aplican
   `WorkspaceDatasetFilter` como la API REST. `list_datasets` gana `usable_in_dashboard` (fila 9).
5. `3007be04e8`: mover no revela el workspace de origen si no eres miembro; `update_workspace` acepta `null` para
   borrar descripción o color. `074da0079d`: las escrituras también funcionan para un contributor sin permisos de
   datos (solo con la concesión del workspace). `360376d995`: `get_table` tenía el mismo agujero que
   `query_dataset`; ya aplica las reglas.
6. `81a125910c`: `list_metrics`, `get_compatible_metrics`, `get_compatible_dimensions` y `generate_explore_link`
   tenían la misma fuga; ya tratan como inexistente un dataset oculto por las reglas de workspace.
   `get_dashboard_datasets` queda igual que la API REST: lista los datasets de un tablero visible, y el workspace ya
   oculta el tablero a quien no es miembro (fijado con un test).
7. Pendiente:
   - la imagen del workspace y `create_dataset(workspace_id)`;
   - decidir si la web debe pedir editoría real para certificar, como el MCP. Leído en el código, sin probar: el
     PUT de tablero no tiene chequeo propio para `certified_by`, así que un contributor podría certificar.

## 2. Biblioteca de layout y estructura del informe (L)

1. `superset/auradata/layout/`:
   - modelos pydantic de los tipos de `src/mibi/format/types.ts`, `elements/types.ts` y `report/*`;
   - funciones `column_count_of`, `free_cell`, `layout_to_cells`, `layout_to_positions`, `mobile_layout_of`;
   - constantes de claves (un solo sitio, para R4).
2. Guardia contra la deriva: fixtures compartidos Jest/pytest y test de claves desconocidas.
3. Lectura: `get_report_structure(dashboard)`. Devuelve páginas (incluidas ocultas y tooltip), objetos con su caja
   en celdas, tipo, título, formato resuelto (`mergeVisualFormat`: compartido + propio), filtros y marcadores. En
   lenguaje de informe, no en claves internas.
4. Páginas (fila 39), posiciones (fila 24) y estado de objetos (fila 27). Cada escritura cabe dentro de la página
   (lo mismo que hace `CanvasFrame` al editar) y nunca encima de otro objeto, salvo que se pida.
5. `get_dashboard_screenshot(dashboard, page)` y `get_visual_screenshot`, con Playwright en el servidor.
- **Listo cuando:** la IA arma un informe de tres páginas con gráficos existentes, lo mira y queda igual que si se
  hubiera hecho a mano. Test: abrirlo en el navegador no cambia su layout (no hay conversión al cargar).

**Hecho (2026-11-04, rama `feat/mcp-layout`):**
1. `6fad64ebdf`: biblioteca `superset/auradata/layout/`.
   - Modelos pydantic del lienzo, formatos, elementos, marcadores, páginas tooltip y diseño móvil. Solo leen y
     validan: las escrituras siguen como dicts para no perder claves.
   - `keys.py` con todas las claves `meta.auradata*`.
   - Las funciones de `columns.ts`, `cells.ts`, `positions.ts`, `mobileLayout.ts`, `arrange.ts` y `mergeVisualFormat`,
     con el redondeo y la coerción de JavaScript (`Math.round(12.5)` es 13; en Python, `round` da 12).
   - Los helpers de la fase 0 salen de `mcp_service/dashboard/constants.py`, que solo los reexporta.
2. `993c1d66c6`: guardia contra la deriva.
   - Fixtures en `tests/fixtures/auradata/layouts/`. Jest (`layoutDrift.test.ts`) los rellena con
     `UPDATE_LAYOUT_FIXTURES=1` y es la fuente de verdad; pytest (`drift_test.py`) debe dar lo mismo.
   - `meta_keys.json`: Jest falla si el frontend usa una clave del layout o un tipo de elemento que no está en la
     lista, y pytest si Python no la conoce.
3. `fe15596e2b`: `get_report_structure`. Devuelve:
   - el tamaño de página en celdas;
   - las páginas (ocultas y tooltip incluidas);
   - los objetos con tipo, título, caja, capa, estado y formato resuelto;
   - los filtros nativos y los marcadores.
4. `c3e2b5b22f`: herramientas de escritura.
   - Páginas: `add_page`, `rename_page`, `reorder_pages`, `duplicate_page` (clona sus gráficos con
     `CreateChartCommand`), `delete_page` (suelta sus gráficos del tablero, sin borrarlos) y `set_page_hidden`.
   - Objetos: `place_object`, `move_object`, `resize_object`, `align_objects`, `distribute_objects`,
     `bring_to_front` y `set_object_state`.
   - Cada escritura pide `can_edit_resource` y guarda por `UpdateDashboardCommand`, así que queda en el historial.
   - Los objetos se quedan dentro de la página (se ajustan, con aviso) y no se pisan salvo `allow_overlap`. Los
     bloqueados no se mueven.
   - Tests con base real: editor, contributor y admin del workspace escriben; viewer y otro workspace no.
5. `52d3f537ae`: `generate_dashboard` escribe en celdas con `auradataPos`.
   - Dos gráficos de 30 × 12 por fila, en `ROW > CHART`, como el editor.
   - Si no caben, la página crece como en `layoutToPositions`, hasta 128 filas; lo que sobra va a páginas nuevas.
   - Un fixture prueba que Jest y Python lo cargan sin cambios.
6. `799aac8ca7` y `76ff502a58` (más la exclusión de caché en un commit posterior): `get_dashboard_screenshot(dashboard, page)` y `get_visual_screenshot`.
   - Usan `DashboardScreenshot` y su Playwright, en un hilo propio (el API síncrono no corre dentro del bucle del MCP).
   - Devuelven la imagen como contenido MCP: JPEG de 1600 px como máximo.
   - Están fuera del guardián de tamaño de respuesta.
7. Chequeo en vivo (MCP en 5108, tablero de prueba 217):
   - Se armó por herramientas: 5 gráficos, tres páginas (una oculta), objetos movidos y redimensionados, texto
     alternativo y nuevo orden de páginas.
   - Las capturas de página y de visual salen bien.
   - Abierto en modo edición, Guardar y Deshacer siguen deshabilitados y `position_json` no cambia.
   - La prueba que lo demuestra es un fixture: el `position_json` guardado del 217 se carga en Jest y en pytest sin
     ninguna conversión (`load_layout.json`, con el resultado esperado escrito a mano).
   - Gráficos de prueba: 301–305 en el 217; los huérfanos 296–300 de un primer intento quedaron borrados (papelera).
8. Pendiente:
   - **Frontend:** un permalink con `activeTabs` (sin `anchor`) mueve la barra de páginas pero deja en pantalla la
     primera página. Las capturas usan `anchor` y no les afecta; otros enlaces permanentes sí.
   - `generate_dashboard` no recibe workspace: no puede crear un informe con datasets de un workspace (rechaza
     los gráficos). Va con `create_visual` en la fase 4.
   - `get_visual_screenshot` solo sirve para gráficos; los elementos de diseño no tienen una clase con su id.
   - Los nombres por defecto («Página N», «(copia)») van en español fijo, no según el idioma del usuario (fase 11).
   - Al revisar los registros apareció que las escrituras de workspace de la fase 1 se podían cachear (con la caché
     activada); quedan excluidas junto a las de esta fase.
   - `test_mcp_e2e_smoke.py` ya fallaba antes de esta rama: espera «Superset MCP Service» (ahora «AuraData BI MCP
     Service») y su lista de herramientas por ASGI sale vacía. Comprobado quitando las herramientas nuevas.
   - No se corrió `pre-commit` completo ni mypy (no hay venv en el host): solo ruff, oxlint y oxfmt sobre los
     archivos tocados.

## 3. Formato (L)

1. **Catálogo de formato generado.** Un script del frontend exporta, por tipo de gráfico, los controles que dibuja
   el nivel Visual (`formatCards.ts`, paneles de control, `chartFormatOptions.ts`, `chartFamilies.ts`,
   `tableFormat.ts`):
   - clave, tipo, valores permitidos, sección y por defecto;
   - salida en `superset/auradata/catalog/format_catalog.json`, comprobada en CI para que no quede atrás.
   - Sin esto, Python tendría que copiar a mano cientos de opciones.
2. `get_format_options(viz_type, level)` lee el catálogo.
3. `format_visual(dashboard, object, patch)` por nivel (Visual, General, Analítica). Valida el parche contra el
   catálogo y escribe en `mibiFormat`/`mibiFormat.chart`. Respeta `OWN_CHART_SETTINGS` y `sharableFormat`.
4. `set_canvas_format`, `set_shared_visual_format` («Aplicar a todos»), `copy_format`.
5. Fondos e imágenes: subida en base64 o desde un archivo del propio sitio, nunca una URL externa que el servidor
   descargue (SSRF). `set_dashboard_css`.
- **Listo cuando:** un informe de ejemplo replicado de SESEQ se formatea solo por MCP, comparado por captura.

**Hecho (2026-11-05, rama `feat/mcp-format`):**
1. `55705c6bd8`: catálogo de formato generado.
   - `formatCatalog.test.ts` registra los 29 tipos de gráfico del editor y escribe
     `superset/auradata/catalog/format_catalog.json` con `UPDATE_FORMAT_CATALOG=1`; sin él, falla si el JSON quedó atrás.
   - Usa las mismas `lookSections` y `buildFormatCards` del panel. Por control: clave, componente, tipo de valor,
     opciones, rango, por defecto, sección, nivel, `own` y lo que depende del gráfico (`dynamic`).
   - El nivel General sale de `generalFormat.ts`, un descriptor tipado de `VisualFormat` (`Described<T>` exige cada
     clave; no se corrió `tsc` sobre él, Jest no comprueba tipos).
2. `e4a943a1dd`: la biblioteca de layout valida y comparte formatos.
   - `sharableFormat`, `ownFormat`, `withOwnFormat` y el pintor (`formatOf`, `pastedMeta`, ahora función pura) en Python,
     con fixtures compartidos Jest/pytest.
   - `format_patch.py` valida contra el catálogo. Los colores llegan como CSS o `{r, g, b, a}` (convierte `#hex`).
     Los enlaces solo pueden ser http(s), mailto o una ruta del sitio, y las imágenes solo del propio sitio o
     `data:image` raster.
3. `3b863622e0`: `backgrounds.py` comparte `check_image`, `store_background` y `store_element_image` con la API REST.
4. `280708af3d`: ocho herramientas.
   - `get_format_options` y `format_visual`. Por nivel: Visual y Analítica escriben en `auradataFormat.chart`;
     General, en `auradataFormat`, más `auradata_tooltip`/`auradata_sampling`.
   - `set_canvas_format`: si la página se achica, encaja los objetos.
   - `set_shared_visual_format` (`reset_charts` como el panel), `copy_format` y `set_dashboard_css` (sin `@import` ni
     `url()` de otros sitios).
   - `upload_dashboard_background` y `upload_dashboard_image`: solo base64, nunca una URL.
   - Todas piden `can_edit_resource`, guardan por `UpdateDashboardCommand` y quedan fuera de la caché. Tienen tests de
     permisos: viewer y otro workspace no escriben; editor, contributor y admin sí.
   - Las unidades 2–5 van en un solo commit porque comparten `format_tools.py`.
5. `467cff110e`: `set_dashboard_css` rechaza también escapes con barra invertida e `image-set()`, y
   `get_format_options` da descripciones solo con `section`: sin filtros, `mixed_timeseries` con descripciones medía
   61 KB, por encima del límite de 50 KB; sin ellas mide 43 KB.
6. Chequeo en vivo (MCP en 5108, tablero nuevo 218 en «SESEQ RRHH», gráficos 308 y 309): se aplicaron por herramientas
   el fondo del lienzo, el título, el fondo, el radio y la sombra del 308, y sus etiquetas y color de serie. Luego, «aplicar
   a todos». La captura muestra etiquetas, color violeta en los dos gráficos, tarjetas blancas redondeadas y el subtítulo
   solo en el 308. Un parche inválido (`show_value: "sí"`) se rechaza sin escribir. Los gráficos huérfanos 306 y 307
   de un primer intento están en la papelera.
   - El fondo lavanda del lienzo se ve cuando la página pasa a 30 filas (las tarjetas cubrían las 26).
   - El historial de versiones (`/api/v1/dashboard/<uuid>/versions/`) tiene una versión por cada escritura, con el
     diff de `auradataFormat`. Los cambios del lienzo (`ROOT_ID`) generan versión, pero con `changes` vacío.
   - **No se cumple aún el «Listo cuando»** de la fase: no se replicó un informe de SESEQ comparado por captura.
7. Pendiente:
   - **`add_chart_to_existing_dashboard`** escribe `ROW > COLUMN (ancho 40) > CHART`. La columna estira el gráfico a
     todo el ancho, aunque su caja guardada sea de 13 o 20 celdas (el 218 lo muestra). Es de la fase 2 o la 4.
   - `echart_options` y otros controles `json` pueden llevar direcciones de imagen (`graphic[].style.image`) que
     nadie revisa.
   - El título no se pintó azul en la captura; el tamaño y la negrita sí.
   - **Frontend:** en modo lectura el título de un gráfico es un `<a>` con el color del tema, que ignora
     `--mb-v-title-color`. El color guardado es correcto (`.header-title` calcula `#2563EB`), pero se ve negro.
   - 671 controles son de tipo `json` (fuentes, `series_colors`, `series_format`, líneas de referencia, small
     multiples): el catálogo no describe su forma y la IA la tiene que adivinar. Falta un descriptor por componente.
   - Las opciones dinámicas (`color_scheme`, columnas) no se validan.
   - El estilo propio de los elementos (imagen, forma, botón) va con la fase 5: aquí solo se formatea su caja General.
   - `generate_dashboard` sigue sin workspace: el tablero 218 se creó por REST y se movió con
     `move_dashboard_to_workspace`.
   - En vivo no se revisó el historial de versiones; se guarda por `UpdateDashboardCommand`, igual que en la fase 2.

## 4. Visuales dentro del informe (M)

- `create_visual(dashboard, page, chart spec, place)`: crea el gráfico, lo ata al tablero y lo coloca, todo en una
  transacción.
- `set_visual_fields`, `change_visual_dataset` (mismas reglas que `fieldsKeptBy` y `changeChartDataset`),
  `set_visual_sort`.
- **El `query_context`:** el frontend lo construye con `buildV1ChartDataPayload`. Comprobar cómo lo hace hoy
  `update_chart` del MCP, para que alertas, informes y miniaturas no lean uno viejo.
- **Regla de `mibiFormat.chart`:** al cambiar por MCP una clave que el layout tapa, la herramienta la quita del
  layout y la escribe en el gráfico (como hace `saveChartFields` con los campos), o avisa. Nunca un éxito
  silencioso que no cambia nada.

**Hecho (2026-11-05, rama `feat/mcp-visuals`):**
1. `a09b70fe9f`: `add_chart_to_existing_dashboard` escribe `ROW > CHART`, como el editor (`SaveModal.tsx`, `hydrate.ts`).
   - Convierte el layout como al abrirlo (`layout_to_cells`, `layout_to_positions`) y pone el gráfico de 12 × 12 en la
     primera celda libre. Ya no hay `COLUMN`, que lo estiraba a todo el ancho.
   - Un test comprueba que el layout guardado carga sin cambios. El fixture `load_layout.json` de la fase 2 sigue pasando.
2. `967f8623a4`: `superset/auradata/layout/fields.py` y `sort.py`.
   - Son los gemelos de `rolesOf`, `addWellsOf`, `fieldsKeptBy` y los adaptadores de `sort/adapters.ts`.
   - Incluyen el orden invertido de los ejes horizontales o invertidos.
3. `7a196f1c8d`: herramientas de visuales (las unidades 1–3 comparten `report_layout/visuals.py` y `visual_tools.py`).
   - `create_visual` crea el gráfico (validación y compilación de `generate_chart`) y lo coloca en la página en una
     transacción. `CreateChartCommand` con `dashboards` valida un tablero por gráfico, datasets del workspace y
     `can_edit_resource`. Un lugar rechazado (solape) no deja el gráfico.
   - `get_visual_fields`, `set_visual_fields`, `change_visual_dataset` y `set_visual_sort`. Un cambio que vacía un pozo
     se rechaza, como hace el frontend (`invalid`), salvo que traiga campos de reemplazo. Antes de guardar se compila.
   - **`query_context`:** se deja en `None`, como hace `update_chart`. Se comparó con los gráficos guardados por el
     frontend: los dicts de Python no llevan `post_processing`, `orderby` ni la columna `BASE_AXIS`, y el pie 216 tenía
     uno ya desfasado. Los informes programados regeneran uno faltante con una captura (`_update_query_context`).
   - **Regla de `auradataFormat.chart`:** cada escritura (también `update_chart`) quita del formato propio del objeto las
     claves que cambia y lo dice (`moved_from_layout`). Avisa de las claves que aún fija el formato compartido; quitarlas
     reestilizaría todos los gráficos. Si el usuario no puede editar el tablero, también lo avisa.
   - `generate_dashboard` acepta `workspace_id` (contributor o admin) y una lista de gráficos vacía.
   - Tests de permisos con base real: editor, contributor y admin escriben; viewer y otro workspace no.
4. `9b33f060e7`: el título de un gráfico es un `styled.a` que hereda el color de `.header-title`. Antes fijaba el
   color del tema y tapaba `--mb-v-title-color` en modo lectura.
5. Chequeo en vivo (MCP en 5108):
   - Se creó por herramientas el tablero 219 en «Análisis comercial» (workspace 6), con los gráficos 310–312 sobre
     `ventas_demo`.
   - Después: leyenda por categoría con `set_visual_fields`, orden por total y por categoría con `set_visual_sort`, y
     título violeta con `format_visual`.
   - La captura muestra los tres visuales sin solaparse, con la leyenda y los órdenes.
   - En el navegador, en lectura, el título calcula `rgb(124, 58, 237)`. En modo edición, Guardar y Deshacer siguen
     deshabilitados.
   - El historial tiene una versión por `create_visual`, con su gráfico y su fila.
   - Como visor real: `qa_lector` se añadió como viewer del workspace 6 y el 219 se publicó solo para la prueba. Una
     captura con el Chromium del servidor (autenticado como ese usuario, sin contraseña) muestra el título violeta.
     Después se quitó al visor y el 219 volvió a borrador.
6. `f1b23ee235`: `update_chart` ya no deshace el panel Formato.
   - Una config reescribe las claves de aspecto con sus valores por defecto. Antes, si los params viejos no tenían
     una de esas claves, la regla la quitaba del layout aunque `format_visual` la hubiera puesto a propósito.
   - Las claves de aspecto (las del catálogo) se quedan en el layout y se avisa con `formatted`. Las de datos (campos,
     filtros, orden) siguen pasando al gráfico.
   - En vivo, `show_legend: false` de `format_visual` sobrevivió a un `update_chart` del 311.
   - `create_visual` con solo `x` o solo `y` toma el otro eje de la celda libre.
7. Pendiente:
   - `set_visual_fields` solo conoce los pozos de los tipos de `rolesOf`. Los demás tipos se cambian con `update_chart`.
   - Las opciones dinámicas (`color_scheme`) siguen sin validarse.
   - No se corrieron `pre-commit` ni mypy: solo ruff, oxlint y oxfmt sobre los archivos tocados.

## 5. Elementos y segmentadores (L)

- `add_element` / `update_element` para imagen, forma, botón (acciones: página, marcador, atrás, URL) y texto.
- `add_slicer` crea el filtro nativo y el elemento `mibi-filter` juntos, con variante, estilo de rango o de fecha,
  selección única o con Ctrl, Aplicar, orden, valores ocultos y `showInFilterBar`. `format_slicer` cubre sus niveles
  Visual y General.

**Hecho (2026-11-05, rama `feat/mcp-elements`):**
1. `a5f0c5f034`: los elementos en el catálogo de formato.
   - `elementSpec.ts` describe con `Described<T>` los ajustes de cada tipo de elemento (imagen, forma, botón, texto,
     navegador y segmentador, con sus ~110 ajustes) y el catálogo los lleva junto a `ELEMENT_DEFAULTS`. Python no copia
     ni los ajustes ni los valores por defecto: los lee del catálogo.
   - Los descriptores ganan listas (`array`, con `length`), mapas (`map`) e imágenes del sitio (`format: image`).
   - `superset/auradata/layout/elements.py`: `new_element_meta` (lo que dan `newElementMeta` y `newComponentFactory`),
     `check_element_patch` y `slicer_value_key` (el `String()` de JavaScript: `true`, `2`, `\u0000blank`).
   - El HTML de un texto no puede cargar imágenes de otro sitio (`url()`, `image-set()`, escapes) ni enlazar fuera de
     http(s), mailto o una ruta. `elements_test.py` compara las claves de cada interfaz de `types.ts` con el catálogo.
   - `backgrounds.py` comparte `delete_element_image` con la API REST.
2. `a5624283dc`: siete herramientas (las unidades 1 y 2 comparten `element_tools.py`).
   - `add_element`, `update_element`, `format_element` (caja General) y `remove_element` (destructiva).
     - Los elementos son `DYNAMIC` en una fila propia, en una celda libre o la pedida, sin pisar a otros.
     - Un botón nombra la página por id, nombre o posición (`action: {type: page, page}` → `tabId`). Se rechaza en
       un informe de una sola página. El marcador tiene que existir.
     - La imagen llega en base64. Al reemplazarla se borra la anterior.
   - `add_slicer` crea el filtro nativo y el elemento `auradata-filter` en una transacción
     (`UpdateDashboardNativeFiltersCommand` y `UpdateDashboardCommand`). Si falla el guardado, no queda ninguno.
     - Tipos: lista (`filter_select`), rango (`filter_range`, nuevo en los constructores de `manage_native_filters`,
       que se vuelven públicos) y fecha (`filter_time`).
     - Opciones: variante, estilo de rango o de fecha (cada uno solo para su tipo de filtro, como `FilterView`),
       selección `single`/`multi`/`ctrl` (`multiSelect` del filtro), Aplicar, orden (`sortValues` y `sortAscending`),
       valores ocultos, `showInFilterBar` y valor por defecto (`defaultDataMask`, gemelos de `getSelectExtraFormData`
       y `getRangeExtraFormData`).
     - `scope: page` filtra solo los gráficos de la página (`rootPath: [TAB-…]`); por defecto, todo el informe.
     - El dataset debe poder leerse y ser del workspace del tablero o compartido (`validate_chart_dataset`).
   - `update_slicer` (nombre, opciones, valor por defecto o `clear_default`) y `format_slicer` (Visual: ajustes del
     segmentador; General: su caja).
   - `get_format_options` acepta `element=<tipo>` y devuelve sus ajustes y sus valores por defecto.
   - Tests con base real: editor, contributor y admin del workspace escriben; viewer y otro workspace no, en las siete
     herramientas (`2a1b5f2daf` añade los rechazos de las cinco que cambian un elemento). Registradas en `app.py`,
     inventario, registro, `COMMITTED_WRITE_SPECS` y exclusiones de caché.
   - `2a1b5f2daf`: `format_slicer` rechaza `selection`, `sortValues` y `hiddenValues`, que `update_slicer` mantiene
     al día con el filtro nativo.
3. `efd7ad1320`: seguridad pendiente de la fase 3. Todo valor de un control `json`, a cualquier profundidad, y cada
   literal de cadena del código de `echart_options` (con sus escapes y plantillas resueltos) no puede ser una dirección
   de otro sitio: ni `graphic[].style.image`, ni `symbol: 'image://…'`, ni rellenos de patrón o fondos de texto
   enriquecido. Se aplica en `format_visual` y en `set_shared_visual_format`. Un texto que solo menciona una dirección
   pasa.
   - `848afdc80b`: el `formatter` de un tooltip es HTML que ECharts escribe con `innerHTML`, y el sanitizador del
     tooltip deja pasar `<img>`. Las cadenas con marcado se leen como HTML (`src`, `srcset`, `poster`, `background` y
     `url()` en `style`). Los literales solo se leen del código de objeto, así que un enlace en HTML simple pasa.
4. `9f2909b53d`: forma de los controles `json` (`jsonShapes.ts` → `json_shapes` del catálogo): fuentes, colores
   de series, formato por serie, líneas de referencia y límites. `get_format_options` las da con un nivel o una
   sección. Sin filtro, la respuesta de `mixed_timeseries` pasaba de 50 KB.
5. Chequeo en vivo (MCP en 5108, tablero nuevo 220 en «Análisis comercial», gráficos 313 y 314 sobre `ventas_demo`):
   - Todo por herramientas: título (texto), logo (imagen en base64), botón «Ver detalle» a la página «Detalle», un
     segmentador de botones de `categoria` (selección única, alcance de página) y uno de fecha (dos días).
   - `get_dashboard_screenshot` los muestra todos en su sitio.
   - En el navegador:
     - Clic en «Oficina»: la barra queda solo con Oficina y la línea baja de escala.
     - Fechas del 1/3 al 30/6/2025: la línea se recorta a marzo–junio y la barra cambia de escala. El panel cuenta
       2 filtros.
     - El botón abre la página 2 de 2.
     - En modo edición, Guardar y Deshacer siguen deshabilitados.
   - El historial del 220 tiene 9 versiones: la creación, 2 gráficos, la página, 3 elementos y 2 segmentadores. Cada
     `add_slicer` (filtro y layout) deja una sola versión.
6. Pendiente:
   - No hay `tsc` sobre `elementSpec.ts` ni `jsonShapes.ts` (Jest no comprueba tipos). La deriva de claves la cubre
     `elements_test.py`.
   - Las formas de los controles `json` se describen, pero no se validan.
   - Las líneas de referencia y el formato por serie no tienen tipo exportado en el plugin: su descriptor está escrito
     a mano.
   - No hay segmentador de jerarquía (tampoco en el editor) ni filtro de columna de tiempo o de grano.
   - Un segmentador de fecha filtra por el `time_range` del gráfico; un gráfico sin columna temporal lo ignora.
   - No se corrieron `pre-commit` ni mypy: solo ruff, oxlint y oxfmt sobre los archivos tocados.

## 6. Interactividad (L)

- Filtros nativos con niveles (todas las páginas, esta página, visuales) y `filter_bar_auto_apply`.
- Marcadores, drill through, editar interacciones, sincronizar segmentadores, páginas tooltip y valores por defecto
  de los filtros (filas 28–35).

**Hecho (2026-11-05, rama `feat/mcp-interactivity`):**
1. `bca1d2154c`: gemelos en Python (`superset/auradata/layout/interactivity.py`) de `getFilterScopeLevel`,
   `crossFilterScope`, `interactionMode` y `tooltipPageOf`, con fixtures compartidos Jest/pytest
   (`filter_scope_level`, `cross_filter_scope`, `interaction_mode`, `tooltip_page_of`), más lectores de marcadores,
   páginas de drill through y páginas tooltip.
2. `a1f6c4312a`: herramientas (las siete unidades comparten `report_layout/interactivity.py` y
   `interactivity_tools.py`):
   - **Niveles de filtro:** `manage_native_filters` acepta `scope_level` (report, page, visual, auto) y `scope_pages`
     (por id, nombre o posición). Páginas sin nivel dan un filtro de página, o de informe si son todas, como
     «Sincronizar segmentadores». `auto` quita `scopeLevel`. `set_filter_bar_auto_apply` escribe un booleano explícito.
   - **Marcadores:** `list/create/update/delete_bookmark`. Un marcador nuevo guarda todos los filtros nativos con su
     valor por defecto y los pedidos encima (`default_data_mask`), y la visibilidad de cada gráfico y elemento (la suya,
     con `hidden`/`shown` encima), como `captureView`. Sin filtros cruzados: al aplicarlo, se limpian. Id como
     `nanoid(10)`. Borrar avisa de los botones y enlaces que iban a él. El botón a un marcador ya lo cubría
     `add_element` (probado).
   - **Drill through:** `set_drillthrough_page` / `clear_drillthrough_page`, solo páginas de primer nivel y columnas
     de los datasets de los gráficos del informe.
   - **Interacciones:** `set_visual_interactions` escribe `chart_configuration` como `setInteraction` (alcance propio,
     el global o el de todo el tablero; `chartsInScope` con `get_chart_ids_in_scope`). Avisa si los filtros cruzados
     están apagados.
   - **Sincronizar:** `sync_slicer` (`filter_pages`, `visible_pages`) guarda el alcance del filtro y las copias del
     segmentador juntos (`save_with_filter`). La copia va a su misma celda, o a la primera libre.
   - **Páginas tooltip:** `make_tooltip_page` (ancho 4–30 y alto 2–24 celdas, como el panel; avisa de los objetos que
     se cortan) y `set_visual_tooltip` (default, auto o una página tooltip). `format_visual` y los elementos ya no
     pueden apuntar el tooltip a una página que no sea tooltip (`ReportRefs.tooltip_pages`).
   - **Lectura:** `get_filter_defaults` (lo que trae «Restablecer filtros», como `savedDataMasks`) y
     `get_report_structure` con el nivel de cada filtro, `filter_bar_auto_apply`, las interacciones en «ninguna»,
     el tooltip de cada gráfico y los filtros y objetos ocultos de cada marcador.
   - Las escrituras de `json_metadata` mandan el metadata completo, como `saveFilterBarAutoApply`: el comando de
     actualización vacía los colores derivados que faltan.
   - Todas piden `can_edit_resource` y guardan por `UpdateDashboardCommand`. Tests con base real: editor, contributor
     y admin del workspace escriben; viewer (Forbidden) y otro workspace (NotFound) no cambian nada.
   - Registradas en `app.py`, inventario, registro, `COMMITTED_WRITE_SPECS` y exclusiones de caché.
3. Chequeo en vivo (MCP en 5108, tablero nuevo 221 en «Análisis comercial», gráficos 315–318 sobre `ventas_demo`):
   - Todo por herramientas: tres páginas (Resumen, Detalle, Tooltip región), segmentador de botones de `region`
     sincronizado en Resumen y Detalle, marcador «Solo Norte» (Norte, oculta la torta) y un botón a él, Detalle como
     página de drill through por `region`, «Tooltip región» como página tooltip de la barra, y la barra sin filtrar la
     torta.
   - En el navegador:
     - El botón aplica el marcador: queda Norte, la torta se oculta y el panel cuenta 1 filtro.
     - La copia del segmentador en Detalle filtra la tabla y comparte la selección con la de Resumen.
     - «Restablecer filtros» devuelve todo: sin selección y con la torta visible.
     - Clic en la barra «Norte»: la torta no cambia y la tabla de Detalle sí se filtra.
     - Clic derecho › Obtener detalles › Detalle abre la página 2 con «region: Norte» y la tabla filtrada.
     - Al pasar sobre la barra «Centro» flota la página tooltip con «Ventas 7.72M».
     - La página tooltip no sale en las pestañas («Página 1 de 2»). En edición, Guardar y Deshacer siguen deshabilitados.
   - El historial tiene una versión por escritura (17).
4. Pendiente:
   - **Frontend:** `FilterBar/index.tsx` lee `filter_bar_auto_apply !== false` (al instante por defecto) y
     `FilterBarSettings` lee `!!` (apagado por defecto): sin la clave, el interruptor dice lo contrario de lo que pasa.
   - Los marcadores por MCP no guardan filtros cruzados: su forma depende de cada gráfico (`selectedValues` por serie).
   - `generate_dashboard` crea los tableros con `cross_filters_enabled: false`; para que las interacciones sirvan hay
     que encenderlos con `update_dashboard`.
   - El historial no muestra el cambio de `chart_configuration` ni el de los marcadores (`ROOT_ID`): sale vacío o con
     `expand_all_slices`/`filter_scopes`, que el comando normaliza al guardar el metadata.
   - No se corrieron `pre-commit` ni mypy: solo ruff, oxlint y oxfmt sobre los archivos tocados. No hizo falta
     `npm run build` (sin cambios de frontend en tiempo de ejecución).

## 7. Diseño móvil (M)

- `generate_mobile_layout(page)`: propone un diseño de 12 columnas apilando por importancia (tarjetas y
  segmentadores arriba).
- `set_mobile_layout` para ajustarlo, `clear_mobile_layout`. Captura con el marco de teléfono.

**Hecho (2026-11-05, rama `feat/mcp-mobile`):**
1. `27f280603b` y `488888d3b9`: `propose_mobile_layout` en `superset/auradata/layout/mobile.py`.
   - Solo existe en Python: el editor no tiene diseño automático.
   - Orden: los textos que están por encima de todo (el título) encabezan; luego tarjetas y segmentadores; después
     los gráficos en orden de lectura (de arriba abajo, de izquierda a derecha). Un texto o forma va delante de lo
     que lo seguía en el lienzo. Los objetos ocultos se quedan fuera, con aviso.
   - Tamaños: gráficos a todo el ancho, de 8 a 12 celdas de alto. Las tarjetas pequeñas (un tercio del lienzo o
     menos) van de dos en dos, de 4 a 6 celdas. El resto conserva su forma del lienzo.
   - Un caso del fixture compartido `mobile_layout_of.json` prueba que `mobileLayoutOf` (Jest) lee la propuesta
     sin cambios.
2. `3fcb851a10`: `generate_mobile_layout` (sin `apply` solo propone; `apply=true` escribe y pide poder editar),
   `set_mobile_layout` y `clear_mobile_layout` (`report_layout/mobile.py`, `tool/mobile_tools.py`).
   - Las cajas se validan contra los objetos de la página (sirve el id del gráfico) y no se repiten. Se ajustan a 12
     columnas con aviso, como `fitBox`; más de 12 de ancho lo rechaza el esquema.
   - Las páginas tooltip no tienen diseño móvil.
   - Tests con base real: editor, contributor y admin del workspace escriben; viewer (Forbidden) y otro workspace
     (NotFound) no cambian nada.
3. `0b6bc7347b`: `get_dashboard_screenshot(device='phone')`. Navegador de 393 pt de ancho, con alto para toda la
   página tal como la ve un teléfono: su diseño móvil, o el lienzo escalado al ancho. Devuelve `mobile_layout`.
4. Pendientes de la fase 6:
   - `804993fe31`: `FilterBarSettings` y la barra leen `filter_bar_auto_apply` con `isFilterBarAutoApply` (al
     instante salvo que el tablero lo apague).
   - `d836171bde`: `generate_dashboard` crea los informes con `cross_filters_enabled: true`. Es lo que hace el
     editor: «Nuevo tablero» no guarda metadata, y el frontend lee su ausencia como encendido.
   - `736f5ab570`: historial de versiones. **La causa estaba en `superset/versioning/diff.py`, no en el MCP:**
     también se perdían los guardados del editor.
     - `chart_configuration` estaba entre las claves excluidas. Ahora se compara solo el alcance (`kind`
       `interaction`), sin `chartsInScope` ni los gráficos que siguen el alcance del tablero.
     - `ROOT_ID` y `GRID_ID` se ignoraban enteros, y con ellos el formato del lienzo, los marcadores y el diseño
       móvil de un informe de una página. Ahora sus claves de `meta` son registros `report`, uno por ajuste. Las
       claves `auradata*` de una `TAB` también.
     - Los `DYNAMIC` (elementos y segmentadores) no tenían tipo y no salían. Ahora salen como «elemento de diseño».
     - El panel los nombra («Se cambiaron los marcadores», «Se cambió el diseño móvil»...), con su traducción.
     - `generate_dashboard` escribe la metadata con la forma que deja `set_dash_metadata`, así la primera escritura
       de metadata ya no registra `expand_all_slices` ni `filter_scopes`.
5. Chequeo en vivo (MCP en 5108, tablero nuevo 222 «Fase 7 diseño móvil» del workspace 6, gráficos 319–322 sobre
   `ventas_demo`):
   - Todo se hizo por herramientas: `generate_dashboard`, tarjetas reducidas a 10 × 5, un texto de título, un
     segmentador de región y `generate_mobile_layout(apply=true)`.
   - La captura de teléfono muestra título, segmentador, las dos tarjetas lado a lado y las dos barras.
   - El navegador a 393 × 852 lo dibuja igual. Única diferencia: el visor real resta el riel de filtros, que la
     captura (`standalone`) no muestra.
   - En el 222 recién generado, «Filtros cruzados» está encendido y «Aplicar filtros al instante» marcado, sin la
     clave en la metadata.
   - El historial muestra el diseño móvil, los elementos, la interacción y el marcador.
   - Un guardado del editor (cambio de título) no registró ningún `report` ni `interaction` fantasma.
6. Pendiente:
   - La captura de teléfono no dibuja el riel de filtros cerrado que ve un visor de teléfono, así que es unos píxeles
     más ancha.
   - El historial de un ajuste de página `TAB` no dice qué página cambió: el texto es genérico.
   - El primer guardado del editor sobre un informe hecho por MCP registra `native_filter_configuration`,
     `default_filters` y `chart_customization_config`, que el frontend normaliza. Es anterior a esta rama.
   - `test_dashboard_schemas.py::test_generate_dashboard_request_chart_ids_is_bounded` ya fallaba antes de esta
     rama: espera que `chart_ids=[]` falle, y la fase 4 lo permite (un informe vacío para `create_visual`).
   - No se corrieron `pre-commit` ni mypy: solo ruff, oxlint y oxfmt sobre los archivos tocados.
   - **Para las sesiones siguientes:** el `ruff format` del contenedor, sobre archivos recién editados en el host,
     puede leer una copia vieja del montaje y truncarlos. Formatear por stdin, o comprobar antes con md5 que el
     contenedor ve el mismo archivo.

## 8. Conexiones y modelo de datos (M)

- `test_connection` y `create_database` para los seis motores de `PREFERRED_DATABASES`, solo admin.
- Columnas calculadas y métricas del dataset (ampliar `update_dataset_metric`), dataset virtual desde SQL dentro
  de un workspace.

## 9. Papelera e historial (S–M)

- `list_trash` (por workspace para contributors y admins; global en Administración).
- `list_versions`, `get_version_diff`, `restore_version` sobre `/api/v1/dashboard/<uuid>/versions/` y sus
  equivalentes de gráfico y dataset.

## 10. Captura, exportación, envío y compartir (M)

- `export_dashboard_image` y `export_dashboard_pdf` en el servidor, con la misma vista que la exportación del
  navegador.
- Crear informes y alertas programados. Tener en cuenta la regla de 7.0: el ejecutor necesita acceso a un
  borrador.
- `publish_dashboard`, `share_dashboard` (editores, visores, miembros del workspace).

## 11. Prompts, recursos y estilo (M)

- Recursos:
  - `auradata://brand`: colores, tipografías, cuándo usar el degradado;
  - `auradata://report-conventions`: tamaño de página, márgenes, jerarquía, una idea por página, tarjetas arriba;
  - `auradata://format-catalog`.
- Prompts guiados: «informe desde un dataset», «replicar un informe de Power BI desde una captura», «revisar y
  pulir un informe», «diseño móvil de este informe».
- Idioma: los textos que crea la IA siguen el idioma del usuario (español por defecto, «tú», comillas «»).

## 12. Evaluación de punta a punta (M)

- Playwright: un informe creado solo por MCP se abre en el editor sin cambios de layout y sin errores de consola.
- Una batería de encargos («arma el informe de ventas del workspace Demo») que se repite tras cada fase, con
  captura de referencia.

## D. Documentación (continua)

Cada fase deja su parte. Al final se ordena en:

| Documento | Para quién | Idioma | Contenido |
| --- | --- | --- | --- |
| `docs/auradata/manual/` | Usuarios | Español | Qué hace AuraData BI, pantalla por pantalla, con capturas |
| `docs/auradata/mcp/conectar.md` | Usuarios y TI | Español | Cómo conectar Claude u otro cliente: URL, JWT, permisos, ejemplos de encargos |
| `docs/auradata/mcp/referencia.md` | IA y desarrolladores | Español, generado | Referencia de herramientas generada desde el registro (nombre, permisos, parámetros, ejemplo); un test falla si queda vieja |
| `docs/auradata/arquitectura.md` | Desarrolladores | Español | Biblioteca de layout, catálogo, guardia de deriva, cómo añadir una herramienta |
| `CLAUDE.md` y `mcp_service/CLAUDE.md` | Agentes | Inglés | Reglas nuevas: herramientas semánticas, permisos, nombres AuraData |
| `README.md` | Todos | Español | Resumen y enlaces |

## Decisiones

1. ~~R4: claves guardadas.~~ **Decidido (2026-11-04): se renombran también**, con el diseño de «R4: renombrar
   los datos guardados».
2. **Credenciales de bases de datos por MCP (fase 8).** Pasar contraseñas por la conversación con la IA las deja
   en el historial del cliente. Alternativa: el MCP solo prueba y crea conexiones con un secreto ya guardado en el
   servidor.
3. **Antes de R1:** qué hacer con los 14 archivos modificados sin commit en `main`.

## Riesgo

- R2 cambia variables de entorno, pero sin despliegues todavía no es un riesgo de contrato.
- Item 1 (datos): R3 y R4 cambian datos guardados.
- Item 2 (seguridad): fases 1, 8 y 10 tocan permisos, credenciales y quién ejecuta los informes.

Cada uno va en su propio commit, con verificación independiente.
