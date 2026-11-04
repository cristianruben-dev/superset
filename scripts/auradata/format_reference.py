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
# ruff: noqa: TID251, S310, S608, B904, E501
"""
Creates the reference dashboard of the chart format: one chart of each type over
synthetic data, in a virtual dataset that needs no table or personal data.

    python scripts/auradata/format_reference.py <database id>
"""

import json
import sys
import urllib.error
import urllib.request
from typing import Any

BASE = "http://localhost:8188"
DB = int(sys.argv[1])


def call(
    method: str,
    path: str,
    body: Any = None,
    token: str | None = None,
    csrf: str | None = None,
    cookie: str | None = None,
) -> tuple[Any, str | None]:
    req = urllib.request.Request(
        BASE + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    if csrf:
        req.add_header("X-CSRFToken", csrf)
        req.add_header("Referer", BASE)
    if cookie:
        req.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.load(res), res.headers.get("Set-Cookie")
    except urllib.error.HTTPError as err:
        raise SystemExit(f"{method} {path}: {err.code} {err.read()[:500]!r}")


tok = call(
    "POST",
    "/api/v1/security/login",
    {"username": "admin", "password": "admin", "provider": "db"},
)[0]["access_token"]
csrf_res, ck = call("GET", "/api/v1/security/csrf_token/", token=tok)
csrf = csrf_res["result"]
cookie = ck.split(";")[0] if ck else None
auth: dict[str, Any] = {"token": tok, "csrf": csrf, "cookie": cookie}

rows = []
for m in range(1, 13):
    for ci, cat in enumerate(["Norte", "Centro", "Sur", "Bajío"]):
        for pi, prod in enumerate(["Alfa", "Beta", "Gamma"]):
            base = 100 + 17 * ((m * 3 + ci * 5 + pi * 7) % 23)
            rows.append(
                f"(DATE '2025-{m:02d}-01','{cat}','{prod}',{base},{base // 2 + 11 * pi},{10 + (m * ci + pi) % 40})"
            )
sql = (
    "SELECT * FROM (VALUES "
    + ",".join(rows)
    + ") AS t(fecha, region, producto, ventas, costo, unidades)"
)
dataset = call(
    "POST",
    "/api/v1/dataset/",
    {
        "database": DB,
        "schema": "public",
        "table_name": "qa_referencia",
        "sql": sql,
    },
    **auth,
)[0]["id"]


def metric(col: str, agg: str = "SUM") -> dict[str, Any]:
    return {
        "expressionType": "SIMPLE",
        "aggregate": agg,
        "column": {"column_name": col, "type": "BIGINT"},
        "label": f"{agg}({col})",
        "optionName": f"m_{col}",
    }


ventas, costo = metric("ventas"), metric("costo")
time_series = {
    "x_axis": "fecha",
    "time_grain_sqla": "P1M",
    "metrics": [ventas],
    "groupby": ["region"],
    "show_legend": True,
    "row_limit": 1000,
}
category = {
    "x_axis": "region",
    "metrics": [ventas],
    "groupby": ["producto"],
    "show_legend": True,
    "row_limit": 1000,
}
CHARTS: list[tuple[str, str, dict[str, Any]]] = [
    ("QA barras", "echarts_timeseries_bar", category),
    ("QA líneas", "echarts_timeseries_line", time_series),
    ("QA área", "echarts_area", time_series),
    (
        "QA combinado",
        "mixed_timeseries",
        {
            "x_axis": "fecha",
            "time_grain_sqla": "P1M",
            "metrics": [ventas],
            "metrics_b": [costo],
            "groupby": [],
            "groupby_b": [],
            "seriesType": "bar",
            "seriesTypeB": "line",
            "show_legend": True,
        },
    ),
    (
        "QA dispersión",
        "echarts_timeseries_scatter",
        {**time_series, "show_legend": True},
    ),
    (
        "QA circular",
        "pie",
        {"groupby": ["region"], "metric": ventas, "show_legend": True},
    ),
    (
        "QA anillo",
        "pie",
        {"groupby": ["producto"], "metric": ventas, "donut": True, "show_total": True},
    ),
    ("QA embudo", "funnel", {"groupby": ["region"], "metric": ventas}),
    ("QA treemap", "treemap_v2", {"groupby": ["region", "producto"], "metric": ventas}),
    (
        "QA cascada",
        "waterfall",
        {
            "x_axis": "fecha",
            "time_grain_sqla": "P1M",
            "metric": ventas,
            "groupby": ["region"],
        },
    ),
    ("QA medidor", "gauge_chart", {"metric": ventas, "groupby": [], "min_val": 0}),
    ("QA tarjeta", "big_number_total", {"metric": ventas}),
    (
        "QA KPI",
        "big_number",
        {"x_axis": "fecha", "time_grain_sqla": "P1M", "metric": ventas},
    ),
    (
        "QA tabla",
        "table",
        {
            "query_mode": "aggregate",
            "groupby": ["region", "producto"],
            "metrics": [ventas, costo],
            "show_totals": True,
        },
    ),
    (
        "QA matriz",
        "pivot_table_v2",
        {
            "groupbyRows": ["region"],
            "groupbyColumns": ["producto"],
            "metrics": [ventas],
            "aggregateFunction": "Sum",
            "rowTotals": True,
            "colTotals": True,
        },
    ),
]

dash = call(
    "POST",
    "/api/v1/dashboard/",
    {"dashboard_title": "QA referencia de formato", "published": False},
    **auth,
)[0]["id"]

layout: dict[str, Any] = {
    "DASHBOARD_VERSION_KEY": "v2",
    "ROOT_ID": {
        "id": "ROOT_ID",
        "type": "ROOT",
        "children": ["GRID_ID"],
        "meta": {"mibiCells": True},
    },
    "GRID_ID": {
        "id": "GRID_ID",
        "type": "GRID",
        "parents": ["ROOT_ID"],
        "children": [],
    },
    "HEADER_ID": {
        "id": "HEADER_ID",
        "type": "HEADER",
        "meta": {"text": "QA referencia de formato"},
    },
}
COLS, W, H = 5, 12, 11
row_id = ""
ids: list[int] = []
for i, (name, viz, params) in enumerate(CHARTS):
    form = {"viz_type": viz, "datasource": f"{dataset}__table", **params}
    chart = call(
        "POST",
        "/api/v1/chart/",
        {
            "slice_name": name,
            "viz_type": viz,
            "datasource_id": dataset,
            "datasource_type": "table",
            "params": json.dumps(form),
            "dashboards": [dash],
        },
        **auth,
    )[0]["id"]
    ids.append(chart)
    if i % COLS == 0:
        row_id = f"ROW-qa{i // COLS}"
        layout["GRID_ID"]["children"].append(row_id)
        layout[row_id] = {
            "id": row_id,
            "type": "ROW",
            "parents": ["ROOT_ID", "GRID_ID"],
            "children": [],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        }
    cid = f"CHART-qa{i}"
    layout[row_id]["children"].append(cid)
    layout[cid] = {
        "id": cid,
        "type": "CHART",
        "parents": ["ROOT_ID", "GRID_ID", row_id],
        "children": [],
        "meta": {
            "chartId": chart,
            "sliceName": name,
            "width": W,
            "height": H,
            "mibiPos": {"x": (i % COLS) * W, "y": (i // COLS) * H},
        },
    }

call(
    "PUT",
    f"/api/v1/dashboard/{dash}",
    {"position_json": json.dumps(layout)},
    **auth,
)
print(json.dumps({"dataset": dataset, "dashboard": dash, "charts": ids}))
