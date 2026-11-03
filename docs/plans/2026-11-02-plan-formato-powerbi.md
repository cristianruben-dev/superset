# Plan: paridad de formato con Power BI

Fecha: 2026-11-02 · Rama base: `main` (`75c11378e9`)
Inventario: [`powerbi-format-inventory/`](powerbi-format-inventory/README.md) · Revisión:
[`2026-11-02-investigacion-ux-powerbi.md`](2026-11-02-investigacion-ux-powerbi.md)

**Estado:** fases 0 a 8 hechas, con commit. La fase 9 es la siguiente. El resumen está en [`estado-formato-powerbi.md`](estado-formato-powerbi.md); aquí, el detalle de cada fase.

## Objetivo

Que cada gráfico tenga las opciones de formato de Power BI, utilizables, en un solo panel ordenado junto
al lienzo.

## Dónde estamos

**Cobertura:** en barras agrupadas tenemos 291 de las 491 opciones que aplican y 20 a medias. El estado de todas las fases está
en [`estado-formato-powerbi.md`](estado-formato-powerbi.md), y lo que falta, en
[`pendientes.md`](powerbi-format-inventory/pendientes.md).

## Decisión clave: dónde guardar el formato del gráfico

**Recomiendo guardarlo en el layout**, como una capa sobre `form_data`: `meta.mibiFormat.chart` contiene
solo lo que cambió, y al dibujar se combina `{...form_data, ...chart}`.

| | Layout, capa sobre `form_data` (recomendada) | Solo `form_data` |
| --- | --- | --- |
| Deshacer, descartar | Gratis, como el resto del formato | Hay que construir historial propio |
| Guardar | Con el tablero, en un paso | Una petición por cada gráfico cambiado |
| Copiar formato, aplicar a todos | Reutiliza lo que hay | Hay que adaptarlo |
| Regla del producto | Encaja: «los formatos viven en el layout» | Es una excepción |
| Gráficos existentes | Siguen igual: la capa empieza vacía | Siguen igual |
| Explore | Hay que pasarle la capa para que vea lo mismo | Sin cambios |
| Tamaño | Cuenta para el límite de 65,535 bytes del layout | No afecta al layout |

Combinar es seguro porque cada gráfico pertenece a un solo tablero. **El tamaño es el riesgo real:** SESEQ ya usa
26,837 bytes con 27 gráficos y 4 páginas, así que quedan unos 1.4 KB por gráfico, y las reglas de tabla y los colores
por serie pueden gastar más. Duplicar páginas y las páginas tooltip también lo hacen crecer. El límite se puede subir
(`SUPERSET_DASHBOARD_POSITION_DATA_LIMIT`), porque la columna es `MediumText`, pero hay que medir el efecto. La fase 0
lo comprueba antes de construir encima.

## Fases

Tamaño relativo: S, M, L, XL. Las opciones abiertas de cada fase están en
[`pendientes.md`](powerbi-format-inventory/pendientes.md).

| Fase | Qué | Estado | Tamaño | Depende de |
| --- | --- | --- | --- | --- |
| 0 | Comprobaciones y seguimiento | Hecha | S | - |
| 1 | Panel único de formato | Hecha | L | 0 |
| 2 | General, común a todos | Hecha | M | 1 |
| 3 | Barras, columnas, líneas, áreas, combinados | Hecha | XL | 1 |
| 4 | Tabla y matriz | Hecha | L | 1 |
| 5 | Tarjeta, KPI, circular, anillo | Hecha | M | 1 |
| 6 | Cascada, embudo, treemap, medidor, dispersión | Hecha | L | 3 |
| 7 | Segmentadores | Hecha con límites | L | 1 |
| 8 | Análisis y tooltips | Hecha con límites | L | 3 |
| 9 | Paridad de reporte: páginas tooltip y restablecer | Siguiente | L | Ninguna |
| 10 | Campos y panel de datos | **Hecha con límites** | L | 1 |
| 11 | Mapas | Sin decidir el motor | Por decidir | 1 |
| 12 | Resto de P3 y gráficos nuevos | Opcional | Opcional | 3–7 |

Las fases 4, 5, 7 y 10 son independientes entre sí. La 9 no depende del panel y puede hacerse en paralelo.

### Fase 0: comprobaciones y seguimiento

Prototipo mínimo, sin interfaz final, con una sola opción (fuente de la leyenda en barras):

- Combinar la capa en `getFormDataWithExtraFilters`, que tiene caché por gráfico: comprobar que un cambio
  repinta sin volver a consultar, con `renderTriggered` como en `previewChart.ts`.
