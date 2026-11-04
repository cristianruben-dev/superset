# Bitácora del merge 7.0: área `charts`

Archivos de `list-charts.txt` (plugins y paquetes de superset-frontend). "Fork" = `git diff upstream/6.1 main`, "7.0" =
`git diff upstream/6.1 upstream/7.0`. Varios archivos ya venían resueltos por `rerere` (marcados UU sin marcadores);
los revisé uno a uno contra los dos lados.

## Paquetes

### `packages/superset-core/package.json`
- Fork: añadió las rutas `./chat` y `./navigation` (cherry-pick de SIP-214, que 7.0 ya trae).
- 7.0: versión 0.2.0, `publishConfig`, `scripts`, dependencia `lodash-es`.
- Decisión: versión de 7.0 entera; lo del fork ya está dentro.

### `packages/superset-core/src/theme/types.ts`
- Fork: quitó de `ThemeContextType` lo de temas guardados (`setTemporaryTheme`, `clearLocalOverrides`, `getCurrentCrudThemeId`,
  `hasDevOverride`, `createDashboardThemeProvider`, `getAppliedThemeId`).
- 7.0: tokens nuevos (botones, `selectOptionActiveOutline`, `labelBorderRadius`, tiles de dashboard, results grid) y en el
  contexto `hasThemeConfigOverride`, `refreshSystemThemes` más lo anterior.
- Decisión: tokens de 7.0 sí; contexto con la versión del fork (sin temas guardados). Quedan fuera `hasThemeConfigOverride`
  y `refreshSystemThemes` (dependen de temas por dashboard / pantalla de temas) → fase 3.

### `packages/superset-ui-chart-controls/src/types.ts`
- Único conflicto: `export default {}` que 7.0 quitó. Tomé 7.0. El resto del fork (FontControl, ColorPickerControl,
  `TableColumnConfig` ampliado, sin `AnnotationLayerControl`/`annotations`) se conserva.

### `packages/superset-ui-core/src/chart/index.ts` (rerere)
- Exporta `Hooks` (7.0), quita los `__hack_reexport` (7.0) y mantiene `export * from './visualFormatting'` (fork). Correcto.

### `MatrixifyGridRenderer.test.tsx`
- Import combinado: `ThemeProvider, supersetTheme` en una línea (7.0) + `matrixifyGridStyle` (fork). Test del fork intacto.

### `Button.test.tsx`, `Label.test.tsx`
- Fork: quitó Storybook; los tests de galería se cambiaron por tests propios (todas las combinaciones de estilo/tamaño, `test.each`
  por tipo de etiqueta).
- 7.0: sigue importando `Button.stories`/`Label.stories` y añade tres tests de regresión del icono de `Label` (antd v6).
- Decisión: imports del fork (sin stories) + los tests nuevos de 7.0; quitado el test de galería de Storybook de 7.0 (Storybook
  no existe en el fork).

### `PageHeaderWithActions/index.tsx` (rerere)
- Rerere dejó 7.0 (memo, `leftPanelItems`, `buttonControlHeight`...) con el CSS de móvil del fork en lugar del bloque
  `MobileConsumptionMode` de 7.0. Quité el import `FeatureFlag, isFeatureEnabled` que quedaba sin usar.
- Abierto fase 4: modo de consumo móvil de 7.0 frente a nuestro CSS de teléfono.

### `Select/Select.tsx`
- Fork: solo cambió un comentario (quitaba la referencia a Storybook). Tomé 7.0 entero y reapliqué ese comentario.

### `Table/cell-renderers/ActionCell/fixtures.ts` (rerere)
- Igual que el fork (sin `storybook/actions`, `onClick: () => {}`). Correcto: Storybook está fuera.

## plugin-chart-echarts

### `BigNumber/constants.tsx` (modify/delete) → **se queda, con el contenido de 7.0**
- No es un borrado del fork: el archivo no existía en 6.1 ni en la base del merge; lo crea 7.0 al sacar `PROPORTION` de
  `BigNumberViz.tsx`. Lo importan `BigNumberViz.tsx` y `BigNumberTotal/transformProps.ts`. En disco = 7.0.

### `BigNumber/BigNumberViz.tsx`
- Imports: `cardFormat` y `getDisplayFormatter` (fork) + `PROPORTION` desde `./constants` (7.0).
- Valor: `displayFormatter` del fork + rama nueva de 7.0 para `bigNumber` string (se muestra tal cual).

### `Bubble/transformProps.ts`
- Solo era el sitio de `interval` (7.0 lo pasa a `axisLabel.interval`). Tomé 7.0; `clip: false`, margen derecho por la burbuja
  mayor y `applySpecialChartFormat` del fork siguen.

