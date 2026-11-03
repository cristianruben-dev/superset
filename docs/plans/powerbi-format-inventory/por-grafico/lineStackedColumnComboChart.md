# Línea y columnas apiladas (`lineStackedColumnComboChart`)

Nuestro gráfico: mixed. Generado desde `reportThemeSchema-2.159.json`.

## Visual


### Colores / barras (`dataPoint`) · P1 · 11/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `borderColor` | fill | Tiene | Borde de barras (bar_border_color) |
| Match fill color | `borderColorMatchFill` | boolean | Tiene | Colores y series |
| Hide inner borders | `borderOutlineOnly` | boolean | Tiene | Colores y series |
| Border | `borderShow` | boolean | Tiene | Borde de barras (bar_border_width) |
| Width | `borderSize` | number | Tiene | Borde de barras (bar_border_width) |
| Transparency | `borderTransparency` | number | Tiene | Colores y series |
| Default Column Color | `defaultColor` | fill | Tiene | Colores y series |
| Color | `fill` | fill | Tiene | Colores y series |
| Color saturation | `fillRule` | fillRule | Parcial | Reglas y escala de dos colores por el valor de la barra; sin otro campo |
| Transparency | `fillTransparency` | number | Tiene | Colores y series |
| Area transparency | `transparency` | number | Tiene | Colores y series > Líneas |

### Disposición (`layout`) · P1 · 0/3

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Reverse order | `seriesOrderReversed` | boolean | Falta |  |
| Sort by value | `seriesOrderSorted` | boolean | Falta |  |
| Space between series | `stackedGapSize` | number | Falta | El motor de gráficos no separa los segmentos de una pila |