- Comprobar deshacer, descartar, guardar y recargar.
- Comprobar que Explore en el panel ve la capa, y qué pasa al guardar desde ahí.
- Comprobar exportación PDF/PNG y miniaturas.
- **Prueba de tamaño:** rellenar con formato realista todos los gráficos de una copia de SESEQ, medir el layout y
  fijar el límite.

También:

- **Seguimiento:** pasar el generador del inventario a `scripts/` para recalcular la cobertura al terminar cada
  fase. Los cambios de estado van en sus reglas: regenerar sobrescribe `opciones.csv`.
- **Capturas de referencia:** un tablero de prueba sin datos personales con un gráfico de cada tipo, para
  detectar cambios no deseados.

**Listo cuando:** la decisión de almacenamiento queda confirmada o corregida con evidencia. Si la capa no
funciona, se reescriben las fases 1 y 2 antes de seguir.

#### Resultados (2026-11-02)

**Decisión confirmada: capa en el layout**, con el límite subido. Prototipo: `src/mibi/format/chartFormat.ts`, con
la fuente de la leyenda en barras dentro del nivel Visual. Probado en el navegador sobre el tablero de referencia.

| Comprobación | Resultado | Cómo |
| --- | --- | --- |
| Repinta sin consultar | Sí: 0 consultas nuevas | Navegador, peticiones `chart/data` |
| Deshacer y rehacer | Sí, sin consultar | Navegador |
| Descartar | Sí, vuelve a lo guardado | Navegador |
| Guardar y recargar | Sí: va en el layout, `params` del gráfico intacto | Navegador y API |
| Explore acoplado | El informe conserva la capa, pero **ver abajo** | Navegador |
| Guardar por encima de 64 KB | Sí, con 95 KB | Navegador y API |
| Exportar PDF/PNG | Debería incluirla: captura el DOM del tablero | Código, sin descargar un archivo |
| Miniaturas | Se regeneran: el resumen incluye `position_json` | Código |

**Tamaño en SESEQ (27 gráficos, base 26.8 KB), medido sin guardar:**

| Formato por gráfico | Por gráfico | Total | Con el límite anterior (64 KB) |
| --- | ---: | ---: | --- |
| Ligero: 6 opciones | 430 B | 39 KB | 59 % |
| Realista: 19 opciones | 1.1 KB | 57 KB | 87 % |
| Pesado: 56 opciones | 3.1 KB | 112 KB | No cabía |

Por eso `SUPERSET_DASHBOARD_POSITION_DATA_LIMIT` pasa a 512 KB en `mibi_config.py`: la columna es `MediumText`, y el
servidor solo le pasa el valor al navegador. No medí el efecto de layouts grandes en la carga de la página.

**Lo que la fase 1 tenía que resolver (ya resuelto, salvo lo indicado en esa fase):**

- **Explore y la capa chocan:** si una opción está en la capa, cambiarla en Explore no tiene efecto visible (probado:
  leyenda a 8 en Explore, el informe siguió en 24), y Explore muestra el valor guardado, no el de la capa. Esas
  opciones deben salir de Explore al migrar.
- **Quitar una opción:** falta poder volver al valor del gráfico. «Restablecer» por sección debe borrar la clave.
- **Estilo compartido:** «Aplicar a todos» ya combina la capa. Falta decidir si copia opciones por serie, que no
  tienen sentido en otro gráfico. Lo mismo con Copiar formato.
- **El nivel Visual se reinicia:** el panel vuelve a General al seleccionar otro objeto.

**Límites de la capa:** solo se ve dentro del tablero. Un informe programado sobre un gráfico suelto
(`superset/commands/report/execute.py`) y las herramientas MCP leen el gráfico sin la capa. Los informes del tablero
completo deberían incluirla, porque abren el tablero; no lo probé.

**Herramientas nuevas:**

- `scripts/mibi/format_inventory.py`: regenera el inventario. Comprobado: produce un CSV idéntico al actual.
- `scripts/mibi/format_reference.py`: crea el tablero «QA referencia de formato» con 15 gráficos y datos sintéticos.
- `playwright/tests/experimental/dashboard/format-reference.spec.ts`: compara cada gráfico con su captura. Comprobado
  que detecta cambios: con la capa aplicada a «QA barras», falló ese gráfico.

### Fase 1: panel único de formato

- **Registro declarativo:** cada sección se define una vez y cada gráfico declara cuáles usa.
- **Unos 10 controles:** fila de fuente, color con transparencia, número con unidad, interruptor, selector,
  segmentado, texto, unidades y decimales, reglas `fx`, selector «Aplicar a». Reutilizan `FontControl`,
  `SeriesColorsControl` y `ChartConditionalFormattingControl`.
- **Estructura:** secciones plegables con interruptor en el encabezado, subgrupos, «Restablecer» por
  sección y valores heredados visibles. La búsqueda se extiende a las opciones nuevas.
