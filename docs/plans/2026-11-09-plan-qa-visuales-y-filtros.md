# Plan: revisión uno por uno de gráficos, formato y filtros

## Contexto

El panel de formato ya cubre casi todos los gráficos (`estado-formato-powerbi.md`), pero esa cobertura cuenta controles
que **existen**, no controles que **funcionan y se ven bien**. Este plan recorre cada gráfico y cada opción de
personalización, de uno en uno, en un navegador, y deja constancia de qué pasa, qué falla y qué se corrigió.

`qa-main.md` fue la aceptación general de `main` (31/10 y 3/11). Este plan no la repite: baja al detalle de cada
gráfico, cada tarjeta del panel y cada filtro.

**Estado (9 de noviembre de 2026):** plan escrito. Hecho el desplegable propio del segmentador (3.1), con pruebas de
Jest; falta verlo en el navegador. Nada más recorrido.

## Qué se comprueba en cada opción

Cada control del panel pasa por las mismas seis preguntas. Una opción solo se tacha cuando las seis tienen respuesta.

| # | Pregunta | Cómo se mira |
|---|---|---|
| A | **Se aplica** | Cambiar el valor repinta el gráfico al momento, sin consulta nueva si es de aspecto |
| B | **Se quita** | Volver al valor por defecto deja el gráfico como estaba (sin restos de estilo) |
| C | **Persiste** | Guardar, recargar y abrir en lectura: el valor sigue; deshacer y rehacer lo revierten en un paso |
| D | **No se corta** | Sin texto truncado, sin barras de desplazamiento que no tocan, sin solaparse con leyenda, título o ejes |
| E | **No lo pisa otra regla** | El estilo calculado en el navegador es el pedido: ninguna clase de `skin.css`, de antd o del plugin gana |
| F | **Convive** | Con el estilo compartido («Aplicar a todos»), «Copiar formato», tema oscuro y las demás opciones de su tarjeta |

Hallazgos que cuentan aunque la opción «funcione»: control que no hace nada, control visible en un gráfico al que no
aplica, valor que solo se ve tras recargar, etiqueta sin traducir, control que cambia otro al montarse, consulta lanzada
por un cambio de aspecto.

## Matriz de tamaños y contextos

Cada gráfico se mira en estos tamaños de objeto y la página en estos contextos. No hace falta el producto completo: los
tamaños se prueban con el formato por defecto y con el formato «cargado» (todo encendido: título, subtítulo, leyenda,
etiquetas, ejes con título).

**Tamaño del objeto** (en celdas de 32 px):

| Nombre | Celdas | Para qué |
|---|---|---|
| Mínimo | `minObjectColumns()` × mínimo de alto | Nada se rompe ni desborda |
| Pequeño | 8 × 6 | Lo que cabe en una tarjeta de resumen |
| Medio | 20 × 12 | Tamaño habitual |
| Grande | 60 × 34 | Página completa |
| Alargado | 60 × 4 y 6 × 34 | Proporciones extremas |

**Contextos de la página:**

- Página 16:9, 4:3, carta y personalizada.
- Zoom: ajustar a la página, ajustar al ancho, 50 %, 100 %, 150 %.
- Edición, lectura, presentación, embebido, página de tooltip.
- Exportar a PDF y PNG (lo exportado es igual a lo que se ve).
- Teléfono sin diseño móvil (lienzo escalado) y con diseño móvil.
- Tema claro y oscuro (fondo del lienzo claro y oscuro).
- Español e inglés (los textos largos en español son los que cortan).

## Entorno y datos

- Aplicación en `http://localhost:8188` (`admin`), servidor de un solo hilo: Playwright con `--workers=1`, y las pruebas
  de una en una, nunca en paralelo.
- Un espacio de trabajo **«QA visuales»** con un informe por familia (sección 2), para no mezclar hallazgos.
- Un dataset de prueba con los casos que rompen diseños. Se crea una vez (fase 0) y se reutiliza:
  - categorías de nombre muy largo (80+ caracteres) y con tildes, «ñ» y comillas;
  - una dimensión de 2 valores, otra de 12 y otra de 500;
  - números negativos, ceros, nulos, decimales largos y millones;
  - fechas por día durante 3 años, con huecos;
  - una columna de URL de imagen y una de texto con HTML (para comprobar que no se interpreta).
- Capturas en `docs/qa/2026-11-09/<familia>/NN-grafico-opcion.png`. Se decide al final si se versionan.

## Cómo se registra

Cada gráfico tiene su tabla en `docs/qa/2026-11-09/<familia>.md`, una fila por tarjeta del panel:

