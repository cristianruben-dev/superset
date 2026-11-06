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
"""
The tool reference of the MCP (``docs/auradata/mcp/referencia.md``), rendered
from the registry: every tool with its group, tags, permission, description and
parameters, plus the prompts and resources.

``scripts/auradata/mcp_reference.py`` writes it, and
``tests/unit_tests/mcp_service/test_reference_doc.py`` fails when the committed
file differs from what the registry renders. The output depends on nothing but
the registry: no dates, URLs or configuration.
"""

from __future__ import annotations

import asyncio
import inspect
import re
from typing import Any

from superset.mcp_service.auth import CLASS_PERMISSION_ATTR, METHOD_PERMISSION_ATTR
from superset.security.api_key_scopes import (
    METHOD_PERMISSION_SCOPE_ACTION,
    RESOURCE_SCOPE_NAME,
)
from superset.utils import json

REFERENCE_FILE = "docs/auradata/mcp/referencia.md"

# Groups of tools by the module that defines them, the most specific first.
_PAGES = "Informe: estructura, páginas y objetos"
_GROUPS: list[tuple[str, str]] = [
    ("workspace.", "Workspaces y miembros"),
    ("report_layout.tool.get_report_structure", _PAGES),
    ("report_layout.tool.page_tools", _PAGES),
    ("report_layout.tool.object_tools", _PAGES),
    ("report_layout.tool.visual_tools", "Informe: visuales"),
    ("report_layout.tool.format_tools", "Informe: formato"),
    ("report_layout.tool.element_tools", "Informe: elementos y segmentadores"),
    ("report_layout.tool.interactivity_tools", "Informe: interactividad"),
    ("report_layout.tool.mobile_tools", "Informe: diseño móvil"),
    ("screenshot.", "Capturas y exportación"),
    ("sharing.", "Publicar y compartir"),
    ("report.", "Informes y alertas programados"),
    ("history.", "Papelera e historial de versiones"),
    ("dashboard.", "Tableros (herramientas de Superset)"),
    ("chart.", "Gráficos (herramientas de Superset)"),
    ("dataset.", "Datasets y modelo de datos"),
    ("database.", "Conexiones"),
    ("sql_lab.", "SQL Lab y consultas"),
    ("query.", "SQL Lab y consultas"),
    ("saved_query.", "SQL Lab y consultas"),
    ("explore.", "Explore"),
    ("semantic_layer.", "Capa semántica"),
    ("user.", "Usuarios, roles y gobierno"),
    ("role.", "Usuarios, roles y gobierno"),
    ("rls.", "Usuarios, roles y gobierno"),
    ("tag.", "Usuarios, roles y gobierno"),
    ("task.", "Usuarios, roles y gobierno"),
    ("system.", "Sistema"),
]
_OTHER_GROUP = "Otras"

# Placeholders of the examples, by parameter name, then by type.
_EXAMPLE_VALUES: dict[str, Any] = {
    "dashboard": 1,
    "dashboard_id": 1,
    "chart_id": 1,
    "dataset_id": 1,
    "database_id": 1,
    "workspace": 1,
    "workspace_id": 1,
    "page": 1,
    "name": "Ventas",
    "title": "Ventas",
}

_HEADER = """\
# Referencia del MCP de AuraData BI

> Archivo generado desde el registro del MCP con
> `scripts/auradata/mcp_reference.py`: no lo edites a mano.
> `tests/unit_tests/mcp_service/test_reference_doc.py` falla si queda viejo.

Cada herramienta lista su grupo, sus etiquetas, el permiso que pide y el scope
de una clave de «Conectar IA» que la deja usarla. Las descripciones y los
parámetros salen tal cual del código, en inglés, el idioma en que la IA los
lee. Las reglas de AuraData BI que aplica cada herramienta (un tablero por
gráfico, datasets del workspace, quién edita) están en su descripción.

Todas las herramientas reciben sus parámetros dentro de un objeto `request`,
salvo las pocas que lo dicen en su ejemplo. La IA actúa como el dueño de la
clave: una herramienta nunca hace algo que esa persona no pueda hacer en la
web. Cómo conectar una IA: [conectar.md](conectar.md).
"""


def _group_of(module: str) -> str:
    name = module.removeprefix("superset.mcp_service.")
    for prefix, title in _GROUPS:
        if name.startswith(prefix):
            return title
    return _OTHER_GROUP


