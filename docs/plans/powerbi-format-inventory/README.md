# Inventario de opciones de formato de Power BI

Fecha: 2026-11-02 · Fuente: `reportThemeSchema-2.159.json`, publicado por Microsoft en
[powerbi-desktop-samples](https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema).

**Estado:** inventario y propuesta, sin implementar. El plan por fases está en
[`2026-11-02-plan-formato-powerbi.md`](../2026-11-02-plan-formato-powerbi.md), y sustituye al orden de este documento.

## Resultado

- **Hay 1,883 opciones distintas** en 130 secciones, sin contar mapas. En un gráfico de barras son 504.
- **Cubrimos más de la mitad:** de las 491 que aplican en barras agrupadas, tenemos 291 y otras 20 a medias.
- **No hay que hacer 1,883 controles.** Casi todo se repite entre gráficos (fuente, color, transparencia,
  borde), así que se resuelve con un registro declarativo y unos 10 tipos de control.
- **Un solo panel:** desde la fase 1 todo el formato está en la pestaña Formato del tablero.

## Archivos

| Archivo | Contenido |
| --- | --- |
| [`por-grafico/`](por-grafico/) | Un documento por visual: secciones, opciones, valores y estado |
| [`opciones.csv`](opciones.csv) | Las 13,853 filas (visual × opción), para filtrar en una hoja de cálculo |

Ejemplos: [barras agrupadas](por-grafico/clusteredBarChart.md), [líneas](por-grafico/lineChart.md),
[tabla](por-grafico/tableEx.md), [matriz](por-grafico/pivotTable.md).

Estados:

- **Tiene:** existe un control equivalente en ese gráfico.
- **Parcial:** existe, pero es más limitado (por ejemplo, código d3 en lugar de unidades y decimales).
- **Falta:** no encontré equivalente.
- **Excluido:** interno o de una función que no tenemos, como Copilot o comentarios.
- **Por decidir:** mapas, sin cruzar.

Prioridades: **P1** lo básico de cada gráfico; **P2** tooltips, líneas de referencia, zoom, múltiplos y
minigráficos; **P3** el resto.

## Cobertura por gráfico

| Gráfico | Opciones | Tiene | Parcial | Falta P1 | Falta P2 | Falta P3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Barras agrupadas | 491 | 291 | 20 | 28 | 117 | 35 |
| Columnas agrupadas | 491 | 291 | 20 | 28 | 117 | 35 |
| Líneas | 629 | 321 | 22 | 61 | 159 | 66 |
| Área | 547 | 321 | 21 | 61 | 133 | 11 |
| Línea y columnas agrupadas | 580 | 348 | 19 | 39 | 133 | 41 |
| Cascada | 299 | 181 | 6 | 71 | 41 | 0 |
| Embudo | 219 | 174 | 10 | 20 | 15 | 0 |
| Dispersión | 410 | 244 | 17 | 33 | 116 | 0 |
| Circular | 222 | 189 | 10 | 13 | 9 | 1 |
| Anillo | 266 | 190 | 10 | 46 | 9 | 11 |
| Treemap | 217 | 174 | 8 | 26 | 9 | 0 |
| Medidor | 219 | 175 | 10 | 25 | 9 | 0 |
| Tarjeta | 204 | 182 | 6 | 6 | 9 | 1 |
| KPI | 229 | 179 | 8 | 33 | 9 | 0 |
| Tabla | 264 | 186 | 15 | 44 | 17 | 2 |
| Matriz | 335 | 176 | 6 | 126 | 25 | 2 |
| Segmentador | 302 | 28 | 14 | 66 | 55 | 139 |
| Segmentador de lista | 575 | 22 | 14 | 125 | 130 | 284 |
| Ribbon (no tenemos el gráfico) | 491 | 22 | 13 | 194 | 147 | 115 |
| Tarjeta de varias filas (no la tenemos) | 213 | 22 | 13 | 33 | 74 | 71 |

Lo que más se queda atrás: **matriz**, sin controles de estilo propios; **cascada, embudo, treemap y
medidor**, sin las secciones compartidas de ejes, leyenda y etiquetas; y **segmentadores**.

## Ejemplo: lo que falta en barras

- **Eje X:** tamaño máximo (el «ancho máximo» de la captura 03), ancho mínimo de categoría, relleno
  exterior, concatenar etiquetas, cambiar de posición, estilo del título, subrayado.
- **Eje Y:** cambiar de posición, estilo del título, redondear rango, eje compartido, subrayado.
- **Cuadrícula:** transparencia y guiones. Hoy además es una sola opción para los dos ejes.
- **Etiquetas de datos:** posición, ancho máximo, densidad, disposición, desbordamiento, personalizar por
  serie, y los bloques Título, Valor y Detalle con formato propio.
