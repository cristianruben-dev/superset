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
| R2 | Configuración y entorno: `MIBI_SINGLE_DASHBOARD_CHARTS`, `MIBI_WORKSPACE_*`, `MIBI_SEND_REPORTS`, `MIBI_PUBLIC_URL`, `MIBI_PORT`, `MIBI_HTTPS`, `MIBI_IMAGE`… | Medio: un despliegue con `.env` viejo cambiaría de comportamiento | Nombre nuevo `AURADATA_*`; durante una versión se lee también el viejo con un aviso en el log. Actualizar `docker/.env-prod.example`, compose, `Dockerfile`, README |
| R3 | Tablas `mibi_workspaces`, `mibi_workspace_dashboards`, `mibi_workspace_members`, `mibi_workspace_datasets`, `mibi_dashboard_backgrounds` | Alto (dato guardado), pero mecánico | Migración Alembic `rename_table` sobre la cabeza del fork (`f1c7a9e2b305`), con `downgrade`; probar base nueva y copia en la cabeza anterior |
| R4 | Claves del layout `meta.mibi*` (en cada `position_json`), `componentKey` `mibi-*`, paleta `mibi` en `json_metadata`, clases `.mibi-*` que un usuario pudo usar en el `css` de su tablero | Alto | Decidido (2026-11-04): se renombran también. Diseño abajo |

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
| ZIP exportados antes del cambio | `position_json` con claves viejas |
| `localStorage` de cada navegador | `mibi.clipboard`, `mibi.grid`, `mibi.mobileView`, `mibi.sidebarCollapsed`… |

**Cómo:**
1. **Un único traductor de claves**, en Python (`superset/auradata/layout/legacy.py`) y en TS
   (`src/auradata/format/legacy.ts`), con la misma tabla `mibiX → auradataX`, `mibi-* → auradata-*` y paleta
   `mibi → auradata`. Los dos pasan los mismos fixtures.
2. **Migración de datos** (Alembic, sobre la cabeza del fork), que traduce `position_json`, `json_metadata` y
   `css` de `dashboards` y de `dashboards_version`/`slices_version`. Así el historial restaura claves nuevas. Por
   lotes, con `downgrade` que hace la traducción inversa.
3. **El traductor se queda solo en las puertas de entrada,** no repartido por el código:
   - importación de ZIP;
   - lectura de enlaces permanentes;
   - carga en el frontend de un layout que aún tenga claves viejas, como red de seguridad.
   - El resto del código solo conoce `auradata*`. Un test falla si aparece una clave `mibi` fuera del traductor.
4. **El CSS del usuario:** la migración reescribe `.mibi-` → `.auradata-` en `css`. Un tablero importado más tarde
   pasa por el mismo traductor.
5. **`localStorage`:** al arrancar se leen las claves viejas una vez, se copian a `auradata.*` y se borran.
6. **El orden importa.** R4 va después de R1, que renombra las rutas, y en el mismo despliegue que el frontend que
   lee las claves nuevas. Un frontend viejo con datos migrados perdería el formato.
7. **Pruebas,** en una base desechable y nunca en la de desarrollo:
   - base nueva;
   - copia en la cabeza anterior con tableros reales (formato, segmentadores, marcadores, diseño móvil, páginas
     tooltip);
   - `upgrade` → abrir en el navegador sin cambios → `downgrade` → `upgrade`;
   - restaurar una versión de antes, importar un ZIP viejo, abrir un enlace permanente viejo.

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

## 5. Elementos y segmentadores (L)

- `add_element` / `update_element` para imagen, forma, botón (acciones: página, marcador, atrás, URL) y texto.
- `add_slicer` crea el filtro nativo y el elemento `mibi-filter` juntos, con variante, estilo de rango o de fecha,
  selección única o con Ctrl, Aplicar, orden, valores ocultos y `showInFilterBar`. `format_slicer` cubre sus niveles
  Visual y General.

## 6. Interactividad (L)

- Filtros nativos con niveles (todas las páginas, esta página, visuales) y `filter_bar_auto_apply`.
- Marcadores, drill through, editar interacciones, sincronizar segmentadores, páginas tooltip y valores por defecto
  de los filtros (filas 28–35).

## 7. Diseño móvil (M)

- `generate_mobile_layout(page)`: propone un diseño de 12 columnas apilando por importancia (tarjetas y
  segmentadores arriba).
- `set_mobile_layout` para ajustarlo, `clear_mobile_layout`. Captura con el marco de teléfono.

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

- Item 3 (contratos): R2 cambia variables de entorno de despliegue.
- Item 1 (datos): R3 y R4 cambian datos guardados.
- Item 2 (seguridad): fases 1, 8 y 10 tocan permisos, credenciales y quién ejecuta los informes.

Cada uno va en su propio commit, con verificación independiente.