- **Migración:** todas las opciones de «Personalizar» pasan al nivel Visual. Explore queda para Datos y
  Analítica, y desaparece el botón «Abrir el formato del gráfico».
- **Accesos:** la cinta contextual Formato abre la sección correspondiente.

**Listo cuando:** toda opción actual se alcanza desde el panel, se deshace y se guarda con el tablero, sin
perder ninguna y con SESEQ visualmente igual.

**Riesgo:** algunas opciones dependen del conjunto de datos, como los nombres de serie. El panel necesita
los datos de la consulta del gráfico, que hoy Explore obtiene por su cuenta.

#### Resultados de la fase 1 (2026-11-02)

**Decisión de diseño:** el registro no reescribe los controles. `formatCards.ts` reparte en secciones los controles
que cada gráfico ya declara, y `ChartFormatSections.tsx` los dibuja con el `Control` de Explore. Así cubre todos los
tipos a la vez, y un control sin sección queda bajo el título de su sección original: no se pierde ninguno.

- **Panel:** secciones plegables, cerradas al inicio y con el interruptor en el encabezado (leyenda, ejes, cuadrícula,
  etiquetas, tooltips, zoom). Punto de «cambiado en este informe» y «Restablecer» por sección. Busca dentro de ellas.
- **Explore:** sin pestaña de formato en el editor acoplado; solo queda Datos. Se quitó el botón «Abrir el formato».
- **Choques:** Copiar formato y Aplicar a todos dejan fuera lo ligado a un gráfico, como colores por serie, títulos de
  ejes u orientación (`OWN_CHART_SETTINGS`), y cada gráfico conserva lo suyo.
- **Nivel Visual:** es el predeterminado y se mantiene al cambiar de objeto.

**Comprobado en el navegador:**

- **Todas las secciones abiertas en los 15 gráficos de referencia:** 0 avisos de error y 0 errores de consola.
- **Tablero SESEQ:** los encabezados de sus gráficos cargan; no abrí su contenido ni cambié nada.
- **Valores cambiados, sin consultas nuevas:** interruptor de leyenda y Restablecer, orientación horizontal, barras de
  celda y fuente del encabezado de la tabla.
- **Aplicar a todos:** la orientación horizontal se queda en su gráfico y no pasa a líneas ni áreas.
- **Sin cambiar un valor:** moneda, formato condicional, opciones de ECharts y colores por serie se dibujan, pero no los
  edité.

**Por revisar:**

- **Opciones que siguen en Datos:** un grupo con algún control que dispara consulta va a Datos, como en Explore.
  Por eso los mapas deck.gl no tienen secciones: el panel muestra un aviso y un botón a su editor.
- **Sin probar:** un control de formato que dispara consulta (el código lo pide con `triggerQuery`).
- **Gráfico nuevo:** mientras se crea, el editor aún muestra Personalizar, porque no está en el tablero. Lo que se
  guarde ahí va al gráfico y la capa manda por encima.

### Fase 2: General, común a todos

Una sola implementación que sirve a todos los gráficos, en `ChartHolder` y `SliceHeader`.

- **Título y subtítulo:** familia, subrayado, ajuste de línea, alineación del subtítulo, nivel de encabezado.
- **Efectos:** sombra detallada (color, ángulo, desenfoque, distancia), transparencia del borde, relleno por
  lado, estilo y grosor del divisor, espaciado.
- **Iconos de cabecera:** color y selección de iconos, incluido modo enfoque.
- **Propiedades:** bloquear proporción.

#### Resultados de la fase 2 (2026-11-02)

**Añadido:** fuente, subrayado y ajuste del título; subtítulo con fuente, negrita, cursiva, subrayado y alineación;
divisor con grosor y estilo; espacio bajo el encabezado; opacidad del borde; sombra personalizada (color, opacidad,
ángulo, distancia, desenfoque, extensión e interior); relleno por lado; color y fondo de los iconos.

**Comprobado en el navegador:** sombra, subtítulo y subrayado se ven y siguen tras guardar y recargar; divisor
discontinuo y ajuste de título se aplican. Relleno por lado, sombra y opacidad del borde tienen pruebas de estilos.
Fuente, espacio bajo el encabezado y color de iconos no se probaron uno a uno.

**Ampliación: General completo.** También se añadió nivel de encabezado, ajuste del subtítulo, divisor hasta los bordes,
espaciado personalizado, iconos de cabecera (mostrar todos, borde, opacidad, modo enfoque, ver datos, copiar imagen,
información, advertencia, error y texto de ayuda), tooltips con formato, Acción, botón de acción, bloquear proporción,
mantener orden de capas y muestreo de alta densidad.