- **Leyenda:** título, subrayado.
- **Barras:** transparencia de relleno y de borde, borde igual al relleno.
- **Secciones enteras:** fondo del área de trazado, líneas de referencia, línea de tendencia, barras de
  error, control de zoom con formato, formato de múltiplos, tooltips con formato, Acción.
- **General:** fuente, subrayado y ajuste del título; texto alternativo; sombra detallada (color, ángulo,
  desenfoque); relleno por lado.

## Cómo debería verse

Propuesta para que más opciones no signifique más desorden:

1. **Un solo panel de formato.** Al seleccionar un visual aparece su formato en el panel del tablero.
   Reúne lo que hoy está en Formato (`meta.mibiFormat`) y Personalizar (`form_data`).
2. **Dos pestañas, Visual y General,** como en Power BI, separadas de Datos y Analítica.
3. **Buscador** arriba, que filtra opciones y abre su sección.
4. **Secciones plegables con interruptor en el encabezado** y «Restablecer» por sección. Solo una abierta
   a la vez, para no perder el sitio.
5. **Subgrupos dentro de cada sección,** como en Power BI: Eje Y > Valores, Título, Disposición.
6. **«Aplicar a»** para elegir serie o categoría, arriba de las secciones que lo admiten.
7. **Controles compactos y consistentes:** fila de fuente (familia, tamaño, negrita, cursiva, subrayado),
   color con transparencia, botón `fx` para reglas, unidades y decimales en vez de código d3.
8. **Valores heredados visibles:** distinguir lo que viene del estilo compartido de lo cambiado aquí.
9. **Vista previa inmediata,** sin volver a consultar los datos.
10. **Solo lo que aplica:** opciones dependientes deshabilitadas, sin secciones vacías.

## Cómo implementarlo

Un registro declarativo evita escribir cada control a mano:

```ts
// Sketch: one definition per section, shared across charts
const valueAxis: FormatCard = {
  id: 'valueAxis',
  title: t('Y axis'),
  toggle: 'y_axis_show',
  groups: [
    { title: t('Values'), controls: [font('y_axis_label_font'), units('y_axis_units')] },
    { title: t('Title'), controls: [text('y_axis_title'), font('y_axis_title_font')] },
  ],
};
```

Cada gráfico declara qué secciones usa, y el panel se dibuja a partir de eso. Encaja con lo que ya hay:
`sections/visualFormat.tsx`, `FontControl`, `SeriesColorsControl` y `formatting.ts`.

### Orden

1. **Panel único.** Registro, pestañas, buscador y secciones, migrando las opciones actuales sin añadir
   nuevas. Es la base de todo lo demás.
2. **Lo común a todos (P1).** General completo: título, sombra, relleno, alt text. Sirve a todos los
   gráficos a la vez.
3. **Barras, columnas, líneas y áreas (P1).** Ejes, etiquetas, leyenda y colores. Son la mayoría de los
   gráficos de SESEQ.
4. **Tabla y matriz (P1).** Encabezados, valores, totales, subtotales, columna específica.
5. **Tarjeta, KPI, circular y anillo (P1).**
6. **Cascada, embudo, treemap, medidor y dispersión (P1).** Sobre todo conectarlos a las secciones
   compartidas.
7. **Segmentadores.** Botones, lista y entrada, con su formato.
8. **P2 en todos.** Tooltips, líneas de referencia, área de trazado, zoom, múltiplos, minigráficos.
9. **Mapas.** Decidir primero qué motor usamos.

## Decisiones pendientes

- **Alcance «absolutamente todo»:** recomiendo P1 y P2 en los gráficos que tenemos. P3 incluye barras de
  error, anomalías y detalles como el remate de los guiones, de poco uso.
- **Líneas de referencia:** quitamos las capas de anotación, y estas opciones necesitan otro mecanismo.
- **Límites de ECharts:** algunas opciones pueden no tener equivalente directo. Se ven al implementar
  cada sección.
- **Gráficos que no tenemos:** Ribbon y Tarjeta de varias filas.

## Límites de este inventario

- **Es el esquema de temas, no la interfaz.** Es la lista más completa que publica Microsoft, pero algunas
  claves pueden no verse en el panel, y los títulos están en inglés. No incluye los campos de cada gráfico
  (el README de la investigación sí) ni reglas `fx`.
- **El estado sale de comparar nombres de controles** con reglas escritas para esta revisión, no de probar
  cada opción. Un «Tiene» significa que el control existe, no que funcione igual. Un «Falta» puede tener
  un equivalente que no detecté, sobre todo en tablas y en opciones dentro de `column_config`.
- **Mapas sin cruzar:** 1,103 filas quedan como «Por decidir».
- **Los estados se cambian en las reglas de `scripts/mibi/format_inventory.py`,** no a mano: regenerar sobrescribe `opciones.csv`.
