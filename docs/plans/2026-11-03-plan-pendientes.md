# Plan: todo lo que falta en AuraData BI

Fecha: 2026-11-03 · Rama base: `main` (`5f8fd0b53b`)

Reúne en un solo orden lo pendiente de [`estado-formato-powerbi.md`](estado-formato-powerbi.md),
[`qa-main.md`](qa-main.md), [`visual-sorting.md`](visual-sorting.md),
[`2026-11-01-datos-dentro-del-tablero.md`](2026-11-01-datos-dentro-del-tablero.md) y
[`2026-11-02-investigacion-ux-powerbi.md`](2026-11-02-investigacion-ux-powerbi.md). El detalle de cada opción sigue en
[`pendientes.md`](powerbi-format-inventory/pendientes.md); aquí no se copian sus cifras, se agrupan en trabajo.

Tamaños: **S** (un día o menos), **M** (unos días), **L** (una semana o más).

## Orden propuesto

| Bloque | Qué | Tamaño | Por qué en este lugar |
| ---: | --- | :---: | --- |
| A | Poner `main` en orden y subirlo | S | 75 commits sin subir; todo lo demás se apoya en ellos |
| B | Segmentadores: General y funciones que faltan (fase 7b) | M–L | Lo pediste primero |
| C | Segmentadores: formato de sus partes (fase 7c) | M | Sigue a B, con las mismas piezas |
| D | Páginas tooltip y restablecer filtros (fase 9) | L | Lo que más le falta a SESEQ |
| E | Hallazgos de QA y lo no comprobado | M | Antes de enseñar el producto a alguien |
| F | Límites de las fases hechas (3, 6, 8, 10) | M | Mejoras, sin bloqueos |
| G | Cinta y comodidades de edición pendientes | S–M | Pulido diario |
| H | Mapas (fase 11) | L | Necesita decidir el motor |
| I | P3 y gráficos nuevos (fase 12) | L | Solo si se pide |

**Decisión tuya: B/C antes o después de D.** Pediste más opciones de segmentadores, y este plan los pone primero. El
precio es retrasar las páginas tooltip, que son lo que más le falta a SESEQ (InfoMap, InfoEmpleado). Si SESEQ tiene
fecha, conviene hacer A → D → B → C.

---

## A. Poner `main` en orden (S)

1. `pre-commit run --all-files` dentro del contenedor y corregir lo que salga.
2. Los 3 errores de lint de `useCellMove.ts`.
3. Ejecutar los tests de `src/mibi` y `pytest tests/unit_tests/mibi/`, en serie.
4. Decidir la rama `worktree-admin-menu-cleanup` (2 commits: quita los grupos de usuarios, decisión D7 del plan de
   datos, y deja en el registro de acciones solo los eventos con sentido). Mergear o descartar.
5. Subir `main`.

**Listo cuando:** `main` y `origin/main` coinciden y pre-commit pasa.

## B. Segmentadores: General y funciones (fase 7b, M–L)

**Estado (2026-11-03), rama `feat/slicer-options`:** hecho en su mayor parte; lo que falta está abajo.
- **Nivel General:** título, subtítulo, divisor, espaciado bajo el encabezado, fondo, borde, sombra, relleno y texto
  alternativo. «Copiar formato» entre segmentadores conserva el filtro y el texto del título de cada uno.
- **Funciones:**
  - Selección única o «Con Ctrl». Si el filtro admite un solo valor, el segmentador también.
  - Botón Aplicar con marca de cambios pendientes, y píldoras de los valores elegidos.
  - Resumen en el encabezado y orden de los valores.
  - Texto con valores completos separados por comas.
- **Rango y fecha:** «Entre» y deslizador para rangos; fecha relativa (en los últimos/este/en los próximos) y entre dos
  días para fechas.
- **Comprobado en el navegador** con el tablero 187 «QA segmentadores» y una tabla del dataset 41: lista, botones con
  Aplicar, rango y fecha relativa filtran la tabla.
