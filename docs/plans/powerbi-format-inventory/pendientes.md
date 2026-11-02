# Lo que falta de Power BI, por fase

Generado por `scripts/mibi/format_inventory.py`: no lo edites a mano. Cada opción sale una vez, con los
gráficos donde falta. Lo que ya tenemos de cada gráfico está en [`por-grafico/`](por-grafico/).

| Fase | Qué | Opciones abiertas | P1 | P2 | P3 |
| ---: | --- | ---: | ---: | ---: | ---: |
| 2 | General, común a todos | 9 | 5 | 4 | 0 |
| 3 | Barras, columnas, líneas, áreas y combinados | 104 | 85 | 19 | 0 |
| 4 | Tabla y matriz | 149 | 131 | 16 | 2 |
| 5 | Tarjeta, KPI, circular y anillo | 105 | 94 | 0 | 11 |
| 6 | Cascada, embudo, treemap, medidor y dispersión | 161 | 128 | 33 | 0 |
| 7 | Segmentadores | 763 | 178 | 130 | 455 |
| 8 | Análisis y tooltips | 132 | 0 | 120 | 12 |
| 11 | Mapas | 429 | 92 | 59 | 278 |
| 12 | Resto de P3 y gráficos nuevos | 940 | 312 | 207 | 421 |

## Fase 2: General, común a todos

### Acción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Destination | `drillthroughSection` | 2 | Falta | 23 | El detalle necesita el valor de una marca |
| Show tooltips | `showDefaultTooltip` | 2 | Parcial | 23 | General > Acción |
| No tooltips | `suppressDefaultTooltip` | 2 | Parcial | 23 | General > Acción |
| Type | `type` | 2 | Parcial | 23 | General > Acción |

### Propiedades

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Data Volume | `dataVolume` | 1 | Falta | 1 |  |
| formatString | `formatString` | 1 | Parcial | 23 | Formato numérico (y_axis_format) |
| Layout | `layout` | 1 | Falta | 1 |  |
| visualType1 | `visualType1` | 1 | Falta | 2 |  |
| visualType2 | `visualType2` | 1 | Falta | 2 |  |

## Fase 3: Barras, columnas, líneas, áreas y combinados

### Colores / barras

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color saturation | `fillRule` | 1 | Parcial | 8 | Reglas y escala de dos colores por el valor de la barra; sin otro campo |
| Show all | `showAllDataPoints` | 1 | Falta | 4 |  |

### Disposición

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Space between ribbons and columns | `ribbonGapSize` | 1 | Falta | 4 |  |
| Reverse order | `seriesOrderReversed` | 1 | Parcial | 10 | Orden de series (sort_series_ascending) |
| Sort by value | `seriesOrderSorted` | 1 | Parcial | 8 | Orden de series (sort_series_type) |
| Series explosion | `stackedGapExplodes` | 1 | Falta | 4 | El motor de gráficos no separa los segmentos de una pila |
| Space between series | `stackedGapSize` | 1 | Falta | 5 | El motor de gráficos no separa los segmentos de una pila |

### Eje X / categorías

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `axisStyle` | 1 | Falta | 12 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Type | `axisType` | 1 | Parcial | 12 | Sale del tipo de la columna; se fuerza con «Forzar categórico» |
| Maximum | `end` | 1 | Parcial | 12 | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 12 | El motor de gráficos no escala el trazo con el zoom |
| Maximum size | `maxMarginFactor` | 1 | Parcial | 12 | Ancho máximo de etiqueta en píxeles, no en % del gráfico |
| Outer padding | `outerPadding` | 1 | Falta | 12 | El motor de gráficos no tiene relleno exterior de categorías |
| Reverse stack order | `reverseStackOrder` | 1 | Falta | 4 | Se ordena con el orden de series |
| Round range | `roundRange` | 1 | Falta | 12 | El motor de gráficos redondea el eje salvo con límites fijos |
| Minimum | `start` | 1 | Parcial | 12 | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Underline | `titleUnderline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |

### Eje Y / valores

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Align zeros | `alignZeros` | 1 | Falta | 2 | Los ejes alinean sus marcas, no su cero |
| Style | `axisStyle` | 1 | Falta | 12 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 12 | El motor de gráficos no escala el trazo con el zoom |
| Round range | `roundRange` | 1 | Falta | 12 | El motor de gráficos redondea el eje salvo con límites fijos |
| Scale to fit | `scaleToFit` | 1 | Parcial | 12 | Truncar eje (truncateYAxis) |
| Style | `secAxisStyle` | 1 | Falta | 2 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Round range | `secRoundRange` | 1 | Falta | 2 | El motor de gráficos redondea el eje salvo con límites fijos |
| Underline | `secTitleUnderline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |
| Underline | `secUnderline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |
| Shared y-axis | `sharedAxis` | 1 | Falta | 12 | Cada consulta elige eje en sus datos |
| Underline | `titleUnderline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |

### Eje Y secundario

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `secAxisStyle` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Bold | `secBold` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Maximum | `secEnd` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Font family | `secFontFamily` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Text size | `secFontSize` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Italic | `secItalic` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Color | `secLabelColor` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Display units | `secLabelDisplayUnits` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Value decimal places | `secLabelPrecision` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Logarithmic scale | `secLogAxisScale` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Round range | `secRoundRange` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Title | `secShowAxisTitle` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Minimum | `secStart` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Bold | `secTitleBold` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Title color | `secTitleColor` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Font family | `secTitleFontFamily` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Title text size | `secTitleFontSize` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Italic | `secTitleItalic` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Axis title | `secTitleText` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |
| Underline | `secTitleUnderline` | 1 | Falta | 4 | El motor de gráficos no dibuja texto subrayado |
| Underline | `secUnderline` | 1 | Falta | 4 | El motor de gráficos no dibuja texto subrayado |
| Show | `show` | 1 | Falta | 4 | Este gráfico no tiene segundo eje; está en el combinado |

### Etiquetas de datos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Content | `detailContentType` | 1 | Parcial | 12 | Serie, categoría o porcentaje; no otro campo |
| Format code | `detailCustomFormatString` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| detailFormatString | `detailFormatString` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Display units | `detailLabelDisplayUnits` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Value decimal places | `detailLabelPrecision` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Show blank as | `detailShowBlankAs` | 1 | Falta | 12 | Una marca sin valor no tiene etiqueta |
| Underline | `detailUnderline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |
| Label density | `labelDensity` | 1 | Parcial | 12 | Ocultar etiquetas superpuestas, sin porcentaje de densidad |
| Scale by width | `leaderLineAutoScale` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Color | `leaderLineColor` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Dash array | `leaderLineDashArray` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Dash cap | `leaderLineDashCap` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Line style | `leaderLinePattern` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Transparency | `leaderLineTransparency` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Width | `leaderLineWidth` | 1 | Falta | 2 | El motor de gráficos no las dibuja en barras ni líneas |
| Show | `leaderLines` | 1 | Falta | 4 | El motor de gráficos no las dibuja en barras ni líneas |
| Maximum offset | `maximumOffset` | 1 | Parcial | 4 | Una sola distancia a la marca |
| Minimum offset | `minimumOffset` | 1 | Parcial | 4 | Una sola distancia a la marca |
| Show blank as | `showBlankAs` | 1 | Falta | 12 | Una marca sin valor no tiene etiqueta |
| Format code | `titleCustomFormatString` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| titleFormatString | `titleFormatString` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Display units | `titleLabelDisplayUnits` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Value decimal places | `titleLabelPrecision` | 1 | Falta | 12 | El título y el detalle son texto, no otra medida |
| Show blank as | `titleShowBlankAs` | 1 | Falta | 12 | Una marca sin valor no tiene etiqueta |
| Underline | `titleUnderline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |

### Etiquetas de serie

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `leaderLineAutoScale` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Color | `leaderLineColor` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Dash array | `leaderLineDashArray` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Dash cap | `leaderLineDashCap` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Line style | `leaderLinePattern` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Transparency | `leaderLineTransparency` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Width | `leaderLineWidth` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Show | `leaderLines` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Maximum offset | `maximumOffset` | 2 | Falta | 6 | El motor de gráficos solo las pone al final de la línea |
| Position | `seriesPosition` | 2 | Parcial | 6 | Solo al final de la línea |
| Customize series | `showAll` | 2 | Falta | 6 | Se activan para todo el gráfico |
| showByDefault | `showByDefault` | 2 | Falta | 6 | Se activan para todo el gráfico |
| Underline | `underline` | 2 | Falta | 6 | El motor de gráficos no dibuja texto subrayado |

### Etiquetas de total

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Underline | `underline` | 1 | Falta | 7 | El motor de gráficos no dibuja texto subrayado |

### Fondo del área de trazado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Image fit | `fit` | 2 | Parcial | 12 | En mosaico o una vez, sin ajustar al área |
| image | `image` | 2 | Parcial | 12 | Por dirección de la imagen, sin subirla |
| Data | `imageData` | 2 | Parcial | 12 | Por dirección de la imagen, sin subirla |
| Image source | `sourceType` | 2 | Parcial | 12 | Por dirección de la imagen, sin subirla |
| Transparency | `transparency` | 2 | Falta | 12 | El motor de gráficos no atenúa una imagen de fondo |
| Image URL | `url` | 2 | Parcial | 12 | Por dirección de la imagen, sin subirla |

### Leyenda

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `legendMarkerRendering` | 1 | Parcial | 6 | Forma del marcador (legend_icon) |
| Show | `showGradientLegend` | 1 | Falta | 6 | Sin leyenda para la escala de color |
| Underline | `underline` | 1 | Falta | 12 | El motor de gráficos no dibuja texto subrayado |

### Líneas

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Segment type | `segmentAlignment` | 1 | Falta | 4 | El motor de gráficos no colorea por tramo de línea |
| Gradient | `segmentGradient` | 1 | Falta | 4 | El motor de gráficos no colorea por tramo de línea |
| Scale by width | `strokeAutoScale` | 1 | Falta | 6 | El motor de gráficos no escala el trazo con el zoom |

## Fase 4: Tabla y matriz

### Columna específica

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Background color | `backColor` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Data bars | `dataBars` | 1 | Parcial | 2 | Barras en todas las columnas (show_cell_bars) |
| Font color | `fontColor` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Display units | `labelDisplayUnits` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Value decimal places | `labelPrecision` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Apply to header | `styleHeader` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Apply to subtotals | `styleSubtotals` | 1 | Falta | 1 |  |
| Apply to total | `styleTotal` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |
| Apply to values | `styleValues` | 1 | Parcial | 2 | Por columna, revisar cobertura (column_config) |

### Cuadrícula

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Horizontal grid | `gridHorizontal` | 1 | Falta | 2 |  |
| Horizontal grid color | `gridHorizontalColor` | 1 | Parcial | 2 | Un color para toda la rejilla (table_grid_color) |
| Horizontal grid thickness | `gridHorizontalWeight` | 1 | Falta | 2 |  |
| Vertical grid | `gridVertical` | 1 | Falta | 2 |  |
| Vertical grid color | `gridVerticalColor` | 1 | Parcial | 2 | Un color para toda la rejilla (table_grid_color) |
| Vertical grid thickness | `gridVerticalWeight` | 1 | Falta | 2 |  |
| Height | `imageHeight` | 1 | Falta | 2 |  |
| Width | `imageWidth` | 1 | Falta | 2 |  |
| Outline color | `outlineColor` | 1 | Parcial | 2 | Un color para toda la rejilla (table_grid_color) |
| Outline | `outlineStyle` | 1 | Falta | 2 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 2 |  |
| Row padding | `rowPadding` | 1 | Falta | 2 |  |
| Text size | `textSize` | 1 | Falta | 2 |  |

### Encabezados de columna

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 2 |  |
| Auto expand | `autoExpand` | 1 | Falta | 1 |  |
| Auto-size column width | `autoSizeColumnWidth` | 1 | Falta | 2 |  |
| Background color | `backColor` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Auto-size behavior | `columnAdjustment` | 1 | Falta | 2 |  |
| Custom widths | `customColumnWidth` | 1 | Falta | 2 |  |
| More granular | `customColumnWidthGranularView` | 1 | Falta | 1 |  |
| Default width | `defaultColumnWidth` | 1 | Falta | 2 |  |
| Icon color | `expandCollapseButtonsColor` | 1 | Falta | 1 |  |
| Icon size | `expandCollapseButtonsSize` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Outline color | `outlineColor` | 1 | Falta | 2 |  |
| Outline | `outlineStyle` | 1 | Falta | 2 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 2 |  |
| +/- icons | `showExpandCollapseButtons` | 1 | Falta | 1 |  |
| Title alignment | `titleAlignment` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 2 |  |
| URL icon | `urlIcon` | 1 | Falta | 1 |  |
| Word wrap | `wordWrap` | 1 | Falta | 2 |  |

### Encabezados de fila

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 1 |  |
| Auto expand | `autoExpand` | 1 | Falta | 1 |  |
| Background color | `backColor` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Icon color | `expandCollapseButtonsColor` | 1 | Falta | 1 |  |
| Icon size | `expandCollapseButtonsSize` | 1 | Falta | 1 |  |
| expandCompositeHierarchy | `expandCompositeHierarchy` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| legacyStyleDisabled | `legacyStyleDisabled` | 1 | Falta | 1 |  |
| Outline color | `outlineColor` | 1 | Falta | 1 |  |
| Outline | `outlineStyle` | 1 | Falta | 1 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 1 |  |
| Repeat row headers | `repeatRowHeaders` | 1 | Falta | 1 |  |
| +/- icons | `showExpandCollapseButtons` | 1 | Falta | 1 |  |
| Stepped layout | `stepped` | 1 | Falta | 1 |  |
| Indentation | `steppedLayoutIndentation` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |
| unfrozen | `unfrozen` | 1 | Falta | 1 |  |
| URL icon | `urlIcon` | 1 | Falta | 1 |  |
| Word wrap | `wordWrap` | 1 | Falta | 1 |  |

### Filas en blanco

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `blankRowColor` | 2 | Falta | 1 |  |
| Transparency | `blankRowTransparency` | 2 | Falta | 1 |  |
| Color | `borderColor` | 2 | Falta | 1 |  |
| Position | `borderPosition` | 2 | Falta | 1 |  |
| Transparency | `borderTransparency` | 2 | Falta | 1 |  |
| Width | `borderWidth` | 2 | Falta | 1 |  |
| Show | `showBlankRows` | 2 | Falta | 1 |  |
| Show | `showBorder` | 2 | Falta | 1 |  |

### Minigráficos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Chart type | `chartType` | 2 | Falta | 2 |  |
| Data color | `dataColor` | 2 | Falta | 2 |  |
| Color | `markerColor` | 2 | Falta | 2 |  |
| Type | `markerShape` | 2 | Falta | 2 |  |
| Size | `markerSize` | 2 | Falta | 2 |  |
| Show these markers | `markers` | 2 | Falta | 2 |  |
| Width | `strokeWidth` | 2 | Falta | 2 |  |

### Subtotales

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Apply to labels | `applyToHeaders` | 1 | Falta | 1 |  |
| Background color | `backColor` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Column subtotals label | `columnSubtotalsLabel` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| levelSubtotalEnabled | `levelSubtotalEnabled` | 1 | Falta | 1 |  |
| levelSubtotalLabel | `levelSubtotalLabel` | 1 | Falta | 1 |  |
| Per column level | `perColumnLevel` | 1 | Falta | 1 |  |
| Per row level | `perRowLevel` | 1 | Falta | 1 |  |
| Row subtotals label | `rowSubtotalsLabel` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Total general de columnas

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Apply to labels | `applyToHeaders` | 1 | Parcial | 1 | Solo mostrar (colTotals/rowTotals) |
| Background color | `backColor` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Total general de filas

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Apply to labels | `applyToHeaders` | 1 | Parcial | 1 | Solo mostrar (colTotals/rowTotals) |
| Background color | `backColor` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Totales

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Apply to labels | `applyToHeaders` | 1 | Falta | 1 |  |
| Background color | `backColor` | 1 | Falta | 2 |  |
| Bold | `bold` | 1 | Falta | 2 |  |
| Font color | `fontColor` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Total label | `label` | 1 | Falta | 1 |  |
| Outline color | `outlineColor` | 1 | Falta | 1 |  |
| Outline | `outlineStyle` | 1 | Falta | 1 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 2 |  |

### Valores

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `backColor` | 1 | Falta | 2 |  |
| Background color | `backColorPrimary` | 1 | Falta | 2 |  |
| Alternate background color | `backColorSecondary` | 1 | Falta | 1 |  |
| Banded row color | `bandedRowHeaders` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Font color | `fontColor` | 1 | Falta | 1 |  |
| Font color | `fontColorPrimary` | 1 | Falta | 2 |  |
| Alternate font color | `fontColorSecondary` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Icons | `icon` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Outline color | `outlineColor` | 1 | Falta | 2 |  |
| Outline | `outlineStyle` | 1 | Falta | 2 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 2 |  |
| URL icon | `urlIcon` | 1 | Falta | 2 |  |
| Show on rows | `valuesOnRow` | 1 | Falta | 1 |  |
| Web URL | `webURL` | 1 | Falta | 2 |  |
| Word wrap | `wordWrap` | 1 | Falta | 2 |  |

### accessibility

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Column with alt text | `altTextColumns` | 3 | Falta | 2 |  |
| Refer to row by | `rowWithReferenceText` | 3 | Falta | 1 |  |

### columnWidth

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| value | `value` | 2 | Falta | 2 |  |

## Fase 5: Tarjeta, KPI, circular y anillo

### Colores / barras

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `borderColor` | 1 | Falta | 2 |  |
| Match fill color | `borderColorMatchFill` | 1 | Falta | 2 |  |
| Hide inner borders | `borderOutlineOnly` | 1 | Falta | 2 |  |
| Border | `borderShow` | 1 | Falta | 2 |  |
| Width | `borderSize` | 1 | Falta | 2 |  |
| Transparency | `borderTransparency` | 1 | Falta | 2 |  |
| Default color | `defaultColor` | 1 | Parcial | 2 | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Color | `fill` | 1 | Parcial | 2 | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Transparency | `fillTransparency` | 1 | Falta | 2 |  |

### Estado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bad Color | `badColor` | 1 | Falta | 1 |  |
| Direction | `direction` | 1 | Falta | 1 |  |
| Good Color | `goodColor` | 1 | Falta | 1 |  |
| Neutral Color | `neutralColor` | 1 | Falta | 1 |  |

### Etiqueta de categoría

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Source spacing | `preserveWhitespace` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Etiquetas de datos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Parcial | 3 | Con código d3 (number_format) |
| Value decimal places | `labelPrecision` | 1 | Parcial | 3 | Con código d3 (number_format) |
| Overflow text | `overflow` | 1 | Falta | 2 |  |
| % decimal places | `percentageLabelPrecision` | 1 | Parcial | 2 | Con código d3 (number_format) |
| Label position | `position` | 1 | Parcial | 2 | Solo dentro o fuera (labels_outside) |
| Source spacing | `preserveWhitespace` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 3 | El motor de gráficos no dibuja texto subrayado |