### `Funnel/transformProps.ts`
- Import combinado (`LegendOrientation, Refs` + `funnelSort`); margen de leyenda horizontal de 7.0. `mibiSortBy/Asc` y
  `applySpecialChartFormat` siguen.

### `Pie/controlPanel.tsx` (rerere)
- 7.0 + secciones del fork (`buildSpecialChartSections('pie')`, `categorySortControls`, formato de etiquetas y leyenda). Correcto.

### `Pie/transformProps.ts`
- Serie: estructura del fork (`applyValueLabelStyle`) con el `radius`/`center`/`startAngle`/`endAngle` de `pieLayout` de 7.0
  (arcos parciales). Leyenda: `applyLegendFormatting` del fork.
- Abierto fase 4: el centro del donut del fork (`specialChartFormat`: valor/etiqueta/imagen del centro) supone el centro del
  canvas; con arcos parciales `pieLayout.center` se mueve. Además el `showTotal` de 7.0 se ancla ahora en el centro del donut
  y puede pisarse con nuestro contenido del centro.

### `Timeseries/constants.ts`, `Timeseries/types.ts` (rerere)
- 7.0 (márgenes de título 40/50, `gridlines`, `axisTicks`, `valueLabelPosition`, `tooltipTruncation`...) + del fork
  `annotationLayers: []` y `VisualFormatFormData`. Correcto.

### `Timeseries/Regular/Scatter/controlPanel.tsx`
- 7.0 rehízo el panel (`querySection` propio, `createAxisControl`, `gridlines`/`axisTicks`). Tomé 7.0 y reapliqué lo del fork:
  `buildSpecialChartSections('scatter')` primero, sin `annotationsAndLayersControls`, y las secciones de formato al final.

### `Timeseries/transformers.ts`
- Conflicto sin relación con el fork (etiquetas de barras «Auto» y total de pila de 7.0). Tomé 7.0; el
  `X_AXIS_CROSS_FILTER_SOURCE` del fork se conserva.

### `Waterfall/types.ts`
- Ambos: `yAxisBounds` (fork) y `showYAxis` (7.0).

### `src/types.ts`, `src/constants.ts`
- `types.ts`: quitado el import `TooltipMarker` que ya no se usa (7.0).
- `constants.ts`: constantes de etiquetas del eje X de 7.0 y `yAxisTitleMargin: 50` (el 15 del fork era el de 6.1). Se conserva
  `X_AXIS_CROSS_FILTER_SOURCE` del fork.

### `components/Echart.tsx`
- Imports: `LegacyGridContainLabel`, `loadLocale`, `SpacedXAxisFormatter` (7.0) + `applyHostFormat` (fork).
- Antes de `setOption`: geometría para el formateador espaciado del eje X (7.0) y quitar la marca de pintado
  `echarts-render-finished` (7.0); el `setOption` es el del fork con `applyHostFormat(... data-mibi-echarts)`.
- Se conservan las sondas de páginas tooltip (`onMarkOver`/`onMarkOut`, `data-mibi-probe`, `mibi:mark-leave`) y el resto
  (dataZoom preservado, `queryEventHandlers`) que ya estaba en ambos.

### `components/Echart.test.tsx` y `test/components/Echart.test.tsx` (add/add)
- La versión del fork era un subconjunto de la de 7.0 (backports de 6.2). Tomé 7.0 en ambos.

### `Timeseries/EchartsTimeseries.tsx`
- Fork: backports de 6.2 (#41104/#41111) y #44869 (clic en etiqueta de categoría filtra por el eje X aunque haya dimensiones,
  con `crossFilterSource: 'xAxis'` para no atenuar series). 7.0 trae #41104/#41111 en otra forma y añade filtro cruzado por eje
  temporal, leyenda HTML (`TimeseriesLegend`) y `getViableTimeseriesEchartOptions`; no trae #44869.
- Decisión: 7.0 como base y #44869 encima: `canCrossFilterByXAxisLabel = canCrossFilterByXAxis || eje de categoría`, guarda
  `componentType === 'series'` en el clic con dimensiones, guarda en el menú contextual (ya estaba), query `xAxis`/`yAxis` de 7.0
  con `targetType === 'axisLabel'`.

### `Timeseries/EchartsTimeseries.test.tsx`
- 7.0 entero + los tres tests de #44869 que 7.0 no tiene (adaptados a `targetType: 'axisLabel'` y temporizadores falsos).
  Quitado el test del fork «no emite filtro con eje temporal sin dimensiones»: 7.0 ahora sí lo emite a propósito.

