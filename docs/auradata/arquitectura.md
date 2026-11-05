# Arquitectura de AuraData BI para desarrolladores

AuraData BI es un fork de Apache Superset 7.0. Las reglas del producto (qué hace y qué no) están en el `AGENTS.md`
de la raíz, sección «AuraData BI: What This Fork Changes»: es la fuente de verdad, y este documento no las repite.
Aquí está cómo encajan las piezas que más se tocan: la biblioteca de layout en Python, el catálogo de formato, el
MCP, el historial de versiones y el asistente de IA, y cómo se prueba todo sin tumbar la máquina.

## 1. El informe vive en el layout

Un informe es un tablero de Superset. Todo lo que el fork añade (lienzo de tamaño fijo, cuadrícula de celdas,
posiciones absolutas, formato, elementos, segmentadores, marcadores, páginas tooltip, diseño móvil) se guarda en
su `position_json`, en claves `meta.auradata*`. El editor del frontend (`superset-frontend/src/auradata/format`,
`elements`, `report`) es quien las define; el backend las guarda sin entenderlas, salvo en un sitio: el MCP.

### La biblioteca de layout en Python

`superset/auradata/layout/` es el gemelo en Python del modelo del frontend, para que el MCP escriba layouts que el
editor abra sin cambiar nada:

| Módulo | Qué hace | Gemelo en el frontend |
| --- | --- | --- |
| `keys.py` | Nombres de las claves `meta.auradata*`, tipos de componente, `CELL` | `format/types.ts` |
| `cells.py`, `grid.py` | Conversión de layouts viejos a la cuadrícula de celdas; tamaño de página y columnas | `format/cells.ts`, `styles.ts` (`canvasSize`), `columns.ts` |
| `positions.py` | `meta.auradataPos`, primera celda libre (`free_cell`), encajar en la página | `format/positions.ts` |
| `pages.py` | Páginas (`TAB-*` o `GRID_ID`), títulos, objetos de cada página | `report/pageActions.ts` |
| `formats.py`, `format_patch.py` | Formato propio y compartido de los visuales; validación de parches contra el catálogo | `format/chartFormatSettings.ts` |
| `elements.py` | Elementos de diseño y segmentadores, con sus descriptores | `elements/elementSpec.ts` |
| `interactivity.py` | Marcadores, obtener detalles, páginas tooltip, alcance de filtros | `report/*` |
| `mobile.py` | Diseño móvil (`mobile_layout_of`, propuesta automática) | `format/mobileLayout.ts` |
| `arrange.py`, `sort.py`, `fields.py` | Alinear, distribuir, capas; orden y campos de un visual | `format/*` |
| `models.py` | Modelos pydantic de lo anterior | tipos de TypeScript |

Una herramienta del MCP **nunca escribe claves `meta.auradata*` a mano**: usa estas funciones.

### La guardia contra la deriva

Si el frontend cambia una regla y Python no, el MCP escribiría layouts que el editor «arregla» al abrirlos. Dos
tests lo impiden:

- **Fixtures compartidos** (`tests/fixtures/auradata/layouts/*.json`): entradas y resultados esperados de cada
  función. `superset-frontend/src/auradata/format/layoutDrift.test.ts` los corre en Jest y es la fuente de verdad;
  `tests/unit_tests/auradata/layout/drift_test.py` los corre en pytest. Tras un cambio deliberado del frontend:

  ```bash
  cd superset-frontend
  UPDATE_LAYOUT_FIXTURES=1 npx jest src/auradata/format/layoutDrift.test.ts
  ```

  y luego se ajusta Python hasta que `drift_test.py` pase.
- **Contrato de claves** (`tests/fixtures/auradata/layouts/meta_keys.json`): el test de Jest busca toda clave
  `auradata*` del código del frontend y falla si Python no la conoce (o si una ya no se usa). Una clave nueva va en
  `meta_keys.json` y en `superset/auradata/layout/keys.py`. Lo mismo con los tipos de elemento.

`drift_test.py` además comprueba que lo que escribe `generate_dashboard` es lo que guardaría el editor.

## 2. El catálogo de formato

El panel Formato dibuja, para cada tipo de gráfico, los controles de su panel de control repartidos en secciones
(`src/auradata/format/formatCards.ts`). Python no puede leer esos paneles, así que el frontend los exporta:

- `superset/auradata/catalog/format_catalog.json` lo **genera**
  `superset-frontend/src/auradata/format/formatCatalog.test.ts`. Nunca se edita a mano.