### Eje X / categorías (`categoryAxis`) · P1 · 31/40

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Auto expand | `autoExpand` | boolean | Excluido | No hay jerarquías de exploración |
| Style | `axisStyle` | enum: Show title only, Show unit only, Show both | Falta | El eje muestra sus valores y su título, sin elegir entre ellos |
| Type | `axisType` | enum: Continuous, Categorical | Parcial | Sale del tipo de la columna; se fuerza con «Forzar categórico» |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Concatenate labels | `concatenateLabels` | boolean | Excluido | No hay jerarquías de exploración |
| Maximum | `end` | number/string | Parcial | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Scale by width | `gridlineAutoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Color | `gridlineColor` | fill | Tiene | Eje > Líneas de cuadrícula |
| Dash array | `gridlineDashArray` | string | Tiene | Eje > Líneas de cuadrícula |
| Dash cap | `gridlineDashCap` | enum: Flat, Round, Square | Tiene | Eje > Líneas de cuadrícula |
| Show | `gridlineShow` | boolean | Tiene | Eje > Líneas de cuadrícula |
| Line style | `gridlineStyle` | enum: Solid, Dashed, Dotted, Custom | Tiene | Eje > Líneas de cuadrícula |
| Width | `gridlineThickness` | number | Tiene | Eje > Líneas de cuadrícula |
| Transparency | `gridlineTransparency` | number | Tiene | Eje > Líneas de cuadrícula |
| Initial scroll position | `initialScrollPosition` | enum: Start, End | Tiene | Eje X > Categorías |
| Space between categories | `innerPadding` | integer | Tiene | Espacio entre barras (bar_category_gap) |
| Invert range | `invertAxis` | boolean | Tiene | Invertir eje X (x_axis_inverse) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Color | `labelColor` | fill | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Tiene | Sección del eje |
| Value decimal places | `labelPrecision` | integer | Tiene | Sección del eje |
| Logarithmic scale | `logAxisScale` | boolean | Tiene | Eje X logarítmico, solo en un eje numérico |
| Maximum size | `maxMarginFactor` | integer | Parcial | Ancho máximo de etiqueta en píxeles, no en % del gráfico |
| Outer padding | `outerPadding` | integer | Falta | El motor de gráficos no tiene relleno exterior de categorías |
| Minimum category width | `preferredCategoryWidth` | number | Tiene | Eje X > Categorías |
| Reverse stack order | `reverseStackOrder` | boolean | Falta | Se ordena con el orden de series |
| Round range | `roundRange` | boolean | Falta | El motor de gráficos redondea el eje salvo con límites fijos |
| Show | `show` | boolean | Tiene | Ocultar eje X (x_axis_hidden) |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje X (x_axis_title) |
| Minimum | `start` | number/string | Parcial | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Bold | `titleBold` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título X (x_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título X (x_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título X (x_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje X (x_axis_title) |
| Underline | `titleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Eje Y / valores (`valueAxis`) · P1 · 46/57

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Align zeros | `alignZeros` | boolean | Falta | Los ejes alinean sus marcas, no su cero |
| Style | `axisStyle` | enum: Show title only, Show unit only, Show both | Falta | El eje muestra sus valores y su título, sin elegir entre ellos |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Maximum | `end` | number/string | Tiene | Límites del eje Y (y_axis_bounds) |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Scale by width | `gridlineAutoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Color | `gridlineColor` | fill | Tiene | Eje > Líneas de cuadrícula |
| Dash array | `gridlineDashArray` | string | Tiene | Eje > Líneas de cuadrícula |
| Dash cap | `gridlineDashCap` | enum: Flat, Round, Square | Tiene | Eje > Líneas de cuadrícula |
| Show | `gridlineShow` | boolean | Tiene | Eje > Líneas de cuadrícula |
| Line style | `gridlineStyle` | enum: Solid, Dashed, Dotted, Custom | Tiene | Eje > Líneas de cuadrícula |
| Width | `gridlineThickness` | number | Tiene | Eje > Líneas de cuadrícula |
| Transparency | `gridlineTransparency` | number | Tiene | Eje > Líneas de cuadrícula |
| Invert range | `invertAxis` | boolean | Tiene | Invertir eje Y (y_axis_inverse) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Color | `labelColor` | fill | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Tiene | Sección del eje |
| Value decimal places | `labelPrecision` | integer | Tiene | Sección del eje |
| Logarithmic scale | `logAxisScale` | boolean | Tiene | Escala logarítmica (logAxis) |
| Round range | `roundRange` | boolean | Falta | El motor de gráficos redondea el eje salvo con límites fijos |
| Scale to fit | `scaleToFit` | boolean | Parcial | Truncar eje (truncateYAxis) |
| Style | `secAxisStyle` | enum: Show title only, Show unit only, Show both | Falta | El eje muestra sus valores y su título, sin elegir entre ellos |
| Bold | `secBold` | boolean | Tiene | Fuente eje secundario (y_axis_secondary_label_font) |
| Maximum | `secEnd` | number | Tiene | Límites secundarios (y_axis_bounds_secondary) |
| Font family | `secFontFamily` | string | Tiene | Fuente eje secundario (y_axis_secondary_label_font) |
| Text size | `secFontSize` | fontSize | Tiene | Fuente eje secundario (y_axis_secondary_label_font) |
| Italic | `secItalic` | boolean | Tiene | Fuente eje secundario (y_axis_secondary_label_font) |
| Color | `secLabelColor` | fill | Tiene | Fuente eje secundario (y_axis_secondary_label_font) |
| Display units | `secLabelDisplayUnits` | labelDisplayUnits | Tiene | Eje Y secundario |
| Value decimal places | `secLabelPrecision` | integer | Tiene | Eje Y secundario |
| Logarithmic scale | `secLogAxisScale` | boolean | Tiene | Log secundario (logAxisSecondary) |
| Round range | `secRoundRange` | boolean | Falta | El motor de gráficos redondea el eje salvo con límites fijos |
| Show secondary | `secShow` | boolean | Tiene | Eje Y secundario |
| Title | `secShowAxisTitle` | boolean | Tiene | Título secundario (yAxisTitleSecondary) |
| Minimum | `secStart` | number | Tiene | Límites secundarios (y_axis_bounds_secondary) |
| Bold | `secTitleBold` | boolean | Tiene | Fuente título secundario (y_axis_secondary_title_font) |
| Title color | `secTitleColor` | fill | Tiene | Fuente título secundario (y_axis_secondary_title_font) |
| Font family | `secTitleFontFamily` | string | Tiene | Fuente título secundario (y_axis_secondary_title_font) |
| Title text size | `secTitleFontSize` | fontSize | Tiene | Fuente título secundario (y_axis_secondary_title_font) |
| Italic | `secTitleItalic` | boolean | Tiene | Fuente título secundario (y_axis_secondary_title_font) |
| Axis title | `secTitleText` | string | Tiene | Título secundario (yAxisTitleSecondary) |
| Underline | `secTitleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Underline | `secUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Shared y-axis | `sharedAxis` | boolean | Falta | Cada consulta elige eje en sus datos |
| Show | `show` | boolean | Tiene | Eje Y secundario |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje Y (y_axis_title) |
| Minimum | `start` | number/string | Tiene | Límites del eje Y (y_axis_bounds) |
| Switch axis position | `switchAxisPosition` | boolean | Tiene | Sección del eje |
| Bold | `titleBold` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título Y (y_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título Y (y_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título Y (y_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje Y (y_axis_title) |
| Underline | `titleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Etiquetas de datos (`labels`) · P1 · 40/58

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Tiene | Fondo de etiquetas (value_label_background) |
| Transparency | `backgroundTransparency` | number | Tiene | Fondo de etiquetas (value_label_background) |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Color | `color` | fill | Tiene | Fuente de etiquetas (value_label_font) |
| Bold | `detailBold` | boolean | Tiene | Etiquetas de datos |
| Color | `detailColor` | fill | Tiene | Etiquetas de datos |
| Content | `detailContentType` | enum: Percent of total, Custom | Parcial | Serie, categoría o porcentaje; no otro campo |
| Format code | `detailCustomFormatString` | string | Falta | El título y el detalle son texto, no otra medida |
| Font family | `detailFontFamily` | string | Tiene | Etiquetas de datos |
| Text size | `detailFontSize` | fontSize | Tiene | Etiquetas de datos |
| detailFormatString | `detailFormatString` | string | Falta | El título y el detalle son texto, no otra medida |
| Italic | `detailItalic` | boolean | Tiene | Etiquetas de datos |
| Display units | `detailLabelDisplayUnits` | enum: Auto, None, Thousands, Millions, Billions, Trillions, Custom | Falta | El título y el detalle son texto, no otra medida |
| Value decimal places | `detailLabelPrecision` | integer | Falta | El título y el detalle son texto, no otra medida |
| Show blank as | `detailShowBlankAs` | string | Falta | Una marca sin valor no tiene etiqueta |
| Transparency | `detailTransparency` | number | Tiene | Etiquetas de datos |
| Underline | `detailUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Field | `dynamicLabelDetail` | string/number/integer/boolean | Excluido | Requiere expresiones DAX |
| Field | `dynamicLabelTitle` | string/number/integer/boolean | Excluido | Requiere expresiones DAX |
| Field | `dynamicLabelValue` | string/number/integer/boolean | Excluido | Requiere expresiones DAX |
| Show background | `enableBackground` | boolean | Tiene | Fondo de etiquetas (value_label_background) |
| enableDetailDataLabel | `enableDetailDataLabel` | boolean | Tiene | Etiquetas de datos |
| enableTitleDataLabel | `enableTitleDataLabel` | boolean | Tiene | Etiquetas de datos |
| enableValueDataLabel | `enableValueDataLabel` | boolean | Tiene | Etiquetas de datos |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas (value_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas (value_label_font) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Maximum width | `labelContainerMaxWidth` | number | Tiene | Etiquetas de datos |
| Layout | `labelContentLayout` | enum: Multi-line, Single line | Tiene | Etiquetas de datos |
| Label density | `labelDensity` | integer | Parcial | Ocultar etiquetas superpuestas, sin porcentaje de densidad |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Tiene | Etiquetas de datos |
| Orientation | `labelOrientation` | enum: Vertical, Horizontal | Tiene | Rotación (value_label_rotate) |
| Position | `labelPosition` | enum: Auto, Inside end, Outside end, Inside center, Inside base, Above, Under | Tiene | Etiquetas de datos |
| Value decimal places | `labelPrecision` | integer | Tiene | Etiquetas de datos |
| Optimize label display | `optimizeLabelDisplay` | boolean | Tiene | Etiquetas de datos |
| Show | `show` | boolean | Tiene | Mostrar etiquetas (show_value) |
| Customize series | `showAll` | boolean | Tiene | Etiquetas de datos |
| Show blank as | `showBlankAs` | string | Falta | Una marca sin valor no tiene etiqueta |
| showByDefault | `showByDefault` | boolean | Tiene | Etiquetas de datos |
| Custom label | `showDynamicLabels` | boolean | Excluido | Requiere expresiones DAX |
| Show | `showSeries` | boolean | Tiene | Etiquetas de datos |
| Bold | `titleBold` | boolean | Tiene | Etiquetas de datos |
| Color | `titleColor` | fill | Tiene | Etiquetas de datos |
| Content | `titleContentType` | enum: Series name, Custom | Tiene | Etiquetas de datos |
| Format code | `titleCustomFormatString` | string | Falta | El título y el detalle son texto, no otra medida |
| Font family | `titleFontFamily` | string | Tiene | Etiquetas de datos |
| Text size | `titleFontSize` | fontSize | Tiene | Etiquetas de datos |
| titleFormatString | `titleFormatString` | string | Falta | El título y el detalle son texto, no otra medida |
| Italic | `titleItalic` | boolean | Tiene | Etiquetas de datos |
| Display units | `titleLabelDisplayUnits` | enum: Auto, None, Thousands, Millions, Billions, Trillions, Custom | Falta | El título y el detalle son texto, no otra medida |
| Value decimal places | `titleLabelPrecision` | integer | Falta | El título y el detalle son texto, no otra medida |
| Show blank as | `titleShowBlankAs` | string | Falta | Una marca sin valor no tiene etiqueta |
| Transparency | `titleTransparency` | number | Tiene | Etiquetas de datos |
| Underline | `titleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Transparency | `transparency` | number | Tiene | Etiquetas de datos |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Format code | `valueCustomFormatString` | string | Tiene | Formato de número de la etiqueta (value_label_format) |
| valueFormatString | `valueFormatString` | string | Tiene | Formato de número de la etiqueta (value_label_format) |

