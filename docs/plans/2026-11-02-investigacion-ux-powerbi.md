# Revisión: investigación de UX de Power BI frente a AuraData BI

Fecha: 2026-11-02 · Fuente: `~/Desktop/powerbi-ux-research.zip` (README, apéndice SESEQ, 113 capturas)

**Estado:** fases 1, 2 y 4 implementadas (sin commit): cinta, Selección, bloqueo, menú de página,
páginas ocultas, Visual/General, búsqueda, secciones plegables, texto alternativo y linaje. Pendiente:
fase 3 (páginas tooltip, segmentadores de botones y lista, restablecer) y comentarios. Las pestañas de
página siguen sobre la hoja, no abajo, y el panel de filtros sigue oculto al editar.

## Conclusiones

1. **Ya tenemos más de lo que parece.** Casi todo lo de la pestaña Inicio de la cinta existe, pero
   repartido entre la cabecera, la pestaña Formato y menús. La cinta es sobre todo reubicar, no
   construir.
2. **Lo que de verdad falta para tu reporte real:** páginas tooltip y páginas ocultas. El `.pbix`
   SESEQ usa las dos, y el tablero 142 solo trae las 4 páginas visibles.
3. **El mayor salto de comodidad al editar:** panel de Selección, bloqueo de objetos y menú de página
   (duplicar, ocultar).
4. **La investigación tiene huecos:** 27 de las 113 capturas no muestran lo que dice su nombre, y las
   cintas Insertar, Diseño, Vista y Optimizar no tienen ninguna captura válida.

## Calidad de la evidencia

Las capturas se tomaron de la ventana que estaba al frente, y en varias no era Power BI.

| Capturas | Dice ser | Muestra en realidad |
| --- | --- | --- |
| 40–42 | Mapa: vista inicial, controles, ajustes de capas | Escritorio y ventanas de chat |
| 57 | IMSS Bienestar | Pestaña nueva del navegador |
| 58–62 | IMSS y «Personal por rama» | Sitio de Ant Design |
| 63–64 | Errores de tooltip | Ventanas de chat |
| 65–68 | Diagnóstico, tooltips InfoMap/InfoEmpleado, **cinta Diseño** | Pestaña nueva del navegador |
| 69, 75, 80 | **Cinta Vista**, formato de tabla, **galería de visuales** | ChatGPT |
| 70–74, 76–79 | Formato de pie, tabla y tarjeta; vista de lectura | App UVISC Avalúos |

Consecuencias:

- **Sí hay evidencia visual:** cinta Inicio y pestañas contextuales Formato y Datos/Obtener detalles
  (01, 05), wells y formato de muchos visuales (81–113), Cédulas y SESEQ.
- **Solo hay texto del README, sin captura:** Diseño, Vista, galería, tooltips, IMSS. Insertar y
  Optimizar apenas se mencionan. Lo que aquí se diga de ellas está sin comprobar visualmente.
- **Conviene repetir:** cintas Insertar, Diseño, Vista y Optimizar; pestañas contextuales Formato y
  Datos abiertas; galería; páginas tooltip InfoMap e InfoEmpleado; vista de lectura.

**Privacidad:** las capturas muestran CURP, NSS y RFC de personas reales, y el tablero 142 también
muestra filas de personal. Además, algunas capturas enseñan chats y datos de UVISC. No se copiaron al
repositorio. Si las quieres compartir, hay que anonimizarlas antes.

## La cinta: qué tenemos y qué falta

Grupos tomados de la captura 01. Hoy, en edición, la barra superior solo tiene título, deshacer,
rehacer, Datos, Descartar, Guardar y «…» (Editar propiedades, Guardar como, Descargar, Compartir).

| Grupo en Power BI | Dónde vive en AuraData | Qué falta |
| --- | --- | --- |
| Guardar, deshacer, rehacer | Cabecera | Nada |
| Portapapeles: copiar, pegar, copiar formato | Pestaña Formato y atajos (`useObjectCommands`, `formatPainter`) | Cortar; pasarlos a la cinta |
| Insertar: página, visual, cuadro de texto | «+» en pestañas, «Crear nuevo gráfico», Elementos de diseño | Solo reubicar |
| Más visuales, cálculo visual | No aplica | No hacer (ver abajo) |
| Organizar | `ArrangeSection`, dentro de Formato | Pasarlo a la cinta |
| Datos: actualizar | «Actualizar» existe en el menú fuera de edición | Actualizar **en edición** |
| Datos: modelo, métricas, linaje | `DataMenu` abre datasets y SQL | Linaje simple; métricas de uso |
| Exportar | Modal PDF/PNG, solo fuera de edición | Acceso desde edición; PowerPoint es opcional |
| Administrar permisos | Diálogo de acceso del espacio de trabajo | Enlace desde la cinta |
| Pestañas contextuales Formato y Datos | Pestaña Formato; profundizar en `PageSection` | Que aparezcan al seleccionar un visual |
| Comentarios | No existe | Decidir si vale la pena (fase 4) |
| Selector Lectura / Edición | Botón «Editar tablero» y Descartar/Guardar | Selector visible con el modo actual |

### Propuesta de pestañas

- **Inicio:** Guardar · Deshacer/Rehacer · Portapapeles · Insertar · Organizar · Datos · Exportar ·
  Permisos.
