# Revisión de UI/UX: datos dentro del panel de control (2026-11-01)

Recorrido en el navegador sobre http://localhost:8188 (admin), escritorio 1024 px y móvil 375 px,
con la migración `d3f9a2b17c64` aplicada. Capturas en esta carpeta.

## Pantallas revisadas

| # | Pantalla | Resultado |
|---|---|---|
| 01 | Inicio y menú lateral (Administración abierta) | Bien |
| 02 | Buscador ⌘K | Bien, sin SQL Lab ni Datos |
| 03 | Nueva área de trabajo (desde «Nuevo») | Bien |
| 04–05, 15 | Página del área con la sección «Conjuntos de datos» | Bien tras el arreglo 3 |
| 06 | Panel de control en vista: sin barra lateral, logo arriba | Bien |
| 07 | Menú «Datos» en modo edición | Bien |
| 08–09 | Editor SQL en el panel → «Crear gráfico» abre «Nuevo visual» | Bien |
| 10–11 | Datos en el panel, con «Compartido» | Bien tras el arreglo 5 |
| 12 | Nuevo conjunto de datos en el panel | Bien tras el arreglo 6 |
| 13 | Guardar SQL como dataset → editor de gráfico; el dataset queda en «QA Equipo» | Bien |
| 14 | Lista de paneles de control | Bien |
| 16–18 | Móvil: área de trabajo y encabezado del panel | Bien tras los arreglos 8 y 9 |
| — | `/sqllab/`, `/data/`, `/tablemodelview/list/` abiertos directo | Redirigen a paneles / áreas |
| — | Conexiones (Administración) | Bien tras el arreglo 7 |

## Arreglos hechos en la revisión

1. Traducciones nuevas decían «tablero»; la app usa «panel de control».
2. «Nuevo» fuera de un panel solo ofrecía «Panel de control»: añadida «Área de trabajo»
   (abre el diálogo de creación con `/workspace/list/?new=true`).
3. En páginas más altas que la ventana, el fondo se cortaba a la altura de la ventana
   (`AppShell`: el contenedor de la página ya no se encoge).
4. «Listar roles» / «Listar usuarios» en el menú pasan a «Roles» / «Usuarios».
5. Datos en el panel: el título «Datos» salía dos veces; la etiqueta «Compartido» solo se
   muestra cuando el área ya tiene datasets propios.
6. «Cancelar» en Nuevo conjunto de datos hacía `history.goBack()`, que dentro del panel podía
   sacar al usuario del panel de control; ahora vuelve a Datos.
7. La página de Conexiones se titulaba «Bases de datos».
8. Móvil, área de trabajo: el nombre se cortaba y la tarjeta del panel se salía del ancho.
9. Móvil, panel de control: logo completo sin espacio (ahora solo el símbolo) y el título del
   encabezado quedaba en 2 px.
10. Editor SQL en el panel: cada apertura creaba una pestaña «Untitled Query» nueva; ahora
    retoma la última consulta.

## Pendiente / no revisado

- Tema claro (la app sigue el sistema; se revisó en oscuro).
- Guardar un gráfico nuevo con un dataset del área (no se guardó para no dejar datos de
  prueba en el panel; la regla está cubierta por pruebas de backend).
- Queda creado el dataset de prueba `qa_ventas_region` en «QA Equipo».
- El servidor de desarrollo atiende una petición a la vez: el panel SQL tarda ~15 s en abrir
  mientras cargan los gráficos.

## Segunda pasada: editor de visuales (espaciado y orden)

Capturas 19–23 (antes/después a 1024 px).

11. El área del gráfico pedía 512 px de ancho mínimo: con las columnas de datos (300 px) y de
    controles (320 px) no cabía en el panel y el gráfico se cortaba por la derecha. Dentro del
    panel el mínimo es 280 px y el panel del editor ocupa hasta el 92 % de la ventana.
12. Dos barras de título apiladas (la del panel y la de Explore): la del panel es más delgada y
    la de Explore baja de 64 a 52 px, sin la barra de metadatos («Añadido a 1 panel de
    control · autor · fecha») ni la estrella, que no aportan con un panel por gráfico.
13. Controles en escalera: cada sección añadía 8 px de sangría y cada subsección («Eje X»,
    «Eje Y») 12 px más. Ahora todo se alinea con su encabezado, como en el panel de formato de
    Power BI (`ControlPanelsContainer`).
14. Entre controles había 28 px; ahora 18 px. Encabezados de sección y su contenido con menos
    relleno.
15. Etiquetas en mayúsculas por la traducción («MARGEN DEL TÍTULO DEL EJE», «POSICIÓN DEL
    TÍTULO DEL EJE»), ahora en tipo oración.
16. Abrir en el panel la misma página que ya mostraba dejaba el indicador de carga girando.

Probado y descartado: ocultar «Mostrando X de Y elementos» deja un hueco, porque la lista de
campos es virtual con filas de alto fijo.