- El mismo test falla si el archivo guardado ya no coincide con los paneles. Para regenerarlo:

  ```bash
  cd superset-frontend
  UPDATE_FORMAT_CATALOG=1 npx jest src/auradata/format/formatCatalog.test.ts
  ```

- `superset/auradata/catalog/__init__.py` lo lee (`sections_of`, `own_chart_settings`…). Con él, `format_visual`
  valida un parche nivel por nivel (Visual, General, Analítica), `get_format_options` lista las claves y el recurso
  `auradata://format-catalog` lo resume para la IA. Los descriptores de los elementos de diseño salen de
  `elementSpec.ts` por el mismo camino.

Un control nuevo en un gráfico aparece solo en el catálogo al regenerarlo; si necesita sección, se le da en
`formatCards.ts`.

## 3. El MCP

`superset/mcp_service/` es el MCP de Superset 7.0 más las herramientas de AuraData BI. Su guía para agentes es
`superset/mcp_service/CLAUDE.md`; la referencia de cada herramienta, [mcp/referencia.md](mcp/referencia.md).

| Carpeta | Herramientas |
| --- | --- |
| `workspace/` | Workspaces, miembros, mover tableros y datasets |
| `report_layout/` | Estructura y páginas, objetos, visuales, formato, elementos y segmentadores, interactividad, diseño móvil |
| `screenshot/`, `sharing/`, `report/` | Capturas y exportación, publicar y compartir, informes y alertas programados |
| `history/` | Papelera e historial de versiones |
| `dataset/`, `database/` | Datasets en un workspace, modelo de datos (columnas calculadas, métricas), probar conexiones |
| `guidance/` | Recursos `auradata://…` y prompts guiados en español |
| Resto | Herramientas de Superset (tableros, gráficos, SQL Lab…), con las reglas del fork añadidas donde aplican |

### Cómo entra una IA

Con una clave personal `sst_…` creada en «Conectar IA» (`src/auradata/connectAi`, guía de usuario en
[mcp/conectar.md](mcp/conectar.md)). La clave actúa como su dueño: el MCP pone ese usuario en `g.user` y cada
herramienta pasa por los mismos comandos, filtros y validadores que la web. Los ámbitos de la clave
(`superset/security/api_key_scopes.py`) solo restringen.

### Cómo se añade una herramienta

1. **El archivo**, en `<área>/tool/`, con `@tool` de `superset_core.mcp.decorators`:
   - `tags`: el área (`layout`, `format`, `workspace`…) y `mutate` si cambia algo;
   - `class_permission_name` y `method_permission_name` (`read` o `write`): el permiso de ruta de FAB y, con él, el
     ámbito de la clave;
   - `annotations=ToolAnnotations(readOnlyHint=…, destructiveHint=…)`;
   - parámetros en un único modelo pydantic `request`, con `description` en cada campo.
2. **El registro**: exportarla en el `__init__.py` de su `tool/` e importarla al final de `app.py` (no en
   `server.py`). Si encaja en un paso del flujo, nombrarla en `DEFAULT_INSTRUCTIONS` (`app.py`), una herramienta por
   línea.
3. **Los permisos del objeto**, además del de ruta, que nunca basta:
   - editar un tablero o un gráfico pide `security_manager.can_edit_resource` (editores, y contributors y admins de
     su workspace); en el layout ya lo hace `open_report(…, edit=True)`;
   - leer datos pasa por `raise_for_access` y los filtros de acceso, con la concesión del workspace;
   - nunca reimplementes una regla: llama a la operación de `superset/auradata/` que ya usa la API REST.
4. **Las reglas del producto** en la escritura: un tablero por gráfico, datasets del workspace, certificación. Si la
   herramienta escribe un tablero, que sea con `save_report` (pasa por `UpdateDashboardCommand`).
5. **Los tests que la fijan** (todos en `tests/unit_tests/mcp_service/`):
   - su test de permisos con base real y todos los roles (`workspace/world.py`: viewer, contributor, admin del
     workspace, miembro de otro workspace, admin de Superset);
   - `test_api_key_scope_coverage.py`: su clase y su método tienen ámbito, y si cambia algo pide `write`;
   - `test_mcp_caching.py`: si no es de solo lectura, va en `excluded_tools` de `MCP_CACHE_CONFIG`
     (`mcp_config.py`), o la caché repetiría un resultado viejo;
   - `test_tool_inventory.py`: su presupuesto de tamaño (`TOOL_BUDGETS`, la regla está en el archivo) y
     `test_mcp_tool_registration.py`: que está registrada;
   - si los prompts la nombran, `guidance/test_guidance_prompts.py` comprueba que existe.
