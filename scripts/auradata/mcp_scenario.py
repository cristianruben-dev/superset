#!/usr/bin/env python3
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
# ruff: noqa: S310, T201, E501
"""
End to end scenario of the AuraData BI MCP: builds a whole report only through
the MCP, over HTTP, as an AI client would, and saves a screenshot of each page
and the phone view plus a JSON summary.

    AURADATA_MCP_KEY=sst_... python3 scripts/auradata/mcp_scenario.py

Environment:
    AURADATA_MCP_KEY        personal API key (required, never printed)
    AURADATA_MCP_URL        MCP endpoint (default http://localhost:5108/mcp)
    AURADATA_WORKSPACE      workspace name or id (default «Análisis comercial»)
    AURADATA_DATABASE       database name or id (default «Datos ficticios · AuraData»)
    AURADATA_SCENARIO_OUT   output folder (default tmp/mcp-scenario/<timestamp>)

The summary (`summary.json`) is what the Playwright round trip spec reads
(`AURADATA_SCENARIO_SUMMARY`). The run stops at the first step that fails,
says which tool and request failed, writes the partial summary and exits 1.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

MCP_URL = os.environ.get("AURADATA_MCP_URL", "http://localhost:5108/mcp")
WORKSPACE = os.environ.get("AURADATA_WORKSPACE", "Análisis comercial")
DATABASE = os.environ.get("AURADATA_DATABASE", "Datos ficticios · AuraData")
STAMP = time.strftime("%Y%m%d-%H%M%S")
OUT = Path(
    os.environ.get("AURADATA_SCENARIO_OUT")
    or Path(__file__).resolve().parents[2] / "tmp" / "mcp-scenario" / STAMP
)

# Twelve months, four regions and three categories, generated in the query, so
# the scenario needs no table and no personal data
SALES_SQL = """
SELECT make_date(2025, mes, 1) AS fecha, region, categoria,
       ((113000 + mes * 6800 + (mes * mes % 9) * 5400) * factor * peso)::int AS ventas,
       ((15 + mes * 2) * factor * peso)::int AS pedidos