- **Segunda tanda (2026-11-03):**
  - Iconos en la esquina: borrador de la selección, ayuda del encabezado y acción.
  - «Solo números» en el segmentador de texto.
  - **Valores que se muestran:** el editor apaga valores para quitarlos del segmentador, como el filtro de nivel de
    objeto de Power BI. No filtran los gráficos.
- **Falta de B:** la **jerarquía**. Una selección en árbol necesita un OR entre columnas (Norte/Monterrey o
  Sur/Mérida), y los filtros nativos solo hacen AND. Hay dos caminos: un operador nuevo en el backend, o un filtro SQL
  con las comillas de cada dialecto. Decisión tuya.

Hoy el filtro de lienzo (`mibi-filter`, `SlicerView.tsx`) tiene cuatro variantes (desplegable, lista, botones,
texto), disposición, búsqueda, seleccionar todo, marca de selección y formato de encabezado y valores. Su caja ya
toma fondo, borde y sombra de `meta.mibiFormat` (`visualStyle` en `ElementHolder.tsx`), pero no el resto del nivel
General de los gráficos.

### B1. Nivel General completo en los segmentadores (M)

Reutilizar las secciones General de los gráficos en el elemento, en lugar de crear controles nuevos. Es la parte del
inventario con más P1 abiertas y la que menos lógica nueva necesita.

- Título con tipografía completa (familia, subrayado, ajuste de línea, nivel de encabezado) y **subtítulo**.
- **Divisor** (estilo de línea, ancho, ignorar relleno) y **espaciado** entre título, subtítulo y contenido.
- **Sombra** con preajustes, ángulo, distancia, desenfoque y transparencia (hoy solo niveles).
- **Relleno y márgenes** por lado.
- **Iconos del encabezado** y su tooltip, **texto de ayuda**, **texto alternativo** y **acción** del elemento.

Primero hay que comprobar qué secciones General ya dibuja el panel para un elemento seleccionado y cuáles faltan, y
que «Copiar formato» funcione entre segmentadores.

### B2. Funciones que faltan (M–L)

Lo que cambia lo que el segmentador hace, no solo cómo se ve. Va por delante de cualquier opción de formato.

| Función | Qué hace en Power BI | Notas |
| --- | --- | --- |
| **Selección única** y «Ctrl para varios» | Un solo valor, o varios solo con Ctrl | Ajuste del filtro nativo; escribir la misma máscara |
| **Segmentador jerárquico** | Varios campos, expandir/contraer, sangría escalonada | Solo lista y desplegable; «restringir a hojas» |
| **Fecha y rango** con su propio aspecto | Entre (deslizador y dos cajas), antes/después, fecha relativa, calendario | Hoy conservan el control de Superset (`RangeFilterPlugin`, filtro de tiempo) |
| **Botón Aplicar** e icono de cambios pendientes | Elegir varios valores y aplicar de una vez | Encaja con `filter_bar_auto_apply` |
| **Píldoras** de la selección | Valores elegidos como fichas que se quitan con un clic | Encabezado o debajo de la caja |
| **Resumen en el encabezado** | «3 seleccionados» | Encabezado |
| **Texto: varios valores y solo números** | El cuadro de entrada acepta una lista | Hoy filtra con `ILIKE` (contiene) |
| **Ordenar los valores** | Por el propio campo, ascendente o descendente | Reutilizar los adaptadores de orden de `visual-sorting.md` |

Cada función necesita su test de `SlicerView` y una pasada en el navegador con el tablero 147: filtrar, guardar,
recargar, marcadores y sincronizar segmentadores.

**Listo cuando:** las cuatro variantes tienen el nivel General entero, y la selección única, la jerarquía, la fecha
o el rango y el botón Aplicar funcionan y se guardan.

## C. Segmentadores: formato de sus partes (fase 7c, M)