| Tarjeta | Opción | A | B | C | D | E | F | Hallazgo |
|---|---|---|---|---|---|---|---|---|

Los problemas van además a la tabla de hallazgos (sección 6), con la severidad de `qa-main.md` (bloqueante, alta, media,
baja). **Primero se recorre y se anota; se corrige por tandas** al cerrar cada familia, no en mitad del recorrido: un
arreglo a medias cambia lo que se está midiendo. Cada arreglo lleva su prueba (Jest junto al código, o un caso en
`format-reference.spec.ts`).

---

## Fase 0. Preparación

- [ ] Crear el dataset de prueba y el espacio «QA visuales».
- [ ] Sacar la lista real de controles por gráfico desde el catálogo (`superset/auradata/catalog/`,
      `formatCatalog.test.ts`) y generar con ella las tablas vacías de cada familia: la lista sale del código, no de
      memoria.
- [ ] Base en verde antes de empezar: `npm run type`, Jest de `src/auradata`, de `plugin-chart-echarts`,
      `plugin-chart-table`, `plugin-chart-pivot-table` y `superset-ui-chart-controls`.
- [ ] Guion de auditoría de CSS (fase 4) listo para lanzarlo sobre cualquier página.

## Fase 1. Lo común a todos los gráficos (nivel General)

Se prueba una vez a fondo sobre un gráfico de barras y después solo se confirma en cada familia.

- [ ] **Título**: texto, fuente, tamaño, color, alineación, fondo, ajuste de línea con un título de 120 caracteres.
- [ ] **Subtítulo** y **divisor**.
- [ ] **Fondo, borde, sombra, radio** del contenedor; el contenido no se sale del radio.
- [ ] **Espaciado** (relleno interior): con relleno máximo el gráfico sigue cabiendo.
- [ ] **Iconos de encabezado** (`HeaderExtras`): ayuda, acción, cuáles se muestran, en edición y en lectura.
- [ ] **Botón de acción y enlace del gráfico** (`format.link`, `format.actionButton`).
- [ ] **Tooltips**: por defecto, personalizado y página de tooltip (`tooltipPage`), posición sobre el cursor sin tapar.
- [ ] **Muestreo** de ECharts (`auradata_sampling`).
- [ ] **Texto alternativo** (`auradataAltText`), llega al lector de pantalla.
- [ ] **Bloquear** y **ocultar** el objeto (panel Selección y cinta).
- [ ] **Estilo compartido**: «Aplicar a todos los gráficos» y que el formato propio gane ajuste por ajuste.
- [ ] **Copiar formato**: lo que nombra a un gráfico (subtítulo, ayuda, acción, `OWN_CHART_SETTINGS`) no viaja.
- [ ] **Deshacer**: cada cambio es un paso; varios cambios seguidos de un mismo control se agrupan.

## Fase 2. Gráfico por gráfico

Un informe por familia. En cada gráfico: tarjetas del nivel Visual, del nivel Analítica y del nivel Campos, con las seis
preguntas, y después la matriz de tamaños. El orden va de lo más usado a lo menos.

### 2.1 Cartesianos (`Timeseries`, `chartFormatOptions.ts`)

- [ ] Barras agrupadas (verticales)
- [ ] Barras agrupadas (horizontales): los controles declarados dos veces muestran la versión de su orientación
- [ ] Barras apiladas y apiladas al 100 %
- [ ] Líneas
- [ ] Líneas suaves
- [ ] Escalonado
- [ ] Área y área apilada
- [ ] Dispersión (serie temporal)
- [ ] Combinado (líneas y columnas, `MixedTimeseries`), con «Segunda consulta»
- [ ] Mariposa (`Butterfly`), con «Lados»

Tarjetas: Diseño, Eje X, Eje Y, Valores, Eje Y secundario, Líneas de cuadrícula, Leyenda (y su título), Colores y
series (`series_format`, por nombre de serie), Etiquetas de datos, Etiquetas de total, Etiquetas de serie, Área de
trazado, Tooltips, Zoom y controles. Analítica: Líneas de referencia, Línea de tendencia, Controles de zoom, Múltiplos
pequeños. Campos: Campos de tooltip.

Casos propios:
- [ ] Mover una serie al eje secundario y devolverla (el gráfico vuelve a un solo eje).
- [ ] `gridline_*` como reserva de `x_gridline_*` y `y_gridline_*`.
- [ ] Etiquetas de total y título de leyenda (series `__auradata`) no aparecen en la leyenda, el tooltip ni al exportar datos.
- [ ] `value_label_density` con 3 años de días.
- [ ] Desplazamiento de categorías con 500 valores.
- [ ] Zoom por valores (`zoom_in_values`) y sobre el eje secundario.
- [ ] Etiquetas de eje con nombres de 80 caracteres: rotación, truncado, ancho máximo.
- [ ] Negativos, ceros y nulos en apiladas y en 100 %.

