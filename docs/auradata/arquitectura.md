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

Un panel dentro de la aplicación que habla con Claude desde un worker y usa las herramientas del MCP en ese mismo proceso,
como la persona que tiene la sesión. Las reglas están en `AGENTS.md`; para el usuario, en el
[capítulo 10 del manual](manual/10-asistente-de-ia.md); para operarlo, en
[asistente/administracion.md](asistente/administracion.md).

Hay tres niveles de prueba, y cada uno ve algo que el anterior no:

| Nivel | Qué es real | Dónde |
| --- | --- | --- |
| Unitarias | El SDK, sobre un transporte falso | `tests/unit_tests/auradata/assistant/`, con `fake_anthropic.py` |
| Playwright | Navegador, web, Redis, worker, herramientas y base. Solo Anthropic es simulado | `superset-frontend/playwright/tests/experimental/assistant/` |
| Evaluación | Todo, con Claude real y gasto real | [asistente/evaluacion.md](asistente/evaluacion.md) |

### Las piezas

| Módulo (`superset/auradata/assistant/`) | Qué hace |
| --- | --- |
| `api.py` | Rutas de chat, decisión, deshacer, modelos, privacidad, conversaciones y ajustes; decide quién pasa |
| `agent.py` | El bucle y la llamada al modelo |
| `turns.py` | Un turno de la petición al worker y de vuelta: identidad, cierre, turnos muertos y relevo de eventos |
| `turn_store.py` | Lo que un turno guarda en Redis: stream numerado, candado, boleto y marcas |
| `tools.py` | `ToolBox`: las herramientas exactas de una persona en un modo |
| `prompt.py` | Instrucciones de sistema, fijas por persona y modo, y el bloque de contexto. Cada conversación guarda las de su primer turno |
| `conversations.py` | Conversaciones que solo crecen; el estado pendiente se deduce de lo guardado |
| `attachments.py` | Imágenes adjuntas: limpiarlas al subirlas y ponerlas en cada petición |
| `undo.py` | Deshacer un turno con los comandos de restaurar |
| `artifacts.py`, `artifact_blocks.py`, `artifact_tools.py` | Documentos: versiones, forma de los bloques y herramientas propias |
| `sharing.py` | Compartir un documento en su workspace: quién lee qué, y qué dice la tarjeta |
| `exports.py` | Un documento como PDF, en el worker |
| `artifact_pages.py` | Un documento como páginas del informe, por las herramientas normales |
| `figures.py` | El gráfico de una respuesta, sacado de la última `query_dataset` |
| `models.py`, `settings.py` | Catálogo de modelos y ajustes del admin |
| `governance.py`, `spending.py` | Interruptores, aviso de privacidad, topes y uso |

El panel vive en `superset-frontend/src/auradata/assistant/`: `client.ts` lee el SSE de un `fetch` y se reconecta,
`useAssistantChat.ts` lleva el estado, `remembered.ts` recuerda en la pestaña qué estaba abierto y `AssistantPanel.tsx` pinta los
dos modos.

### Un mensaje, paso a paso

`POST /api/v1/auradata/assistant/` hace esto, en orden:

1. **Comprueba** que es una sesión de navegador, que el asistente está encendido (configuración y ajustes), que hay clave y
   que la persona aceptó el aviso. Una clave `sst_…` o un invitado reciben 403.
2. **Valida** el modelo, abre el tablero con los permisos de la persona y, en modo edición, pide `can_edit_resource`.
3. **Mira** los interruptores del workspace y los topes. Estos se leen en cada petición.
4. **Toma el turno** de la conversación (el candado de Redis), y guarda el mensaje con sus imágenes y el contexto de la página
   en un bloque `<page_context>`.
5. **Encola la tarea** `auradata_assistant.run_turn`, que solo lleva el id del turno, y empieza a leer su stream.
6. **En el worker,** `run_turn` construye el `ToolBox` y las instrucciones y llama al modelo (`run_conversation`). Cada respuesta
   se guarda con su costo antes de la siguiente.
