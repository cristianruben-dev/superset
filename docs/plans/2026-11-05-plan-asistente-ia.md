# Plan: asistente de IA dentro de AuraData BI

Fecha: 2026-11-05 · Rama base: `main` (`5264e9e4e5`)

**Objetivo.** Un asistente dentro del producto, como Copilot en Power BI:
- **«Pregúntale a tus datos»** en modo lectura;
- **un copiloto en el editor** que arma y cambia informes cuando se lo piden.

Usa las mismas herramientas del MCP que ya construimos (`docs/plans/2026-11-04-plan-mcp-auradata.md`) y actúa siempre como
el usuario que tiene la sesión abierta.

Tamaños: **S** (un día o menos), **M** (unos días), **L** (una semana o más).

## Decisiones tomadas (2026-11-05)

1. **El asistente ve todo lo que ve el usuario,** datos de filas incluidos. Los datos viajan a la API de Anthropic.
   Hay que avisarlo en la pantalla y en la documentación.
2. **Modelo por defecto: Claude Sonnet 5.5** (`claude-sonnet-5-5`).
3. **Selector de modelo con todos los de Anthropic,** al día gracias a la API de modelos: Haiku, Sonnet, Opus y
   Fable, en sus versiones vigentes.
   - El admin elige cuáles se ofrecen y cuál va por defecto.
   - El usuario cambia de modelo en el panel.

## Principios

1. **El servidor habla con Claude, nunca el navegador.** La clave de Anthropic (`ANTHROPIC_API_KEY`) vive en la
   configuración del servidor. El panel recibe la respuesta en streaming desde AuraData.
2. **Las herramientas son las del MCP, llamadas en el mismo proceso.** No pasan por HTTP ni por claves `sst_`, ni por el
   «conector MCP» de Anthropic, que exige publicar el MCP en internet. Se ejecutan con la sesión del usuario, así que
   respetan solas los workspaces, los permisos, un tablero por gráfico y el historial.
3. **Un solo camino para todos los modelos.** Una tabla de capacidades por modelo absorbe sus diferencias de API, de
   modo que el resto del código no pregunta qué modelo es. Las diferencias conocidas:
   - cómo se pide o se apaga el razonamiento (Fable siempre razona; Sonnet 5.5 usa `between_tools`);
   - los niveles de esfuerzo;
   - que algunos modelos no aceptan forzar una herramienta;
   - el formato de los respaldos ante un rechazo.
4. **La conversación solo crece.** Nunca se reescriben turnos anteriores: el razonamiento guardado de los modelos
   actuales deja de valer si se edita el historial.
5. **Los datos son datos, no órdenes.** Lo que devuelve una herramienta (el texto de un dataset, el título de un tablero)
   nunca cuenta como instrucción. Las acciones destructivas siempre piden confirmación en pantalla.
6. **Cada cambio se puede deshacer.** Todo pasa por los comandos que ya registran el historial, marcado como hecho por
   el asistente.
7. **Pruebas livianas,** como en el plan del MCP: un archivo de test a la vez, y lo pesado de noche.

## Requisitos antes de empezar

- La verificación pesada del plan del MCP (`pre-commit`, mypy, `tsc` completo, Jest) en verde, y `main` subido.
- Los encargos E1 a E8 de `docs/auradata/mcp/evaluacion.md`, probados con Claude conectado por el MCP. Lo que falle ahí
  le fallaría también al asistente.
- **Dependencia nueva:** el SDK oficial `anthropic` de Python. Hace falta para hablar con la API y no hay alternativa
  oficial. Va en `requirements/` y en las imágenes `dev` y `prod`.

> **Nota (2026-11-05):** el usuario eligió empezar antes de la verificación pesada y antes de E1 a E8, que siguen
> pendientes.

## Orden

| Fase | Qué | Tamaño |
| ---: | --- | :---: |
| 0 | Base: SDK, configuración, catálogo de modelos y ajustes del admin | M |
| 1 | Servicio del asistente en el servidor (bucle, herramientas, streaming, conversaciones) | L |
| 2 | «Pregúntale a tus datos» en modo lectura, con el selector de modelo | L |
| 3 | Copiloto del editor | L |
| 4 | Gobierno: marca de la IA, confirmaciones, topes de gasto, uso | M |
| 5 | Evaluación y comparación de modelos | M |
| 6 | Documentación | S–M |

---

## 0. Base (M)

1. SDK `anthropic` en `requirements/` y en el `Dockerfile` (`dev` y `prod`).
2. Configuración en `auradata_config.py` y en los `superset_config` de dev y prod:
   - `ANTHROPIC_API_KEY` desde el entorno, nunca en el repo;
   - `AURADATA_ASSISTANT_ENABLED`;
   - `AURADATA_ASSISTANT_DEFAULT_MODEL = "claude-sonnet-5-5"`;
   - `AURADATA_ASSISTANT_ALLOWED_MODELS` (por defecto, todos los vigentes);
   - `AURADATA_ASSISTANT_MONTHLY_BUDGET_USD`.