### 2.2 Tarjetas y KPI (`BigNumber/cardFormat.ts`)

- [ ] Número grande (`BigNumberTotal`)
- [ ] Número grande con línea de tendencia (`BigNumber`)
- [ ] Comparación entre períodos (`BigNumberPeriodOverPeriod`)

Tarjetas: Valor destacado, Etiqueta de categoría, Subtítulo, Objetivo, Estado, Última fecha, Tendencia, Colores y bordes.

Casos propios:
- [ ] Texto que no se corta ni saca barras en los cinco tamaños (arreglado en `6f9ba98479`: confirmar que no vuelve).
- [ ] Objetivo en cero (válido; distancia en % como N/D) y sin objetivo (comparación anterior).
- [ ] `goal_metric` (consulta) frente a `kpi_target_value` (solo repinta).
- [ ] Diseños antiguos con estilos `value`/`label` (`legacyCardFormat`) se ven igual que antes.
- [ ] Una fuente explícita gana a las reglas `!important` antiguas.

### 2.3 Tabla y matriz (`tableFormat.ts`)

- [ ] Tabla
- [ ] Matriz (tabla dinámica)

Tarjetas: Encabezados de columna, Encabezados de fila, Accesibilidad, Valores, Totales, Subtotales, Total general de
filas, Total general de columnas, Cuadrícula, Filas en blanco, Columna específica, Minigráficos, Estilo de tabla,
Formato condicional.

Casos propios:
- [ ] Encabezados de fila fijos (`table_freeze_row_headers`) con desplazamiento horizontal, por nivel.
- [ ] Minigráficos de tabla (matrices numéricas ordenadas) y de matriz.
- [ ] Formato condicional: escalas, reglas, iconos; con nulos y negativos.
- [ ] Imágenes con texto alternativo por columna y `table_row_reference_column`.
- [ ] 500 filas, 30 columnas, texto largo en celdas: ajuste de línea y anchos.
- [ ] HTML en una celda se muestra como texto.
- [ ] Editar una columna mientras llega una actualización con retardo no pierde el cambio.
- [ ] El CSS acotado de una tabla no llega a otra tabla de la misma página.

### 2.4 Parte de un todo

- [ ] Circular
- [ ] Anillo: valor central, `center_label`, `center_image` (del mismo sitio; de otro host se rechaza)
- [ ] Embudo, con «Etiquetas de conversión»
- [ ] Treemap
- [ ] Sunburst
- [ ] Cascada: «Desglose» (`waterfall_max_breakdowns` y el resto sumado) y «Conectores»
- [ ] Medidor: valor, eje, objetivo fijo y por campo (`gauge_target_metric`)

Casos propios: etiquetas exteriores con 12 sectores en tamaño pequeño, sectores de 0 %, leyenda arriba, abajo, izquierda
y derecha con nombres largos, exportación del anillo con imagen central.

### 2.5 Distribución y relación

- [ ] Dispersión y burbujas (`Bubble`): «Burbujas», «Línea de proporción» y sombreado (solo ejes numéricos lineales)
- [ ] Histograma
- [ ] Caja y bigotes
- [ ] Mapa de calor
- [ ] Radar
- [ ] Bullet

### 2.6 Flujo y jerarquía

- [ ] Sankey
- [ ] Grafo
- [ ] Árbol
- [ ] Gantt
- [ ] Cuerdas
- [ ] Calendario

### 2.7 Mapas (`2026-11-08-plan-mapas.md`)

- [ ] Mapa del mundo
- [ ] Mapa de país
- [ ] Mapa de puntos agrupados
- [ ] Cartodiagrama
- [ ] Capas deck.gl (una por tipo): leyenda sin tapar el mapa, sin rectángulo blanco al capturar

### 2.8 Otros

- [ ] Nube de palabras
- [ ] Handlebars (el HTML de la plantilla no rompe la página)

En las familias 2.5 a 2.8 muchos gráficos solo tienen el nivel General y pocas tarjetas propias. Ahí lo importante es
que **no aparezca ninguna tarjeta que no les aplica** y que el nivel General funcione entero.

## Fase 3. Filtros y segmentadores

### 3.1 Decisión: el segmentador desplegable

