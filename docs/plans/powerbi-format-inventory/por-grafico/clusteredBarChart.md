# Barras agrupadas (`clusteredBarChart`)

Nuestro gráfico: bar. Generado desde `reportThemeSchema-2.159.json`.

## Visual


### Colores / barras (`dataPoint`) · P1 · 6/9

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `borderColor` | fill | Tiene | Borde de barras (bar_border_color) |
| Match fill color | `borderColorMatchFill` | boolean | Falta |  |
| Border | `borderShow` | boolean | Tiene | Borde de barras (bar_border_width) |
| Width | `borderSize` | number | Tiene | Borde de barras (bar_border_width) |
| Transparency | `borderTransparency` | number | Falta |  |
| Default color | `defaultColor` | fill | Parcial | Color por serie o esquema; revisar color por categoría (color_scheme/series_colors) |
| Color | `fill` | fill | Parcial | Color por serie o esquema; revisar color por categoría (color_scheme/series_colors) |
| Color saturation | `fillRule` | fillRule | Parcial | Formato condicional por reglas (chart_conditional_formatting) |
| Transparency | `fillTransparency` | number | Falta |  |

### Disposición (`layout`) · P1 · 3/5

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Flip overlap | `clusteredGapOverlapReverse` | boolean | Falta |  |
| Overlap | `clusteredGapOverlaps` | boolean | Falta |  |
| Space between series | `clusteredGapSize` | number | Tiene | Espacio entre barras (bar_category_gap) |
| Reverse order | `seriesOrderReversed` | boolean | Parcial | Orden de series (sort_series_ascending) |
| Sort by value | `seriesOrderSorted` | boolean | Parcial | Orden de series (sort_series_type) |

