# Plan: ordenar visuales al estilo Power BI en AuraData BI

## Contexto
En Power BI, el autor ordena un visual desde «Más opciones (…) › Ordenar eje»: elige un campo (categoría o medida) y el sentido. AuraData BI ya tiene casi todos los controles de orden, pero solo en el editor del chart (Explore, dentro del panel lateral). No hay forma de ordenar desde el dashboard, y el circular, el embudo y la tabla tienen huecos.

**Decisión del producto: solo los editores ordenan.** El orden lo decide el editor y se guarda con el visual. Los lectores ven el visual tal como el editor lo dejó y no tienen opciones de orden. Esto se aparta a propósito de Power BI, donde el lector puede cambiar el orden en la vista de lectura.

**Estado:** fases 1 a 3 implementadas. Quedan las fases 4 a 6 y los opcionales.

---

## 1. Qué hace Power BI (documentación oficial)
Correspondencia: un *informe* de Power BI equivale a un **dashboard** de AuraData BI. Los «paneles» (*dashboards*) de Power BI no se pueden ordenar, y esa limitación no nos aplica.

| Tema | Lo que dice Microsoft | Fuente |
|---|---|---|
| Menú del visual | «…» › Orden descendente / Orden ascendente / Ordenar por / Ordenar eje; una marca indica el campo y el sentido activos | end-user-change-sort |
| Campos | La mayoría de los visuales se ordenan «por uno y a veces dos campos» | end-user-change-sort |
| Visuales sin orden | Treemap, mapa coroplético, dispersión, medidor, cascada, tarjetas | end-user-change-sort |
| Orden por defecto | **No documentado**. Solo dice que se ordena alfabética o numéricamente; no confirma «medida descendente» | end-user-change-sort, column-charts |
| Tabla | Una flecha en el encabezado marca la columna ordenada; Shift+clic añade columnas al orden; Shift+clic en la misma columna cambia el sentido | end-user-change-sort |
| Matriz | **No documentado** (ni por encabezado de fila ni por valor ni Shift+clic) | matrix-visual |
| «Ordenar por columna» | Columna › Ordenar por columna (por ejemplo, el nombre del mes por su número). Exige una relación 1:1 y la misma granularidad; en el servicio, para ordenar por otro campo hay que tener permiso de edición | desktop-sort-by-column |
| Series y leyenda | **No documentado** | — |
| Segmentador | Ascendente por defecto; «…» › Ordenar eje › Orden descendente. El segmentador de lista ordena por valor, no por etiqueta | slicer-visual, list-slicer |
| Persistencia | El lector conserva su orden aunque esté en la vista de lectura; tiene «Restablecer valores predeterminados»; el autor puede impedir que se guarde. **En AuraData BI no se adopta**: el lector no ordena | end-user-change-sort |

URLs: `learn.microsoft.com/en-us/power-bi/` + `consumer/end-user-change-sort`, `create-reports/desktop-sort-by-column`, `visuals/power-bi-visualization-{tables,matrix-visual,slicers,slicer-visual,list-slicer,column-charts}`.

## 2. Qué hay en el código
- **Barras, columnas, líneas y áreas (ECharts Timeseries).**
  - `x_axis_sort` y `x_axis_sort_asc` están en `packages/superset-ui-chart-controls/src/shared-controls/customControls.tsx:133-213` y solo se ven si el eje es categórico (`utils/isSortable.ts:27`).
  - Las opciones dependen de las dimensiones. Sin dimensión de serie: el eje X o cada medida. Con dimensión o con varias medidas: `name/sum/min/max/avg` (`customControls.tsx:145-180`).
  - Con una sola serie se ordena en el servidor, con el `sortOperator` de pandas (`operators/sortOperator.ts:30-65`). Con varias, se ordena en el cliente con `sortRows` (`plugin-chart-echarts/src/utils/series.ts:538`).
  - En las barras horizontales, `x_axis_sort_asc` va invertido (migración `d0ac08bb5b83`).
  - El orden de las series y la leyenda ya existe en el cliente: `sort_series_type`/`sort_series_ascending` (`plugin-chart-echarts/src/controls.tsx:328-403`) y `legendSort`.
  - El `ORDER BY` del SQL (`order_desc`, `timeseries_limit_metric`) solo decide qué filas sobreviven al límite. El `pivot` de pandas reordena el índice después.
