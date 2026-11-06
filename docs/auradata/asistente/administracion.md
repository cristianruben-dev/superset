# Administrar el asistente de IA

Cómo encender el asistente, elegir sus modelos, ponerle topes y leer lo que gasta. Viene apagado: los datos que la gente
consulta viajan a Anthropic, y eso lo decides tú.

Para quien usa el panel está el [capítulo 10 del manual](../manual/10-asistente-de-ia.md). Para quien cambia el código,
[arquitectura.md](../arquitectura.md#6-el-asistente-de-ia).

> **Lo que se ha comprobado.** El asistente se probó con Claude real en desarrollo y sus dos paneles se vieron en un
> navegador: ver la [evaluación](evaluacion.md#resultados). Falta probarlo detrás de un proxy real y en producción: empieza
> con un tope bajo.

## Puesta en marcha

Hacen falta **dos encendidos**: uno en la configuración del servidor y otro en la pantalla. Si falta el primero, el
interruptor de la pantalla se puede ver encendido y el asistente sigue apagado.

1. **Agrega la clave y el encendido** al archivo de entorno.

   | Entorno | Archivo |
   | --- | --- |
   | Desarrollo | `docker/.env-local`, que git ignora |
   | Producción | `docker/.env-prod`. `docker/.env-prod.example` trae `ANTHROPIC_API_KEY` |

   ```bash
   ANTHROPIC_API_KEY=tu-clave
   ```

2. **Reconstruye las imágenes,** para que todos los contenedores tengan el SDK `anthropic` y lean el entorno nuevo.

   ```bash
   docker compose up -d --build
   ```

   En producción:

   ```bash
   docker compose -f docker-compose-prod.yml up -d --build
   ```

   Al arrancar, `superset-init` aplica las migraciones, entre ellas [`c6a1f4e09b27`](#la-migración).

3. **Abre Administración › Asistente de IA** (`/assistant/settings/`, solo administradores) y comprueba que **Modelos** no
   muestra ningún aviso.
4. **Elige los modelos y el modelo por defecto, pon un tope mensual,** activa **Encender el asistente** y pulsa **Guardar**.
5. **Si hay proxy delante,** dale [los tiempos](#tiempos-del-proxy) de las rutas del chat.
6. **Comprueba:** abre un informe y busca **Pregúntale a tus datos**. Acepta el aviso y pregunta algo.

La clave se queda en el servidor: ninguna respuesta de la API la devuelve y el navegador nunca habla con Anthropic.

### Qué manda en cada ajuste

| Ajuste | Variable de entorno | Pantalla |
| --- | --- | --- |
| Encendido | `AURADATA_ASSISTANT_ENABLED`, solo como valor inicial | **Encender el asistente**. Una vez guardada, la pantalla manda |
| Esfuerzo | `AURADATA_ASSISTANT_EFFORT` (solo en `auradata_config.py`) | **Esfuerzo** |
| Razonamiento | `AURADATA_ASSISTANT_THINKING` (solo en `auradata_config.py`) | **Dejar que el modelo razone** |
| Cambiar informes | `AURADATA_ASSISTANT_EDIT_ENABLED` (solo en `auradata_config.py`) | **Dejar que cambie informes** |
| Modelo por defecto | `AURADATA_ASSISTANT_DEFAULT_MODEL` | **Modelo por defecto** |
| Modelos ofrecidos | `AURADATA_ASSISTANT_ALLOWED_MODELS`, separados por comas | Casillas de **Modelos** |
| Tope mensual | `AURADATA_ASSISTANT_MONTHLY_BUDGET_USD` | **Tope mensual (USD)** |

Menos en el encendido, **lo guardado en la pantalla gana** al entorno: las variables solo son valores de partida.

## Modelos

La lista sale de la API de modelos de Anthropic y se recuerda una hora; **Actualizar lista** la vuelve a pedir. Si no se
puede leer, la pantalla usa la tabla interna y dice por qué, por ejemplo clave rechazada o sin conexión.

| Lo que ves | Qué significa |
| --- | --- |
| Precio en dólares por millón de tokens, entrada / salida | Viene de la tabla interna `MODEL_TABLE`, no de Anthropic |
| Nota de que AuraData BI no conoce el modelo | Corre con [valores prudentes](../arquitectura.md#el-catálogo-de-modelos): solo lee, y su precio es el más alto de la tabla |
| **Modelo por defecto** | Tiene que ser uno de los marcados |

**Antes del primer guardado** se ofrecen los modelos vigentes de la tabla. **Después, solo los marcados:** la pantalla
guarda la lista exacta, y un modelo nuevo no se ofrece hasta que lo marques.

En el panel, cada modelo lleva una etiqueta según su precio de entrada por millón de tokens:

| Etiqueta | Precio de entrada |
| --- | ---: |
| **Económico** | Menos de $2 |
| **Equilibrado** | De $2 a menos de $4 |
| **Máximo** | $4 o más |

El modelo por defecto de fábrica es Claude Sonnet 5.5. Que sea el de fábrica no significa que esté medido: la
[comparación](evaluacion.md) está pendiente.

**Esfuerzo y razonamiento** valen para todos los modelos, y cada uno los traduce a lo que acepta:

- Por defecto, cada modelo usa el esfuerzo de su fila en la tabla.
- Un modelo que no tenga el nivel elegido usa el más cercano por debajo.
- Apagar el razonamiento baja el esfuerzo si el modelo no acepta ese nivel sin razonar: en Sonnet 5.5, por ejemplo, llega
  hasta alto.
- Opus 5.5 y Fable 5.1 siempre razonan: en ellos, solo el esfuerzo lo baja.

La [evaluación](evaluacion.md#resultados) compara los niveles bajo y medio, y [probó el razonamiento apagado](evaluacion.md#razonamiento-apagado) con Claude real.

## Topes de gasto

Hay un tope **global**, en **Tope mensual (USD)**, y uno **por área de trabajo**. Manda el que esté más cerca de cortarse.

| Gasto del mes | Qué pasa |
| --- | --- |
| Menos del 80% | Nada |
| Desde el 80% | El panel avisa que queda poco |
| Desde el 100% | No empieza ningún turno nuevo: el chat responde 429 y el panel bloquea la escritura |

- **Vacío es sin tope, y `0` detiene** el asistente desde el primer mensaje.
- **El tope no es duro.** Se revisa antes de cada turno, y un turno en marcha termina: un modelo que sigue usando
  herramientas puede pasarse hasta que acabe ese turno. Decidir una tarjeta tampoco mira el tope. Deshacer no gasta.
- **El mes es de calendario,** según el reloj del servidor que escribe `created_on`, UTC en las imágenes.
- **Quien usa el panel ve el nivel, nunca el monto.**

## Leer el uso

**Administración › Asistente de IA › Uso** muestra el gasto de un mes por modelo, área de trabajo y persona, más el total de
los últimos 12 meses. Una persona o un área que ya no existe sale con una etiqueta genérica.

Las tablas por modelo y por área suman también los votos **Útil** y **No útil**. Cuentan en el mes de la respuesta, no en el
del voto. Son solo totales: ni quién votó, ni el motivo, ni el texto de la conversación.

**Son estimaciones, no la factura.** Cada costo se calcula con los tokens que informa la API y los precios de
`MODEL_TABLE`. Compáralo con la consola de Anthropic. Los turnos rechazados o interrumpidos también cuentan, porque la API
los cobró. Las corridas de la [evaluación](evaluacion.md) cuentan igual, y su modo sin gasto también suma costos simulados.

## Interruptores por área de trabajo

En la página del área, el menú tiene **Asistente de IA**. Lo cambian los administradores del área y los de la plataforma,
nunca un colaborador.

| Control | Efecto |
| --- | --- |
| **Encender el asistente** | Apagado, el asistente no se ofrece en los informes del área |
| **Dejar que cambie informes** | Apagado, solo responde preguntas |
| **Tope mensual (USD)** | El tope propio del área. Vacío, solo rige el global |

También muestra **Gastado este mes**, en dólares, a los administradores del área.

- **Un área solo puede restringir.** No enciende lo que la plataforma apagó.
- **Un informe sin área** sigue los ajustes globales.
- **Se lee en cada petición,** así que mover un informe de área cambia sus reglas al momento.

## Privacidad

- **Qué viaja a Anthropic:** lo que la persona escribe, la conversación, el informe, la página, los filtros y la selección en
  pantalla, y los datos que el asistente lee, con sus filas. El asistente ve lo que ve la persona: **da acceso al panel
  pensando en a qué datos llega cada rol.**
- **El aviso:** hasta que cada persona lo acepta, el chat y las decisiones responden 403 y nada llega a Anthropic. Se guarda
  por persona. Cambiar su texto obliga a subir `PRIVACY_NOTICE_VERSION`, y todos lo aceptan de nuevo.
- **Qué se guarda aquí:** las conversaciones completas, con los resultados de las herramientas y sus filas de datos, quedan en
  la base de metadatos (`auradata_assistant_messages`) hasta que su dueño las elimina o vence su [retención](#retención).
- **Quién lee qué:** en la aplicación, cada conversación es de su dueño. Quien tenga acceso a la base de metadatos las puede
  leer. **Uso** no muestra contenido. El registro de acciones guarda cada herramienta con sus parámetros.

## Retención

Una tarea de Celery, `auradata_assistant.purge_conversations`, corre cada noche a las 03:30. Viene en el `beat_schedule` de
`superset.config`, que las configuraciones de `dev` y `prod` heredan: necesita **`superset-worker-beat`** y un worker en marcha.

```python
AURADATA_ASSISTANT_RETENTION_DAYS = 90    # días desde el último mensaje
AURADATA_ASSISTANT_RETENTION_DAYS = None  # conservar todo, para siempre
```

| Qué | Qué le pasa |
| --- | --- |
| Conversación cuyo último mensaje pasó los días configurados | Se borra |
| Conversación de un informe o una persona ya borrados, sea cual sea su edad | Se borra: nadie puede abrirla |
| Conversación con una tarjeta de confirmación esperando | **Se queda**, aunque esté vencida |
| Conversación con un turno en marcha | Se queda |
| Conversación de un informe en la papelera | Sigue su retención normal: el informe puede volver |

- **Con `None` no se borra nada,** tampoco lo huérfano. Lo mismo con un valor que no tenga sentido, como `0` o `"90"`: el log lo
  avisa y la tarea no toca nada.
- **Es irreversible.** Cada pasada primero cuenta y lo escribe en el log, y luego borra de a 50. Un lote que falla se deshace
  entero, y lo intenta la siguiente noche. Al log solo llegan cantidades, nunca títulos ni contenido.
- **Para ver qué borraría,** corre la tarea sin borrar, con su worker en marcha:

  ```bash
  celery --app=superset.tasks.celery_app:app call auradata_assistant.purge_conversations --kwargs '{"dry_run": true}'
  ```

  El log del worker trae `expired`, `orphaned`, `would_delete`, `kept_pending` y `kept_under_way`.
- **Una tarjeta vieja se queda hasta que alguien la responda.** Si es de un informe o una persona borrados, nadie puede
  responderla, y su contenido queda en la base. `kept_pending` cuenta esos casos: revísalos si no bajan.

### Qué sobrevive

Los topes de gasto y **Uso** siguen dando lo mismo después de borrar: **borrar una conversación no devuelve presupuesto.**

- **Se borra:** el título, los mensajes de la persona, los resultados de las herramientas con sus filas de datos, los registros
  de lo que hizo y el texto de cada respuesta.
- **Queda:** una fila por respuesta, vacía y sin relación con la conversación, con su modelo, tokens, costo, fecha, persona y
  área de trabajo, más su voto sin el motivo. Sin eso, el mes cambiaría al borrar.
- **No lo toca:** el registro de acciones, que guarda cada herramienta con sus parámetros y solo se purga si activas
  `prune_logs`, ni las copias de la base.

## La migración

`c6a1f4e09b27` crea `auradata_assistant_conversations` y `auradata_assistant_messages`. Solo agrega tablas. Corre con
`superset db upgrade`, que `superset-init` ejecuta al arrancar. `b2d58e7a13c4` agrega `auradata_assistant_feedback`, con los
votos. `e5a7c3f19d42` deja vacío `conversation_id` en las dos tablas de filas que sobreviven a su conversación. Revertirla borra
esas filas, y con ellas el gasto y los votos de las conversaciones ya borradas.

Sin ella, el asistente no puede guardar conversaciones. En una base que ya existe, respáldala antes, como con cualquier
migración.

Los ajustes globales, los de cada área y la aceptación del aviso no piden tablas: viven en el almacén clave-valor.

## Tiempos del proxy

Las respuestas llegan en streaming, y una herramienta puede pasar minutos en silencio. El modelo pensando no corta la
conexión, porque el servidor manda un `keep-alive` cada 15 segundos, pero **una herramienta en marcha no manda nada**.

Solo estas dos rutas lo necesitan:

```text
POST /api/v1/auradata/assistant/
POST /api/v1/auradata/assistant/conversations/<id>/decide/
```

| Dónde | Qué hacer |
| --- | --- |
| Desarrollo | Ya está en `docker/nginx/templates/superset.conf.template`: 300 s y sin buffering. Toma efecto al reiniciar nginx |
| Producción | `docker-compose-prod.yml` no trae nginx. Tu proxy necesita lo mismo: 300 s de lectura y **buffering apagado** |

Con nginx, un bloque como el de desarrollo, con tu propio `proxy_pass` y tus cabeceras:

```nginx
location ~ /api/v1/auradata/assistant/(conversations/[^/]+/decide/)?$ {
    proxy_pass http://superset_app;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 300;
}
```

`gunicorn --timeout` (60 s por defecto, `GUNICORN_TIMEOUT`) no corta una respuesta larga con `gthread`, el worker de
`run-server.sh`: el aviso de vida al proceso maestro va en su bucle propio, aparte de la petición. Probado con gunicorn 26.2 y
Claude real: con `--timeout 3`, una respuesta de 20 s con 8 s sin eventos llegó completa. Como control, una ruta que duerme 8 s
terminó con `gthread` y murió con `sync`, con `WORKER TIMEOUT`. **Con `SERVER_WORKER_CLASS=sync` y `SERVER_THREADS_AMOUNT=1` sí se corta;** con más de un hilo, gunicorn usa `gthread` aunque
pidas `sync`. Se probó
con la imagen de desarrollo y las opciones de `run-server.sh`, no con la imagen `prod`, y nada duró más de 60 s.

Sin probar: el comportamiento detrás de un proxy real.

## Qué proceso necesita qué

El bucle corre solo en el proceso web, que necesita los paquetes `anthropic` y `fastmcp`. Las imágenes `dev` y `prod` traen los
dos. Sin ellos, la pantalla avisa que falta el SDK y el chat responde 503. Todos los servicios se construyen del mismo
`Dockerfile`, así que al reconstruir todos quedan con el SDK.

Si instalaste `anthropic` a mano en un contenedor, lo pierdes al recrearlo. La solución es reconstruir.

La [retención](#retención) corre aparte: `superset-worker-beat` la dispara y un worker la ejecuta. Si no corren, nada se borra.

## Límites conocidos

| Límite | Qué pasa | Qué hacer |
| --- | --- | --- |
| Un visor no recibe cifras de un dataset | El dataset no pertenece a su área: es compartido o de otra área. Los miembros de un área leen solo los datasets de esa área (`workspace_grants.py`) | Agrega el dataset al área, o dale `datasource_access` a su rol |
| Deshacer no toca los datasets | Un dataset cambiado por un turno se queda así. Un gráfico creado queda fuera del informe sin borrarse, y uno borrado sigue en la papelera | Revísalo a mano. Otros informes leen el mismo dataset |
| Un turno puede pasarse del tope | Nada limita el gasto de un solo turno, salvo las 25 llamadas al modelo por tramo, que vuelven a contar después de una tarjeta | Deja margen en el tope |
| Un proceso que muere con una herramienta en marcha | Esa conversación queda ocupada y responde 409 | Empezar una conversación nueva funciona |
| Muchas herramientas piden tarjeta | [32 de 146](evaluacion.md#herramientas-detrás-de-una-tarjeta), incluidas `update_chart` y `update_dashboard`. Puede cansar en el uso real | Se revisa con los datos de la evaluación |
| Capturas (`get_dashboard_screenshot`) desde el proceso web | Funcionan en desarrollo | Sin probar en producción |
| Rutas `undo/` y `models/` | Sin bloque propio en el proxy: son respuestas cortas | Nada |

## Si algo falla

| Síntoma | Causa | Arreglo |
| --- | --- | --- |
| La pantalla dice encendido y no sale el botón | Falta la clave | Agrégala y recrea los contenedores |
| Aviso de que no hay clave de Anthropic | `ANTHROPIC_API_KEY` no llegó al proceso | Revisa el archivo de entorno |
| Aviso de que Anthropic rechazó la clave | Clave mala o revocada | Cámbiala en el entorno |
| Aviso de que falta el SDK, o chat con 503 | Imagen vieja | Reconstruye |
| Sale en lectura y no en edición | **Dejar que cambie informes** apagado, global o en el área | Enciéndelo |
| Mensaje de que se acabó el crédito | Sin saldo en Anthropic | Recarga en la consola de Anthropic |
| La respuesta se corta a los 60 s | Falta el bloque del proxy, o el worker es `sync` con `SERVER_THREADS_AMOUNT=1` | Mira [tiempos del proxy](#tiempos-del-proxy) |
| «El servicio de IA falló» en una conversación muy larga | Excedió el contexto del modelo. El panel avisa desde el 80% | Empieza una conversación nueva |
| El tope cortó el mes | Llegó al 100% | Súbelo o espera al mes siguiente |