### Fecha

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Font color | `lastDateFontColor` | 1 | Falta | 1 |  |
| Font family | `lastDateFontFamily` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Indicador

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 1 |  |
| Icon size | `iconSize` | 1 | Falta | 1 |  |
| Display units | `indicatorDisplayUnits` | 1 | Parcial | 1 | Con código d3 (y_axis_format) |
| Value decimal places | `indicatorPrecision` | 1 | Parcial | 1 | Con código d3 (y_axis_format) |
| Show icon | `showIcon` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |
| Vertical alignment | `verticalAlignment` | 1 | Falta | 1 |  |

### Leyenda

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Title | `showTitle` | 1 | Falta | 2 |  |
| Legend Name | `titleText` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |

### Objetivo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Distance direction | `direction` | 1 | Falta | 1 |  |
| Font color | `distanceFontColor` | 1 | Falta | 1 |  |
| Font family | `distanceFontFamily` | 1 | Falta | 1 |  |
| Label | `distanceLabel` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Font color | `goalFontColor` | 1 | Falta | 1 |  |
| Font family | `goalFontFamily` | 1 | Falta | 1 |  |
| Label | `goalText` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 |  |
| Distance | `showDistance` | 1 | Parcial | 1 | Comparación contra periodo, no contra objetivo (compare_lag) |
| Goal | `showGoal` | 1 | Parcial | 1 | Comparación contra periodo, no contra objetivo (compare_lag) |
| Bold | `titleBold` | 1 | Falta | 1 |  |
| Text size | `titleFontSize` | 1 | Falta | 1 |  |
| Italic | `titleItalic` | 1 | Falta | 1 |  |
| Underline | `titleUnderline` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### Porciones

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Start angle | `startAngle` | 1 | Falta | 2 |  |

### Tendencia

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Transparency | `transparency` | 1 | Falta | 1 |  |

### centerBackground

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Fill | `fillColor` | 1 | Falta | 1 |  |
| Image fit | `fit` | 1 | Falta | 1 |  |
| image | `image` | 1 | Falta | 1 |  |
| Data | `imageData` | 1 | Falta | 1 |  |
| Transparency | `imageTransparency` | 1 | Falta | 1 |  |
| Image source | `imageType` | 1 | Falta | 1 |  |
| Image URL | `imageUrl` | 1 | Falta | 1 |  |
| Padding | `padding` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Transparency | `transparency` | 1 | Falta | 1 |  |

### image

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alt text | `altText` | 3 | Falta | 1 |  |
| Gap | `gap` | 3 | Falta | 1 |  |
| image | `image` | 3 | Falta | 1 |  |
| Data | `imageData` | 3 | Falta | 1 |  |
| Image source | `imageType` | 3 | Falta | 1 |  |
| Image URL | `imageUrl` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Size | `size` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### label

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Gap | `gap` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Position | `position` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Text | `text` | 1 | Falta | 1 |  |
| Text wrap | `textWrap` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### value

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Color | `fontColor` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Show blank as | `showBlankAs` | 1 | Falta | 1 |  |
| Text wrap | `textWrap` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |
| Value | `value` | 1 | Falta | 1 |  |

### wordWrap

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Falta | 1 |  |

## Fase 6: Cascada, embudo, treemap, medidor y dispersión

### Colores / barras

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Default color | `defaultColor` | 1 | Parcial | 2 | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Default color | `fill` | 1 | Parcial | 4 | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Color saturation | `fillRule` | 1 | Falta | 3 |  |
| Show all | `showAllDataPoints` | 1 | Falta | 2 |  |
| Target color | `target` | 1 | Falta | 1 |  |

### Disposición

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Space between all nodes | `innerPadding` | 1 | Falta | 1 |  |
| Space between groups | `outerPadding` | 1 | Falta | 1 |  |
| Tiling Method | `tilingMethod` | 1 | Falta | 1 |  |

### Eje X / categorías

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `axisStyle` | 1 | Falta | 2 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Type | `axisType` | 1 | Parcial | 1 | Sale del tipo de la columna; se fuerza con «Forzar categórico» |
| Bold | `bold` | 1 | Falta | 2 |  |
| Color | `color` | 1 | Falta | 1 |  |
| Maximum | `end` | 1 | Parcial | 1 | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 1 | El motor de gráficos no escala el trazo con el zoom |
| Initial scroll position | `initialScrollPosition` | 1 | Falta | 1 |  |
| Space between categories | `innerPadding` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Color | `labelColor` | 1 | Falta | 1 |  |
| Maximum size | `maxMarginFactor` | 1 | Falta | 2 |  |
| Outer padding | `outerPadding` | 1 | Falta | 2 | El motor de gráficos no tiene relleno exterior de categorías |
| Minimum category width | `preferredCategoryWidth` | 1 | Falta | 1 |  |
| Round range | `roundRange` | 1 | Falta | 1 | El motor de gráficos redondea el eje salvo con límites fijos |
| Show | `show` | 1 | Falta | 2 |  |
| Minimum | `start` | 1 | Parcial | 1 | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Bold | `titleBold` | 1 | Falta | 1 |  |
| Title color | `titleColor` | 1 | Falta | 1 |  |
| Font family | `titleFontFamily` | 1 | Falta | 1 |  |
| Title text size | `titleFontSize` | 1 | Falta | 1 |  |
| Italic | `titleItalic` | 1 | Falta | 1 |  |
| Underline | `titleUnderline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |
| Show blank values | `treatNullsAsZero` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 3 | El motor de gráficos no dibuja texto subrayado |

### Eje Y / valores

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `axisStyle` | 1 | Falta | 2 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Bold | `bold` | 1 | Falta | 1 |  |
| Maximum | `end` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 2 | El motor de gráficos no escala el trazo con el zoom |
| Color | `gridlineColor` | 1 | Falta | 1 |  |
| Dash array | `gridlineDashArray` | 1 | Falta | 1 |  |
| Dash cap | `gridlineDashCap` | 1 | Falta | 1 |  |
| Show | `gridlineShow` | 1 | Falta | 1 |  |
| Line style | `gridlineStyle` | 1 | Falta | 1 |  |
| Width | `gridlineThickness` | 1 | Falta | 1 |  |
| Transparency | `gridlineTransparency` | 1 | Falta | 1 |  |
| Invert range | `invertAxis` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Color | `labelColor` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Parcial | 1 | Con código d3, no con unidades y decimales (y_axis_format) |
| Value decimal places | `labelPrecision` | 1 | Parcial | 1 | Con código d3, no con unidades y decimales (y_axis_format) |
| Round range | `roundRange` | 1 | Falta | 2 | El motor de gráficos redondea el eje salvo con límites fijos |
| Show | `show` | 1 | Falta | 1 |  |
| Minimum | `start` | 1 | Falta | 1 |  |
| Switch axis position | `switchAxisPosition` | 1 | Falta | 1 |  |
| Bold | `titleBold` | 1 | Falta | 1 |  |
| Title color | `titleColor` | 1 | Falta | 1 |  |
| Font family | `titleFontFamily` | 1 | Falta | 1 |  |
| Title text size | `titleFontSize` | 1 | Falta | 1 |  |
| Italic | `titleItalic` | 1 | Falta | 1 |  |
| Underline | `titleUnderline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |
| Show total | `totalsEnabled` | 1 | Falta | 1 |  |
| Show blank values | `treatNullsAsZero` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 2 | El motor de gráficos no dibuja texto subrayado |

### Etiqueta de categoría

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 1 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 2 |  |
| Color | `color` | 1 | Falta | 2 |  |
| Show background | `enableBackground` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Show | `show` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 2 |  |

### Etiquetas de datos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 1 | Falta | 2 |  |
| Transparency | `backgroundTransparency` | 1 | Falta | 2 |  |
| Bold | `bold` | 1 | Falta | 4 |  |
| Color | `color` | 1 | Falta | 4 |  |
| Show background | `enableBackground` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 4 |  |
| Text size | `fontSize` | 1 | Falta | 4 |  |
| Label style | `funnelLabelStyle` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 4 |  |
| Display units | `labelDisplayUnits` | 1 | Falta | 4 |  |
| Orientation | `labelOrientation` | 1 | Falta | 1 |  |
| Position | `labelPosition` | 1 | Falta | 2 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 4 |  |
| % decimal places | `percentageLabelPrecision` | 1 | Parcial | 1 | Con código d3 (number_format) |
| Show | `show` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 4 | El motor de gráficos no dibuja texto subrayado |

### Fondo del área de trazado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `color` | 2 | Falta | 1 |  |
| Transparency | `colorTransparency` | 2 | Falta | 1 |  |
| Image fit | `fit` | 2 | Falta | 2 |  |
| image | `image` | 2 | Falta | 2 |  |
| Data | `imageData` | 2 | Falta | 2 |  |
| Image source | `sourceType` | 2 | Falta | 2 |  |
| Transparency | `transparency` | 2 | Falta | 2 | El motor de gráficos no atenúa una imagen de fondo |
| Image URL | `url` | 2 | Falta | 2 |  |

### Leyenda

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Color | `labelColor` | 1 | Falta | 2 |  |
| Position | `position` | 1 | Falta | 2 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Show | `showGradientLegend` | 1 | Falta | 1 | Sin leyenda para la escala de color |
| Title | `showTitle` | 1 | Falta | 2 |  |
| Legend Name | `titleText` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 3 | El motor de gráficos no dibuja texto subrayado |

### Valor principal

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Color | `color` | 1 | Falta | 1 |  |
| Field | `dynamicLabelValue` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Parcial | 1 | Con código d3 (number_format) |
| Value decimal places | `labelPrecision` | 1 | Parcial | 1 | Con código d3 (number_format) |
| Show | `show` | 1 | Parcial | 1 | Valor siempre visible (font_size/show_progress) |
| Custom label | `showDynamicLabels` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### axis

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Target | `target` | 1 | Falta | 1 |  |

### breakdown

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Max breakdowns | `maxBreakdowns` | 2 | Falta | 1 |  |

### bubbles

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Size multiplier | `bubbleSize` | 1 | Falta | 1 |  |
| Range scaling | `markerRangeType` | 1 | Falta | 1 |  |
| Type | `markerShape` | 1 | Falta | 1 |  |
| Auto-fit markers | `preventOverflow` | 1 | Falta | 1 |  |
| Customize series | `showSeries` | 1 | Falta | 1 |  |

### colorBorder

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 2 | Falta | 1 |  |

### colorByCategory

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 2 | Falta | 1 |  |

### fillPoint

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `style` | 2 | Falta | 1 |  |

### percentBarLabel

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 2 | Falta | 1 |  |
| Color | `color` | 2 | Falta | 1 |  |
| Font family | `fontFamily` | 2 | Falta | 1 |  |
| Text size | `fontSize` | 2 | Falta | 1 |  |
| Italic | `italic` | 2 | Falta | 1 |  |
| Show | `show` | 2 | Parcial | 1 | Porcentaje (percent_calculation_type) |
| Underline | `underline` | 2 | Falta | 1 |  |

### plotAreaShading

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Name | `displayName` | 2 | Falta | 1 |  |
| Lower shading | `lowerShadingColor` | 2 | Falta | 1 |  |
| Show | `show` | 2 | Falta | 1 |  |
| Transparency | `transparency` | 2 | Falta | 1 |  |
| Upper shading | `upperShadingColor` | 2 | Falta | 1 |  |

### ratioLine

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 1 |  |
| Dash array | `dashArray` | 2 | Falta | 1 |  |
| Dash cap | `dashCap` | 2 | Falta | 1 |  |
| Name | `displayName` | 2 | Falta | 1 |  |
| Color | `lineColor` | 2 | Falta | 1 |  |
| Show | `show` | 2 | Falta | 1 |  |
| Line style | `style` | 2 | Falta | 1 |  |
| Transparency | `transparency` | 2 | Falta | 1 |  |
| Width | `width` | 2 | Falta | 1 |  |

### sentimentColors

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Other | `otherFill` | 1 | Falta | 1 |  |

### target

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 |  |
| Color | `color` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Text size | `fontSize` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

## Fase 7: Segmentadores

### Acción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bookmark | `bookmark` | 2 | Falta | 4 |  |
| Disabled tooltip | `disabledTooltip` | 2 | Falta | 4 |  |
| Destination | `drillthroughSection` | 2 | Falta | 4 |  |
| Enabled tooltip | `enabledTooltip` | 2 | Falta | 4 |  |
| Destination | `navigationSection` | 2 | Falta | 4 |  |
| Show | `show` | 2 | Falta | 4 |  |
| Show tooltips | `showDefaultTooltip` | 2 | Falta | 4 |  |
| No tooltips | `suppressDefaultTooltip` | 2 | Falta | 4 |  |
| Tooltip | `tooltip` | 2 | Falta | 4 |  |
| Type | `type` | 2 | Falta | 4 |  |
| Web URL | `webUrl` | 2 | Falta | 4 |  |

### Bloquear proporción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Falta | 4 |  |

### Disposición

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 2 |  |
| Fit to space | `autoGrid` | 1 | Falta | 2 |  |
| Color | `backgroundFillColor` | 1 | Falta | 2 |  |
| backgroundImage | `backgroundImage` | 1 | Falta | 2 |  |
| Blur | `backgroundImageBlur` | 1 | Falta | 2 |  |
| Contrast | `backgroundImageContrast` | 1 | Falta | 2 |  |
| Data | `backgroundImageData` | 1 | Falta | 2 |  |
| Image effects | `backgroundImageEffects` | 1 | Falta | 2 |  |
| Exposure | `backgroundImageExposure` | 1 | Falta | 2 |  |
| Image fit | `backgroundImageFit` | 1 | Falta | 2 |  |
| Image height | `backgroundImageHeight` | 1 | Falta | 2 |  |
| Saturation | `backgroundImageSaturation` | 1 | Falta | 2 |  |
| Add image | `backgroundImageShow` | 1 | Falta | 2 |  |
| Image transparency | `backgroundImageTransparency` | 1 | Falta | 2 |  |
| Image source | `backgroundImageType` | 1 | Falta | 2 |  |
| Image URL | `backgroundImageUrl` | 1 | Falta | 2 |  |
| Show | `backgroundShow` | 1 | Falta | 2 |  |
| Transparency | `backgroundTransparency` | 1 | Falta | 2 |  |
| Color | `borderColor` | 1 | Falta | 2 |  |
| Line style | `borderStyle` | 1 | Falta | 2 |  |
| Transparency | `borderTransparency` | 1 | Falta | 2 |  |
| Width | `borderWidth` | 1 | Falta | 2 |  |
| Bottom padding | `bottomOuterMargin` | 1 | Falta | 2 |  |
| Callout size | `calloutSize` | 1 | Falta | 2 |  |
| Space between cards | `cellPadding` | 1 | Falta | 2 |  |
| Columns | `columnCount` | 1 | Falta | 2 |  |
| Space between columns | `columnPadding` | 1 | Falta | 2 |  |
| Indent button container | `containerIndentation` | 1 | Falta | 1 |  |
| Customize lines | `customizeLines` | 1 | Falta | 2 |  |
| Customize spacing | `customizePadding` | 1 | Falta | 2 |  |
| Fixed number of buttons | `fixedButtonsCount` | 1 | Falta | 1 |  |
| Height | `fixedHeight` | 1 | Falta | 2 |  |
| Width | `fixedWidth` | 1 | Falta | 2 |  |
| Color | `gridlineColor` | 1 | Falta | 2 |  |
| Line style | `gridlineStyle` | 1 | Falta | 2 |  |
| Transparency | `gridlineTransparency` | 1 | Falta | 2 |  |
| Width | `gridlineWidth` | 1 | Falta | 2 |  |
| Indentation | `indentation` | 1 | Falta | 1 |  |
| Left padding | `leftOuterMargin` | 1 | Falta | 2 |  |
| Color | `lineColor` | 1 | Falta | 2 |  |
| Line style | `lineStyle` | 1 | Falta | 2 |  |
| Transparency | `lineTransparency` | 1 | Falta | 2 |  |
| Width | `lineWidth` | 1 | Falta | 2 |  |
| Max cards shown | `maxTiles` | 1 | Falta | 2 |  |
| Arrangement | `orientation` | 1 | Falta | 2 |  |
| Rounded corners | `rectangleRoundedCurve` | 1 | Falta | 2 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 1 | Falta | 2 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 1 | Falta | 2 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 1 | Falta | 2 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 1 | Falta | 2 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 1 | Falta | 2 |  |
| Reverse indentation | `reverseIndentation` | 1 | Falta | 1 |  |
| Right padding | `rightOuterMargin` | 1 | Falta | 2 |  |
| Rows | `rowCount` | 1 | Falta | 2 |  |
| Space between rows | `rowPadding` | 1 | Falta | 2 |  |
| Fixed size | `showFixedSize` | 1 | Falta | 2 |  |
| Style | `style` | 1 | Falta | 2 |  |
| Top padding | `topOuterMargin` | 1 | Falta | 2 |  |

### Divisor

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Ignore padding | `ignorePadding` | 1 | Falta | 4 |  |
| Line style | `style` | 1 | Falta | 4 |  |
| Width | `width` | 1 | Falta | 4 |  |

### Espaciado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Customize spacing | `customizeSpacing` | 2 | Falta | 4 |  |
| Space above divider | `spaceAboveDivider` | 2 | Falta | 4 |  |
| Space above plot area | `spaceAbovePlotArea` | 2 | Falta | 4 |  |
| Space above subtitle | `spaceAboveSubtitle` | 2 | Falta | 4 |  |
| Space below subtitle | `spaceBelowSubTitle` | 2 | Falta | 4 |  |
| Space below title | `spaceBelowTitle` | 2 | Falta | 4 |  |
| Space below title area | `spaceBelowTitleArea` | 2 | Falta | 4 |  |
| Space between label and value | `verticalSpacing` | 2 | Falta | 4 |  |

### Fondo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Hug content | `wrapContent` | 1 | Falta | 2 |  |

### Iconos de cabecera

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 1 | Falta | 4 |  |
| Border | `border` | 1 | Falta | 4 |  |
| Icon color | `foreground` | 1 | Falta | 4 |  |
| Show | `show` | 1 | Parcial | 4 | Formato > Iconos de cabecera |
| Copy icon | `showCopyVisualImageButton` | 3 | Falta | 4 |  |
| Filter icon | `showFilterRestatementButton` | 1 | Parcial | 4 | Formato > Iconos de cabecera |
| Focus mode icon | `showFocusModeButton` | 3 | Falta | 4 |  |
| More options icon | `showOptionsMenu` | 1 | Parcial | 4 | Formato > Iconos de cabecera |
| See data layout icon | `showSeeDataLayoutToggleButton` | 3 | Falta | 4 |  |
| Visual header tooltip icon | `showTooltipButton` | 3 | Falta | 4 |  |
| Visual error icon | `showVisualErrorButton` | 3 | Falta | 4 |  |
| Visual information icon | `showVisualInformationButton` | 3 | Falta | 4 |  |
| Visual warning icon | `showVisualWarningButton` | 3 | Falta | 4 |  |
| Transparency | `transparency` | 1 | Falta | 4 |  |

### Propiedades

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| High density sampling | `allowBinnedLineSample` | 3 | Falta | 4 |  |
| High density sampling | `allowOverlappingPointsSample` | 3 | Falta | 4 |  |
| count | `count` | 1 | Falta | 1 |  |
| formatString | `formatString` | 1 | Falta | 4 |  |
| Maintain layer order | `keepLayerOrder` | 3 | Falta | 4 |  |
| Orientation | `orientation` | 1 | Falta | 1 |  |
| Outline color | `outlineColor` | 1 | Falta | 1 |  |
| Outline weight | `outlineWeight` | 1 | Falta | 1 |  |
| selfFilterEnabled | `selfFilterEnabled` | 1 | Falta | 3 |  |