### Etiquetas de total (`totals`) · P1 · 12/13

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Tiene | Etiquetas de total |
| Transparency | `backgroundTransparency` | number | Tiene | Etiquetas de total |
| Bold | `bold` | boolean | Tiene | Etiquetas de total |
| Color | `color` | fill | Tiene | Etiquetas de total |
| Show background | `enableBackground` | boolean | Tiene | Etiquetas de total |
| Font family | `fontFamily` | string | Tiene | Etiquetas de total |
| Text size | `fontSize` | fontSize | Tiene | Etiquetas de total |
| Italic | `italic` | boolean | Tiene | Etiquetas de total |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Tiene | Etiquetas de total |
| Value decimal places | `labelPrecision` | integer | Tiene | Etiquetas de total |
| Show | `show` | boolean | Tiene | Etiquetas de total |
| Split positive and negative | `showPositiveAndNegative` | boolean | Tiene | Etiquetas de total |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Leyenda (`legend`) · P1 · 11/12

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bold | `bold` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Font family | `fontFamily` | string | Tiene | Fuente de leyenda (legend_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de leyenda (legend_font) |
| Italic | `italic` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Color | `labelColor` | fill | Tiene | Fuente de leyenda (legend_font) |
| Style | `legendMarkerRendering` | enum: Marker (circle default), Marker, Line, Line and markers | Parcial | Forma del marcador (legend_icon) |
| Match line color | `matchLineColor` | boolean | Tiene | Leyenda |
| Position | `position` | enum: Top left, Top center, Top right, Top left stacked, Top right stacked, Center left, Center right, Bottom left, Bottom center, Bottom ri | Tiene | Posición (legendOrientation) |
| Show | `show` | boolean | Tiene | Mostrar leyenda (show_legend) |
| Title | `showTitle` | boolean | Tiene | Leyenda |
| Legend Name | `titleText` | string | Tiene | Leyenda |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Líneas (`lineStyles`) · P1 · 20/21

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `areaColor` | fill | Tiene | Colores y series > Líneas |
| Match line color | `areaMatchStrokeColor` | boolean | Tiene | Colores y series > Líneas |
| Shade area | `areaShow` | boolean | Tiene | Sombrear área (area) |
| Smooth type | `interpolationSmooth` | enum: Monotone, Cardinal | Tiene | Colores y series > Líneas |
| Tension | `interpolationSmoothParam` | number | Tiene | Colores y series > Líneas |
| Step position | `interpolationStep` | enum: Before, Center, After | Tiene | Colores y series > Líneas |
| Interpolation type | `lineChartType` | enum: Linear, Smooth, Step | Tiene | Colores y series > Líneas |
| Line style | `lineStyle` | enum: Solid, Dashed, Dotted, Custom | Tiene | Estilo de línea (series_line_type) |
| Color | `markerColor` | fill | Tiene | Colores y series > Marcadores |
| Type | `markerShape` | enum: ●, ■, ◆, ▲, ☓, -, —, + | Tiene | Forma del marcador (series_marker_symbol) |
| Size | `markerSize` | number | Tiene | Tamaño del marcador (markerSize) |
| Show | `showMarker` | boolean | Tiene | Marcadores (markerEnabled) |
| showMarkerByDefault | `showMarkerByDefault` | boolean | Tiene | Marcadores (markerEnabled) |
| Customize series | `showSeries` | boolean | Tiene | Colores y series > Líneas |
| Scale by width | `strokeAutoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Dash array | `strokeDashArray` | string | Tiene | Colores y series > Líneas |
| Dash cap | `strokeDashCap` | enum: Flat, Round, Square | Tiene | Colores y series > Líneas |
| Join type | `strokeLineJoin` | enum: Miter, Round, Bevel | Tiene | Colores y series > Líneas |
| Show | `strokeShow` | boolean | Tiene | Colores y series > Líneas |
| Transparency | `strokeTransparency` | number | Tiene | Colores y series > Líneas |
| Width | `strokeWidth` | number | Tiene | Grosor de línea (series_line_width) |

### Marcadores (`markers`) · P1 · 7/7

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `borderColor` | fill | Tiene | Colores y series > Marcadores |
| Match fill color | `borderColorMatchFill` | boolean | Tiene | Colores y series > Marcadores |
| Border | `borderShow` | boolean | Tiene | Colores y series > Marcadores |
| Transparency | `borderTransparency` | number | Tiene | Colores y series > Marcadores |
| Width | `borderWidth` | number | Tiene | Colores y series > Marcadores |
| Rotation | `rotation` | number | Tiene | Colores y series > Marcadores |
| Transparency | `transparency` | number | Tiene | Colores y series > Marcadores |

### Control deslizante de zoom (`zoom`) · P2 · 10/15

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| categoryMax | `categoryMax` | number | Parcial | En porcentaje del eje, no en valores |
| categoryMin | `categoryMin` | number | Parcial | En porcentaje del eje, no en valores |
| categorySize | `categorySize` | number | Tiene | Analítica: deslizadores de zoom |
| Show | `show` | boolean | Tiene | Analítica: deslizadores de zoom |
| Slider labels | `showLabels` | boolean | Tiene | Analítica: deslizadores de zoom |
| X axis | `showOnCategoryAxis` | boolean | Tiene | Analítica: deslizadores de zoom |
| Y axis | `showOnValueAxis` | boolean | Tiene | Analítica: deslizadores de zoom |
| Secondary Y axis | `showOnValueSecAxis` | boolean | Falta | Sin deslizador para el eje secundario |
| Slider tooltips | `showTooltip` | boolean | Falta | El deslizador solo tiene etiquetas |
| valueMax | `valueMax` | number | Parcial | En porcentaje del eje, no en valores |
| valueMin | `valueMin` | number | Parcial | En porcentaje del eje, no en valores |
| valueSecMax | `valueSecMax` | number | Falta | Sin deslizador para el eje secundario |
| valueSecMin | `valueSecMin` | number | Falta | Sin deslizador para el eje secundario |
| valueSecSize | `valueSecSize` | number | Falta | Sin deslizador para el eje secundario |
| valueSize | `valueSize` | number | Tiene | Analítica: deslizadores de zoom |

### Etiquetas de serie (`seriesLabels`) · P2 · 15/27

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Tiene | Etiquetas de serie |
| Match series color | `backgroundMatchColor` | boolean | Tiene | Etiquetas de serie |
| Transparency | `backgroundTransparency` | number | Tiene | Etiquetas de serie |
| Bold | `bold` | boolean | Tiene | Etiquetas de serie |
| Show background | `enableBackground` | boolean | Tiene | Etiquetas de serie |
| Italic | `italic` | boolean | Tiene | Etiquetas de serie |
| Scale by width | `leaderLineAutoScale` | boolean | Falta | El motor de gráficos solo las pone al final de la línea |
| Color | `leaderLineColor` | fill | Falta | El motor de gráficos solo las pone al final de la línea |
| Dash array | `leaderLineDashArray` | string | Falta | El motor de gráficos solo las pone al final de la línea |
| Dash cap | `leaderLineDashCap` | enum: Flat, Round, Square | Falta | El motor de gráficos solo las pone al final de la línea |
| Line style | `leaderLinePattern` | enum: Solid, Dashed, Dotted, Custom | Falta | El motor de gráficos solo las pone al final de la línea |
| Transparency | `leaderLineTransparency` | number | Falta | El motor de gráficos solo las pone al final de la línea |
| Width | `leaderLineWidth` | number | Falta | El motor de gráficos solo las pone al final de la línea |
| Show | `leaderLines` | boolean | Falta | El motor de gráficos solo las pone al final de la línea |
| Maximum offset | `maximumOffset` | number | Falta | El motor de gráficos solo las pone al final de la línea |
| Color | `seriesColor` | fill | Tiene | Etiquetas de serie |
| Series font family | `seriesFontFamily` | string | Tiene | Etiquetas de serie |
| Match series color | `seriesMatchColor` | boolean | Tiene | Etiquetas de serie |
| Width | `seriesMaximumWidth` | integer | Tiene | Etiquetas de serie |
| Position | `seriesPosition` | enum: Left, Right | Parcial | Solo al final de la línea |
| Transparency | `seriesTransparency` | number | Tiene | Etiquetas de serie |
| Word wrap | `seriesWordWrap` | boolean | Tiene | Etiquetas de serie |
| Show for this series | `show` | boolean | Tiene | Etiquetas de serie |
| Customize series | `showAll` | boolean | Falta | Se activan para todo el gráfico |
| showByDefault | `showByDefault` | boolean | Falta | Se activan para todo el gráfico |
| Series font size | `textSize` | fontSize | Tiene | Etiquetas de serie |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Fondo del área de trazado (`plotArea`) · P2 · 7/8

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Background color | `color` | fill | Tiene | Área de trazado |
| Transparency | `colorTransparency` | number | Tiene | Área de trazado |
| Image fit | `fit` | enum: Fit, Stretch, Fill, Center | Parcial | En mosaico o una vez, sin ajustar al área |
| image | `image` | image | Parcial | Por dirección de la imagen, sin subirla |
| Data | `imageData` | string | Parcial | Por dirección de la imagen, sin subirla |
| Image source | `sourceType` | enum: Upload Image, Enter URL, Select from data | Parcial | Por dirección de la imagen, sin subirla |
| Transparency | `transparency` | number | Falta | El motor de gráficos no atenúa una imagen de fondo |
| Image URL | `url` | string | Parcial | Por dirección de la imagen, sin subirla |

### Línea de referencia X (`xAxisReferenceLine`) · P2 · 21/23

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Dash array | `dashArray` | string | Tiene | Analítica: líneas de referencia |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta | Los extremos no se eligen en estas líneas |
| Color | `dataLabelColor` | fill | Tiene | Analítica: líneas de referencia |
| Value decimal places | `dataLabelDecimalPoints` | number | Tiene | Analítica: líneas de referencia |
| Display units | `dataLabelDisplayUnits` | labelDisplayUnits | Tiene | Analítica: líneas de referencia |
| Horizontal position | `dataLabelHorizontalPosition` | enum: Left, Right | Tiene | Analítica: líneas de referencia |
| Data label | `dataLabelShow` | boolean | Tiene | Analítica: líneas de referencia |
| Text | `dataLabelText` | enum: Data value, Name, Both | Tiene | Analítica: líneas de referencia |
| Vertical position | `dataLabelVerticalPosition` | enum: Above, Under | Tiene | Analítica: líneas de referencia |
| Name | `displayName` | string | Tiene | Analítica: líneas de referencia |
| Color | `lineColor` | fill | Tiene | Analítica: líneas de referencia |
| Position | `position` | enum: Behind, In front | Tiene | Analítica: líneas de referencia |
| Shade color | `shadeColor` | fill | Tiene | Analítica: líneas de referencia |
| Match line color | `shadeColorMatchStroke` | boolean | Parcial | Sin color propio, el sombreado toma el de la línea |
| Shade region | `shadeRegion` | enum: Before, After, None | Tiene | Analítica: líneas de referencia |
| Show | `shadeShow` | boolean | Tiene | Analítica: líneas de referencia |
| Shade transparency | `shadeTransparency` | number | Tiene | Analítica: líneas de referencia |
| Show | `show` | boolean | Tiene | Analítica: líneas de referencia |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Tiene | Analítica: líneas de referencia |
| Transparency | `transparency` | number | Tiene | Analítica: líneas de referencia |
| Value | `value` | number/string | Tiene | Analítica: líneas de referencia |
| Width | `width` | number | Tiene | Analítica: líneas de referencia |

### Línea de referencia Y (`y1AxisReferenceLine`) · P2 · 21/23

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Dash array | `dashArray` | string | Tiene | Analítica: líneas de referencia |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta | Los extremos no se eligen en estas líneas |
| Color | `dataLabelColor` | fill | Tiene | Analítica: líneas de referencia |
| Value decimal places | `dataLabelDecimalPoints` | number | Tiene | Analítica: líneas de referencia |
| Display units | `dataLabelDisplayUnits` | labelDisplayUnits | Tiene | Analítica: líneas de referencia |
| Horizontal position | `dataLabelHorizontalPosition` | enum: Left, Right | Tiene | Analítica: líneas de referencia |
| Data label | `dataLabelShow` | boolean | Tiene | Analítica: líneas de referencia |
| Text | `dataLabelText` | enum: Data value, Name, Both | Tiene | Analítica: líneas de referencia |
| Vertical position | `dataLabelVerticalPosition` | enum: Above, Under | Tiene | Analítica: líneas de referencia |
| Name | `displayName` | string | Tiene | Analítica: líneas de referencia |
| Color | `lineColor` | fill | Tiene | Analítica: líneas de referencia |
| Position | `position` | enum: Behind, In front | Tiene | Analítica: líneas de referencia |
| Shade color | `shadeColor` | fill | Tiene | Analítica: líneas de referencia |
| Match line color | `shadeColorMatchStroke` | boolean | Parcial | Sin color propio, el sombreado toma el de la línea |
| Shade region | `shadeRegion` | enum: Before, After, None | Tiene | Analítica: líneas de referencia |
| Show | `shadeShow` | boolean | Tiene | Analítica: líneas de referencia |
| Shade transparency | `shadeTransparency` | number | Tiene | Analítica: líneas de referencia |
| Show | `show` | boolean | Tiene | Analítica: líneas de referencia |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Tiene | Analítica: líneas de referencia |
| Transparency | `transparency` | number | Tiene | Analítica: líneas de referencia |
| Value | `value` | number | Tiene | Analítica: líneas de referencia |
| Width | `width` | number | Tiene | Analítica: líneas de referencia |

### Múltiplos pequeños (`smallMultiplesLayout`) · P2 · 1/17

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Advanced padding options | `advancedPaddingOptions` | boolean | Falta | El motor de múltiplos no tiene ese ajuste |
| Background color | `backgroundColor` | fill | Falta | El motor de múltiplos no tiene ese ajuste |
| Background transparency | `backgroundTransparency` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Columns | `columnCount` | integer | Tiene | Analítica: múltiplos por fila |
| Inner column padding | `columnPaddingInner` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Outer column padding | `columnPaddingOuter` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Color | `gridLineColor` | fill | Falta | El motor de múltiplos no tiene ese ajuste |
| Show | `gridLineShow` | boolean | Falta | El motor de múltiplos no tiene ese ajuste |
| Line style | `gridLineStyle` | enum: Solid, Dashed, Dotted | Falta | El motor de múltiplos no tiene ese ajuste |
| Transparency | `gridLineTransparency` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Gridlines | `gridLineType` | enum: All, Horizontal and vertical, Horizontal only, Vertical only | Falta | El motor de múltiplos no tiene ese ajuste |
| Width | `gridLineWidth` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Grid padding | `gridPadding` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Grid layout | `layoutType` | enum: Auto, Custom | Falta | El motor de múltiplos no tiene ese ajuste |
| Rows | `rowCount` | integer | Falta | El motor de múltiplos no tiene ese ajuste |
| Inner row padding | `rowPaddingInner` | number | Falta | El motor de múltiplos no tiene ese ajuste |
| Outer row padding | `rowPaddingOuter` | number | Falta | El motor de múltiplos no tiene ese ajuste |

### Anotaciones (`annotationTemplate`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| callout | `callout` | annotationTemplate | Falta | Sin anotaciones en el gráfico: fase 8 |

### Barras de error (`error`) · P3 · 0/30

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Border color | `barBorderColor` | fill | Falta |  |
| Border size | `barBorderSize` | integer | Falta |  |
| Bar color | `barColor` | fill | Falta |  |
| Match series color | `barMatchSeriesColor` | boolean | Falta |  |
| Show | `barShow` | boolean | Falta |  |
| Width | `barWidth` | number | Falta |  |
| Enabled | `enabled` | boolean | Falta |  |
| Show background | `labelBackground` | boolean | Falta |  |
| Background color | `labelBackgroundColor` | fill | Falta |  |
| Transparency | `labelBackgroundTransparency` | number | Falta |  |
| Bold | `labelBold` | boolean | Falta |  |
| Color | `labelColor` | fill | Falta |  |
| Font family | `labelFontFamily` | string | Falta |  |
| Text size | `labelFontSize` | fontSize | Falta |  |
| Label format | `labelFormat` | enum: Absolute, Relative (numeric), Relative (percentage), Range | Falta |  |
| Italic | `labelItalic` | boolean | Falta |  |
| Match series color | `labelMatchSeriesColor` | boolean | Falta |  |
| Show | `labelShow` | boolean | Falta |  |
| Underline | `labelUnderline` | boolean | Falta |  |
| Marker shape | `markerShape` | enum: ●, ■, ◆, ▲, ☓, -, —, +, None | Falta |  |
| Show | `markerShow` | boolean | Falta |  |
| Size | `markerSize` | number | Falta |  |
| Style | `shadeBandStyle` | enum: Fill, Line, Fill and line | Falta |  |
| Band color | `shadeColor` | fill | Falta |  |
| Match series color | `shadeMatchSeriesColor` | boolean | Falta |  |
| Show | `shadeShow` | boolean | Falta |  |
| Transparency | `shadeTransparency` | number | Falta |  |
| showMarkerByDefault | `showMarkerByDefault` | boolean | Falta |  |
| Label format | `tooltipFormat` | enum: Absolute, Relative (numeric), Relative (percentage), Range | Falta |  |
| Show in tooltip | `tooltipShow` | boolean | Falta |  |

### Encabezado de múltiplos (`subheader`) · P3 · 1/10

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alignment | `alignment` | alignment | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Bold | `bold` | boolean | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Font color | `fontColor` | fill | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Font family | `fontFamily` | string | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Text size | `fontSize` | fontSize | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Italic | `italic` | boolean | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Position | `position` | enum: Top, Bottom | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Show | `show` | boolean | Tiene | Analítica: encabezados de múltiplos |
| Word wrap | `titleWrap` | boolean | Falta | Los encabezados de múltiplos usan el estilo del tema |
| Underline | `underline` | boolean | Falta | Los encabezados de múltiplos usan el estilo del tema |

### filters (`filters`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| filteredToUniqueValue | `filteredToUniqueValue` | boolean | Excluido | Estado interno, no es una opción de formato |

## General


### Borde (`border`) · P1 · 4/4

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `color` | fill | Tiene | Formato > Borde |
| Radius | `radius` | number | Tiene | Formato > Borde |
| Show | `show` | boolean | Tiene | Formato > Borde |
| Width | `width` | number | Tiene | Formato > Borde |

### Divisor (`divider`) · P1 · 5/5

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `color` | fill | Tiene | General > Divisor |
| Ignore padding | `ignorePadding` | boolean | Tiene | General > Divisor: llegar a los bordes |
| Show | `show` | boolean | Tiene | General > Divisor |
| Line style | `style` | enum: Solid, Dashed, Dotted | Tiene | General > Divisor |
| Width | `width` | number | Tiene | General > Divisor |

### Fondo (`background`) · P1 · 3/3

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `color` | fill | Tiene | Formato > Fondo |
| Show | `show` | boolean | Tiene | Formato > Fondo |
| Transparency | `transparency` | number | Tiene | Formato > Fondo |

### Iconos de cabecera (`visualHeader`) · P1 · 14/26

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Background color | `background` | fill | Tiene | General > Iconos |
| Border | `border` | fill | Tiene | General > Iconos del encabezado |
| Icon color | `foreground` | fill | Tiene | General > Iconos |
| Show | `show` | boolean | Tiene | General > Iconos del encabezado |
| Comment button | `showCommentButton` | boolean | Excluido | Función de Power BI que no tenemos |
| Copilot summary | `showCopilotSummaryButton` | boolean | Excluido | Función de Power BI que no tenemos |
| Copy icon | `showCopyVisualImageButton` | boolean | Tiene | General > Iconos del encabezado |
| Expand to next level icon | `showDrillDownExpandButton` | boolean | Excluido | No hay jerarquías de exploración |
| Show next level icon | `showDrillDownLevelButton` | boolean | Excluido | No hay jerarquías de exploración |
| Drill on dropdown | `showDrillRoleSelector` | boolean | Excluido | No hay jerarquías de exploración |
| Drill down icon | `showDrillToggleButton` | boolean | Excluido | No hay jerarquías de exploración |
| Drill up icon | `showDrillUpButton` | boolean | Excluido | No hay jerarquías de exploración |
| Filter icon | `showFilterRestatementButton` | boolean | Tiene | General > Iconos del encabezado |
| Focus mode icon | `showFocusModeButton` | boolean | Tiene | General > Iconos del encabezado |
| Follow visual button | `showFollowVisualButton` | boolean | Excluido | Función de Power BI que no tenemos |
| More options icon | `showOptionsMenu` | boolean | Tiene | General > Iconos del encabezado |
| Personalize visual | `showPersonalizeVisualButton` | boolean | Excluido | Función de Power BI que no tenemos |
| Pin icon | `showPinButton` | boolean | Excluido | Función de Power BI que no tenemos |
| See data layout icon | `showSeeDataLayoutToggleButton` | boolean | Tiene | General > Iconos del encabezado |
| Set alert button | `showSetAlertButton` | boolean | Excluido | Función de Power BI que no tenemos |
| Smart narrative | `showSmartNarrativeButton` | boolean | Excluido | Función de Power BI que no tenemos |
| Visual header tooltip icon | `showTooltipButton` | boolean | Tiene | General > Iconos del encabezado |
| Visual error icon | `showVisualErrorButton` | boolean | Tiene | General > Iconos del encabezado |
| Visual information icon | `showVisualInformationButton` | boolean | Tiene | General > Iconos del encabezado |
| Visual warning icon | `showVisualWarningButton` | boolean | Tiene | General > Iconos del encabezado |
| Transparency | `transparency` | number | Tiene | General > Iconos del encabezado |

### Propiedades (`general`) · P1 · 8/13

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| High density sampling | `allowBinnedLineSample` | boolean | Tiene | General > Propiedades |
| High density sampling | `allowOverlappingPointsSample` | boolean | Tiene | General > Propiedades |
| Alt text | `altText` | string | Tiene | Formato > Texto alternativo |
| formatString | `formatString` | string | Falta |  |
| Height | `height` | number | Tiene | Posición y tamaño en celdas |
| Maintain layer order | `keepLayerOrder` | boolean | Tiene | General > Propiedades |
| Responsive | `responsive` | boolean | Excluido | El lienzo tiene tamaño fijo |
| responsiveLegacy | `responsiveLegacy` | boolean | Excluido | El lienzo tiene tamaño fijo |
| visualType1 | `visualType1` | string | Falta |  |
| visualType2 | `visualType2` | string | Falta |  |
| Width | `width` | number | Tiene | Posición y tamaño en celdas |
| X Position | `x` | number | Tiene | Posición y tamaño en celdas |
| Y Position | `y` | number | Tiene | Posición y tamaño en celdas |

### Relleno (`padding`) · P1 · 4/4

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bottom padding | `bottom` | number | Tiene | General > Relleno por lado |
| Left padding | `left` | number | Tiene | General > Relleno por lado |
| Right padding | `right` | number | Tiene | General > Relleno por lado |
| Top padding | `top` | number | Tiene | General > Relleno por lado |

### Sombra (`dropShadow`) · P1 · 9/9

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Angle | `angle` | number | Tiene | General > Sombra |
| Color | `color` | fill | Tiene | General > Sombra |
| Shadow position | `position` | enum: Outside, Inside | Tiene | General > Sombra |
| Preset | `preset` | enum: Bottom right, Bottom, Bottom left, Right, Center, Left, Top right, Top, Top left, Custom | Tiene | General > Sombra |
| Blur | `shadowBlur` | number | Tiene | General > Sombra |
| Distance | `shadowDistance` | number | Tiene | General > Sombra |
| Size | `shadowSpread` | number | Tiene | General > Sombra |
| Show | `show` | boolean | Tiene | General > Sombra |
| Transparency | `transparency` | number | Tiene | General > Sombra |

### Subtítulo (`subTitle`) · P1 · 11/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alignment | `alignment` | alignment | Tiene | General > Subtítulo |
| Bold | `bold` | boolean | Tiene | General > Subtítulo |
| Font color | `fontColor` | fill | Tiene | General > Subtítulo |
| Font family | `fontFamily` | string | Tiene | General > Subtítulo |
| Text size | `fontSize` | fontSize | Tiene | General > Subtítulo |
| Title heading | `heading` | enum: Normal, Heading 2, Heading 3, Heading 4, Heading 5, Heading 6 | Tiene | General > Subtítulo |
| Italic | `italic` | boolean | Tiene | General > Subtítulo |
| Show | `show` | boolean | Tiene | General > Subtítulo |
| Title text | `text` | string | Tiene | General > Subtítulo |
| Word wrap | `titleWrap` | boolean | Tiene | General > Subtítulo |
| Underline | `underline` | boolean | Tiene | General > Subtítulo |

### Título (`title`) · P1 · 12/12

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alignment | `alignment` | alignment | Tiene | Formato > Título |
| Background color | `background` | fill | Tiene | Formato > Título |
| Bold | `bold` | boolean | Tiene | Formato > Título |
| Font color | `fontColor` | fill | Tiene | Formato > Título |
| Font family | `fontFamily` | string | Tiene | General > Título |
| Text size | `fontSize` | fontSize | Tiene | Formato > Título |
| Title heading | `heading` | enum: Normal, Heading 2, Heading 3, Heading 4, Heading 5, Heading 6 | Tiene | General > Título: nivel de encabezado |
| Italic | `italic` | boolean | Tiene | Formato > Título |
| Show | `show` | boolean | Tiene | Formato > Título |
| Title text | `text` | string | Tiene | Formato > Título |
| Word wrap | `titleWrap` | boolean | Tiene | General > Título |
| Underline | `underline` | boolean | Tiene | General > Título |

### Acción (`visualLink`) · P2 · 10/13

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bookmark | `bookmark` | string | Tiene | General > Acción |
| Data function | `dataFunction` | itemLocation | Excluido | Función de Power BI que no tenemos |
| Disabled tooltip | `disabledTooltip` | string | Tiene | General > Acción |
| Destination | `drillthroughSection` | string | Falta | El detalle necesita el valor de una marca |
| Enabled tooltip | `enabledTooltip` | string | Tiene | General > Acción |
| Destination | `navigationSection` | string | Tiene | General > Acción |
| Show | `show` | boolean | Tiene | General > Acción |
| Show tooltips | `showDefaultTooltip` | boolean | Parcial | General > Acción |
| No tooltips | `suppressDefaultTooltip` | boolean | Parcial | General > Acción |
| Tooltip | `tooltip` | string | Tiene | General > Acción |
| Placeholder for tooltip | `tooltipPlaceholderText` | string | Excluido | Función de Power BI que no tenemos |
| Type | `type` | enum: Back, Bookmark, Drill through, Page navigation, Q&A (retiring Feb 2027), Web URL, Apply all slicers, Clear all slicers, Data function | Parcial | General > Acción |
| Web URL | `webUrl` | string | Tiene | General > Acción |

### Espaciado (`spacing`) · P2 · 8/8

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Customize spacing | `customizeSpacing` | boolean | Tiene | General > Espaciado |
| Space above divider | `spaceAboveDivider` | number | Tiene | General > Espaciado |
| Space above plot area | `spaceAbovePlotArea` | number | Tiene | General > Espaciado |
| Space above subtitle | `spaceAboveSubtitle` | number | Tiene | General > Espaciado |
| Space below subtitle | `spaceBelowSubTitle` | number | Tiene | General > Espaciado |
| Space below title | `spaceBelowTitle` | number | Tiene | General > Espaciado |
| Space below title area | `spaceBelowTitleArea` | number | Tiene | General > Espaciado |
| Space between label and value | `verticalSpacing` | number | Tiene | General > Espaciado |

### Tooltip de iconos (`visualHeaderTooltip`) · P2 · 11/13

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Background color | `background` | fill | Tiene | General > Información del encabezado |
| Bold | `bold` | boolean | Tiene | General > Información del encabezado |
| Font family | `fontFamily` | string | Tiene | General > Información del encabezado |
| Text size | `fontSize` | fontSize | Tiene | General > Información del encabezado |
| Italic | `italic` | boolean | Tiene | General > Información del encabezado |
| Page | `section` | string | Falta | Requiere páginas tooltip (fase 9) |
| Tooltip text | `text` | string | Tiene | General > Información del encabezado |
| Background color | `themedBackground` | fill | Tiene | General > Información del encabezado |
| Color | `themedTitleFontColor` | fill | Tiene | General > Información del encabezado |
| Color | `titleFontColor` | fill | Tiene | General > Información del encabezado |
| Transparency | `transparency` | number | Tiene | General > Información del encabezado |
| Type | `type` | enum: Text, Report page | Falta | Requiere páginas tooltip (fase 9) |
| Underline | `underline` | boolean | Tiene | General > Información del encabezado |

### Tooltips (`visualTooltip`) · P2 · 16/22

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Drill text and icon color | `actionFontColor` | fill | Falta | Sin acciones de obtener detalles en el tooltip |
| Background color | `background` | fill | Tiene | General > Tooltips, solo gráficos ECharts |
| Bold | `bold` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Font family | `fontFamily` | string | Tiene | General > Tooltips, solo gráficos ECharts |
| Text size | `fontSize` | fontSize | Tiene | General > Tooltips, solo gráficos ECharts |
| Italic | `italic` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Page | `section` | string | Falta | Requiere páginas tooltip (fase 9) |
| Sentence template | `sentenceTemplate` | string | Tiene | General > Tooltips, solo gráficos ECharts |
| Show | `show` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Actions | `showActionsInTooltips` | boolean | Falta | Sin acciones de obtener detalles en el tooltip |
| Chart-specific tooltips | `showChartSpecificTooltips` | boolean | Falta | Requiere campos de tooltip (fase 8) |
| Sentence format only | `showSentenceFormat` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Tooltip fields only | `showTooltipFieldsOnly` | boolean | Falta | Requiere campos de tooltip (fase 8) |
| Bold values | `showValuesInBold` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Background color | `themedBackground` | fill | Tiene | General > Tooltips, solo gráficos ECharts |
| Label text color | `themedTitleFontColor` | fill | Tiene | General > Tooltips, solo gráficos ECharts |
| Value text color | `themedValueFontColor` | fill | Tiene | General > Tooltips, solo gráficos ECharts |
| Label text color | `titleFontColor` | fill | Tiene | General > Tooltips, solo gráficos ECharts |
| Transparency | `transparency` | number | Tiene | General > Tooltips, solo gráficos ECharts |
| Type | `type` | enum: Default, Report page | Falta | Requiere páginas tooltip (fase 9) |
| Underline | `underline` | boolean | Tiene | General > Tooltips, solo gráficos ECharts |
| Value text color | `valueFontColor` | fill | Tiene | General > Tooltips, solo gráficos ECharts |

### Bloquear proporción (`lockAspect`) · P3 · 1/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Show | `show` | boolean | Tiene | General > Propiedades |

### actionButtonSection (`actionButtonSection`) · P3 · 60/60

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Tiene | General > Botón de acción |
| Show | `backgroundShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `backgroundTransparency` | number | Tiene | General > Botón de acción |
| Bold | `bold` | boolean | Tiene | General > Botón de acción |
| Color | `borderColor` | fill | Tiene | General > Botón de acción |
| Show | `borderShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `borderTransparency` | number | Tiene | General > Botón de acción |
| Width | `borderWidth` | number | Tiene | General > Botón de acción |
| Icon only | `displayIconOnly` | boolean | Tiene | General > Botón de acción |
| Color | `fillColor` | fill | Tiene | General > Botón de acción |
| Show | `fillShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `fillTransparency` | number | Tiene | General > Botón de acción |
| Font family | `fontFamily` | string | Tiene | General > Botón de acción |
| Text size | `fontSize` | fontSize | Tiene | General > Botón de acción |
| Blur | `glowBlur` | number | Tiene | General > Botón de acción |
| Color | `glowColor` | fill | Tiene | General > Botón de acción |
| Shadow position | `glowOffset` | enum: Inside, Outside | Tiene | General > Botón de acción |
| Position | `glowPosition` | enum: Top left, Top, Top right, Left, Center, Right, Bottom left, Bottom, Bottom right | Tiene | General > Botón de acción |
| Show | `glowShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `glowTransparency` | number | Tiene | General > Botón de acción |
| Color | `iconColor` | fill | Tiene | General > Botón de acción |
| Customize padding | `iconIndividualPadding` | boolean | Tiene | General > Botón de acción |
| Padding | `iconPadding` | number | Tiene | General > Botón de acción |
| Bottom padding | `iconPaddingBottom` | number | Tiene | General > Botón de acción |
| Left padding | `iconPaddingLeft` | number | Tiene | General > Botón de acción |
| Right padding | `iconPaddingRight` | number | Tiene | General > Botón de acción |
| Top padding | `iconPaddingTop` | number | Tiene | General > Botón de acción |
| Show | `iconShow` | boolean | Tiene | General > Botón de acción |
| Icon size | `iconSize` | number | Tiene | General > Botón de acción |
| Transparency | `iconTransparency` | number | Tiene | General > Botón de acción |
| Customize padding | `individualPadding` | boolean | Tiene | General > Botón de acción |
| Italic | `italic` | boolean | Tiene | General > Botón de acción |
| Match tile background | `matchTileBackground` | boolean | Tiene | General > Botón de acción |
| Padding | `padding` | number | Tiene | General > Botón de acción |
| Bottom padding | `paddingBottom` | number | Tiene | General > Botón de acción |
| Left padding | `paddingLeft` | number | Tiene | General > Botón de acción |
| Right padding | `paddingRight` | number | Tiene | General > Botón de acción |
| Top padding | `paddingTop` | number | Tiene | General > Botón de acción |
| Position | `position` | enum: Within title, Above title, Below title | Tiene | General > Botón de acción |
| Show | `positionShow` | boolean | Tiene | General > Botón de acción |
| Blur | `shadowBlur` | number | Tiene | General > Botón de acción |
| Color | `shadowColor` | fill | Tiene | General > Botón de acción |
| Shadow position | `shadowOffset` | enum: Inside, Outside | Tiene | General > Botón de acción |
| Position | `shadowPosition` | enum: Top left, Top, Top right, Left, Center, Right, Bottom left, Bottom, Bottom right | Tiene | General > Botón de acción |
| Show | `shadowShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `shadowTransparency` | number | Tiene | General > Botón de acción |
| Show | `show` | boolean | Tiene | General > Botón de acción |
| Text | `text` | string | Tiene | General > Botón de acción |
| Text color | `textColor` | fill | Tiene | General > Botón de acción |
| Horizontal alignment | `textHorizontalAlignment` | enum: Left, Center, Right | Tiene | General > Botón de acción |
| Customize padding | `textIndividualPadding` | boolean | Tiene | General > Botón de acción |
| Padding | `textPadding` | number | Tiene | General > Botón de acción |
| Bottom padding | `textPaddingBottom` | number | Tiene | General > Botón de acción |
| Left padding | `textPaddingLeft` | number | Tiene | General > Botón de acción |
| Right padding | `textPaddingRight` | number | Tiene | General > Botón de acción |
| Top padding | `textPaddingTop` | number | Tiene | General > Botón de acción |
| Show | `textShow` | boolean | Tiene | General > Botón de acción |
| Transparency | `textTransparency` | number | Tiene | General > Botón de acción |
| Vertical alignment | `textVerticalAlignment` | enum: Top, Middle, Bottom | Tiene | General > Botón de acción |
| Underline | `underline` | boolean | Tiene | General > Botón de acción |

### stylePreset (`stylePreset`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Style | `name` | string | Excluido | Estado interno, no es una opción de formato |
