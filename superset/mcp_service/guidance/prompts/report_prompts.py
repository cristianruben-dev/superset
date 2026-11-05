# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Guided prompts to build, copy, review and adapt AuraData BI reports.

Each prompt carries the key conventions inline (many clients never let the
model read a resource on its own) and names the tools step by step. The text is
Spanish, the product's first language; the AI answers and titles the report in
the user's language.
"""

from __future__ import annotations

from superset_core.mcp.decorators import prompt

from superset.mcp_service.guidance import content


def _language_line(idioma: str) -> str:
    code = (idioma or "").strip().lower() or content.default_language()
    if code.startswith("es"):
        return (
            "Idioma: escribe títulos, nombres de página, etiquetas y respuestas en "
            "español (tú informal, comillas «»), salvo que el usuario escriba en "
            "otro idioma: entonces usa el suyo."
        )
    return (
        f"Language: write every title, page name, label and reply in "
        f"{content.language_name(code)}, or in the language the user writes in."
    )


def _rules(idioma: str) -> str:
    """The conventions every prompt repeats, so the model has them at hand."""
    return f"""**Reglas de AuraData BI**
- {_language_line(idioma)}
- Actúas como el dueño de la clave de API: solo ves y cambias lo que esa persona
  puede en la web. Si una herramienta no aparece o devuelve Forbidden, díselo y
  no lo rodees.
- Las contraseñas de bases de datos nunca pasan por el chat: las conexiones se
  crean en la web (página Conexiones). No las pidas.
- Un informe es un tablero con páginas de tamaño fijo (16:9 = 60 × 34 celdas de
  32 px). Todas las posiciones y tamaños van en celdas desde la esquina superior
  izquierda. Deja 1 celda de margen y 2 celdas entre objetos.
- Página tipo de 16:9 (x, y, ancho, alto): título (1, 1, 32, 2); segmentadores
  (35, 1, 11, 2) y (48, 1, 11, 2); tarjetas (1, 5, 13, 5), (16, 5, 13, 5),
  (31, 5, 13, 5), (46, 5, 13, 5); gráfico principal (1, 12, 28, 10); segundo
  gráfico (31, 12, 28, 10); detalle (1, 24, 58, 9).
- Una idea por página, de 6 a 8 visuales como máximo; tarjetas arriba, del
  resumen al detalle; segmentadores en el mismo sitio en cada página.
- Línea para tiempo, barras ordenadas para comparar, tarjeta para un número,
  tabla para detalle, dona solo con 2 a 5 partes.
- Títulos que dicen la medida y el corte («Ventas por región»), con la unidad si
  no es obvia; nunca nombres crudos de columnas.
- Formatos: SMART_NUMBER en tarjetas y ejes, `$,.2f` para dinero, `.1%` para
  porcentajes, el mismo formato para la misma medida en todo el informe.