**Problema (comprobado en el código, falta confirmarlo en el navegador):** la variante `dropdown` es el plugin de filtro
de Superset, y su lista de opciones se monta fuera del lienzo (`getSelectPopupContainer` en `SelectFilterPlugin.tsx`
devuelve `document.body` o un overlay). El lienzo se escala con `transform` (`CanvasFrame`), así que el segmentador
cambia de tamaño con el zoom y la página, pero su lista no: las opciones se ven siempre igual, grandes sobre una página
pequeña y diminutas sobre una ampliada. Tampoco reciben el formato del segmentador (fuente, color, fondo).

Las variantes `list`, `buttons` e `input` se dibujan dentro del lienzo y no tienen este problema.

| Opción | Qué es | A favor | En contra |
|---|---|---|---|
| **1. Desplegable propio (recomendada)** | La variante `dropdown` deja de usar el `Select` de antd: un botón que abre, dentro del lienzo, la misma lista de la variante `list` | Escala con la página, toma el formato del segmentador, sale igual en PDF y en teléfono, un solo código para lista y desplegable | Hay que rehacer búsqueda, selección múltiple, teclado y accesibilidad; la lista puede quedar recortada por el borde de la página |
| 2. Montar la lista de antd dentro del lienzo | `getPopupContainer` apunta al marco escalado | Cambio pequeño | antd calcula la posición sin contar el `transform` y la lista queda desplazada; sigue sin tomar el formato |
| 3. Quitar la variante desplegable | Solo lista, botones y cuadro de texto | Lo más simple | Se pierde el segmentador compacto, que es el más usado en Power BI |

**Decidido (9/11): opción 1, hecha.** La variante `dropdown` la dibuja `SlicerView`: un botón (`slicer-trigger`) que
abre la lista dentro del segmentador (`slicer-menu`), con búsqueda, selección, «Seleccionar todo», orden, botón Aplicar y
valores ocultos, como la lista. Toma el formato de la caja (`--mb-f-box-*`) y del menú (`--mb-f-menu-*`), que antes no
llegaba a ningún sitio: las reglas apuntaban a un popup que se montaba en `document.body`. El panel muestra para el
desplegable los ajustes de lista. Un filtro que busca por texto (`operatorType` distinto de `exact`) conserva la caja de
texto del filtro (`matchesText`).

- [x] Decidir la opción.
- [x] Implementar el desplegable propio, con pruebas (`SlicerView.test.tsx`, `filter.test.tsx`).
- [ ] Verlo en el navegador a 50 %, 100 % y 150 %, en página 4:3, en teléfono y exportado a PDF.
- [ ] La lista abierta sobre otros objetos: un objeto con `auradataZ` crea su propio contexto de apilado y puede tapar
      la lista de un segmentador que esté por debajo; y la lista se recorta en el borde de la página.
- [ ] Teclado: flechas entre valores y devolver el foco al botón al cerrar con Escape.
- [ ] El filtro pierde lo que solo hacía su control: valores creados a mano (`creatable`), «primer valor por defecto»
      y la búsqueda en el servidor con muchos valores. Comprobar cuáles se usan y si hay que rehacerlos.
- [ ] Revisar lo mismo en el filtro de rango, el de fecha (`RangeSlicerView`: calendario y lista de fechas relativas) y
      cualquier otro popup que nazca dentro del lienzo: menú «⋯» del gráfico, tooltips de antd, selector de color.

La barra de filtros lateral queda fuera de la página y no se escala: ahí el `Select` de antd es correcto y se queda.

### 3.2 Segmentadores en el lienzo

Por cada variante, las seis preguntas sobre cada ajuste de `SlicerFormat` (niveles Visual y General) y la matriz de
tamaños:

- [ ] Desplegable
- [ ] Lista (vertical y horizontal)
- [ ] Botones
- [ ] Cuadro de texto
- [ ] Rango «Entre»
- [ ] Rango con deslizador
- [ ] Fecha relativa
- [ ] Fecha entre dos días

Comportamiento:
- [ ] Selección `multi`, `single` y `ctrl`; un filtro de un solo valor mantiene uno diga lo que diga el segmentador.
- [ ] Orden, formato de valores y unidades (`slicer.ts`).
- [ ] `hiddenValues`: el valor oculto no se ve en ese segmentador y sigue contando en los gráficos.
- [ ] Borrador, ayuda de encabezado y acción (`SlicerIcons`).
- [ ] Título del elemento (`ElementTitle`): no viaja en «Copiar formato».
- [ ] 500 valores, valores de 80 caracteres, valores nulos y vacíos.
- [ ] Tamaño mínimo: nada desborda el objeto.
- [ ] `showInFilterBar: false` lo saca de la barra de filtros.
- [ ] Sincronizar segmentadores entre páginas: la copia y el alcance.