### Relleno

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bottom padding | `bottom` | 1 | Parcial | 4 | Solo un valor para los cuatro lados |
| Bottom margin | `bottomMargin` | 1 | Falta | 2 |  |
| Left padding | `left` | 1 | Parcial | 4 | Solo un valor para los cuatro lados |
| Left margin | `leftMargin` | 1 | Falta | 2 |  |
| Size | `paddingSelection` | 1 | Falta | 2 |  |
| Right padding | `right` | 1 | Parcial | 4 | Solo un valor para los cuatro lados |
| Right margin | `rightMargin` | 1 | Falta | 2 |  |
| Top padding | `top` | 1 | Parcial | 4 | Solo un valor para los cuatro lados |
| Top margin | `topMargin` | 1 | Falta | 2 |  |

### Sombra

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 1 | Falta | 4 |  |
| Color | `color` | 1 | Falta | 4 |  |
| Shadow position | `position` | 1 | Falta | 4 |  |
| Preset | `preset` | 1 | Parcial | 4 | Solo niveles de sombra |
| Blur | `shadowBlur` | 1 | Falta | 4 |  |
| Distance | `shadowDistance` | 1 | Falta | 4 |  |
| Size | `shadowSpread` | 1 | Falta | 4 |  |
| Show | `show` | 1 | Parcial | 4 | Solo niveles de sombra |
| Transparency | `transparency` | 1 | Falta | 4 |  |

### Subtítulo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 4 |  |
| Bold | `bold` | 1 | Falta | 4 |  |
| Font color | `fontColor` | 1 | Parcial | 4 | Formato > Título; sin interruptor propio |
| Font family | `fontFamily` | 1 | Falta | 4 |  |
| Text size | `fontSize` | 1 | Parcial | 4 | Formato > Título; sin interruptor propio |
| Title heading | `heading` | 1 | Falta | 4 |  |
| Italic | `italic` | 1 | Falta | 4 |  |
| Show | `show` | 1 | Parcial | 4 | Formato > Título; sin interruptor propio |
| Title text | `text` | 1 | Parcial | 4 | Formato > Título; sin interruptor propio |
| Word wrap | `titleWrap` | 1 | Falta | 4 |  |
| Underline | `underline` | 1 | Falta | 4 |  |

### Tooltip de iconos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 2 | Falta | 4 |  |
| Bold | `bold` | 2 | Falta | 4 |  |
| Font family | `fontFamily` | 2 | Falta | 4 |  |
| Text size | `fontSize` | 2 | Falta | 4 |  |
| Italic | `italic` | 2 | Falta | 4 |  |
| Page | `section` | 2 | Falta | 4 |  |
| Tooltip text | `text` | 2 | Falta | 4 |  |
| Background color | `themedBackground` | 2 | Falta | 4 |  |
| Color | `themedTitleFontColor` | 2 | Falta | 4 |  |
| Color | `titleFontColor` | 2 | Falta | 4 |  |
| Transparency | `transparency` | 2 | Falta | 4 |  |
| Type | `type` | 2 | Falta | 4 |  |
| Underline | `underline` | 2 | Falta | 4 |  |

### Tooltips

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Drill text and icon color | `actionFontColor` | 2 | Falta | 4 |  |
| Background color | `background` | 2 | Falta | 4 |  |
| Bold | `bold` | 2 | Falta | 4 |  |
| Font family | `fontFamily` | 2 | Falta | 4 |  |
| Text size | `fontSize` | 2 | Falta | 4 |  |
| Italic | `italic` | 2 | Falta | 4 |  |
| Page | `section` | 2 | Falta | 4 |  |
| Sentence template | `sentenceTemplate` | 2 | Falta | 4 |  |
| Show | `show` | 2 | Falta | 4 |  |
| Actions | `showActionsInTooltips` | 2 | Falta | 4 |  |
| Chart-specific tooltips | `showChartSpecificTooltips` | 2 | Falta | 4 |  |
| Sentence format only | `showSentenceFormat` | 2 | Falta | 4 |  |
| Tooltip fields only | `showTooltipFieldsOnly` | 2 | Falta | 4 |  |
| Bold values | `showValuesInBold` | 2 | Falta | 4 |  |
| Background color | `themedBackground` | 2 | Falta | 4 |  |
| Label text color | `themedTitleFontColor` | 2 | Falta | 4 |  |
| Value text color | `themedValueFontColor` | 2 | Falta | 4 |  |
| Label text color | `titleFontColor` | 2 | Falta | 4 |  |
| Transparency | `transparency` | 2 | Falta | 4 |  |
| Type | `type` | 2 | Falta | 4 |  |
| Underline | `underline` | 2 | Falta | 4 |  |
| Value text color | `valueFontColor` | 2 | Falta | 4 |  |

### Título

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Font family | `fontFamily` | 1 | Falta | 4 |  |
| Title heading | `heading` | 1 | Falta | 4 |  |
| Word wrap | `titleWrap` | 1 | Falta | 4 |  |
| Underline | `underline` | 1 | Falta | 4 |  |

### accentBar

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 2 |  |
| Position | `position` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |
| Width | `width` | 3 | Falta | 2 |  |

### actionButtonSection

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 4 |  |
| Show | `backgroundShow` | 3 | Falta | 4 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 4 |  |
| Bold | `bold` | 3 | Falta | 4 |  |
| Color | `borderColor` | 3 | Falta | 4 |  |
| Show | `borderShow` | 3 | Falta | 4 |  |
| Transparency | `borderTransparency` | 3 | Falta | 4 |  |
| Width | `borderWidth` | 3 | Falta | 4 |  |
| Icon only | `displayIconOnly` | 3 | Falta | 4 |  |
| Color | `fillColor` | 3 | Falta | 4 |  |
| Show | `fillShow` | 3 | Falta | 4 |  |
| Transparency | `fillTransparency` | 3 | Falta | 4 |  |
| Font family | `fontFamily` | 3 | Falta | 4 |  |
| Text size | `fontSize` | 3 | Falta | 4 |  |
| Blur | `glowBlur` | 3 | Falta | 4 |  |
| Color | `glowColor` | 3 | Falta | 4 |  |
| Shadow position | `glowOffset` | 3 | Falta | 4 |  |
| Position | `glowPosition` | 3 | Falta | 4 |  |
| Show | `glowShow` | 3 | Falta | 4 |  |
| Transparency | `glowTransparency` | 3 | Falta | 4 |  |
| Color | `iconColor` | 3 | Falta | 4 |  |
| Customize padding | `iconIndividualPadding` | 3 | Falta | 4 |  |
| Padding | `iconPadding` | 3 | Falta | 4 |  |
| Bottom padding | `iconPaddingBottom` | 3 | Falta | 4 |  |
| Left padding | `iconPaddingLeft` | 3 | Falta | 4 |  |
| Right padding | `iconPaddingRight` | 3 | Falta | 4 |  |
| Top padding | `iconPaddingTop` | 3 | Falta | 4 |  |
| Show | `iconShow` | 3 | Falta | 4 |  |
| Icon size | `iconSize` | 3 | Falta | 4 |  |
| Transparency | `iconTransparency` | 3 | Falta | 4 |  |
| Customize padding | `individualPadding` | 3 | Falta | 4 |  |
| Italic | `italic` | 3 | Falta | 4 |  |
| Match tile background | `matchTileBackground` | 3 | Falta | 4 |  |
| Padding | `padding` | 3 | Falta | 4 |  |
| Bottom padding | `paddingBottom` | 3 | Falta | 4 |  |
| Left padding | `paddingLeft` | 3 | Falta | 4 |  |
| Right padding | `paddingRight` | 3 | Falta | 4 |  |
| Top padding | `paddingTop` | 3 | Falta | 4 |  |
| Position | `position` | 3 | Falta | 4 |  |
| Show | `positionShow` | 3 | Falta | 4 |  |
| Blur | `shadowBlur` | 3 | Falta | 4 |  |
| Color | `shadowColor` | 3 | Falta | 4 |  |
| Shadow position | `shadowOffset` | 3 | Falta | 4 |  |
| Position | `shadowPosition` | 3 | Falta | 4 |  |
| Show | `shadowShow` | 3 | Falta | 4 |  |
| Transparency | `shadowTransparency` | 3 | Falta | 4 |  |
| Show | `show` | 3 | Falta | 4 |  |
| Text | `text` | 3 | Falta | 4 |  |
| Text color | `textColor` | 3 | Falta | 4 |  |
| Horizontal alignment | `textHorizontalAlignment` | 3 | Falta | 4 |  |
| Customize padding | `textIndividualPadding` | 3 | Falta | 4 |  |
| Padding | `textPadding` | 3 | Falta | 4 |  |
| Bottom padding | `textPaddingBottom` | 3 | Falta | 4 |  |
| Left padding | `textPaddingLeft` | 3 | Falta | 4 |  |
| Right padding | `textPaddingRight` | 3 | Falta | 4 |  |
| Top padding | `textPaddingTop` | 3 | Falta | 4 |  |
| Show | `textShow` | 3 | Falta | 4 |  |
| Transparency | `textTransparency` | 3 | Falta | 4 |  |
| Vertical alignment | `textVerticalAlignment` | 3 | Falta | 4 |  |
| Underline | `underline` | 3 | Falta | 4 |  |

### applyButton

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backColor` | 3 | Falta | 1 |  |
| Show | `backShow` | 3 | Falta | 1 |  |
| Transparency | `backTransparency` | 3 | Falta | 1 |  |
| Color | `borderColor` | 3 | Falta | 1 |  |
| Show | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Color | `iconColor` | 3 | Falta | 1 |  |
| Icon size | `iconSize` | 3 | Falta | 1 |  |
| Transparency | `iconTransparency` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Spacing | `spacing` | 3 | Falta | 1 |  |

### behavior

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Placement | `disabledItemsOrder` | 3 | Falta | 1 |  |

### calendarButton

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Bottom left corner | `cornerBottomLeft` | 3 | Falta | 1 |  |
| Bottom right corner | `cornerBottomRight` | 3 | Falta | 1 |  |
| Rounded corners | `cornerRadius` | 3 | Falta | 1 |  |
| Top left corner | `cornerTopLeft` | 3 | Falta | 1 |  |
| Top right corner | `cornerTopRight` | 3 | Falta | 1 |  |
| Color | `iconColor` | 3 | Falta | 1 |  |
| Icon size | `iconSize` | 3 | Falta | 1 |  |
| Transparency | `iconTransparency` | 3 | Falta | 1 |  |
| Individual corners | `individualCorners` | 3 | Falta | 1 |  |
| Color | `strokeColor` | 3 | Falta | 1 |  |
| Line style | `strokePattern` | 3 | Falta | 1 |  |
| Show | `strokeShow` | 3 | Falta | 1 |  |
| Transparency | `strokeTransparency` | 3 | Falta | 1 |  |
| Outline weight | `strokeWidth` | 3 | Falta | 1 |  |

### date

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Font color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| hideDatePickerButton | `hideDatePickerButton` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Text size | `textSize` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### dateRange

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Anchor date | `anchorDate` | 3 | Falta | 1 |  |
| Include today | `includeToday` | 3 | Falta | 1 |  |

### dateRangeText

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 3 | Falta | 1 |  |
| Color | `color` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### dropdown

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `accentBarColor` | 1 | Falta | 1 |  |
| Position | `accentBarPosition` | 1 | Falta | 1 |  |
| Show | `accentBarShow` | 1 | Falta | 1 |  |
| Transparency | `accentBarTransparency` | 1 | Falta | 1 |  |
| Width | `accentBarWidth` | 1 | Falta | 1 |  |
| Bottom left corner | `borderBottomLeftCorner` | 1 | Falta | 1 |  |
| Bottom right corner | `borderBottomRightCorner` | 1 | Falta | 1 |  |
| Color | `borderColor` | 1 | Falta | 1 |  |
| Individual corners | `borderIndividualCorners` | 1 | Falta | 1 |  |
| Rounded corners | `borderRadius` | 1 | Falta | 1 |  |
| Top left corner | `borderTopLeftCorner` | 1 | Falta | 1 |  |
| Top right corner | `borderTopRightCorner` | 1 | Falta | 1 |  |
| filterMode | `filterMode` | 1 | Falta | 1 |  |
| Color | `iconColor` | 1 | Falta | 1 |  |
| Transparency | `iconTransparency` | 1 | Falta | 1 |  |

### dropdownButton

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Corner radius | `cornerRadius` | 3 | Falta | 1 |  |
| Bottom left | `cornerRadiusBottomLeft` | 3 | Falta | 1 |  |
| Bottom right | `cornerRadiusBottomRight` | 3 | Falta | 1 |  |
| Top left | `cornerRadiusTopLeft` | 3 | Falta | 1 |  |
| Top right | `cornerRadiusTopRight` | 3 | Falta | 1 |  |
| Horizontal gap | `horizontalGap` | 3 | Falta | 1 |  |
| Color | `iconColor` | 3 | Falta | 1 |  |
| Show | `iconShow` | 3 | Falta | 1 |  |
| Size | `iconSize` | 3 | Falta | 1 |  |
| Transparency | `iconTransparency` | 3 | Falta | 1 |  |
| Individual corners | `individualCorners` | 3 | Falta | 1 |  |
| Individual padding | `individualPadding` | 3 | Falta | 1 |  |
| Bottom | `paddingBottom` | 3 | Falta | 1 |  |
| Left | `paddingLeft` | 3 | Falta | 1 |  |
| Right | `paddingRight` | 3 | Falta | 1 |  |
| Top | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |

### dropdownMenu

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Border color | `borderColor` | 3 | Falta | 1 |  |
| Border | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Corner radius | `cornerRadius` | 3 | Falta | 1 |  |
| Bottom left | `cornerRadiusBottomLeft` | 3 | Falta | 1 |  |
| Bottom right | `cornerRadiusBottomRight` | 3 | Falta | 1 |  |
| Top left | `cornerRadiusTopLeft` | 3 | Falta | 1 |  |
| Top right | `cornerRadiusTopRight` | 3 | Falta | 1 |  |
| Blur | `glowBlur` | 3 | Falta | 1 |  |
| Color | `glowColor` | 3 | Falta | 1 |  |
| Position | `glowPosition` | 3 | Falta | 1 |  |
| Show | `glowShow` | 3 | Falta | 1 |  |
| Transparency | `glowTransparency` | 3 | Falta | 1 |  |
| Individual corners | `individualCorners` | 3 | Falta | 1 |  |
| Individual padding | `individualPadding` | 3 | Falta | 1 |  |
| Max height | `maxHeight` | 3 | Falta | 1 |  |
| Bottom | `paddingBottom` | 3 | Falta | 1 |  |
| Left | `paddingLeft` | 3 | Falta | 1 |  |
| Right | `paddingRight` | 3 | Falta | 1 |  |
| Top | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Blur | `shadowBlur` | 3 | Falta | 1 |  |
| Color | `shadowColor` | 3 | Falta | 1 |  |
| Position | `shadowPosition` | 3 | Falta | 1 |  |
| Show | `shadowShow` | 3 | Falta | 1 |  |
| Transparency | `shadowTransparency` | 3 | Falta | 1 |  |
| Width | `width` | 3 | Falta | 1 |  |

### expansionIcon

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Size | `size` | 3 | Falta | 1 |  |
| Spacing | `spacing` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Vertical alignment | `verticalAlignment` | 3 | Falta | 1 |  |

### fillCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Blur | `blur` | 3 | Falta | 2 |  |
| Contrast | `contrast` | 3 | Falta | 2 |  |
| Image effects | `effects` | 3 | Falta | 2 |  |
| Exposure | `exposure` | 3 | Falta | 2 |  |
| Field | `field` | 3 | Falta | 2 |  |
| Fill color | `fillColor` | 3 | Falta | 2 |  |
| Image fit | `fit` | 3 | Falta | 2 |  |
| Image height | `height` | 3 | Falta | 2 |  |
| image | `image` | 3 | Falta | 2 |  |
| Add image | `imageShow` | 3 | Falta | 2 |  |
| imageSplitTransparency | `imageSplitTransparency` | 3 | Falta | 2 |  |
| Transparency | `imageTransparency` | 3 | Falta | 2 |  |
| Saturation | `saturation` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Image source | `sourceType` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |
| Image URL | `url` | 3 | Falta | 2 |  |

### filterOperator

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backColor` | 3 | Falta | 1 |  |
| Show | `backShow` | 3 | Falta | 1 |  |
| Transparency | `backTransparency` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Color | `borderColor` | 3 | Falta | 1 |  |
| Show | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Bottom left corner | `cornerBottomLeft` | 3 | Falta | 1 |  |
| Bottom right corner | `cornerBottomRight` | 3 | Falta | 1 |  |
| Rounded corners | `cornerRadius` | 3 | Falta | 1 |  |
| Top left corner | `cornerTopLeft` | 3 | Falta | 1 |  |
| Top right corner | `cornerTopRight` | 3 | Falta | 1 |  |
| Color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Transparency | `fontTransparency` | 3 | Falta | 1 |  |
| Color | `iconColor` | 3 | Falta | 1 |  |
| Icon size | `iconSize` | 3 | Falta | 1 |  |
| Transparency | `iconTransparency` | 3 | Falta | 1 |  |
| Individual corners | `individualCorners` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Show | `showText` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### glowCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 3 | Falta | 2 |  |
| Color | `color` | 3 | Falta | 2 |  |
| Distance | `glowDistance` | 3 | Falta | 2 |  |
| Preset | `glowPositionPreset` | 3 | Falta | 2 |  |
| Size | `glowSpread` | 3 | Falta | 2 |  |
| Offset | `position` | 3 | Falta | 2 |  |
| Blur | `shadowBlur` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |

### header

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Outline | `outlineStyle` | 1 | Falta | 1 |  |
| Show summary | `showRestatement` | 1 | Falta | 1 |  |
| Title text | `text` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### icon

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alt text | `altText` | 3 | Falta | 2 |  |
| icon | `icon` | 3 | Falta | 2 |  |
| Icon type | `iconType` | 3 | Falta | 2 |  |
| Image URL | `iconUrl` | 3 | Falta | 2 |  |
| Padding | `padding` | 3 | Falta | 2 |  |
| Position | `position` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Size | `size` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |

### image

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alt text | `altText` | 3 | Falta | 2 |  |
| Blur | `blur` | 3 | Falta | 2 |  |
| Contrast | `contrast` | 3 | Falta | 2 |  |
| Image effects | `effects` | 3 | Falta | 2 |  |
| Blur | `enhancedBlur` | 3 | Falta | 2 |  |
| Image fit | `enhancedFit` | 3 | Falta | 2 |  |
| Saturation | `enhancedSaturation` | 3 | Falta | 2 |  |
| Exposure | `exposure` | 3 | Falta | 2 |  |
| Image height | `height` | 3 | Falta | 2 |  |
| Ignore padding | `ignorePadding` | 3 | Falta | 2 |  |
| Field | `image` | 3 | Falta | 2 |  |
| Image area size | `imageAreaSize` | 3 | Falta | 2 |  |
| imageFile | `imageFile` | 3 | Falta | 2 |  |
| Image fit | `imageFit` | 3 | Falta | 2 |  |
| Space between image and callout | `padding` | 3 | Falta | 2 |  |
| Position | `position` | 3 | Falta | 2 |  |
| Saturation | `saturation` | 3 | Falta | 2 |  |
| Set as background | `setAsBackGround` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Image source | `sourceType` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |
| Image URL | `url` | 3 | Falta | 2 |  |