7. **Termina** con `done`, que trae tokens, costo, `can_undo` y el nivel del tope, y con `turn_end`, que suelta el candado.

El bucle está escrito a mano y no usa el *tool runner* del SDK, por tres reglas:

- cada respuesta queda guardada con su costo antes de seguir;
- una respuesta rechazada (`refusal`) o cortada (`max_tokens`) nunca ejecuta sus herramientas;
- toda llamada pasa por `ToolBox`.

Un mensaje admite hasta `MAX_MODEL_CALLS` (25) llamadas al modelo. Nada acota lo que gasta cada una, así que un turno puede
pasarse del tope: los topes solo se miran antes de empezar.

**Notas del modelo.** El texto de los bloques de razonamiento llega como eventos `note` (`text` y `starts`, que abre una nota
nueva). Con `display: "updates"` son las notas que el modelo escribe para quien mira entre una herramienta y otra.
`"summarized"` no se usa: sus resúmenes llegan en inglés y con detalles internos. Pueden ser cero en toda una respuesta, y un comentario
corto del modelo sigue llegando como texto. El panel las pinta entre los pasos, como texto plano: vienen del modelo. No se
guardan aparte: los bloques siguen guardándose y reenviándose tal como llegaron, y una conversación leída después muestra lo
que ellos tengan, o nada. La frase fija que la API pone cuando corta una respuesta se esconde en `stepsOf`.

**Keep-alive.** El SDK descarta los `ping`, y el razonamiento puede pasar mucho tiempo sin texto. El turno y quien lo lee ya
no comparten proceso, así que es la conexión la que manda `: keep-alive` cuando pasan 15 s sin nada (`relay`), también con una
herramienta en marcha. `ModelCall` hace solo la llamada HTTP en un hilo propio y entrega un `TICK` por segundo, que no se escribe
y es donde el turno oye que debe parar. La sesión, `g` y las herramientas se quedan en el hilo del turno.

### Un turno en el worker

Cada conversación tiene un stream de Redis con eventos numerados y, como mucho, un turno que lo posee. Solo quien tiene el
candado escribe, en un paso atómico (script de Lua), y `turn_end` suelta el candado en ese mismo paso.

**Identidad.** El boleto lo escribe la petición, con `get_user_id()` de la sesión. La tarea no recibe un usuario: recibe el id del
boleto. `_owner_of` exige que el dueño de la conversación, su modo y su tablero coincidan, y que el usuario siga activo, o no
corre nada. Después todo va bajo `override_user`, y cada herramienta bajo `run_as` con ese id, que comprueba también que el
nombre siga siendo de esa persona. Antes de empezar se lee otra vez si puede abrir el tablero y, en edición, editarlo. El idioma
también viaja en el boleto, porque un worker no tiene sesión de donde leerlo.

**Una petición vacía.** El turno corre dentro de `test_request_context(method="POST")`, como la petición que lo llevaba: OAuth2
por persona, `SavedQueryFilter` y otras partes preguntan si hay petición. No trae cookies ni aporta identidad: Flask-Login recibe
al mismo usuario en `g._login_user`, y su sesión nunca se lee ni se escribe.

**Una sola vez.** Repetir un turno repite cambios y gasto. La tarea no tiene reintentos, va con `acks_late` apagado y lo primero
que hace es tomar el `claim` del turno con `SET NX`: una segunda entrega no lo consigue. Un lector que se cansa de esperar a un
worker toma el mismo `claim`, así que un worker tardío lo encuentra ocupado.

**Detener y tiempo.** `POST .../stop/` deja una marca que un hilo del turno lee cada segundo. Detener y agotar el tiempo cierran
el generador del turno, el camino que guarda lo gastado en una fila `interrupted` y responde las llamadas sin ejecutar. No se usa
`soft_time_limit`: su excepción es un `Exception` y los manejadores de las herramientas se la tragarían. Una herramienta en
marcha termina siempre.