Propuesta pendiente: el relleno interior por defecto de los visuales en el lienzo es 16 px
(`BASE_VISUAL_PADDING`) y las esquinas 14 px; bajarlo a 12 px haría el lienzo más denso, pero
cambia el aspecto de todos los paneles guardados sin formato propio.

## Tercera pasada: huecos del editor, redimensionar visuales y títulos

Capturas 24–29.

17. Huecos en el editor: la caja del dataset (16 px arriba y abajo), el buscador de campos
    (16 px más) y el selector de tipo de gráfico (margen de control) dejaban ~40 px vacíos; ahora
    ~20 px.
18. Redimensionar: en el borde que comparten dos visuales apilados ganaba el de abajo aunque el
    seleccionado fuera el de arriba (se agarraba el equivocado). El seleccionado queda encima.
19. Un gráfico se podía achicar hasta 64 × 64 px (2 celdas), donde el título y los iconos ya no
    caben. Mínimo para gráficos: 4 × 3 celdas (128 × 96 px); los elementos de diseño siguen en 2.
20. Esquina inferior derecha sin clase (sí funcionaba) y cursores diagonales en las cuatro
    esquinas.
21. Títulos: en edición el título es un `textarea` de ancho completo que ignoraba la alineación;
    en vista los iconos ocultos seguían ocupando sitio y el `max-width` de Superset descentraba
    el título 11 px. Centrado: 0 px de desvío. «Derecho» → «Derecha».

Probado y correcto: alto y ancho con los tiradores (el gráfico se redibuja al tamaño nuevo y
ajusta a celdas de 32 px), esquina en diagonal, deshacer. Al crecer, un visual puede quedar
encima de otro (las posiciones son libres, como en Power BI).

## Cuarta pasada: tema claro, flujo completo y verificación

Tema claro (1280 px): inicio, áreas de trabajo, página del área, panel de control en vista y en
edición, menú «Datos», panel de datos, página de un dataset y editor de visuales. Sin problemas de
contraste ni de colores.

Flujo completo probado: menú «Datos» → dataset del área («qa_ventas_region») → visual nuevo →
guardar. El backend acepta el dataset del área y el gráfico vuelve al panel de control.

22. Un visual nuevo guardado desde el panel lateral caía en la celda (0,0), encima de otros
    objetos. Ahora ocupa el primer hueco libre de la página (`freeCell` en `positions.ts`), igual
    en el panel, al guardar desde Explore (`SaveModal`) y al cargar un gráfico que se añadió sin
    guardar el panel de control (`hydrate`). Si la página está llena, va abajo a la izquierda,
    dentro de la página.
23. `SaveModal` creaba la fila nueva con los padres `ROOT_ID > GRID_ID > pestaña` aunque la
    pestaña estuviera dentro de un `TABS`; ahora usa los padres reales de la pestaña.
24. El diálogo «Guardar gráfico» de un visual nuevo mostraba «Guardar (sobrescribir)» desactivado
    y «Guardar como…»: ahora solo pide el nombre.
25. Página de un dataset dentro del panel: botón «Nuevo visual», que abre el editor con ese
    dataset (antes había que volver al panel de control y elegirlo otra vez).
26. «Ver como lista» de Conexiones dentro del panel llevaba a una página sin forma de volver a
    Datos; dentro del panel ya no aparece (las tarjetas tienen lo mismo).

Backend: `ruff` sin avisos y `mypy` sin errores nuevos en el código de datasets por área (los
avisos de `workspaces.py` son del patrón `Response | None` que ya existía y salen solo con las
versiones de Flask del contenedor).

27. En modo edición, los botones flotantes del visual (borrar y formato) quedaban encima del botón
    «Ordenar eje» del encabezado, que no se podía pulsar. Ahora forman una pestaña sobre el borde
    superior del visual, como la cabecera de un visual en Power BI.
28. Un gráfico guardado sin `query_context` (creado por la API o importado) no enviaba al panel de
    control la columna de su eje X, así que no se sabía su tipo y no se ofrecía ordenar. El backend
    cuenta `x_axis` entre las columnas usadas (`COLUMN_FORM_DATA_PARAMS`).
29. «Esperando por examples» mientras carga un gráfico pasa a «Consultando examples…».

Playwright (experimentales de paneles de control y estrés): 29 de 29 tras los arreglos. Las pruebas
de ordenar ya fallaban antes de esta sesión (comprobado compilando el código anterior); su dataset
de prueba sincroniza ahora sus columnas.

Quedan dos gráficos de prueba, «QA Regiones» y «QA Regiones 2», en «QA Sales», y el panel de
depuración «dbg_sort_…» (id 117) con su gráfico y dataset.

Pruebas que ya fallaban antes de estos cambios (comprobado quitándolos): `columns.test`,
`editing.test`, dos de `ChartHolder.test` (ocultar y bloquear, funciones retiradas) y
`ResizableContainer.test` (falta el Provider de Redux).
