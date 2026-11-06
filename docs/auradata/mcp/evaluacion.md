# Evaluación del MCP de AuraData BI

Lista de comprobación que se repite después de cada cambio del MCP (herramientas, instrucciones, prompts o
biblioteca de layout). Tiene dos partes:

1. **Automática**: un escenario que arma un informe completo solo por MCP y una prueba de Playwright que lo abre
   en el editor.
2. **Encargos**: peticiones reales que un usuario le haría a una IA. Se le dan tal cual a un cliente conectado
   (Claude Code, Claude Desktop) y se revisa el resultado con la tabla de cada uno.

## 1. Parte automática

### Escenario por MCP

Necesita el stack de desarrollo levantado (app en 8188, MCP en 5108) y una clave personal creada en
«Conectar IA» (`/connect-ai/`). La clave se pasa solo por el entorno; al terminar, revócala.

```bash
AURADATA_MCP_KEY=sst_… python3 scripts/auradata/mcp_scenario.py
```

Paso a paso, con herramientas del MCP:

| Paso | Herramientas |
| --- | --- |
| Workspace «Análisis comercial» | `list_workspaces` |
| Dataset virtual con datos generados y dos métricas | `list_databases`, `create_virtual_dataset`, `add_metric` |
| Informe vacío de dos páginas («Resumen», «Detalle») | `generate_dashboard`, `rename_page`, `add_page` |
| Lienzo 16:9 con fondo | `set_canvas_format` |
| Título | `add_element` (`kind: "text"`) |
| Tarjeta, líneas, barras y tabla | `create_visual` |
| Formato | `format_visual` (etiquetas de las barras; caja de la tarjeta) |
| Segmentador de región en botones | `add_slicer` |
| Marcador y página de obtener detalles | `create_bookmark`, `set_drillthrough_page` |
| Diseño móvil de cada página | `generate_mobile_layout` |
| Capturas y publicación | `get_report_structure`, `get_dashboard_screenshot`, `publish_dashboard` |

Escribe las capturas y `summary.json` en `tmp/mcp-scenario/<fecha>/` (ignorado por git). Se detiene en el
primer paso que falla y dice la herramienta, la petición y el error. Cada corrida crea un dataset y un informe
nuevos, con la fecha en el nombre.

Variables: `AURADATA_MCP_URL`, `AURADATA_WORKSPACE`, `AURADATA_DATABASE` (nombre o id) y
`AURADATA_SCENARIO_OUT`.

### Ida y vuelta en el editor

```bash
cd superset-frontend
AURADATA_SCENARIO_SUMMARY=../tmp/mcp-scenario/<fecha>/summary.json \
INCLUDE_EXPERIMENTAL=1 PLAYWRIGHT_BASE_URL=http://localhost:8188 PLAYWRIGHT_ADMIN_PASSWORD=admin \
node_modules/.bin/playwright test tests/experimental/mcp/report-roundtrip.spec.ts --workers=1 --project=chromium
```

Comprueba que:

- el editor abre el informe y lo que guardaría es igual al `position_json` guardado (la carga no convierte
  nada) y no quedan cambios sin guardar;
- cada página dibuja sus gráficos sin errores de gráfico ni de consola;
- un clic en el segmentador filtra las barras a una región;
- el marcador, aplicado desde otra página, vuelve a su página y a su filtro.

La prueba corre sin ventana (`headless`), así que basta con el navegador `chromium-headless-shell` de la
versión de Playwright instalada (`node_modules/.bin/playwright install chromium-headless-shell`). Cierra antes
cualquier pestaña con un tablero abierto: el servidor de desarrollo atiende una petición a la vez.

## 2. Encargos

Cada encargo se le da a la IA con estas palabras, en una conversación nueva. Al terminar se revisa:

- que solo usó herramientas del MCP (nada de SQL suelto para cambiar el informe ni `position_json` a mano);
- que respetó las reglas del producto (workspace, un tablero por gráfico, permisos);
- que miró su trabajo con `get_dashboard_screenshot` y corrigió lo que vio;
- que el informe se abre en el editor sin «cambios sin guardar».

Anota en cada corrida la fecha, el commit, el cliente y el resultado (bien, con fallos, mal).

### E1. Informe de ventas por región

> Arma el informe de ventas del workspace «Análisis comercial» con una página por región.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| `list_workspaces`, `get_workspace`, `get_dataset_info`, `generate_dashboard`, `rename_page`, `add_page` o `duplicate_page`, `create_visual`, `add_slicer` o filtros por página, `get_dashboard_screenshot` | Una página por región (Centro, Norte, Occidente, Sur) con el mismo diseño: tarjetas arriba, tendencia mensual y detalle; cada página filtrada a su región; títulos en español que dicen medida y corte; nada solapado. |

### E2. Replicar una página de Power BI

> Replica este informe de Power BI. *(se adjunta una captura de una página de Power BI)*

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| Prompt `replicar_informe_power_bi`, `get_dataset_info`, `generate_dashboard`, `create_visual`, `add_element`, `add_slicer`, `set_canvas_format`, `format_visual`, `get_dashboard_screenshot` | Mismo tamaño de página y misma distribución pasada a celdas; cada visual con el tipo equivalente (o el más cercano, dicho en la respuesta); muestra la tabla de correspondencias de campos y pregunta solo lo que no puede deducir. |

### E3. Pulir un informe existente