6. **La referencia**: regenera [mcp/referencia.md](mcp/referencia.md) (ver abajo); `test_reference_doc.py` falla
   hasta que lo hagas.

### La referencia generada

`superset/mcp_service/reference.py` arma la referencia desde el registro: grupo (por módulo), etiquetas, permiso y
ámbito, descripción, parámetros del modelo `request`, un ejemplo, prompts y recursos. No depende de la
configuración ni de la fecha. Con Superset instalado:

```bash
python scripts/auradata/mcp_reference.py
```

En el stack de desarrollo, que no monta `docs/` ni `scripts/` en el contenedor:

```bash
docker exec -i superset-superset-1 python - --output /tmp/referencia.md < scripts/auradata/mcp_reference.py
docker cp superset-superset-1:/tmp/referencia.md docs/auradata/mcp/referencia.md
```

En ese contenedor, sin `docs/`, `test_reference_doc.py` se salta la comparación; la hace donde está el repositorio
entero (CI, o un entorno con el repositorio montado).

## 4. El historial de versiones

Superset 7.0 guarda una versión de cada tablero, gráfico y dataset por transacción (SQLAlchemy-Continuum,
`superset/versioning/`): la fila `version_transaction` lleva el usuario (`user_id`) y el tipo de acción
(`action_kind`: restaurar, importar, clonar o nada para un guardado normal), y los registros de cambio son los que
pinta el panel de historial.

- **Toda escritura pasa por un comando** (`UpdateDashboardCommand`, `UpdateChartCommand`…), dentro de la petición
  del usuario. Así cada cambio de la web o del MCP queda en el historial a su nombre, y deshacer es restaurar una
  versión. Una herramienta que escribe la base por otro camino deja un cambio sin historial: no lo hagas.
- **Un cambio por transacción**: los cambios de vínculos de un mismo tablero (`dashboard_slices`) se separan con un
  commit, o el historial los mezcla.
- **Leer y restaurar** pasan por `versioning/api_helpers.py:find_history_entity` (la misma puerta de
  `/versions/`), y restaurar corre el `Restore*VersionCommand` de cada entidad, que respeta un tablero por gráfico y
  los datasets del workspace.
- Lo borrado queda con `deleted_at` (papelera). Las consultas sobre tablas de vínculos tienen que unir las filas
  vivas por su cuenta (`_live_links` en `single_dashboard.py`).

## 5. Probar sin tumbar la máquina

El portátil de desarrollo no aguanta corridas pesadas. La rutina de cada cambio es ligera; lo pesado se corre de
noche.

**Durante el día**, con el stack levantado (app y MCP; en compose, 8088 y 5008 por defecto):

- pytest **de un archivo cada vez**, en el contenedor (no hay venv en el host), y leyendo el resultado antes de
  seguir:

  ```bash
  docker exec superset-superset-1 python -m pytest -q -p no:cacheprovider tests/unit_tests/mcp_service/test_reference_doc.py
  ```

- ruff solo sobre lo tocado: `docker exec superset-superset-1 sh -c "cd /app && ruff check <archivos> && ruff format <archivos>"`.
- Jest de un archivo (`npx jest src/auradata/…/x.test.tsx`), y `npx oxlint` / `npx oxfmt --check` sobre lo tocado.
- `npm run build` como mucho una vez, y solo si cambió el frontend.
- Nunca encadenes `test; commit` con `;`: si el test falla, el commit sale igual.
- El navegador, en una sola pestaña y fuera de los tableros cuando no se usa: el servidor de desarrollo es de un
  solo hilo.

**De noche** (o antes de un pull request): `pre-commit run` sobre lo tocado, mypy, las carpetas de pytest enteras,
la suite de Jest y `tsc` (tras `npm run plugins:build`).

**De punta a punta**, tras un cambio del MCP: el escenario por MCP y la ida y vuelta en el editor de
[mcp/evaluacion.md](mcp/evaluacion.md).

## 6. El asistente de IA

Un panel dentro de la aplicación que habla con Claude desde el servidor y usa las herramientas del MCP en el mismo proceso,
como la persona que tiene la sesión. Las reglas están en `AGENTS.md`; para el usuario, en el
[capítulo 10 del manual](manual/10-asistente-de-ia.md); para operarlo, en
[asistente/administracion.md](asistente/administracion.md).