- Colores: paleta «auradata» (Azul Aura #2563EB primero, violeta #7C3AED, verde
  #10B981); fondo blanco; el degradado solo como acento de un título.
- Todas las herramientas reciben sus campos dentro de `request={{...}}`. Si tu
  cliente solo muestra `search_tools` y `call_tool`, busca cada herramienta por
  su nombre con `search_tools` y ejecútala con `call_tool` (nombre y
  argumentos). Nunca inventes URLs: usa las que devuelven las herramientas.
- Nombra las páginas por su nombre o su índice (1, 2…): el id de la primera
  página cambia cuando el informe pasa a tener pestañas.
- Detalle completo: recursos `auradata://report-conventions`, `auradata://brand`
  y `auradata://format-catalog`."""


def _report(dashboard: str) -> str:
    if dashboard:
        return f"el informe «{dashboard}»"
    return "el informe que indique el usuario"


_LOOK_AND_FIX = (
    'Mira y corrige: `get_dashboard_screenshot(request={"dashboard": <id>, '
    '"page": <página>})` de cada página. Busca solapes, etiquetas cortadas, '
    "gráficos vacíos o con error, tamaños desiguales en una fila y huecos sin "
    "sentido. Corrige con `move_object`, `resize_object`, `align_objects`, "
    "`distribute_objects`, `format_visual` o `set_visual_fields`, y vuelve a "
    "capturar hasta que la página se vea limpia."
)


@prompt(
    "informe_desde_dataset",
    title="Informe desde un dataset",
    description="Build a complete AuraData BI report from one dataset, step by "
    "step, in AuraData BI's style.",
)
async def informe_desde_dataset(
    dataset: str = "",
    workspace: str = "",
    tema: str = "",
    idioma: str = "",
) -> str:
    """Build a complete report from one dataset.

    Args:
        dataset: Dataset id or name; empty to choose one with the user
        workspace: Workspace id or name for the report; empty to choose one
        tema: What the report should answer, e.g. "ventas por región"
        idioma: Language code for titles and replies; empty for the default
    """
    dataset_line = f"del dataset «{dataset}»" if dataset else "de un dataset"
    workspace_line = f"del workspace «{workspace}»" if workspace else "de un workspace"
    topic_line = f"\nTema del informe: {tema}." if tema else ""
    return f"""Arma un informe de AuraData BI a partir {dataset_line}, dentro
{workspace_line}.{topic_line}

{_rules(idioma)}

**Pasos**
1. Workspace: `list_workspaces(request={{}})`. Usa el indicado o pregunta cuál;
   necesitas ser contributor o admin. Si no hay ninguno adecuado, ofrece
   `create_workspace`.
2. Dataset: `get_workspace(request={{"workspace_id": <id>}})` lista sus
   datasets; `get_dataset_info(request={{"identifier": <id>}})` da columnas,
   métricas y etiquetas. Si faltan métricas o etiquetas y eres editor del
   dataset, usa `add_metric` y `set_column_properties` (una métrica no puede
   usar una columna calculada por su nombre: escribe la expresión completa).
   `query_dataset` te deja ver los datos antes de graficar.
3. Plan: propón en dos o tres líneas las páginas (por ejemplo «Resumen» y
   «Detalle») y qué responde cada visual. Si el usuario no pidió otra cosa,
   sigue sin esperar.
4. Informe vacío: `generate_dashboard(request={{"chart_ids": [],
   "workspace_id": <id>, "dashboard_title": "<título>"}})`. Guarda el id
   que devuelve (`dashboard.id`).
   `get_report_structure(request={{"dashboard": <id>}})` da sus páginas;
   renombra la primera con `rename_page` (`"page": 1`) y añade las demás con
   `add_page`.
5. Título de la página: `add_element(request={{"dashboard": <id>, "page":
   <página>, "kind": "text", "x": 1, "y": 1, "width": 32, "height": 2,
   "settings": {{"html": "<b>Título</b>", "textStyle": {{"size": 24,
   "weight": 600}}}}}})`.
6. Visuales: para cada uno, `get_chart_type_schema(chart_type=...)` si dudas de
   la forma de `config`, y luego `create_visual(request={{"dashboard": <id>,
   "page": <página>, "dataset_id": <id>, "config": {{...}}, "chart_name":
   "<título>", "x": .., "y": .., "width": .., "height": ..}})` con las cajas de
   la página tipo (con 3 tarjetas: ancho 18 en x = 1, 21 y 41). Tarjetas con
   `chart_type: "big_number"`, tendencia con `xy` y `kind: "line"`, comparación
   con `xy` y `kind: "bar"` ordenada con `set_visual_sort`, detalle con
   `table`. Usa métricas guardadas (`{{"name": "<métrica>", "saved_metric":
   true}}`) para que el formato y la etiqueta salgan de la métrica.
7. Segmentadores: `add_slicer(request={{"dashboard": <id>, "page": <página>,
   "name": "<Nombre>", "filter_type": "list", "dataset_id": <id>, "column":
   "<columna>", "x": 35, "y": 1, "width": 11, "height": 2}})`; uno de fechas
   con `filter_type: "time"`. Con varias páginas, `sync_slicer` los comparte.
8. Formato: `get_format_options(request={{"viz_type": "<viz_type>", "level":
   "visual"}})` y `format_visual` para lo que cambie; `set_shared_visual_format`
   para un estilo común (borde, radio, sombra) en todos los gráficos.
9. {_LOOK_AND_FIX}
10. Cierre: pregunta si quiere publicarlo (`publish_dashboard`), compartirlo
    (`share_dashboard`) o programar su envío (`create_report`). Da el enlace
    que devuelve la herramienta y resume qué hay en cada página."""


@prompt(
    "replicar_informe_power_bi",
    title="Replicar un informe de Power BI desde una captura",
    description="Rebuild a Power BI report page from a screenshot the user "
    "attaches, mapping its layout to AuraData BI's cell grid.",
)
async def replicar_informe_power_bi(
    dashboard: str = "",
    workspace: str = "",
    idioma: str = "",
) -> str:
    """Rebuild a Power BI page from an attached screenshot.

    Args:
        dashboard: An existing report to add the page to; empty for a new one
        workspace: Workspace id or name for a new report
        idioma: Language code for titles and replies; empty for the default
    """
    target = (
        f"en el informe «{dashboard}» (una página nueva con `add_page`)"
        if dashboard
        else "en un informe nuevo"
        + (f" del workspace «{workspace}»" if workspace else "")
    )
    return f"""El usuario adjuntó una captura de un informe de Power BI. Replícalo
{target} con AuraData BI. Si no ves ninguna imagen en la conversación, pídela
antes de seguir.

{_rules(idioma)}

**Pasos**
1. Lee la captura: tamaño de página (normalmente 1280 × 720, 16:9), cada visual
   con su tipo, título, campos que muestra y caja aproximada en píxeles, los
   segmentadores, las tarjetas, los textos y los colores.
2. Pasa cada caja a celdas de una página de 60 × 34: `x = round(px_x / ancho_px
   × 60)`, `y = round(px_y / alto_px × 34)`, y lo mismo con ancho y alto.
   Ajusta para que no se solapen, con 1 celda de margen y 2 entre objetos.
   Mínimo de un gráfico: 4 × 3 celdas.
3. Tipos: tarjeta → `big_number`; gráfico de líneas → `xy` `kind: "line"`;
   barras o columnas → `xy` `kind: "bar"`; área → `xy` `kind: "area"`; anillo o
   circular → `pie` (`donut: true` para anillo); tabla → `table`; matriz →
   `pivot_table`; medidor → `gauge`; cascada → `waterfall`; combinado →
   `mixed_timeseries`. Si algo no tiene equivalente, usa el más cercano y dilo.
4. Datos: busca el dataset con `list_workspaces`, `get_workspace` y
   `get_dataset_info`, y empareja cada campo de la captura con una columna o
   métrica por su etiqueta. Muestra la tabla de correspondencias y pregunta solo
   por lo que no encaje.
5. Informe: `generate_dashboard(request={{"chart_ids": [], "workspace_id": <id>,
   "dashboard_title": "<título de la captura>"}})` o, en uno existente,
   `add_page`. Luego `get_report_structure` para el id de la página.
6. Construye en orden de lectura: textos y título (`add_element` con `kind:
   "text"`), formas o imágenes de fondo si las hay (`add_element` con `kind:
   "shape"`), tarjetas, gráficos con `create_visual` en sus celdas, y
   segmentadores con `add_slicer` (lista desplegable, botones o fecha, según
   la captura: campo `variant`).
7. Aspecto: si la captura tiene un color de fondo o de cabecera propio, usa
   `set_canvas_format` y `format_visual`/`format_element` (consulta las claves
   con `get_format_options`). Respeta los colores de las series de la captura
   solo si el usuario lo pide; si no, paleta «auradata».
8. {_LOOK_AND_FIX} Compara la captura de
   AuraData BI con la original y corrige posiciones hasta que la distribución
   coincida.
9. Cierra con el enlace del informe y una lista de lo que no se pudo replicar
   igual (por ejemplo visuales personalizados de Power BI)."""


@prompt(
    "revisar_informe",
    title="Revisar y pulir un informe",
    description="Look at every page of a report, critique it against AuraData "
    "BI's conventions and fix what is off.",
)
async def revisar_informe(dashboard: str = "", idioma: str = "") -> str:
    """Review and polish an existing report.

    Args:
        dashboard: Report id, slug or title; empty to ask the user
        idioma: Language code for titles and replies; empty for the default
    """
    target = _report(dashboard)
    return f"""Revisa y pule {target} de AuraData BI.

{_rules(idioma)}

**Pasos**
1. Encuentra el informe (`list_dashboards(request={{"search": "..."}})` si solo
   tienes el nombre) y lee `get_report_structure(request={{"dashboard": <id>}})`:
   páginas, objetos con sus celdas, formatos y filtros.
2. Captura cada página visible con `get_dashboard_screenshot`.
3. Crítica, página por página, contra las reglas de arriba: márgenes y huecos,
   alineación y tamaños iguales por fila, orden de lectura (tarjetas arriba,
   detalle abajo), una idea por página, número de visuales, tipo de gráfico
   adecuado, títulos y etiquetas en el idioma del usuario, formatos de número
   coherentes, colores de la paleta, gráficos vacíos o con error, segmentadores
   en el mismo sitio en todas las páginas.
4. Presenta la crítica en una lista corta ordenada por impacto y aplica las
   correcciones sin pedir permiso para cada una, salvo borrar visuales o
   páginas: eso pregúntalo antes.
5. Corrige con `move_object`, `resize_object`, `align_objects`,
   `distribute_objects`, `format_visual`, `set_shared_visual_format`,
   `copy_format`, `rename_page`, `set_visual_fields`, `set_visual_sort` y
   `sync_slicer`. Cada cambio queda en el historial (`list_versions`,
   `restore_version` lo deshace).
6. Vuelve a capturar cada página que cambiaste y resume qué corregiste y qué
   queda (por ejemplo datos que faltan en el dataset)."""


@prompt(
    "diseno_movil",
    title="Diseño móvil de este informe",
    description="Give each page of a report a phone layout: cards and slicers "
    "first, charts stacked, checked on a phone screenshot.",
)
async def diseno_movil(dashboard: str = "", idioma: str = "") -> str:
    """Create the mobile layout of a report's pages.

    Args:
        dashboard: Report id, slug or title; empty to ask the user
        idioma: Language code for titles and replies; empty for the default
    """
    target = _report(dashboard)
    return f"""Haz el diseño móvil de {target} de AuraData BI.

{_rules(idioma)}

**Diseño móvil**
- Cada página puede tener un diseño de teléfono: cajas de sus propios objetos
  en una página de 12 celdas de ancho, de arriba abajo. Sin diseño, el teléfono
  muestra la página entera a escala, casi siempre ilegible.
- Orden: título, tarjetas (dos por fila, 6 × 4), segmentadores (12 de ancho),
  gráficos apilados a lo ancho (12 × 8 aprox.) y la tabla al final. Deja fuera
  lo decorativo (formas, imágenes de fondo).

**Pasos**
1. `get_report_structure(request={{"dashboard": <id>}})` para las páginas y sus
   objetos; las páginas ocultas y las tooltip no necesitan diseño móvil.
2. Para cada página: `generate_mobile_layout(request={{"dashboard": <id>,
   "page": <página>}})` propone el diseño sin guardarlo. Revísalo contra el
   orden de arriba.
3. Si te sirve, guárdalo con `apply: true`; si no, escribe las cajas con
   `set_mobile_layout` (ids de objeto de la estructura, x, y, ancho y alto en
   celdas del teléfono).
4. Mira cada página con `get_dashboard_screenshot(request={{"dashboard": <id>,
   "page": <página>, "device": "phone"}})`: textos legibles, nada cortado,
   tarjetas alineadas. Corrige y vuelve a capturar.
5. `clear_mobile_layout` quita el diseño de una página si el usuario lo pide.
6. Resume qué páginas tienen diseño móvil y qué objetos quedaron fuera."""