### `Timeseries/transformProps.ts`
- 7.0 como base (leyenda HTML, `getViableTimeseriesEchartOptions`, formateador espaciado del eje X, truncado del tooltip,
  `getMaxStackedValueByStack`, `gridlines`/`axisTicks`). Reaplicado todo lo del fork: formato de etiquetas/series/condicional,
  `keepBarRadiusOnStackTop`, `applyAxisFormatting` con `gridline_*`, eje Y secundario (`applySecondaryAxis`), campos del tooltip
  (`tooltipFieldRows`), `applyLegendFormatting`, `applyChartFormat` y `applySpecialChartFormat` para scatter (sobre las opciones
  finales). Quitado el `getSymbolMarker` que 7.0 eliminó (y el resto de esas líneas que git dejó colgadas).
- `triggerEvent` del eje X: categoría siempre (#44869) y tiempo solo sin dimensiones (7.0).

### `MixedTimeseries/transformProps.ts`
- 7.0 base (`getAxisFormatterConfig`, formateador espaciado, truncado) + fork (`valueLabelFormatter ??`, `styleSeries`, campos
  del tooltip, `applyLegendFormatting`, `keepBarRadiusOnStackTop`, formato de ejes y `applyChartFormat`).
- Arreglado un error del auto-merge: `baseChartPadding` usaba `effectiveLegendMargin` antes de declararlo; vuelve a
  `legendMargin` como en 7.0.

### `utils/series.ts`
- Fork: solo quitó los botones «Todo/Invertir» (`selector`) de la leyenda. Tomé 7.0 y volví a quitar `selector`/`selectorLabel`.

### Tests de echarts (`test/...`)
- `MixedTimeseries/buildQuery.test.ts`, `MixedTimeseries/transformProps.test.ts`, `Pie/transformProps.test.ts`,
  `Waterfall/transformProps.test.ts`: 7.0 entero + los tests que añadió el fork al final.
- `Timeseries/transformProps.test.ts`: 7.0 + tests del fork (dimensiones con `triggerEvent`, eje secundario, densidad de etiquetas
  en pila stream). Quitado el duplicado `xAxisForceCategorical` que 7.0 ya trae.
- `Timeseries/transformers.test.ts`: 7.0 + test de `crossFilterSource` del fork.
- `utils/series.test.ts`: 7.0 con `expectedThemeProps` sin `selector`.

## plugin-chart-pivot-table

### `test/tsconfig.json` (modify/delete) → **se queda, con el contenido de 7.0**
- No es un borrado del fork: no existía en 6.1 ni en la base del merge; 7.0 lo crea (igual que los de echarts y table).

### `src/plugin/controlPanel.tsx`
- Fork: secciones de formato de tabla/matriz, «Specific column», y `metricsLayout`+totales pasados a «Matrix layout» (customize).
- 7.0: quita `aggregateFunction` (SIP-216, totales por rollup en BD), añade `showValuesAs` (no es renderTrigger: pide consulta)
  y `series_limit` oculto en vistas semánticas.
- Decisión: fuera `aggregateFunction`; la sección «Options» de datos queda solo con `showValuesAs`; «Matrix layout» del fork
  con el resto.

### `src/PivotTableChart.tsx`
- Imports del fork sin `aggregatorTemplates` (7.0 lo dejó de usar); deps de 7.0. Arreglado un `isActiveFilterValue` duplicado
  que dejó el auto-merge.

### `src/react-pivottable/TableRenderers.tsx` (el más delicado)
- 7.0 convirtió `TableRenderer` de clase a componente de función (006a1800be), cambió el desplegable a `<button>` (a11y),
  `convertToNumberIfNumeric` → `toDateFormatterInput`, totales por rollup (SIP-216) y `showValuesAs`.
- Fork (sobre la clase): formato de columnas (`columnConfig`, `formatValue`, `renderValue` con enlace e iconos condicionales),
  barras en celdas (`columnRanges`), etiquetas de subtotal, modo escalonado (`table_stepped`), filas en blanco y repetición de
  encabezados, «expandir hasta nivel» y niveles de subtotal, minigráficos (sparklines), fuente de subtotales, marcas
  `data-mibi-level`/`data-mibi-head`, congelar encabezados de fila y sondas de páginas tooltip (`hoverCell`/`leaveCell`).
- Decisión: partí del componente de 7.0 y porté todo el fork como hooks: helpers en `useCallback` con `tableFormat` en deps
  (y en las deps de los `render*`), `columnRanges` devuelto en la configuración memorizada, «expandir hasta nivel» con el patrón
  de «valor aplicado en estado» (se aplica al cambiar el ajuste, como antes), encabezados congelados con `useRef` +
  `useLayoutEffect` sin deps, `collapsed[flatKey(key)] === true` en `visibleKeys`. `aria-label` del desplegable pasado al
  `<button>` de 7.0 (el `onKeyDown` del fork sobra con un botón).
- Con un `showValuesAs` de porcentaje, el formato numérico de columna del fork no se aplica (se respeta el % del pivot).
- Sin ejecutar tests: verificado solo por grep (sin `this.`, todos los identificadores del fork presentes).

### Tests del pivot
- `test/plugin/transformProps.test.ts`: test nuevo de 7.0 (propiedades sueltas) + aserción de `tableFormat` del fork.
- `test/react-pivottable/tableRenders.test.tsx`: 7.0 reescribió el archivo con render real; los dos tests del fork que llamaban
  métodos de la clase (`placeFrozenRowHeaders`, `hoverCell`) se reescribieron sobre el render (más uno de «fuera de página
  tooltip no hace nada»). El cambio del fork a `className === 'pvtVal pvtSubtotalValue'` ya no aplica (7.0 usa `classList`).

## plugin-chart-table

### `src/types.ts`, `src/transformProps.ts`
- Fork: `tableFormat`, `savedSort`, `mibi_table_sort`, `order_desc` por defecto `true`. 7.0: `resolveDetectedCurrency`.
- Decisión: ambos; quitado `normalizeCurrency` (7.0 ya no lo usa).

### `src/TableChart.tsx`
- Imports de `tableFormat` del fork; `DateWithFormatter` viene ya de `@superset-ui/core` (7.0, se quitó el import local).
- Icono de orden: iconos antd de 7.0 (`CaretUp/Down`) con la rama del fork del orden guardado (`savedDesc`).
- Filtro cruzado: `getCrossFilterValue` de 7.0 (fechas). Estilo de celda del fork (`columnStyle`). Flecha con `style` (7.0) +
  `iconNode` (fork). `role: 'rowheader'` del fork se mantiene.

### `test/TableChart.test.tsx`
- 7.0 entero + los dos tests del fork (orden descendente por defecto, orden guardado en el encabezado), cambiando los iconos
  `react-icons` por `CaretUpOutlined`/`ColumnHeightOutlined`, que es lo que 7.0 dibuja.

## Comprobaciones finales
- Ningún archivo de la lista tiene marcadores. Revisé contra 7.0 los archivos fuente grandes para encontrar errores del
  auto-merge (encontrados y arreglados: `isActiveFilterValue` duplicado en `PivotTableChart.tsx`, `effectiveLegendMargin`
  antes de declararse en Mixed, líneas de `getSymbolMarker` colgadas en Timeseries).
- No se ejecutaron jest/tsc/oxlint (regla del brief): todo lo anterior está pendiente de verificar en la fase 3.

## Abierto fase 2
- (nada del área charts)

## Abierto fase 3
- Pasar jest/tsc/oxlint sobre todo lo de esta área; en especial `TableRenderers.tsx` (portado a hooks a mano),
  `EchartsTimeseries.tsx`, `Timeseries/transformProps.ts` y los tests reescritos del pivot.
- `ThemeContextType` sin `hasThemeConfigOverride` ni `refreshSystemThemes`: cualquier código de 7.0 que los use (embedded SDK,
  pantalla de temas) no compilará; adaptar o quitar.

## Abierto fase 4
- Leyenda HTML nueva de Timeseries (`TimeseriesLegend`, leyenda «Plain» arriba/abajo): trae `onAll`/`onInverse` (los botones que
  quitó el fork), no recibe `legendAlign`/`legendFont`/`legendIcon` (la leyenda de ECharts queda oculta) y el cálculo de
  leyenda sigue reservando `ESTIMATED_LEGEND_SELECTOR_WIDTH` para botones que ya no se dibujan.
- Controles de 7.0 `gridlines`/`axisTicks` (Scatter y Timeseries) frente a nuestros `gridlines_hidden`/`gridline_*` del panel
  Formato: conviven, pero hay dos maneras de ocultar las líneas.
- Etiquetas de barras de 7.0 (`valueLabelPosition` con «Auto», total de pila) frente a las etiquetas del fork
  (`applyValueLabelStyle`, `valueLabelDensity`, totales `__mibi`).
- Pie con arcos parciales (centro del donut y `showTotal`), ver arriba.
- Modo de consumo móvil de 7.0 en `PageHeaderWithActions` descartado a favor del CSS del fork.
- Pivot: `aggregateFunction` ya no existe (grep en `src/mibi`: no se usa). `showValuesAs` queda en «Options» de datos;
  decidir su sitio en el panel Campos/Formato. Con un % activo, el formato numérico de columna del fork se ignora.
- Table V2 de 7.0: no se tocó; nuestro formato (`tableFormat`, orden guardado, tooltips) solo existe en la tabla clásica.
