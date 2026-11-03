# Estado de la paridad con Power BI

**Empieza aquí.** Es el resumen de todo: qué fases hay, qué llevamos, qué tenemos y qué falta.

Actualizado: 2026-11-02, con las fases 7 y 8 hechas. Faltan sobre todo la P3 de segmentadores (454 opciones), las páginas tooltip y los campos. Siguiente: **fase 9**.

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
| 4 | Tabla y matriz | **Hecha** | 12 |
| 5 | Tarjeta, KPI, circular y anillo | **Hecha** | 38 |
| 6 | Cascada, embudo, treemap, medidor y dispersión | **Hecha** | 63 |
| 7 | Segmentadores | **Hecha con límites** | 710 |
| 8 | Análisis y tooltips | **Hecha con límites** | 57 |
| 9 | Páginas tooltip y restablecer filtros | **Siguiente** | Fuera del inventario |
| 10 | Campos y panel de datos | Pendiente | Fuera del inventario |
| 11 | Mapas | Sin decidir el motor | 429 |
| 12 | Resto de P3 y gráficos nuevos | Opcional | 927 |

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

La fase 4 añade encabezados de columna y fila, valores, totales y subtotales con estilo propio, cuadrícula por dirección, contornos, anchos y ajuste de texto. También formato por columna, unidades y decimales, barras e iconos, enlaces seguros, disposición escalonada, expansión por dirección, etiquetas y selección de subtotales por nivel, filas en blanco y minigráficos.

Las fases 5 y 6 reutilizan el motor ECharts y el formato compartido. Las metas y las etiquetas que nombran datos quedan fuera de copiar formato y aplicar a todos. Un objetivo consultado cambia la consulta de datos; su apariencia y un objetivo manual solo repintan.

**Validación de las fases 4, 5 y 6:** tests de los archivos tocados, lint de esos archivos, compilación y captura de referencia de los 15 gráficos, con el tablero 147 restaurado. En el navegador: formato de tabla, matriz, tarjeta, KPI (objetivo fijo y por métrica), anillo, embudo, treemap, cascada, medidor y dispersión con línea y sombreado; cambios desde el panel sin consultas nuevas; restablecer; y sección por gráfico sin opciones repetidas. Las burbujas solo tienen tests. La cobertura sale de comparar controles: no se probó cada opción una por una.

La fase 7 añade segmentadores de lista, botones y texto, con disposición, búsqueda, seleccionar todo, marca de selección y formato de encabezado y valores, con estados al pasar el puntero y al seleccionar. La fase 8 añade el nivel Analítica: líneas de referencia constantes y calculadas con etiqueta y sombreado, línea de tendencia, deslizadores de zoom, campos de tooltip y múltiplos pequeños.

**Validación de las fases 7 y 8:** tests de los archivos tocados y comprobación con datos del tablero 147: las cuatro variantes filtran los gráficos, las líneas de referencia y la tendencia se dibujan en barras, líneas, combinado y cascada, el zoom en líneas y área, el tooltip añade su campo, los múltiplos dividen un gráfico y añadir una línea desde el panel no consulta datos.

## Cobertura

| Gráfico | Tenemos | A medias | Faltan |
| --- | ---: | ---: | ---: |
| Barras y columnas agrupadas | 366 de 491 | 28 | 97 |
| Barras y columnas apiladas | 301 de 491 | 20 | 170 |
| Líneas | 321 de 629 | 22 | 286 |
| Área apilada | 332 de 531 | 22 | 177 |
| Línea y columnas agrupadas | 348 de 580 | 19 | 213 |
| Dispersión | 264 de 409 | 21 | 124 |
| Tabla | 242 de 264 | 10 | 12 |
| Matriz | 308 de 334 | 11 | 15 |
| Tarjeta | 189 de 204 | 6 | 9 |
| KPI | 209 de 229 | 11 | 9 |
| Circular | 205 de 222 | 5 | 12 |
| Anillo | 223 de 266 | 7 | 36 |
| Cascada | 242 de 299 | 11 | 46 |
| Embudo | 201 de 219 | 6 | 12 |
| Treemap | 197 de 217 | 5 | 15 |
| Medidor | 191 de 219 | 16 | 12 |
| Segmentador | 46 de 302 | 13 | 243 |
| Segmentador de lista | 61 de 575 | 13 | 501 |
| Segmentador de botones | 61 de 452 | 13 | 378 |

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

### Las demás fases y los límites de las implementadas

- **4, hecha con límites:** anchos por cada valor generado de la jerarquía, jerarquías compuestas y fijación de encabezados de fila siguen sin equivalente. Los minigráficos usan los datos ya consultados: grupos de columnas en matriz y listas numéricas en tabla. Las dos opciones P3 de accesibilidad siguen pendientes.
- **5, hecha con límites:** tarjetas con tipografía por bloque, unidades, decimales, ajuste y subrayado. KPI con objetivo fijo o métrica, distancia, colores de estado, icono, fecha y tendencia. Circular/anillo con rotación, etiquetas y centro. Falta imagen central, etiqueta central independiente y parte de su ajuste; la distancia ofrece valor o porcentaje, no ambos a la vez.
- **6, hecha con límites:** estilos comunes, conectores de cascada, porcentajes de conversión, espacios del treemap, objetivo numérico del medidor, tamaño de burbujas, línea y=x y sombreado geométrico en ejes numéricos lineales. Siguen pendientes el máximo de desgloses con Otros, algoritmos alternativos de treemap, objetivo por campo en medidor, contención automática y modos de rango de marcadores.
- **7, hecha con límites:** quedan 134 P1 y 122 P2 de detalle (esquinas individuales, barra de acento, píldoras, imagen en la disposición) y 454 P3 (estados por botón, efectos de imagen, ajuste de fechas y deslizador). El menú de la lista desplegable no se formatea.
- **8, hecha con límites:** sin deslizador del eje secundario, los límites del zoom van en porcentaje, los múltiplos no tienen formato de cuadrícula ni encabezado propio, y los campos de tooltip solo están en barras, líneas, áreas y dispersión.
- **9, paridad de reporte:** páginas tooltip, lo que más le falta a SESEQ, y restablecer filtros. No depende del panel.
- **10, campos y panel de datos:** campos por rol, como Eje X, Leyenda y Valores, y panel Datos junto al lienzo.
- **11, mapas:** decidir el motor antes de nada.
- **12, opcional:** barras de error, anomalías, pronóstico, y gráficos por construir como Ribbon.

## Decisiones pendientes

1. **Alcance:** recomiendo P1 y P2 en los gráficos que tenemos, y P3 solo si se pide.
2. **Fase 4, resuelto:** conservar `plugin-chart-table` y la matriz actual. AG Grid usa otro sistema de estilos y no sustituye al motor de matriz.
3. **Fase 5, resuelto:** objetivo opcional como métrica (mismo agregado que el indicador) o valor manual. Sin objetivo se conserva la comparación anterior. La distancia porcentual contra cero muestra N/A.
4. **Fase 11:** qué motor de mapas usar.
5. **Orden:** la fase 9 puede adelantarse a la 7, porque las páginas tooltip son prioritarias para SESEQ.

## Pendiente antes de subir

- `pre-commit run --all-files`, dentro del contenedor.
- 3 errores de lint en `useCellMove.ts`, de antes de estas fases.
- Probar con un archivo real la exportación a PDF o PNG, y copiar imagen en un navegador normal.