- **Circular y anillo.** Solo tienen `sort_by_metric` (por defecto `true`), que ordena descendente en el SQL (`Pie/buildQuery.ts:33`). No pueden ordenar de forma ascendente ni por categoría.
- **Embudo.** Tiene `sort_by_metric`, pero ECharts lo reordena siempre de forma descendente en el cliente (`Funnel/types.ts:73`, `Funnel/transformProps.ts:267`), y ningún control lo cambia.
- **Tabla.**
  - Orden guardado: `timeseries_limit_metric` + `order_desc` en modo agregado (solo por medida) y `order_by_cols` en modo raw.
  - El clic y el Shift+clic en el encabezado ya funcionan para cualquier usuario con react-table (`TableChart.tsx:1209-1226`), pero ese orden es temporal: no se guarda y se pierde al volver a dibujar la tabla.
  - Bug: `order_desc` vale `true` por defecto en el control, pero `buildQuery.ts:63` usa `false`.
- **Tabla dinámica (matriz).** `rowOrder`/`colOrder` (clave o valor, A→Z o Z→A) se aplican en el cliente. Cualquier usuario puede ordenar con un clic en el encabezado, por una sola columna, y no se guarda (`TableRenderers.tsx:689-745`).
- **Segmentador (filtro nativo Select y elemento `mibi-filter`).** `sortAscending` + `sortMetric` en la configuración del filtro, que solo cambia el editor.
- **«Ordenar por columna» en el modelo.** No existe nada equivalente.
- **Dashboard.**
  - El menú «…» (`SliceHeaderControls`) solo aparece en modo vista (`SliceHeader/index.tsx:327`). En modo edición, el encabezado del visual no tiene menú.
  - El menú contextual (`ChartContextMenu`) cuenta sus ítems a mano en `itemsCount`.
  - El panel del editor guarda con un PUT a `/api/v1/chart/{id}` y después recarga con `fetchSlices` + `addSliceToDashboard` (`ChartEditorPanel.tsx:117-152`).
- **Traducciones.** Ya existen «Sort ascending/descending», «Sort by», «Ascending» y «Descending». Falta «Sort axis».

## 3. Brechas por visual
| Visual | Power BI | Qué existe | Qué falta |
|---|---|---|---|
| Barras y columnas | «…» › Ordenar eje (campo + sentido) | `x_axis_sort`/`_asc` en el editor; servidor o cliente según las series | Ordenar desde el dashboard en modo edición, guardado en el chart; respetar la inversión horizontal |
| Líneas y áreas | Igual (con eje de categorías) | Igual que barras, solo con eje categórico | Lo mismo que barras; con eje temporal no se ofrece (como el eje continuo de Power BI) |
| Circular y anillo | Ordenar por medida o categoría, ascendente o descendente | Solo medida descendente (`sort_by_metric`) | Ascendente y por categoría: controles nuevos y cambios en `buildQuery` |
| Embudo | Ordenar por medida o categoría | El cliente ordena siempre descendente | Un control que fije el `sort` de ECharts y el `orderby` |
| Tabla | Clic y Shift+clic en el encabezado; el orden persiste | Clic y Shift+clic temporales para todos; el orden guardado es solo por medida | Que el editor guarde un orden por cualquier columna; arreglar el bug de `order_desc`. El clic temporal del lector se queda (§4.4) |
| Tabla dinámica | No documentado | `rowOrder`/`colOrder`; clic temporal en una columna | Ordenar filas por etiqueta o valor desde el menú de edición |
| Segmentador | «…» › Ordenar eje › Ascendente o descendente | `sortAscending`/`sortMetric` en la configuración del filtro | Atajo en el elemento de filtro del lienzo para el editor (fase opcional) |
| Ordenar por columna | En el modelo | Nada | Propiedad de la columna del dataset + backend (plan aparte) |
| Series y leyenda | No documentado | `sort_series_*`, `legendSort` en el editor | Nada obligatorio |
| Orden del lector | Persiste entre visitas y se puede restablecer | — | **Fuera de alcance por decisión del producto** |

## 4. Diseño