**Sigue pendiente en General, en barras (13 de 186 opciones aplicables):**

- **Páginas tooltip (fase 9):** `section` y `type` de los dos tipos de tooltip.
- **Campos de tooltip (fase 8):** `showChartSpecificTooltips`, `showTooltipFieldsOnly`.
- **Obtener detalles:** color y acciones dentro del tooltip, y Acción de obtener detalles, que necesita el valor de
  una marca.
- **A medias:** tipos de Acción sin Q&A ni obtener detalles, sus dos interruptores de tooltip, y `formatString`, que se
  completa con unidades y decimales en la fase 3.

**Excluidas (17):** iconos de exploración por jerarquía, funciones de Copilot, pin, alertas y comentarios, función de
datos de Fabric. No tenemos esas funciones.

**Probado además en el navegador:** tooltip con colores y fondo, botón de acción que ejecuta su acción, modo enfoque
y ver datos. **Sin probar en uso real:** copiar imagen (la captura funciona, pero el panel de pruebas no deja escribir
al portapapeles), bloquear proporción, orden de capas, muestreo, icono de enlace y texto de ayuda al pasar el ratón.
Los tooltips con formato solo aplican a gráficos ECharts.

### Fase 3: barras, columnas, líneas, áreas y combinados

La fase más grande. Se entrega por secciones, cada una para toda la familia:

1. **Ejes:** cuadrícula por eje, tamaño máximo, ancho mínimo de categoría, relleno, cambiar de posición,
   título con estilo, unidades y decimales, escala logarítmica en X.
2. **Etiquetas:** posición, transparencia, ancho máximo, densidad, desbordamiento y bloques Título, Valor y
   Detalle.
3. **Leyenda:** título, subrayado y el resto de posiciones.
4. **Colores y barras:** color por categoría, transparencias, borde igual al relleno, superposición, «Aplicar
   a» por serie, `fx`.
5. **Líneas y marcadores:** sombreado, interpolación, formato de marcadores, personalización por serie.
6. **Etiquetas de total y de serie.**
7. **Área de trazado:** color e imagen.

La lógica va en `plugins/plugin-chart-echarts/src/utils/formatting.ts`, que ya respeta los gráficos sin
personalizar.

**Riesgo:** ECharts puede no ofrecer equivalente directo en detalles como la densidad de etiquetas. Lo que no
se pueda se marca en el inventario y no se simula.

#### Resultados (2026-11-02)

**Cobertura en barras agrupadas:** de 224 de 497 opciones a 291 de 491, con 20 a medias (antes 30). El total baja en 6 porque
pasan a excluidas las jerarquías de exploración y las etiquetas con expresiones DAX, funciones que no tenemos. En las secciones
de esta fase son 118 de 162, con 15 a medias y 29 sin hacer. Lo demás que falta es de otras fases: análisis (líneas de
referencia, barras de error, zoom), múltiplos pequeños y tooltips.

| Sección | Qué se añadió |
| --- | --- |
| Ejes | Cuadrícula por eje (color, ancho, estilo, patrón, extremos), cambiar de lado, unidades y decimales, X logarítmico, ancho máximo de etiqueta, ancho mínimo de categoría con desplazamiento, ocultar eje secundario |
| Etiquetas | Posición, alineación, distancia, transparencia, ancho máximo, desbordamiento, ocultar superpuestas, unidades y decimales, bloques Título, Valor y Detalle con fuente propia |
| Leyenda | Título con fuente y color igual a la serie |
| Colores y barras | Color predeterminado, color por categoría, escala de dos colores, transparencia, borde igual al relleno, solo borde, superposición e invertirla |
| Líneas y marcadores | Interpolación y suavizado, transparencia, ocultar línea, patrón, extremos y uniones, color del área, color, transparencia, borde y rotación del marcador |
| Por serie | «Aplicar a una serie»: etiquetas, color de etiqueta, ancho, estilo y tipo de línea, transparencia, marcadores y transparencia de barras |
| Totales y series | Etiquetas de total, con separación por signo, y etiquetas de serie al final de la línea |
| Área de trazado | Color e imagen por dirección, en mosaico o una vez |

**Sin hacer porque el motor no lo permite** (en Falta en el inventario, con la razón, sin simular): subrayado de texto, líneas guía de
etiquetas, relleno exterior de categorías, separar segmentos de una pila, degradado por tramo de línea, transparencia de
la imagen de fondo y escalar trazos con el zoom.

**A medias:** densidad de etiquetas (solo ocultar superpuestas), imagen del área de trazado (por dirección, sin subirla ni
ajustarla), detalle de etiqueta (serie, categoría o porcentaje, no otro campo), etiquetas de serie (solo al final de la línea),
escala de color (dos colores por el valor de la barra) y tamaño máximo del eje (en píxeles).