**Un turno muerto.** El hilo refresca un latido con 30 s de vida. `settle_turn` corre donde el dueño vuelva: al leer el stream,
la conversación, al escribir, deshacer o borrar. Un turno sin latido, o sin worker tras 30 s, se cierra una sola vez (`take_settling`):
responde sus llamadas, anota el fin de un cambio abierto, añade un registro `turn_lost`, avisa y suelta el candado. Un worker
que siguiera vivo ya no puede escribir, y oye la marca de detenerse en su siguiente paso.

**Leer otra vez.** Una conexión dura 45 s como mucho y lee desde `after`. Cada conexión nueva vuelve a comprobar la sesión, el
dueño y que el tablero se pueda abrir: el stream se encuentra a través de la conversación, y otra persona recibe un 404. Mientras
corre un turno, `GET .../conversations/<id>/` entrega las filas anteriores a él y `running.after`, y el panel lee el turno entero
desde ese número: las filas que el turno ya guardó llegarían dos veces. El stream guarda al menos `MAX_EVENTS`; a un lector
que pide lo ya recortado se le avisa con `trimmed` y sigue desde lo más viejo, y el panel termina leyendo las filas guardadas.

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
- **Sin compactar.** Una conversación larga llega al límite del modelo, y el panel avisa al 80%. Renombrar cambia solo `title`.
- **Se borra entera, y solo por un sitio.** `erase_conversations` elimina todo menos lo que la contabilidad necesita: las filas
  `assistant`, con `content` en `[]` y `conversation_id` vacío, y sus votos, sin `reason`. `spending.py` no distingue esas filas de
  las demás, así que no hay una segunda fuente de gasto que sumar. Las claves hacia la conversación siguen en `CASCADE`: borrarla
  por otra vía se lleva el contenido y también el gasto. Si fallara algo, que falle del lado de la privacidad.
- **Retención.** `retention.py` borra lo vencido por fecha del último mensaje (`last_activity`), nunca por `changed_on`, que un
  renombrado mueve y un mensaje no. Las claves a `dashboards` y `ab_user` son `SET NULL`: esas conversaciones ya no se abren, y
  también se van. Cada lote se juzga otra vez con las filas bloqueadas (`FOR UPDATE SKIP LOCKED`), y se salta una tarjeta
  pendiente o un turno en marcha (`turn_is_running`). El `DELETE` de la API responde 409 durante un turno: su escritura final ya
  no tendría dónde guardar el costo.
- **Costos.** Solo las filas `assistant` tienen costo. `spending.py` es el único sitio del mes, el redondeo y los topes.

### Las imágenes adjuntas

Un archivo subido es hostil hasta que se demuestre lo contrario, y lo que se guarda se reenvía para siempre en un historial que
solo crece: **una imagen que la API rechazara rompería su conversación.** Por eso todo se resuelve al subirla.

`POST .../attachments/` recibe una imagen por petición, para responder al momento y no pasar del `client_max_body_size` del
proxy, que un mensaje con cinco capturas en JSON sí pasaría. `clean_image` es la única entrada:

1. **El tipo sale de los bytes.** `Image.open` va con `formats` limitado a PNG, JPEG y WEBP. El nombre y la cabecera no se leen,
   y sin ese límite Pillow probaría todos sus decodificadores.
2. **El tamaño se mira antes de decodificar.** La cabecera basta, y es lo que para una bomba de descompresión. El límite propio
   es de 40 MP, por debajo del de Pillow.
3. **Solo quedan los píxeles.** La imagen se endereza con su EXIF y se reconstruye con `Image.frombytes`: guardar lee `info`, así
   que una copia conservaría el perfil ICC o el EXIF.
4. **Se ajusta a la API.** Hasta 2576 px de lado y 4784 tokens visuales, lo que leen los modelos grandes y por debajo de los 3000 px
   que la API exige en una petición con más de 20 imágenes, que cuenta también las de las herramientas. Y hasta 5 MB en base64.
5. **Conserva su formato.** Una captura en PNG mantiene el texto nítido, y una foto en JPEG (calidad 90) su peso.