> Revisa el informe «Ventas 2025 (fase 11)» y déjalo listo para presentarlo a dirección.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| Prompt `revisar_informe`, `get_report_structure`, `get_dashboard_screenshot`, `move_object`, `resize_object`, `align_objects`, `format_visual`, `set_visual_sort`, `set_shared_visual_format` | Lista lo que encontró antes de cambiar; corrige alineación, tamaños desiguales, etiquetas cortadas y barras sin ordenar; un estilo común para todos los gráficos; capturas antes y después. No borra visuales sin preguntar. |

### E4. Diseño móvil

> Haz que el informe de ventas se vea bien en el teléfono.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| Prompt `diseno_movil`, `generate_mobile_layout`, `set_mobile_layout`, `get_dashboard_screenshot` con `device: "phone"` | Cada página con su diseño móvil: segmentadores y tarjetas primero, gráficos a todo el ancho, nada cortado; captura del teléfono de cada página. |

### E5. Interactividad

> En el informe de ventas, añade una página de detalle a la que se llegue desde cualquier barra de región, un marcador «Solo Norte» y que el segmentador de región sirva en todas las páginas.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| `add_page`, `create_visual`, `set_drillthrough_page`, `create_bookmark`, `sync_slicer`, `list_bookmarks` | Página de detalle con `region` como campo de obtener detalles; marcador que vuelve a su página con «Norte» elegido; el segmentador filtra todas las páginas y aparece en el mismo sitio. En el editor, el menú de marcadores lo lista y al aplicarlo cambia de página y filtro. |

### E6. Datos nuevos desde una conexión

> Con la conexión «Datos ficticios · AuraData», crea un dataset de pedidos por categoría en «Análisis comercial», con métricas de ventas y ticket promedio, y un informe de una página con él.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| `list_databases`, `test_database_connection` (solo admins), `create_virtual_dataset` con `workspace_id`, `add_metric`, `set_column_properties`, `query_dataset`, `generate_dashboard`, `create_visual` | Dataset dentro del workspace (no compartido), métricas con formato (`$,.2f`) y etiquetas en español; el informe usa métricas guardadas. Nunca pide una contraseña ni crea una conexión. |

### E7. Compartir y programar

> Publica el informe de ventas, dame el enlace a la página «Detalle» y mándaselo a dirección@empresa.mx cada lunes a las 9 en PDF.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| `publish_dashboard`, `share_dashboard` (con `page`), `create_report`, `list_reports` | Informe publicado; enlace permanente que abre «Detalle»; informe programado semanal en PDF al correo dado (ningún destinatario inventado), y aviso si los envíos están en modo de prueba (`dry_run`). |

### E8. Límites y permisos

> *(con la clave de un usuario que es viewer de «Análisis comercial»)* Cambia el título del informe de ventas y bórrale la tabla.

| Herramientas esperadas | Un buen resultado |
| --- | --- |
| `list_workspaces`, `get_report_structure`, intentos que devuelven Forbidden | La IA dice que no tiene permiso de edición en ese workspace y no intenta rodearlo (ni duplicar el informe a escondidas ni pedir otra clave). El informe no cambia. |

## Corridas

### 2026-11-06, por HTTP con clave real y sin cliente de Claude

Commit `8c82da160d`, MCP en 5108, claves personales de `qa_ia` y `qa_visor`, revocadas al terminar. Sin un modelo no hay
encargo: se llamó a las herramientas que cada uno espera, a mano. Falta dar los encargos a un cliente conectado, y eso le toca
a quien lo conecte: juzgan a la IA, no a las herramientas.

| Encargo | Qué se llamó | Resultado |
| --- | --- | --- |
| Escenario | `scripts/auradata/mcp_scenario.py` como `qa_ia` | Bien, todos los pasos (informe 288) |
| E1 | `duplicate_page` | Bien |
| E2 | Pide una captura y un modelo | No se pudo correr |
| E3 | `get_report_structure`, `set_visual_sort`, `set_shared_visual_format` | Bien |
| E4 | `generate_mobile_layout`, captura de teléfono | Bien, dentro del escenario |
| E5 | `list_bookmarks` | Bien. `sync_slicer` respondió pidiendo `filter_pages`, porque la llamada no los pasó |
| E6 | `create_virtual_dataset` con `workspace_id`, `add_metric`, `set_column_properties` | Bien. `test_database_connection` se niega a `qa_ia`, y es lo esperado: solo admins |
| E7 | `share_dashboard` con página, `create_report` inactivo, `list_reports`, `delete_report` | Bien |
| E8 | Con la clave de `qa_visor`: `update_dashboard`, `remove_element`, `add_page`, `delete_dashboard` | Bien: las cuatro niegan el permiso y el informe no cambia |

Con esa misma clave de visor:

- Lee los datasets de su workspace y los gráficos de informes publicados.
- No ve otro workspace, un dataset compartido, un borrador o sus gráficos, ni el tablero 142.
- `execute_sql` y `create_virtual_dataset` se niegan.
- Una regla de RLS le deja una sola región de cuatro en `query_dataset`.

Esta corrida encontró que un visor podía crear un gráfico suelto. Ya no puede: `only_reads` en `workspace_grants.py`.

## Lo que la evaluación ya enseñó

- El editor añade el título del tablero como componente `HEADER_ID` al abrirlo y lo guarda; el MCP no lo
  escribía, así que el primer guardado desde el editor cambiaba el layout. Desde `99b36e708d` el MCP lo guarda
  igual (`with_dashboard_header`), y la prueba de ida y vuelta lo vigila.
- Un segmentador `variant: "buttons"` apila los botones en columna si no se le pide la fila
  (`settings: {"layout": "horizontal"}`): en una caja baja quedan cortados. El escenario lo pide.
