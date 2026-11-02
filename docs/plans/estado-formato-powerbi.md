# Estado de la paridad con Power BI

**Empieza aquí.** Es el resumen de todo: qué fases hay, qué llevamos, qué tenemos y qué falta.

Actualizado: 2026-11-02, al cerrar la fase 3 (`d4ccfc9c9c`). Siguiente: **fase 4, tabla y matriz.**

## Dónde está cada cosa

| Quiero ver | Archivo |
| --- | --- |
| Qué falta, por fase, opción por opción | [`pendientes.md`](powerbi-format-inventory/pendientes.md) |
| Cuánto tenemos de cada gráfico | [`cobertura.md`](powerbi-format-inventory/cobertura.md) |
| Qué tenemos y qué falta de un gráfico | [`por-grafico/`](powerbi-format-inventory/por-grafico/), como [barras agrupadas](powerbi-format-inventory/por-grafico/clusteredBarChart.md) o [tabla](powerbi-format-inventory/por-grafico/tableEx.md) |
| Todo junto, para filtrar en una hoja de cálculo | [`opciones.csv`](powerbi-format-inventory/opciones.csv), 13,853 filas |
| Detalle, resultados y decisiones de cada fase | [`2026-11-02-plan-formato-powerbi.md`](2026-11-02-plan-formato-powerbi.md) |
| De dónde sale el inventario y sus límites | [`powerbi-format-inventory/README.md`](powerbi-format-inventory/README.md) |
| Comparación de experiencia con Power BI | [`2026-11-02-investigacion-ux-powerbi.md`](2026-11-02-investigacion-ux-powerbi.md) |

`cobertura.md`, `pendientes.md`, `por-grafico/` y `opciones.csv` los genera `scripts/mibi/format_inventory.py`.

## Las fases

| Fase | Qué | Estado | Opciones abiertas |
| ---: | --- | --- | ---: |
| 0 | Comprobaciones y seguimiento | **Hecha** | - |
| 1 | Panel único de formato | **Hecha** | - |
| 2 | General, común a todos | **Hecha** | 9 |
| 3 | Barras, columnas, líneas, áreas y combinados | **Hecha** | 104 |
| 4 | Tabla y matriz | **Siguiente** | 149 |
| 5 | Tarjeta, KPI, circular y anillo | Pendiente | 105 |
| 6 | Cascada, embudo, treemap, medidor y dispersión | Pendiente | 161 |
| 7 | Segmentadores | Pendiente | 763 |
| 8 | Análisis y tooltips | Pendiente | 132 |
| 9 | Páginas tooltip y restablecer filtros | Pendiente | Fuera del inventario |
| 10 | Campos y panel de datos | Pendiente | Fuera del inventario |
| 11 | Mapas | Sin decidir el motor | 429 |
| 12 | Resto de P3 y gráficos nuevos | Opcional | 940 |

**Hecha no significa cero.** Las opciones abiertas de una fase hecha son las que el motor de gráficos no permite, las
que dependen de otra fase o las que quedaron a medias. Una opción se cuenta una vez por fase, y puede repetirse en varias.

## Lo que ya tenemos

- **Panel único:** niveles Visual y General, búsqueda, restablecer por sección, deshacer y guardar con el tablero. Cambiar
  el formato repinta sin volver a consultar.
- **General, en todos los gráficos:** título, subtítulo, divisor, fondo, borde, sombra, relleno, espaciado, iconos del
  encabezado, texto de ayuda, formato de tooltips (solo gráficos ECharts), acción, botón de acción, propiedades y texto alternativo.
- **Barras, líneas, áreas y combinados:**
  - **Ejes:** cuadrícula propia, cambiar de lado, unidades y decimales, escala logarítmica, ancho máximo y desplazamiento.
  - **Etiquetas:** posición, transparencia, desbordamiento y bloques Título, Valor y Detalle.
  - **Leyenda:** título y color igual a la serie.
  - **Colores:** por serie y por categoría, escala de dos colores, transparencias, bordes y superposición.
  - **Líneas y marcadores:** interpolación, guiones, sombreado y formato de marcadores.
  - **Por serie:** «Aplicar a una serie».
  - **Extras:** etiquetas de total y de serie, y color o imagen del área de trazado.