3. **Catálogo de modelos** (`superset/auradata/assistant/models.py`):
   - la lista viva sale de la API de modelos (`client.models.list()`), con caché;
   - una tabla propia por familia guarda lo que la API no dice: precio, cómo se pide el razonamiento, esfuerzos
     válidos, si acepta forzar una herramienta y cómo se piden los respaldos ante un rechazo;
   - un modelo que la tabla no conoce se ofrece con valores prudentes y una nota.
4. **Ajustes del admin** en Administración, en una sección «Asistente de IA»:
   - encender o apagar el asistente;
   - modelos permitidos y modelo por defecto;
   - tope mensual de gasto;
   - el aviso de privacidad («los datos que consultes se envían a Anthropic»).

**Listo cuando:** un admin ve la lista real de modelos de Anthropic, elige los permitidos y deja Sonnet 5.5 por defecto.

## 1. Servicio del asistente (L)

1. **Endpoint** `POST /api/v1/auradata/assistant/` con streaming (SSE). Recibe el mensaje, el id de la conversación, el
   modelo elegido y el contexto: tablero, página, selección y modo lectura o edición.
2. **El bucle.** Usa el *tool runner* del SDK con las herramientas del MCP envueltas como funciones de Python, que
   corren con `g.user` igual a quien pregunta. Elige la herramienta Claude (`tool_choice: auto`), nunca forzada, porque
   varios modelos actuales lo rechazan.
3. **Búsqueda de herramientas.**
   - Un grupo fijo de herramientas cargadas siempre: estructura del informe, datasets, consultas y capturas.
   - El resto, diferidas con `defer_loading`, detrás del buscador de herramientas.
   - El conjunto de herramientas depende del modo: el modo lectura solo recibe herramientas de lectura.
4. **Caché del prompt.** Las instrucciones y la lista de herramientas, fijas y en orden estable, se cachean. Se verifica
   con `cache_read_input_tokens`. Cambiar de modelo a mitad de una conversación pierde la caché: el panel lo avisa.
5. **Conversaciones guardadas.**
   - Tablas nuevas `auradata_assistant_conversations` y `auradata_assistant_messages`, con UUID como clave. Migración
     sobre la cabeza del fork (`a7e3c91d4b60`, o la que sea al empezar).
   - Se guarda el contenido completo de cada respuesta, para poder repetirla sin editarla.
   - Una conversación pertenece a su usuario y a un tablero.
6. **Contabilidad:** tokens de entrada, salida y caché por mensaje, y su costo según la tabla de precios, por usuario y
   por workspace.
7. **Errores y rechazos.**
   - Los rechazos (`stop_reason: refusal`) usan los respaldos del modelo cuando existen y, si no, un mensaje claro.
   - Si se acaba el saldo o hay demasiadas peticiones (429), el panel recibe un mensaje en español.
8. **Pruebas:** el bucle con un cliente de Anthropic falso, para no gastar; permisos (un visor no escribe aunque la IA lo
   intente); y que el modo lectura no reciba herramientas de escritura.

**Listo cuando:** una pregunta por la API devuelve en streaming una respuesta que usó herramientas reales del MCP, con
el modelo elegido, y queda guardada con su costo.

> **Hecho (2026-11-05), con pruebas sobre un cliente falso.** Falta la prueba real con la clave de Anthropic. Decisiones:
> - **Bucle propio en vez del *tool runner*:** cada respuesta se guarda con su costo antes de la siguiente, y una respuesta
>   rechazada o cortada nunca ejecuta herramientas.
> - **Identidad:** en el proceso web `MCP_DEV_USERNAME` se lee antes que `g.user`, así que las llamadas van dentro de
>   `run_as`, que tiene prioridad sobre todo y falla cerrado. El modo lectura lleva además el alcance `superset:read`.
> - **Confirmaciones:** las herramientas destructivas y las de compartir no se ofrecen en ningún modo hasta la fase 3.
> - **Modo fijo por conversación:** una conversación guarda referencias a herramientas, y otro modo ofrece otras.
> - El modo edición exige poder editar el tablero; la clave `sst_` no entra al chat, que gasta la clave del servidor.
> - Las herramientas de captura abren la app en un navegador. Con `flask run --without-threads` esa visita tendría que
>   esperar a que termine la misma petición, así que pueden bloquearse (sin probar); gunicorn atiende varias a la vez.

## 2. «Pregúntale a tus datos» (L)