El mensaje guarda `{"type": "auradata_attachment", "id": …}`, no los bytes: el historial se lee varias veces por turno. `with_images`
arma el bloque `image`, antes del texto, donde el modelo lo lee mejor. La llaman `history_of` y el chat para el turno nuevo, y debe
dar lo mismo byte a byte: es lo que mantiene el prefijo de la caché. Ese tipo propio hace además que un camino que olvide
expandirlo reciba un 400 de la API en vez de perder la imagen en silencio. Medido con Claude real en una conversación de 81 000
tokens: un turno que agrega otra imagen lee 81 078 de la caché y escribe 865, y el siguiente, que responde sobre esa imagen, lee
81 943 y escribe 138.

Una subida es un borrador de `user_id`, sin `conversation_id`. La reclama `add_user_message`, en el mismo commit del mensaje, y de
dos mensajes con el mismo borrador solo gana uno (409). La lectura pide ser el dueño y poder abrir el informe, y responde 404
también a un admin: `Uso` no ve imágenes. `erase_conversations` las borra por su nombre, y `purge_drafts` borra los borradores
de más de un día.

Modelo y datos no llegan a imágenes: `AssistantMarkdown` sigue sin cargarlas, y el único camino a esa ruta son ids que el
servidor escribió en un mensaje de la persona. Lo escrito dentro de una imagen es dato (`RULES`), aunque llegue en un turno de
usuario.

### Los documentos

Un documento es de una persona, un informe y una conversación. Cada cambio agrega una fila a
`auradata_assistant_artifact_versions`, la última es el documento y volver a una versión copia aquella como una nueva. La
fila de `auradata_assistant_artifacts` solo dice de quién es y dónde vive.

| Bloque | Campos | Regla |
| --- | --- | --- |
| `text` | `text`, en Markdown; el servidor agrega `written_on` | Sin HTML, imágenes ni enlaces a otros sitios |
| `figure` | `label`, `format` (`number`, `compact`, `percent`, `currency`), `query` | Una métrica, sin columnas |
| `chart` | `title`, `chart` (`bar`, `line`, `area`, `pie`), `query` | Eje y serie opcional; un pastel, una columna y una métrica |
| `table` | `title`, `query` | Columnas, métricas o ambas, hasta 100 filas |

Todo bloque tiene un `id` del servidor, estable entre versiones. `query` tiene la forma de `query_dataset`: `dataset_id`,
`columns`, `metrics`, `aggregates`, `filters`, `time_range`, `time_column`, `order_by`, `order_desc` y `row_limit`.
`artifact_blocks.py` prohíbe campos desconocidos en todos los niveles, así que un bloque no tiene dónde guardar una cifra. Sus
modelos de pydantic también generan el esquema que ve el modelo.

Al guardar, `query_problem` revisa cada consulta como la persona: que llegue al dataset, que un gráfico de ese informe pueda
usarlo y que existan sus columnas y métricas. Al abrir, `useBlockData` corre la consulta por la API de datos de gráficos con los
permisos de quien mira. Un 401, 403 o 404 se dice en el bloque, y `sources` solo nombra los datasets a los que el lector llega.
El número vive en ese componente: no vuelve al servidor ni entra al contexto del modelo.

`create_artifact`, `change_artifact` y `read_artifact` no son herramientas del MCP, porque una IA de fuera no tiene conversación.
`ToolBox` las ofrece en los dos modos y `_call_own` las corre con la persona del turno. Decidimos que no pidan tarjeta ni registren
deshacer: solo tocan el documento de esa persona, que tiene su propio historial. Lo que entra al registro de acciones son ids,
porque ese registro sobrevive a la conversación.

El navegador solo nombra el documento abierto y el bloque elegido (`artifact: {id, block_id}`). `selected_context` lee lo guardado,
comprueba que sea de esa persona y esa conversación, y lo pone en `<page_context>`. Si `change_artifact` llega con una versión
vieja, por ejemplo tras volver atrás, se rechaza y el modelo lee otra vez.