### inputText

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backColor` | 3 | Falta | 1 |  |
| Show | `backShow` | 3 | Falta | 1 |  |
| Transparency | `backTransparency` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Color | `borderColor` | 3 | Falta | 1 |  |
| Show | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Color | `dismissColor` | 3 | Falta | 1 |  |
| Horizontal position | `dismissPosition` | 3 | Falta | 1 |  |
| Icon size | `dismissSize` | 3 | Falta | 1 |  |
| Spacing | `dismissSpacing` | 3 | Falta | 1 |  |
| Transparency | `dismissTransparency` | 3 | Falta | 1 |  |
| Color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Transparency | `fontTransparency` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Bottom left corner | `pillCornerBottomLeft` | 3 | Falta | 1 |  |
| Bottom right corner | `pillCornerBottomRight` | 3 | Falta | 1 |  |
| Rounded corners | `pillCornerRadius` | 3 | Falta | 1 |  |
| Top left corner | `pillCornerTopLeft` | 3 | Falta | 1 |  |
| Top right corner | `pillCornerTopRight` | 3 | Falta | 1 |  |
| Horizontal position | `pillHorizontalPosition` | 3 | Falta | 1 |  |
| Individual corners | `pillIndividualCorners` | 3 | Falta | 1 |  |
| Placeholder | `placeholder` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### inputTextBox

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `accentBarColor` | 3 | Falta | 1 |  |
| Position | `accentBarPosition` | 3 | Falta | 1 |  |
| Show | `accentBarShow` | 3 | Falta | 1 |  |
| Transparency | `accentBarTransparency` | 3 | Falta | 1 |  |
| Width | `accentBarWidth` | 3 | Falta | 1 |  |
| Color | `backColor` | 3 | Falta | 1 |  |
| Show | `backShow` | 3 | Falta | 1 |  |
| Transparency | `backTransparency` | 3 | Falta | 1 |  |
| Color | `borderColor` | 3 | Falta | 1 |  |
| Show | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Bottom left corner | `containerCornerBottomLeft` | 3 | Falta | 1 |  |
| Bottom right corner | `containerCornerBottomRight` | 3 | Falta | 1 |  |
| Rounded corners | `containerCornerRadius` | 3 | Falta | 1 |  |
| Top left corner | `containerCornerTopLeft` | 3 | Falta | 1 |  |
| Top right corner | `containerCornerTopRight` | 3 | Falta | 1 |  |
| Individual corners | `containerIndividualCorners` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Placeholder | `placeholder` | 3 | Falta | 1 |  |
| Bold | `placeholderBold` | 3 | Falta | 1 |  |
| Color | `placeholderFontColor` | 3 | Falta | 1 |  |
| Font family | `placeholderFontFamily` | 3 | Falta | 1 |  |
| Text size | `placeholderFontSize` | 3 | Falta | 1 |  |
| Transparency | `placeholderFontTransparency` | 3 | Falta | 1 |  |
| Italic | `placeholderItalic` | 3 | Falta | 1 |  |
| Underline | `placeholderUnderline` | 3 | Falta | 1 |  |

### items

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| accessibilityContrastProperties | `accessibilityContrastProperties` | 1 | Falta | 1 |  |
| Bold | `bold` | 1 | Falta | 1 |  |
| Color | `expandCollapseIconColor` | 1 | Falta | 1 |  |
| Expand/collapse icon | `expandCollapseToggleType` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Italic | `italic` | 1 | Falta | 1 |  |
| Outline | `outlineStyle` | 1 | Falta | 1 |  |
| Padding | `padding` | 1 | Falta | 1 |  |
| Stepped layout indentation | `steppedLayoutIndentation` | 1 | Falta | 1 |  |
| Text size | `textSize` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### label

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Align baselines | `alignBaselines` | 1 | Falta | 2 |  |
| Bold | `bold` | 1 | Falta | 2 |  |
| Field | `field` | 1 | Falta | 2 |  |
| Font color | `fontColor` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Heading | `heading` | 1 | Falta | 2 |  |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Label source | `labelSource` | 1 | Falta | 1 |  |
| Match value alignment | `matchValueAlignment` | 1 | Falta | 2 |  |
| Position | `position` | 1 | Falta | 2 |  |
| Show | `show` | 1 | Falta | 2 |  |
| Text wrap | `textWrap` | 1 | Falta | 2 |  |
| Transparency | `transparency` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 2 |  |

### numericInputStyle

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Font color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Text size | `textSize` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### outline

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Outline color | `lineColor` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |
| Outline weight | `weight` | 3 | Falta | 2 |  |

### overFlow

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Overflow direction | `overFlowDirection` | 3 | Falta | 2 |  |
| Overflow style | `overFlowStyle` | 3 | Falta | 2 |  |

### pendingChangesIcon

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Show tooltip | `showTooltip` | 3 | Falta | 1 |  |
| Size | `size` | 3 | Falta | 1 |  |
| Label text | `tooltipLabel` | 3 | Falta | 1 |  |
| Tooltip text | `tooltipText` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### pills

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 2 | Falta | 1 |  |
| Show | `backgroundShow` | 2 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 2 | Falta | 1 |  |
| Bold | `bold` | 2 | Falta | 1 |  |
| Border color | `borderColor` | 2 | Falta | 1 |  |
| Border | `borderShow` | 2 | Falta | 1 |  |
| Transparency | `borderTransparency` | 2 | Falta | 1 |  |
| Corner radius | `cornerRadius` | 2 | Falta | 1 |  |
| Bottom left | `cornerRadiusBottomLeft` | 2 | Falta | 1 |  |
| Bottom right | `cornerRadiusBottomRight` | 2 | Falta | 1 |  |
| Top left | `cornerRadiusTopLeft` | 2 | Falta | 1 |  |
| Top right | `cornerRadiusTopRight` | 2 | Falta | 1 |  |
| Color | `dismissColor` | 2 | Falta | 1 |  |
| Dismiss button and text gap | `dismissGap` | 2 | Falta | 1 |  |
| Position | `dismissPosition` | 2 | Falta | 1 |  |
| Size | `dismissSize` | 2 | Falta | 1 |  |
| Transparency | `dismissTransparency` | 2 | Falta | 1 |  |
| Color | `fontColor` | 2 | Falta | 1 |  |
| Font family | `fontFamily` | 2 | Falta | 1 |  |
| Text size | `fontSize` | 2 | Falta | 1 |  |
| Transparency | `fontTransparency` | 2 | Falta | 1 |  |
| Individual corners | `individualCorners` | 2 | Falta | 1 |  |
| Individual padding | `individualPadding` | 2 | Falta | 1 |  |
| Italic | `italic` | 2 | Falta | 1 |  |
| Direction | `layoutDirection` | 2 | Falta | 1 |  |
| Bottom | `paddingBottom` | 2 | Falta | 1 |  |
| Left | `paddingLeft` | 2 | Falta | 1 |  |
| Right | `paddingRight` | 2 | Falta | 1 |  |
| Top | `paddingTop` | 2 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 2 | Falta | 1 |  |
| Underline | `underline` | 2 | Falta | 1 |  |

### relativeText

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 3 | Falta | 1 |  |
| Color | `color` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### rotation

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Rotation | `angle` | 3 | Falta | 2 |  |
| Shape rotation | `shapeAngle` | 3 | Falta | 2 |  |
| Text rotation | `textAngle` | 3 | Falta | 2 |  |

### search

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `accentBarColor` | 2 | Falta | 2 |  |
| Position | `accentBarPosition` | 2 | Falta | 2 |  |
| Show | `accentBarShow` | 2 | Falta | 2 |  |
| Transparency | `accentBarTransparency` | 2 | Falta | 2 |  |
| Width | `accentBarWidth` | 2 | Falta | 2 |  |
| Color | `backgroundColor` | 2 | Falta | 2 |  |
| Show | `backgroundShow` | 2 | Falta | 2 |  |
| Transparency | `backgroundTransparency` | 2 | Falta | 2 |  |
| Bold | `bold` | 2 | Falta | 2 |  |
| Border color | `borderColor` | 2 | Falta | 2 |  |
| Border | `borderShow` | 2 | Falta | 2 |  |
| Transparency | `borderTransparency` | 2 | Falta | 2 |  |
| Corner radius | `cornerRadius` | 2 | Falta | 2 |  |
| Bottom left | `cornerRadiusBottomLeft` | 2 | Falta | 2 |  |
| Bottom right | `cornerRadiusBottomRight` | 2 | Falta | 2 |  |
| Top left | `cornerRadiusTopLeft` | 2 | Falta | 2 |  |
| Top right | `cornerRadiusTopRight` | 2 | Falta | 2 |  |
| Color | `fontColor` | 2 | Falta | 2 |  |
| Font family | `fontFamily` | 2 | Falta | 2 |  |
| Text size | `fontSize` | 2 | Falta | 2 |  |
| Transparency | `fontTransparency` | 2 | Falta | 2 |  |
| Color | `iconColor` | 2 | Falta | 2 |  |
| Show | `iconShow` | 2 | Falta | 2 |  |
| Size | `iconSize` | 2 | Falta | 2 |  |
| Transparency | `iconTransparency` | 2 | Falta | 2 |  |
| Individual corners | `individualCorners` | 2 | Falta | 2 |  |
| Individual padding | `individualPadding` | 2 | Falta | 2 |  |
| Italic | `italic` | 2 | Falta | 2 |  |
| Bottom | `paddingBottom` | 2 | Falta | 2 |  |
| Left | `paddingLeft` | 2 | Falta | 2 |  |
| Right | `paddingRight` | 2 | Falta | 2 |  |
| Top | `paddingTop` | 2 | Falta | 2 |  |
| Uniform padding | `paddingUniform` | 2 | Falta | 2 |  |
| Underline | `underline` | 2 | Falta | 2 |  |
| Vertical gap | `verticalGap` | 2 | Falta | 2 |  |

### searchBox

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background | `background` | 3 | Falta | 1 |  |
| Outline color | `borderColor` | 3 | Falta | 1 |  |
| Outline | `outlineStyle` | 3 | Falta | 1 |  |

### selectedOnly

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 2 |  |
| Show | `backgroundShow` | 3 | Falta | 2 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 2 |  |
| Bold | `bold` | 3 | Falta | 2 |  |
| Border color | `borderColor` | 3 | Falta | 2 |  |
| Border | `borderShow` | 3 | Falta | 2 |  |
| Transparency | `borderTransparency` | 3 | Falta | 2 |  |
| Width | `borderWidth` | 3 | Falta | 2 |  |
| Color | `buttonColor` | 3 | Falta | 2 |  |
| Transparency | `buttonTransparency` | 3 | Falta | 2 |  |
| Corner radius | `cornerRadius` | 3 | Falta | 2 |  |
| Bottom left | `cornerRadiusBottomLeft` | 3 | Falta | 2 |  |
| Bottom right | `cornerRadiusBottomRight` | 3 | Falta | 2 |  |
| Top left | `cornerRadiusTopLeft` | 3 | Falta | 2 |  |
| Top right | `cornerRadiusTopRight` | 3 | Falta | 2 |  |
| Color | `fontColor` | 3 | Falta | 2 |  |
| Font family | `fontFamily` | 3 | Falta | 2 |  |
| Text size | `fontSize` | 3 | Falta | 2 |  |
| Transparency | `fontTransparency` | 3 | Falta | 2 |  |
| Individual corners | `individualCorners` | 3 | Falta | 2 |  |
| Individual padding | `individualPadding` | 3 | Falta | 2 |  |
| Italic | `italic` | 3 | Falta | 2 |  |
| Bottom | `paddingBottom` | 3 | Falta | 2 |  |
| Left | `paddingLeft` | 3 | Falta | 2 |  |
| Right | `paddingRight` | 3 | Falta | 2 |  |
| Top | `paddingTop` | 3 | Falta | 2 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Underline | `underline` | 3 | Falta | 2 |  |

### selection

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Restrict to leaf nodes | `restrictToLeafNodes` | 1 | Falta | 2 |  |
| Show "Select all" option | `selectAllCheckboxEnabled` | 1 | Falta | 3 |  |
| Single date | `singleDate` | 1 | Falta | 1 |  |
| Multi-select with CTRL | `singleSelect` | 1 | Parcial | 3 | Ajuste del filtro nativo |
| Single select | `strictSingleSelect` | 1 | Falta | 3 |  |

### selectionBox

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `accentBarColor` | 3 | Falta | 1 |  |
| Position | `accentBarPosition` | 3 | Falta | 1 |  |
| Show | `accentBarShow` | 3 | Falta | 1 |  |
| Transparency | `accentBarTransparency` | 3 | Falta | 1 |  |
| Width | `accentBarWidth` | 3 | Falta | 1 |  |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Border color | `borderColor` | 3 | Falta | 1 |  |
| Border | `borderShow` | 3 | Falta | 1 |  |
| Transparency | `borderTransparency` | 3 | Falta | 1 |  |
| Width | `borderWidth` | 3 | Falta | 1 |  |
| Corner radius | `cornerRadius` | 3 | Falta | 1 |  |
| Bottom left | `cornerRadiusBottomLeft` | 3 | Falta | 1 |  |
| Bottom right | `cornerRadiusBottomRight` | 3 | Falta | 1 |  |
| Top left | `cornerRadiusTopLeft` | 3 | Falta | 1 |  |
| Top right | `cornerRadiusTopRight` | 3 | Falta | 1 |  |
| Color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Transparency | `fontTransparency` | 3 | Falta | 1 |  |
| Individual corners | `individualCorners` | 3 | Falta | 1 |  |
| Individual padding | `individualPadding` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Bottom | `paddingBottom` | 3 | Falta | 1 |  |
| Left | `paddingLeft` | 3 | Falta | 1 |  |
| Right | `paddingRight` | 3 | Falta | 1 |  |
| Top | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Placeholder | `placeholderText` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |

### selectionIcon

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 2 | Falta | 3 |  |
| Position | `overlayPosition` | 2 | Falta | 2 |  |
| Overlay | `overlayToggle` | 2 | Falta | 2 |  |
| Position | `position` | 2 | Falta | 2 |  |
| Show | `show` | 2 | Falta | 2 |  |
| Show | `showIconByState` | 2 | Falta | 2 |  |
| Size | `size` | 2 | Falta | 2 |  |
| Horizontal gap | `spacing` | 2 | Falta | 2 |  |
| Transparency | `transparency` | 2 | Falta | 2 |  |
| Vertical alignment | `verticalAlignment` | 2 | Falta | 2 |  |

### shadowCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 3 | Falta | 2 |  |
| Color | `color` | 3 | Falta | 2 |  |
| Offset | `position` | 3 | Falta | 2 |  |
| Blur | `shadowBlur` | 3 | Falta | 2 |  |
| Distance | `shadowDistance` | 3 | Falta | 2 |  |
| Preset | `shadowPositionPreset` | 3 | Falta | 2 |  |
| Size | `shadowSpread` | 3 | Falta | 2 |  |
| Show | `show` | 3 | Falta | 2 |  |
| Transparency | `transparency` | 3 | Falta | 2 |  |

### shapeCustomRectangle

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Rounded corners | `rectangleRoundedCurve` | 3 | Falta | 2 |  |
| Customize style | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 2 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 2 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 2 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 2 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 2 |  |
| Size of bottom snips | `tabCutCornerSnipSizeBottom` | 3 | Falta | 2 |  |
| Customize style | `tabCutCornerSnipSizeCustomStyle` | 3 | Falta | 2 |  |
| Bottom left corner | `tabCutCornerSnipSizeLeftBottom` | 3 | Falta | 2 |  |
| Top left corner | `tabCutCornerSnipSizeLeftTop` | 3 | Falta | 2 |  |
| Bottom right corner | `tabCutCornerSnipSizeRightBottom` | 3 | Falta | 2 |  |
| Top right corner | `tabCutCornerSnipSizeRightTop` | 3 | Falta | 2 |  |
| Size of top snips | `tabCutCornerSnipSizeTop` | 3 | Falta | 2 |  |
| Shape | `tileShape` | 3 | Falta | 2 |  |

### slicerSettings

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Accept multiple values | `multiselect` | 3 | Falta | 1 |  |
| Numeric input only | `numericInputOnly` | 3 | Falta | 1 |  |

### slider

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 1 |  |
| Border | `handleBorderColor` | 3 | Falta | 1 |  |
| Fill color | `handleFillColor` | 3 | Falta | 1 |  |
| Height | `handleHeight` | 3 | Falta | 1 |  |
| Size | `handleSize` | 3 | Falta | 1 |  |
| Width | `handleWidth` | 3 | Falta | 1 |  |
| Color | `secondaryLineColor` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |

### value

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 2 |  |
| Format code | `customFormatString` | 1 | Falta | 2 |  |
| Font color | `fontColor` | 1 | Falta | 2 |  |
| Font family | `fontFamily` | 1 | Falta | 2 |  |
| Text size | `fontSize` | 1 | Falta | 2 |  |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 2 |  |
| Italic | `italic` | 1 | Falta | 2 |  |
| Display units | `labelDisplayUnits` | 1 | Falta | 2 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 2 |  |
| Show | `show` | 1 | Falta | 2 |  |
| Show blank as | `showBlankAs` | 1 | Falta | 2 |  |
| Text | `text` | 1 | Falta | 2 |  |
| Text wrap | `textWrap` | 1 | Falta | 2 |  |
| Transparency | `transparency` | 1 | Falta | 2 |  |
| Underline | `underline` | 1 | Falta | 2 |  |
| Vertical alignment | `verticalAlignment` | 1 | Falta | 2 |  |

## Fase 8: Análisis y tooltips

### Anotaciones

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| callout | `callout` | 3 | Falta | 14 |  |
| highlight | `highlight` | 3 | Falta | 1 |  |

### Control deslizante de zoom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| categoryMax | `categoryMax` | 2 | Falta | 13 |  |
| categoryMin | `categoryMin` | 2 | Falta | 13 |  |
| categorySize | `categorySize` | 2 | Falta | 13 |  |
| Show | `show` | 2 | Parcial | 13 | Control de zoom, sin formato (zoomable) |
| Slider labels | `showLabels` | 2 | Falta | 13 |  |
| Y axis | `showOnCategoryAxis` | 2 | Falta | 13 |  |
| X axis | `showOnValueAxis` | 2 | Falta | 13 |  |
| Secondary Y axis | `showOnValueSecAxis` | 2 | Falta | 6 |  |
| Slider tooltips | `showTooltip` | 2 | Falta | 13 |  |
| valueMax | `valueMax` | 2 | Falta | 13 |  |
| valueMin | `valueMin` | 2 | Falta | 13 |  |
| valueSecMax | `valueSecMax` | 2 | Falta | 6 |  |
| valueSecMin | `valueSecMin` | 2 | Falta | 6 |  |
| valueSecSize | `valueSecSize` | 2 | Falta | 6 |  |
| valueSize | `valueSize` | 2 | Falta | 13 |  |

### Encabezado de múltiplos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 3 | Falta | 12 |  |
| Bold | `bold` | 3 | Falta | 12 |  |
| Font color | `fontColor` | 3 | Falta | 12 |  |
| Font family | `fontFamily` | 3 | Falta | 12 |  |
| Text size | `fontSize` | 3 | Falta | 12 |  |
| Italic | `italic` | 3 | Falta | 12 |  |
| Position | `position` | 3 | Falta | 12 |  |
| Show | `show` | 3 | Falta | 12 |  |
| Word wrap | `titleWrap` | 3 | Falta | 12 |  |
| Underline | `underline` | 3 | Falta | 12 |  |

### Línea de referencia

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 6 |  |
| Dash array | `dashArray` | 2 | Falta | 6 |  |
| Dash cap | `dashCap` | 2 | Falta | 6 |  |
| Color | `dataLabelColor` | 2 | Falta | 6 |  |
| Value decimal places | `dataLabelDecimalPoints` | 2 | Falta | 6 |  |
| Display units | `dataLabelDisplayUnits` | 2 | Falta | 6 |  |
| Horizontal position | `dataLabelHorizontalPosition` | 2 | Falta | 6 |  |
| Data label | `dataLabelShow` | 2 | Falta | 6 |  |
| Text | `dataLabelText` | 2 | Falta | 6 |  |
| Vertical position | `dataLabelVerticalPosition` | 2 | Falta | 6 |  |
| Name | `displayName` | 2 | Falta | 6 |  |
| Color | `lineColor` | 2 | Falta | 6 |  |
| Position | `position` | 2 | Falta | 6 |  |
| Shade color | `shadeColor` | 2 | Falta | 6 |  |
| Match line color | `shadeColorMatchStroke` | 2 | Falta | 6 |  |
| Shade region | `shadeRegion` | 2 | Falta | 6 |  |
| Show | `shadeShow` | 2 | Falta | 6 |  |
| Shade transparency | `shadeTransparency` | 2 | Falta | 6 |  |
| Show | `show` | 2 | Falta | 6 |  |
| Line style | `style` | 2 | Falta | 6 |  |
| Transparency | `transparency` | 2 | Falta | 6 |  |
| Value | `value` | 2 | Falta | 6 |  |
| Width | `width` | 2 | Falta | 6 |  |

### Línea de referencia X

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 13 |  |
| Dash array | `dashArray` | 2 | Falta | 13 |  |
| Dash cap | `dashCap` | 2 | Falta | 13 |  |
| Color | `dataLabelColor` | 2 | Falta | 13 |  |
| Value decimal places | `dataLabelDecimalPoints` | 2 | Falta | 13 |  |
| Display units | `dataLabelDisplayUnits` | 2 | Falta | 13 |  |
| Horizontal position | `dataLabelHorizontalPosition` | 2 | Falta | 13 |  |
| Data label | `dataLabelShow` | 2 | Falta | 13 |  |
| Text | `dataLabelText` | 2 | Falta | 13 |  |
| Vertical position | `dataLabelVerticalPosition` | 2 | Falta | 13 |  |
| Name | `displayName` | 2 | Falta | 13 |  |
| Color | `lineColor` | 2 | Falta | 13 |  |
| Position | `position` | 2 | Falta | 13 |  |
| Shade color | `shadeColor` | 2 | Falta | 13 |  |
| Match line color | `shadeColorMatchStroke` | 2 | Falta | 13 |  |
| Shade region | `shadeRegion` | 2 | Falta | 13 |  |
| Show | `shadeShow` | 2 | Falta | 13 |  |
| Shade transparency | `shadeTransparency` | 2 | Falta | 13 |  |
| Show | `show` | 2 | Falta | 13 |  |
| Line style | `style` | 2 | Falta | 13 |  |
| Transparency | `transparency` | 2 | Falta | 13 |  |
| Value | `value` | 2 | Falta | 13 |  |
| Width | `width` | 2 | Falta | 13 |  |

### Línea de referencia Y

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 14 |  |
| Dash array | `dashArray` | 2 | Falta | 14 |  |
| Dash cap | `dashCap` | 2 | Falta | 14 |  |
| Color | `dataLabelColor` | 2 | Falta | 14 |  |
| Value decimal places | `dataLabelDecimalPoints` | 2 | Falta | 14 |  |
| Display units | `dataLabelDisplayUnits` | 2 | Falta | 14 |  |
| Horizontal position | `dataLabelHorizontalPosition` | 2 | Falta | 14 |  |
| Data label | `dataLabelShow` | 2 | Falta | 14 |  |
| Text | `dataLabelText` | 2 | Falta | 14 |  |
| Vertical position | `dataLabelVerticalPosition` | 2 | Falta | 14 |  |
| Name | `displayName` | 2 | Falta | 14 |  |
| Color | `lineColor` | 2 | Falta | 14 |  |
| Position | `position` | 2 | Falta | 14 |  |
| Shade color | `shadeColor` | 2 | Falta | 14 |  |
| Match line color | `shadeColorMatchStroke` | 2 | Falta | 14 |  |
| Shade region | `shadeRegion` | 2 | Falta | 14 |  |
| Show | `shadeShow` | 2 | Falta | 14 |  |
| Shade transparency | `shadeTransparency` | 2 | Falta | 14 |  |
| Show | `show` | 2 | Falta | 14 |  |
| Line style | `style` | 2 | Falta | 14 |  |
| Transparency | `transparency` | 2 | Falta | 14 |  |
| Value | `value` | 2 | Falta | 14 |  |
| Width | `width` | 2 | Falta | 14 |  |

### Línea de tendencia

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 12 |  |
| Combine series | `combineSeries` | 2 | Falta | 12 |  |
| Dash array | `dashArray` | 2 | Falta | 12 |  |
| Dash cap | `dashCap` | 2 | Falta | 12 |  |
| Name | `displayName` | 2 | Falta | 12 |  |
| Color | `lineColor` | 2 | Falta | 12 |  |
| Show | `show` | 2 | Falta | 12 |  |
| Line style | `style` | 2 | Falta | 12 |  |
| Transparency | `transparency` | 2 | Falta | 12 |  |
| Use highlight values | `useHighlightValues` | 2 | Falta | 11 |  |
| Width | `width` | 2 | Falta | 12 |  |

### Múltiplos pequeños

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Advanced padding options | `advancedPaddingOptions` | 2 | Falta | 12 |  |
| Background color | `backgroundColor` | 2 | Falta | 12 |  |
| Background transparency | `backgroundTransparency` | 2 | Falta | 12 |  |
| Columns | `columnCount` | 2 | Falta | 12 |  |
| Inner column padding | `columnPaddingInner` | 2 | Falta | 12 |  |
| Outer column padding | `columnPaddingOuter` | 2 | Falta | 12 |  |
| Color | `gridLineColor` | 2 | Falta | 12 |  |
| Show | `gridLineShow` | 2 | Falta | 12 |  |
| Line style | `gridLineStyle` | 2 | Falta | 12 |  |
| Transparency | `gridLineTransparency` | 2 | Falta | 12 |  |
| Gridlines | `gridLineType` | 2 | Falta | 12 |  |
| Width | `gridLineWidth` | 2 | Falta | 12 |  |
| Grid padding | `gridPadding` | 2 | Falta | 12 |  |
| Grid layout | `layoutType` | 2 | Falta | 12 |  |
| Rows | `rowCount` | 2 | Falta | 12 |  |
| Inner row padding | `rowPaddingInner` | 2 | Falta | 12 |  |
| Outer row padding | `rowPaddingOuter` | 2 | Falta | 12 |  |

### Tooltip de iconos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Page | `section` | 2 | Falta | 23 | Requiere páginas tooltip (fase 9) |
| Type | `type` | 2 | Falta | 23 | Requiere páginas tooltip (fase 9) |

### Tooltips

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Drill text and icon color | `actionFontColor` | 2 | Falta | 23 | Sin acciones de obtener detalles en el tooltip |
| Page | `section` | 2 | Falta | 23 | Requiere páginas tooltip (fase 9) |
| Actions | `showActionsInTooltips` | 2 | Falta | 23 | Sin acciones de obtener detalles en el tooltip |
| Chart-specific tooltips | `showChartSpecificTooltips` | 2 | Falta | 23 | Requiere campos de tooltip (fase 8) |
| Tooltip fields only | `showTooltipFieldsOnly` | 2 | Falta | 23 | Requiere campos de tooltip (fase 8) |
| Type | `type` | 2 | Falta | 23 | Requiere páginas tooltip (fase 9) |

## Fase 11: Mapas

### Acción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bookmark | `bookmark` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Data function | `dataFunction` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Disabled tooltip | `disabledTooltip` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Destination | `drillthroughSection` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Enabled tooltip | `enabledTooltip` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Destination | `navigationSection` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show tooltips | `showDefaultTooltip` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| No tooltips | `suppressDefaultTooltip` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tooltip | `tooltip` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Placeholder for tooltip | `tooltipPlaceholderText` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Type | `type` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Web URL | `webUrl` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Bloquear proporción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Borde

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Radius | `radius` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `width` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Colores / barras

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Default color | `defaultColor` | 1 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Default color | `fill` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color saturation | `fillRule` | 1 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show all | `showAllDataPoints` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |

### Control deslizante de zoom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Auto zoom | `autoZoom` | 2 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Manual zoom | `manualZoom` | 2 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Zoom on selection | `selectionZoom` | 2 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### Divisor

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Ignore padding | `ignorePadding` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Line style | `style` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `width` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Espaciado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Customize spacing | `customizeSpacing` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space above divider | `spaceAboveDivider` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space above plot area | `spaceAbovePlotArea` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space above subtitle | `spaceAboveSubtitle` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space below subtitle | `spaceBelowSubTitle` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space below title | `spaceBelowTitle` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space below title area | `spaceBelowTitleArea` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Space between label and value | `verticalSpacing` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Etiqueta de categoría

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `backgroundTransparency` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `color` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show background | `enableBackground` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |

### Etiquetas de datos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Display units | `labelDisplayUnits` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Value decimal places | `labelPrecision` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |

### Fondo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Iconos de cabecera

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border | `border` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Icon color | `foreground` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Comment button | `showCommentButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Copilot summary | `showCopilotSummaryButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Copy icon | `showCopyVisualImageButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Expand to next level icon | `showDrillDownExpandButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show next level icon | `showDrillDownLevelButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Drill on dropdown | `showDrillRoleSelector` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Drill down icon | `showDrillToggleButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Drill up icon | `showDrillUpButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Filter icon | `showFilterRestatementButton` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Focus mode icon | `showFocusModeButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Follow visual button | `showFollowVisualButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| More options icon | `showOptionsMenu` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Personalize visual | `showPersonalizeVisualButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Pin icon | `showPinButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| See data layout icon | `showSeeDataLayoutToggleButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Set alert button | `showSetAlertButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Smart narrative | `showSmartNarrativeButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Visual header tooltip icon | `showTooltipButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Visual error icon | `showVisualErrorButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Visual information icon | `showVisualInformationButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Visual warning icon | `showVisualWarningButton` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Leyenda

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `labelColor` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Position | `position` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Title | `showTitle` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Legend Name | `titleText` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Propiedades

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| High density sampling | `allowBinnedLineSample` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| High density sampling | `allowOverlappingPointsSample` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Alt text | `altText` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| formatString | `formatString` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Height | `height` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maintain layer order | `keepLayerOrder` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `width` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| X Position | `x` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Y Position | `y` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Relleno

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bottom padding | `bottom` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Left padding | `left` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Right padding | `right` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Top padding | `top` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Sombra

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `color` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Shadow position | `position` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Preset | `preset` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Blur | `shadowBlur` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Distance | `shadowDistance` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Size | `shadowSpread` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Subtítulo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font color | `fontColor` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Title heading | `heading` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Title text | `text` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Word wrap | `titleWrap` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Tooltip de iconos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Page | `section` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tooltip text | `text` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Background color | `themedBackground` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `themedTitleFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `titleFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Type | `type` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Tooltips

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Drill text and icon color | `actionFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Background color | `background` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Page | `section` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Sentence template | `sentenceTemplate` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Actions | `showActionsInTooltips` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Chart-specific tooltips | `showChartSpecificTooltips` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Sentence format only | `showSentenceFormat` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tooltip fields only | `showTooltipFieldsOnly` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold values | `showValuesInBold` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Background color | `themedBackground` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Label text color | `themedTitleFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Value text color | `themedValueFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Label text color | `titleFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Type | `type` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Value text color | `valueFontColor` | 2 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### Título

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Background color | `background` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font color | `fontColor` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Title heading | `heading` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Title text | `text` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Word wrap | `titleWrap` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 1 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### actionButtonSection

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `backgroundShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `backgroundTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bold | `bold` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `borderColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `borderShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `borderTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `borderWidth` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Icon only | `displayIconOnly` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `fillColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `fillShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `fillTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Font family | `fontFamily` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `fontSize` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Blur | `glowBlur` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `glowColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Shadow position | `glowOffset` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Position | `glowPosition` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `glowShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `glowTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `iconColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Customize padding | `iconIndividualPadding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Padding | `iconPadding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bottom padding | `iconPaddingBottom` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Left padding | `iconPaddingLeft` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Right padding | `iconPaddingRight` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Top padding | `iconPaddingTop` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `iconShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Icon size | `iconSize` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `iconTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Customize padding | `individualPadding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Italic | `italic` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Match tile background | `matchTileBackground` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Padding | `padding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bottom padding | `paddingBottom` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Left padding | `paddingLeft` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Right padding | `paddingRight` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Top padding | `paddingTop` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Position | `position` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `positionShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Blur | `shadowBlur` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `shadowColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Shadow position | `shadowOffset` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Position | `shadowPosition` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `shadowShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `shadowTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text | `text` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text color | `textColor` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Horizontal alignment | `textHorizontalAlignment` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Customize padding | `textIndividualPadding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Padding | `textPadding` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Bottom padding | `textPaddingBottom` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Left padding | `textPaddingLeft` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Right padding | `textPaddingRight` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Top padding | `textPaddingTop` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `textShow` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `textTransparency` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Vertical alignment | `textVerticalAlignment` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |
| Underline | `underline` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### barChart

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Height | `barHeight` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Style | `barShape` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Fill color | `defaultColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Height by value | `heightByValue` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Height | `heightMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Height | `heightPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Height unit | `heightUnit` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Layer position | `layerPosition` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `mapTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum | `maxDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 3D column layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum height | `maximumHeightMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum height | `maximumHeightPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum thickness | `maximumWidthMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum thickness | `maximumWidthPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum | `minDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 3D column layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum height | `minimumHeightMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum height | `minimumHeightPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum thickness | `minimumWidthMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum thickness | `minimumWidthPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Scale height on zoom | `scaleHeightOnZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Scale width on zoom | `scaleThicknessOnZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `showModern` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `thickness` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width by value | `widthByValue` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `widthMeters` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `widthPixels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width unit | `widthUnit` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### bubbleLayer

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| High contrast | `autoStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Blur | `blur` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `borderShow` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Size | `bubbleRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `bubbleStrokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| High contrast | `clusteredBubbleAutoStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `clusteredBubbleBorderShow` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Cluster color | `clusteredBubbleFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text color | `clusteredBubbleFontColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Text size | `clusteredBubbleFontSize` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Match fill color | `clusteredBubbleMatchFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Cluster size | `clusteredBubbleRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `clusteredBubbleStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `clusteredBubbleStrokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `clusteredBubbleStrokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `clusteredBubbleTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Cluster bubbles | `clusteringEnabled` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `fillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Icon | `iconId` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Upload a file | `imageData` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Image type | `imageSourceType` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Enter a URL | `imageUrl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Layer position | `layerPosition` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Log Scale | `logScale` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `mapTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Range scaling | `markerRangeType` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Rotation | `markerRotation` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Marker type | `markerType` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Match fill color | `matchFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum | `maxDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Max size | `maxRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum | `maxScale` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Markers layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Min size | `minBubbleRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum | `minDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum | `minScale` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Markers layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Pitch alignment | `pitchAlignment` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Size scaling method | `radiusScalingMethod` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Rotation alignment | `rotationAlignment` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Scale | `scale` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Size by value | `sizeByValue` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `strokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `strokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| X1 | `x1` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| X2 | `x2` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Y1 | `y1` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Y2 | `y2` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Zoom scale | `zoomScaleFactor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### bubbles

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Size | `bubbleSize` | 1 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Range scaling | `markerRangeType` | 1 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### commonDataOptions

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Maximum | `maxDataValue` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum | `minDataValue` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show negatives | `showNegatives` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show zeros | `showZeros` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Unselected data transparency | `unselectedTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### defaultColors

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Border color | `borderColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border thickness | `borderThickness` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `defaultColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `defaultShow` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### filledMap

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| High contrast | `autoStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `borderShow` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Fill color | `defaultColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Layer position | `layerPosition` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Fill transparency | `mapTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Match fill color | `matchFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Filled map layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Filed map layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `strokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `strokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `strokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### heatMap

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| 0% gradient stop | `color0` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 100% gradient stop | `color100` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 50% gradient stop | `color50` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Radius | `filterRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `transparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Units | `unit` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### heatMapLayer

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| 50% gradient stop | `heatMapColorCenter` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 100% gradient stop | `heatMapColorHigh` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| 0% gradient stop | `heatMapColorLow` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Intensity | `heatMapIntensity` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Radius | `heatMapRadius` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Radius units | `heatMapRadiusUnit` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Intensity by value | `heatMapUseSize` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Layer position | `layerPosition` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `mapTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Maximum | `maxDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Heat map layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Minimum | `minDataScalingRange` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Heat map layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### mapControls

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Auto zoom | `autoZoom` | 3 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Include reference layer | `autoZoomIncludesReferenceLayer` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| centerLatitude | `centerLatitude` | 3 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| centerLongitude | `centerLongitude` | 3 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Default style | `defaultStyle` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Geocoding culture | `geocodingCulture` | 3 | Por decidir | 3 | Comparar con deck.gl y country_map: otro modelo de capas |
| Orientation | `heading` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Max zoom level | `maxZoom` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Min zoom level | `minZoom` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Pitch | `pitch` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| County boundary | `showAdminDistrict2Borders` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| State/Province boundary | `showAdminDistrictBorders` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Buildings | `showBuildingFootprints` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Country/Region boundary | `showCountryRegionBorders` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Labels | `showLabels` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Lasso button | `showLassoButton` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Navigation | `showNavigationControls` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Road details | `showRoadDetails` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Selection | `showSelectionControl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Style picker | `showStylePicker` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Zoom buttons | `showZoomButtons` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| World wrap | `worldWrap` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Zoom level | `zoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| zoomLevel | `zoomLevel` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |

### mapStyles

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Theme | `mapTheme` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show labels | `showLabels` | 3 | Por decidir | 2 | Comparar con deck.gl y country_map: otro modelo de capas |

### pathLayer

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Path layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Path layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `strokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `strokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### referenceLayer

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Fill color | `bubbleFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border color | `bubbleStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border transparency | `bubbleStrokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border width  | `bubbleStrokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Type | `datasourceType` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `lineStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `lineStrokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `lineStrokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Fill color | `polygonFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border color | `polygonStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border transparency | `polygonStrokeTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border width  | `polygonStrokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Enter a URL | `referenceLayerUrl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Fill color | `unmappedObjectFillColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Border color | `unmappedObjectStrokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Use custom colors | `unmappedObjectUseCustomColors` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `unmappedObjectVisibility` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### shape

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Type | `datasourceType` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Enter a URL | `mapUrl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Projection | `projectionEnum` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### stroke

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Color | `strokeColor` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Width | `strokeWidth` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### stylePreset

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `name` | 3 | Por decidir | 4 | Comparar con deck.gl y country_map: otro modelo de capas |

