# Plan: la siguiente etapa del asistente de IA

Fecha: 2026-11-06 · Rama base: `main` (`04ffb90237`)

**Objetivo.** Pasar de un asistente que funciona a uno que se usa todos los días y produce entregables: informes
ejecutivos con cifras reales, que se ajustan conversando y se exportan.

Parte de lo que ya probamos con Claude real (`docs/plans/2026-11-05-plan-asistente-ia.md`) y de lo que vale la pena tomar
de [vercel/chatbot](https://github.com/vercel/chatbot). De ese repo se toman ideas, no código: su stack es otro.

Tamaños: **S** (un día o menos), **M** (unos días), **L** (una semana o más).

## Camino rápido

| Fase | Qué | Tamaño | Depende de |
| ---: | --- | :---: | --- |
| 0 | Cerrar lo pendiente de la etapa anterior | M | - |
| 1 | Copiar y 👍👎 por mensaje | S–M | 0 |
| 2 | Gestionar conversaciones y su retención | M | 0 |
| 3 | Ver lo que el modelo está haciendo | S | 0 |
| 4 | Adjuntar imágenes | M | 0 |
| 5 | Comandos con `/` | S | 1, 2 |
| 6 | Reanudar una respuesta | L | 0 |
| 7 | Artifacts: documento vivo al lado del chat | L | 3, 6 |
| 8 | Artifacts: exportar, guardar en el informe y compartir | M | 7 |
| 9 | Evaluación final y documentación | M | todas |

Las fases corren en orden, una sesión por fase, con revisión antes de cada merge. Las fases 1 a 4 no dependen entre sí.

## Decisiones tomadas (2026-11-06)

| # | Decisión | Fase | Qué se decidió |
| ---: | --- | :---: | --- |
| 1 | Qué ven los visores de un workspace | 0 | Dar lectura a los datasets del workspace a sus visores, con una regla nueva y probada en `workspace_grants.py` |
| 2 | Cuánto se conservan las conversaciones | 2 | 90 días, configurable, con borrado automático |
| 3 | Quién lee los 👍👎 | 1 | Solo admins, sin el texto de la conversación |
| 4 | Dónde se guardan las imágenes | 4 | En nuestra base, nunca en la Files API de Anthropic |
| 5 | Con quién se comparte un artifact | 8 | Solo dentro del workspace, cada persona con sus permisos |

## Principios

Siguen valiendo los del plan anterior. Estos importan más aquí:

1. **El asistente nunca puede más que el usuario.** Toda función nueva pasa por `run_as`, `ToolBox` y las confirmaciones.
2. **La conversación solo crece.** Nada reescribe turnos anteriores. Por eso no habrá edición de mensajes viejos: quien
   quiera corregir, abre una conversación nueva desde ese punto.
3. **Las cifras salen de consultas, no del modelo.** Un artifact guarda la consulta y dibuja la cifra al abrirse.
4. **Lo que viene del modelo es dato no confiable.** Ni HTML, ni imágenes externas, ni enlaces a otros sitios.
5. **Probar con Claude real antes de dar algo por hecho.** El cliente falso escondió cuatro errores serios la vez pasada.
   Cada fase con backend termina con una prueba real y una prueba en el navegador.

---

## 0. Cerrar lo pendiente (M)

**Por qué primero:** lo que falle aquí se arrastraría a todo lo demás.

1. Corregir la tarea E6 y correr I2, inyección en modo edición.
2. Revisar a mano los tableros `Evaluación …` y anotar la calidad por modelo en `evaluacion.md`.
3. Resolver la decisión 1, sobre los visores.
4. Que un editor de un dataset lo encuentre por el MCP. Hoy `DatasourceFilter` lo esconde aunque `raise_for_access` lo deja
   pasar.
5. Reconstruir las imágenes, para que todos los contenedores tengan el SDK.
6. Revisar `superset-superset-mcp-1`, que figura `unhealthy`, y probar el MCP con Claude conectado (E1 a E8).
7. Probar con Claude real el razonamiento apagado y la conversación larga.
8. Decidir si `gunicorn --timeout 60` corta las respuestas largas, con una prueba en la imagen `prod`.

**Listo cuando:** E6 e I2 pasan, las ediciones tienen nota y un visor recibe cifras según la decisión 1.

## 1. Copiar y 👍👎 por mensaje (S–M)

**Para qué:** saber qué respuestas fallan con usuarios reales.

1. Botón de copiar en cada respuesta: el texto y, si la hay, la tabla.
2. 👍 y 👎, con un motivo opcional al votar en contra.
3. Tabla nueva `auradata_assistant_feedback`, con una fila por mensaje y por usuario. El voto se puede cambiar.
4. Pestaña de uso: votos por modelo y por workspace, sin el texto de la conversación.

**Listo cuando:** un voto sobrevive a recargar, nadie vota en la conversación de otro y el admin ve los totales.

## 2. Gestionar conversaciones y su retención (M)

**Para qué:** hoy solo hay un selector, y nada se borra nunca.

1. Renombrar y borrar. Borrar elimina el contenido, incluidas las filas de datos que la conversación guarda.
2. Lista con búsqueda por título y agrupada por fecha, dentro del panel.
3. Tarea de Celery que borra lo vencido, según `AURADATA_ASSISTANT_RETENTION_DAYS` y la decisión 2.
4. Borrar también lo que hoy queda huérfano: conversaciones de informes o personas ya borrados, que siguen en la base.
5. Mantener lo que pide la contabilidad: el costo de un mensaje sobrevive sin su contenido, para que los topes de gasto y
   el uso sigan dando bien.

**Riesgo:** borra datos de forma irreversible. Se prueba en una base desechable, y la tarea primero cuenta sin borrar.

**Listo cuando:** una conversación vencida desaparece, y el gasto del mes no cambia.

## 3. Ver lo que el modelo está haciendo (S)

**Para qué:** en una respuesta larga, «Pensando…» no dice nada.

1. Una entrada `thinking_display` en `ModelSpec`: `updates` donde exista, `summarized` donde no.
2. El panel muestra esas notas en los pasos de la respuesta, y se pliegan al terminar.
3. Los bloques de razonamiento siguen guardándose y reenviándose sin tocarlos.
4. Comprobar con Claude real que la preservación del razonamiento no se rompe.

**Listo cuando:** en E3, con Sonnet, se ve el progreso mientras trabaja, y la conversación sigue funcionando en su segundo
turno.

## 4. Adjuntar imágenes (M)

**Para qué:** subir la captura de un informe de Power BI y pedir que lo replique.

1. Pegar, arrastrar o elegir PNG, JPEG o WEBP, con miniatura en el mensaje.
2. Tabla `auradata_assistant_attachments`, según la decisión 4, solo accesible por el dueño de la conversación.
3. El servidor comprueba el tipo real del archivo, el tamaño y la cantidad por mensaje, y reescala lo que exceda el límite.
4. La imagen va en el turno del usuario y se reenvía igual, para no romper la caché ni el historial.
5. Marcar la imagen como dato: el texto dentro de una captura tampoco es una orden.
6. El aviso de privacidad nombra las imágenes. Como cambia su texto, sube `PRIVACY_NOTICE_VERSION` y se vuelve a pedir.

CSV y Excel quedan fuera: son otra función, con otro riesgo.

**Listo cuando:** con una captura real, la tarea E2 arma una página parecida, y una imagen con texto malicioso no le ordena
nada.

## 5. Comandos con `/` (S)

| Comando | Qué hace |
| --- | --- |
| `/nuevo` | Abre una conversación nueva |
| `/modelo` | Abre el selector de modelo |
| `/resumen` | Pide un resumen de la página |
| `/deshacer` | Lo mismo que «Deshacer lo del asistente» |

Se abre un menú al escribir `/`, usable solo con el teclado. Los comandos son atajos del panel: no agregan permisos y no
llegan al modelo como comandos.

**Listo cuando:** los cuatro funcionan con el teclado, en español e inglés.

## 6. Reanudar una respuesta (L)

**Para qué:** hoy, cerrar o recargar corta la respuesta. Además, una respuesta larga queda atada a una petición web, con
sus tiempos de espera.

1. La respuesta corre en un worker de Celery, no dentro de la petición.
2. Cada evento va a un stream de Redis con su número.
3. `GET /conversations/<id>/stream/?after=<n>` entrega lo que falta, y el panel se reconecta solo.
4. Detener sigue funcionando, y deja de depender de cerrar la conexión.
5. Un turno por conversación, como hoy. Un worker que muere deja la conversación utilizable, con un mensaje claro.

**Riesgo alto, de seguridad y concurrencia:** el worker debe actuar como quien pregunta, con `run_as` y sin caer en otro
usuario. Lleva verificación independiente. Las herramientas no pueden correr como un usuario de sistema, ni siquiera un
momento.

**Listo cuando:** en mitad de una respuesta, recargar la muestra completa, y un usuario no puede leer el stream de otro.

## 7. Artifacts: documento vivo al lado del chat (L)

**Para qué:** que el resultado sea un entregable, como «hazme el resumen ejecutivo de este trimestre», y no solo un mensaje.

1. Tablas `auradata_assistant_artifacts` y `auradata_assistant_artifact_versions`. Cada cambio es una versión nueva.
2. Contenido por bloques, en JSON: texto, cifra destacada, gráfico y tabla. Un bloque de datos guarda su consulta, nunca el
   número.
3. Herramientas propias del asistente: crear un artifact, cambiar un bloque y leerlo. Corren por `ToolBox` y solo escriben
   en artifacts de esa persona.
4. Panel al lado del chat, con el documento en vivo, historial de versiones y volver a una anterior.
5. Al abrirlo, las cifras se consultan con los permisos de quien lo mira, por la API de datos de gráficos. Si un dato se
   rechaza, el bloque lo dice en vez de quedar vacío.
6. Pedir un cambio sobre lo seleccionado: «acorta este párrafo», «cambia este gráfico a líneas».

**Límite que hay que aceptar:** el texto queda escrito con las cifras que el autor veía. Si un dato cambia, el texto no se
reescribe solo: el artifact muestra la fecha y ofrece actualizarlo.

**Listo cuando:** se crea un resumen de 147 con texto, dos gráficos y una tabla, se ajusta conversando y se vuelve a una
versión anterior.

## 8. Artifacts: exportar, guardar en el informe y compartir (M)

1. Exportar a PDF, con la captura que ya usamos para los informes.
2. «Guardar como página del informe»: crea la página con los elementos del editor, con tarjeta de confirmación y deshacer.
3. Compartir dentro del workspace, según la decisión 5. Cada persona ve las cifras con sus permisos, y el texto del autor
   va con una nota de quién lo escribió y cuándo.
4. Marca «hecho por el asistente (modelo X)» en el artifact y en el registro de acciones.

**Riesgo:** el texto compartido puede contener cifras que el lector no tiene permiso de ver, y RLS no alcanza a un texto.
Por eso, antes de compartir, una tarjeta avisa de lo que el texto incluye, y la decisión 5 limita a quién llega.

**Listo cuando:** el PDF se ve como en pantalla, la página guardada se deshace con un clic y un visor sin permiso sobre un
dato no ve ese bloque.

## 9. Evaluación final y documentación (M)

1. Sumar a la batería tareas de imágenes, artifacts e inyección por imagen.
2. Correr la comparación de modelos otra vez y actualizar la recomendación.
3. Un test de Playwright por función nueva, con Anthropic simulado.
4. Manual, guía de administración y arquitectura.

**Listo cuando:** la batería pasa con Claude real y los documentos describen lo que el código hace.

**Cierre (2026-11-06).** Rama `test/assistant-final-eval`. La batería corrió con Claude real por el worker: $13.76, y las
tareas con regla pasaron todas en Haiku, Sonnet, Opus y, en su muestra, Fable. Las 27 corridas de inyección no obedecieron. Lo que
cambió frente a este plan:

- El runner ya no envuelve el cliente: el worker es otro proceso. El esfuerzo va por el ajuste del administrador y los topes se
  leen de las filas, y por eso la salida ya no se limita a 16 000 tokens.
- Las pruebas de Playwright no interceptan rutas: un servidor simula Anthropic para un worker aparte, así que el resto es real.
  Se suma una prueba de conversación larga. Ninguna encontró un error del producto.
- Por el tope no corrieron E5, E6, y E3 y E4 a esfuerzo bajo, y E7 solo con dos modelos.
- Las ediciones se revisaron por muestra, no todas: ver [la revisión](../auradata/asistente/evaluacion.md#revisión-de-las-ediciones).

Quedan sin probar la imagen `prod`, un proxy real y un teléfono real:
[lista completa](../auradata/asistente/administracion.md#lo-que-nunca-se-probó). La verificación pesada (`pre-commit`, mypy, `tsc` y
Jest) sigue pendiente.

---

## Qué queda fuera, y por qué

| Idea de vercel/chatbot | Por qué no |
| --- | --- |
| Next.js, Auth.js, Neon, Vercel Blob, AI Gateway | Ya tenemos stack, usuarios, base de datos y permisos |
| Varios proveedores de IA | Las tablas de modelos y las pruebas son de Anthropic |
| Editor de código y consola Python | No aportan a un producto de BI |
| Editar mensajes anteriores | Rompe el historial que solo crece |
| Chats públicos por enlace | Con datos de negocio, es un riesgo |

## Riesgos de toda la etapa

| Riesgo | Mitigación |
| --- | --- |
| **Seguridad:** identidad en el worker (fase 6), archivos subidos (4), compartir (8) | Verificación independiente en cada una |
| **Datos:** migraciones (1, 2, 4, 7) y borrado (2) | Base desechable, en los dos sentidos |
| **Contratos:** el aviso de privacidad cambia (4) | Sube `PRIVACY_NOTICE_VERSION` |
| **Entorno:** el worker necesita el SDK y la clave (6) | Imágenes reconstruidas en la fase 0 |
| **Costo:** cada prueba real gasta | Topes por corrida; las imágenes y los artifacts largos cuestan más, así que se miden en cada fase |

## Antes de subir

La verificación pesada (`pre-commit`, mypy, `tsc` completo y Jest) sigue pendiente de la etapa anterior. Corre al final de
la fase 0 o antes de subir `main`, lo que ocurra primero, sin esperar al fin de este plan.