**Límite aceptado:** el texto queda como se escribió. Cada bloque guarda `written_on`, una versión restaurada conserva esas fechas y
el panel muestra la más antigua, con un botón que manda un mensaje normal para actualizarlo.

**Retención:** un documento se borra con su conversación, en `erase_conversations`, porque repite lo que dijeron sus respuestas.
Volver a una versión deja una fila `record`, que cuenta como actividad para la retención. Un documento compartido también se va
con ella: quien lo leía encuentra un 404.

#### Compartir

Compartir no copia nada: tres columnas de `auradata_assistant_artifacts` dicen en qué workspace y qué versión. Es la versión que
mostró la tarjeta, y el servidor rechaza otra (409), así que lo que el asistente escriba después no llega a nadie hasta compartir
de nuevo.

`sharing.reads_share` decide en cada lectura, sin caché:

| Condición | Si falla |
| --- | --- |
| El informe sigue en ese workspace | Se cierra. `move_dashboards` además borra las columnas: volver no lo reabre |
| El autor sigue activo y es miembro | Se cierra. `remove_member` borra las columnas |
| El lector tiene fila en `auradata_workspace_members` | 404. Un admin de Superset no es la excepción |
| El lector abre el informe (`open_dashboard`) | 404. Por eso un documento de un borrador se queda con quien ve el borrador |

Una conversación vencida que se queda por una tarjeta pendiente deja de estar compartida (`retention.py`). Dejar de compartir solo
pide ser el dueño, no abrir el informe: quita acceso, y un autor que perdió el informe lo hace desde la lista del workspace. Un lector
cuyo rol no ve el modelo de datos (`user_can_view_data_model_metadata`) recibe los bloques ocultos, porque una consulta nombra columnas
y filtros. Gamma sí lo ve.

`GET /documents/<id>/` no lleva `protect()`: revisa la sesión y el permiso por su cuenta para responder 404 también a un visitante
anónimo, que de otro modo recibiría un 401 y sabría que la ruta distingue.

Lo que recibe un lector lo arma `reader_json`: una versión, sin conversación ni historial. Un bloque de un dataset al que no llega
sale como `{id, type: "refused"}`, porque su título, su etiqueta y sus filtros dicen lo que dirían las cifras. Si llega, el bloque
trae su consulta y el navegador la corre por la API de datos de gráficos, con sus permisos y RLS.

**Lo que esto no resuelve:** el texto lo escribió el autor con su acceso, y RLS no alcanza a un texto. Por eso `share_card` lista
los pasajes con números y los valores de los filtros, y la vista del lector dice de quién es ese acceso. Es decisión del autor.

El lector no escribe nada y su asistente no lee documentos compartidos: `read_artifact` sigue siendo del dueño, así que un texto
compartido con órdenes dentro no entra a ninguna conversación ajena. Para su dueño, lo que devuelve es dato, como cualquier
herramienta.

#### Exportar a PDF

El navegador vive en los workers y tarda segundos, así que `POST .../export/` solo deja un ticket en Redis y encola una tarea con
su id, que no tiene argumento para un usuario, como un turno. El panel pregunta por `GET .../export/<job>/` hasta recibir el
archivo, que espera 15 minutos en Redis solo para quien lo pidió. Servirlo vuelve a leer el documento como esa persona, y borrar
la conversación borra sus archivos (`forget`).

El worker abre `/assistant/document/<id>/` como esa persona con `capture_raw`, la misma captura de las exportaciones de informes.
En modo `standalone` la página espera a todos sus bloques y a la animación de ECharts, reparte sus piezas en hojas A4 para que
ninguna quede partida (`sheets.ts`) y solo entonces agrega `auradata-document-ready`, que es lo que espera el driver.
`exports.sheets_of` corta la imagen en páginas.

Corre en un hilo propio porque el Playwright síncrono deja un loop corriendo en el suyo mientras viva su navegador. Un `asyncio.run`
posterior en ese hilo falla, y es lo que pasaba con un turno en un worker que acababa de hacer miniaturas. Por eso las llamadas de
`ToolBox` pasan por `run_coroutine`.