### tileLayer

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| East boundary | `eastBounds` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| TMS | `isTMS` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Layer position | `layerPosition` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Transparency | `mapTransparency` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tile layer to | `maxZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tile layer from | `minZoom` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| North boundary | `northBounds` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Show | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| South boundary | `southBounds` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tile URL | `tileLayerUrl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tile size | `tileSize` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Tile size | `tileSizeDropdown` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| West boundary | `westBounds` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

### traffic

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Traffic | `show` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Traffic incidents | `showIncidents` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |
| Traffic | `showTrafficControl` | 3 | Por decidir | 1 | Comparar con deck.gl y country_map: otro modelo de capas |

## Fase 12: Resto de P3 y gráficos nuevos

### Acción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bookmark | `bookmark` | 2 | Falta | 2 | No tenemos este gráfico |
| Disabled tooltip | `disabledTooltip` | 2 | Falta | 2 | No tenemos este gráfico |
| Destination | `drillthroughSection` | 2 | Falta | 3 | El detalle necesita el valor de una marca |
| Enabled tooltip | `enabledTooltip` | 2 | Falta | 2 | No tenemos este gráfico |
| Destination | `navigationSection` | 2 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 2 | No tenemos este gráfico |
| Show tooltips | `showDefaultTooltip` | 2 | Falta | 3 | No tenemos este gráfico |
| No tooltips | `suppressDefaultTooltip` | 2 | Falta | 3 | No tenemos este gráfico |
| Tooltip | `tooltip` | 2 | Falta | 2 | No tenemos este gráfico |
| Type | `type` | 2 | Falta | 3 | No tenemos este gráfico |
| Web URL | `webUrl` | 2 | Falta | 2 | No tenemos este gráfico |