**Nada de esto se ha probado contra la API real ni en un navegador.** Las pruebas usan el SDK real sobre un transporte falso
(`tests/unit_tests/auradata/assistant/fake_anthropic.py`). La evaluación con modelos está en
[asistente/evaluacion.md](asistente/evaluacion.md), sin resultados todavía.

### Las piezas

| Módulo (`superset/auradata/assistant/`) | Qué hace |
| --- | --- |
| `api.py` | Rutas de chat, decisión, deshacer, modelos, privacidad, conversaciones y ajustes; decide quién pasa |
| `agent.py` | El bucle y la llamada al modelo |
| `tools.py` | `ToolBox`: las herramientas exactas de una persona en un modo |
| `prompt.py` | Instrucciones de sistema, fijas por persona y modo, y el bloque de contexto |
| `conversations.py` | Conversaciones que solo crecen; el estado pendiente se deduce de lo guardado |
| `undo.py` | Deshacer un turno con los comandos de restaurar |
| `figures.py` | El gráfico de una respuesta, sacado de la última `query_dataset` |
| `models.py`, `settings.py` | Catálogo de modelos y ajustes del admin |
| `governance.py`, `spending.py` | Interruptores, aviso de privacidad, topes y uso |

El panel vive en `superset-frontend/src/auradata/assistant/`: `client.ts` lee el SSE de un `fetch`, `useAssistantChat.ts` lleva
el estado y `AssistantPanel.tsx` pinta los dos modos.

### Un mensaje, paso a paso

`POST /api/v1/auradata/assistant/` hace esto, en orden:

1. **Comprueba** que es una sesión de navegador, que el asistente está encendido (configuración y ajustes), que hay clave y
   que la persona aceptó el aviso. Una clave `sst_…` o un invitado reciben 403.
2. **Valida** el modelo, abre el tablero con los permisos de la persona y, en modo edición, pide `can_edit_resource`.
3. **Mira** los interruptores del workspace y los topes. Estos se leen en cada petición.
4. **Construye** el `ToolBox` y las instrucciones, y guarda el mensaje con el contexto de la página en un bloque
   `<page_context>`.
5. **Llama al modelo** (`run_conversation`). Cada respuesta se guarda con su costo antes de la siguiente.
6. **Termina** con `done`, que trae tokens, costo, `can_undo` y el nivel del tope.

El bucle está escrito a mano y no usa el *tool runner* del SDK, por tres reglas:

- cada respuesta queda guardada con su costo antes de seguir;
- una respuesta rechazada (`refusal`) o cortada (`max_tokens`) nunca ejecuta sus herramientas;
- toda llamada pasa por `ToolBox`.

Un mensaje admite hasta `MAX_MODEL_CALLS` (25) llamadas al modelo. Nada acota lo que gasta cada una, así que un turno puede
pasarse del tope: los topes solo se miran antes de empezar.

**Keep-alive.** El SDK descarta los `ping`, y el razonamiento no se muestra, así que mientras el modelo piensa no llega nada.
`ModelCall` hace solo la llamada HTTP en un hilo propio, y el stream manda `: keep-alive` cada 15 s. La sesión, `g` y las
herramientas se quedan en el hilo de la petición. Las herramientas no mandan nada: por eso el proxy da 300 s a estas rutas.
Si la persona se va, `ModelCall` cierra la conexión y lo gastado queda en una fila `interrupted`, que nunca se envía.

### `run_as` y `ToolBox`

Las herramientas no pasan por HTTP ni por una clave `sst_`: corren en una sesión MCP en memoria (`fastmcp.Client`), en el
proceso web.

- **Identidad.** En ese proceso `MCP_DEV_USERNAME` se lee antes que `g.user`, así que cada llamada va dentro de
  `run_as(InProcessPrincipal(...))`, que tiene prioridad y falla cerrado. Tampoco corren los middlewares del MCP, por eso
  `ToolBox.call` limita el tamaño del resultado, oculta los errores internos y escribe `assistant_tool_call` en el registro.
- **La única puerta.** `ToolBox` arma una vez por petición el conjunto de herramientas de esa persona en ese modo. Un nombre
  fuera del conjunto no llega al MCP.