### 3.3 Barra de filtros

- [ ] Niveles: todas las páginas, esta página, visuales (`scopeLevel.ts`).
- [ ] Aplicación instantánea (`filter_bar_auto_apply`) y con botón.
- [ ] Tarjeta de filtro (`FilterCard`): resumen («es (Todos)», «es Norte»), plegado recordado, acento al seleccionar,
      contador del riel plegado.
- [ ] Panel al borde derecho en lectura, edición y presentación; el zoom de la página no cuenta el panel.
- [ ] Barra horizontal y «Más filtros».
- [ ] Teléfono: el riel aparece solo si el informe tiene filtros; el cajón no cierra la lista al usarla.
- [ ] Filtros dependientes, valores por defecto, obligatorios y de un solo valor.

### 3.4 Los filtros llegan a los gráficos

- [ ] Cada tipo de filtro (valor, rango, tiempo, columna de tiempo, granularidad) cambia los gráficos de su alcance y
      solo esos.
- [ ] Filtro cruzado desde cada familia de gráfico; «Editar interacciones» (filtrar o nada).
- [ ] Drill through: la máscara `auradata-drillthrough` solo alcanza a su página.
- [ ] «Restablecer filtros» devuelve todo a su valor por defecto.
- [ ] Marcadores: guardan y aplican filtros, filtros cruzados y visibilidad.
- [ ] Páginas de tooltip reciben los filtros del informe más los valores de la marca.
- [ ] Embebido y exportación respetan los filtros aplicados.

## Fase 4. Auditoría de CSS

Buscar reglas que pisan el formato pedido. Se hace con un guion en el navegador, no a ojo.

- [ ] **Guion de estilo calculado**: para cada ajuste con un equivalente CSS (fuente, tamaño, color, fondo, borde,
      relleno), fijar un valor reconocible y leer `getComputedStyle` del elemento. Si no coincide, anotar la regla que
      gana.
- [ ] **Guion de recortes**: en cada página, listar los elementos dentro de un gráfico con `scrollWidth > clientWidth`
      o `scrollHeight > clientHeight` y `overflow` distinto de `visible`. Cada uno es un texto cortado o una barra de
      desplazamiento a revisar.
- [ ] Inventario de `!important` y de selectores globales (sin prefijo `auradata-`) en `assets/auradata/skin.css` y en
      los estilos de los plugins; cada uno se justifica o se acota.
- [ ] Reglas del modo panel (`body.auradata-panel`) que alcanzan al informe.
- [ ] Reglas del tema oscuro que dejan texto sin contraste sobre un fondo de formato.
- [ ] Estilos de antd que se cuelan en los controles dentro del lienzo (altura de `Select`, `Input`, botones).
- [ ] El campo `css` propio de un dashboard no rompe el formato (y el formato gana donde debe).

## Fase 5. Automatizar lo recorrido

Lo que se arregla no puede volver a romperse sin que nadie lo vea.

- [ ] Ampliar `format-reference.spec.ts` con un caso por familia en los tamaños mínimo, medio y grande (capturas de
      referencia).
- [ ] Un spec de segmentadores (hoy no hay ninguno en Playwright): cada variante, a tres zooms.
- [ ] Los dos guiones de la fase 4 como spec, con una lista de excepciones aceptadas.
- [ ] Pruebas de Jest para cada arreglo de `chartFormatOptions.ts`, `cardFormat.ts`, `tableFormat.ts` y `slicer.ts`.

## 6. Hallazgos

| # | Familia | Gráfico u objeto | Opción | Pasos | Esperado | Pasa | Severidad | Captura | Estado |
|---|---|---|---|---|---|---|---|---|---|

## Orden de trabajo

Una sesión por bloque, de una en una, para que cada una quepa entera y deje su familia cerrada:

1. Fase 0 y fase 1.
2. Fase 3.1 (decisión del desplegable) y, con ella tomada, su implementación.
3. Cartesianos (2.1): es la familia con más opciones, probablemente dos sesiones.
4. Tarjetas y KPI (2.2).
5. Tabla y matriz (2.3).
6. Parte de un todo (2.4).
7. Segmentadores y barra de filtros (3.2 a 3.4).
8. Las demás familias (2.5 a 2.8).
9. Auditoría de CSS (fase 4) sobre los informes ya montados.
10. Automatización (fase 5) y cierre.

Cada sesión termina con: su tabla rellena, sus hallazgos en la sección 6, los arreglos de su tanda con sus pruebas, y
el **Estado** de arriba actualizado.