## Cobertura

| Gráfico | Tenemos | A medias | Faltan |
| --- | ---: | ---: | ---: |
| Barras y columnas agrupadas | 291 de 491 | 20 | 180 |
| Barras y columnas apiladas | 301 de 491 | 20 | 170 |
| Líneas | 321 de 629 | 22 | 286 |
| Área apilada | 332 de 531 | 22 | 177 |
| Línea y columnas agrupadas | 348 de 580 | 19 | 213 |
| Dispersión | 244 de 410 | 17 | 149 |
| Tabla | 186 de 264 | 15 | 63 |
| Matriz | 176 de 335 | 6 | 153 |
| Tarjeta | 182 de 204 | 6 | 16 |
| KPI | 179 de 229 | 8 | 42 |
| Circular | 189 de 222 | 10 | 23 |
| Anillo | 190 de 266 | 10 | 66 |
| Cascada | 181 de 299 | 6 | 112 |
| Embudo | 174 de 219 | 10 | 35 |
| Treemap | 174 de 217 | 8 | 35 |
| Medidor | 175 de 219 | 10 | 34 |
| Segmentador | 28 de 302 | 14 | 260 |

Las cifras salen de comparar nombres de controles, no de probar cada opción: un «tenemos» dice que el control existe, no
que funcione igual que en Power BI. En muchos gráficos, buena parte de lo que tenemos es el nivel General. Mapas, Ribbon,
Tarjeta de varias filas y la tarjeta nueva están en `cobertura.md`.

## Lo que falta

### Lo que queda abierto en las fases hechas

- **El motor no lo permite:** subrayado de texto, líneas guía de etiquetas, relleno exterior de categorías, separar segmentos
  de una pila, degradado por tramo de línea, transparencia de la imagen de fondo y escalar trazos con el zoom.
- **A medias:** densidad de etiquetas, imagen de fondo (por dirección, sin subirla ni ajustarla), detalle de etiqueta (no otro
  campo), etiquetas de serie (solo al final) y escala de color (dos colores).
- **Dependen de otra fase:** páginas tooltip (9), campos de tooltip (8) y detalle desde una marca.
- **Segundo eje en líneas y áreas:** esos gráficos no lo tienen; está en el combinado.

### Las fases pendientes

- **4, tabla y matriz:** encabezados, valores, totales, subtotales, cuadrícula, formato por columna, modo escalonado y minigráficos.
- **5, tarjeta, KPI, circular y anillo:** valor y etiqueta, indicador y objetivo, porciones y valor central.
- **6, cascada, embudo, treemap, medidor y dispersión:** conectarlos a las secciones de la fase 3 y añadir lo propio.
- **7, segmentadores:** variantes de botones, lista y entrada, con su formato. Son 455 opciones P3 que se decidirían después.
- **8, análisis y tooltips:** líneas de referencia y tendencia, zoom con formato, múltiplos pequeños y campos de tooltip.
- **9, paridad de reporte:** páginas tooltip, lo que más le falta a SESEQ, y restablecer filtros. No depende del panel.
- **10, campos y panel de datos:** campos por rol, como Eje X, Leyenda y Valores, y panel Datos junto al lienzo.
- **11, mapas:** decidir el motor antes de nada.
- **12, opcional:** barras de error, anomalías, pronóstico, y gráficos por construir como Ribbon.

## Decisiones pendientes

1. **Alcance:** recomiendo P1 y P2 en los gráficos que tenemos, y P3 solo si se pide.
2. **Fase 4:** seguir con `plugin-chart-table` o pasar a `plugin-chart-ag-grid-table`.
3. **Fase 5:** el KPI compara con un periodo anterior, y Power BI con un campo objetivo.
4. **Fase 11:** qué motor de mapas usar.
5. **Orden:** la fase 9 puede adelantarse a la 4, porque es lo que más le falta a SESEQ.

## Pendiente antes de subir

- `pre-commit run --all-files`, dentro del contenedor.
- 3 errores de lint en `useCellMove.ts`, de antes de estas fases.
- Probar con un archivo real la exportación a PDF o PNG, y copiar imagen en un navegador normal.