**Eje secundario:** en líneas y áreas sigue en Falta porque esos gráficos no tienen segundo eje; está en el combinado.

**Otras en Falta:** mostrar el eje sin título o sin valores (`axisStyle`), alinear ceros de dos ejes, valores en blanco en
etiquetas y número o texto de otro campo en título y detalle de la etiqueta.

**Probado:** 22 tests de `chartFormatOptions`, 3 del control por serie, los de `transformProps` y `formatting`, y la captura de
referencia, que confirma que los gráficos sin personalizar no cambian. En el navegador, sobre barras (apiladas, agrupadas y
horizontales), líneas, área apilada y combinado: 0 consultas nuevas al cambiar opciones.

**Detalles conocidos:**

- Con «Solo el borde» el punto de color del tooltip queda transparente. La leyenda sí conserva el color.
- El título de la leyenda es una serie vacía: al pulsarlo se atenúa, sin más efecto.
- El porcentaje del detalle es el de cada segmento: junto a «Solo total», la etiqueta muestra el total y el porcentaje de la serie superior.

**Sin probar:** exportar a PDF o PNG con un archivo real y escribir la imagen en el portapapeles: la captura se genera, pero el
panel de pruebas no deja escribirla. «Aplicar a una serie» en líneas se probó guardado en el layout; en el panel, solo en barras.

#### Pasada completa en el navegador (fases 0 a 3)

**Corregido:**

- En barras verticales faltaban el título y el formato del eje Y: los controles declarados dos veces, uno por orientación, solo
  usaban el primero.
- Seleccionar una tarjeta, tabla o matriz marcaba el informe como modificado: sus reglas avisaban de su valor al montarse.
- El panel mostraba los colores del tema de la aplicación, no los del informe: título claro sobre un gráfico blanco.
- Copiar formato y «Aplicar a todos» llevaban el subtítulo, la acción, el botón de acción y el texto de ayuda a otros gráficos.
- El formato de hora o de número del eje según el tipo de columna no se veía: el panel no conocía las columnas del conjunto de datos.
- Modo enfoque: quedaba detrás de los demás gráficos con zoom en el lienzo, y en algunos navegadores no hacía nada al depender de
  la pantalla completa. Es dentro de la página, sale con Esc y sin icono repetido.
- El título del tooltip era ilegible con un fondo oscuro.
- La búsqueda no encontraba palabras sin acento y mostraba secciones enteras: va por opción.
- «Etiquetas de total» salía sin pilas, había secciones vacías, y las opciones de X logarítmico, unidades, ancho de categoría y
  color por categoría salían donde no aplican.
- La segunda consulta del combinado tiene su sección. Títulos de grupo más discretos, listas en su orden, Esc cierra el selector de
  color sin deseleccionar y tres textos pendientes de traducir.

**Probado y correcto:** deshacer, rehacer, restablecer sección, guardar y recargar; subtítulo, divisor, iconos, ver datos, texto de
ayuda, acción con enlace, botón de acción y formato de tooltip; color por categoría, desplazamiento desde el final, informe oscuro y
editor acoplado.

### Fase 4: tabla y matriz

- **Tabla:** encabezados, valores, totales, cuadrícula por dirección, relleno de filas, ajuste de texto,
  anchos, formato por columna, barras de datos por columna.
- **Matriz:** hoy no tiene controles de estilo propios. Encabezados de fila y columna, subtotales, totales
  generales, modo escalonado, expandir y contraer, filas en blanco.
- **P2:** minigráficos, iconos de URL.

#### Resultados de la fase 4 (2026-11-02)

**Motor:** se conserva `plugin-chart-table` y el renderer de matriz `plugin-chart-pivot-table`. La tabla ya tiene `tableFormat`, configuración por columna, barras, iconos y exportación. AG Grid tiene otro sistema de estilos, está condicionado por una bandera y no sustituye la matriz; migrar añadiría trabajo sin resolver esa parte.

**Implementado:**

