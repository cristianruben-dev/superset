# Plan de mapas: paridad con Power BI y lo que podemos sumar

Es la fase 11 de [`estado-formato-powerbi.md`](estado-formato-powerbi.md), hasta hoy «sin decidir el motor». Este plan
decide el motor, inventaría lo que tiene Power BI, lo que ya tenemos y lo que falta, y ordena el trabajo en fases.

Actualizado: 2026-11-08.

## Resumen

- **Motor:** deck.gl sobre MapLibre, el que ya usamos, sin claves de API. Mapbox queda fuera.
- **Hoy:** los mapas de puntos funcionan bien: burbujas, clusters y calor, sobre datos con latitud y longitud. El MCP
  ya los crea (2026-11-08). El mapa por regiones solo entiende códigos ISO de estados.
- **Lo que más falta:** ubicar por nombre (municipio, estado) sin coordenadas, mapas por municipio, editar mapas con
  la misma comodidad que el resto (campos y formato), y las páginas de información sobre herramientas.
- **La meta:** un visual «Mapa» de AuraData con capas, como Azure Maps en Power BI, sobre lo que deck.gl ya trae.

## Qué tiene Power BI

Power BI tiene cinco visuales de mapa. Bing Maps (Mapa y Mapa coroplético) está en camino de retirarse y Microsoft
empuja a Azure Maps ([visión general](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-map-visualizations-overview),
[conversión](https://learn.microsoft.com/en-us/azure/azure-maps/power-bi-visual-conversion)).

| Visual | Qué hace |
| --- | --- |
| **Mapa (Bing)** | Burbujas por ubicación, tamaño por valor, color por categoría, gráficos circulares sobre el mapa |
| **Mapa coroplético (Bing)** | Regiones rellenas por valor, con degradado o reglas |
| **Mapa de formas** (vista previa) | Regiones de un TopoJSON propio, subido por el autor ([doc](https://learn.microsoft.com/en-us/power-bi/visuals/desktop-shape-map)) |
| **Azure Maps** | Un visual con capas, el de referencia ([capas](https://learn.microsoft.com/en-us/azure/azure-maps/power-bi-visual-understanding-layers)) |
| **ArcGIS for Power BI** | GIS de Esri: temas inteligentes, demografía, área por tiempo de traslado ([doc](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualizations-arcgis)) |

### Azure Maps, en detalle

**Ubicación de los datos:** un campo «Ubicación» que acepta nombres (país, estado, ciudad, dirección) y los
geocodifica, o «Latitud» y «Longitud». Cada columna puede llevar una categoría de datos (Ciudad, Estado, Código postal,
Latitud…) que ayuda a ubicarla.

**Capas de datos** (todas con «mostrar desde/hasta el zoom» y posición entre capas):

| Capa | Opciones principales |
| --- | --- |
| Burbujas | Tamaño por valor (mín., máx., escala lineal o logarítmica), color fijo, por categoría o degradado, borde, transparencia, desenfoque, **clusters** (tamaño, color, texto), **marcadores** con icono propio |
| Mapa de calor | Radio (píxeles o metros), intensidad, intensidad por valor, degradado, mín. y máx. |
| Columnas 3D | Altura y ancho por valor, escala con el zoom, color |
| Relleno (coroplético) | Color por valor o categoría, borde, transparencia |
| Rutas | Líneas que unen puntos en orden, color, ancho |
| Gráficos circulares | Un pastel por ubicación |

**Capas de contexto:** referencia (un GeoJSON, KML, WKT, SHP o CSV subido; hasta 30 000 elementos), mosaicos (una URL
de teselas propia, con límites), tráfico en tiempo real.

**Controles del mapa:** estilo (carretera, satélite, escala de grises clara u oscura, nocturno, alto contraste),
etiquetas y fronteras de país, estado y condado, edificios, detalle de calles; selector de estilo para el lector;
botones de zoom, rotación e inclinación; **selección** por círculo, rectángulo, polígono (lazo) o tiempo de traslado,
que filtra el informe; zoom automático o centro y zoom fijos ([ajustes](https://learn.microsoft.com/en-us/azure/azure-maps/power-bi-visual-get-started)).

**Formato común:** leyenda (posición, título, fuente), etiquetas de categoría y de datos, y el nivel General de todo
visual (título, borde, fondo, sombra, iconos de cabecera, tooltips).

**Interacción:** filtrado cruzado y resaltado al hacer clic, páginas de información sobre herramientas, obtención de
detalles (drill through), jerarquía de ubicación para profundizar (país → estado → ciudad).

El inventario completo de opciones está en [`azureMap.md`](powerbi-format-inventory/por-grafico/azureMap.md),
[`map.md`](powerbi-format-inventory/por-grafico/map.md), [`filledMap.md`](powerbi-format-inventory/por-grafico/filledMap.md)
y [`shapeMap.md`](powerbi-format-inventory/por-grafico/shapeMap.md): 1,624 líneas, sin cruzar.

## Qué tenemos hoy

Superset trae varios plugins de mapa. Todos se pueden elegir en el editor de gráficos.

| Nuestro | Equivale a | Estado |
| --- | --- | --- |
| `deck_scatter` | Burbujas | ✅ Color fijo, por categoría o por cortes; tamaño fijo o por métrica; leyenda; tooltip con campos |
| `point_cluster_map` | Burbujas con clusters | ✅ Radio del cluster, etiqueta con suma o promedio |
| `deck_heatmap` | Mapa de calor | ✅ Radio, intensidad, peso por métrica |
| `deck_grid`, `deck_hex`, `deck_screengrid`, `deck_contour` | Columnas 3D (agregadas en celdas) | ⚠️ Agregan por celda; no hay una columna por punto |
| `country_map` | Coroplético | ⚠️ Formas propias de 202 países, solo primer nivel (estados), y solo con códigos ISO (`MX-QUE`) |
| `world_map` | Coroplético mundial | ✅ Por nombre o código de país |
| `deck_polygon`, `deck_geojson` | Mapa de formas | ⚠️ Dibujan polígonos guardados en una columna del dataset; no hay archivo subido |
| `deck_path`, `deck_arc` | Rutas (y arcos, que Power BI no tiene) | ✅ |
| `deck_multi` | Varias capas | ⚠️ Junta gráficos guardados aparte; incómodo |
| `mapbox` | — | ❌ Necesita clave de Mapbox; queda fuera |

**Por encima de los plugins:**

| Tema | Estado |
| --- | --- |
| MCP | ✅ `deck_scatter`, `point_cluster_map`, `deck_heatmap`, `country_map` (2026-11-08). ❌ El resto de capas |
| Filtrado cruzado al hacer clic | ✅ deck.gl y `country_map` lo emiten; ❌ sin verificar en el lienzo de AuraData |
| Interacciones, marcadores, segmentadores | ✅ Un mapa es un gráfico más |
| Panel Campos | ❌ Los mapas no tienen tabla de roles: muestran el nombre crudo de cada control (fase 10) |
| Panel Formato, nivel Visual | ⚠️ Dibuja los controles del plugin, sin secciones propias; el catálogo de formato no tiene mapas, así que el MCP no los formatea |
| Páginas de información sobre herramientas | ❌ El sondeo (`data-auradata-probe`) solo está en ECharts, tablas y tarjetas |
| Diseño móvil | ✅ Un mapa se coloca como cualquier objeto |
| Exportar PDF y PNG | ✅ Salen con el mapa base. ❌ Un recuadro blanco vacío aparece bajo la leyenda de `deck_scatter` en la captura |
| Mapa base | ✅ CARTO y OpenFreeMap, sin clave; los dominios ya están en la CSP |

**Errores conocidos:**
1. Los puntos de deck.gl se dibujan sobre la leyenda: el canvas vive en un contenedor con `z-index: 2` y la leyenda no
   tiene `z-index` (`plugins/preset-chart-deckgl/src/components/Legend.tsx`).
2. El recuadro blanco de la captura, sin diagnosticar.
3. Antes se vieron errores de WebGL en headless (`maxTextureDimension2D`) con el mapa de SESEQ; hay que repetir la
   prueba con el capturador actual.

**Datos de SESEQ:** 120 de 421 establecimientos (`v_establecimiento`) tienen coordenadas 0,0 o vacías y no salen en
ningún mapa. Los mapas del MCP las excluyen para no alejar la vista al mundo entero.

## Lo que falta, por tema

Cada fila dice qué hacer y cuánto cuesta: **S** (un día o menos), **M** (unos días), **L** (una semana o más).

### 1. Ubicar los datos

| Qué | Cómo | Costo |
| --- | --- | --- |
| Categoría geográfica de una columna (Latitud, Longitud, Estado, Municipio, Código postal, País) | Propiedad de columna en el modelo de datos, como `is_dttm`; el editor y el MCP eligen solos los campos del mapa | M |
| Regiones por nombre, no solo por código | Tabla de equivalencias nombre → código en el plugin, sin acentos ni mayúsculas («Querétaro», «QUERETARO» → `MX-QUE`) | S |
| Catálogo geográfico de México | Marco Geoestadístico del INEGI: estados, municipios y localidades con su clave y su centroide, en una tabla del sistema | M |
| Ubicar por nombre sin coordenadas | Unir los datos con ese catálogo (municipio → centroide); sin servicio externo y sin enviar datos fuera | M |
| Geocodificar direcciones | Servicio externo opcional (Nominatim propio, Azure, Google), configurado por el operador, con caché | L |

### 2. Capas y tipos de mapa

| Qué | Cómo | Costo |
| --- | --- | --- |
| Municipios de México (o de un estado) | GeoJSON simplificado del INEGI en `country_map`, como `mexico_municipios` o uno por estado | M |
| Mapa de formas propio | Subir un GeoJSON o TopoJSON al tablero (como las imágenes de fondo), elegir la propiedad que se cruza con los datos | L |
| Capa de referencia | Mismo archivo subido, dibujado como contexto sin datos | M, tras lo anterior |
| Columnas 3D por punto | `ColumnLayer` de deck.gl, altura por métrica | M |
| Marcadores con icono | `IconLayer` de deck.gl, icono por categoría | M |
| Pasteles sobre el mapa | Sin capa nativa en deck.gl; dibujarlos en HTML sobre el mapa | L |
| Mosaicos propios | URL de teselas libre (`maplibre_style` ya acepta texto libre); exponerla en Formato | S |
| Estilos del mapa base | Lista curada: claro, oscuro, calles, satélite (Esri World Imagery, con atribución) | S |
| Varias capas en un visual | Ver la fase 4 | L |

### 3. Formato

| Qué | Costo |
| --- | --- |
| Leyenda: título, fuente, tamaño, posición, mostrar | S |
| Etiquetas sobre el mapa (nombre o valor de cada punto o región) con `TextLayer` | M |
| Color por valor con degradado, además de los cortes que ya hay | S |
| Transparencia, borde y desenfoque de burbujas | S |
| Escala de tamaño logarítmica | S |
| Mostrar capa solo entre dos niveles de zoom | S |
| Fronteras, etiquetas y calles del mapa base (según el estilo) | M |
| Secciones propias en el panel Formato y entrada en el catálogo de formato, para que el MCP formatee mapas | M |

### 4. Controles e interacción

| Qué | Costo |
| --- | --- |
| Botones de zoom, rotación e inclinación | S |
| Zoom automático o centro fijo, elegido en Formato | S |
| Selector de estilo para quien lee | S |
| Selección por rectángulo y lazo que filtra el informe (filtro cruzado con los puntos dentro) | L |
| Páginas de información sobre herramientas en mapas (el sondeo de la fase 9 en deck.gl y `country_map`) | M |
| Obtención de detalles desde un punto o región | S, verificar |
| Profundizar por jerarquía (estado → municipio → localidad) | L |
| Filtrado cruzado verificado en el lienzo, con su pantalla de «Editar interacciones» | S |

### 5. Editor

| Qué | Costo |
| --- | --- |
| Tabla de roles de los mapas en Campos (Latitud, Longitud, Ubicación, Tamaño, Color, Información sobre herramientas) | M |
| Arrastrar una columna con categoría geográfica a un mapa la pone en su pozo | S, tras la tabla de roles |
| Iconos de cada tipo de mapa en el selector | S |
| Traducciones al español de los controles de los plugins de mapa | S |

### 6. MCP y asistente

| Qué | Costo |
| --- | --- |
| Tooltip con campos, color por degradado y estilo del mapa en los 4 tipos del MCP | S |
| `deck_polygon`, `deck_geojson`, `deck_path`, `deck_arc`, `deck_hex`, `deck_grid` y `world_map` en el MCP | M |
| Formato de mapas en `format_visual` (cuando el catálogo los tenga) | S, tras el tema 3 |
| Campos de los mapas en `set_visual_fields` (cuando haya tabla de roles) | S, tras el tema 5 |
| Las guías del MCP (`auradata://report-conventions`) con cuándo usar cada mapa | S |

### 7. Lo que podemos sumar más allá de Power BI

| Qué | Por qué | Costo |
| --- | --- | --- |
| Arcos origen → destino (`deck_arc`) | Referencias entre unidades médicas, traslados; Power BI no lo tiene | S, ya existe |
| Hexágonos y rejillas con altura | Densidad agregada, legible con miles de puntos | S, ya existe |
| Contornos (`deck_contour`) | Zonas de igual valor | S, ya existe |
| Animación por tiempo | deck.gl anima por grano de tiempo (`time_grain_sqla` en scatter, arcos, rutas); Power BI no anima mapas | M |
| Cobertura: radio o tiempo de traslado alrededor de cada unidad | Población sin unidad cercana; el tiempo necesita un servidor de rutas propio (OSRM) | L |
| Mapa base propio (PMTiles) | Sin depender de un servicio externo ni de sus límites | M |
| Preguntar al asistente «¿dónde…?» y que conteste con un mapa | Los documentos del asistente solo dibujan gráficos ECharts y tablas | M |

**Fuera:** tráfico en tiempo real y datos demográficos de terceros (ArcGIS). Dependen de servicios de pago y no ayudan
a los informes de hoy.

## Decisiones

1. **Motor: deck.gl + MapLibre.** Ya está en el producto, rinde con cientos de miles de puntos, tiene casi todas las
   capas de Azure Maps y no pide claves. Mapbox sale del selector.
2. **Mapa base en producción.** CARTO es gratis para uso comercial hasta 1 millón de teselas al mes, y luego cuesta
   desde 500 USD al mes ([FAQ de CARTO](https://docs.carto.com/faqs/carto-basemaps)). OpenFreeMap no tiene límites ni
   claves y permite uso comercial, sin acuerdo de servicio ([openfreemap.org](https://openfreemap.org)). Propuesta:
   OpenFreeMap por defecto en todos los mapas y PMTiles propios cuando el uso crezca. **Por decidir.**
3. **Formas de México.** El Marco Geoestadístico del INEGI, simplificado, con la clave del INEGI y el código ISO de
   cada estado. Hay que confirmar su licencia de libre uso y el tamaño (los 2,469 municipios simplificados en
   TopoJSON rondan pocos MB; uno por estado pesa mucho menos). **Por decidir:** todo el país o por estado.
4. **Un visual «Mapa» con capas** (fase 4) en lugar de seguir sumando tipos sueltos. Los tipos actuales siguen
   funcionando; el nuevo se ofrece primero en el editor.

## Fases

| Fase | Qué | Incluye | Costo |
| ---: | --- | --- | --- |
| 0 | Arreglos | Leyenda sobre los puntos, recuadro blanco de la captura, WebGL en headless, filtrado cruzado y obtención de detalles verificados | S |
| 1 | Lo que ya existe, a mano | Tooltip con campos, degradado, estilo del mapa, botones de zoom, leyenda con formato, traducciones; en el MCP también | M |
| 2 | Editar mapas como los demás | Tabla de roles en Campos, secciones en Formato, catálogo de formato para el MCP | M |
| 3 | Geografía de México | Categoría geográfica de columnas, regiones por nombre, municipios del INEGI, ubicar por nombre con el catálogo | L |
| 4 | Visual «Mapa» con capas | Burbujas, clusters, calor, relleno, columnas 3D, rutas, arcos, marcadores y referencia en un solo visual, con orden de capas y zoom por capa | L |
| 5 | Interacción completa | Páginas de información sobre herramientas, selección por lazo, jerarquía para profundizar, animación por tiempo | L |
| 6 | Extras | Formas subidas, mosaicos propios, cobertura por radio o tiempo, PMTiles propios, mapas en el asistente | L |

**Orden recomendado:** 0 → 1 → 3 → 2 → 4 → 5 → 6. La fase 3 va antes que la 2 porque es lo que más piden los datos
de SESEQ (municipios por nombre) y no depende del editor.

**Cómo probar cada fase:** con `v_establecimiento` (SESEQ, workspace 5) en el navegador y en una captura de
`get_dashboard_screenshot`, en español y en inglés, en escritorio y en el diseño móvil; los tests del plugin tocado y
los del MCP de mapas (`tests/unit_tests/mcp_service/chart/test_map_charts.py`).
