# Arquitectura de AuraData BI para desarrolladores

AuraData BI es un fork de Apache Superset 7.0. Las reglas del producto (qué hace y qué no) están en el `AGENTS.md`
de la raíz, sección «AuraData BI: What This Fork Changes»: es la fuente de verdad, y este documento no las repite.
Aquí está cómo encajan las piezas que más se tocan: la biblioteca de layout en Python, el catálogo de formato, el
MCP y el historial de versiones, y cómo se prueba todo sin tumbar la máquina.

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

Para correr `test_reference_doc.py` en ese contenedor, copia antes el archivo a `/app/docs/auradata/mcp/`.

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

**Durante el día**, con el stack levantado (app en 8188, MCP en 5108):

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
