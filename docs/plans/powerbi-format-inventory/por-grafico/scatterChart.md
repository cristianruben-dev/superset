# Dispersión (`scatterChart`)

Nuestro gráfico: scatter. Generado desde `reportThemeSchema-2.159.json`.

## Visual


### Colores / barras (`dataPoint`) · P1 · 4/4

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Default color | `defaultColor` | fill | Tiene | Color por categoría y color predeterminado |
| Default color | `fill` | fill | Tiene | Color por categoría y color predeterminado |
| Color saturation | `fillRule` | fillRule | Parcial | Escala continua de dos colores; sin reglas por campo |
| Show all | `showAllDataPoints` | boolean | Tiene | Color por categoría y color predeterminado |

### Eje X / categorías (`categoryAxis`) · P1 · 30/38

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Style | `axisStyle` | enum: Show title only, Show unit only, Show both | Falta | El eje muestra sus valores y su título, sin elegir entre ellos |
| Type | `axisType` | enum: Continuous, Categorical | Parcial | Sale del tipo de la columna; se fuerza con «Forzar categórico» |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
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
| Space between categories | `innerPadding` | integer | Excluido | Sin categorías: el eje es numérico |
| Invert range | `invertAxis` | boolean | Tiene | Invertir eje X (x_axis_inverse) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Color | `labelColor` | fill | Tiene | Fuente de etiquetas X (x_axis_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Tiene | Sección del eje |
| Value decimal places | `labelPrecision` | integer | Tiene | Sección del eje |
| Logarithmic scale | `logAxisScale` | boolean | Tiene | Eje X logarítmico, solo en un eje numérico |
| Maximum size | `maxMarginFactor` | integer | Parcial | Ancho máximo de etiqueta en píxeles, no en % del gráfico |
| Outer padding | `outerPadding` | integer | Falta | El motor de gráficos no tiene relleno exterior de categorías |
| Minimum category width | `preferredCategoryWidth` | number | Tiene | Eje X > Categorías |
| Round range | `roundRange` | boolean | Falta | El motor de gráficos redondea el eje salvo con límites fijos |
| Show | `show` | boolean | Tiene | Ocultar eje X (x_axis_hidden) |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje X (x_axis_label/x_axis_title) |
| Minimum | `start` | number/string | Parcial | Solo ejes numéricos (truncateXAxis/xAxisBounds) |
| Bold | `titleBold` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título X (x_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título X (x_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título X (x_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título X (x_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje X (x_axis_label/x_axis_title) |
| Underline | `titleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Show blank values | `treatNullsAsZero` | boolean | Falta | Un valor nulo no dibuja marca |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Eje Y / valores (`valueAxis`) · P1 · 27/33

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
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
| Show | `show` | boolean | Tiene | Ocultar eje Y (y_axis_hidden) |
| Title | `showAxisTitle` | boolean | Tiene | Título del eje Y (y_axis_label/y_axis_title) |
| Minimum | `start` | number/string | Tiene | Límites del eje Y (y_axis_bounds) |
| Switch axis position | `switchAxisPosition` | boolean | Tiene | Sección del eje |
| Bold | `titleBold` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Title color | `titleColor` | fill | Tiene | Fuente de título Y (y_axis_title_font) |
| Font family | `titleFontFamily` | string | Tiene | Fuente de título Y (y_axis_title_font) |
| Title text size | `titleFontSize` | fontSize | Tiene | Fuente de título Y (y_axis_title_font) |
| Italic | `titleItalic` | boolean | Tiene | Fuente de título Y (y_axis_title_font) |
| Axis title | `titleText` | string | Tiene | Título del eje Y (y_axis_label/y_axis_title) |
| Underline | `titleUnderline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |
| Show blank values | `treatNullsAsZero` | boolean | Falta | Un valor nulo no dibuja marca |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Etiqueta de categoría (`categoryLabels`) · P1 · 6/10

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `backgroundColor` | fill | Falta | El título de la etiqueta no tiene fondo propio |
| Transparency | `backgroundTransparency` | number | Falta | El título de la etiqueta no tiene fondo propio |
| Bold | `bold` | boolean | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Color | `color` | fill | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Show background | `enableBackground` | boolean | Falta | El título de la etiqueta no tiene fondo propio |
| Font family | `fontFamily` | string | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Text size | `fontSize` | fontSize | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Italic | `italic` | boolean | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Show | `show` | boolean | Parcial | Título de la etiqueta con la serie o la categoría, con su fuente |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Leyenda (`legend`) · P1 · 9/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bold | `bold` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Font family | `fontFamily` | string | Tiene | Fuente de leyenda (legend_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de leyenda (legend_font) |
| Italic | `italic` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Color | `labelColor` | fill | Tiene | Fuente de leyenda (legend_font) |
| Position | `position` | enum: Top left, Top center, Top right, Top left stacked, Top right stacked, Center left, Center right, Bottom left, Bottom center, Bottom ri | Tiene | Posición (legendOrientation) |
| Show | `show` | boolean | Tiene | Mostrar leyenda (show_legend) |
| Show | `showGradientLegend` | boolean | Falta | Sin leyenda para la escala de color |
| Title | `showTitle` | boolean | Tiene | Título de leyenda |
| Legend Name | `titleText` | string | Tiene | Título de leyenda |
| Underline | `underline` | boolean | Falta | El motor de gráficos no dibuja texto subrayado |

### Marcadores (`markers`) · P1 · 7/7

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `borderColor` | fill | Tiene | Colores y bordes |
| Match fill color | `borderColorMatchFill` | boolean | Tiene | Colores y bordes |
| Border | `borderShow` | boolean | Tiene | Colores y bordes |
| Transparency | `borderTransparency` | number | Tiene | Colores y bordes |
| Width | `borderWidth` | number | Tiene | Colores y bordes |
| Rotation | `rotation` | number | Tiene | Colores y series > Marcadores |
| Transparency | `transparency` | number | Tiene | Colores y series > Marcadores |

### bubbles (`bubbles`) · P1 · 3/5

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Size multiplier | `bubbleSize` | integer | Tiene | Multiplicador del tamaño de las burbujas |
| Range scaling | `markerRangeType` | enum: Magnitude, Data range, Auto | Falta | Sin ajuste de escala para contener marcadores ni modos de rango |
| Type | `markerShape` | enum: ●, ■, ◆, ▲, ☓, -, —, + | Tiene | Forma del marcador (series_marker_symbol) |
| Auto-fit markers | `preventOverflow` | boolean | Falta | Sin ajuste de escala para contener marcadores ni modos de rango |
| Customize series | `showSeries` | boolean | Tiene | Aplicar a una serie |

### Control deslizante de zoom (`zoom`) · P2 · 1/11

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| categoryMax | `categoryMax` | number | Falta |  |
| categoryMin | `categoryMin` | number | Falta |  |
| categorySize | `categorySize` | number | Falta |  |
| Show | `show` | boolean | Parcial | Control de zoom, sin formato (zoomable) |
| Slider labels | `showLabels` | boolean | Falta |  |
| X axis | `showOnCategoryAxis` | boolean | Falta |  |
| Y axis | `showOnValueAxis` | boolean | Falta |  |
| Slider tooltips | `showTooltip` | boolean | Falta |  |
| valueMax | `valueMax` | number | Falta |  |
| valueMin | `valueMin` | number | Falta |  |
| valueSize | `valueSize` | number | Falta |  |

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
| Value | `value` | number | Falta |  |
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

### Línea de tendencia (`trend`) · P2 · 0/10

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
| Width | `width` | number | Falta |  |

### colorBorder (`colorBorder`) · P2 · 1/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Show | `show` | boolean | Tiene | Colores y series |

### colorByCategory (`colorByCategory`) · P2 · 1/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Show | `show` | boolean | Tiene | Colores y series |

### fillPoint (`fillPoint`) · P2 · 1/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Style | `style` | enum: Fill only, Border only | Tiene | Forma y relleno del marcador |

### plotAreaShading (`plotAreaShading`) · P2 · 4/5

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Name | `displayName` | string | Falta | El sombreado no tiene nombre |
| Lower shading | `lowerShadingColor` | fill | Tiene | Semiplanos reales respecto de y=x; solo ejes numéricos lineales |
| Show | `show` | boolean | Tiene | Semiplanos reales respecto de y=x; solo ejes numéricos lineales |
| Transparency | `transparency` | number | Tiene | Semiplanos reales respecto de y=x; solo ejes numéricos lineales |
| Upper shading | `upperShadingColor` | fill | Tiene | Semiplanos reales respecto de y=x; solo ejes numéricos lineales |

### ratioLine (`ratioLine`) · P2 · 7/9

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Scale by width | `autoScale` | boolean | Falta | El motor de gráficos no escala el trazo con el zoom |
| Dash array | `dashArray` | string | Tiene | Patrón de guiones |
| Dash cap | `dashCap` | enum: Flat, Round, Square | Falta | Los extremos no se eligen en esta línea |
| Name | `displayName` | string | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |
| Color | `lineColor` | fill | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |
| Show | `show` | boolean | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |
| Line style | `style` | enum: Solid, Dashed, Dotted, Custom | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |
| Transparency | `transparency` | number | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |
| Width | `width` | number | Tiene | Línea y=x sobre el intervalo visible; solo ejes numéricos lineales |

### currentFrameIndex (`currentFrameIndex`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| index | `index` | number | Excluido | Estado interno, no es una opción de formato |

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

### Propiedades (`general`) · P1 · 9/12

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| High density sampling | `allowBinnedLineSample` | boolean | Tiene | General > Propiedades |
| High density sampling | `allowOverlappingPointsSample` | boolean | Tiene | General > Propiedades |
| Alt text | `altText` | string | Tiene | Formato > Texto alternativo |
| Data Volume | `dataVolume` | integer | Falta |  |
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