### 4.1 Quién ordena y dónde se guarda
- **Solo el editor ordena, en el modo edición del dashboard.** El orden se guarda en los **params del chart**. Como cada chart pertenece a un solo dashboard, el chart *es* el visual. Así hay una sola fuente de verdad: lectores, editores y el panel del editor ven el mismo `x_axis_sort`.
- **Lectores:** Mi BI no añade ninguna opción de orden en el modo vista. Ven el orden guardado.
- **`saveChartSort(chartId, sort)`:**
  - Hace un GET de `/api/v1/chart/{id}`, mezcla en los params lo que devuelva el adaptador y hace un PUT de `params` y `query_context`.
  - El `query_context` se regenera con `buildV1ChartDataPayload`, como al guardar desde Explore, para que no quede obsoleto para alertas, informes y MCP.
  - Después recarga el chart con un helper `reloadSavedChart(chartId)`, que sale de `ChartEditorPanel.onSaved` (`fetchSlices` + `addSliceToDashboard`) y que el panel reutiliza.
  - Si el PUT falla, por ejemplo con un 403, se muestra un aviso de error y no cambia nada.
- **Deshacer:** el propio menú «Ordenar eje» muestra «Deshacer» después de guardar, y restaura los params anteriores. Los avisos de la app no admiten botones, así que el aviso solo dice «Orden guardado». No entra en el Ctrl+Z del layout ni se revierte con «Descartar», porque el panel del editor ya guarda así.
- **Permisos:** el botón solo aparece en modo edición, al que solo llegan quienes pueden editar el dashboard. Además, el backend valida que se pueda escribir el chart (incluido `MIBI_WORKSPACE_ACCESS`).
- **Descartado: un override en el layout (`meta.mibiSort`).** Se deshace y se guarda con el dashboard, pero crea un segundo orden que Explore no ve y que se desincroniza.
- **Sin cambios en la consulta del dashboard:** el orden viaja en el `form_data` guardado. No hace falta tocar `getFormDataWithExtraFilters` ni `dataMask`.

### 4.2 Adaptadores por tipo de visual (`src/mibi/sort/`)
- `types.ts`: `VisualSort { by: string; ascending: boolean }`.
- `adapters.ts`: un adaptador por cada `viz_type`, con tres funciones:
  - `options(formData, datasource)` → `{ value, label }[]`, o `null` si el visual no se puede ordenar.
  - `current(formData)` → el orden activo, o `undefined`.
  - `toFormData(sort, formData)` → los cambios que hay que hacer en el `formData`.
- Cómo se comporta cada adaptador:
  - **Timeseries** (`echarts_timeseries_bar|line|area|step|scatter|smooth`) usa `x_axis_sort`/`x_axis_sort_asc`.
    - Solo se ofrece si el eje se puede ordenar, con el helper `isSortableAxis(formData, datasource)`. Necesita el datasource para saber el tipo de la columna del eje (String/Boolean/numérica) y lo lee del estado redux `datasources` del dashboard.
    - Las opciones salen de `xAxisSortChoices(formData, datasource)` en `src/mibi/sort/`. Copia la lógica de `customControls.tsx:145-180` sobre los mismos constantes, **sin mover el código upstream**: la rama `origin/adopt/37712-x-axis-sort-with-dimensions` ya modifica `customControls.tsx`, `isSortable.ts`, `utils/series.ts` y `Timeseries/transformProps.ts`.
    - Con dimensión, las etiquetas son las de `SORT_SERIES_CHOICES` («Category name», «Total value»…), que ya están traducidas.
    - **Horizontal, por verificar en la fase 2.** Hay que leer `transformProps` (el eje Y invertido) para ver qué orden sale en pantalla con `x_axis_sort_asc=true`. Después se fija el significado, «Ascendente = el menor arriba», y el test comprueba el orden de las categorías resultantes, no solo cómo se traduce el valor.
    - No se toca `sortRows`, `sortOperator` ni la semántica de `x_axis_sort`: esta capa queda por encima.
  - **Pie y Funnel** usan controles nuevos, `mibi_sort_by` (etiqueta de la medida o de la dimensión) y `mibi_sort_asc`. Si `mibi_sort_by` está vacío, se mantiene `sort_by_metric` y nada cambia para los charts que ya existen.
    - En `buildQuery`, el `orderby` sale de estos controles.
    - En el embudo, el `sort` de ECharts pasa a ser `'ascending'`, `'descending'` o `'none'` (al ordenar por categoría).
  - **Tabla** (`table`): ver la fase 5.
  - **Tabla dinámica** (`pivot_table_v2`) usa `rowOrder`: etiqueta o valor, ascendente o descendente.
  - Los demás visuales no tienen adaptador, así que no aparece el ítem, igual que con el treemap o el medidor en Power BI.