### Anomalías

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| BatchEnd | `BatchEnd` | 3 | Falta | 1 |  |
| BatchStart | `BatchStart` | 3 | Falta | 1 |  |
| CategoryValue | `CategoryValue` | 3 | Falta | 1 |  |
| ExpectedHigh | `ExpectedHigh` | 3 | Falta | 1 |  |
| ExpectedLow | `ExpectedLow` | 3 | Falta | 1 |  |
| ExpectedValue | `ExpectedValue` | 3 | Falta | 1 |  |
| Value | `Value` | 3 | Falta | 1 |  |
| Color | `confidenceBandColor` | 3 | Falta | 1 |  |
| Show | `confidenceBandShow` | 3 | Falta | 1 |  |
| Style | `confidenceBandStyle` | 3 | Falta | 1 |  |
| Name | `displayName` | 3 | Falta | 1 |  |
| isAnomalyHighlighted | `isAnomalyHighlighted` | 3 | Falta | 1 |  |
| Color | `markerBorderColor` | 3 | Falta | 1 |  |
| Match line color | `markerBorderColorMatchFill` | 3 | Falta | 1 |  |
| Show | `markerBorderShow` | 3 | Falta | 1 |  |
| Transparency | `markerBorderTransparency` | 3 | Falta | 1 |  |
| Width | `markerBorderWidth` | 3 | Falta | 1 |  |
| Color | `markerColor` | 3 | Falta | 1 |  |
| Rotation | `markerRotation` | 3 | Falta | 1 |  |
| Type | `markerShape` | 3 | Falta | 1 |  |
| Size | `markerShapeSize` | 3 | Falta | 1 |  |
| Show | `markerShow` | 3 | Falta | 1 |  |
| Transparency | `markerTransparency` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### Anotaciones

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| callout | `callout` | 3 | Falta | 1 | No tenemos este gráfico |

### Barras de error

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Border color | `barBorderColor` | 3 | Falta | 10 |  |
| Border size | `barBorderSize` | 3 | Falta | 10 |  |
| Bar color | `barColor` | 3 | Falta | 10 |  |
| Match series color | `barMatchSeriesColor` | 3 | Falta | 10 |  |
| Show | `barShow` | 3 | Falta | 10 |  |
| Width | `barWidth` | 3 | Falta | 10 |  |
| Enabled | `enabled` | 3 | Falta | 10 |  |
| Show background | `labelBackground` | 3 | Falta | 10 |  |
| Background color | `labelBackgroundColor` | 3 | Falta | 10 |  |
| Transparency | `labelBackgroundTransparency` | 3 | Falta | 10 |  |
| Bold | `labelBold` | 3 | Falta | 10 |  |
| Color | `labelColor` | 3 | Falta | 10 |  |
| Font family | `labelFontFamily` | 3 | Falta | 10 |  |
| Text size | `labelFontSize` | 3 | Falta | 10 |  |
| Label format | `labelFormat` | 3 | Falta | 10 |  |
| Italic | `labelItalic` | 3 | Falta | 10 |  |
| Match series color | `labelMatchSeriesColor` | 3 | Falta | 10 |  |
| Show | `labelShow` | 3 | Falta | 10 |  |
| Underline | `labelUnderline` | 3 | Falta | 10 |  |
| Marker shape | `markerShape` | 3 | Falta | 10 |  |
| Show | `markerShow` | 3 | Falta | 10 |  |
| Size | `markerSize` | 3 | Falta | 10 |  |
| Style | `shadeBandStyle` | 3 | Falta | 3 |  |
| Band color | `shadeColor` | 3 | Falta | 3 |  |
| Match series color | `shadeMatchSeriesColor` | 3 | Falta | 3 |  |
| Show | `shadeShow` | 3 | Falta | 3 |  |
| Transparency | `shadeTransparency` | 3 | Falta | 3 |  |
| showMarkerByDefault | `showMarkerByDefault` | 3 | Falta | 3 |  |
| Label format | `tooltipFormat` | 3 | Falta | 10 |  |
| Show in tooltip | `tooltipShow` | 3 | Falta | 10 |  |

### Bloquear proporción

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Falta | 2 | No tenemos este gráfico |

### Borde

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Line style | `style` | 1 | Falta | 1 |  |
| Transparency | `transparency` | 1 | Falta | 1 |  |

### Cintas

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `borderColor` | 3 | Falta | 5 |  |
| Match fill color | `borderColorMatchFill` | 3 | Falta | 5 |  |
| Border | `borderShow` | 3 | Falta | 5 |  |
| Width | `borderSize` | 3 | Falta | 5 |  |
| Transparency | `borderTransparency` | 3 | Falta | 5 |  |
| Color | `fillColor` | 3 | Falta | 5 |  |
| Match series color | `fillMatchColor` | 3 | Falta | 5 |  |
| Transparency | `fillTransparency` | 3 | Falta | 5 |  |
| Show | `show` | 3 | Falta | 5 |  |

### Colores / barras

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `borderColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Match fill color | `borderColorMatchFill` | 1 | Falta | 1 | No tenemos este gráfico |
| Hide inner borders | `borderOutlineOnly` | 1 | Falta | 1 | No tenemos este gráfico |
| Border | `borderShow` | 1 | Falta | 1 | No tenemos este gráfico |
| Width | `borderSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `borderTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Default color | `defaultColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `fill` | 1 | Falta | 1 | No tenemos este gráfico |
| Color saturation | `fillRule` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `fillTransparency` | 1 | Falta | 1 | No tenemos este gráfico |

### Control deslizante de zoom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| categoryMax | `categoryMax` | 2 | Falta | 1 | No tenemos este gráfico |
| categoryMin | `categoryMin` | 2 | Falta | 1 | No tenemos este gráfico |
| categorySize | `categorySize` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 1 | No tenemos este gráfico |
| Slider labels | `showLabels` | 2 | Falta | 1 | No tenemos este gráfico |
| X axis | `showOnCategoryAxis` | 2 | Falta | 1 | No tenemos este gráfico |
| Y axis | `showOnValueAxis` | 2 | Falta | 1 | No tenemos este gráfico |
| Slider tooltips | `showTooltip` | 2 | Falta | 1 | No tenemos este gráfico |
| valueMax | `valueMax` | 2 | Falta | 1 | No tenemos este gráfico |
| valueMin | `valueMin` | 2 | Falta | 1 | No tenemos este gráfico |
| valueSize | `valueSize` | 2 | Falta | 1 | No tenemos este gráfico |

### Cuadrícula

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Line style | `style` | 1 | Falta | 1 |  |
| Transparency | `transparency` | 1 | Falta | 1 |  |
| Width | `width` | 1 | Falta | 1 |  |

### Disposición

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 1 |  |
| Fit to space | `autoGrid` | 1 | Falta | 1 |  |
| Color | `backgroundFillColor` | 1 | Falta | 1 |  |
| backgroundImage | `backgroundImage` | 1 | Falta | 1 |  |
| Blur | `backgroundImageBlur` | 1 | Falta | 1 |  |
| Contrast | `backgroundImageContrast` | 1 | Falta | 1 |  |
| Data | `backgroundImageData` | 1 | Falta | 1 |  |
| Image effects | `backgroundImageEffects` | 1 | Falta | 1 |  |
| Exposure | `backgroundImageExposure` | 1 | Falta | 1 |  |
| Image fit | `backgroundImageFit` | 1 | Falta | 1 |  |
| Image height | `backgroundImageHeight` | 1 | Falta | 1 |  |
| Saturation | `backgroundImageSaturation` | 1 | Falta | 1 |  |
| Add image | `backgroundImageShow` | 1 | Falta | 1 |  |
| Image transparency | `backgroundImageTransparency` | 1 | Falta | 1 |  |
| Image source | `backgroundImageType` | 1 | Falta | 1 |  |
| Image URL | `backgroundImageUrl` | 1 | Falta | 1 |  |
| Show | `backgroundShow` | 1 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 1 | Falta | 1 |  |
| Color | `borderColor` | 1 | Falta | 1 |  |
| Line style | `borderStyle` | 1 | Falta | 1 |  |
| Transparency | `borderTransparency` | 1 | Falta | 1 |  |
| Width | `borderWidth` | 1 | Falta | 1 |  |
| Bottom padding | `bottomOuterMargin` | 1 | Falta | 1 |  |
| Callout size | `calloutSize` | 1 | Falta | 1 |  |
| Space between cards | `cellPadding` | 1 | Falta | 1 |  |
| Collage | `collage` | 1 | Falta | 1 |  |
| Columns | `columnCount` | 1 | Falta | 1 |  |
| Space between columns | `columnPadding` | 1 | Falta | 1 |  |
| Order | `contentOrder` | 1 | Falta | 1 |  |
| Customize lines | `customizeLines` | 1 | Falta | 1 |  |
| Customize spacing | `customizePadding` | 1 | Falta | 1 |  |
| Height | `fixedHeight` | 1 | Falta | 1 |  |
| Width | `fixedWidth` | 1 | Falta | 1 |  |
| Color | `gridlineColor` | 1 | Falta | 1 |  |
| Line style | `gridlineStyle` | 1 | Falta | 1 |  |
| Transparency | `gridlineTransparency` | 1 | Falta | 1 |  |
| Width | `gridlineWidth` | 1 | Falta | 1 |  |
| Left padding | `leftOuterMargin` | 1 | Falta | 1 |  |
| Color | `lineColor` | 1 | Falta | 1 |  |
| Line style | `lineStyle` | 1 | Falta | 1 |  |
| Transparency | `lineTransparency` | 1 | Falta | 1 |  |
| Width | `lineWidth` | 1 | Falta | 1 |  |
| Max cards shown | `maxTiles` | 1 | Falta | 1 |  |
| Arrangement | `orientation` | 1 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 1 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 1 | Falta | 1 |  |
| Rounded corners | `rectangleRoundedCurve` | 1 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 1 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 1 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 1 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 1 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 1 | Falta | 1 |  |
| Space between ribbons and columns | `ribbonGapSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Right padding | `rightOuterMargin` | 1 | Falta | 1 |  |
| Rows | `rowCount` | 1 | Falta | 1 |  |
| Space between rows | `rowPadding` | 1 | Falta | 1 |  |
| Reverse order | `seriesOrderReversed` | 1 | Falta | 1 | No tenemos este gráfico |
| Sort by value | `seriesOrderSorted` | 1 | Falta | 1 | No tenemos este gráfico |
| Fixed size | `showFixedSize` | 1 | Falta | 1 |  |
| Series explosion | `stackedGapExplodes` | 1 | Falta | 1 | El motor de gráficos no separa los segmentos de una pila |
| Space between series | `stackedGapSize` | 1 | Falta | 1 | El motor de gráficos no separa los segmentos de una pila |
| Style | `style` | 1 | Falta | 1 |  |
| Top padding | `topOuterMargin` | 1 | Falta | 1 |  |

### Divisor

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `dividerColor` | 1 | Falta | 1 |  |
| Ignore padding | `dividerIgnorePadding` | 1 | Falta | 1 |  |
| Line style | `dividerLineStyle` | 1 | Falta | 1 |  |
| Transparency | `dividerTransparency` | 1 | Falta | 1 |  |
| Width | `dividerWidth` | 1 | Falta | 1 |  |
| Ignore padding | `ignorePadding` | 1 | Falta | 2 | No tenemos este gráfico |
| Line style | `style` | 1 | Falta | 2 | No tenemos este gráfico |
| Width | `width` | 1 | Falta | 2 | No tenemos este gráfico |

### Eje X / categorías

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `axisStyle` | 1 | Falta | 1 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Type | `axisType` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Maximum | `end` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 1 | El motor de gráficos no escala el trazo con el zoom |
| Color | `gridlineColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Dash array | `gridlineDashArray` | 1 | Falta | 1 | No tenemos este gráfico |
| Dash cap | `gridlineDashCap` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `gridlineShow` | 1 | Falta | 1 | No tenemos este gráfico |
| Line style | `gridlineStyle` | 1 | Falta | 1 | No tenemos este gráfico |
| Width | `gridlineThickness` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `gridlineTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Initial scroll position | `initialScrollPosition` | 1 | Falta | 1 | No tenemos este gráfico |
| Space between categories | `innerPadding` | 1 | Falta | 1 | No tenemos este gráfico |
| Invert range | `invertAxis` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `labelColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 | No tenemos este gráfico |
| Logarithmic scale | `logAxisScale` | 1 | Falta | 1 | No tenemos este gráfico |
| Maximum size | `maxMarginFactor` | 1 | Falta | 1 | No tenemos este gráfico |
| Outer padding | `outerPadding` | 1 | Falta | 1 | El motor de gráficos no tiene relleno exterior de categorías |
| Minimum category width | `preferredCategoryWidth` | 1 | Falta | 1 | No tenemos este gráfico |
| Round range | `roundRange` | 1 | Falta | 1 | El motor de gráficos redondea el eje salvo con límites fijos |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Title | `showAxisTitle` | 1 | Falta | 1 | No tenemos este gráfico |
| Minimum | `start` | 1 | Falta | 1 | No tenemos este gráfico |
| Switch axis position | `switchAxisPosition` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `titleBold` | 1 | Falta | 1 | No tenemos este gráfico |
| Title color | `titleColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `titleFontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Title text size | `titleFontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `titleItalic` | 1 | Falta | 1 | No tenemos este gráfico |
| Axis title | `titleText` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `titleUnderline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |

### Eje Y / valores

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Style | `axisStyle` | 1 | Falta | 1 | El eje muestra sus valores y su título, sin elegir entre ellos |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Maximum | `end` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Scale by width | `gridlineAutoScale` | 1 | Falta | 1 | El motor de gráficos no escala el trazo con el zoom |
| Color | `gridlineColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Dash array | `gridlineDashArray` | 1 | Falta | 1 | No tenemos este gráfico |
| Dash cap | `gridlineDashCap` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `gridlineShow` | 1 | Falta | 1 | No tenemos este gráfico |
| Line style | `gridlineStyle` | 1 | Falta | 1 | No tenemos este gráfico |
| Width | `gridlineThickness` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `gridlineTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Invert range | `invertAxis` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `labelColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 | No tenemos este gráfico |
| Logarithmic scale | `logAxisScale` | 1 | Falta | 1 | No tenemos este gráfico |
| Round range | `roundRange` | 1 | Falta | 1 | El motor de gráficos redondea el eje salvo con límites fijos |
| Scale to fit | `scaleToFit` | 1 | Falta | 1 | No tenemos este gráfico |
| Shared y-axis | `sharedAxis` | 1 | Falta | 1 | Cada consulta elige eje en sus datos |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Title | `showAxisTitle` | 1 | Falta | 1 | No tenemos este gráfico |
| Minimum | `start` | 1 | Falta | 1 | No tenemos este gráfico |
| Switch axis position | `switchAxisPosition` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `titleBold` | 1 | Falta | 1 | No tenemos este gráfico |
| Title color | `titleColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `titleFontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Title text size | `titleFontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `titleItalic` | 1 | Falta | 1 | No tenemos este gráfico |
| Axis title | `titleText` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `titleUnderline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |

### Encabezado de múltiplos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 3 | Falta | 1 | No tenemos este gráfico |
| Bold | `bold` | 3 | Falta | 1 | No tenemos este gráfico |
| Font color | `fontColor` | 3 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 3 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 3 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 3 | Falta | 1 | No tenemos este gráfico |
| Position | `position` | 3 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 3 | Falta | 1 | No tenemos este gráfico |
| Word wrap | `titleWrap` | 3 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 3 | Falta | 1 | No tenemos este gráfico |

### Espaciado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Customize spacing | `customizeSpacing` | 2 | Falta | 2 | No tenemos este gráfico |
| Space above divider | `spaceAboveDivider` | 2 | Falta | 2 | No tenemos este gráfico |
| Space above plot area | `spaceAbovePlotArea` | 2 | Falta | 2 | No tenemos este gráfico |
| Space above subtitle | `spaceAboveSubtitle` | 2 | Falta | 2 | No tenemos este gráfico |
| Space below subtitle | `spaceBelowSubTitle` | 2 | Falta | 2 | No tenemos este gráfico |
| Space below title | `spaceBelowTitle` | 2 | Falta | 2 | No tenemos este gráfico |
| Space below title area | `spaceBelowTitleArea` | 2 | Falta | 2 | No tenemos este gráfico |
| Space between label and value | `verticalSpacing` | 2 | Falta | 2 | No tenemos este gráfico |

### Etiqueta de categoría

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `color` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 1 | No tenemos este gráfico |

### Etiquetas de datos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `backgroundTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `color` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `detailBold` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `detailColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Content | `detailContentType` | 1 | Falta | 1 | No tenemos este gráfico |
| Format code | `detailCustomFormatString` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Font family | `detailFontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `detailFontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| detailFormatString | `detailFormatString` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Italic | `detailItalic` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `detailLabelDisplayUnits` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Value decimal places | `detailLabelPrecision` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Show blank as | `detailShowBlankAs` | 1 | Falta | 1 | Una marca sin valor no tiene etiqueta |
| Transparency | `detailTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `detailUnderline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |
| Show background | `enableBackground` | 1 | Falta | 1 | No tenemos este gráfico |
| enableDetailDataLabel | `enableDetailDataLabel` | 1 | Falta | 1 | No tenemos este gráfico |
| enableTitleDataLabel | `enableTitleDataLabel` | 1 | Falta | 1 | No tenemos este gráfico |
| enableValueDataLabel | `enableValueDataLabel` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Maximum width | `labelContainerMaxWidth` | 1 | Falta | 1 | No tenemos este gráfico |
| Layout | `labelContentLayout` | 1 | Falta | 1 | No tenemos este gráfico |
| Label density | `labelDensity` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 | No tenemos este gráfico |
| Orientation | `labelOrientation` | 1 | Falta | 1 | No tenemos este gráfico |
| Overflow text | `labelOverflow` | 1 | Falta | 1 | No tenemos este gráfico |
| Position | `labelPosition` | 1 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 | No tenemos este gráfico |
| Optimize label display | `optimizeLabelDisplay` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Customize series | `showAll` | 1 | Falta | 1 | No tenemos este gráfico |
| Show blank as | `showBlankAs` | 1 | Falta | 1 | Una marca sin valor no tiene etiqueta |
| showByDefault | `showByDefault` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `showSeries` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `titleBold` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `titleColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Content | `titleContentType` | 1 | Falta | 1 | No tenemos este gráfico |
| Format code | `titleCustomFormatString` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Font family | `titleFontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `titleFontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| titleFormatString | `titleFormatString` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Italic | `titleItalic` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `titleLabelDisplayUnits` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Value decimal places | `titleLabelPrecision` | 1 | Falta | 1 | El título y el detalle son texto, no otra medida |
| Show blank as | `titleShowBlankAs` | 1 | Falta | 1 | Una marca sin valor no tiene etiqueta |
| Transparency | `titleTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `titleUnderline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |
| Transparency | `transparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |
| Format code | `valueCustomFormatString` | 1 | Falta | 1 | No tenemos este gráfico |
| valueFormatString | `valueFormatString` | 1 | Falta | 1 | No tenemos este gráfico |
| Word wrap | `wordWrap` | 1 | Falta | 1 | No tenemos este gráfico |

### Etiquetas de total

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Transparency | `backgroundTransparency` | 1 | Falta | 1 | No tenemos este gráfico |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `color` | 1 | Falta | 1 | No tenemos este gráfico |
| Show background | `enableBackground` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Split positive and negative | `showPositiveAndNegative` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |

### Fondo del área de trazado

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `color` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `colorTransparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Image fit | `fit` | 2 | Falta | 1 | No tenemos este gráfico |
| image | `image` | 2 | Falta | 1 | No tenemos este gráfico |
| Data | `imageData` | 2 | Falta | 1 | No tenemos este gráfico |
| Image source | `sourceType` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 1 | El motor de gráficos no atenúa una imagen de fondo |
| Image URL | `url` | 2 | Falta | 1 | No tenemos este gráfico |