#### Guardar como página

`save_artifact_as_page` es la única herramienta propia con tarjeta: solo en modo edición, y con `changes_something` para que el
turno registre `turn_start` y `turn_end`, así que deshacer funciona igual que siempre. No escribe nada por sí misma:
`artifact_pages.py` pide `add_page`, `add_element` y `create_visual` a `ToolBox`, con `approved=True` porque la persona aprobó el
conjunto en la tarjeta. Una gráfica por tablero, las celdas del lienzo, los permisos y el historial valen porque esas herramientas
los cumplen.

La tarjeta describe una versión, y solo esa se guarda. Si la llamada no nombra la última versión al llegar la tarjeta, no hay tarjeta
y la llamada se rechaza. La versión descrita queda en el registro `awaiting`, y `_save` la compara con la última al correr: un
`change_artifact` del mismo turno deja la tarjeta sin efecto.

`page_plan` reparte los bloques en páginas del tamaño del lienzo: lo que no cabe pasa a otra, hasta 5. Un bloque de datos se
convierte en un gráfico solo si dice exactamente lo mismo. Si un filtro no tiene equivalente, el bloque queda fuera y el resultado
lo nombra, en vez de guardar un gráfico sin ese filtro. Los rangos de tiempo llegan por `time_filters`, un campo de
`create_visual`.

Un documento se escribe a menudo leyendo, y leer nunca cambia un informe. Por eso la herramienta acepta cualquier documento de esa
persona en ese informe, y `read_artifact` sin id lista también los de sus otras conversaciones: se guarda desde el editor.

### Deshacer

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
| `thinking_display` | `request_params`, que agrega la cabecera beta de `updates`. `tuned_spec` lo vacía si el admin apaga el razonamiento |
| `thinking_off`, `thinking_always_on`, `thinking_off_max_effort` | `tuned_spec`, antes del bucle |
| `refusal_fallback` | `refusal_fallback_params`, desde `request_params` |
| `tool_search` | `run_conversation`, `api.py` y `system_prompt` |
| `price`, `family`, `status`, `display_name` | Costos, orden y lo que muestran las pantallas |

El bucle siempre deja elegir la herramienta (`tool_choice: auto`), así que la tabla no guarda si un modelo acepta forzarla.
El esfuerzo y el razonamiento que elige el admin pasan por `tuned_spec`, que devuelve la fila del modelo con lo que ese modelo
acepta, y `request_params` la lee sin saber cuál es.

### Cómo se añade un modelo de Anthropic

Un modelo nuevo aparece solo en Administración si la API lo lista, con valores prudentes. Para usarlo bien hay que darle fila.

1. **Saca los datos** de la referencia de la API de Claude, no de memoria: precios (entrada, salida, lectura de caché, y el
   tramo de prompt largo si lo tiene), cómo se pide el razonamiento, qué `thinking.display` acepta, esfuerzos válidos, respaldo
   ante un rechazo y si tiene búsqueda de herramientas.
2. **Agrega la fila** a `MODEL_TABLE`, con el id exacto y sin sufijo de fecha (`spec_of` lo quita). Si la caché vale una décima de
   la entrada, `_cached_at_a_tenth` ahorra escribirla. Llena también los campos que nadie lee todavía: costarán menos el día
   que se usen. `thinking_display` es `DISPLAY_UPDATES` si el modelo tiene notas de progreso y `None` si no: un
   valor que el modelo no conoce es un 400 en todas sus peticiones, así que pruébalo con una petición real.
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

- **Sin probar:** la imagen `prod`, un proxy real y un teléfono real. Detalle en
  [lo que nunca se probó](asistente/administracion.md#lo-que-nunca-se-probó).
- **Deshacer** no toca los datasets.
- **Topes:** un turno en marcha puede pasarse hasta terminar.
- **Segunda versión del copiloto:** cambios como acciones del editor, con el deshacer normal y sin guardar antes.