### Eje X / categorías (`categoryAxis`) · P1 · 23/40

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Auto expand | `autoExpand` | boolean | Falta |  |
| Style | `axisStyle` | enum: Show title only, Show unit only, Show both | Falta |  |
| Type | `axisType` | enum: Continuous, Categorical | Falta |  |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Concatenate labels | `concatenateLabels` | boolean | Falta |  |
| Maximum | `end` | number/string | Parcial | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Scale by width | `gridlineAutoScale` | boolean | Falta |  |
| Color | `gridlineColor` | fill | Parcial | Una opción para ambos ejes (gridline_color) |
| Dash array | `gridlineDashArray` | string | Falta |  |
| Dash cap | `gridlineDashCap` | enum: Flat, Round, Square | Falta |  |
| Show | `gridlineShow` | boolean | Parcial | Una opción para ambos ejes (gridlines_hidden) |
| Line style | `gridlineStyle` | enum: Solid, Dashed, Dotted, Custom | Parcial | Una opción para ambos ejes (gridline_style) |
| Width | `gridlineThickness` | number | Parcial | Una opción para ambos ejes (gridline_width) |
| Transparency | `gridlineTransparency` | number | Falta |  |
| Initial scroll position | `initialScrollPosition` | enum: Start, End | Falta |  |
| Space between categories | `innerPadding` | integer | Parcial | Espacio entre barras (bar_category_gap) |
| Invert range | `invertAxis` | boolean | Tiene | Invertir eje X (x_axis_inverse) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Color | `labelColor` | fill | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Parcial | Con código d3, no con unidades y decimales (x_axis_number_format) |
| Value decimal places | `labelPrecision` | integer | Parcial | Con código d3, no con unidades y decimales (x_axis_number_format) |
| Logarithmic scale | `logAxisScale` | boolean | Falta |  |
| Maximum size | `maxMarginFactor` | integer | Falta |  |
| Outer padding | `outerPadding` | integer | Falta |  |
| Minimum category width | `preferredCategoryWidth` | number | Falta |  |
| Round range | `roundRange` | boolean | Falta |  |
| Show | `show` | boolean | Tiene | Ocultar eje X (x_axis_hidden) |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje X (x_axis_title) |
| Minimum | `start` | number/string | Parcial | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Switch axis position | `switchAxisPosition` | boolean | Falta |  |
| Bold | `titleBold` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título X (x_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título X (x_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título X (x_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje X (x_axis_title) |
| Underline | `titleUnderline` | boolean | Falta |  |
| Underline | `underline` | boolean | Falta |  |

### Eje Y / valores (`valueAxis`) · P1 · 24/34

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Style | `axisStyle` | enum: Show title only, Show unit only, Show both | Falta |  |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Maximum | `end` | number/string | Tiene | Límites del eje Y (y_axis_bounds) |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Scale by width | `gridlineAutoScale` | boolean | Falta |  |
| Color | `gridlineColor` | fill | Parcial | Una opción para ambos ejes (gridline_color) |
| Dash array | `gridlineDashArray` | string | Falta |  |
| Dash cap | `gridlineDashCap` | enum: Flat, Round, Square | Falta |  |
| Show | `gridlineShow` | boolean | Parcial | Una opción para ambos ejes (gridlines_hidden) |
| Line style | `gridlineStyle` | enum: Solid, Dashed, Dotted, Custom | Parcial | Una opción para ambos ejes (gridline_style) |
| Width | `gridlineThickness` | number | Parcial | Una opción para ambos ejes (gridline_width) |
| Transparency | `gridlineTransparency` | number | Falta |  |
| Invert range | `invertAxis` | boolean | Tiene | Invertir eje Y (y_axis_inverse) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Color | `labelColor` | fill | Tiene | Fuente de etiquetas Y (y_axis_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Parcial | Con código d3, no con unidades y decimales (y_axis_format) |
| Value decimal places | `labelPrecision` | integer | Parcial | Con código d3, no con unidades y decimales (y_axis_format) |
| Logarithmic scale | `logAxisScale` | boolean | Tiene | Escala logarítmica (logAxis) |
| Round range | `roundRange` | boolean | Falta |  |
| Scale to fit | `scaleToFit` | boolean | Parcial | Truncar eje (truncateYAxis) |
| Shared y-axis | `sharedAxis` | boolean | Falta |  |
| Show | `show` | boolean | Tiene | Ocultar eje Y (y_axis_hidden) |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje Y (y_axis_title) |
| Minimum | `start` | number/string | Tiene | Límites del eje Y (y_axis_bounds) |
| Switch axis position | `switchAxisPosition` | boolean | Falta |  |
| Bold | `titleBold` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título Y (y_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título Y (y_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título Y (y_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje Y (y_axis_title) |
| Underline | `titleUnderline` | boolean | Falta |  |
| Underline | `underline` | boolean | Falta |  |

### Etiquetas de datos (`labels`) · P1 · 13/61

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Tiene | Fondo de etiquetas (value_label_background) |
| Transparency | `backgroundTransparency` | number | Falta |  |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Color | `color` | fill | Tiene | Fuente de etiquetas (value_label_font) |
| Bold | `detailBold` | boolean | Falta |  |
| Color | `detailColor` | fill | Falta |  |
| Content | `detailContentType` | enum: Percent of total, Custom | Falta |  |
| Format code | `detailCustomFormatString` | string | Falta |  |
| Font family | `detailFontFamily` | string | Falta |  |
| Text size | `detailFontSize` | fontSize | Falta |  |
| detailFormatString | `detailFormatString` | string | Falta |  |
| Italic | `detailItalic` | boolean | Falta |  |
| Display units | `detailLabelDisplayUnits` | enum: Auto, None, Thousands, Millions, Billions, Trillions, Custom | Falta |  |
| Value decimal places | `detailLabelPrecision` | integer | Falta |  |
| Show blank as | `detailShowBlankAs` | string | Falta |  |
| Transparency | `detailTransparency` | number | Falta |  |
| Underline | `detailUnderline` | boolean | Falta |  |
| Field | `dynamicLabelDetail` | string/number/integer/boolean | Falta |  |
| Field | `dynamicLabelTitle` | string/number/integer/boolean | Falta |  |
| Field | `dynamicLabelValue` | string/number/integer/boolean | Falta |  |
| Show background | `enableBackground` | boolean | Tiene | Fondo de etiquetas (value_label_background) |
| enableDetailDataLabel | `enableDetailDataLabel` | boolean | Falta |  |
| enableTitleDataLabel | `enableTitleDataLabel` | boolean | Falta |  |
| enableValueDataLabel | `enableValueDataLabel` | boolean | Falta |  |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas (value_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas (value_label_font) |
| Horizontal alignment | `horizontalAlignment` | alignment | Falta |  |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Maximum width | `labelContainerMaxWidth` | number | Falta |  |
| Layout | `labelContentLayout` | enum: Multi-line, Single line | Falta |  |
| Label density | `labelDensity` | integer | Falta |  |
| Display units | `labelDisplayUnits` | enum: Auto, None, Thousands, Millions, Billions, Trillions, Custom | Parcial | Con código d3 (value_label_format) |
| Orientation | `labelOrientation` | enum: Vertical, Horizontal | Tiene | Rotación (value_label_rotate) |
| Overflow text | `labelOverflow` | boolean | Falta |  |
| Position | `labelPosition` | enum: Auto, Inside end, Outside end, Inside center, Inside base, Above, Under | Falta |  |
| Value decimal places | `labelPrecision` | integer | Parcial | Con código d3 (value_label_format) |
| Optimize label display | `optimizeLabelDisplay` | boolean | Falta |  |
| Show | `show` | boolean | Tiene | Mostrar etiquetas (show_value) |
| Customize series | `showAll` | boolean | Falta |  |
| Show blank as | `showBlankAs` | string | Falta |  |
| showByDefault | `showByDefault` | boolean | Falta |  |
| Custom label | `showDynamicLabels` | boolean | Falta |  |
| Show | `showSeries` | boolean | Falta |  |
| Bold | `titleBold` | boolean | Falta |  |
| Color | `titleColor` | fill | Falta |  |
| Content | `titleContentType` | enum: Series name, Custom | Falta |  |
| Format code | `titleCustomFormatString` | string | Falta |  |
| Font family | `titleFontFamily` | string | Falta |  |
| Text size | `titleFontSize` | fontSize | Falta |  |
| titleFormatString | `titleFormatString` | string | Falta |  |
| Italic | `titleItalic` | boolean | Falta |  |
| Display units | `titleLabelDisplayUnits` | enum: Auto, None, Thousands, Millions, Billions, Trillions, Custom | Falta |  |
| Value decimal places | `titleLabelPrecision` | integer | Falta |  |
| Show blank as | `titleShowBlankAs` | string | Falta |  |
| Transparency | `titleTransparency` | number | Falta |  |
| Underline | `titleUnderline` | boolean | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Underline | `underline` | boolean | Falta |  |
| Format code | `valueCustomFormatString` | string | Parcial | Con código d3 (value_label_format) |
| valueFormatString | `valueFormatString` | string | Parcial | Con código d3 (value_label_format) |
| Word wrap | `wordWrap` | boolean | Falta |  |

### Leyenda (`legend`) · P1 · 7/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bold | `bold` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Font family | `fontFamily` | string | Tiene | Fuente de leyenda (legend_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de leyenda (legend_font) |
| Italic | `italic` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Color | `labelColor` | fill | Tiene | Fuente de leyenda (legend_font) |
| Position | `position` | enum: Top left, Top center, Top right, Top left stacked, Top right stacked, Center left, Center right, Bottom left, Bottom center, Bottom ri | Tiene | Posición (legendOrientation) |
| Show | `show` | boolean | Tiene | Mostrar leyenda (show_legend) |
| Show | `showGradientLegend` | boolean | Falta |  |
| Title | `showTitle` | boolean | Falta |  |
| Legend Name | `titleText` | string | Falta |  |
| Underline | `underline` | boolean | Falta |  |

### Control deslizante de zoom (`zoom`) · P2 · 1/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| categoryMax | `categoryMax` | number | Falta |  |
| categoryMin | `categoryMin` | number | Falta |  |
| categorySize | `categorySize` | number | Falta |  |
| Show | `show` | boolean | Parcial | Control de zoom, sin formato (zoomable) |
| Slider labels | `showLabels` | boolean | Falta |  |
| Y axis | `showOnCategoryAxis` | boolean | Falta |  |
| X axis | `showOnValueAxis` | boolean | Falta |  |
| Slider tooltips | `showTooltip` | boolean | Falta |  |
| valueMax | `valueMax` | number | Falta |  |
| valueMin | `valueMin` | number | Falta |  |
| valueSize | `valueSize` | number | Falta |  |

### Fondo del área de trazado (`plotArea`) · P2 · 0/8

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Background color | `color` | fill | Falta |  |
| Transparency | `colorTransparency` | number | Falta |  |
| Image fit | `fit` | enum: Fit, Stretch, Fill, Center | Falta |  |
| image | `image` | image | Falta |  |
| Data | `imageData` | string | Falta |  |
| Image source | `sourceType` | enum: Upload Image, Enter URL, Select from data | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Image URL | `url` | string | Falta |  |

### Línea de referencia (`referenceLine`) · P2 · 0/23

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta |  |
| Dash array | `dashArray` | string | Falta |  |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta |  |
| Color | `dataLabelColor` | fill | Falta |  |
| Value decimal places | `dataLabelDecimalPoints` | number | Falta |  |
| Display units | `dataLabelDisplayUnits` | labelDisplayUnits | Falta |  |
| Horizontal position | `dataLabelHorizontalPosition` | enum: Left, Right | Falta |  |
| Data label | `dataLabelShow` | boolean | Falta |  |
| Text | `dataLabelText` | enum: Data value, Name, Both | Falta |  |
| Vertical position | `dataLabelVerticalPosition` | enum: Above, Under | Falta |  |
| Name | `displayName` | string | Falta |  |
| Color | `lineColor` | fill | Falta |  |
| Position | `position` | enum: Behind, In front | Falta |  |
| Shade color | `shadeColor` | fill | Falta |  |
| Match line color | `shadeColorMatchStroke` | boolean | Falta |  |
| Shade region | `shadeRegion` | enum: Before, After, None | Falta |  |
| Show | `shadeShow` | boolean | Falta |  |
| Shade transparency | `shadeTransparency` | number | Falta |  |
| Show | `show` | boolean | Falta |  |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Value | `value` | number | Falta |  |
| Width | `width` | number | Falta |  |

### Línea de referencia X (`xAxisReferenceLine`) · P2 · 0/23

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta |  |
| Dash array | `dashArray` | string | Falta |  |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta |  |
| Color | `dataLabelColor` | fill | Falta |  |
| Value decimal places | `dataLabelDecimalPoints` | number | Falta |  |
| Display units | `dataLabelDisplayUnits` | labelDisplayUnits | Falta |  |
| Horizontal position | `dataLabelHorizontalPosition` | enum: Left, Right | Falta |  |
| Data label | `dataLabelShow` | boolean | Falta |  |
| Text | `dataLabelText` | enum: Data value, Name, Both | Falta |  |
| Vertical position | `dataLabelVerticalPosition` | enum: Above, Under | Falta |  |
| Name | `displayName` | string | Falta |  |
| Color | `lineColor` | fill | Falta |  |
| Position | `position` | enum: Behind, In front | Falta |  |
| Shade color | `shadeColor` | fill | Falta |  |
| Match line color | `shadeColorMatchStroke` | boolean | Falta |  |
| Shade region | `shadeRegion` | enum: Before, After, None | Falta |  |
| Show | `shadeShow` | boolean | Falta |  |
| Shade transparency | `shadeTransparency` | number | Falta |  |
| Show | `show` | boolean | Falta |  |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Value | `value` | number/string | Falta |  |
| Width | `width` | number | Falta |  |

### Línea de referencia Y (`y1AxisReferenceLine`) · P2 · 0/23

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta |  |
| Dash array | `dashArray` | string | Falta |  |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta |  |
| Color | `dataLabelColor` | fill | Falta |  |
| Value decimal places | `dataLabelDecimalPoints` | number | Falta |  |
| Display units | `dataLabelDisplayUnits` | labelDisplayUnits | Falta |  |
| Horizontal position | `dataLabelHorizontalPosition` | enum: Left, Right | Falta |  |
| Data label | `dataLabelShow` | boolean | Falta |  |
| Text | `dataLabelText` | enum: Data value, Name, Both | Falta |  |
| Vertical position | `dataLabelVerticalPosition` | enum: Above, Under | Falta |  |
| Name | `displayName` | string | Falta |  |
| Color | `lineColor` | fill | Falta |  |
| Position | `position` | enum: Behind, In front | Falta |  |
| Shade color | `shadeColor` | fill | Falta |  |
| Match line color | `shadeColorMatchStroke` | boolean | Falta |  |
| Shade region | `shadeRegion` | enum: Before, After, None | Falta |  |
| Show | `shadeShow` | boolean | Falta |  |
| Shade transparency | `shadeTransparency` | number | Falta |  |
| Show | `show` | boolean | Falta |  |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Value | `value` | number | Falta |  |
| Width | `width` | number | Falta |  |

### Línea de tendencia (`trend`) · P2 · 0/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta |  |
| Combine series | `combineSeries` | boolean | Falta |  |
| Dash array | `dashArray` | string | Falta |  |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta |  |
| Name | `displayName` | string | Falta |  |
| Color | `lineColor` | fill | Falta |  |
| Show | `show` | boolean | Falta |  |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Falta |  |
| Transparency | `transparency` | number | Falta |  |
| Use highlight values | `useHighlightValues` | boolean | Falta |  |
| Width | `width` | number | Falta |  |

### Múltiplos pequeños (`smallMultiplesLayout`) · P2 · 0/17

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Advanced padding options | `advancedPaddingOptions` | boolean | Falta |  |
| Background color | `backgroundColor` | fill | Falta |  |
| Background transparency | `backgroundTransparency` | number | Falta |  |
| Columns | `columnCount` | integer | Falta |  |
| Inner column padding | `columnPaddingInner` | number | Falta |  |
| Outer column padding | `columnPaddingOuter` | number | Falta |  |
| Color | `gridLineColor` | fill | Falta |  |
| Show | `gridLineShow` | boolean | Falta |  |
| Line style | `gridLineStyle` | enum: Solid, Dashed, Dotted | Falta |  |
| Transparency | `gridLineTransparency` | number | Falta |  |
| Gridlines | `gridLineType` | enum: All, Horizontal and vertical, Horizontal only, Vertical only | Falta |  |
| Width | `gridLineWidth` | number | Falta |  |
| Grid padding | `gridPadding` | number | Falta |  |
| Grid layout | `layoutType` | enum: Auto, Custom | Falta |  |
| Rows | `rowCount` | integer | Falta |  |
| Inner row padding | `rowPaddingInner` | number | Falta |  |
| Outer row padding | `rowPaddingOuter` | number | Falta |  |

### Anotaciones (`annotationTemplate`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| callout | `callout` | annotationTemplate | Falta |  |

### Barras de error (`error`) · P3 · 0/24

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
| Label format | `tooltipFormat` | enum: Absolute, Relative (numeric), Relative (percentage), Range | Falta |  |
| Show in tooltip | `tooltipShow` | boolean | Falta |  |

### Encabezado de múltiplos (`subheader`) · P3 · 0/10

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Alignment | `alignment` | alignment | Falta |  |
| Bold | `bold` | boolean | Falta |  |
| Font color | `fontColor` | fill | Falta |  |
| Font family | `fontFamily` | string | Falta |  |
| Text size | `fontSize` | fontSize | Falta |  |
| Italic | `italic` | boolean | Falta |  |
| Position | `position` | enum: Top, Bottom | Falta |  |
| Show | `show` | boolean | Falta |  |
| Word wrap | `titleWrap` | boolean | Falta |  |
| Underline | `underline` | boolean | Falta |  |

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

### Propiedades (`general`) · P1 · 9/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| High density sampling | `allowBinnedLineSample` | boolean | Tiene | General > Propiedades |
| High density sampling | `allowOverlappingPointsSample` | boolean | Tiene | General > Propiedades |
| Alt text | `altText` | string | Tiene | Formato > Texto alternativo |
| formatString | `formatString` | string | Parcial | Formato numérico (y_axis_format) |
| Height | `height` | number | Tiene | Posición y tamaño en celdas |
| Maintain layer order | `keepLayerOrder` | boolean | Tiene | General > Propiedades |
| Responsive | `responsive` | boolean | Excluido | El lienzo tiene tamaño fijo |
| responsiveLegacy | `responsiveLegacy` | boolean | Excluido | El lienzo tiene tamaño fijo |
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