FROM generate_series(1, 12) AS mes
CROSS JOIN (VALUES ('Centro', 1.2), ('Norte', 1.48), ('Occidente', 0.96), ('Sur', 0.74)) AS r(region, factor)
CROSS JOIN (VALUES ('Hogar', 1.1), ('Oficina', 0.65), ('Tecnología', 1.4)) AS c(categoria, peso)
"""

SLICER_COLUMN = "region"
SLICER_VALUE = "Norte"


class StepError(Exception):
    """A step of the scenario failed."""


class Mcp:
    """A minimal streamable HTTP MCP client (JSON-RPC over POST)."""

    def __init__(self, url: str, key: str) -> None:
        self.url = url
        self._key = key
        self.session: str | None = None
        self._id = 0

    def _post(self, body: dict[str, Any]) -> Any:
        req = urllib.request.Request(
            self.url, data=json.dumps(body).encode(), method="POST"
        )
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json, text/event-stream")
        req.add_header("Authorization", f"Bearer {self._key}")
        if self.session:
            req.add_header("mcp-session-id", self.session)
        try:
            with urllib.request.urlopen(req, timeout=300) as res:
                self.session = res.headers.get("mcp-session-id") or self.session
                raw = res.read().decode()
        except urllib.error.HTTPError as err:
            raise StepError(f"HTTP {err.code}: {err.read()[:500]!r}") from None
        except urllib.error.URLError as err:
            raise StepError(f"{self.url} unreachable: {err.reason}") from None
        if "id" not in body:
            return None
        if raw.lstrip().startswith("{"):
            return json.loads(raw)
        for line in raw.splitlines():
            if line.startswith("data:"):
                message = json.loads(line[5:])
                if message.get("id") == body["id"]:
                    return message
        raise StepError(f"No answer to request {body['id']}: {raw[:300]!r}")

    def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        self._id += 1
        body: dict[str, Any] = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            body["params"] = params
        answer = self._post(body)
        if "error" in answer:
            raise StepError(f"JSON-RPC error: {answer['error']}")
        return answer["result"]

    def initialize(self) -> dict[str, Any]:
        result = self.request(
            "initialize",
            {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "auradata-mcp-scenario", "version": "1"},
            },
        )
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return result

    def call(self, tool: str, arguments: dict[str, Any]) -> list[dict[str, Any]]:
        """Run a tool through `call_tool` (the server hides tools behind search)."""
        result = self.request(
            "tools/call",
            {"name": "call_tool", "arguments": {"name": tool, "arguments": arguments}},
        )
        content = result.get("content") or []
        if result.get("isError"):
            text = " ".join(c.get("text", "") for c in content)
            raise StepError(f"{tool} failed: {text[:1500]}")
        return content


def text_json(tool: str, content: list[dict[str, Any]]) -> dict[str, Any]:
    """The JSON answer of a tool, or a StepError when it reports one."""
    texts = [c["text"] for c in content if c.get("type") == "text"]
    if not texts:
        raise StepError(f"{tool} returned no text")
    try:
        data = json.loads(texts[0])
    except ValueError:
        raise StepError(f"{tool} returned no JSON: {texts[0][:500]}") from None
    if isinstance(data, dict) and (
        data.get("error") or data.get("error_type") or data.get("permission_denied")
    ):
        raise StepError(
            f"{tool}: {data.get('error_type')}: {data.get('error')}"
            + (" (permission denied)" if data.get("permission_denied") else "")
        )
    return data


class Scenario:
    def __init__(self, mcp: Mcp) -> None:
        self.mcp = mcp
        self.summary: dict[str, Any] = {
            "started": STAMP,
            "mcp_url": MCP_URL,
            "output": str(OUT),
            "steps": [],
            "screenshots": {},
        }

    def tool(self, step: str, tool: str, request: dict[str, Any]) -> dict[str, Any]:
        """Run one tool as one step; any failure stops the scenario."""
        started = time.time()
        print(f"· {step} ({tool})", flush=True)
        try:
            data = text_json(tool, self.mcp.call(tool, {"request": request}))
        except StepError as err:
            self.summary["failed"] = {
                "step": step,
                "tool": tool,
                "request": request,
                "error": str(err),
            }
            raise
        self.summary["steps"].append(
            {
                "step": step,
                "tool": tool,
                "seconds": round(time.time() - started, 2),
                "warnings": data.get("warnings") or [],
            }
        )
        return data

    def screenshot(self, step: str, name: str, request: dict[str, Any]) -> str:
        started = time.time()
        print(f"· {step} (get_dashboard_screenshot)", flush=True)
        try:
            content = self.mcp.call("get_dashboard_screenshot", {"request": request})
            images = [c for c in content if c.get("type") == "image"]
            if not images:
                text_json("get_dashboard_screenshot", content)
                raise StepError("get_dashboard_screenshot returned no image")
        except StepError as err:
            self.summary["failed"] = {
                "step": step,
                "tool": "get_dashboard_screenshot",
                "request": request,
                "error": str(err),
            }
            raise
        ext = "png" if images[0].get("mimeType") == "image/png" else "jpg"
        path = OUT / f"{name}.{ext}"
        path.write_bytes(base64.b64decode(images[0]["data"]))
        self.summary["screenshots"][name] = str(path)
        self.summary["steps"].append(
            {
                "step": step,
                "tool": "get_dashboard_screenshot",
                "seconds": round(time.time() - started, 2),
            }
        )
        return str(path)

    def run(self) -> None:  # noqa: C901
        info = self.mcp.initialize()
        self.summary["server"] = info.get("serverInfo")

        # 1. Workspace, chosen by name or id, never the first one at hand
        workspaces = self.tool("Pick the workspace", "list_workspaces", {})
        workspace = next(
            (
                w
                for w in workspaces.get("workspaces", [])
                if str(w["id"]) == WORKSPACE or w["name"] == WORKSPACE
            ),
            None,
        )
        if not workspace:
            raise self.fail("Pick the workspace", f"No workspace «{WORKSPACE}»")
        if not workspace.get("can_contribute"):
            raise self.fail(
                "Pick the workspace", f"Not a contributor of «{workspace['name']}»"
            )
        workspace_id = workspace["id"]
        self.summary["workspace"] = {"id": workspace_id, "name": workspace["name"]}

        # 2. Virtual dataset of the workspace, plus a metric
        databases = self.tool(
            "Pick the database", "list_databases", {"search": None, "page_size": 100}
        )
        database = next(
            (
                d
                for d in databases.get("databases", [])
                if str(d["id"]) == DATABASE or d.get("database_name") == DATABASE
            ),
            None,
        )
        if not database:
            raise self.fail("Pick the database", f"No database «{DATABASE}»")
        dataset = self.tool(
            "Create the virtual dataset",
            "create_virtual_dataset",
            {
                "database_id": database["id"],
                "sql": SALES_SQL,
                "dataset_name": f"escenario_mcp_{STAMP.replace('-', '_')}",
                "schema": "public",
                "description": "Ventas ficticias del escenario de punta a punta del MCP",
                "workspace_id": workspace_id,
            },
        )
        dataset_id = (
            dataset.get("id")
            or (dataset.get("dataset") or {}).get("id")
            or dataset.get("dataset_id")
        )
        if not dataset_id:
            raise self.fail(
                "Create the virtual dataset", f"No dataset id in {sorted(dataset)}"
            )
        self.summary["dataset_id"] = dataset_id
        for name, expression, label, d3format in (
            ("ventas_total", "SUM(ventas)", "Ventas", "$,.0f"),
            ("pedidos_total", "SUM(pedidos)", "Pedidos", ",d"),
        ):
            self.tool(
                f"Add the metric {name}",
                "add_metric",
                {
                    "dataset_id": dataset_id,
                    "metric_name": name,
                    "expression": expression,
                    "verbose_name": label,
                    "d3format": d3format,
                },
            )

        # 3. Empty report of two pages
        generated = self.tool(
            "Create the report",
            "generate_dashboard",
            {
                "chart_ids": [],
                "workspace_id": workspace_id,
                "dashboard_title": f"Ventas por región · escenario MCP {STAMP}",
                "published": False,
            },
        )
        dashboard_id = (generated.get("dashboard") or {}).get("id")
        if not dashboard_id:
            raise self.fail(
                "Create the report", f"No dashboard id in {sorted(generated)}"
            )
        self.summary["dashboard_id"] = dashboard_id
        self.summary["dashboard_url"] = (generated.get("dashboard") or {}).get("url")
        self.summary["dashboard_title"] = (generated.get("dashboard") or {}).get(
            "dashboard_title"
        )
        board = {"dashboard": dashboard_id}
        # Pages by name or index: the first page's id changes with tabs
        self.tool(
            "Rename page 1", "rename_page", {**board, "page": 1, "name": "Resumen"}
        )
        self.tool("Add the second page", "add_page", {**board, "name": "Detalle"})
        self.summary["pages"] = ["Resumen", "Detalle"]

        # 4. Canvas
        self.tool(
            "Format the canvas",
            "set_canvas_format",
            {
                **board,
                "size": {"mode": "16:9"},
                "background": {"type": "color", "color": "#F8FAFC"},
            },
        )

        # 5. Title text box
        title = self.tool(
            "Add the title",
            "add_element",
            {
                **board,
                "page": "Resumen",
                "kind": "text",
                "x": 1,
                "y": 1,
                "width": 32,
                "height": 2,
                "settings": {
                    "html": "<b>Ventas 2025 por región</b>",
                    "textStyle": {"size": 24, "weight": 600},
                },
            },
        )
        self.summary["title_object"] = title.get("object")

        # 6. Four visuals: card, bars and line on the summary, table on the detail
        metric = {"name": "ventas_total", "saved_metric": True}
        visuals = [
            (
                "card",
                "Resumen",
                "Ventas totales",
                {"chart_type": "big_number", "metric": metric},
                (1, 5, 18, 5),
            ),
            (
                "line",
                "Resumen",
                "Ventas por mes",
                {
                    "chart_type": "xy",
                    "kind": "line",
                    "x": {"name": "fecha"},
                    "y": [metric],
                    "time_grain": "P1M",
                },
                (1, 12, 28, 10),
            ),
            (
                "bars",
                "Resumen",
                "Ventas por región",
                {
                    "chart_type": "xy",
                    "kind": "bar",
                    "x": {"name": "region"},
                    "y": [metric],
                },
                (31, 12, 28, 10),
            ),
            (
                "table",
                "Detalle",
                "Detalle por región y categoría",
                {
                    "chart_type": "table",
                    "columns": [
                        {"name": "region"},
                        {"name": "categoria"},
                        metric,
                        {"name": "pedidos_total", "saved_metric": True},
                    ],
                },
                (1, 5, 58, 20),
            ),
        ]
        charts: dict[str, Any] = {}
        for key, page, name, config, (x, y, width, height) in visuals:
            made = self.tool(
                f"Create the {key} visual",
                "create_visual",
                {
                    **board,
                    "page": page,
                    "dataset_id": dataset_id,
                    "config": config,
                    "chart_name": name,
                    "x": x,
                    "y": y,
                    "width": width,
                    "height": height,
                },
            )
            if not made.get("chart_id") or not made.get("object_id"):
                raise self.fail(f"Create the {key} visual", f"No ids in {sorted(made)}")
            charts[key] = {
                "chart_id": made["chart_id"],
                "object": made["object_id"],
                "page": page,
                "name": name,
                "viz_type": made.get("viz_type"),
            }
        self.summary["charts"] = charts

        # 7. Format: labels on the bars, a box shared by the cards style
        self.tool(
            "Show values on the bars",
            "format_visual",
            {
                **board,
                "object": charts["bars"]["object"],
                "level": "visual",
                "patch": {"show_value": True},
            },
        )
        self.tool(
            "Give the card a box",
            "format_visual",
            {
                **board,
                "object": charts["card"]["object"],
                "level": "general",
                "patch": {
                    "background": "#FFFFFF",
                    "borderColor": "#E2E8F0",
                    "borderWidth": 1,
                    "radius": 8,
                },
            },
        )

        # 8. Slicer of regions, as buttons, for the whole report
        slicer = self.tool(
            "Add the region slicer",
            "add_slicer",
            {
                **board,
                "page": "Resumen",
                "name": "Región",
                "filter_type": "list",
                "variant": "buttons",
                "dataset_id": dataset_id,
                "column": SLICER_COLUMN,
                "scope": "report",
                # Buttons stack in a column unless the slicer is laid out in a row
                "settings": {"layout": "horizontal"},
                "x": 35,
                "y": 1,
                "width": 24,
                "height": 3,
            },
        )
        if not slicer.get("filter_id") or not slicer.get("object"):
            raise self.fail("Add the region slicer", f"No ids in {sorted(slicer)}")
        self.summary["slicer"] = {
            "object": slicer["object"],
            "filter_id": slicer["filter_id"],
            "column": SLICER_COLUMN,
            "value": SLICER_VALUE,
            "page": "Resumen",
        }

        # 9. Bookmark and drill through page
        bookmark = self.tool(
            "Add a bookmark",
            "create_bookmark",
            {
                **board,
                "name": f"Solo {SLICER_VALUE}",
                "page": "Resumen",
                "filters": {slicer["filter_id"]: [SLICER_VALUE]},
            },
        )
        mark = bookmark.get("bookmark") or {}
        if not mark.get("id"):
            raise self.fail("Add a bookmark", f"No bookmark in {sorted(bookmark)}")
        self.summary["bookmark"] = {
            "id": mark["id"],
            "name": mark.get("name"),
            "page": "Resumen",
            "filters": {slicer["filter_id"]: [SLICER_VALUE]},
        }
        self.tool(
            "Make Detalle a drill through page",
            "set_drillthrough_page",
            {**board, "page": "Detalle", "columns": [SLICER_COLUMN]},
        )
        self.summary["drillthrough"] = {"page": "Detalle", "columns": [SLICER_COLUMN]}

        # 10. Phone layout of each page
        mobile: dict[str, Any] = {}
        for page in self.summary["pages"]:
            proposal = self.tool(
                f"Mobile layout of {page}",
                "generate_mobile_layout",
                {**board, "page": page, "apply": True},
            )
            if not proposal.get("applied"):
                raise self.fail(f"Mobile layout of {page}", "The layout was not saved")
            mobile[page] = {
                "items": len(proposal.get("items") or []),
                "left_out": proposal.get("left_out") or [],
            }
        self.summary["mobile"] = mobile

        # 11. Look at it
        self.summary["structure"] = self.tool(
            "Read the structure", "get_report_structure", board
        )
        for index, page in enumerate(self.summary["pages"], start=1):
            self.screenshot(
                f"Screenshot of {page}",
                f"page-{index}-{page.lower()}",
                {**board, "page": page},
            )
        self.screenshot(
            "Phone screenshot of Resumen",
            "phone-1-resumen",
            {**board, "page": "Resumen", "device": "phone"},
        )

        # 12. Publish
        published = self.tool(
            "Publish the report", "publish_dashboard", {**board, "published": True}
        )
        self.summary["published"] = bool(
            (published.get("dashboard") or published).get("published", True)
        )

    def fail(self, step: str, message: str) -> StepError:
        self.summary["failed"] = {"step": step, "error": message}
        return StepError(f"{step}: {message}")


def main() -> int:
    key = os.environ.get("AURADATA_MCP_KEY", "").strip()
    if not key:
        print("Set AURADATA_MCP_KEY to a personal API key (sst_…)", file=sys.stderr)
        return 2
    OUT.mkdir(parents=True, exist_ok=True)
    scenario = Scenario(Mcp(MCP_URL, key))
    code = 0
    try:
        scenario.run()
        scenario.summary["ok"] = True
    except StepError as err:
        scenario.summary["ok"] = False
        print(f"\n✗ {err}", file=sys.stderr)
        failed = scenario.summary.get("failed") or {}
        if failed.get("request") is not None:
            print(
                f"  request: {json.dumps(failed['request'], ensure_ascii=False)[:2000]}",
                file=sys.stderr,
            )
        code = 1
    summary_path = OUT / "summary.json"
    summary_path.write_text(
        json.dumps(scenario.summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nSummary: {summary_path}")
    if code == 0:
        print(
            f"Report {scenario.summary['dashboard_id']}: {scenario.summary['dashboard_url']}"
        )
    return code


if __name__ == "__main__":
    sys.exit(main())