- Secciones de encabezados de columna y fila, valores, totales, subtotales y totales generales por dirección; fuente, fondo con alfa, subrayado, ajuste, alineación, contornos y aplicación a las etiquetas.
- Cuadrícula horizontal y vertical independientes; grosor, color, relleno de filas, tamaño de texto, anchos predeterminados/fijos y dimensiones de imágenes.
- Configuración por columna ampliada únicamente para los dos renderers que la implementan: fuente, fondo, subrayado, ajuste, destinos, unidades y decimales. Barras de datos e iconos en matriz, conservando los de la tabla. Los colores condicionales prevalecen.
- Matriz escalonada con sangría, repetición de etiquetas, niveles iniciales de expansión por dirección, iconos con color/tamaño/visibilidad y acceso por teclado. Subtotales por nivel y etiquetas desde la configuración del campo. Filas separadoras entre grupos principales.
- URL como icono en valores y encabezados, solo para direcciones explícitas HTTP/HTTPS; HTML conserva su sanitización.
- Minigráficos de línea y columnas, con color, grosor y marcadores: la matriz recorre sus grupos de columnas existentes; la tabla requiere columnas con listas numéricas ordenadas. No se inventan series de valores sueltos ni se añade un rol temporal.
- Correcciones encontradas durante la revisión: las opciones dependientes del resultado se resuelven antes de validar la selección; cambios rápidos de varios campos de una columna se combinan antes de emitir el guardado diferido. Los campos que identifican una columna, métrica o nivel quedan fuera de copiar/aplicar formato a todos.

**Inventario:** tabla, 242/264 con 10 parciales; matriz, 308/334 con 11 parciales. El total de matriz baja en uno al excluir la compatibilidad de estilos antiguos de Power BI. En la fase quedan 12 opciones abiertas: 3 P1 (ancho por valor de jerarquía, jerarquías compuestas y fijación del encabezado de fila), 7 P2 parciales de minigráficos y 2 P3 de accesibilidad. La cobertura se obtiene de reglas y controles; no prueba cada opción.

**Comprobado manualmente en el tablero 147:** fuente de encabezados de fila y de una métrica, disposición escalonada, tres separadores de grupos, cuatro minigráficos con los valores agregados reales, cuadrículas por dirección, relleno, etiqueta y fuente del total de tabla, unidades y decimales, 12 iconos numéricos, expansión de columnas con teclado, deshacer/rehacer, guardar y recargar. Los cambios observados en matriz produjeron 0 peticiones nuevas a `chart/data`. Se restablecieron las secciones modificadas al acabar. No se abrió el tablero 142.

**Comprobaciones técnicas:** `npm run build` y `npm run build-translation` completados. La revisión de tipos del código fuente conserva cuatro errores ajenos a la fase (deck.gl, PropertiesModal, VizTypeGallery y ThemeController). El lint focalizado terminó con 0 errores y 6 avisos de patrones existentes; Ruff del generador también pasó. No sustituye a `pre-commit run --all-files`.

**Tests:** ver la revisión al final de los resultados de la fase 6.

### Fase 5: tarjeta, KPI, circular y anillo

- **Tarjeta:** valor y etiqueta completos, unidades, decimales, ajuste de texto.
- **KPI:** indicador, objetivo, distancia, estado y colores, tendencia, fecha.
- **Circular y anillo:** porciones, rotación, etiquetas de detalle, valor central con formato.

**Hecha (2026-11-02), con límites:** el KPI admite objetivo manual o una métrica opcional en Datos, calculada con el mismo agregado que el indicador. Si no hay objetivo mantiene el comportamiento anterior. Se controla fuente, color, subrayado y ajuste por bloque HTML; unidades, decimales, alineación y etiqueta de categoría. El KPI añade distancia absoluta o porcentual, estado con dirección favorable y margen neutro, icono accesible, fecha y transparencia de tendencia. Cero es un objetivo válido; una distancia porcentual contra cero muestra N/A.

Circular/anillo comparten colores por categoría, bordes, transparencia, escala de dos colores, leyenda, etiquetas con bloques y decimales, ángulo inicial y centro con texto, fuente, unidades, decimales y fondo circular. El centro no tiene imagen, etiqueta independiente ni subrayado del texto ECharts. El inventario mantiene esas opciones abiertas: 43 opciones únicas de la fase, contando límites compartidos y P3.

### Fase 6: cascada, embudo, treemap, medidor, dispersión

Conectarlos al registro y a las secciones de la fase 3, y añadir lo propio:

- **Cascada:** colores, desglose, conectores.
- **Embudo:** colores, etiquetas de categoría y de conversión.
- **Treemap:** colores, disposición, etiquetas.
- **Medidor:** objetivo, valor principal, etiquetas.
- **Dispersión:** burbujas, marcadores, sombreado y línea de proporción.

#### Resultados de las fases 5 y 6 (2026-11-02)

