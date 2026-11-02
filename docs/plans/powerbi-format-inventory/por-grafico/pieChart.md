# Circular (`pieChart`)

Nuestro gráfico: pie. Generado desde `reportThemeSchema-2.159.json`.

## Visual


### Colores / barras (`dataPoint`) · P1 · 2/9

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Color | `borderColor` | fill | Falta |  |
| Match fill color | `borderColorMatchFill` | boolean | Falta |  |
| Hide inner borders | `borderOutlineOnly` | boolean | Falta |  |
| Border | `borderShow` | boolean | Falta |  |
| Width | `borderSize` | number | Falta |  |
| Transparency | `borderTransparency` | number | Falta |  |
| Default color | `defaultColor` | fill | Parcial | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Color | `fill` | fill | Parcial | Color por serie o esquema; revisar color por categoría (color_scheme) |
| Transparency | `fillTransparency` | number | Falta |  |

### Etiquetas de datos (`labels`) · P1 · 12/14

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Background | `background` | enum: Auto, On, Off | Tiene | Fondo de etiquetas (value_label_background) |
| Bold | `bold` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Color | `color` | fill | Tiene | Fuente de etiquetas (value_label_font) |
| Font family | `fontFamily` | string | Tiene | Fuente de etiquetas (value_label_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de etiquetas (value_label_font) |
| Italic | `italic` | boolean | Tiene | Fuente de etiquetas (value_label_font) |
| Display units | `labelDisplayUnits` | labelDisplayUnits | Parcial | Con código d3 (number_format) |
| Value decimal places | `labelPrecision` | integer | Parcial | Con código d3 (number_format) |
| Label style | `labelStyle` | enum: Category, Data value, Percent of total, Category, data value, Category, percent of total, Data value, percent of total, All detail lab | Tiene | Contenido de etiqueta (label_type) |
| Overflow text | `overflow` | boolean | Falta |  |
| % decimal places | `percentageLabelPrecision` | integer | Parcial | Con código d3 (number_format) |
| Label position | `position` | enum: Outside, Inside, Prefer outside, Prefer inside | Parcial | Solo dentro o fuera (labels_outside) |
| Show | `show` | boolean | Tiene | Mostrar etiquetas (show_labels) |
| Underline | `underline` | boolean | Falta |  |

### Leyenda (`legend`) · P1 · 7/10

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Bold | `bold` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Font family | `fontFamily` | string | Tiene | Fuente de leyenda (legend_font) |
| Text size | `fontSize` | fontSize | Tiene | Fuente de leyenda (legend_font) |
| Italic | `italic` | boolean | Tiene | Fuente de leyenda (legend_font) |
| Color | `labelColor` | fill | Tiene | Fuente de leyenda (legend_font) |
| Position | `position` | enum: Top left, Top center, Top right, Top left stacked, Top right stacked, Center left, Center right, Bottom left, Bottom center, Bottom ri | Tiene | Posición (legendOrientation) |
| Show | `show` | boolean | Tiene | Mostrar leyenda (show_legend) |
| Title | `showTitle` | boolean | Falta |  |
| Legend Name | `titleText` | string | Falta |  |
| Underline | `underline` | boolean | Falta |  |

### Porciones (`slices`) · P1 · 1/2

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| Inner radius | `innerRadiusRatio` | integer | Tiene | Radio interior (innerRadius) |
| Start angle | `startAngle` | integer | Falta |  |

### Anotaciones (`annotationTemplate`) · P3 · 0/1

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| callout | `callout` | annotationTemplate | Falta |  |

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

### Propiedades (`general`) · P1 · 9/9

| Opción | Clave | Valores | Estado | Nota |
| --- | --- | --- | --- | --- |
| High density sampling | `allowBinnedLineSample` | boolean | Tiene | General > Propiedades |
| High density sampling | `allowOverlappingPointsSample` | boolean | Tiene | General > Propiedades |
| Alt text | `altText` | string | Tiene | Formato > Texto alternativo |
| formatString | `formatString` | string | Parcial | Formato numérico (number_format) |
| Height | `height` | number | Tiene | Posición y tamaño en celdas |
| Maintain layer order | `keepLayerOrder` | boolean | Tiene | General > Propiedades |
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
