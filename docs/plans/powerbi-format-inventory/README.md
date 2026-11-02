# Inventario de opciones de formato de Power BI

Fecha: 2026-11-02 · Fuente: `reportThemeSchema-2.159.json`, publicado por Microsoft en
[powerbi-desktop-samples](https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema).

**Estado actual:** en [`estado-formato-powerbi.md`](../estado-formato-powerbi.md). El detalle por fases está en
[`2026-11-02-plan-formato-powerbi.md`](../2026-11-02-plan-formato-powerbi.md).

## Resultado

- **Hay 1,883 opciones distintas** en 130 secciones, sin contar mapas. En un gráfico de barras son 504.
- **Cubrimos más de la mitad:** de las 491 que aplican en barras agrupadas, tenemos 291 y otras 20 a medias.
- **No hay que hacer 1,883 controles.** Casi todo se repite entre gráficos (fuente, color, transparencia,
  borde), así que se resuelve con un registro declarativo y unos 10 tipos de control.
- **Un solo panel:** desde la fase 1 todo el formato está en la pestaña Formato del tablero.

## Archivos

| Archivo | Contenido |
| --- | --- |
| [`cobertura.md`](cobertura.md) | Cuánto tenemos de cada gráfico |
| [`pendientes.md`](pendientes.md) | Lo que falta, por fase y sección |
| [`por-grafico/`](por-grafico/) | Un documento por visual: secciones, opciones, valores y estado |
| [`opciones.csv`](opciones.csv) | Las 13,853 filas (visual × opción), para filtrar en una hoja de cálculo |

Ejemplos: [barras agrupadas](por-grafico/clusteredBarChart.md), [líneas](por-grafico/lineChart.md),
[tabla](por-grafico/tableEx.md), [matriz](por-grafico/pivotTable.md).

Estados:

- **Tiene:** existe un control equivalente en ese gráfico.
- **Parcial:** existe, pero es más limitado (por ejemplo, código d3 en lugar de unidades y decimales).
- **Falta:** no hay equivalente; la nota dice si es porque el motor de gráficos no lo permite.
- **Excluido:** interno o de una función que no tenemos, como Copilot o comentarios.
- **Por decidir:** mapas, sin cruzar.

Prioridades: **P1** lo básico de cada gráfico; **P2** tooltips, líneas de referencia, zoom, múltiplos y
minigráficos; **P3** el resto.

## Cobertura por gráfico

Está en [`cobertura.md`](cobertura.md), y lo que falta, en [`pendientes.md`](pendientes.md). Se generan con el inventario.

## Cómo se pensó el panel

Criterios de la propuesta original, ya aplicados en la fase 1:

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

## Límites de este inventario

- **Es el esquema de temas, no la interfaz.** Es la lista más completa que publica Microsoft, pero algunas
  claves pueden no verse en el panel, y los títulos están en inglés. No incluye los campos de cada gráfico
  (el README de la investigación sí) ni reglas `fx`.
- **El estado sale de comparar nombres de controles** con reglas escritas para esta revisión, no de probar
  cada opción. Un «Tiene» significa que el control existe, no que funcione igual. Un «Falta» puede tener
  un equivalente que no detecté, sobre todo en tablas y en opciones dentro de `column_config`.
- **Mapas sin cruzar:** 1,103 filas quedan como «Por decidir».
- **Los estados se cambian en las reglas de `scripts/mibi/format_inventory.py`,** no a mano: regenerar sobrescribe `opciones.csv`.