- `chartFamilies.ts` declara los controles; `cardFormat.ts` resuelve el texto HTML y los estados; `specialChartFormat.ts` aplica el estilo a las opciones existentes sin cambiar sus datos ni sus interacciones. `formatCards.ts` los distribuye en el panel único.
- Cascada conserva sus series auxiliares y colores de incremento/decremento/total. Los conectores son segmentos sobre los acumulados reales, sin interacción. El máximo de desgloses necesita agrupar Otros y mantener sus filtros: sigue abierto.
- Embudo usa los porcentajes reales del primer paso, paso anterior o total; fuente propia para categoría, valor y conversión. Treemap conserva la jerarquía y permite espacios entre nodos/grupos; no se simulan los algoritmos de disposición de Power BI.
- Medidor: objetivo numérico con puntero y etiqueta propios, fuente de eje y valor, y etiqueta manual con `{value}`. Sin objetivo por campo ni etiqueta desde otro campo.
- Dispersión/burbujas: tamaño, marcadores, colores/bordes, línea y=x y sombreado de sus dos semiplanos calculado en coordenadas reales. La sección de proporción se oculta para eje temporal o logarítmico. No incluye contención automática ni modos de rango de tamaño. Los estilos compartidos se aplican una sola vez.
- Compilación de producción y traducciones correctas. Lint de los tres módulos nuevos sin errores. La comprobación de tipos de fuentes sigue mostrando cuatro errores anteriores en DeckGLContainer, PropertiesModal, VizTypeGallery y ThemeController. El lint ampliado también señala problemas heredados; no es un pase global limpio.
- Navegador: tablero sintético 147 únicamente, comprobando tipografía y etiqueta de tarjeta; KPI con objetivo 3000 (+9.7 %) y luego SUM(costo), distancia +85.4 %; persistencia tras guardar/recargar; centro del anillo; conectores; objetivo del medidor; etiquetas de embudo; espacios del treemap; dispersión numérica con y=x. Los cambios de proporción generaron cero peticiones adicionales de datos y no hubo errores de consola en esa revisión. Las capturas son evidencia de una selección de opciones, no de paridad completa.
- Se eliminó la sección duplicada de valor de tarjeta. Los estilos antiguos se leen como valores iniciales y sus variables CSS permiten que los controles nuevos prevalezcan sin reescribir los informes. Comprobado en navegador: tamaño nuevo de 46 px sobre estilo antiguo de 30 px, conservando color y alineación. El tablero 147 y los gráficos 215/223 se restauraron y cotejaron con sus originales tras la revisión.
- Inventario regenerado desde las reglas: 38 opciones abiertas únicas en fase 5 y 63 en fase 6. Son correspondencias de controles, no pruebas de cada opción.

#### Revisión de las fases 4, 5 y 6 (2026-11-02)

**Corregido:**

- El tablero 147 no estaba restaurado: combinado, dispersión, tabla y matriz tenían su definición cambiada y restos de formato. La captura de referencia pasa con los 15 gráficos.
- Formato de fecha salía en dos secciones en circular y treemap, y formato numérico y de moneda en tarjeta: cada control va ahora en una sola.
- El embudo perdía la categoría al personalizar sus etiquetas, porque guarda su contenido como posición en una lista.
- Una regla de icono sin color no mostraba el icono, en tabla ni en matriz.
- «Restablecer» no borraba el estilo antiguo de una tarjeta.
- El sombreado de la dispersión añadía un punto invisible que podía estirar el eje, y el nombre de la línea y=x se salía del gráfico.
- Filas de matriz sin separador envueltas sin necesidad, tests que no pasaban y 12 archivos sin formato.

**Añadido:** fuente propia y línea aparte para la etiqueta central, patrón de guiones en la línea de proporción, límites del eje Y en cascada y nota de la razón en lo que seguía abierto sin explicar.

**Sigue abierto, con razón en `pendientes.md`:** máximo de desgloses de cascada, imagen central del anillo, algoritmos de treemap, contención de burbujas, objetivo del medidor por campo, jerarquías compuestas y anchos por valor de jerarquía.

### Fase 7: segmentadores

- **Variantes nuevas:** botones, lista y entrada, sobre el filtro de lienzo (`mibi-filter`).
- **Formato común:** encabezado, elementos, selección, búsqueda, icono de selección, menú desplegable.
- **Fuera de alcance por defecto:** la P3 de esquinas individuales, efectos de imagen y estados por botón (384
  opciones). Se decide tras usar las variantes.

#### Resultados de la fase 7 (2026-11-02)

- **Hecho:** tipo de segmentador en el filtro de lienzo (lista desplegable, lista, botones, texto), disposición vertical, horizontal o en cuadrícula, búsqueda, seleccionar todo, marca de selección, y formato de encabezado y valores con estados. `SlicerView` usa la misma máscara que la barra de filtros.
- **Límites:** el texto filtra con `ILIKE`, por lo que contiene. Rango y fecha conservan su control. El menú de la lista desplegable no se formatea. Quedan abiertas las opciones de detalle y la P3, con su razón o como Falta en `pendientes.md`.

### Fase 8: análisis y tooltips