### 4.3 Interfaz
- **Modo edición:** `SliceHeader` muestra, solo en edición, un botón compacto «Ordenar eje» con un menú:
  - «Orden descendente» y «Orden ascendente», con una marca en el activo;
  - un separador;
  - los campos de «Ordenar por», con una marca en el activo.
  - El menú sale del hook `useVisualSortMenuItems(chartId)`.
  - No toca `ChartHolder` ni `SliceHeaderControls`.
- **Modo vista:** nada nuevo para nadie, tampoco para el editor. Para cambiar el orden hay que entrar en edición, como en la vista de edición de Power BI.
- **Panel del editor:** no requiere cambios. Explore ya muestra `x_axis_sort`, y los controles nuevos del circular y el embudo aparecen en su `controlPanel`.
- **Menú contextual (clic derecho):** se deja para después de fusionar `feat/auradata-brand` (ver §6), y solo en modo edición.

### 4.4 Clic en el encabezado de tablas y tablas dinámicas
**Decisión: se deja como está.** Cualquier lector puede reordenar una tabla o una tabla dinámica con un clic en el encabezado (Shift+clic en la tabla). Es un orden temporal, solo en su pantalla, que se pierde al recargar. Al abrir el dashboard, todos ven el orden que guardó el editor.
- En modo edición, el orden guardado se elige desde el botón «Ordenar eje», no con el clic del encabezado.

### 4.5 Textos
Todos van con `t()`, y la entrada en español se añade en `superset/translations/es/LC_MESSAGES/messages.po`.

| msgid | Español | Estado |
|---|---|---|
| Sort axis | Ordenar eje | Nuevo |
| Sort saved | Orden guardado | Nuevo |
| Undo | Deshacer | Si no existe |
| Couldn't save the sort | No se pudo guardar el orden | Nuevo |
| Row labels | Etiquetas de fila | Nuevo |
| Category name, Total value, Minimum value… | — | Ya existen (`SORT_SERIES_CHOICES`) |
| Sort ascending, Sort descending, Sort by | — | Ya existen |
| Sort pie slices by / Sort funnel by | Ordenar sectores por / Ordenar embudo por | Para los controles nuevos |

Hay que recompilar con `npm run build-translation`.

## 5. Fases y commits
1. **`feat(sort): add sort choices for a chart's axis`**
   - Archivos: `src/mibi/sort/axisChoices.ts`, con `isSortableAxis(formData, datasource)` y `xAxisSortChoices(formData, datasource)`. No toca `packages/superset-ui-chart-controls`.
   - Tests: Jest junto al helper. Comprueba que coincide con las opciones de `xAxisSortControl` en casos equivalentes.
2. **`feat(sort): add visual sort adapters`**
   - Archivos: `src/mibi/sort/{types,adapters}.ts`.
   - Tests: `adapters.test.ts`, que cubre la barra vertical, la barra horizontal (orden en pantalla, verificado con `transformProps`), con y sin dimensión, el eje temporal (sin orden) y los charts sin adaptador.
3. **`feat(dashboard): let editors sort a visual from its header`**
   - Archivos:
     - `src/mibi/sort/{saveChartSort.ts,useVisualSortMenuItems.tsx,SortAxisButton.tsx}`
     - `src/mibi/dashboard/reloadSavedChart.ts`, extraído de `ChartEditorPanel.tsx`
     - `SliceHeader/index.tsx`: el botón, solo en edición
     - «Deshacer» dentro del menú
     - `messages.po`
   - Tests:
     - Jest de `saveChartSort`, con fetch simulado: hace el PUT con `params` y `query_context`, deshace y gestiona el error.
     - Jest del botón: solo en edición, con las marcas correctas y sin adaptador no se muestra.
     - `ChartEditorPanel.test.tsx` tiene que seguir en verde.
4. **`feat(echarts): sort pie and funnel ascending or by category`**
   - Archivos:
     - `Pie/{controlPanel,buildQuery}.tsx`
     - `Funnel/{controlPanel,buildQuery,transformProps}.ts`
     - sus `types.ts`
     - los adaptadores
     - `messages.po`
   - Tests: Jest de `buildQuery`/`transformProps` en el plugin.
