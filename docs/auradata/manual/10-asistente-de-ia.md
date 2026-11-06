# 10. Asistente de IA

El asistente es un panel de chat dentro de AuraData BI: le preguntas por tus datos mientras lees un informe, o le pides
cambios mientras lo editas. Corre sobre Claude, de Anthropic, y trabaja siempre con tus permisos.

| Dónde estás | Cómo se llama | Qué hace |
| --- | --- | --- |
| Leyendo un informe | **Pregúntale a tus datos** | Responde sobre los datos. No puede cambiar nada |
| Editando un informe | **Asistente** | Cambia el informe guardado, y te pregunta antes de lo delicado |

> **Estado de este capítulo.** El asistente ya se probó con Claude real y en un navegador. El capítulo todavía no lleva
> capturas.

¿Buscas usar tu propia IA, como Claude Code o Claude Desktop? Eso es otra cosa: mira
[9. Conectar IA](09-conectar-ia.md#asistente-o-conectar-ia).

## Antes de empezar

- **Si no ves el botón,** el asistente está apagado o le falta configuración. Lo decide un administrador, y un área de
  trabajo también puede apagarlo para sí misma.
- **La primera vez** aparece el aviso **Antes de empezar**, que dice qué se envía a Anthropic. Hasta que pulses
  **Entendido, continuar** no se envía nada. Se acepta una vez por persona, y vuelve a salir si el aviso cambia.

## Preguntar mientras lees

1. Abre un informe. En la barra de comandos, grupo **Asistente**, pulsa **Pregúntale a tus datos**. En un teléfono es el
   botón flotante **Preguntar**, y el panel ocupa toda la pantalla.
2. Escribe y pulsa `Enter`. `Mayús + Enter` cambia de línea.
3. Lee la respuesta. Mientras trabaja, el panel muestra qué está haciendo; **Detener** corta la respuesta.

Responde sobre **la página y los filtros que tienes en pantalla**, salvo que le pidas otra cosa. Por ejemplo:

- «¿Qué región vendió más en este periodo?»
- «¿Por qué bajó marzo respecto a febrero?»
- «¿De dónde sale esta cifra?»

Una respuesta con cifras dice de qué dataset y con qué filtros salen. Si consultó un dataset, debajo del texto dibuja un
gráfico chico con esa consulta, y si no se puede dibujar deja las filas en una tabla. Esa consulta la repite AuraData BI
con tus permisos, así que si no tienes acceso a esos datos, no se dibuja.

## Pedir cambios mientras editas

Abre el informe en modo edición y entra por **Inicio › Asistente** en la cinta, o por la pestaña **Asistente** de los
paneles. Solo aparece si puedes editar ese informe.

El asistente conoce la página activa y los objetos que tienes seleccionados, con su formato. Así «ponle borde a este
gráfico» sabe cuál es «este». Otros ejemplos:

- «Agrega un gráfico de barras de ventas por región en esta página.»
- «Alinea estas tarjetas y dales el mismo tamaño.»
- «Agrega un segmentador de año arriba a la derecha.»

**Trabaja sobre el informe guardado.** Si tienes cambios sin guardar, el panel te pide **Guardar** o **Descartar** antes
de seguir. Cuando el asistente termina, el editor recarga el informe sin salir del modo edición. Si editaste algo mientras
respondía, el editor no tira tu trabajo: te avisa, y para ver lo del asistente tienes que descartar tus cambios.

## Las tarjetas de confirmación

Para lo delicado, el asistente se detiene y muestra una tarjeta con la acción y sus datos exactos. Nada de eso corre hasta
que pulses **Aprobar**; **Rechazar** lo descarta.

Piden tarjeta las acciones que:

| Tipo | Ejemplos |
| --- | --- |
| Borran o quitan | Un gráfico, una página, un elemento, un marcador, un informe, el diseño móvil |
| Sobrescriben | Cambiar un gráfico o los ajustes del informe, cambiar sus filtros, cambiar una métrica o una columna calculada |
| Publican, comparten o programan | Publicar, compartir, crear o cambiar un informe programado o una alerta |
| Cambian quién entra | Editores y visores del informe, miembros de un área de trabajo |
| Restauran o mueven | Volver a una versión, sacar algo de la papelera, mover a otra área de trabajo |
| Ejecutan SQL | Cualquier sentencia que el asistente quiera correr |

Lo demás, como dar formato o agregar una página, se hace sin tarjeta y se puede [deshacer](#deshacer).

Cómo se comportan:

- **Se decide una por una.** Si un paso trae varias tarjetas, nada corre hasta que las contestes todas.
- **Si rechazas una,** tampoco corren las acciones sin tarjeta de ese paso. Las que aprobaste sí corren.
- **Si escribes en vez de decidir,** las acciones pendientes se descartan. El cuadro de texto te lo recuerda.
- **Pueden esperar.** Si cierras el panel, la tarjeta sigue ahí cuando vuelves a esa conversación. Tus permisos se revisan
  otra vez cuando decides.
- **Solo tu clic aprueba.** Nada que escriba el modelo, ni el texto de un dataset, puede aprobar una tarjeta.

## Deshacer

Después de un turno que cambió el informe aparece **Deshacer lo del asistente**. Devuelve el informe y sus gráficos a como
estaban antes de ese turno. Si lo pulsas otra vez, deshace el turno anterior.

No funciona si:

- **El informe cambió después del turno.** Deshacer se lo llevaría también; vuelve atrás desde el
  [historial de versiones](08-papelera-e-historial.md).
- **Tienes cambios sin guardar** o una **tarjeta sin contestar**. Resuélvelos primero.

Lo que deshacer deja como está:

- **Un dataset que el asistente cambió.** Otros informes pueden leerlo, así que el cambio se queda.
- **Un gráfico que creó.** Sale del informe, pero no se borra.
- **Un gráfico que borró.** Sigue en la [papelera](08-papelera-e-historial.md), y de ahí se recupera.

Lo que hace el asistente queda en el historial con la marca **Hecho por el asistente (modelo)**, y el historial se filtra
con **Solo lo que hizo el asistente**. En el registro de acciones, cada herramienta usada es una fila, con el filtro
**Hecho por**.

## Elegir el modelo

El selector de arriba muestra los modelos que dejó un administrador, con una etiqueta de precio relativo y **por defecto**
en el suyo: **Económico**, **Equilibrado** o **Máximo**. Puedes cambiarlo cuando quieras.

- **Cambiar de modelo a mitad de conversación** funciona, pero esa respuesta tarda más y cuesta más, porque el modelo lee
  todo desde cero. El panel te lo avisa.
- **Un modelo gris** no puede seguir esa conversación. Empieza una **Nueva conversación**.
- **Si dudas,** usa el que viene por defecto: en la [comparación real](../asistente/evaluacion.md#recomendación-por-modo) fue el mejor
  equilibrio para editar informes. Para preguntas sobre los datos, un modelo económico también acertó.

Las conversaciones quedan en **Conversaciones de este informe**, separadas por modo. Si una se hace demasiado larga para el
modelo, el panel te pide empezar otra.

## Privacidad

**Lo que escribes y los datos que el asistente lee se envían a la API de Anthropic.** Eso incluye:

- lo que escribes y la conversación hasta ese momento;
- el informe, la página, los filtros y la selección que tienes en pantalla;
- los datos que lee para responder, con sus filas.

Ve lo que tú ves y nada más. Por eso conviene pensar qué consultas: si tu acceso llega a datos personales, el asistente
también puede leerlos, y entonces viajan a Anthropic.

Las conversaciones se guardan en el servidor de AuraData BI, y en el panel solo tú puedes abrirlas. No hay botón para
borrarlas. La pantalla de uso de los administradores muestra cuánto gastó cada persona, no lo que preguntó; el registro de
acciones sí guarda qué herramientas usó el asistente y con qué parámetros.

## Lo que no puede hacer

- **Más que tú.** Si no tienes permiso para algo, el asistente tampoco, y te lo dice.
- **Cambiar nada mientras lees.** En modo lectura solo responde; los cambios se piden desde el editor.
- **Ver tus cambios sin guardar.** Trabaja sobre lo guardado.
- **Recibir archivos.** El panel no acepta adjuntos: describe con palabras lo que quieres.
- **Entregarte archivos.** Para un PDF o una imagen, usa [Exportar](07-lectura-presentar-exportar.md).
- **Mostrar imágenes ni enlazar fuera del sitio.** En sus respuestas el HTML queda como texto, no se cargan imágenes y solo
  funcionan los enlaces a este mismo sitio. Es una protección: un texto malicioso en un dataset podría intentar sacar
  datos en una dirección.
- **Encargos enormes de una vez.** Un mensaje tiene un límite de pasos. Si se pasa, te pide algo más acotado.
- **Funcionar fuera de tu sesión.** No responde en informes incrustados ni con claves personales `sst_…`.

## Si algo falla

| Qué ves | Qué significa | Qué hacer |
| --- | --- | --- |
| No está el botón | Apagado para todos, en esta área o sin clave | Pregúntale a un administrador |
| Sale en lectura y no en el editor | Esta área solo deja preguntar, o no puedes editar el informe | Pregúntale a un administrador del área |
| Aviso de que queda poco presupuesto | Se gastó el 80% del tope del mes | Sigue funcionando; se detendrá al 100% |
| No deja escribir y habla del presupuesto | Se acabó el tope del mes | Espera al mes siguiente o pídeselo a un administrador |
| Dice que no encuentra el dataset, o no da cifras | Tu rol no tiene acceso a esos datos | Pídele acceso a un administrador |
| Mensaje de que el servicio de IA falló | Saturación, sin saldo, clave rechazada o sin conexión | Reintenta; si dice que avises, avísale a un administrador |
| Dice que la conversación es demasiado larga | Ya no cabe en lo que el modelo puede leer | Pulsa **Nueva conversación** en ese aviso. La anterior sigue guardada |
| La conversación dice estar ocupada | Otra petición la está usando, o se cortó a mitad de una herramienta | Espera un momento; si sigue, empieza una nueva |

La guía para administradores está en [asistente/administracion.md](../asistente/administracion.md).