- **Tooltips:** el formato ya está (ver fase 2). Faltan los campos adicionales por gráfico.
- **Líneas de referencia y tendencia:** quitamos las capas de anotación, así que necesitan su propio mecanismo.
  Propuesta: guardarlas en el formato y dibujarlas como `markLine`, sin volver a añadir pantallas de anotación.
- **Zoom con formato y múltiplos** sobre Matrixify.
- **Pestaña Analítica** junto a Visual y General.

#### Resultados de la fase 8 (2026-11-02)

- **Hecho:** nivel Analítica en el panel; líneas de referencia constantes, mínima, máxima, media, mediana y percentil, en cualquier eje, con etiqueta, delante o detrás y sombreado; línea de tendencia por serie o conjunta; deslizadores de zoom por eje; campos de tooltip en consulta aparte; múltiplos pequeños con Matrixify abierto al panel.
- **Límites:** sin deslizador del eje secundario, zoom en porcentaje, sin formato de cuadrícula de múltiplos, y los campos de tooltip no están en el combinado. El sombreado sobre un eje de categorías no se dibuja.

### Fase 9: paridad de reporte

- **Páginas tooltip:** tipo de página, asignación desde el gráfico y dibujo flotante con el contexto de la marca.
  Las usa SESEQ en InfoMap e InfoEmpleado. Es el mayor reto técnico: cada aparición filtra y consulta varios
  gráficos.
- **Restablecer filtros** al estado guardado.
- **Pendientes de la revisión:** pestañas de página abajo, panel de filtros al editar, comentarios si los quieres.

### Fase 10: campos y panel de datos

- **Campos por rol:** nombres del tipo Eje X, Leyenda, Valores y Tooltips, en lugar de Métricas y Dimensiones.
- **Panel Datos junto al lienzo,** con tablas y arrastrar a los campos.
- **Hecho:** nivel Campos del panel de Formato (`mibi/format/ChartFieldsSections.tsx`), roles por gráfico (`chartFields.ts`) y panel Datos (`DataPane.tsx`). Los campos se guardan en el gráfico al guardar el tablero, con `query_context` regenerado. Los campos de tooltip pasan de Analítica a Campos y siguen en la capa del layout.
- **Límites:** ver [`estado-formato-powerbi.md`](estado-formato-powerbi.md).
- **Sin iframe de Explore, si conviene:** evaluar con lo aprendido en la fase 1.

Antes de empezar hay que comparar con la pantalla actual: no se ha revisado a fondo el editor acoplado.

### Fase 11: mapas

Decidir el motor primero. Azure Maps funciona por capas, y nosotros tenemos deck.gl, `country_map` y MapBox. Son
1,103 filas sin cruzar. Propuesta: una sección de capas sobre deck.gl, cubriendo primero lo que usa SESEQ
(burbujas con leyenda y tamaño).

### Fase 12: resto de P3 y gráficos nuevos

Barras de error, anomalías, pronóstico con formato, remate de guiones y similares, solo si se piden. Ribbon, Tarjeta
de varias filas y la tarjeta nueva son gráficos por construir; su inventario ya existe.

## Orden recomendado

1. **Fase 7:** segmentadores, tras la implementación de las fases 5 y 6; las páginas tooltip de la fase 9 pueden adelantarse.
2. **Fases 7 y 8:** segmentadores y análisis.
3. **Fases 6, 10, 11 y 12:** según lo que vayas necesitando.

La **fase 9** puede empezar en cualquier momento: las páginas tooltip son lo que más le falta a SESEQ y no esperan al
panel.

## Cómo trabajar cada fase

- **Commits pequeños** por sección, en `main`, y `pre-commit run --all-files` antes de subir.
- **Español primero:** cada texto nuevo con `t()` y entrada en `messages.po`.
- **Sin cambios no pedidos:** cada ayuda no hace nada si la opción no está personalizada, para que los tableros
  existentes se vean igual.
- **Pruebas:** Jest junto al código, de archivo en archivo y sin paralelo, porque la suite completa congela la Mac.
  `tsc` y comprobación en el navegador en cada entrega. Playwright por flujo, con un trabajador.
- **Al cerrar cada fase:** actualizar cobertura, `CLAUDE.md` y este documento.

## Decisiones

**Tomada:** el formato se guarda en una capa del layout (fase 0).

**Pendientes:** están en [`estado-formato-powerbi.md`](estado-formato-powerbi.md).

**Capturas de la investigación:** las de cintas y galería siguen sin ser válidas. No bloquean el formato, porque el inventario
sale del esquema, pero ayudarían a afinar las fases 9 y 10.

## Límites de este plan

- **Tamaños relativos, sin fechas.**
- **Cobertura aproximada:** sale de comparar nombres de controles, no de probar cada opción. Hay que confirmarla al
  entrar en cada sección.
