# Bitácora merge 7.0 — área `dashboard`

Lista: `list-dashboard.txt` (52 archivos en `superset-frontend/src/dashboard/`).

Notas generales:
- La base del merge es `bc99b710bd` (master), no `upstream/6.1`. Lo que hizo el fork se mide con `upstream/6.1..main`.
- rerere está activo y reaplicó resoluciones de un intento anterior (2 nov) en los archivos sin marcadores; las reviso una a una
  contra `git diff upstream/6.1 main` y `git diff upstream/6.1 upstream/7.0`.
- 7.0 pasa de antd 5 a antd 6: en Tabs `.ant-tabs-content-holder` → `.ant-tabs-body-holder`, `.ant-tabs-content` (envoltorio)
  → `.ant-tabs-body`, `.ant-tabs-tabpane` → `.ant-tabs-content`; Tooltip `visible/onVisibleChange/overlayStyle` → `open/onOpenChange/styles`.
- 7.0 renombra `owners` → `editors` (modelo Subject, #38831).

## Archivos

### actions/hydrate.ts
- Fork: convierte el layout a celdas (`layoutToCells`) y da a cada objeto su celda (`layoutToPositions`), columnas por `gridColumnCount()`.
- 7.0: repara el layout con `removeUnreachableComponents` antes de indexarlo; `owners` → `editors` en las entidades de gráfico.
- Decisión: `layoutToPositions(layoutToCells(removeUnreachableComponents(...)))` (reparar primero, luego convertir) y `editors`.

### components/AddSliceCard/AddSliceCard.tsx
- Fork: tarjeta compacta con `VizTypeTile`, sin miniaturas ni `MetadataItem`. 7.0: etiqueta `datasetLabel()` (capas semánticas) en `MetadataItem`.
- Decisión: lo del fork; quito el import `datasetLabel` (sin uso). Queda solo el comentario CSS `/* */` de 7.0.

### components/BuilderComponentPane/index.tsx
- Fork: panel propio de cinco pestañas (gráficos, elementos, formato, selección, marcadores). 7.0: solo renombra las clases de Tabs por antd 6.
- Decisión: lo del fork, con el renombre de antd 6 aplicado a su CSS (`.ant-tabs-body-holder`/`.ant-tabs-body`).

### components/CustomizationsBadge/index.tsx
- Fork: texto «Change grouping». 7.0: comentario + `eslint-disable` de jsx-a11y y API de Tooltip de antd 6 (ya fusionado sin conflicto).
- Decisión: etiqueta del fork + comentario/eslint de 7.0.

### components/DashboardBuilder/DashboardBuilder.tsx (21 conflictos)
- Fork: cabecera a todo el ancho (`grid-column: 1 / -1`), informe en la columna 1 y panel de filtros a la derecha (columna 2),
  `FilterDock`/`TabsDock`, `ReportTheme`, papel tapiz del informe, presentación, `DrillthroughBar`, `TooltipPageHost`,
  `ChartEditorPanel`, `DataPane`, `MobileLayoutPane`, panel de filtros visible en edición, `draggableStyle` sin margen.
- 7.0: historial de versiones (`PreviewBanner`, `VersionHistoryColumn`, compuerta de vista previa sobre la rejilla y la barra de
  filtros, `closeVersionHistoryPanel` al editar), modo móvil de consumo (`useIsMobile`, cajón de filtros), `HeadlessAutoRefresh`,
  `show_filters` en modo informe (`hideFilterBar`), pestañas anidadas fijas (`StickyTabsOffsetContext`), tokens de baldosa
  (`dashboardTileBg/Border/BoxShadow`), cabecera con `min-width: 0; max-width: 100%`, z-index 102 para el gráfico maximizado.
- Decisión: árbol de render del fork y se injertan las piezas de 7.0:
  - Historial de versiones incluido (bandera `VERSION_HISTORY` activa por defecto). `VersionHistoryColumn` adaptada a nuestra
    rejilla: columna 3 en pantallas anchas (añadida como `auto` en `DashboardWrapper`) y superpuesta a la columna 1 (el
    informe) por debajo de XL, no a la 2 (que en el fork es el panel de filtros).
  - Compuerta de vista previa en la rejilla y en el panel de filtros no acoplado (`div` alrededor de `ReportTheme`).
  - Modo móvil de consumo incluido tal cual (inerte: `MOBILE_CONSUMPTION_MODE` apagado en la configuración de AuraData).
  - `hideFilterBar`, `HeadlessAutoRefresh`, `canEnterEditMode` en el estado vacío, `DropResult` tipado: de 7.0.
  - Tokens de baldosa de 7.0 NO adoptados: se mantiene el aspecto del fork (`--mb-bg-container`, `fade-in/out` del fork, sin borde
    ni `box-sizing`), porque el borde/sombra de cada gráfico sale de su formato y de `skin.css`.
  - `StickyTabsOffsetContext` NO se provee: el lienzo es una página fija escalada; pestañas anidadas pegajosas no aplican.
  - Separador del panel de filtros en embebido: `border-left` (el panel está a la derecha) en lugar de `border-right`.
  - Quitado `headerFilterBarWidth`/prop `filterBarWidth` de `StyledHeader` (el CSS del fork no lo usaba; 7.0 lo quitó).

### components/DashboardBuilder/DashboardWrapper.tsx (sin marcadores: rerere)
- Revisado: fork intacto + `lodash-es` y CSS del modo móvil de 7.0. Cambio mío: `grid-template-columns: 1fr auto auto` para la
  columna del historial de versiones (7.0 usa `auto 1fr auto` con los filtros a la izquierda).

### Archivos `DU` (nuevos en 7.0; el fork no los borró, la base del merge es master)
- `components/SliceHeader/SliceInfo.tsx`: tooltip de descripción del gráfico (#43271). Queda con el contenido de 7.0.
- `components/gridComponents/TabsRenderer/StickyTabsOffsetContext.ts`: lo importan `TabsRenderer.tsx`/`index.ts` de 7.0. Queda (7.0).
- `util/embeddedLayout.ts`: lo importan `embedded/api.tsx`, `DashboardGrid.tsx`, `Vertical.tsx`. Queda (7.0).

### components/UndoRedoKeyListeners/index.tsx (sin marcadores: rerere = 7.0)
- Fork: Ctrl+Shift+Z rehace. 7.0: lo reescribe con hooks y hace lo mismo (Shift+Z = rehacer, `event.code` para teclados no latinos).
- Decisión: 7.0 (cubre el arreglo del fork).

### components/PropertiesModal/sections/StylingSection.tsx y .test.tsx
- Fork: quitó selector de tema y plantillas CSS (componente flecha simple). 7.0: tema asignable y conversor de `@import` del CSS
  del dashboard (el backend rechaza `@import` al guardar).
- Decisión: componente del fork + conversor `@import` de 7.0 (el CSS propio del dashboard se mantiene en AuraData). El test
  (rerere lo dejó = fork) recibe los 5 tests de `@import` de 7.0 y su mock de `resolveCssImports`; los de tema/plantillas no.

### components/PropertiesModal/index.tsx y PropertiesModal.test.tsx
- Fork: solo quitó temas (estado, carga de `/api/v1/theme/`, `theme`/`theme_id` al guardar, props a `StylingSection`).
- 7.0: editores/visores con `SubjectPicker` (owners → editors), modo asíncrono, `renderExtraFields`, refresco tras guardar, etc.
- Decisión: partir de 7.0 y volver a quitar los temas (y el `rison` sin uso). Test: fuera el mock de `/api/v1/theme/` y los 3
  tests de temas de 7.0 (asignar tema, tema que falta, temas de sistema).

### components/SaveModal.test.tsx (AA)
- Fork: test de «guardar como siempre copia los gráficos, sin preguntar». 7.0: suite nueva completa.
- Decisión: suite de 7.0; el test de la casilla «also copy (duplicate) charts» se sustituye por el del fork (adaptado a los
  helpers de 7.0) y se quita «overwrite payload does not duplicate slices by default» (en el fork `duplicate_slices` es siempre
  `true`: un gráfico pertenece a un solo dashboard).

### components/SliceAdder.tsx
- Fork: solo lista los gráficos de este dashboard (`fetchSlices(undefined, term, sort, dashboardId)`), refresca al volver el
  foco a la ventana, «Create new chart» abre el panel del editor (`openChartEditor`), sin «Show only my charts», tarjetas de 64 px,
  mensaje vacío propio.
- 7.0: reescrito como componente de función, react-window v2 (`List` con `rowComponent`/`rowProps`, `SliceListRow` exportado),
  filtro por `editors`/`user_subjects`.
- Decisión: base 7.0 (react-window v2 obliga) y se reaplica todo lo del fork con hooks (`fetchDashboardSlices`, listener de
  `focus`, `EmptyMessage`, estilos). `SliceAdder.test.tsx` (ya resuelto fuera de mi lista) espera exactamente esto.

### components/SliceHeader/index.tsx
- Fork: cabecera con formato (`mibi-has-subtitle`, divisor, `role=heading`), `showBadges`, `RowCountLabel` condicionado por el
  formato, `HeaderExtras` (icono de información con la descripción, configurable en el panel Formato), botón de ordenar.
- 7.0: popover de descripción del gráfico (`SliceInfo`), modo móvil (`useIsMobile`), `ownState`, `supersetCanCSV` →
  `supersetCanDownload`, `MemoizedFiltersBadge/CustomizationsBadge`, `VizType.TableAgGrid`.
- Decisión: lo del fork + `ownState`, `isMobile` (oculta controles), clase `slice-header` añadida al `cx`, nombres Memoized,
  `canDownload={supersetCanDownload}` en `HeaderExtras` (renombre mecánico). El popover de descripción de 7.0 NO se añade: el
  fork ya muestra la descripción con su icono de cabecera (choque, fase 4).

### components/SliceHeaderControls/index.tsx
- Fork: «Edit chart» abre el panel del editor (`openChartEditor`) en vez de navegar. 7.0: `openInNewTab`, `extensionsRegistry`.
- Decisión: `extensionsRegistry` de 7.0; acción del fork; fuera el import `openInNewTab` sin uso.

### components/DashboardBuilder/DashboardContainer.tsx
- Fork: envuelve la rejilla en `CanvasFrame` (página fija) con `<ParentSize>` dentro.
- 7.0: `useParentSize` (hook; `<ParentSize>` de visx 4 recorta), espera a inicializar colores por dashboard antes de montar
  la rejilla, `createChartLayoutItemMap`, customizations nulas filtradas, `ant-tabs-tabpane` → `ant-tabs-content` (antd 6).
- Decisión: todo lo de 7.0, y `CanvasFrame` alrededor de un `div ref={parentRef}` que mide el ancho de la página (lo mismo
  que medía `ParentSize`).

### components/DashboardBuilder/DashboardContainer.test.tsx
- Fork: solo quitó el mock de `csstemplateasyncmodelview`. 7.0: tests de customizations nulas y de colores. Decisión: 7.0.

### components/DashboardBuilder/DashboardBuilder.test.tsx
- Fork: panel de filtros acoplado (`mibi-filter-dock`) de ancho fijo, objetivo de soltar buscado en `document`.
- 7.0: tests de historial de versiones, pestañas fijas, móvil, cabecera acotada, borde de baldosas.
- Decisión: imports unidos; test de ancho del fork + 3 tests de cabecera acotada de 7.0; `document.querySelector` del fork;
  fuera el test de borde de baldosa de 7.0 (no adoptamos esos tokens) y el de «hands the sticky header height to tab bars»
  (no proveemos el offset). Ajustados a nuestra rejilla: columna del historial `grid-column: 1` bajo XL y separador del panel
  embebido `border-left`.

### components/DashboardGrid.tsx y DashboardGrid.test.tsx
- Fork: rejilla de celdas (`columnWidth = CELL`, `availableColumnCount={gridColumnCount()}`, `GridGuide` en edición), sin guías de
  columna, estado vacío como tarjeta colgada arriba (`size="medium"`).
- 7.0: componente de función con hooks, clase `DASHBOARD_GRID_CLASS` (para medir la altura embebida), guía de fila al
  redimensionar por abajo, `first-of-type`.
- Decisión: base 7.0 (hooks + `DASHBOARD_GRID_CLASS`) con todo lo del fork reaplicado; sin guías de columna ni de fila (la
  rejilla de celdas es la guía; la guía de fila mide en píxeles de pantalla y fallaría con el lienzo escalado).
- Test (rerere): mantenía el test de guías de columna sin importar `GRID_COLUMN_COUNT` y los 2 de guía de fila de 7.0: quitados.

### components/Header/index.tsx
- Fork: título y acciones portados a la barra superior (`useReportHeaderSlot`, `createPortal`), cinta (`Ribbon`) en edición en
  lugar de deshacer/rehacer/descartar/guardar, `ModeMenu`, marcadores, «Reset filters», presentar, exportar, chip de workspace;
  sin temas.
- 7.0: modo móvil (`useIsMobile`, `onOpenMobileFilters`, botón de filtros en `leftPanelItems`), historial de versiones
  (`isVersionPreviewActive` bloquea editar/compartir/guardar, menú deshabilitado), editores (Subject), descripción al guardar,
  mensaje de tamaño de layout, Edit oculto en embebido, botones de deshacer/rehacer estilizados.
- Decisión: estructura del fork (portal + `Ribbon` + `ModeMenu` + botones propios); de 7.0: `onOpenMobileFilters` (lo pasa
  `DashboardBuilder`), `leftPanelItems`, `disabled` del menú en vista previa, `showFaveStar` sin móvil, `!isMobile` en la barra de
  metadatos, `userCanEdit && !isEmbedded && !isMobile` para «Edit dashboard», `dashboardInfo.description` en dependencias. Fuera
  los estilos de deshacer/rehacer de 7.0 (los lleva la cinta), `theme`/`themeId`. Quitado un `isEmbedded` duplicado en deps.

### components/Header/Header.test.tsx (sin marcadores: rerere)
- Revisado: fork (sin temas ni CSS templates, `header-save-button`) + tests nuevos de 7.0. Ajustes míos: los 2 tests de 7.0
  «Exit edit mode»/«Discard» se sustituyen por el del fork (la cinta siempre dice «Discard» y pregunta solo si hay cambios); el
  test de tamaño de layout de 7.0 pulsa `header-save-button` (con la cinta hay más de un texto «Save»).

### components/gridComponents/Chart/Chart.tsx
- Fork: `UnavailableChart` para gráficos de un tipo quitado (ofrece otro tipo). 7.0: `ownState` memoizado, `chartStackTrace`,
  `NOOP`, `exportPivotExcel` con aviso, `useLayoutEffect` para la descripción, `supersetCanDownload`.
- Decisión: condicional del fork con el `ChartContainer` y props de 7.0.

### components/gridComponents/ChartHolder/ChartHolder.tsx y ChartHolder.test.tsx
- Fork: celdas (`CELL`, `maxWidthCells`, `minObjectColumns`), formato (`shrinkX/Y`), `ObjectActions`, `MovableDraggable`,
  `InteractionControl`, `ObjectBadges`, nombre dinámico fuera de edición, bloqueo.
- 7.0: modo móvil de consumo (ancho = `GRID_COLUMN_COUNT`, alto limitado a la ventana con `GRID_BASE_UNIT`),
  `getPopupContainer` robusto en pantalla completa, tipos exportados.
- Decisión: todo lo del fork + `getPopupContainer` y tipos de 7.0. El código móvil de 7.0 se quita (usa `GRID_COLUMN_COUNT` y
  unidades de 8 px, incompatibles con la rejilla de celdas; tenemos `mibiMobile`). Test (rerere): fuera el bloque
  «mobile consumption mode height capping» de 7.0 y su import.

### components/gridComponents/Markdown/Markdown.tsx
- Fork: celdas, `MovableDraggable`, oculto (`mibiHidden`) y bloqueado (`isObjectLocked`). 7.0: reescrito con hooks y
  `ErrorBoundary`.
- Decisión: base 7.0 con lo del fork reaplicado; el `return null` de oculto va después de todos los hooks.

### components/gridComponents/Row/Row.tsx (sin marcadores: rerere = 7.0)
- Fork: medía la altura de la fila por sus objetos (`containerHeight`) para que pudiera encoger. 7.0 quita `containerHeight`
  (los destinos de soltar se estiran con `align-self: stretch`), añade eventos de forzar render para exportar y CSS móvil.
- Decisión: 7.0; el arreglo del fork deja de tener objeto (ya no hay altura medida). Verificar en fase 3 que la fila encoge.

### components/gridComponents/Tabs/Tabs.tsx
- Fork: filtra páginas ocultas para los lectores, `onDeletePage`, etc. 7.0: `closeIcon` sin `role`/`tabIndex`, `activeKey`
  resuelto cuando llegan hijos, «Delete». Decisión: lista del fork con el `closeIcon` de 7.0.

### nativeFilters/FilterBar/ActionButtons/index.tsx (sin marcadores: rerere)
- Revisado: fork (`autoApply`, sin botón Aplicar en el panel lateral) + formato de 7.0. Correcto.

### nativeFilters/FilterBar/FilterBar.test.tsx
- Fork: test «hides the Apply button when filters apply instantly». 7.0: varios tests nuevos (Clear All requerido, nombre,
  engranaje, orientación horizontal, auto-aplicar requerido con valor por defecto).
- Decisión: todos los de 7.0 + el del fork. Varios de 7.0 asumen el panel vertical de Superset (botón Aplicar, título): a
  verificar en fase 3.

### nativeFilters/FilterBar/FilterControls/FilterControl.tsx
- Fork: cada filtro del panel vertical es una tarjeta (`FilterCard` propio, `filterSummary`, limpiar uno a uno,
  `FilterEditButton`). 7.0: tooltip de comas en multiselección y tooltip de capas deck.gl.
- Decisión: ambos; los dos tooltips de 7.0 también en el `extra` de nuestra tarjeta.

### nativeFilters/FilterBar/FilterControls/FilterControls.tsx
- Fork: secciones por nivel (todas las páginas / esta página / visuales), filtros de otras páginas no se listan.
- 7.0: `SectionHeader` pasa a `<button>`, contenido del desplegable horizontal calculado con los ids frescos del
  `DropdownContainer`, customizations desbordadas.
- Decisión: secciones del fork (su cabecera ahora `type="button"` sin `role`/`onKeyDown`, por ser botón); desplegable
  horizontal de 7.0 pero sin filtros fuera de alcance (`filtersOutOfScope={[]}`, `showCollapsePanel={false}`), como el fork.

### nativeFilters/FilterBar/FilterControls/GroupByFilterCard.tsx
- Fork: quitó la tarjeta emergente (hover card) y el nombre del dataset. 7.0: `useDisplayControlDatasource` (capas
  semánticas), comparador de orden por etiqueta, popup del select horizontal.
- Decisión: 7.0 sin la tarjeta emergente (`GroupByFilterCardContent`, `Popover`, `isHoverCardVisible`) ni `datasetName`.

### nativeFilters/FilterBar/Vertical.tsx
- Fork: el panel es una franja del informe (fondo transparente, línea a la izquierda, alto fijo `height`), barra plegada con
  rótulo vertical «Filtros» y contador de filtros activos, lista que flexiona, sin hueco para botones pegajosos.
- 7.0: modo embebido (`maxHeight`, clases de `embeddedLayout`), `mobileMode`, `CollapsedBar` como `<button>`, URL filters,
  `clearAllTriggers`.
- Decisión: base 7.0 con el aspecto del fork reaplicado (alto fijo cuando no es embebido; `border-left`; `CollapsedBar`
  botón con el CSS del fork; lista siempre `flex`; `padding-bottom` de 4 unidades).

### components/resizable/ResizableContainer.tsx
- Fork: celdas, redimensionar desde cualquier borde con `mibiPos` (`resizeObject`, `ObjectShiftContext`), escala del lienzo,
  insignia de tamaño en celdas, `lockAspectRatio`.
- 7.0: etiqueta flotante con la altura en px al redimensionar por abajo, `RESIZE_HANDLE_Z_INDEX`, `children: ReactNode`, CSS móvil.
- Decisión: fork + `RESIZE_HANDLE_Z_INDEX`, `ReactNode` y CSS móvil (inerte). Fuera la etiqueta en px (duplica nuestra insignia en
  celdas y su posición en pantalla no casa con el lienzo escalado).

### nativeFilters/FiltersConfigModal/NewItemDropdown.tsx
- Fork: «Add grouping control». 7.0: menú como `MenuProps` (antd 6). Decisión: 7.0 con el texto del fork.

### nativeFilters/FiltersConfigModal/transformers/filterTransformer.ts, types.ts (rerere) y filterTransformer.test.ts (AA)
- `.ts` y `types.ts`: revisados, 7.0 + `scopeLevel` del fork. Correctos.
- Test: rerere lo dejó = 7.0 y se perdían los 3 tests del fork de `scopeLevel`. Unidos (7.0 + fork, con `FilterScopeLevel`).

### constants.ts, util/constants.ts, reducers/undoableDashboardLayout.ts, util/activeAllDashboardFilters.ts, util/permissionUtils.ts,
### containers/DashboardPage.tsx (sin marcadores: rerere)
- Revisados uno a uno: conservan lo del fork (`BUILDER_SIDEPANEL_RAIL_WIDTH`, `CHART_WIDTH/HEIGHT = 12`, `GRID_MIN_ROW_UNITS = 2`,
  `formatGroup` y `syncGridColumnCount` en el undo, alcance de drill through, `dashboard.can_edit` para contribuidores, sin
  `CrudThemeProvider`) y añaden lo de 7.0 (z-index de menús/handles, eventos de forzar render, reset de historial al hidratar,
  editores Subject/`extra_editors`, filtros Rison en URL, estado «dashboard no existe», título saneado). Correctos.

### types.ts
- Decisión: `filter_bar_auto_apply` (fork) + `async_mode` (7.0); sin `theme` en `DashboardInfo`.

### util/charts/getFormDataWithExtraFilters.ts
- Fork: caché invalidada por `sourceFormData` (formato del gráfico en el layout). 7.0: quita `sortMetric`/`order_by_cols` del
  group by dinámico. Decisión: 7.0 en los 5 bloques; lo del fork se fusionó solo y sigue.

### util/permissionUtils.test.ts
- Decisión: tests de 7.0 (editores Subject) + el del fork de `can_edit` reescrito como test plano.

### reducers/dashboardInfo.test.ts (AA)
- Decisión: tests de 7.0 sin los 3 de tema (`existingTheme`, `stateWithTheme`).

## Resumen
Resueltos los 52 archivos de la lista, ninguno con marcadores. Ninguno queda borrado: los 3 `DU` (`SliceInfo.tsx`,
`StickyTabsOffsetContext.ts`, `embeddedLayout.ts`) quedan con el contenido de 7.0.

## Abierto fase 2
- Ninguno propio del área (los cambios de `owners` → `editors` y del historial de versiones dependen del backend de 7.0).

## Abierto fase 3
- `src/mibi/format/ChartFieldsSections.tsx:150` y `chartFields.ts:136` leen `slices[id].owners`; con 7.0 son `editors` (hydrate ya guarda
  `editors`). Revisar si `saveChartFields` manda `owners` en un PUT.
- antd 6: `skin.css:1720/1734` y `dashboard/styles.ts` siguen con `.ant-tabs-content(-holder)`; buscar en `src/mibi` props de antd 5
  (`visible`, `onVisibleChange`, `overlayStyle`, `dropdownRender`, `destroyTooltipOnHide`).
- `SliceHeader/SliceHeader.test.tsx` (fuera de mi lista, ya resuelto) tiene 5 tests del popover de descripción de 7.0 que no se
  añade; quitarlos o adaptarlos al icono de `HeaderExtras`.
- Ejecutar y ajustar: `DashboardBuilder.test.tsx`, `Header.test.tsx`, `FilterBar.test.tsx` (tests de 7.0 sobre el panel vertical de
  Superset), `DashboardGrid.test.tsx` (test de «flexbox centering» del estado vacío ya no casa con la tarjeta del fork),
  `SliceAdder.test.tsx` (búsqueda con debounce), `ChartHolder.test.tsx`, `StylingSection.test.tsx`.
- Traducciones al español de textos nuevos de 7.0 que ahora se ven: conversor `@import` del CSS, «Open filters», tooltip de comas
  en multiselección, «This dashboard does not exist», etc.
- Comprobar que una fila encoge al encoger sus objetos (7.0 quitó `containerHeight`, que el fork había arreglado).
- `DashboardContainer` monta la rejilla solo tras inicializar colores; comprobar que `CanvasFrame` mide bien la página.

## Abierto fase 4
- Historial de versiones (bandera `VERSION_HISTORY` activa por defecto): columna 3 añadida a la rejilla y superpuesta a la columna 1
  bajo XL; revisar con el lienzo fijo, la barra de páginas y la cinta. El panel de filtros acoplado (`InFilterDock`, el caso habitual
  con barra de páginas) no tiene la compuerta de vista previa: los filtros siguen activos al previsualizar una versión.
- Modo móvil de consumo de 7.0 vs `mibiMobile`: incluido pero inerte (bandera apagada) en `DashboardBuilder`, `Header`,
  `SliceHeader`, `Row`, `ResizableContainer`, `DashboardWrapper`; quitado de `ChartHolder` (usa `GRID_COLUMN_COUNT`). Decidir si se
  elimina del todo.
- Tooltip de descripción del gráfico (7.0, `SliceInfo`) vs icono de información de `HeaderExtras`: no se añade el de 7.0.
- Tokens de baldosa de 7.0 (`dashboardTileBg/Border/BorderRadius/BoxShadow`) no adoptados; el aspecto lo da el formato del fork.
- Pestañas anidadas fijas de 7.0 (`StickyTabsOffsetContext`) no se proveen en el lienzo fijo.
- Guías de fila de 7.0 al redimensionar y etiqueta en px: no adoptadas (rejilla de celdas e insignia en celdas).
- Capas semánticas (`datasetLabel`, `useDisplayControlDatasource`) entran tal cual en el group by; la tarjeta de añadir gráfico no
  muestra la etiqueta.

## Verificación final
- Script: cada línea `+` de `git diff upstream/6.1 main` de los 52 archivos buscada en la copia de trabajo. Todo lo que falta es
  intencional y está en esta bitácora (reescrituras a hooks de 7.0 en SliceAdder/Markdown/DashboardGrid/UndoRedo, `ParentSize` →
  `useParentSize`, `headerFilterBarWidth`, renombres antd 6, test de SaveModal sustituido, `owners` → editores).
- Imports sin uso: solo `fetchMock` en `Header.test.tsx`, que ya estaba así en `main` (fase 3, lint).
- `Markdown.tsx`: `ResizableContainer` conserva `id={component.id}` (necesario para `mibiPos`/`resizeObject`).
- Fuera de mi lista, sin referencias a lo quitado (`MOBILE_CHROME_HEIGHT`, `GroupByFilterCardContent`, `grid-row-guide`,
  `onThemeChange`, `selectedThemeId`).
- Fase 4 (añadido): `features/versionHistory/useDashboardVersionPreview.ts` (156-181) busca el tema de la versión (`theme_id` →
  objeto tema) y lo hidrata; en AuraData no hay temas guardados ni API de temas. Revisar el restaurar/previsualizar de versiones.