def _anchor(text: str) -> str:
    """The anchor GitHub gives a heading."""
    slug = re.sub(r"[^\w\- ]", "", text.lower()).strip()
    return slug.replace(" ", "-")


def _cell(text: Any) -> str:
    """Text that fits in one cell of a Markdown table, with its <words> shown."""
    parts = " ".join(str(text).split()).split("`")
    # Outside code, a <word> would be read as an HTML tag and dropped
    for index in range(0, len(parts), 2):
        parts[index] = parts[index].replace("<", "&lt;")
    return "`".join(parts).replace("|", "\\|")


def _resolve(schema: dict[str, Any], defs: dict[str, Any]) -> dict[str, Any]:
    while "$ref" in schema:
        schema = defs.get(schema["$ref"].rsplit("/", 1)[-1], {})
    return schema


def _type_of(schema: dict[str, Any], defs: dict[str, Any]) -> str:
    if "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[-1]
        resolved = _resolve(schema, defs)
        if "enum" in resolved:
            return " | ".join(json.dumps(value) for value in resolved["enum"])
        return f"objeto `{name}`"
    if "enum" in schema:
        return " | ".join(json.dumps(value) for value in schema["enum"])
    if "const" in schema:
        return json.dumps(schema["const"])
    for key in ("anyOf", "oneOf"):
        if key in schema:
            options = [
                _type_of(option, defs)
                for option in schema[key]
                if option.get("type") != "null"
            ]
            return " o ".join(dict.fromkeys(options)) or "null"
    kind = schema.get("type")
    if kind == "array":
        items = schema.get("items") or {}
        return f"lista de {_type_of(items, defs)}" if items else "lista"
    if kind == "object":
        return "objeto"
    if isinstance(kind, list):
        return " o ".join(str(k) for k in kind if k != "null")
    return str(kind or "cualquiera")


def _example_value(name: str, schema: dict[str, Any], defs: dict[str, Any]) -> Any:
    if name in _EXAMPLE_VALUES:
        return _EXAMPLE_VALUES[name]
    schema = _resolve(schema, defs)
    if "enum" in schema:
        return schema["enum"][0]
    for key in ("anyOf", "oneOf"):
        if key in schema:
            options = [o for o in schema[key] if o.get("type") != "null"]
            if options:
                return _example_value(name, options[0], defs)
    kind = schema.get("type")
    if kind == "integer" or kind == "number":
        return 1
    if kind == "boolean":
        return True
    if kind == "array":
        return []
    if kind == "object":
        return {}
    return "…"