- **Insertar:** Página · Gráfico · Texto · Imagen · Forma · Botón · Filtro de lienzo.
- **Diseño:** Tamaño de lienzo · Fondo · Panel de filtros · Pestañas. Sin temas guardados: el producto
  los descarta a propósito (ver `CLAUDE.md`).
- **Vista:** Ajustar página/ancho · Zoom · Cuadrícula · Paneles (Filtros, Marcadores, Selección,
  Formato) · Presentar.
- **Formato** y **Datos** (contextuales, con un visual seleccionado): Editar interacciones ·
  Organizar · Copiar formato · Título · Editar gráfico · Ver datos · Página de detalle.

### Riesgos de implementación

- `topOffset`/`barTopOffset` calculan la altura del panel lateral, del editor y de la barra de filtros
  (`calc(100vh - …)`), y «Ajustar página» depende del espacio disponible. La altura de la cinta, y su
  cambio al plegarse, tiene que entrar en ese cálculo.
- `dashboard/components/Header/index.tsx` es upstream. Conviene sacar la cinta a `src/mibi/ribbon` y
  tocar la cabecera lo mínimo, para no complicar los merges de Superset.
- Hay que mantener iconos y tamaños legibles: la cinta ocupa unos 90 px, así que debe poder plegarse.
- En pantallas estrechas los grupos deben colapsar a menús, no desbordarse.

## Resto de la comparación

### Ya lo tenemos

No hace falta construirlo: lienzo de página fija con zoom, cuadrícula de celdas (ya ajusta a la rejilla),
pestañas de página, filtros por nivel (todas las páginas, esta página, visuales), filtro en el lienzo,
sincronizar segmentadores, marcadores, obtener detalles, editar interacciones, formato condicional,
modo presentación, exportar PDF/PNG, varias familias de gráficos y mapas, y Matrixify como equivalente
a los múltiplos pequeños. El modo enfoque se parece a la pantalla completa del gráfico.

### Falta y vale la pena

| Función | Estado en el código | Por qué importa | Tamaño |
| --- | --- | --- | --- |
| **Páginas tooltip** | No existe | Las usa tu reporte (InfoMap en el mapa, InfoEmpleado) | L |
| **Páginas ocultas** | No existe | Las usa tu reporte; base para tooltips y páginas de detalle | S |
| **Panel de Selección** | Solo «Capas» en Formato | Imprescindible en páginas densas como SESEQ | M |
| **Bloquear objetos** | `mibiLocked` declarado, sin uso real | Evita mover visuales sin querer | S |
| **Menú de página:** duplicar, ocultar | No existe duplicar página | Flujo muy común al construir | M |
| **Segmentador de botones y de lista** | Solo selector, rango y fecha | Muy usados; hoy solo se cambia el aspecto de la caja | M |
| **Restablecer filtros** de la vista de lectura | Solo «Limpiar todo» en la barra | Volver al estado guardado, incluidos marcadores | S |
| **Tooltips con campos extra** | Por verificar por tipo de gráfico | Pozo «Información sobre herramientas» del research | M |
| **Formato Visual / General** | Formato del tablero y Personalizar de Explore están separados | Separar propiedades del gráfico de título, efectos y alt text | M |
| **Buscar en el panel de formato** | No lo vi en `FormatPane` | Listas largas de opciones | S |
| **Texto alternativo** | No existe | Accesibilidad, requisito en gobierno | S |
| **Linaje simple** | No existe | Origen → dataset → tablero | M |

### Por revisar antes de decidir

No abrí el editor acoplado ni la galería de Explore durante esta revisión; lo que sigue viene del
código y del historial de commits.

- **Pozos y panel de datos:** Explore ya los ofrece, pero con nombres de Superset (Métricas,
  Dimensiones) en lugar de roles fijos por visual. Hay que comparar con 02 y 31–37.
- **Panel Data siempre visible** con el lienzo: el editor se acopla al lado (`800abe878c`), pero no
  sé si el flujo basta. Es el punto 1 de los patrones del research.
- **Analítica:** existe análisis avanzado en Explore. Como se quitaron las capas de anotación, hay que
  comprobar si queda forma de añadir líneas de referencia.
- **Diseño móvil:** existe automático (`mobile.ts`), no un editor. Decide si necesitas editarlo.

### No vale la pena (por ahora)

Key influencers, árbol de descomposición, Narrativa, Copilot, Power Apps/Automate, ArcGIS, informes
paginados, Analizar en Excel, «Más visuales»/AppSource, cálculos visuales, temas personalizados
(descartados por producto) y capas tipo Azure Maps completas. Las capas de mapa solo si SESEQ se queda
corto con el mapa actual.

## Orden propuesto

1. **Cinta (M–L).** Armazón plegable con Inicio, Insertar, Diseño y Vista, usando acciones existentes.
   Después las pestañas contextuales. Cadenas en `messages.po`. Es lo que más notarás cada día y casi
   no añade lógica nueva.
2. **Comodidad de edición (M).** Panel de Selección, bloqueo, menú de página (duplicar, ocultar) y
   páginas ocultas.
3. **Paridad con SESEQ (L).** Páginas tooltip, segmentadores de botones y lista, restablecer.
4. **Pulido (M).** Visual/General y búsqueda en Formato, alt text, linaje, comentarios si los quieres.

Antes de la fase 1 conviene repetir las capturas de las cintas Insertar, Diseño, Vista y Optimizar, para
copiar agrupaciones reales y no las de este resumen.
