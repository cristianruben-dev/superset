# Estado de la paridad con Power BI

**Empieza aquí.** Es el resumen de todo: qué fases hay, qué llevamos, qué tenemos y qué falta.

Actualizado: 2026-11-03, con las fases 7, 8, 9 y 10 hechas. Falta sobre todo la P3 de segmentadores (454 opciones) y los mapas (fase 11).

## Dónde está cada cosa

| Quiero ver | Archivo |
| --- | --- |
| Todo lo pendiente del producto, en orden | [`2026-11-03-plan-pendientes.md`](2026-11-03-plan-pendientes.md) |
| Qué falta, por fase, opción por opción | [`pendientes.md`](powerbi-format-inventory/pendientes.md) |
| Cuánto tenemos de cada gráfico | [`cobertura.md`](powerbi-format-inventory/cobertura.md) |
| Qué tenemos y qué falta de un gráfico | [`por-grafico/`](powerbi-format-inventory/por-grafico/), como [barras agrupadas](powerbi-format-inventory/por-grafico/clusteredBarChart.md) o [tabla](powerbi-format-inventory/por-grafico/tableEx.md) |
| Todo junto, para filtrar en una hoja de cálculo | [`opciones.csv`](powerbi-format-inventory/opciones.csv), 13,853 filas |
| Detalle, resultados y decisiones de cada fase | [`2026-11-02-plan-formato-powerbi.md`](2026-11-02-plan-formato-powerbi.md) |
| De dónde sale el inventario y sus límites | [`powerbi-format-inventory/README.md`](powerbi-format-inventory/README.md) |
| Plan de mapas | [`2026-11-08-plan-mapas.md`](2026-11-08-plan-mapas.md) |
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
| 7 | Segmentadores | **Hecha con límites**; ampliada el 2026-11-03 (ver el plan de pendientes, bloques B y C) | 710, sin regenerar |
| 8 | Análisis y tooltips | **Hecha con límites** | 57 |
| 9 | Páginas tooltip y restablecer filtros | **Hecha con límites** | Fuera del inventario |
| 10 | Campos y panel de datos | **Hecha con límites** | Fuera del inventario |
| 11 | Mapas | Plan hecho: [`2026-11-08-plan-mapas.md`](2026-11-08-plan-mapas.md) (deck.gl + MapLibre) | 429 |
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

La fase 10 añade el nivel Campos en el panel de Formato, con cada campo por su rol (Eje X, Leyenda, Valores, Filas, Columnas...), y el panel Datos junto al lienzo, para arrastrar columnas y medidas a esos campos. Un cambio se ve al instante, consultando solo ese gráfico; se guarda en el propio gráfico con el botón Guardar del tablero y Descartar lo revierte.

**Validación de las fases 7 y 8:** tests de los archivos tocados y comprobación con datos del tablero 147: las cuatro variantes filtran los gráficos, las líneas de referencia y la tendencia se dibujan en barras, líneas, combinado y cascada, el zoom en líneas y área, el tooltip añade su campo, los múltiplos dividen un gráfico y añadir una línea desde el panel no consulta datos.

**Pasada de pruebas de lo no probado (2026-11-02):** en Chromium headless, con la marca de automatización apagada, tablero 147 y SESEQ en solo lectura. Guardar y recargar desde el panel (línea de referencia, tendencia, múltiplos, variante de segmentador), filtrar con el segmentador de texto, barras horizontales con líneas, burbujas, mover y redimensionar con scroll y zoom, deshacer, editor acoplado, exportar a PNG y PDF, copiar imagen. En SESEQ: scroll y páginas en vista y edición, sin consultas en la segunda visita. Corrigió: la virtualización vaciaba todos los gráficos al hacer scroll, el doble scroll de la edición, la barra de zoom tapando la página, la búsqueda que no veía opciones de subcomponentes, las fuentes de la exportación y las burbujas cortadas.

**Validación de la fase 10:** tests de los archivos tocados y navegador con el tablero 147, en inglés y español: roles de los 15 gráficos, arrastrar columnas a los campos (una sola consulta, de ese gráfico; una columna numérica entra como suma), guardar con `query_context` nuevo y recargar, descartar, volver a los guardados, campo obligatorio vacío, soltar en el lienzo sin efecto, editor acoplado y scroll con los paneles abiertos. Burbujas y mapas no se probaron con esta fase.

**Sin comprobar:** el mapa deck.gl de SESEQ da errores de WebGL en headless (`maxTextureDimension2D`) y hay que verlo en un navegador normal; exportar SESEQ; arrastrar y exportar en Safari o Firefox.

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
- **A medias:** imagen de fondo (por dirección, sin subirla ni ajustarla), detalle de etiqueta (no otro
  campo), etiquetas de serie (solo al final) y escala de color (dos colores).
- **Dependen de otra fase:** páginas tooltip (9), campos de tooltip (8) y detalle desde una marca.
- **Segundo eje en líneas y áreas:** hecho. Una serie pasa al eje secundario desde «Aplicar a una serie»; las barras
  y los gráficos horizontales siguen con un eje. La densidad de etiquetas muestra una de cada N.