1. **Panel en modo lectura** (`src/auradata/assistant/`): un botón en la barra de lectura (`ReadingBar`) abre un panel
   lateral de chat.
   - Respuesta en streaming, mostrando qué herramienta está usando.
   - **El selector de modelo** muestra los permitidos con su precio relativo (económico, equilibrado, máximo) y el
     elegido por defecto.
   - Historial de conversaciones del tablero.
2. **Respuestas con datos.**
   - Texto, más tablas chicas y gráficos chicos dibujados con `SuperChart` a partir del `form_data` que devuelva la
     herramienta (sin crear gráficos guardados).
   - Cada cifra dice de qué dataset y con qué filtros sale.
3. **Contexto:** el asistente sabe en qué página y con qué filtros está el usuario, y responde sobre eso salvo que le
   pida otra cosa.
4. **Español primero:** responde en el idioma del usuario. Todos los textos del panel van con `t()` y su entrada en
   `messages.po`.
5. **Teléfono:** en pantallas angostas, el panel ocupa la pantalla.

**Listo cuando:** un visor pregunta «¿qué región vendió más el último trimestre?» en el tablero de demostración y
recibe la respuesta, con la cifra, su origen y un gráfico chico, sin poder cambiar nada.

## 3. Copiloto del editor (L)

1. **El panel en el editor:** una pestaña «Asistente» junto a los paneles (formato, datos, campos…) y un botón en la
   cinta (Inicio › Asistente).
2. **Contexto rico:** página activa, objetos seleccionados y su formato, para que «ponle borde a este gráfico» sepa
   cuál es «este».
3. **Cambios sobre lo guardado** (primera versión).
   - Si hay cambios sin guardar, el panel pide guardarlos o descartarlos antes de que la IA actúe.
   - Después de cada cambio de la IA, el editor recarga el layout y los gráficos sin salir del modo edición.
4. **Confirmaciones:** borrar, publicar, compartir o programar envíos muestran una tarjeta de aprobar o rechazar antes
   de ejecutarse.
5. **Deshacer:** cada turno de la IA es una versión del historial. Un botón «Deshacer lo del asistente» vuelve a la
   versión anterior.
6. **Segunda versión (anotada, no en esta fase):** la IA devuelve los cambios como acciones del editor, con el
   deshacer normal y sin necesidad de guardar antes.

**Listo cuando:** en un informe de prueba, «agrega un gráfico de barras de ventas por región en la página 2 y alinéalo
con el de arriba» funciona, se ve en el editor y se deshace con un clic.

## 4. Gobierno (M)

1. **Marca de la IA:** el historial de versiones y el registro de acciones dicen «hecho por el asistente (modelo X)», y
   se pueden filtrar.
2. **Interruptores:** el asistente se enciende o apaga por workspace, y el modo editor por separado del modo lectura.
3. **Topes de gasto:** mensual global y por workspace. Al 80% se avisa; al 100% el asistente se detiene con un mensaje
   claro.
4. **Uso en Administración:** gasto por mes, modelo, workspace y usuario, a partir de la contabilidad de la fase 1.
5. **Aviso de privacidad:** la primera vez que alguien abre el panel, se le dice qué se envía a Anthropic.

## 5. Evaluación (M)

1. Los encargos E1 a E8 adaptados al panel, más 6 a 8 preguntas de datos con respuesta conocida, sobre el dataset de
   demostración.
2. **Comparación de modelos:** se corre la batería con Haiku, Sonnet y Opus a esfuerzo bajo y medio, y se miden
   aciertos, costo por tarea completada y tiempo. Sale una recomendación por modo: lectura y editor.
3. Un test de Playwright por modo, con un cliente de Anthropic simulado. Las corridas con la API real son manuales,
   porque gastan.
4. **Inyección:** un dataset con texto que intenta dar órdenes. El asistente no las sigue y las acciones destructivas
   siguen pidiendo confirmación.

## 6. Documentación (S–M)

- **Manual:** capítulo «Asistente de IA» en `docs/auradata/manual/`: preguntar, editar, deshacer, elegir modelo y
  privacidad.
- **Administración:** cómo poner la clave de Anthropic, elegir modelos, poner topes y leer el uso.
- **Arquitectura:** el bucle, el catálogo de modelos y cómo agregar un modelo nuevo de Anthropic.

## Riesgo

- **Seguridad:** el asistente actúa como el usuario y nunca puede más que él (principio 2). La inyección de órdenes
  desde los datos se mitiga con el principio 5 y se prueba en la fase 5.
- **Datos:** la fase 1 agrega tablas, con una migración que se prueba en una base desechable.
- **Contratos y entorno:** una dependencia y una variable de entorno nuevas (`ANTHROPIC_API_KEY`) en los dos
  despliegues.
- **Costo:** cada prueba real gasta dinero, así que las pruebas automáticas usan un cliente simulado y las reales se
  aprueban antes de correrlas.
