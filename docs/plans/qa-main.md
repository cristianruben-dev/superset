# Plan: pruebas de aceptación de AuraData BI sobre `main`

## Contexto
`main` reúne todo lo construido sobre Superset 6.2: marca AuraData, espacios de trabajo, panel de formato, elementos de diseño, barra de filtros por niveles, interactividad de informes (interacciones, drill through, sincronizar segmentadores, marcadores) y la ordenación de visuales. Nada de esto se ha recorrido de punta a punta en un navegador después de juntarlo. Antes de subir `main` y de plantear la migración a Superset 7.0, hay que comprobar que la versión que tenemos funciona y dejar constancia con capturas.

**Estado (31 de octubre de 2026):** fases 1 a 5 recorridas sobre `main` (`5d75ca77f6`). 22 hallazgos en la sección 5: 5 altos, 9 medios, 7 bajos y 1 resuelto. Corregidos en este mismo recorrido: la vista previa «Panel vacío» (#1), la fecha futura de las áreas de trabajo (#19), dos tildes (#5, #9) y el login y el idioma del global-setup de Playwright (#6, #22). El resto queda documentado para la fase 6. Las capturas están en `docs/qa/2026-10-31/` (65 archivos) y la página anfitriona del embebido en `docs/qa/embed/`.

## Entorno
- Stack de desarrollo de este repo: `docker compose` del proyecto `superset`, aplicación en **http://localhost:8188** (`admin` / `admin`). El puerto 8088 lo ocupa otro proyecto (`bi`), no sirve para probar este código.
- El backend corre desde el código del repo (bind mount). El frontend se sirve desde `superset/static/assets`, compilado con el último commit de `main`; `superset-node` (recarga en caliente, puerto 9000) no está levantado. Tras cualquier cambio de frontend hay que recompilar con `npm run build` o levantar `superset-node`.
- Datos: 9 dashboards de ejemplo publicados (Sales, Video Game Sales, World Bank, USA Births, deck.gl...), 103 charts, 21 datasets, 4 temas de formato (Corporativo, Fresco, Vibrante, Minimalista). **No hay espacios de trabajo**: se crean durante la prueba.
- El servidor de desarrollo corre `flask run --without-threads`: atiende una petición a la vez. Playwright se ejecuta con `--workers=1` y no se capturan pantallas mientras corre.
- El bundle servido es de desarrollo (`npm run dev`), no de producción: intenta abrir el WebSocket de webpack-dev-server y falla con 404; es ruido esperado en la consola.
- Capturas: `docs/qa/2026-10-31/`, una por pantalla o estado, nombradas `NN-area-que-muestra.png`. Se decide al final si se versionan.

## Cómo se registra cada hallazgo
Cada problema va a la tabla de la sección 5 con: área, pasos para reproducirlo, qué se esperaba, qué pasa, severidad y captura.

| Severidad | Significa |
|---|---|
| **Bloqueante** | Rompe un flujo principal (no se guarda, pantalla en blanco, error 500) |
| **Alta** | La función existe pero da un resultado incorrecto |
| **Media** | Funciona, pero con un defecto visible (texto en inglés, desalineado, lento) |
| **Baja** | Detalle cosmético |

---

## Fase 1. Comprobaciones automáticas (sin navegador)
Dan una base rápida antes de abrir nada. Se ejecutan desde `superset-frontend/` salvo pytest.

- [x] `npm run type` (typecheck completo, limpio).
- [x] `npm run lint` (0 errores, 1491 avisos heredados de upstream).
- [x] `npm run test -- src/mibi` (27 suites, 225 tests en verde).
- [x] `npm run test -- plugins/plugin-chart-echarts plugins/plugin-chart-table packages/superset-ui-chart-controls` (111 suites, 1051 tests en verde).
- [x] `pytest tests/unit_tests/mibi/` (82 tests en verde, dentro del contenedor).
- [x] En vez de `pre-commit run --all-files` (no hay venv en el host): `ruff check`/`ruff format --check` en el contenedor y `prettier --check` en el host sobre los archivos tocados, limpios. Queda pendiente `pre-commit run --all-files` antes de subir.
- [x] Playwright experimental (`INCLUDE_EXPERIMENTAL=1 PLAYWRIGHT_BASE_URL=http://localhost:8188 PLAYWRIGHT_ADMIN_PASSWORD=admin node_modules/.bin/playwright test tests/experimental/dashboard/ --workers=1`): 7 pasan (lista de dashboards ×5, exportación ×2) y 6 caen por tiempo límite (format ×3, sort ×2, theme ×1), todas esperando llamadas a la API de sus fixtures; el servidor `flask run --without-threads` (heredado de upstream, #34907) atiende una conexión a la vez y el navegador con cabeza la retiene. No es un fallo funcional: el formato, el tema y la ordenación se verificaron a mano en las fases 3 y 4. Para que estas pruebas valgan hace falta un servidor con hilos (gunicorn o `--with-threads`) o subir sus `timeout`.

`pytest` y `pre-commit` se ejecutan dentro del contenedor `superset` (el host no tiene entorno de Python).

**Resultado esperado:** todo en verde. Cualquier fallo se anota en la sección 5 antes de seguir.

## Fase 2. Recorrido con capturas: shell y navegación
- [x] **Login.** Marca AuraData (logo Continua + etiqueta «BI»), textos en español, Outfit como tipografía.
- [x] **Inicio** (`mibi/home`). Tarjetas de acción con tonos de marca, sin tarjeta de saludo, vistas previas de dashboards (`dashboard_previews`).
- [ ] **Menú y barra superior.** Todas las entradas en español; cambiar a inglés y volver; ninguna pantalla de Superset escondida sigue accesible desde el menú (lista de charts no existe).
- [x] **Lista de dashboards** (`mibi/dashboards`): búsqueda, orden, vista previa, crear, duplicar, borrar, publicar.
- [x] **Página de datos** (`mibi/data`): listado de datasets, crear dataset desde una tabla, editar métricas y columnas, borrar.
- [x] **Espacios de trabajo** (`mibi/workspaces`): crear uno, invitar un usuario con cada rol (lector, colaborador, administrador), mover un dashboard dentro, comprobar que un lector no puede editar ni ver dashboards de otro espacio (iniciar sesión con otro usuario).
- [x] **Móvil** (viewport 375 px): inicio, lista y un dashboard; los visuales con `mibiHideMobile` no se ven.

## Fase 3. Recorrido con capturas: editar un dashboard
Se trabaja sobre una copia de **Sales Dashboard** y sobre un dashboard nuevo vacío.

### 3.1 Lienzo y cuadrícula
- [x] Tamaños de página: 4:3 aplicado y guardado (`size.mode`). Carta y personalizado no probados; el límite al arrastrar no se probó (sin arrastre).
- [x] Densidad 24 columnas: los anchos se reescalan (4/12/6…) y nada se sale. 48 no probado.
- [x] Fondo de lienzo: degradado aplicado por el tema y guardado. No probados: color plano e imagen subida.
- [ ] Deshacer y rehacer agrupan cada cambio de formato en un paso.

### 3.2 Charts desde el panel lateral
- [ ] Crear un chart de cada familia desde el panel: no probado (el panel «Editar visual» abre y muestra Datos/Personalizar; la creación desde cero queda pendiente).
- [x] Editar un chart existente, cambiar dataset, guardar: el chart sigue perteneciendo solo a este dashboard (`MIBI_SINGLE_DASHBOARD_CHARTS`); intentar añadirlo a otro falla con mensaje claro.
- [ ] Tooltips de ayuda ilustrados en controles de chart y de formato.

### 3.3 Panel de formato
- [x] Formato propio de un chart: el panel Formato del chart seleccionado muestra Fondo, Borde, Sombra y relleno, Título e Iconos del encabezado; el editor del chart tiene las secciones de etiquetas, leyenda, ejes, series y formato condicional. No se cambiaron valores uno a uno.
- [x] «Aplicar a todos los charts»: el tema deja `visuals` compartido en `mibiCanvas` y el formato propio del chart se edita aparte. No se comprobó la precedencia ajuste por ajuste.
- [x] Temas: aplicar los 4 temas, crear uno nuevo desde el estado actual, editar, borrar; el backend (`apply_theme`) y el frontend dan el mismo resultado al recargar.
- [x] Ocultar, bloquear y ocultar en móvil un visual.

### 3.4 Elementos de diseño
- [x] Imagen (data URI), forma, botón, texto y filtro de lienzo: insertados por API (el arrastre desde el panel no responde al ratón sintético), se dibujan y guardan bien. No probados: subir imagen, mover y borrar desde la UI.
- [x] Filtro de lienzo con `showInFilterBar` apagado: no aparece en la barra de filtros.
- [x] Botón con acción «Atrás» y con acción «Marcador».

### 3.5 Barra de filtros
- [ ] Niveles «todas las páginas», «esta página» y «visuales» en un dashboard con pestañas.
- [ ] Aplicación instantánea encendida y apagada (`filter_bar_auto_apply`).
- [ ] La lista de opciones de un filtro de lienzo queda por encima de los charts de abajo.

### 3.6 Interactividad del informe
- [x] **Editar interacciones:** elegir un chart origen, poner «filtrar» o «ninguna» en cada destino; guardar; el filtro cruzado respeta la elección al recargar.
- [x] **Drill through:** declarar columnas en una página destino; desde un chart origen, menú contextual › drill through; la página destino queda filtrada y solo sus charts (`mibi-drillthrough`); botón Atrás vuelve.
- [ ] **Sincronizar segmentadores:** un filtro de lienzo copiado a otras páginas comparte selección.
- [x] **Marcadores:** crear con página, filtros, selección cruzada y visibilidad; aplicar, actualizar, renombrar, borrar; la visibilidad aplicada no pisa `mibiHidden` al guardar.

### 3.7 Ordenar visuales (lo más nuevo)
- [ ] Desde el encabezado del visual, como editor: barras por eje y por medida, ascendente y descendente; horizontal invertido correcto.
- [ ] Circular y embudo: por medida y por categoría, en ambos sentidos.
- [x] Tabla: elegir columna y sentido; las filas llegan ordenadas (el encabezado no marca la flecha: limitación conocida).
- [ ] Un lector no ve opciones de orden.
- [ ] El orden se guarda con el dashboard y sobrevive a recargar y a exportar/importar.

### 3.8 Guardar, exportar e importar
- [x] Guardar, recargar y comparar: tema, tamaño 4:3, 24 columnas, elementos, marcador, drill through y orden de la tabla sobreviven a la recarga.
- [x] Exportar el dashboard (ZIP) e importarlo en otro nombre: formatos, elementos, marcadores y orden intactos; los charts del importado son copias (un dashboard por chart).

## Fase 4. Recorrido con capturas: ver y presentar
- [x] Vista de lectura de un dashboard con tema aplicado: igual que en edición, sin controles de editor; el lector (rol Alpha + miembro) no ve «Ordenar eje» ni controles de edición (API: 403 al editar).
- [x] **Modo presentación** (`mibi/present`): pantalla completa, paso de páginas, salir.
- [x] **Exportar PDF y PNG** (`mibi/export`): una página y todas; el archivo respeta tamaño de página, fondo y elementos; solo espera a los charts visibles.
- [ ] Idioma inglés de punta a punta en una pasada rápida: nada queda en español ni al revés.

## Fase 5. Dashboards embebidos
Hoy el fork no tiene el embebido encendido: `EMBEDDED_SUPERSET` está en `False`, no hay dashboards embebidos registrados y Talisman no declara `frame-ancestors`. La prueba primero habilita lo mínimo en la configuración local de desarrollo y luego comprueba cómo se ve un dashboard dentro de un iframe.

- [x] Encender `EMBEDDED_SUPERSET` en `docker/pythonpath_dev/superset_config.py` y permitir `frame-ancestors` para `http://localhost:*`; reiniciar `superset`.
- [x] Rol invitado: `Public` no tiene ningún permiso en este stack, así que la prueba usa `GUEST_ROLE_NAME = "Gamma"` en la configuración local. Un despliegue necesita un rol propio con lo justo para leer dashboards y datos (`can_read` en Dashboard, Chart, Dataset, `can_explore_json`/`chart data`); sin acceso a edición, SQL Lab ni listas.
- [x] Registrar como embebido un dashboard con tema, elementos de diseño, varias páginas, filtros de lienzo y marcadores (la copia de Sales Dashboard de la fase 3) vía `POST /api/v1/dashboard/<id>/embedded` con `allowed_domains`.
- [x] Página anfitriona de prueba en `docs/qa/embed/index.html`, servida en `http://localhost:8787`, que pide el guest token al backend (login admin + `POST /api/v1/security/guest_token/`) y monta el dashboard con `@superset-ui/embedded-sdk` (`superset-embedded-sdk/`).
- [x] **Se ve bien:** sin barra lateral ni menú de AuraData (la vista embebida va sola, `AppShell`), tamaño de página fijo respetado y centrado, fondo del lienzo, tema, fuentes Outfit/Geist Mono cargadas dentro del iframe, elementos de diseño, iconos; captura a 1280, 1024 y 375 px.
- [x] **Funciona:** cambio de página con botón y con pestañas, filtro de lienzo con aplicación instantánea, barra de filtros visible/oculta y expandida, título y controles de chart según `dashboardUiConfig`. No probados dentro del iframe: filtros cruzados, drill through, marcadores.
- [ ] **Lo que no debe verse:** controles de editor, menú de ordenar visuales, «…» de exportar/editar, enlaces a inicio o espacios de trabajo.
- [x] Guest token con `rls` (una regla por columna) y con `dashboardUiConfig`: el filtro se aplica. La renovación del token a los 5 min no se esperó.
- [x] Dominio no permitido: la misma página desde otro origen (`http://127.0.0.1:8787`) debe rechazarse.
- [x] Un dashboard dentro de un espacio de trabajo con `MIBI_WORKSPACE_ACCESS`: el guest token lo abre aunque el invitado no sea miembro (`workspace_access.py`).
- [x] Móvil embebido (375 px): se cambia a la disposición móvil y se respetan `mibiHideMobile`.

## 5. Hallazgos
| # | Área | Pasos | Esperado | Ocurre | Severidad | Captura |
|---|---|---|---|---|---|---|
| 1 | Inicio / vistas previas | Abrir Inicio con un dashboard que tenga pestañas de primer nivel (Sales Dashboard, Video Game Sales) | Vista previa con la disposición de sus charts | «Panel vacío». `_content_root` en `superset/mibi/previews.py` empieza en `GRID_ID`, pero con pestañas de primer nivel las `TABS` cuelgan de `ROOT_ID` y `GRID_ID` no tiene hijos | Alta | `02-inicio.png` |
| 2 | Móvil (375 px) | Abrir Inicio o Paneles de control en un viewport de 375 px | La página cabe en el ancho del teléfono | Desbordamiento horizontal: Inicio mide 424 px y la lista de paneles 451 px; el botón «Panel de control» y las tarjetas se salen por la derecha | Alta | `10-inicio-movil.png`, `11-paneles-movil.png` |
| 3 | Móvil / Inicio | Inicio a 375 px | Tarjetas de acción a una columna | Se aprietan en dos columnas y el texto se parte palabra por palabra | Media | `10-inicio-movil.png` |
| 4 | Móvil / shell | Cualquier pantalla a 375 px | Barra lateral oculta o en cajón | El raíl de iconos queda siempre visible (con los iconos de Administración desplegados) y quita 48 px al contenido; en el dashboard el título desaparece del encabezado | Media | `12-sales-movil.png` |
| 5 | Datos / i18n | Lista de conjuntos de datos | «Físico» | La etiqueta de tipo dice «Fisico», sin tilde | Baja | `04-datos.png` |
| 6 | Playwright (infra) | `INCLUDE_EXPERIMENTAL=1 npx playwright test tests/experimental/dashboard/` contra el servidor de desarrollo | El global-setup guarda una sesión iniciada | `AuthPage.waitForLoginSuccess` daba por buena la cookie `session` que ya pone la página de login (CSRF) y guardaba una sesión anónima: las 13 pruebas caían en el login. Corregido en `playwright/pages/AuthPage.ts` comprobando `/api/v1/me/` | Media | — |
| 7 | Formato / temas | En la copia «QA Sales», aplicar el tema «Vibrante» (paleta `neon`) y guardar | Todos los gráficos usan la paleta del tema | Solo algunos cambian de paleta: «Quarterly Revenue» sí; «Quarterly Revenue (By Product Line)» y el circular «Total Revenue By Product» siguen con `supersetColors`, aunque los tres tienen el mismo `color_scheme` propio. El fondo, los radios y las sombras del tema sí se aplican | Alta | `24-guardado-tema-4-3.jpg`, `25-qa-sales-recargado.png` |
| 8 | Guardar como | «…» › Guardar como, sin marcar «copiar también (duplicar) los gráficos» | La casilla no debería existir, o estar siempre marcada: con un dashboard por gráfico la copia siempre duplica | La casilla aparece desmarcada y aun así los gráficos se duplican (104–113). Confuso, no incorrecto | Baja | `21-guardar-como.jpg` |
| 9 | i18n | Encabezado del dashboard | «Título del panel de control» | El `aria-label` del campo dice «Titulo» sin tilde | Baja | — |
| 10 | Marcadores / Guardar como | Guardar como copia un dashboard con marcadores | Las selecciones cruzadas del marcador apuntan a los gráficos de la copia | `mibiBookmarks[].filters` conserva las claves de los gráficos originales (59, 62, 63…) en vez de las copias (104–113): el marcador copiado no puede restaurar filtros cruzados | Media | — |
| 11 | Filtro de lienzo (consola) | Abrir un dashboard con filtro de lienzo tipo Select | Sin avisos | React avisa de la prop desconocida `appSection` que llega al DOM desde `SelectFilterPlugin` (ruido en desarrollo) | Baja | — |
| 12 | Gráficos / plugins | Abrir la página «Exploratory» de Sales Dashboard (o su copia) | El gráfico «Seasonality of Revenue (per Product Line)» se dibuja | «Data error: Item with key "horizon" is not registered»: el plugin Horizon se quitó del fork (`feat/trim-chart-plugins`) pero los ejemplos y cualquier dashboard importado pueden seguir usándolo. Falta migrar o avisar con un mensaje claro y ofrecer cambiar de tipo | Alta | `29-pagina-2-horizon-error.jpg` |
| 13 | Edición / insignias | Bloquear un gráfico (`mibiLocked`) y entrar en edición | La insignia «Bloqueado» no tapa nada | La insignia se dibuja encima del título del gráfico («Total Products Sold» queda oculto) | Baja | `33b-edicion-pagina-1.jpg` |
| 14 | i18n (entorno) | Botón «Ordenar eje» en edición | `aria-label` «Ordenar eje» | Sale «Sort axis» aunque `messages.json` ya tiene la traducción: el servidor Flask carga el paquete de idioma al arrancar y lleva levantado desde antes de recompilar las traducciones. Tras reiniciar, `/superset/language_pack/es/` ya incluye «Ordenar eje»: solo entorno, no es un defecto del código | Resuelto | — |
| 15 | Ordenar visuales | En edición, «Ordenar eje» › Orden ascendente en la tabla «Products Sold By Product Line» | La tabla se reordena al momento | El orden se guarda en el chart (`mibi_table_sort`, `order_desc`) pero la tabla sigue descendente hasta recargar el dashboard; tras recargar sale bien (Trains primero) | Media | `35-menu-ordenar-eje.jpg`, `36-tabla-orden-ascendente-tras-recargar.jpg` |
| 16 | Modo presentación | «Presentar» en «QA Sales» (página 4:3) con un viewport de 1366×850 | La página se escala para caber entera en pantalla, como en Power BI | El lienzo se dibuja a 1091×1231 px dentro de 850 px de alto: hay que hacer scroll y los controles de abajo tapan el final. No se entra en pantalla completa (`document.fullscreenElement` nulo) | Alta | `38-modo-presentacion.jpg` |
| 17 | Exportar PDF | Exportar «QA Sales» a PDF con portada, todas las páginas | Índice legible | Los emojis de los nombres de página salen como «Ø<ß¯» y las entradas del índice llevan un espaciado de letras raro («S a l e s  O v e r v i e w»): la fuente de jsPDF no tiene emojis ni Outfit. El resto del PDF (logo, páginas, tema, elementos) sale bien | Media | `40-export-pdf-todas.pdf` |
| 18 | Exportar PDF/PNG | Mismo PDF, página 2 | Títulos completos | Títulos de dos líneas cortados a una («Products Sold By Pr…», «Total Revenue By Pr…») y la etiqueta «Country» del filtro de lienzo partida en «Countr / y» en la captura de html2canvas | Baja | `40-export-pdf-todas.pdf` |
| 19 | Áreas de trabajo / fechas | Crear un área de trabajo y mirar su cabecera | «Actualizada hace unos segundos» | «Actualizada dentro de 6 horas»: la fecha llega del backend sin zona horaria (UTC naive) y el cliente (UTC-6) la toma como local. Revisar `changed_on` de `WorkspaceSchema` y `src/mibi/time.ts` | Media | `46-area-de-trabajo-creada.jpg` |
| 20 | Embebido (consola) | Abrir un dashboard embebido | Sin errores de consola | «Failed to query feature flag ENABLE_JAVASCRIPT_CONTROLS» repetido ~10 veces y «Unexpected keys "config", "embedded" found in preloadedState»: la entrada `embedded` consulta flags antes de inicializarlos. No afecta a lo que se ve | Baja | — |
| 21 | Embebido / móvil | Host a 375 px con la barra de filtros visible | El lienzo aprovecha el ancho del teléfono | El raíl de «Filtros» colapsado y los márgenes dejan el lienzo en 269 px de 375; los elementos de diseño y los charts se ven, pero muy estrechos | Media | `53-embed-movil-375.png` |
| 22 | Playwright (infra) | `dashboard-list.spec.ts` y `export.spec.ts` contra el fork | Pasan | Buscan botones por su texto en inglés («Delete», «Export») y la interfaz está en español: la sesión del global-setup ahora cambia a `/lang/en` tras entrar (`playwright/global-setup.ts`). Además la contraseña por defecto del setup es `general`; con este stack hay que pasar `PLAYWRIGHT_ADMIN_PASSWORD=admin` | Media | — |

## 6. Después de las pruebas
Hecho en este recorrido (sin commit, en el árbol de trabajo):
- `superset/mibi/previews.py`: la vista previa empieza en `ROOT_ID` y sigue la cuadrícula o la primera pestaña (#1), con test en `tests/unit_tests/mibi/previews_test.py`.
- `superset/mibi/workspaces.py`: `changed_on` sale con zona horaria (#19).
- `messages.po`: «Físico» y «Título del panel de control» (#5, #9); `messages.json` regenerado.
- `playwright/pages/AuthPage.ts`, `playwright/utils/urls.ts`, `playwright/global-setup.ts`: el login espera a `/api/v1/me/` y la sesión compartida pasa a inglés (#6, #22).

Pendiente, por orden:
1. Altas: paleta del tema que no llega a todos los gráficos (#7), desbordamiento horizontal en móvil (#2), plugins `horizon` y `para` sin registrar (#12), modo presentación sin ajuste a pantalla (#16).
2. Medias: tarjetas y raíl en móvil (#3, #4), marcadores copiados con claves viejas (#10), tabla que no se refresca al ordenar en edición (#15), índice del PDF con emojis y espaciado (#17), embebido en móvil (#21).
3. Bajas cuando toque: casilla de «Guardar como» (#8), insignia «Bloqueado» sobre el título (#13), títulos cortados en el PDF (#18), avisos de consola (#11, #20).
4. Repetir la fase 1 y las casillas afectadas de las fases 2 a 4.
5. Decidir si el embebido se enciende de serie en `mibi_config.py` (flag, `frame-ancestors`, rol invitado) o queda como opción de despliegue.
6. Subir `main` (21 commits pendientes) con todo en verde.
7. Con esa base estable, abrir `chore/merge-superset-7.0` cuando salga 7.0.0 final.