### Las demás fases y los límites de las implementadas

- **4, hecha con límites:** anchos por cada valor generado de la jerarquía, jerarquías compuestas y fijación de encabezados de fila siguen sin equivalente. Los minigráficos usan los datos ya consultados: grupos de columnas en matriz y listas numéricas en tabla. La matriz fija sus encabezados de fila al desplazarse de lado. La tabla tiene las dos opciones P3 de accesibilidad: columna con texto alternativo para sus imágenes y columna por la que se nombra cada fila; la matriz no tiene la primera, porque sus celdas son agregados sin una fila de la que leer otra columna.
- **5, hecha con límites:** tarjetas con tipografía por bloque, unidades, decimales, ajuste y subrayado. KPI con objetivo fijo o métrica, distancia, colores de estado, icono, fecha y tendencia. Circular/anillo con rotación, etiquetas y centro. El centro del anillo admite una imagen de este sitio (o una dirección `data:`) y una etiqueta sin el valor; falta parte de su ajuste; la distancia ofrece valor o porcentaje, no ambos a la vez.
- **6, hecha con límites:** estilos comunes, conectores de cascada, porcentajes de conversión, espacios del treemap, objetivo numérico del medidor, tamaño de burbujas, línea y=x y sombreado geométrico en ejes numéricos lineales. La cascada agrupa en «Otros» los desgloses que pasan del máximo y el medidor toma su objetivo de un campo. Siguen pendientes los algoritmos alternativos de treemap (ECharts solo tiene uno), la contención automática y los modos de rango de marcadores.
- **7, hecha con límites:** nivel General completo y funciones de los bloques B y C del plan de pendientes. Las partes del segmentador (valores, caja de búsqueda y de texto, píldoras, marca de selección) tienen relleno por lado, esquinas por separado y transparencia de fondo, texto y borde; los valores y la caja de búsqueda, barra de acento (en todos los valores o solo en los elegidos); las píldoras, borde y marca para quitar (posición, color, tamaño y espacio). Falta el segmentador jerárquico (necesita un OR entre columnas que los filtros nativos no expresan; decisión pendiente) y la P3 (estados por botón, efectos de imagen, imagen en la disposición). El inventario sigue sin regenerar.
- **8, hecha:** deslizadores en las categorías, los valores y el eje secundario, con límites en porcentaje o en valores; los múltiplos tienen separación, bordes, fondo, esquinas y encabezados propios; los campos de tooltip están en barras, líneas, áreas, dispersión y el combinado.
- **9, hecha con límites:** una página se marca «Usar como información sobre herramientas» (tamaño y campos propios; se edita a ese tamaño) y un gráfico la elige en General › Información sobre herramientas, o «Automático» por campos comunes. Al pasar sobre una marca de un gráfico ECharts, una fila de una tabla o una tarjeta, se dibuja flotando, filtrada por ella (una fecha con grano filtra su periodo), con espera de 250 ms, caché por valor y cancelación al salir. Dibuja gráficos, cuadros de texto, imágenes, formas, botones y textos; no segmentadores ni navegadores. También sobre las celdas de valor de la matriz. Fuera: mapas (fase 11). Restablecer filtros vuelve a los valores por defecto de filtros y segmentadores, quita filtros cruzados y la obtención de detalles, y olvida la visibilidad de un marcador. Las pestañas de página van en una barra abajo, con el zoom, y el panel de filtros sigue junto a la página al editar.
- **10, hecha con límites:** Deshacer y Rehacer recorren los cambios de campos junto con los del diseño (cada cambio, y «Volver a los campos guardados», es un paso). Un campo se añade también marcando su casilla en Datos o soltándolo sobre el gráfico del lienzo, y va al pozo que elegiría Power BI (`addFieldChange`); una columna numérica entra como suma. «Usar esta tabla en el gráfico» (Datos) cambia el conjunto de datos de un gráfico en un paso de Deshacer, quitando los campos y filtros que el nuevo no tiene; al guardar se envía `datasource_id` y el servidor aplica `validate_chart_dataset`, y si lo rechaza el gráfico vuelve a sus campos guardados. Probado en el tablero 147 con el dataset sintético 62 «QA referencia por zona» (compartido), sin guardar. Datos lista todos los conjuntos que los gráficos del tablero pueden usar (los de su espacio de trabajo y los compartidos, filtro `dataset_usable_in_dashboard`) y carga los campos de uno no usado al abrirlo. Los gráficos sin tabla de roles, como mapas, muestran el nombre original de cada control. Abrir el editor de un gráfico con campos pendientes los guarda primero. Solo el propietario de un gráfico o un administrador cambia sus campos, y no se probó con un usuario sin permisos.
- **11, mapas:** motor decidido (deck.gl + MapLibre); fases en [`2026-11-08-plan-mapas.md`](2026-11-08-plan-mapas.md).
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