### Iconos de cabecera

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 1 | Falta | 2 | No tenemos este gráfico |
| Border | `border` | 1 | Falta | 2 | No tenemos este gráfico |
| Icon color | `foreground` | 1 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 1 | Parcial | 2 | Formato > Iconos de cabecera |
| Copy icon | `showCopyVisualImageButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Filter icon | `showFilterRestatementButton` | 1 | Parcial | 2 | Formato > Iconos de cabecera |
| Focus mode icon | `showFocusModeButton` | 3 | Falta | 2 | No tenemos este gráfico |
| More options icon | `showOptionsMenu` | 1 | Parcial | 2 | Formato > Iconos de cabecera |
| See data layout icon | `showSeeDataLayoutToggleButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Visual header tooltip icon | `showTooltipButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Visual error icon | `showVisualErrorButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Visual information icon | `showVisualInformationButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Visual warning icon | `showVisualWarningButton` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `transparency` | 1 | Falta | 2 | No tenemos este gráfico |

### Leyenda

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 1 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 1 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 1 | No tenemos este gráfico |
| Color | `labelColor` | 1 | Falta | 1 | No tenemos este gráfico |
| Position | `position` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 1 | Falta | 1 | No tenemos este gráfico |
| Show | `showGradientLegend` | 1 | Falta | 1 | Sin leyenda para la escala de color |
| Title | `showTitle` | 1 | Falta | 1 | No tenemos este gráfico |
| Legend Name | `titleText` | 1 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 1 | El motor de gráficos no dibuja texto subrayado |

### Línea de referencia X

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash array | `dashArray` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash cap | `dashCap` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `dataLabelColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `dataLabelDecimalPoints` | 2 | Falta | 1 | No tenemos este gráfico |
| Display units | `dataLabelDisplayUnits` | 2 | Falta | 1 | No tenemos este gráfico |
| Horizontal position | `dataLabelHorizontalPosition` | 2 | Falta | 1 | No tenemos este gráfico |
| Data label | `dataLabelShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Text | `dataLabelText` | 2 | Falta | 1 | No tenemos este gráfico |
| Vertical position | `dataLabelVerticalPosition` | 2 | Falta | 1 | No tenemos este gráfico |
| Name | `displayName` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `lineColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Position | `position` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade color | `shadeColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Match line color | `shadeColorMatchStroke` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade region | `shadeRegion` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `shadeShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade transparency | `shadeTransparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 1 | No tenemos este gráfico |
| Line style | `style` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Value | `value` | 2 | Falta | 1 | No tenemos este gráfico |
| Width | `width` | 2 | Falta | 1 | No tenemos este gráfico |

### Línea de referencia Y

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash array | `dashArray` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash cap | `dashCap` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `dataLabelColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Value decimal places | `dataLabelDecimalPoints` | 2 | Falta | 1 | No tenemos este gráfico |
| Display units | `dataLabelDisplayUnits` | 2 | Falta | 1 | No tenemos este gráfico |
| Horizontal position | `dataLabelHorizontalPosition` | 2 | Falta | 1 | No tenemos este gráfico |
| Data label | `dataLabelShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Text | `dataLabelText` | 2 | Falta | 1 | No tenemos este gráfico |
| Vertical position | `dataLabelVerticalPosition` | 2 | Falta | 1 | No tenemos este gráfico |
| Name | `displayName` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `lineColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Position | `position` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade color | `shadeColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Match line color | `shadeColorMatchStroke` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade region | `shadeRegion` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `shadeShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Shade transparency | `shadeTransparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 1 | No tenemos este gráfico |
| Line style | `style` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Value | `value` | 2 | Falta | 1 | No tenemos este gráfico |
| Width | `width` | 2 | Falta | 1 | No tenemos este gráfico |

### Línea de tendencia

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 1 | No tenemos este gráfico |
| Combine series | `combineSeries` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash array | `dashArray` | 2 | Falta | 1 | No tenemos este gráfico |
| Dash cap | `dashCap` | 2 | Falta | 1 | No tenemos este gráfico |
| Name | `displayName` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `lineColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 1 | No tenemos este gráfico |
| Line style | `style` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Use highlight values | `useHighlightValues` | 2 | Falta | 1 | No tenemos este gráfico |
| Width | `width` | 2 | Falta | 1 | No tenemos este gráfico |

### Múltiplos pequeños

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Advanced padding options | `advancedPaddingOptions` | 2 | Falta | 1 | No tenemos este gráfico |
| Fit to space | `autoGrid` | 2 | Falta | 1 |  |
| Background color | `backgroundColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Background transparency | `backgroundTransparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Space between cards | `cellPadding` | 2 | Falta | 1 |  |
| Columns | `columnCount` | 2 | Falta | 2 | No tenemos este gráfico |
| Space between columns | `columnPadding` | 2 | Falta | 1 |  |
| Inner column padding | `columnPaddingInner` | 2 | Falta | 1 | No tenemos este gráfico |
| Outer column padding | `columnPaddingOuter` | 2 | Falta | 1 | No tenemos este gráfico |
| Concatenate labels | `concatenateCategories` | 2 | Falta | 1 |  |
| Customize spacing | `customizePadding` | 2 | Falta | 1 |  |
| Fit to space | `fixNumberOfTiles` | 2 | Falta | 1 |  |
| Color | `gridLineColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Show | `gridLineShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Line style | `gridLineStyle` | 2 | Falta | 1 | No tenemos este gráfico |
| Transparency | `gridLineTransparency` | 2 | Falta | 1 | No tenemos este gráfico |
| Gridlines | `gridLineType` | 2 | Falta | 1 | No tenemos este gráfico |
| Width | `gridLineWidth` | 2 | Falta | 1 | No tenemos este gráfico |
| Grid padding | `gridPadding` | 2 | Falta | 1 | No tenemos este gráfico |
| Position | `headerPosition` | 2 | Falta | 1 |  |
| Grid layout | `layoutType` | 2 | Falta | 1 | No tenemos este gráfico |
| Maximum header size | `maxHeaderSize` | 2 | Falta | 1 |  |
| Rows | `maxSmallMultiples` | 2 | Falta | 1 |  |
| Arrangement | `orientation` | 2 | Falta | 1 |  |
| Rows | `rowCount` | 2 | Falta | 2 | No tenemos este gráfico |
| Space between rows | `rowPadding` | 2 | Falta | 1 |  |
| Inner row padding | `rowPaddingInner` | 2 | Falta | 1 | No tenemos este gráfico |
| Outer row padding | `rowPaddingOuter` | 2 | Falta | 1 | No tenemos este gráfico |
| Style | `style` | 2 | Falta | 1 |  |
| Orientation | `titleOrientation` | 2 | Falta | 1 |  |

### Pronóstico

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Scale by width | `autoScale` | 2 | Falta | 1 |  |
| Color | `bandAreaColor` | 2 | Falta | 1 |  |
| Match line color | `bandAreaMatchColor` | 2 | Falta | 1 |  |
| Show | `bandAreaShow` | 2 | Falta | 1 |  |
| Transparency | `bandAreaTransparency` | 2 | Falta | 1 |  |
| Scale by width | `bandLineAutoScale` | 2 | Falta | 1 |  |
| Color | `bandLineColor` | 2 | Falta | 1 |  |
| Dash array | `bandLineDashArray` | 2 | Falta | 1 |  |
| Dash cap | `bandLineDashCap` | 2 | Falta | 1 |  |
| Match line color | `bandLineMatchColor` | 2 | Falta | 1 |  |
| Line style | `bandLinePattern` | 2 | Falta | 1 |  |
| Show | `bandLineShow` | 2 | Falta | 1 |  |
| Transparency | `bandLineTransparency` | 2 | Falta | 1 |  |
| Width | `bandLineWidth` | 2 | Falta | 1 |  |
| Dash array | `dashArray` | 2 | Falta | 1 |  |
| Dash cap | `dashCap` | 2 | Falta | 1 |  |
| Name | `displayName` | 2 | Falta | 1 |  |
| Interpolation type | `interpolation` | 2 | Falta | 1 |  |
| Smooth type | `interpolationSmooth` | 2 | Falta | 1 |  |
| Tension | `interpolationSmoothParam` | 2 | Falta | 1 |  |
| Step position | `interpolationStep` | 2 | Falta | 1 |  |
| Color | `lineColor` | 2 | Falta | 1 |  |
| Match series interpolation | `matchSeriesInterpolation` | 2 | Falta | 1 |  |
| Show | `show` | 2 | Parcial | 1 | Pronóstico sin formato (forecastEnabled) |
| Transparency | `strokeTransparency` | 2 | Falta | 1 |  |
| Line style | `style` | 2 | Falta | 1 |  |
| Width | `width` | 2 | Falta | 1 |  |

### Propiedades

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| High density sampling | `allowBinnedLineSample` | 3 | Falta | 2 | No tenemos este gráfico |
| High density sampling | `allowOverlappingPointsSample` | 3 | Falta | 2 | No tenemos este gráfico |
| applyFormattingNullSelectorDefaults | `applyFormattingNullSelectorDefaults` | 1 | Falta | 1 |  |
| formatString | `formatString` | 1 | Falta | 3 | No tenemos este gráfico |
| Maintain layer order | `keepLayerOrder` | 3 | Falta | 2 | No tenemos este gráfico |

### Relleno

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bottom padding | `bottom` | 1 | Parcial | 2 | Solo un valor para los cuatro lados |
| Bottom margin | `bottomMargin` | 1 | Falta | 1 |  |
| Left padding | `left` | 1 | Parcial | 2 | Solo un valor para los cuatro lados |
| Left margin | `leftMargin` | 1 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 1 | Falta | 1 |  |
| Size | `paddingSelection` | 1 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 1 | Falta | 1 |  |
| Right padding | `right` | 1 | Parcial | 2 | Solo un valor para los cuatro lados |
| Right margin | `rightMargin` | 1 | Falta | 1 |  |
| Top padding | `top` | 1 | Parcial | 2 | Solo un valor para los cuatro lados |
| Top margin | `topMargin` | 1 | Falta | 1 |  |

### Sombra

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 1 | Falta | 2 | No tenemos este gráfico |
| Color | `color` | 1 | Falta | 2 | No tenemos este gráfico |
| Shadow position | `position` | 1 | Falta | 2 | No tenemos este gráfico |
| Preset | `preset` | 1 | Parcial | 2 | Solo niveles de sombra |
| Blur | `shadowBlur` | 1 | Falta | 2 | No tenemos este gráfico |
| Distance | `shadowDistance` | 1 | Falta | 2 | No tenemos este gráfico |
| Size | `shadowSpread` | 1 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 1 | Parcial | 2 | Solo niveles de sombra |
| Transparency | `transparency` | 1 | Falta | 2 | No tenemos este gráfico |

### Subtítulo

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alignment | `alignment` | 1 | Falta | 2 | No tenemos este gráfico |
| Bold | `bold` | 1 | Falta | 2 | No tenemos este gráfico |
| Font color | `fontColor` | 1 | Parcial | 2 | Formato > Título; sin interruptor propio |
| Font family | `fontFamily` | 1 | Falta | 2 | No tenemos este gráfico |
| Text size | `fontSize` | 1 | Parcial | 2 | Formato > Título; sin interruptor propio |
| Title heading | `heading` | 1 | Falta | 2 | No tenemos este gráfico |
| Italic | `italic` | 1 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 1 | Parcial | 2 | Formato > Título; sin interruptor propio |
| Title text | `text` | 1 | Parcial | 2 | Formato > Título; sin interruptor propio |
| Word wrap | `titleWrap` | 1 | Falta | 2 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 2 | No tenemos este gráfico |

### Tooltip de iconos

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Background color | `background` | 2 | Falta | 2 | No tenemos este gráfico |
| Bold | `bold` | 2 | Falta | 2 | No tenemos este gráfico |
| Font family | `fontFamily` | 2 | Falta | 2 | No tenemos este gráfico |
| Text size | `fontSize` | 2 | Falta | 2 | No tenemos este gráfico |
| Italic | `italic` | 2 | Falta | 2 | No tenemos este gráfico |
| Page | `section` | 2 | Falta | 3 | Requiere páginas tooltip (fase 9) |
| Tooltip text | `text` | 2 | Falta | 2 | No tenemos este gráfico |
| Background color | `themedBackground` | 2 | Falta | 2 | No tenemos este gráfico |
| Color | `themedTitleFontColor` | 2 | Falta | 2 | No tenemos este gráfico |
| Color | `titleFontColor` | 2 | Falta | 2 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 2 | No tenemos este gráfico |
| Type | `type` | 2 | Falta | 3 | Requiere páginas tooltip (fase 9) |
| Underline | `underline` | 2 | Falta | 2 | No tenemos este gráfico |

### Tooltips

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Drill text and icon color | `actionFontColor` | 2 | Falta | 3 | Sin acciones de obtener detalles en el tooltip |
| Background color | `background` | 2 | Falta | 2 | No tenemos este gráfico |
| Bold | `bold` | 2 | Falta | 2 | No tenemos este gráfico |
| Font family | `fontFamily` | 2 | Falta | 2 | No tenemos este gráfico |
| Text size | `fontSize` | 2 | Falta | 2 | No tenemos este gráfico |
| Italic | `italic` | 2 | Falta | 2 | No tenemos este gráfico |
| Page | `section` | 2 | Falta | 3 | Requiere páginas tooltip (fase 9) |
| Sentence template | `sentenceTemplate` | 2 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 2 | Falta | 2 | No tenemos este gráfico |
| Actions | `showActionsInTooltips` | 2 | Falta | 3 | Sin acciones de obtener detalles en el tooltip |
| Chart-specific tooltips | `showChartSpecificTooltips` | 2 | Falta | 3 | Requiere campos de tooltip (fase 8) |
| Sentence format only | `showSentenceFormat` | 2 | Falta | 2 | No tenemos este gráfico |
| Tooltip fields only | `showTooltipFieldsOnly` | 2 | Falta | 3 | Requiere campos de tooltip (fase 8) |
| Bold values | `showValuesInBold` | 2 | Falta | 2 | No tenemos este gráfico |
| Background color | `themedBackground` | 2 | Falta | 2 | No tenemos este gráfico |
| Label text color | `themedTitleFontColor` | 2 | Falta | 2 | No tenemos este gráfico |
| Value text color | `themedValueFontColor` | 2 | Falta | 2 | No tenemos este gráfico |
| Label text color | `titleFontColor` | 2 | Falta | 2 | No tenemos este gráfico |
| Transparency | `transparency` | 2 | Falta | 2 | No tenemos este gráfico |
| Type | `type` | 2 | Falta | 3 | Requiere páginas tooltip (fase 9) |
| Underline | `underline` | 2 | Falta | 2 | No tenemos este gráfico |
| Value text color | `valueFontColor` | 2 | Falta | 2 | No tenemos este gráfico |

### Título

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Font family | `fontFamily` | 1 | Falta | 2 | No tenemos este gráfico |
| Title heading | `heading` | 1 | Falta | 2 | No tenemos este gráfico |
| Word wrap | `titleWrap` | 1 | Falta | 2 | No tenemos este gráfico |
| Underline | `underline` | 1 | Falta | 2 | No tenemos este gráfico |

### accentBar

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Width | `width` | 3 | Falta | 1 |  |