def _arguments(parameters: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """The schema whose fields the tool takes, and whether it is a request."""
    defs = parameters.get("$defs") or {}
    properties = parameters.get("properties") or {}
    if set(properties) == {"request"}:
        return {**_resolve(properties["request"], defs), "$defs": defs}, True
    return parameters, False


def _render_tool(tool: Any) -> list[str]:
    func = tool.fn
    class_name = getattr(func, CLASS_PERMISSION_ATTR, None)
    method = getattr(func, METHOD_PERMISSION_ATTR, None) or "read"
    action = METHOD_PERMISSION_SCOPE_ACTION.get(method, method)
    annotations = tool.annotations
    read_only = getattr(annotations, "readOnlyHint", None) if annotations else None
    mutates = read_only is False or "mutate" in (tool.tags or set())

    lines = [f"### `{tool.name}`", ""]
    title = getattr(annotations, "title", None) if annotations else None
    if title:
        lines += [f"*{title}*", ""]
    if class_name:
        scope = f"superset:{RESOURCE_SCOPE_NAME.get(class_name, class_name)}:{action}"
        kind = "escritura" if action == "write" else "lectura"
        permission = f"`{class_name}`, {kind}"
    else:
        scope = "superset:read"
        permission = "ninguna clase: la abre cualquier usuario"
    lines += [
        f"- **Permiso:** {permission}. Scope de la clave: `{scope}`.",
        f"- **Cambia datos:** {'sí' if mutates else 'no'}.",
    ]
    if tool.tags:
        lines.append(
            "- **Etiquetas:** " + ", ".join(f"`{tag}`" for tag in sorted(tool.tags))
        )
    lines.append("")
    if description := inspect.cleandoc(tool.description or ""):
        lines += [description, ""]

    schema, wrapped = _arguments(tool.parameters or {})
    defs = schema.get("$defs") or {}
    fields = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    if fields:
        lines += [
            "| Parámetro | Tipo | Obligatorio | Por defecto | Descripción |",
            "| --- | --- | :---: | --- | --- |",
        ]
        for name, field in fields.items():
            default = (
                f"`{json.dumps(field['default'])}`"
                if field.get("default") is not None
                else ""
            )
            lines.append(
                f"| `{name}` | {_cell(_type_of(field, defs))} | "
                f"{'sí' if name in required else ''} | {_cell(default)} | "
                f"{_cell(field.get('description', ''))} |"
            )
        lines.append("")
    example = {
        name: _example_value(name, fields[name], defs)
        for name in fields
        if name in required
    }
    call = {"request": example} if wrapped else example
    lines += [
        "Ejemplo:",
        "",
        "```json",
        json.dumps(call, ensure_ascii=False, sort_keys=False),
        "```",
        "",
    ]
    return lines


def _prompt_argument(description: str | None) -> str:
    # FastMCP appends how to send the value; the first paragraph says what it is
    return _cell((description or "").split("\n\n")[0])


def render(tools: list[Any], prompts: list[Any], resources: list[Any]) -> str:
    """The reference of these tools, prompts and resources, as Markdown."""
    grouped: dict[str, list[Any]] = {}
    for tool in tools:
        grouped.setdefault(_group_of(tool.fn.__module__), []).append(tool)
    order = list(dict.fromkeys(title for _, title in _GROUPS)) + [_OTHER_GROUP]
    groups = [title for title in order if title in grouped]

    lines = [_HEADER]
    lines += [
        f"{len(tools)} herramientas, {len(prompts)} prompts y "
        f"{len(resources)} recursos.",
        "",
        "## Índice",
        "",
    ]
    for title in groups:
        names = ", ".join(
            f"[`{tool.name}`](#{_anchor(tool.name)})"
            for tool in sorted(grouped[title], key=lambda t: t.name)
        )
        lines.append(f"- **{title}:** {names}")
    lines += [
        "- **Prompts:** "
        + ", ".join(f"`{p.name}`" for p in sorted(prompts, key=lambda p: p.name)),
        "- **Recursos:** "
        + ", ".join(f"`{r.uri}`" for r in sorted(resources, key=lambda r: str(r.uri))),
        "",
    ]
    for title in groups:
        lines += [f"## {title}", ""]
        for tool in sorted(grouped[title], key=lambda t: t.name):
            lines += _render_tool(tool)

    lines += [
        "## Prompts",
        "",
        "Encargos guiados que el cliente ofrece al usuario (en Claude, el menú «/»).",
        "",
    ]
    for prompt in sorted(prompts, key=lambda p: p.name):
        lines += [f"### `{prompt.name}`", ""]
        if prompt.title and prompt.title != f"{prompt.name}_prompt":
            lines += [f"*{prompt.title}*", ""]
        lines += [inspect.cleandoc(prompt.description or ""), ""]
        if prompt.arguments:
            lines += [
                "| Argumento | Obligatorio | Descripción |",
                "| --- | :---: | --- |",
            ]
            for argument in prompt.arguments:
                lines.append(
                    f"| `{argument.name}` | {'sí' if argument.required else ''} | "
                    f"{_prompt_argument(argument.description)} |"
                )
            lines.append("")

    lines += [
        "## Recursos",
        "",
        "Textos que la IA lee cuando los necesita, por su URI.",
        "",
    ]
    for resource in sorted(resources, key=lambda r: str(r.uri)):
        lines += [
            f"### `{resource.uri}`",
            "",
            inspect.cleandoc(resource.description or ""),
            "",
        ]
    return "\n".join(lines).rstrip("\n") + "\n"


def render_reference() -> str:
    """The reference of every tool, prompt and resource the MCP registers."""
    from superset.mcp_service.app import mcp

    async def collect() -> tuple[list[Any], list[Any], list[Any]]:
        return (
            list(await mcp.list_tools()),
            list(await mcp.list_prompts()),
            list(await mcp.list_resources()),
        )

    return render(*asyncio.run(collect()))