- **Modo lectura.** Solo herramientas de lectura (`_is_read_tool`), y además el alcance `superset:read`: si se colara una
  escritura, la rechazaría el envoltorio de la herramienta.
- **Modo edición.** Exige `can_edit_resource`, y `HIDDEN_TOOLS` deja fuera las exportaciones y las herramientas del servicio.
- **Carga diferida.** `FIXED_TOOLS` va siempre, en orden fijo. El resto va con `defer_loading`, detrás de la búsqueda de
  herramientas. Un modelo con `tool_search=False` recibe solo `FIXED_TOOLS`, que solo leen, aunque esté en modo edición.
- **Caché.** Instrucciones y herramientas son estables byte a byte. Lo que cambia viaja en el mensaje, y lo que devuelve una
  herramienta nunca entra en las instrucciones.

Una herramienta nueva del MCP entra sola. Si pide tarjeta, necesita título en español en `confirmations.ts`
(`copilot_test.py` lo comprueba).

### Las confirmaciones

Son una frontera de seguridad: nada que escriba el modelo ni que devuelva una herramienta puede aprobar una llamada.

1. `_needs_confirmation` marca lo que no solo lee y tiene `destructiveHint` distinto de `False`, la etiqueta `sharing` o está en
   `CONFIRM_TOOLS`.
2. Si una respuesta pide alguna, **no corre ninguna herramienta de ese turno**. Se guarda el turno sin resultados y con un
   registro `awaiting`. El panel recibe un evento `confirm` por tarjeta.
3. `POST .../conversations/<id>/decide/` recibe solo `tool_use_id` y `approved`. Lo que corre es la llamada guardada.
4. La decisión se escribe antes de ejecutar. `ConversationLog` se crea justo después de `find_conversation`, y el `seq` único
   deja pasar a una sola de dos peticiones simultáneas. Mantén ese orden.
5. Con todo decidido, `resume_after_decisions` corre las llamadas y el modelo sigue. `ToolBox.call` rechaza sin `approved=True`,
   que solo pasa `_run_tools` a partir de una decisión guardada.

Una tarjeta se puede contestar días después, así que `decide` vuelve a mirar permisos e interruptores. No mira los topes: un
turno en marcha termina. Escribir en vez de decidir responde «no se ejecutó» a cada llamada, y cada llamada recibe siempre su
`tool_result`, porque la API rechaza un historial sin él.

### Las conversaciones

Tablas `auradata_assistant_conversations` y `auradata_assistant_messages`, de la migración `c6a1f4e09b27`. Una conversación
es de una persona, un tablero y un modo: otra combinación responde 422, y la de otra persona, 404.

- **Solo crecen.** `content` se reenvía tal como llegó, salvo los bloques que la API pide omitir antes de un `fallback`. El
  razonamiento guardado deja de valer si se edita el historial.
- **Roles.** `user` y `assistant` van al modelo. `record` guarda lo que la app recuerda (`awaiting`, `decision`, `turn_start`,
  `turn_end`, `undone`) y nunca se envía. Las filas `refusal` e `interrupted` quedan por su costo y no se envían.
- **Sin tablas para lo pendiente.** `pending_turn` lo deduce de lo guardado: un turno deja de esperar cuando una fila trae sus
  resultados, así que una decisión vale una sola vez.
- **Sin compactar ni borrar.** Una conversación larga llega al límite del modelo, y el panel avisa al 80%. No hay ruta para
  borrarlas.
- **Costos.** Solo las filas `assistant` tienen costo. `spending.py` es el único sitio del mes, el redondeo y los topes.

Deshacer se apoya en `turn_start`, escrito justo antes del primer cambio, y `turn_end`. Lo guardado mientras el modelo pensaba
no entra en el turno. `undo.py` corre los comandos de restaurar como la persona, gráficos incluidos, porque una versión de
tablero no guarda su contenido. No toca los datasets, un gráfico creado queda fuera del informe y uno borrado sigue en la
papelera. Esa restauración no lleva la marca `__agent__`.

### El catálogo de modelos

`models.py` junta dos fuentes:

- **La lista viva** de la API de modelos: una hora de caché, cinco minutos si falla.
- **`MODEL_TABLE`**, por id exacto: lo que la API no dice. Sus valores salen de la referencia de la API de Claude; la fecha está
  en el encabezado del módulo. Si la API no responde, se ofrece la tabla.

Un modelo fuera de la tabla usa `PRUDENT_SPEC`: nada opcional en la petición, el precio más alto de la tabla y
`tool_search=False`, o sea que solo lee. No se ofrece hasta que un admin lo marque.