**Estado (2026-11-03):** hecho con límites. Páginas tooltip (desde gráficos ECharts, tablas y tarjetas, con
elementos de diseño y fechas por periodo), restablecer filtros, pestañas de página abajo como en Power BI y panel de
filtros al editar, probados en el tablero 189 «QA páginas tooltip» (datos sintéticos) y con segmentadores en el 187.
La barra inferior y el panel de filtros siguen el concepto del informe de frijoles (flechas, «Página 1 de 3»,
pestañas planas, tarjetas de filtro con su resumen y contador en el riel). Fuera: el mapa de InfoMap (fase 11), la
matriz y segmentadores dentro del tooltip. Sin probar con SESEQ (142). Los
comentarios siguen sin decidir.

### Fuera por defecto (P3, se decide tras usar B y C)

Imagen y efectos de imagen en cada botón, brillo y sombra por estado, barra de acento, formas personalizadas
(recortes, esquinas por lado), rotación, estados por botón individual, estilos preajustados y desbordamiento. Es la
mayor parte de las 454 P3 de la fase 7.

## D. Páginas tooltip y restablecer filtros (fase 9, L)

- **Páginas tooltip:**
  - Un tipo de página (oculta, de tamaño pequeño) marcada en `TAB-*.meta`.
  - Asignarla desde General › Tooltip de un gráfico (automática por campos comunes o elegida).
  - Al pasar sobre una marca, dibujar la página flotante con el filtro de esa marca, como drill through
    (`mibi-drillthrough`) pero sin navegar.
  - Reto: cada aparición consulta varios gráficos. Hay que cachear por valor y cancelar al salir.
- **Restablecer filtros:** botón que vuelve al estado guardado, incluidos marcadores y filtros cruzados.
- **Pendientes de la revisión UX:** pestañas de página abajo, panel de filtros en edición, comentarios (decidir si se
  quieren).

**Listo cuando:** InfoMap e InfoEmpleado de SESEQ funcionan como en Power BI.

**Estado (2026-11-03):** hecho con límites. Páginas tooltip en gráficos ECharts y restablecer filtros, probados en
el tablero 189 «QA páginas tooltip» (datos sintéticos, creado para esto) y con segmentadores en el 187. Fuera: el mapa de
InfoMap (los mapas no son ECharts, fase 11), elementos de diseño dentro de la página tooltip y fechas como filtro de la
marca. Sin probar con SESEQ (142).

## E. Hallazgos de QA y lo no comprobado (M)

Repasados en la app el 4/11, ya sobre 7.0 (detalle en [`qa-main.md`](qa-main.md)):

| # | Qué | Estado |
| --- | --- | --- |
| 2, 4 | Móvil a 375 px: la página desborda, raíl siempre visible | Corregido: cajón de navegación en teléfonos, comandos que se parten |
| 3 | Tarjetas de Inicio en dos columnas | Ya no aplica (Inicio cambió) |
| 21 | Embebido a 375 px: lienzo de 269 px | Ya bien: 343 px con filtros, ancho entero sin ellos |
| 12 | Gráficos Horizon | Hecho (`2cc4adf797`) |
| 16 | Modo presentación | Ya bien: la página entra entera, sin scroll |
| 10 | «Guardar como» y marcadores | Ya bien: la copia lleva los ids nuevos (comprobado con el DAO real, revertido) |
| 15 | Orden de la tabla y flecha | Corregido en código y test; ningún gráfico tiene orden guardado para verlo |
| 17, 18 | PDF: emojis, índice, títulos | Corregido en código y tests; no se reexportó |
| 8 | Casilla «duplicar gráficos» | Ya bien: no existe |
| 11, 13, 20 | `appSection`, insignia «Bloqueado», avisos del embebido | Ya bien |

**Sin comprobar todavía:**
- `tests/experimental/dashboard/sort.spec.ts`: el 4/11 no arrancó por el entorno. El Playwright de 7.0 pide
  `chromium_headless_shell-1234`, que no está descargado (`npx playwright install chromium` desde `superset-frontend/`,
  unos 100 MB), y la prueba crea su tablero sobre la conexión `examples`, que ya no existe en el entorno de desarrollo
  (o `PLAYWRIGHT_DATABASE=<otra conexión>`).