### actionButtonSection

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `backgroundShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `backgroundTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Bold | `bold` | 3 | Falta | 2 | No tenemos este gráfico |
| Color | `borderColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `borderShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `borderTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Width | `borderWidth` | 3 | Falta | 2 | No tenemos este gráfico |
| Icon only | `displayIconOnly` | 3 | Falta | 2 | No tenemos este gráfico |
| Color | `fillColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `fillShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `fillTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Font family | `fontFamily` | 3 | Falta | 2 | No tenemos este gráfico |
| Text size | `fontSize` | 3 | Falta | 2 | No tenemos este gráfico |
| Blur | `glowBlur` | 3 | Falta | 2 | No tenemos este gráfico |
| Color | `glowColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Shadow position | `glowOffset` | 3 | Falta | 2 | No tenemos este gráfico |
| Position | `glowPosition` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `glowShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `glowTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Color | `iconColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Customize padding | `iconIndividualPadding` | 3 | Falta | 2 | No tenemos este gráfico |
| Padding | `iconPadding` | 3 | Falta | 2 | No tenemos este gráfico |
| Bottom padding | `iconPaddingBottom` | 3 | Falta | 2 | No tenemos este gráfico |
| Left padding | `iconPaddingLeft` | 3 | Falta | 2 | No tenemos este gráfico |
| Right padding | `iconPaddingRight` | 3 | Falta | 2 | No tenemos este gráfico |
| Top padding | `iconPaddingTop` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `iconShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Icon size | `iconSize` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `iconTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Customize padding | `individualPadding` | 3 | Falta | 2 | No tenemos este gráfico |
| Italic | `italic` | 3 | Falta | 2 | No tenemos este gráfico |
| Match tile background | `matchTileBackground` | 3 | Falta | 2 | No tenemos este gráfico |
| Padding | `padding` | 3 | Falta | 2 | No tenemos este gráfico |
| Bottom padding | `paddingBottom` | 3 | Falta | 2 | No tenemos este gráfico |
| Left padding | `paddingLeft` | 3 | Falta | 2 | No tenemos este gráfico |
| Right padding | `paddingRight` | 3 | Falta | 2 | No tenemos este gráfico |
| Top padding | `paddingTop` | 3 | Falta | 2 | No tenemos este gráfico |
| Position | `position` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `positionShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Blur | `shadowBlur` | 3 | Falta | 2 | No tenemos este gráfico |
| Color | `shadowColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Shadow position | `shadowOffset` | 3 | Falta | 2 | No tenemos este gráfico |
| Position | `shadowPosition` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `shadowShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `shadowTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `show` | 3 | Falta | 2 | No tenemos este gráfico |
| Text | `text` | 3 | Falta | 2 | No tenemos este gráfico |
| Text color | `textColor` | 3 | Falta | 2 | No tenemos este gráfico |
| Horizontal alignment | `textHorizontalAlignment` | 3 | Falta | 2 | No tenemos este gráfico |
| Customize padding | `textIndividualPadding` | 3 | Falta | 2 | No tenemos este gráfico |
| Padding | `textPadding` | 3 | Falta | 2 | No tenemos este gráfico |
| Bottom padding | `textPaddingBottom` | 3 | Falta | 2 | No tenemos este gráfico |
| Left padding | `textPaddingLeft` | 3 | Falta | 2 | No tenemos este gráfico |
| Right padding | `textPaddingRight` | 3 | Falta | 2 | No tenemos este gráfico |
| Top padding | `textPaddingTop` | 3 | Falta | 2 | No tenemos este gráfico |
| Show | `textShow` | 3 | Falta | 2 | No tenemos este gráfico |
| Transparency | `textTransparency` | 3 | Falta | 2 | No tenemos este gráfico |
| Vertical alignment | `textVerticalAlignment` | 3 | Falta | 2 | No tenemos este gráfico |
| Underline | `underline` | 3 | Falta | 2 | No tenemos este gráfico |

### card

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bar color | `barColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Show bar | `barShow` | 2 | Falta | 1 | No tenemos este gráfico |
| Bar thickness | `barWeight` | 2 | Falta | 1 | No tenemos este gráfico |
| Background color | `cardBackground` | 2 | Falta | 1 | No tenemos este gráfico |
| Padding | `cardPadding` | 2 | Falta | 1 | No tenemos este gráfico |
| Outline color | `outlineColor` | 2 | Falta | 1 | No tenemos este gráfico |
| Outline | `outlineStyle` | 2 | Falta | 1 | No tenemos este gráfico |
| Outline weight | `outlineWeight` | 2 | Falta | 1 | No tenemos este gráfico |

### cardCalloutArea

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Fill color | `backgroundFillColor` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Corner radius | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |

### cardImage

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Add background | `addBackground` | 3 | Falta | 1 |  |
| Alt text | `altText` | 3 | Falta | 1 |  |
| Fill color | `backgroundFillColor` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| image | `image` | 3 | Falta | 1 |  |
| Blur | `imageBlur` | 3 | Falta | 1 |  |
| Contrast | `imageContrast` | 3 | Falta | 1 |  |
| Data | `imageData` | 3 | Falta | 1 |  |
| Image fit | `imageDataFit` | 3 | Falta | 1 |  |
| Image effects | `imageEffects` | 3 | Falta | 1 |  |
| Exposure | `imageExposure` | 3 | Falta | 1 |  |
| Image height | `imageHeight` | 3 | Falta | 1 |  |
| Saturation | `imageSaturation` | 3 | Falta | 1 |  |
| Image transparency | `imageTransparency` | 3 | Falta | 1 |  |
| Image source | `imageType` | 3 | Falta | 1 |  |
| Image URL | `imageUrl` | 3 | Falta | 1 |  |
| Image fit | `imageUrlFit` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Corner radius | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |

### cardTitle

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `color` | 2 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 2 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 2 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 2 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 2 | Falta | 1 | No tenemos este gráfico |

### dataLabels

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Bold | `bold` | 2 | Falta | 1 | No tenemos este gráfico |
| Color | `color` | 2 | Falta | 1 | No tenemos este gráfico |
| Font family | `fontFamily` | 2 | Falta | 1 | No tenemos este gráfico |
| Text size | `fontSize` | 2 | Falta | 1 | No tenemos este gráfico |
| Italic | `italic` | 2 | Falta | 1 | No tenemos este gráfico |
| Underline | `underline` | 2 | Falta | 1 | No tenemos este gráfico |

### fillCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Fill color | `fillColor` | 3 | Falta | 1 |  |
| image | `image` | 3 | Falta | 1 |  |
| Blur | `imageBlur` | 3 | Falta | 1 |  |
| Contrast | `imageContrast` | 3 | Falta | 1 |  |
| Data | `imageData` | 3 | Falta | 1 |  |
| Image effects | `imageEffects` | 3 | Falta | 1 |  |
| Exposure | `imageExposure` | 3 | Falta | 1 |  |
| Image fit | `imageFit` | 3 | Falta | 1 |  |
| Image height | `imageHeight` | 3 | Falta | 1 |  |
| Saturation | `imageSaturation` | 3 | Falta | 1 |  |
| Add image | `imageShow` | 3 | Falta | 1 |  |
| imageSplitTransparency | `imageSplitTransparency` | 3 | Falta | 1 |  |
| Transparency | `imageTransparency` | 3 | Falta | 1 |  |
| Image source | `imageType` | 3 | Falta | 1 |  |
| Image URL | `imageUrl` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### glowCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 3 | Falta | 1 |  |
| Color | `color` | 3 | Falta | 1 |  |
| Distance | `glowDistance` | 3 | Falta | 1 |  |
| Preset | `glowPositionPreset` | 3 | Falta | 1 |  |
| Size | `glowSpread` | 3 | Falta | 1 |  |
| Offset | `position` | 3 | Falta | 1 |  |
| Blur | `shadowBlur` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### image

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Alt text | `altText` | 3 | Falta | 1 |  |
| Blur | `blur` | 3 | Falta | 1 |  |
| Contrast | `contrast` | 3 | Falta | 1 |  |
| Exposure | `exposure` | 3 | Falta | 1 |  |
| Image fit | `fit` | 3 | Falta | 1 |  |
| Image height | `fixedSize` | 3 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 3 | Falta | 1 |  |
| image | `image` | 3 | Falta | 1 |  |
| Image area size | `imageAreaSize` | 3 | Falta | 1 |  |
| Data | `imageData` | 3 | Falta | 1 |  |
| Image effects | `imageEffects` | 3 | Falta | 1 |  |
| Image type | `imageType` | 3 | Falta | 1 |  |
| Image URL | `imageUrl` | 3 | Falta | 1 |  |
| Space between image and callout | `padding` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Corner radius | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |
| Saturation | `saturation` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Size | `size` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Vertical alignment | `verticalAlignment` | 3 | Falta | 1 |  |

### label

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Align baselines | `alignBaselines` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Heading | `heading` | 1 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 1 |  |
| Match value alignment | `matchValueAlignment` | 1 | Falta | 1 |  |
| Position | `position` | 1 | Falta | 1 |  |
| Text | `text` | 1 | Falta | 1 |  |
| Text wrap | `textWrap` | 1 | Falta | 1 |  |
| Transparency | `transparency` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |

### outline

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Outline color | `lineColor` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Outline weight | `weight` | 3 | Falta | 1 |  |

### overFlow

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Overflow direction | `overFlowDirection` | 3 | Falta | 1 |  |
| Overflow style | `overFlowStyle` | 3 | Falta | 1 |  |

### referenceLabel

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| formatString | `formatString` | 3 | Falta | 1 |  |
| Bottom margin | `paddingBottom` | 3 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 3 | Falta | 1 |  |
| Left margin | `paddingLeft` | 3 | Falta | 1 |  |
| Right margin | `paddingRight` | 3 | Falta | 1 |  |
| Top margin | `paddingTop` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Corner radius | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |
| Add label | `value` | 3 | Falta | 1 |  |

### referenceLabelDetail

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Format code | `customFormatString` | 3 | Falta | 1 |  |
| Color | `detailBackgroundColor` | 3 | Falta | 1 |  |
| Bold | `detailBold` | 3 | Falta | 1 |  |
| Display units | `detailDisplayUnits` | 3 | Falta | 1 |  |
| Font color | `detailFontColor` | 3 | Falta | 1 |  |
| Font family | `detailFontFamily` | 3 | Falta | 1 |  |
| Text size | `detailFontSize` | 3 | Falta | 1 |  |
| Italic | `detailItalic` | 3 | Falta | 1 |  |
| Value decimal places | `detailPrecision` | 3 | Falta | 1 |  |
| Transparency | `detailTransparency` | 3 | Falta | 1 |  |
| Underline | `detailUnderline` | 3 | Falta | 1 |  |
| Field | `detailValue` | 3 | Falta | 1 |  |
| formatString | `formatString` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Show blank as | `showBlankAs` | 3 | Falta | 1 |  |
| Text wrap | `textWrap` | 3 | Falta | 1 |  |

### referenceLabelLayout

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Arrangement | `arrangement` | 3 | Falta | 1 |  |
| Customize outer padding | `customizePadding` | 3 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 3 | Falta | 1 |  |
| Space between labels | `labelSpace` | 3 | Falta | 1 |  |
| Outer padding | `outerPadding` | 3 | Falta | 1 |  |
| Padding after divider line | `paddingAfterDivider` | 3 | Falta | 1 |  |
| Padding before divider line | `paddingBeforeDivider` | 3 | Falta | 1 |  |
| Arrangement | `position` | 3 | Falta | 1 |  |
| Style | `style` | 3 | Falta | 1 |  |
| Value area | `valueArea` | 3 | Falta | 1 |  |
| Vertical alignment | `verticalAlignment` | 3 | Falta | 1 |  |

### referenceLabelTitle

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Show | `show` | 3 | Falta | 1 |  |
| Text wrap | `textWrap` | 3 | Falta | 1 |  |
| Bold | `titleBold` | 3 | Falta | 1 |  |
| Content | `titleContentType` | 3 | Falta | 1 |  |
| Color | `titleFontColor` | 3 | Falta | 1 |  |
| Font family | `titleFontFamily` | 3 | Falta | 1 |  |
| Text size | `titleFontSize` | 3 | Falta | 1 |  |
| Italic | `titleItalic` | 3 | Falta | 1 |  |
| Text | `titleText` | 3 | Falta | 1 |  |
| Transparency | `titleTransparency` | 3 | Falta | 1 |  |
| Underline | `titleUnderline` | 3 | Falta | 1 |  |

### referenceLabelValue

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Format code | `customFormatString` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Show blank as | `showBlankAs` | 3 | Falta | 1 |  |
| Text wrap | `textWrap` | 3 | Falta | 1 |  |
| Display units | `valueDisplayUnits` | 3 | Falta | 1 |  |
| Font family | `valueFontFamily` | 3 | Falta | 1 |  |
| Value decimal places | `valuePrecision` | 3 | Falta | 1 |  |
| Transparency | `valueTransparency` | 3 | Falta | 1 |  |
| Underline | `valueUnderline` | 3 | Falta | 1 |  |

### rotation

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Rotation | `angle` | 3 | Falta | 1 |  |
| Shape rotation | `shapeAngle` | 3 | Falta | 1 |  |
| Text rotation | `textAngle` | 3 | Falta | 1 |  |

### shadowCustom

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Angle | `angle` | 3 | Falta | 1 |  |
| Color | `color` | 3 | Falta | 1 |  |
| Offset | `position` | 3 | Falta | 1 |  |
| Blur | `shadowBlur` | 3 | Falta | 1 |  |
| Distance | `shadowDistance` | 3 | Falta | 1 |  |
| Preset | `shadowPositionPreset` | 3 | Falta | 1 |  |
| Size | `shadowSpread` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |

### shapeCustomRectangle

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Rounded corners | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Customize style | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |
| Size of bottom snips | `tabCutCornerSnipSizeBottom` | 3 | Falta | 1 |  |
| Customize style | `tabCutCornerSnipSizeCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `tabCutCornerSnipSizeLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `tabCutCornerSnipSizeLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `tabCutCornerSnipSizeRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `tabCutCornerSnipSizeRightTop` | 3 | Falta | 1 |  |
| Size of top snips | `tabCutCornerSnipSizeTop` | 3 | Falta | 1 |  |
| Shape | `tileShape` | 3 | Falta | 1 |  |

### smallMultiplesAccentBar

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `color` | 3 | Falta | 1 |  |
| Position | `position` | 3 | Falta | 1 |  |
| Show | `show` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Width | `width` | 3 | Falta | 1 |  |

### smallMultiplesBorder

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `gridlineColor` | 3 | Falta | 1 |  |
| Show | `gridlineShow` | 3 | Falta | 1 |  |
| Line style | `gridlineStyle` | 3 | Falta | 1 |  |
| Transparency | `gridlineTransparency` | 3 | Falta | 1 |  |
| Width | `gridlineWidth` | 3 | Falta | 1 |  |

### smallMultiplesCellBackGround

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundFillColor` | 3 | Falta | 1 |  |
| Image | `backgroundImage` | 3 | Falta | 1 |  |
| Blur | `backgroundImageBlur` | 3 | Falta | 1 |  |
| Contrast | `backgroundImageContrast` | 3 | Falta | 1 |  |
| Data | `backgroundImageData` | 3 | Falta | 1 |  |
| Image fit | `backgroundImageDataFit` | 3 | Falta | 1 |  |
| Image effects | `backgroundImageEffects` | 3 | Falta | 1 |  |
| Exposure | `backgroundImageExposure` | 3 | Falta | 1 |  |
| Image height | `backgroundImageHeight` | 3 | Falta | 1 |  |
| Saturation | `backgroundImageSaturation` | 3 | Falta | 1 |  |
| Add image | `backgroundImageShow` | 3 | Falta | 1 |  |
| Image transparency | `backgroundImageTransparency` | 3 | Falta | 1 |  |
| Image source | `backgroundImageType` | 3 | Falta | 1 |  |
| Image URL | `backgroundImageUrl` | 3 | Falta | 1 |  |
| Image fit | `backgroundImageUrlFit` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |

### smallMultiplesGrid

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `gridlineColor` | 3 | Falta | 1 |  |
| Gridlines | `gridlineRegion` | 3 | Falta | 1 |  |
| Show | `gridlineShow` | 3 | Falta | 1 |  |
| Line style | `gridlineStyle` | 3 | Falta | 1 |  |
| Transparency | `gridlineTransparency` | 3 | Falta | 1 |  |
| Width | `gridlineWidth` | 3 | Falta | 1 |  |

### smallMultiplesHeader

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Color | `backgroundColor` | 3 | Falta | 1 |  |
| Background Image | `backgroundImage` | 3 | Falta | 1 |  |
| Blur | `backgroundImageBlur` | 3 | Falta | 1 |  |
| Contrast | `backgroundImageContrast` | 3 | Falta | 1 |  |
| Data | `backgroundImageData` | 3 | Falta | 1 |  |
| Image effects | `backgroundImageEffects` | 3 | Falta | 1 |  |
| Exposure | `backgroundImageExposure` | 3 | Falta | 1 |  |
| Image fit | `backgroundImageFit` | 3 | Falta | 1 |  |
| Image height | `backgroundImageHeight` | 3 | Falta | 1 |  |
| Saturation | `backgroundImageSaturation` | 3 | Falta | 1 |  |
| Add image | `backgroundImageShow` | 3 | Falta | 1 |  |
| Image transparency | `backgroundImageTransparency` | 3 | Falta | 1 |  |
| Image source | `backgroundImageType` | 3 | Falta | 1 |  |
| Image URL | `backgroundImageUrl` | 3 | Falta | 1 |  |
| Show | `backgroundShow` | 3 | Falta | 1 |  |
| Transparency | `backgroundTransparency` | 3 | Falta | 1 |  |
| Bold | `bold` | 3 | Falta | 1 |  |
| Bottom padding | `bottomMargin` | 3 | Falta | 1 |  |
| Format code | `customFormatString` | 3 | Falta | 1 |  |
| Display units | `displayUnits` | 3 | Falta | 1 |  |
| Color | `fontColor` | 3 | Falta | 1 |  |
| Font family | `fontFamily` | 3 | Falta | 1 |  |
| Text size | `fontSize` | 3 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 3 | Falta | 1 |  |
| Italic | `italic` | 3 | Falta | 1 |  |
| Left padding | `leftMargin` | 3 | Falta | 1 |  |
| Individual padding | `paddingIndividual` | 3 | Falta | 1 |  |
| Uniform padding | `paddingUniform` | 3 | Falta | 1 |  |
| Value decimal places | `precision` | 3 | Falta | 1 |  |
| Right padding | `rightMargin` | 3 | Falta | 1 |  |
| Show blank as | `showBlankAs` | 3 | Falta | 1 |  |
| Text wrap | `textWrap` | 3 | Falta | 1 |  |
| Top padding | `topMargin` | 3 | Falta | 1 |  |
| Transparency | `transparency` | 3 | Falta | 1 |  |
| Underline | `underline` | 3 | Falta | 1 |  |
| Vertical alignment | `verticalAlignment` | 3 | Falta | 1 |  |

### smallMultiplesOuterShape

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Rounded corners | `rectangleRoundedCurve` | 3 | Falta | 1 |  |
| Individual corners | `rectangleRoundedCurveCustomStyle` | 3 | Falta | 1 |  |
| Bottom left corner | `rectangleRoundedCurveLeftBottom` | 3 | Falta | 1 |  |
| Top left corner | `rectangleRoundedCurveLeftTop` | 3 | Falta | 1 |  |
| Bottom right corner | `rectangleRoundedCurveRightBottom` | 3 | Falta | 1 |  |
| Top right corner | `rectangleRoundedCurveRightTop` | 3 | Falta | 1 |  |

### smallMultiplesOverFlow

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Overflow direction | `overFlowDirection` | 3 | Falta | 1 |  |
| Overflow style | `overFlowStyle` | 3 | Falta | 1 |  |

### value

| Opción | Clave | P | Estado | Gráficos | Nota |
| --- | --- | ---: | --- | ---: | --- |
| Format code | `customFormatString` | 1 | Falta | 1 |  |
| Font family | `fontFamily` | 1 | Falta | 1 |  |
| Horizontal alignment | `horizontalAlignment` | 1 | Falta | 1 |  |
| Display units | `labelDisplayUnits` | 1 | Falta | 1 |  |
| Value decimal places | `labelPrecision` | 1 | Falta | 1 |  |
| Show | `show` | 1 | Falta | 1 |  |
| Show blank as | `showBlankAs` | 1 | Falta | 1 |  |
| Text wrap | `textWrap` | 1 | Falta | 1 |  |
| Transparency | `transparency` | 1 | Falta | 1 |  |
| Underline | `underline` | 1 | Falta | 1 |  |