| Campo de `ModelSpec` | Quién lo lee |
| --- | --- |
| `thinking_on`, `efforts`, `default_effort`, `automatic_cache` | `request_params` |
| `refusal_fallback` | `refusal_fallback_params`, desde `request_params` |
| `tool_search` | `run_conversation`, `api.py` y `system_prompt` |
| `price`, `family`, `status`, `display_name` | Costos, orden y lo que muestran las pantallas |
| `thinking_off`, `thinking_always_on`, `thinking_off_max_effort`, `forced_tool_choice` | **Nadie todavía.** Solo los fijan los tests de `models_test.py` |

El bucle nunca apaga el razonamiento, siempre deja elegir la herramienta (`tool_choice: auto`) y usa el esfuerzo de la tabla:
ni el admin ni el panel tienen perilla para eso.

### Cómo se añade un modelo de Anthropic

Un modelo nuevo aparece solo en Administración si la API lo lista, con valores prudentes. Para usarlo bien hay que darle fila.

1. **Saca los datos** de la referencia de la API de Claude, no de memoria: precios (entrada, salida, lectura de caché, y el
   tramo de prompt largo si lo tiene), cómo se pide el razonamiento, esfuerzos válidos, respaldo ante un rechazo y si tiene
   búsqueda de herramientas.
2. **Agrega la fila** a `MODEL_TABLE`, con el id exacto y sin sufijo de fecha (`spec_of` lo quita). Si la caché vale una décima de
   la entrada, `_cached_at_a_tenth` ahorra escribirla. Llena también los campos que nadie lee todavía: costarán menos el día
   que se usen.
3. **Elige `status`:** `STATUS_CURRENT` si es de los que se ofrecen por defecto, y pasa el anterior de su familia a
   `STATUS_AVAILABLE`. `STATUS_RESTRICTED` es para modelos de programas especiales, que solo salen si la API los lista.
4. **Una familia nueva** va en `FAMILIES`, que da el orden y la lectura del id.
5. **El precio decide la etiqueta** (`relative_price`): revisa `BALANCED_FROM` y `TOP_FROM`. Si es el más caro, `PRUDENT_SPEC` sube
   solo.
6. **Si cambia el modelo por defecto,** cambia `AURADATA_ASSISTANT_DEFAULT_MODEL` en `auradata_config.py` y en los
   `superset_config` de dev y prod. Un admin que ya guardó sus ajustes conserva su elección.
7. **Agrega tests** a `tests/unit_tests/auradata/assistant/models_test.py`: el costo, y cómo se pide si tiene algo nuevo.
   `test_every_model_of_the_table_finds_tools_with_tool_search` exige `tool_search=True`, porque sin él solo lee.
8. **Si trae una forma de API nueva,** como otro tipo de razonamiento o de respaldo, agrégala como campo de `ModelSpec` y léela
   en `request_params`. El resto del código no pregunta qué modelo es.
9. **Avisa a los admins:** quien ya guardó la pantalla tiene una lista fija, y tiene que marcar el modelo nuevo.
10. **Mídelo** con la [evaluación](asistente/evaluacion.md) antes de recomendarlo. Gasta dinero: se aprueba antes.

Para retirar un modelo, quita su fila o bájalo a `STATUS_AVAILABLE`. Mientras la API lo liste seguirá en la pantalla; sin fila,
con valores prudentes y sin búsqueda de herramientas, así que no puede seguir una conversación que la usó.

### Pendiente

- **Probar de verdad:** la corrida de la [evaluación](asistente/evaluacion.md), el panel en un navegador y las capturas desde
  el proceso web.
- **Visores:** un visor de un workspace sin `datasource_access` no recibe cifras, y su tablero tampoco se dibuja. Es la regla de
  `workspace_grants.py`, y lo fija `tests/unit_tests/auradata/assistant/viewer_test.py`. Las opciones están en la
  [evaluación](asistente/evaluacion.md#un-visor-sin-permisos-de-datos-no-recibe-cifras).
- **Deshacer** no toca los datasets.
- **Topes:** un turno en marcha puede pasarse hasta terminar.
- **Procesos:** uno que muere con una herramienta en marcha deja su conversación en 409. Se sigue en una nueva.
- **Segunda versión del copiloto,** anotada en el plan: cambios como acciones del editor, con el deshacer normal y sin guardar
  antes.