- Prueba E2E de Playwright de los datasets de espacio de trabajo (`data-panel.spec.ts`, sin escribir). A mano, el 4/11:
  cada espacio lista los suyos en su página y en `/api/v1/workspace/<id>/datasets/`; el filtro
  `dataset_usable_in_dashboard` da al 156 (espacio 6) su `ventas_demo` y el compartido, al 147 (sin espacio) solo el
  compartido; `validate_chart_dataset` rechaza un dataset de SESEQ en el 156 y uno de espacio en el 147.
Para hacer a mano en un navegador normal (el panel de la app y el modo headless no lo cubren):
- Mapa deck.gl de SESEQ (WebGL falla en headless).
- Exportar SESEQ a PDF y PNG (sus capturas no se pueden publicar: datos personales).
- Arrastrar, redimensionar y exportar en Safari y Firefox.
- Pantalla completa del modo presentación en Chrome (el panel de la app no la admite).
- El cajón de navegación en un teléfono de verdad (iPhone Safari): abrir, cerrar con el velo y al navegar.
- Campos (fase 10) con un usuario sin permisos sobre el gráfico.

## F. Límites de las fases hechas (M)

Detalle en [`estado-formato-powerbi.md`](estado-formato-powerbi.md). Lo que más se nota:

- **Fase 10, campos:**
  - Que Deshacer revierta los campos.
  - Soltar un campo sobre el gráfico del lienzo, y casillas para añadirlo.
  - Cambiar el conjunto de datos de un gráfico.
  - Que el panel Datos liste todos los datasets del espacio, no solo los ya usados.
- **Fase 8, analítica:**
  - Campos de tooltip en el combinado.
  - Zoom del eje secundario y límites en valores, no en porcentaje.
  - Formato de la cuadrícula de múltiplos.
  - Sombreado sobre un eje de categorías.
- **Fase 3, barras y líneas:** segundo eje en líneas y áreas; detalle de etiqueta con otro campo; densidad de
  etiquetas.
- **Fases 5 y 6:**
  - Imagen y etiqueta propia en el centro del anillo.
  - Máximo de desgloses con «Otros» en cascada.
  - Objetivo por campo en el medidor.
  - Algoritmos de treemap.
- **Fase 4:** fijar encabezados de fila y las dos opciones de accesibilidad.

## G. Cinta y comodidades de edición (S–M)

De la revisión UX, lo que queda tras la cinta, el panel de Selección, el bloqueo y el menú de página:

- Cortar en el portapapeles de la cinta.
- Actualizar datos en edición.
- Exportar desde edición.
- Selector visible de Lectura / Edición.
- Decidir si hace falta editar el diseño móvil (hoy es automático en `mobile.ts`).

## H. Mapas (fase 11, L)

Decidir el motor antes de nada: deck.gl (propuesta), `country_map` o MapBox. Después, una sección de capas que cubra
primero lo que usa SESEQ: burbujas con leyenda y tamaño.

## I. P3 y gráficos nuevos (fase 12, L)

Solo si se piden: barras de error, anomalías, pronóstico con formato, Ribbon, tarjeta de varias filas y la tarjeta
nueva. Su inventario ya existe.

## Decisiones pendientes

1. **Orden B/C frente a D** (ver arriba).
2. **Alcance:** P1 y P2 en los gráficos que tenemos, y P3 solo si se pide.
3. **Rama `worktree-admin-menu-cleanup`:** mergear o descartar.
4. **Motor de mapas** (fase 11).
5. **Comentarios** en el reporte: sí o no.

## Cómo trabajar cada bloque

Como en el plan de formato:
- Una rama desde `main` por bloque.
- Las cadenas en `messages.po`.
- Tests junto al código y una pasada en el navegador con el tablero 147.
- Pre-commit antes de subir.
- Al cerrar un bloque, actualizar [`estado-formato-powerbi.md`](estado-formato-powerbi.md) y regenerar el inventario
  con `scripts/mibi/format_inventory.py`.