5. **`fix(table): use the control default for order_desc`** (commit aparte), seguido de **`feat(table): let editors set the table sort`**.
   - Desde el botón «Ordenar eje», el editor guarda `mibi_table_sort: [{ key, desc }]` como `initialState.sortBy`, y como `orderby` si hay paginación en el servidor.
   - El clic del encabezado sigue como está (§4.4).
   - La tabla dinámica se ordena desde el botón mediante `rowOrder`.
   - Tests: Jest en `plugin-chart-table` y `plugin-chart-pivot-table`.
6. **`test(dashboard): cover visual sorting end to end`**
   - Un nuevo `playwright/tests/experimental/dashboard/sort.spec.ts` comprueba tres cosas:
     - el editor ordena las barras de forma ascendente en modo edición y cambia el orden de las etiquetas del eje;
     - un lector abre el dashboard, ve ese orden y no tiene opciones de orden;
     - el editor deshace el cambio.

**Opcionales, cada uno con su propio plan:**
- Atajo de orden en el segmentador (`mibi-filter`), solo para el editor.
- Orden por defecto «medida descendente» en los gráficos nuevos. **No está verificado en la documentación de Power BI.**
- «Ordenar por columna» en el dataset (`TableColumn.extra.sort_by_column`, más el SQL y el `pivot` de pandas): es la única fase con backend y pytest.
- El ítem en el menú contextual en modo edición.

No hay backend en las fases 1 a 6: `params` es JSON libre, así que no hace falta ninguna migración.

## 6. Conflictos con `feat/auradata-brand` (cambios sin commit en el checkout principal)
| Archivo de esa rama | Este plan | Riesgo |
|---|---|---|
| `ChartContextMenu.tsx` (drill through, `itemsCount`) | **No se toca**; el ítem del clic derecho espera a la fusión | Ninguno ahora |
| `ChartHolder.tsx` (`InteractionControl`, visibilidad) | **No se toca**; el botón va en `SliceHeader`. Hay que comprobar que no se solapa con `InteractionControl` en modo edición | Bajo (visual) |
| `src/mibi/format/actions.ts`, `FormatPane.tsx`, `ObjectFlags.tsx` | No se tocan | Ninguno |
| `DashboardBuilder.tsx` | No se toca (`ChartEditorPanel` sigue montado ahí) | Ninguno |
| `activeAllDashboardFilters.ts` | No se toca | Ninguno |
| `src/mibi/report/bookmarks.ts` | El orden vive en el chart, así que los marcadores no necesitan guardarlo | Ninguno |
| `messages.po` | Las dos ramas añaden entradas | Conflicto de texto trivial al fusionar |

## 7. Riesgos
- **Caché de `getFormDataWithExtraFilters`.** No compara `chart.form_data`. Hay que verificar que `addSliceToDashboard` no deja un `formData` viejo; cubrirlo con un test.
- **`query_context` obsoleto** si solo se hace PUT de `params`. Se mitiga regenerándolo (§4.1).
- **Guardar fuera del ciclo del dashboard.** El orden se guarda al momento aunque después se pulse «Descartar». El menú ofrece «Deshacer».
- **Orden en horizontal.** No está verificado qué orden sale en pantalla; se comprueba en la fase 2 con un test sobre el orden real de las categorías.
- **Datasource en el dashboard.** Para saber si el eje se puede ordenar hace falta el tipo de columna. Si el datasource no está cargado, el botón no aparece.
- **Con dimensión**, el orden es por agregado (`sum`, `min`…), no por campo; las etiquetas tienen que dejarlo claro.
- **El `pivot` de pandas ordena el índice**, así que el `ORDER BY` del SQL no basta. Siempre hay que fijar `x_axis_sort`.
- **Rama upstream 37712.** Toca `customControls.tsx`, `isSortable.ts`, `utils/series.ts` y `Timeseries/transformProps.ts`. No se modifican aquí; hay que revisar los adaptadores cuando se fusione.

## 8. Verificación
- Jest: `npm run test -- src/mibi/sort`, `SliceHeader`, `ChartEditorPanel` y los plugins `echarts`, `table` y `pivot-table`.
- `npm run type`, `npm run lint`, `npm run build-translation` y `pre-commit run --all-files`.
- Playwright: `INCLUDE_EXPERIMENTAL=1 npx playwright test tests/experimental/dashboard/sort.spec.ts`.
- Prueba manual con el stack (`docker compose up -d --build`):
  - un dashboard con barras verticales y horizontales, un circular, un embudo, una tabla y una dinámica;
  - ordenar como editor, comprobar la vista de un lector (rol viewer del workspace), el deshacer y la recarga.
