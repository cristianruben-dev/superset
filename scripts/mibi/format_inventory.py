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
# ruff: noqa: E501, TID251, N806, N816, C901, E741, B023, E731, C408
"""
Generates the inventory of Power BI format options and what AuraData BI covers.

The schema comes from Microsoft:
https://github.com/microsoft/powerbi-desktop-samples/tree/main/Report%20Theme%20JSON%20Schema

The status of each option comes from comparing control names with RULES and
OURS below: change them there, since this overwrites the output files.

    python scripts/mibi/format_inventory.py schema.json docs/plans/powerbi-format-inventory
"""

import argparse
import csv
import json
import os
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("schema", help="reportThemeSchema-*.json from Microsoft")
parser.add_argument("out", help="Folder of the inventory")
args = parser.parse_args()
OUT = args.out
FE = os.path.join(os.path.dirname(__file__), "..", "..", "superset-frontend")
os.makedirs(os.path.join(OUT, "por-grafico"), exist_ok=True)
schema = json.load(open(args.schema))
D = schema["definitions"]


def deref(n):
    while isinstance(n, dict) and "$ref" in n:
        n = D[n["$ref"].split("/")[-1]]
    return n


def typ(p):
    if "$ref" in p:
        return p["$ref"].split("/")[-1]
    for k in ("oneOf", "anyOf"):
        if k in p:
            if all("const" in x for x in p[k]):
                return "enum: " + ", ".join(
                    str(x.get("title", x["const"])) for x in p[k]
                )
            return " | ".join(typ(x) for x in p[k])
    if "enum" in p:
        return "enum: " + ", ".join(map(str, p["enum"]))
    t = p.get("type", "?")
    if isinstance(t, list):
        t = "/".join(t)
    if t == "array":
        return "array"
    r = ""
    if "minimum" in p or "maximum" in p:
        r = f" [{p.get('minimum', '')}..{p.get('maximum', '')}]"
    return t + r


def walk(d):
    o = {}
    d = deref(d)
    for part in d.get("allOf", []):
        for c, v in walk(part).items():
            o.setdefault(c, {}).update(v)
    for c, v in d.get("properties", {}).items():
        items = v.get("items", {}) if v.get("type") == "array" else v
        items = deref(items)
        props = {}
        for it in items.get("allOf", []) + [items]:
            it = deref(it)
            for k, pv in it.get("properties", {}).items():
                props[k] = dict(
                    type=typ(pv),
                    title=pv.get("title", ""),
                    desc=(pv.get("description") or ""),
                )
        o.setdefault(c, {}).update(props)
    return o


R = {k: walk(D[k]) for k in D if k.startswith("visual-") or k == "commonCards"}
common = R["commonCards"]
P = "plugins/plugin-chart-echarts/src/"
PANELS = {
    "bar": P + "Timeseries/Regular/Bar/controlPanel.tsx",
    "line": P + "Timeseries/Regular/Line/controlPanel.tsx",
    "area": P + "Timeseries/Area/controlPanel.tsx",
    "mixed": P + "MixedTimeseries/controlPanel.tsx",
    "scatter": P + "Timeseries/Regular/Scatter/controlPanel.tsx",
    "bubble": P + "Bubble/controlPanel.tsx",
    "pie": P + "Pie/controlPanel.tsx",
    "funnel": P + "Funnel/controlPanel.tsx",
    "treemap": P + "Treemap/controlPanel.tsx",
    "waterfall": P + "Waterfall/controlPanel.tsx",
    "gauge": P + "Gauge/controlPanel.tsx",
    "bigtotal": P + "BigNumber/BigNumberTotal/controlPanel.ts",
    "bigtrend": P + "BigNumber/BigNumberWithTrendline/controlPanel.tsx",
    "table": "plugins/plugin-chart-table/src/controlPanel.tsx",
    "pivot": "plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx",
}
AXES = "x_axis_label_font x_axis_title_font x_axis_inverse y_axis_label_font y_axis_title_font y_axis_inverse x_axis_hidden y_axis_hidden gridlines_hidden gridline_color gridline_width gridline_style".split()


def controls(key):
    t = open(os.path.join(FE, PANELS[key])).read()
    S = set(re.findall(r"name:\s*['\"](\w+)['\"]", t)) | set(
        re.findall(r"^\s*\[?['\"](\w+)['\"]\]?,?$", t, re.M)
    )
    if "buildCardFormatSections" in t:
        S.add("fmt_card5")
    if "buildSpecialChartSections" in t:
        S.add("fmt_special6")
        S.add("fmt_" + key + "56")
        S |= {"value_label_font", "value_label_background"}
        if key != "gauge":
            S |= {"fmt_legend", "legend_align", "legend_font", "legend_icon"}
        if key in ("waterfall", "bubble"):
            S |= set(AXES) | {"fmt_axes", "fmt_plot"}
        if key == "bubble":
            S |= {"fmt_markers", "series_marker_symbol", "series_colors"}
    if "buildTableFormatSections" in t:
        S.add("fmt_table4")
    if "axesFormatSection" in t:
        S |= set(AXES)
    if "buildAxesFormatSection" in t:
        S |= set(AXES)
        if "secondaryYAxis: true" in t:
            S |= {"y_axis_secondary_label_font", "y_axis_secondary_title_font"}
    m = re.search(r"buildSeriesFormatSection\(\{?(.*?)\}?\)", t, re.S)
    if m or "seriesFormatSection" in t:
        a = m.group(1) if m else ""
        S.add("series_colors")
        if "lines: false" not in a:
            S |= {"series_line_width", "series_line_type"}
        if "markers: false" not in a:
            S.add("series_marker_symbol")
        if "bars: false" not in a:
            S |= {
                "bar_category_gap",
                "bar_border_radius",
                "bar_border_color",
                "bar_border_width",
            }
    if "ataLabelsFormatSection" in t:
        S |= {"value_label_font", "value_label_background"}
        m = re.search(r"buildDataLabelsFormatSection\(\{(.*?)\}\)", t, re.S)
        a = m.group(1) if m else ""
        if "numberFormat: false" not in a:
            S.add("value_label_format")
        if "rotate: false" not in a:
            S.add("value_label_rotate")
    if "legendFormatSection" in t or "seriesLegendFormatSection" in t:
        S |= {"legend_align", "legend_font", "legend_icon"}
    if "seriesLegendFormatSection" in t:
        S.add("fmt_legend")
    if "xesFormatSection" in t:
        S.add("fmt_axes")
    if "secondaryYAxis: true" in t:
        S.add("fmt_secondary")
    if "marks:" in t:
        S.add("fmt_labels")
    if "totalLabelsFormatSection" in t:
        S.add("fmt_totals")
    if "seriesLabelsFormatSection" in t:
        S.add("fmt_series_labels")
    if "plotAreaFormatSection" in t:
        S.add("fmt_plot")
    if "buildAnalyticsSections" in t:
        S.add("fmt_analytics")
    if "tooltipFields: true" in t:
        S.add("fmt_tooltipfields")
    m = re.search(r"buildSeriesFormatSection\(\{?(.*?)\}?\)", t, re.S)
    if m:
        for part, token in (
            ("lines", "fmt_lines"),
            ("markers", "fmt_markers"),
            ("bars", "fmt_bars"),
        ):
            if f"{part}: false" not in m.group(1):
                S.add(token)
    if "legendSection" in t or "funnelLegendSection" in t:
        S |= {
            "show_legend",
            "legendMargin",
            "legendType",
            "legendOrientation",
            "legendSort",
        }
    if "chartConditionalFormattingSection" in t:
        S.add("chart_conditional_formatting")
    if "richTooltipSection" in t:
        S |= {"rich_tooltip", "tooltipValuesFormat"}
    if "titleControls" in t:
        S |= {
            "x_axis_title",
            "y_axis_title",
            "y_axis_title_margin",
            "x_axis_title_margin",
        }
    if "forecastIntervalControls" in t:
        S.add("forecastEnabled")
    if "seriesOrderSection" in t:
        S |= {"sort_series_type", "sort_series_ascending"}
    if "showValueSection" in t:
        S |= {"show_value", "only_total"}
    return S


OURS = {k: controls(k) for k in PANELS}
OURS["mixed"] |= {
    "show_value",
    "markerEnabled",
    "markerSize",
    "area",
    "opacity",
    "stack",
    "x_axis_title",
    "y_axis_title",
    "yAxisTitleSecondary",
}
OURS["scatter"] |= OURS["bubble"]
OURS["area"] |= {"show_value", "area"}
for name in OURS:
    OURS[name].add("fmt_chart")
for k in ("bar", "line", "area", "scatter", "mixed"):
    OURS[k] |= {"xAxisBounds", "truncateXAxis"}
V2O = {
    "barChart": "bar",
    "columnChart": "bar",
    "clusteredBarChart": "bar",
    "clusteredColumnChart": "bar",
    "hundredPercentStackedBarChart": "bar",
    "hundredPercentStackedColumnChart": "bar",
    "lineChart": "line",
    "areaChart": "area",
    "stackedAreaChart": "area",
    "hundredPercentStackedAreaChart": "area",
    "lineStackedColumnComboChart": "mixed",
    "lineClusteredColumnComboChart": "mixed",
    "ribbonChart": None,
    "waterfallChart": "waterfall",
    "funnel": "funnel",
    "scatterChart": "scatter",
    "pieChart": "pie",
    "donutChart": "pie",
    "treemap": "treemap",
    "map": "MAP",
    "filledMap": "MAP",
    "shapeMap": "MAP",
    "azureMap": "MAP",
    "gauge": "gauge",
    "cardVisual": "bigtotal",
    "card": "bigtotal",
    "multiRowCard": None,
    "kpi": "bigtrend",
    "tableEx": "table",
    "pivotTable": "pivot",
    "slicer": "FILTER",
    "listSlicer": "FILTER",
    "textSlicer": "FILTER",
    "advancedSlicerVisual": "FILTER",
}
ES = {
    "barChart": "Barras apiladas",
    "columnChart": "Columnas apiladas",
    "clusteredBarChart": "Barras agrupadas",
    "clusteredColumnChart": "Columnas agrupadas",
    "hundredPercentStackedBarChart": "Barras 100 %",
    "hundredPercentStackedColumnChart": "Columnas 100 %",
    "lineChart": "Líneas",
    "areaChart": "Área",
    "stackedAreaChart": "Área apilada",
    "hundredPercentStackedAreaChart": "Área 100 %",
    "lineStackedColumnComboChart": "Línea y columnas apiladas",
    "lineClusteredColumnComboChart": "Línea y columnas agrupadas",
    "ribbonChart": "Ribbon",
    "waterfallChart": "Cascada",
    "funnel": "Embudo",
    "scatterChart": "Dispersión",
    "pieChart": "Circular",
    "donutChart": "Anillo",
    "treemap": "Treemap",
    "map": "Mapa de burbujas",
    "filledMap": "Mapa relleno",
    "shapeMap": "Mapa de formas",
    "azureMap": "Azure Maps",
    "gauge": "Medidor",
    "cardVisual": "Tarjeta (nueva)",
    "card": "Tarjeta",
    "multiRowCard": "Tarjeta de varias filas",
    "kpi": "KPI",
    "tableEx": "Tabla",
    "pivotTable": "Matriz",
    "slicer": "Segmentador",
    "listSlicer": "Segmentador de lista",
    "textSlicer": "Segmentador de entrada",
    "advancedSlicerVisual": "Segmentador de botones",
}
FONT = r"fontFamily|fontSize|bold|italic|labelColor|color|fontColor|textSize"
F = "fmt"
# (card regex, prop regex, controls, status, note); first match wins; a control absent from the chart means Falta
RULES = [
    (
        r"referenceLine|xAxisReferenceLine|y1AxisReferenceLine",
        r"autoScale",
        None,
        "Falta",
        "El motor de gráficos no escala el trazo con el zoom",
    ),
    (
        r"referenceLine|xAxisReferenceLine|y1AxisReferenceLine",
        r"dashCap",
        None,
        "Falta",
        "Los extremos no se eligen en estas líneas",
    ),
    (
        r"referenceLine|xAxisReferenceLine|y1AxisReferenceLine",
        r"shadeColorMatchStroke",
        ["fmt_analytics"],
        "Parcial",
        "Sin color propio, el sombreado toma el de la línea",
    ),
    (
        r"referenceLine|xAxisReferenceLine|y1AxisReferenceLine",
        r".*",
        ["fmt_analytics"],
        "Tiene",
        "Analítica: líneas de referencia",
    ),
    (
        r"trend",
        r"autoScale|dashCap|displayName|useHighlightValues",
        None,
        "Falta",
        "Sin esa opción en la línea de tendencia",
    ),
    (r"trend", r".*", ["fmt_analytics"], "Tiene", "Analítica: línea de tendencia"),
    (
        r"zoom",
        r".*Sec.*|showOnValueSecAxis",
        None,
        "Falta",
        "Sin deslizador para el eje secundario",
    ),
    (r"zoom", r"showTooltip", None, "Falta", "El deslizador solo tiene etiquetas"),
    (
        r"zoom",
        r"categoryMin|categoryMax|valueMin|valueMax",
        ["fmt_analytics"],
        "Parcial",
        "En porcentaje del eje, no en valores",
    ),
    (r"zoom", r".*", ["fmt_analytics"], "Tiene", "Analítica: deslizadores de zoom"),
    (
        r"smallMultiplesLayout",
        r"columnCount",
        ["fmt_analytics"],
        "Tiene",
        "Analítica: múltiplos por fila",
    ),
    (
        r"smallMultiplesLayout",
        r".*",
        None,
        "Falta",
        "El motor de múltiplos no tiene ese ajuste",
    ),
    (
        r"subheader",
        r"show",
        ["fmt_analytics"],
        "Tiene",
        "Analítica: encabezados de múltiplos",
    ),
    (
        r"subheader",
        r".*",
        None,
        "Falta",
        "Los encabezados de múltiplos usan el estilo del tema",
    ),
    (
        r"visualTooltip",
        r"showChartSpecificTooltips|showTooltipFieldsOnly",
        ["fmt_tooltipfields"],
        "Parcial",
        "Analítica: campos de tooltip que se añaden a los del gráfico",
    ),
    (
        r"bubbles",
        r"markerShape",
        ["series_marker_symbol"],
        "Tiene",
        "Forma del marcador",
    ),
    (r"bubbles", r"showSeries", ["fmt_markers"], "Tiene", "Aplicar a una serie"),
    (
        r"categoryLabels",
        r".*[uU]nderline",
        None,
        "Falta",
        "El motor de gráficos no dibuja texto subrayado",
    ),
    (
        r"categoryLabels",
        r"show|color|fontFamily|fontSize|bold|italic",
        ["fmt_scatter56"],
        "Parcial",
        "Título de la etiqueta con la serie o la categoría, con su fuente",
    ),
    (
        r"categoryLabels",
        r"enableBackground|backgroundColor|backgroundTransparency",
        ["fmt_scatter56"],
        "Falta",
        "El título de la etiqueta no tiene fondo propio",
    ),
    (r"ratioLine", r"dashArray", ["fmt_bubble56"], "Tiene", "Patrón de guiones"),
    (
        r"ratioLine",
        r"autoScale",
        None,
        "Falta",
        "El motor de gráficos no escala el trazo con el zoom",
    ),
    (
        r"ratioLine",
        r"dashCap",
        None,
        "Falta",
        "Los extremos no se eligen en esta línea",
    ),
    (
        r"colorBorder|colorByCategory",
        r"show",
        ["fmt_bubble56"],
        "Tiene",
        "Colores y series",
    ),
    (r"fillPoint", r"style", ["fmt_bubble56"], "Tiene", "Forma y relleno del marcador"),
    (r"plotAreaShading", r"displayName", None, "Falta", "El sombreado no tiene nombre"),
    (
        r"percentBarLabel|target",
        r"underline",
        None,
        "Falta",
        "El motor de gráficos no dibuja texto subrayado",
    ),
    (
        r"breakdown|sentimentColors",
        r"otherFill",
        None,
        "Falta",
        "Sin grupo Otros: depende del máximo de desgloses",
    ),
    (r"valueAxis", r"totalsEnabled", ["fmt_waterfall56"], "Tiene", "Mostrar total"),
    (r"valueAxis", r"start|end", ["fmt_waterfall56"], "Tiene", "Límites del eje Y"),
    (
        r"categoryAxis",
        r"innerPadding",
        ["fmt_waterfall56"],
        "Tiene",
        "Espacio entre barras",
    ),
    (
        r"categoryAxis|valueAxis",
        r"treatNullsAsZero",
        None,
        "Falta",
        "Un valor nulo no dibuja marca",
    ),
    (
        r"categoryAxis",
        r"innerPadding",
        ["fmt_bubble56"],
        "Excluido",
        "Sin categorías: el eje es numérico",
    ),
    (
        r"labels",
        r"show",
        ["fmt_waterfall56", "fmt_gauge56"],
        "Tiene",
        "Mostrar etiquetas",
    ),
    (r"legend", r"position", ["fmt_waterfall56"], "Tiene", "Posición"),
    (
        r"legend",
        r"position|show",
        ["fmt_treemap56"],
        "Falta",
        "El treemap no tiene leyenda: sus etiquetas nombran cada grupo",
    ),
    (
        r"label",
        r"bold|fontColor|fontFamily|fontSize|italic",
        ["fmt_pie56"],
        "Tiene",
        "Fuente de la etiqueta central",
    ),
    (
        r"label",
        r"gap|position|textWrap|underline",
        ["fmt_pie56"],
        "Falta",
        "La etiqueta central va siempre sobre el valor",
    ),
    (
        r"value",
        r"showBlankAs|textWrap|underline|value",
        ["fmt_pie56"],
        "Falta",
        "El valor central es texto del motor, sin esas opciones",
    ),
    (
        r"image",
        r".*",
        ["fmt_pie56"],
        "Falta",
        "Sin imagen central: requiere carga, selección y ajuste",
    ),
    (
        r"accessibility",
        r".*",
        None,
        "Falta",
        "Hay texto alternativo por gráfico, no por columna",
    ),
    (
        r"Annotations|annotationTemplate",
        r".*",
        None,
        "Falta",
        "Sin anotaciones en el gráfico: fase 8",
    ),
    (
        r"categoryAxis|valueAxis|legend|labels|totals|seriesLabels|y2Axis",
        r".*[uU]nderline",
        None,
        "Falta",
        "El motor de gráficos no dibuja texto subrayado",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridlineAutoScale",
        None,
        "Falta",
        "El motor de gráficos no escala el trazo con el zoom",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridline(Show|Color|Thickness|Style|DashArray|DashCap|Transparency)",
        ["fmt_axes"],
        "Tiene",
        "Eje > Líneas de cuadrícula",
    ),
    (
        r"categoryAxis|valueAxis",
        r"labelDisplayUnits|labelPrecision|switchAxisPosition",
        ["fmt_axes"],
        "Tiene",
        "Sección del eje",
    ),
    (
        r"categoryAxis",
        r"logAxisScale",
        ["fmt_axes"],
        "Tiene",
        "Eje X logarítmico, solo en un eje numérico",
    ),
    (
        r"categoryAxis",
        r"preferredCategoryWidth|initialScrollPosition",
        ["fmt_axes"],
        "Tiene",
        "Eje X > Categorías",
    ),
    (
        r"categoryAxis",
        r"maxMarginFactor",
        ["fmt_axes"],
        "Parcial",
        "Ancho máximo de etiqueta en píxeles, no en % del gráfico",
    ),
    (
        r"categoryAxis",
        r"innerPadding",
        ["bar_category_gap"],
        "Tiene",
        "Espacio entre barras",
    ),
    (
        r"categoryAxis",
        r"concatenateLabels|autoExpand",
        None,
        "Excluido",
        "No hay jerarquías de exploración",
    ),
    (
        r"categoryAxis",
        r"outerPadding",
        None,
        "Falta",
        "El motor de gráficos no tiene relleno exterior de categorías",
    ),
    (
        r"categoryAxis|valueAxis",
        r"roundRange|secRoundRange",
        None,
        "Falta",
        "El motor de gráficos redondea el eje salvo con límites fijos",
    ),
    (
        r"valueAxis",
        r"secFontFamily|secFontSize|secBold|secItalic|secLabelColor",
        ["y_axis_secondary_label_font"],
        "Tiene",
        "Fuente eje secundario",
    ),
    (
        r"valueAxis",
        r"secTitleFontFamily|secTitleFontSize|secTitleBold|secTitleItalic|secTitleColor",
        ["y_axis_secondary_title_font"],
        "Tiene",
        "Fuente título secundario",
    ),
    (
        r"valueAxis",
        r"secTitleText|secShowAxisTitle",
        ["yAxisTitleSecondary"],
        "Tiene",
        "Título secundario",
    ),
    (
        r"valueAxis",
        r"secStart|secEnd",
        ["y_axis_bounds_secondary"],
        "Tiene",
        "Límites secundarios",
    ),
    (r"valueAxis", r"secLogAxisScale", ["logAxisSecondary"], "Tiene", "Log secundario"),
    (
        r"valueAxis|y2Axis",
        r"secShow|show|secLabelDisplayUnits|secLabelPrecision",
        ["fmt_secondary"],
        "Tiene",
        "Eje Y secundario",
    ),
    (
        r"labels",
        r"dynamicLabel.*|showDynamicLabels",
        None,
        "Excluido",
        "Requiere expresiones DAX",
    ),
    (
        r"labels",
        r"leaderLine.*",
        None,
        "Falta",
        "El motor de gráficos no las dibuja en barras ni líneas",
    ),
    (
        r"labels",
        r".*[sS]howBlankAs",
        None,
        "Falta",
        "Una marca sin valor no tiene etiqueta",
    ),
    (
        r"labels",
        r"(title|detail)(LabelDisplayUnits|LabelPrecision|FormatString|CustomFormatString)",
        None,
        "Falta",
        "El título y el detalle son texto, no otra medida",
    ),
    (
        r"labels",
        r"labelPosition|transparency|labelContainerMaxWidth|labelOverflow|wordWrap|optimizeLabelDisplay"
        r"|horizontalAlignment|labelDisplayUnits|labelPrecision|enableValueDataLabel|enableTitleDataLabel"
        r"|titleContentType|titleFontFamily|titleFontSize|titleBold|titleItalic|titleColor|titleTransparency"
        r"|enableDetailDataLabel|detailFontFamily|detailFontSize|detailBold|detailItalic|detailColor"
        r"|detailTransparency|labelContentLayout|showSeries|showAll|showByDefault",
        ["fmt_labels"],
        "Tiene",
        "Etiquetas de datos",
    ),
    (
        r"labels",
        r"detailContentType",
        ["fmt_labels"],
        "Parcial",
        "Serie, categoría o porcentaje; no otro campo",
    ),
    (
        r"labels",
        r"labelDensity",
        ["fmt_labels"],
        "Parcial",
        "Ocultar etiquetas superpuestas, sin porcentaje de densidad",
    ),
    (
        r"labels",
        r"minimumOffset|maximumOffset",
        ["fmt_labels"],
        "Parcial",
        "Una sola distancia a la marca",
    ),
    (
        r"labels",
        r"enableBackground|backgroundColor|backgroundTransparency",
        ["value_label_background"],
        "Tiene",
        "Fondo de etiquetas",
    ),
    (
        r"labels",
        r"valueFormatString|valueCustomFormatString",
        ["value_label_format"],
        "Tiene",
        "Formato de número de la etiqueta",
    ),
    (
        r"legend",
        r"showTitle|titleText|matchLineColor",
        ["fmt_legend"],
        "Tiene",
        "Leyenda",
    ),
    (
        r"categoryAxis",
        r"axisType",
        ["fmt_axes"],
        "Parcial",
        "Sale del tipo de la columna; se fuerza con «Forzar categórico»",
    ),
    (
        r"categoryAxis|valueAxis",
        r"axisStyle|secAxisStyle",
        None,
        "Falta",
        "El eje muestra sus valores y su título, sin elegir entre ellos",
    ),
    (
        r"categoryAxis",
        r"reverseStackOrder",
        None,
        "Falta",
        "Se ordena con el orden de series",
    ),
    (
        r"valueAxis",
        r"alignZeros",
        None,
        "Falta",
        "Los ejes alinean sus marcas, no su cero",
    ),
    (
        r"valueAxis",
        r"sharedAxis",
        None,
        "Falta",
        "Cada consulta elige eje en sus datos",
    ),
    (
        r"dataPoint",
        r"defaultColor|fill",
        ["fmt_lines"],
        "Tiene",
        "Colores y series",
    ),
    (
        r"dataPoint",
        r"transparency",
        ["fmt_lines"],
        "Tiene",
        "Colores y series > Líneas",
    ),
    (
        r"legend",
        r"showGradientLegend",
        None,
        "Falta",
        "Sin leyenda para la escala de color",
    ),
    (
        r"dataPoint",
        r"defaultColor|fill|showAllDataPoints|transparency|fillTransparency|borderColorMatchFill"
        r"|borderOutlineOnly|borderTransparency",
        ["fmt_bars"],
        "Tiene",
        "Colores y series",
    ),
    (
        r"dataPoint",
        r"fillRule",
        ["fmt_bars"],
        "Parcial",
        "Reglas y escala de dos colores por el valor de la barra; sin otro campo",
    ),
    (
        r"layout",
        r"clusteredGapOverlaps|clusteredGapOverlapReverse",
        ["fmt_bars"],
        "Tiene",
        "Colores y series > Barras",
    ),
    (
        r"layout",
        r"stackedGapSize|stackedGapExplodes",
        None,
        "Falta",
        "El motor de gráficos no separa los segmentos de una pila",
    ),
    (
        r"lineStyles",
        r"strokeAutoScale",
        None,
        "Falta",
        "El motor de gráficos no escala el trazo con el zoom",
    ),
    (
        r"lineStyles",
        r"segmentAlignment|segmentGradient",
        None,
        "Falta",
        "El motor de gráficos no colorea por tramo de línea",
    ),
    (
        r"lineStyles",
        r"interpolationSmooth|interpolationSmoothParam|interpolationStep|lineChartType|strokeDashArray"
        r"|strokeDashCap|strokeLineJoin|strokeTransparency|strokeShow|showSeries|areaColor|areaMatchStrokeColor",
        ["fmt_lines"],
        "Tiene",
        "Colores y series > Líneas",
    ),
    (
        r"lineStyles",
        r"markerColor",
        ["fmt_markers"],
        "Tiene",
        "Colores y series > Marcadores",
    ),
    (
        r"markers",
        r"borderColor|borderColorMatchFill|borderShow|borderTransparency|borderWidth|rotation|transparency",
        ["fmt_markers"],
        "Tiene",
        "Colores y series > Marcadores",
    ),
    (r"totals", r".*", ["fmt_totals"], "Tiene", "Etiquetas de total"),
    (
        r"seriesLabels",
        r"leaderLine.*|maximumOffset",
        None,
        "Falta",
        "El motor de gráficos solo las pone al final de la línea",
    ),
    (
        r"seriesLabels",
        r"seriesPosition",
        ["fmt_series_labels"],
        "Parcial",
        "Solo al final de la línea",
    ),
    (
        r"seriesLabels",
        r"showAll|showByDefault",
        None,
        "Falta",
        "Se activan para todo el gráfico",
    ),
    (r"seriesLabels", r".*", ["fmt_series_labels"], "Tiene", "Etiquetas de serie"),
    (r"plotArea", r"color|colorTransparency", ["fmt_plot"], "Tiene", "Área de trazado"),
    (
        r"plotArea",
        r"transparency",
        None,
        "Falta",
        "El motor de gráficos no atenúa una imagen de fondo",
    ),
    (
        r"plotArea",
        r"image|imageData|url|sourceType",
        ["fmt_plot"],
        "Parcial",
        "Por dirección de la imagen, sin subirla",
    ),
    (
        r"plotArea",
        r"fit",
        ["fmt_plot"],
        "Parcial",
        "En mosaico o una vez, sin ajustar al área",
    ),
    (
        r"title",
        r"heading",
        ["fmt_chart"],
        "Tiene",
        "General > Título: nivel de encabezado",
    ),
    (r"subTitle", r"heading|titleWrap", ["fmt_chart"], "Tiene", "General > Subtítulo"),
    (
        r"divider",
        r"ignorePadding",
        ["fmt_chart"],
        "Tiene",
        "General > Divisor: llegar a los bordes",
    ),
    (
        r"visualHeader",
        r"border|transparency|show|showOptionsMenu|showFilterRestatementButton|showFocusModeButton|showCopyVisualImageButton|showSeeDataLayoutToggleButton|showVisualInformationButton|showVisualWarningButton|showVisualErrorButton|showTooltipButton",
        ["fmt_chart"],
        "Tiene",
        "General > Iconos del encabezado",
    ),
    (
        r"visualHeader",
        r"showDrill.*",
        None,
        "Excluido",
        "No hay jerarquías de exploración",
    ),
    (r"spacing", r".*", ["fmt_chart"], "Tiene", "General > Espaciado"),
    (
        r"visualHeaderTooltip",
        r"section|type",
        ["none"],
        "Falta",
        "Requiere páginas tooltip (fase 9)",
    ),
    (
        r"visualHeaderTooltip",
        r".*",
        ["fmt_chart"],
        "Tiene",
        "General > Información del encabezado",
    ),
    (
        r"visualTooltip",
        r"section|type",
        ["none"],
        "Falta",
        "Requiere páginas tooltip (fase 9)",
    ),
    (
        r"visualTooltip",
        r"actionFontColor|showActionsInTooltips",
        ["none"],
        "Falta",
        "Sin acciones de obtener detalles en el tooltip",
    ),
    (
        r"visualTooltip",
        r"showChartSpecificTooltips|showTooltipFieldsOnly",
        ["none"],
        "Falta",
        "Requiere campos de tooltip (fase 8)",
    ),
    (
        r"visualTooltip",
        r".*",
        ["fmt_chart"],
        "Tiene",
        "General > Tooltips, solo gráficos ECharts",
    ),
    (
        r"visualLink",
        r"dataFunction|tooltipPlaceholderText",
        None,
        "Excluido",
        "Función de Power BI que no tenemos",
    ),
    (
        r"visualLink",
        r"drillthroughSection",
        ["none"],
        "Falta",
        "El detalle necesita el valor de una marca",
    ),
    (
        r"visualLink",
        r"type|showDefaultTooltip|suppressDefaultTooltip",
        ["fmt_chart"],
        "Parcial",
        "General > Acción",
    ),
    (r"visualLink", r".*", ["fmt_chart"], "Tiene", "General > Acción"),
    (r"lockAspect", r"show", ["fmt_chart"], "Tiene", "General > Propiedades"),
    (
        r"general",
        r"keepLayerOrder|allowBinnedLineSample|allowOverlappingPointsSample",
        ["fmt_chart"],
        "Tiene",
        "General > Propiedades",
    ),
    (
        r"actionButtonSection",
        r"backgroundColor|backgroundShow|backgroundTransparency|bold|borderColor|borderShow|borderTransparency|borderWidth|displayIconOnly|fillColor|fillShow|fillTransparency|fontFamily|fontSize|glowBlur|glowColor|glowOffset|glowPosition|glowShow|glowTransparency|iconColor|iconIndividualPadding|iconPadding|iconPaddingBottom|iconPaddingLeft|iconPaddingRight|iconPaddingTop|iconShow|iconSize|iconTransparency|individualPadding|italic|matchTileBackground|padding|paddingBottom|paddingLeft|paddingRight|paddingTop|position|positionShow|shadowBlur|shadowColor|shadowOffset|shadowPosition|shadowShow|shadowTransparency|show|text|textColor|textHorizontalAlignment|textIndividualPadding|textPadding|textPaddingBottom|textPaddingLeft|textPaddingRight|textPaddingTop|textShow|textTransparency|textVerticalAlignment|underline",
        ["fmt_chart"],
        "Tiene",
        "General > Botón de acción",
    ),
    (
        r"title",
        r"fontFamily|underline|titleWrap",
        ["fmt_chart"],
        "Tiene",
        "General > Título",
    ),
    (
        r"subTitle",
        r"text|fontSize|fontColor|show|fontFamily|bold|italic|underline|alignment",
        ["fmt_chart"],
        "Tiene",
        "General > Subtítulo",
    ),
    (
        r"divider",
        r"show|color|style|width",
        ["fmt_chart"],
        "Tiene",
        "General > Divisor",
    ),
    (
        r"dropShadow",
        r"show|preset|color|transparency|angle|shadowDistance|shadowBlur|shadowSpread|position",
        ["fmt_chart"],
        "Tiene",
        "General > Sombra",
    ),
    (
        r"padding",
        r"left|right|top|bottom",
        ["fmt_chart"],
        "Tiene",
        "General > Relleno por lado",
    ),
    (
        r"visualHeader",
        r"foreground|background",
        ["fmt_chart"],
        "Tiene",
        "General > Iconos",
    ),
    (
        r"spacing",
        r"customizeSpacing|spaceBelowTitleArea",
        ["fmt_chart"],
        "Parcial",
        "General > Espacio bajo el encabezado",
    ),
    (r".*", r"\$id", None, "Excluido", "Selector interno de serie"),
    (
        r"filters|actionState|scalarKey|currentFrameIndex|data|stylePreset",
        r".*",
        None,
        "Excluido",
        "Estado interno, no es una opción de formato",
    ),
    (
        r"visualHeader",
        r".*(Comment|Copilot|Follow|Pin|SetAlert|SmartNarrative|Personalize).*",
        None,
        "Excluido",
        "Función de Power BI que no tenemos",
    ),
    (r"general", r"x|y|width|height", [F], "Tiene", "Posición y tamaño en celdas"),
    (r"general", r"altText", [F], "Tiene", "Formato > Texto alternativo"),
    (
        r"general",
        r"formatString",
        ["y_axis_format", "number_format", "valueFormat"],
        "Parcial",
        "Formato numérico",
    ),
    (r"general", r"responsive.*", None, "Excluido", "El lienzo tiene tamaño fijo"),
    (
        r"visualTooltip",
        r"show|showTooltipFieldsOnly",
        ["rich_tooltip"],
        "Parcial",
        "Tooltip enriquecido, sin formato",
    ),
    (
        r"title",
        r"show|fontSize|fontColor|alignment|background|bold|italic|text",
        [F],
        "Tiene",
        "Formato > Título",
    ),
    (
        r"subTitle",
        r"text|fontSize|fontColor|show",
        [F],
        "Parcial",
        "Formato > Título; sin interruptor propio",
    ),
    (r"divider", r"show|color", [F], "Tiene", "Línea bajo la cabecera"),
    (r"background", r"show|color|transparency", [F], "Tiene", "Formato > Fondo"),
    (r"border", r"show|color|width|radius", [F], "Tiene", "Formato > Borde"),
    (r"dropShadow", r"show|preset", [F], "Parcial", "Solo niveles de sombra"),
    (
        r"padding",
        r"left|right|top|bottom",
        [F],
        "Parcial",
        "Solo un valor para los cuatro lados",
    ),
    (
        r"visualHeader",
        r"show|showOptionsMenu|showFilterRestatementButton",
        [F],
        "Parcial",
        "Formato > Iconos de cabecera",
    ),
    (r"categoryAxis", r"show", ["x_axis_hidden"], "Tiene", "Ocultar eje X"),
    (
        r"categoryAxis",
        r"fontFamily|fontSize|bold|italic|labelColor",
        ["x_axis_label_font"],
        "Tiene",
        "Fuente de etiquetas X",
    ),
    (
        r"categoryAxis",
        r"titleFontFamily|titleFontSize|titleBold|titleItalic|titleColor",
        ["x_axis_title_font"],
        "Tiene",
        "Fuente de título X",
    ),
    (
        r"categoryAxis",
        r"titleText|showAxisTitle",
        ["x_axis_title", "x_axis_label"],
        "Tiene",
        "Título del eje X",
    ),
    (r"categoryAxis", r"invertAxis", ["x_axis_inverse"], "Tiene", "Invertir eje X"),
    (
        r"categoryAxis",
        r"start|end",
        ["xAxisBounds", "x_axis_bounds", "truncateXAxis"],
        "Parcial",
        "Solo ejes numéricos",
    ),
    (
        r"categoryAxis",
        r"axisType",
        ["forceCategorical"],
        "Parcial",
        "Forzar categórico",
    ),
    (
        r"categoryAxis",
        r"labelDisplayUnits|labelPrecision",
        ["x_axis_number_format", "xAxisFormat"],
        "Parcial",
        "Con código d3, no con unidades y decimales",
    ),
    (
        r"categoryAxis",
        r"innerPadding",
        ["bar_category_gap"],
        "Parcial",
        "Espacio entre barras",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridlineShow",
        ["gridlines_hidden"],
        "Parcial",
        "Una opción para ambos ejes",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridlineColor",
        ["gridline_color"],
        "Parcial",
        "Una opción para ambos ejes",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridlineThickness",
        ["gridline_width"],
        "Parcial",
        "Una opción para ambos ejes",
    ),
    (
        r"categoryAxis|valueAxis",
        r"gridlineStyle",
        ["gridline_style"],
        "Parcial",
        "Una opción para ambos ejes",
    ),
    (r"valueAxis", r"show", ["y_axis_hidden"], "Tiene", "Ocultar eje Y"),
    (
        r"valueAxis",
        r"fontFamily|fontSize|bold|italic|labelColor",
        ["y_axis_label_font"],
        "Tiene",
        "Fuente de etiquetas Y",
    ),
    (
        r"valueAxis",
        r"titleFontFamily|titleFontSize|titleBold|titleItalic|titleColor",
        ["y_axis_title_font"],
        "Tiene",
        "Fuente de título Y",
    ),
    (
        r"valueAxis",
        r"titleText|showAxisTitle",
        ["y_axis_title", "y_axis_label"],
        "Tiene",
        "Título del eje Y",
    ),
    (r"valueAxis", r"invertAxis", ["y_axis_inverse"], "Tiene", "Invertir eje Y"),
    (r"valueAxis", r"start|end", ["y_axis_bounds"], "Tiene", "Límites del eje Y"),
    (r"valueAxis", r"logAxisScale", ["logAxis"], "Tiene", "Escala logarítmica"),
    (r"valueAxis", r"scaleToFit", ["truncateYAxis"], "Parcial", "Truncar eje"),
    (
        r"valueAxis",
        r"labelDisplayUnits|labelPrecision",
        ["y_axis_format"],
        "Parcial",
        "Con código d3, no con unidades y decimales",
    ),
    (
        r"y2Axis",
        r"secFontFamily|secFontSize|secBold|secItalic|secLabelColor",
        ["y_axis_secondary_label_font"],
        "Tiene",
        "Fuente eje secundario",
    ),
    (
        r"y2Axis",
        r"secTitleFontFamily|secTitleFontSize|secTitleBold|secTitleItalic|secTitleColor",
        ["y_axis_secondary_title_font"],
        "Tiene",
        "Fuente título secundario",
    ),
    (
        r"y2Axis",
        r"secTitleText|secShowAxisTitle",
        ["yAxisTitleSecondary"],
        "Tiene",
        "Título secundario",
    ),
    (
        r"y2Axis",
        r"secStart|secEnd",
        ["y_axis_bounds_secondary"],
        "Tiene",
        "Límites secundarios",
    ),
    (r"y2Axis", r"secLogAxisScale", ["logAxisSecondary"], "Tiene", "Log secundario"),
    (
        r"valueAxis",
        r"sec.*",
        None,
        "Falta",
        "Este gráfico no tiene segundo eje; está en el combinado",
    ),
    (
        r"y2Axis",
        r".*",
        None,
        "Falta",
        "Este gráfico no tiene segundo eje; está en el combinado",
    ),
    (r"labels", r"show", ["show_value", "show_labels"], "Tiene", "Mostrar etiquetas"),
    (
        r"labels",
        r"fontFamily|fontSize|bold|italic|color",
        ["value_label_font"],
        "Tiene",
        "Fuente de etiquetas",
    ),
    (
        r"labels",
        r"enableBackground|backgroundColor|background",
        ["value_label_background"],
        "Tiene",
        "Fondo de etiquetas",
    ),
    (
        r"labels",
        r"labelDisplayUnits|labelPrecision|valueFormatString|valueCustomFormatString|percentageLabelPrecision",
        ["value_label_format", "number_format"],
        "Parcial",
        "Con código d3",
    ),
    (r"labels", r"labelOrientation", ["value_label_rotate"], "Tiene", "Rotación"),
    (r"labels", r"labelStyle", ["label_type"], "Tiene", "Contenido de etiqueta"),
    (r"labels", r"position", ["labels_outside"], "Parcial", "Solo dentro o fuera"),
    (r"legend", r"show", ["show_legend"], "Tiene", "Mostrar leyenda"),
    (r"legend", r"position", ["legendOrientation"], "Tiene", "Posición"),
    (
        r"legend",
        r"fontFamily|fontSize|bold|italic|labelColor",
        ["legend_font"],
        "Tiene",
        "Fuente de leyenda",
    ),
    (
        r"legend",
        r"legendMarkerRendering",
        ["legend_icon"],
        "Parcial",
        "Forma del marcador",
    ),
    (
        r"dataPoint",
        r"defaultColor|fill",
        ["series_colors", "color_scheme"],
        "Parcial",
        "Color por serie o esquema; revisar color por categoría",
    ),
    (
        r"dataPoint",
        r"fillRule",
        ["chart_conditional_formatting", "conditional_formatting"],
        "Parcial",
        "Formato condicional por reglas",
    ),
    (r"dataPoint", r"borderColor", ["bar_border_color"], "Tiene", "Borde de barras"),
    (
        r"dataPoint",
        r"borderSize|borderShow",
        ["bar_border_width"],
        "Tiene",
        "Borde de barras",
    ),
    (
        r"layout",
        r"clusteredGapSize",
        ["bar_category_gap"],
        "Tiene",
        "Espacio entre barras",
    ),
    (
        r"layout",
        r"seriesOrderReversed",
        ["sort_series_ascending"],
        "Parcial",
        "Orden de series",
    ),
    (
        r"layout",
        r"seriesOrderSorted",
        ["sort_series_type"],
        "Parcial",
        "Orden de series",
    ),
    (r"lineStyles", r"strokeWidth", ["series_line_width"], "Tiene", "Grosor de línea"),
    (r"lineStyles", r"lineStyle", ["series_line_type"], "Tiene", "Estilo de línea"),
    (
        r"lineStyles",
        r"showMarker|showMarkerByDefault",
        ["markerEnabled"],
        "Tiene",
        "Marcadores",
    ),
    (
        r"lineStyles",
        r"markerShape",
        ["series_marker_symbol"],
        "Tiene",
        "Forma del marcador",
    ),
    (r"lineStyles", r"markerSize", ["markerSize"], "Tiene", "Tamaño del marcador"),
    (r"lineStyles", r"strokeColor", ["series_colors"], "Tiene", "Color por serie"),
    (r"lineStyles", r"areaShow", ["area"], "Tiene", "Sombrear área"),
    (
        r"lineStyles",
        r"strokeTransparency|areaColor",
        ["opacity"],
        "Parcial",
        "Solo opacidad del área",
    ),
    (r"zoom", r"show", ["zoomable"], "Parcial", "Control de zoom, sin formato"),
    (r"forecast", r"show", ["forecastEnabled"], "Parcial", "Pronóstico sin formato"),
    (r"totals", r"show", ["only_total", "show_total"], "Parcial", "Solo total"),
    (
        r"sentimentColors",
        r"increaseFill",
        ["increase_color"],
        "Tiene",
        "Color de aumento",
    ),
    (
        r"sentimentColors",
        r"decreaseFill",
        ["decrease_color"],
        "Tiene",
        "Color de disminución",
    ),
    (r"sentimentColors", r"totalFill", ["total_color"], "Tiene", "Color de total"),
    (r"axis", r"min", ["min_val"], "Tiene", "Mínimo"),
    (r"axis", r"max", ["max_val"], "Tiene", "Máximo"),
    (
        r"calloutValue",
        r"show",
        ["show_progress", "font_size"],
        "Parcial",
        "Valor siempre visible",
    ),
    (r"calloutValue", r"fontSize", ["font_size"], "Tiene", "Tamaño"),
    (
        r"calloutValue",
        r"labelDisplayUnits|labelPrecision",
        ["number_format"],
        "Parcial",
        "Con código d3",
    ),
    (r"slices", r"innerRadiusRatio", ["innerRadius"], "Tiene", "Radio interior"),
    (r"centerValue", r"show", ["show_total"], "Tiene", "Valor central"),
    (r"categoryLabels", r"show", ["show_labels"], "Parcial", "Etiquetas"),
    (
        r"percentBarLabel",
        r"show",
        ["percent_calculation_type"],
        "Parcial",
        "Porcentaje",
    ),
    (
        r"status",
        r"direction|goodColor|badColor",
        ["conditional_formatting"],
        "Parcial",
        "Reglas de color",
    ),
    (r"trendline", r"show", ["show_trend_line"], "Tiene", "Línea de tendencia"),
    (r"lastDate", r"show", ["show_timestamp"], "Tiene", "Fecha"),
    (
        r"goals",
        r"showGoal|showDistance",
        ["compare_lag"],
        "Parcial",
        "Comparación contra periodo, no contra objetivo",
    ),
    (
        r"columnHeaders",
        r"fontFamily|fontSize|bold|italic|fontColor",
        ["table_header_font"],
        "Tiene",
        "Fuente de cabecera",
    ),
    (
        r"columnHeaders",
        r"backColor",
        ["table_header_background"],
        "Tiene",
        "Fondo de cabecera",
    ),
    (
        r"values",
        r"fontFamily|fontSize|bold|italic|fontColor",
        ["table_cell_font"],
        "Tiene",
        "Fuente de celdas",
    ),
    (
        r"values",
        r"backColorSecondary",
        ["table_stripe_color"],
        "Tiene",
        "Filas alternas",
    ),
    (
        r"grid",
        r"gridHorizontalColor|gridVerticalColor|outlineColor",
        ["table_grid_color"],
        "Parcial",
        "Un color para toda la rejilla",
    ),
    (r"total", r"totals", ["show_totals"], "Tiene", "Totales"),
    (
        r"columnFormatting",
        r"dataBars",
        ["show_cell_bars"],
        "Parcial",
        "Barras en todas las columnas",
    ),
    (
        r"columnFormatting",
        r".*",
        ["column_config"],
        "Parcial",
        "Por columna, revisar cobertura",
    ),
    (
        r"rowTotal|columnTotal",
        r"applyToHeaders",
        ["rowTotals", "colTotals"],
        "Parcial",
        "Solo mostrar",
    ),
    (
        r"subTotals",
        r"rowSubtotals|columnSubtotals|rowSubtotalsPosition",
        ["rowSubTotals", "colSubTotals"],
        "Tiene",
        "Subtotales",
    ),
]
TABLE_RULES = [
    (
        "columnFormatting",
        "alignment|backColor|dataBars|fontColor|labelDisplayUnits|labelPrecision|styleHeader|styleSubtotals|styleTotal|styleValues",
        ["fmt_table4"],
        "Tiene",
        "Formato por columna; colores condicionales prevalecen",
    ),
    (
        "grid",
        "gridHorizontal|gridHorizontalColor|gridHorizontalWeight|gridVertical|gridVerticalColor|gridVerticalWeight|imageHeight|imageWidth|outlineColor|outlineStyle|outlineWeight|rowPadding|textSize",
        ["fmt_table4"],
        "Tiene",
        "Cuadrícula por dirección, contorno, relleno y tamaño explícitos",
    ),
    (
        "columnHeaders|rowHeaders",
        "alignment|backColor|bold|fontColor|fontFamily|fontSize|italic|outlineColor|outlineStyle|outlineWeight|underline|wordWrap",
        ["fmt_table4"],
        "Tiene",
        "Estilos de encabezado propios",
    ),
    (
        "columnHeaders",
        "autoSizeColumnWidth|columnAdjustment|defaultColumnWidth|customColumnWidth",
        ["fmt_table4"],
        "Tiene",
        "Ajuste al contenido o ancho fijo; ancho mínimo por columna",
    ),
    (
        "columnHeaders",
        "customColumnWidthGranularView",
        ["fmt_table4"],
        "Falta",
        "El ancho se configura por campo o métrica, no por cada valor de una jerarquía",
    ),
    (
        "columnHeaders",
        "titleAlignment",
        ["fmt_table4"],
        "Tiene",
        "Alineación independiente de los títulos de encabezado",
    ),
    (
        "columnHeaders|rowHeaders",
        "autoExpand",
        ["fmt_table4"],
        "Tiene",
        "Profundidad inicial independiente para filas y columnas",
    ),
    (
        "columnHeaders|rowHeaders",
        "expandCollapseButtonsColor|expandCollapseButtonsSize|showExpandCollapseButtons",
        ["fmt_table4"],
        "Tiene",
        "Iconos de expansión con color, tamaño y visibilidad comunes",
    ),
    (
        "columnHeaders|rowHeaders",
        "urlIcon",
        ["fmt_table4"],
        "Tiene",
        "Icono para enlaces web explícitos en encabezados",
    ),
    (
        "rowHeaders",
        "repeatRowHeaders|stepped|steppedLayoutIndentation",
        ["fmt_table4"],
        "Tiene",
        "Disposición escalonada, sangría y repetición de etiquetas",
    ),
    (
        "rowHeaders",
        "expandCompositeHierarchy",
        ["fmt_table4"],
        "Falta",
        "Sin jerarquías compuestas ni expansión selectiva por campo",
    ),
    (
        "rowHeaders",
        "legacyStyleDisabled",
        ["fmt_table4"],
        "Excluido",
        "Compatibilidad de estilos antiguos de Power BI; no aplica al motor",
    ),
    (
        "rowHeaders",
        "unfrozen",
        ["fmt_table4"],
        "Falta",
        "No hay fijación independiente del encabezado de fila",
    ),
    (
        "total|columnTotal|rowTotal|subTotals",
        "backColor|bold|fontColor|fontFamily|fontSize|italic|outlineColor|outlineStyle|outlineWeight|underline",
        ["fmt_table4"],
        "Tiene",
        "Estilo propio para total, subtotal y totales generales por dirección",
    ),
    (
        "total|columnTotal|rowTotal|subTotals",
        "applyToHeaders",
        ["fmt_table4"],
        "Tiene",
        "Interruptor independiente para aplicar el estilo a las etiquetas",
    ),
    ("total", "label", ["fmt_table4"], "Tiene", "Etiqueta del resumen de la tabla"),
    (
        "subTotals",
        "rowSubtotalsLabel|columnSubtotalsLabel",
        ["fmt_table4"],
        "Tiene",
        "Etiqueta de subtotales por dirección",
    ),
    (
        "subTotals",
        "perColumnLevel|perRowLevel|levelSubtotalEnabled",
        ["fmt_table4"],
        "Tiene",
        "Selección de niveles de subtotal; los grupos contraídos conservan su agregado",
    ),
    (
        "subTotals",
        "levelSubtotalLabel",
        ["fmt_table4"],
        "Tiene",
        "Etiqueta por nivel desde la configuración de su campo",
    ),
    (
        "values",
        "backColor|backColorPrimary|backColorSecondary|bold|fontColor|fontColorPrimary|fontColorSecondary|fontFamily|fontSize|italic|outlineColor|outlineStyle|outlineWeight|underline|wordWrap",
        ["fmt_table4"],
        "Tiene",
        "Estilo de valores y filas alternas; formato condicional tiene prioridad",
    ),
    (
        "values",
        "bandedRowHeaders",
        ["fmt_table4"],
        "Tiene",
        "Alternado opcional también en los encabezados de fila",
    ),
    (
        "values",
        "icon",
        ["fmt_table4"],
        "Tiene",
        "Reglas de iconos numéricos por métrica en tabla y matriz",
    ),
    (
        "values",
        "urlIcon|webURL",
        ["fmt_table4"],
        "Tiene",
        "Enlace web explícito http/https, con icono y etiqueta accesible",
    ),
    (
        "values",
        "valuesOnRow",
        ["fmt_table4"],
        "Tiene",
        "Orientación de métricas por filas o columnas, sin nueva consulta",
    ),
    (
        "sparklines",
        "chartType|dataColor|markerColor|markerShape|markerSize|markers|strokeWidth",
        ["fmt_table4"],
        "Parcial",
        "Línea/columnas y marcadores: matriz sobre grupos de columnas visibles; tabla "
        "requiere listas numéricas ordenadas, sin nuevo rol temporal ni consulta adicional",
    ),
    (
        "columnWidth",
        "value",
        ["fmt_table4"],
        "Tiene",
        "Ancho mínimo por columna y ancho predeterminado",
    ),
    (
        "blankRows",
        "blankRowColor|blankRowTransparency|borderColor|borderPosition|borderTransparency|borderWidth|showBlankRows|showBorder",
        ["fmt_table4"],
        "Tiene",
        "Separador entre grupos de primer nivel; color con alfa y contorno por lado",
    ),
]

# Family-specific mappings are intentionally narrow: an ECharts label is not HTML.
FAMILY_RULES = [
    (
        r"labels",
        r"labelDisplayUnits|labelPrecision",
        ["fmt_special6"],
        "Tiene",
        "Unidades y decimales de etiquetas",
    ),
    (
        r"labels",
        r"labelPosition|position",
        ["fmt_special6"],
        "Parcial",
        "Posiciones explícitas del motor; sin preferencia automática",
    ),
    (
        r"labels",
        r"labelOrientation",
        ["fmt_special6"],
        "Tiene",
        "Rotación de etiquetas",
    ),
    (
        r"labels",
        r"overflow",
        ["fmt_special6"],
        "Tiene",
        "Ancho máximo, truncado o ajuste de etiquetas",
    ),
    (
        r"labels",
        r"percentageLabelPrecision",
        ["fmt_pie56", "fmt_funnel56"],
        "Tiene",
        "Decimales del porcentaje",
    ),
    (
        r"dataPoint|markers",
        r"borderColor|borderColorMatchFill|borderOutlineOnly|borderShow|borderSize|borderWidth|borderTransparency|fillTransparency",
        ["fmt_special6"],
        "Tiene",
        "Colores y bordes",
    ),
    (
        r"dataPoint",
        r"defaultColor|fill|showAllDataPoints",
        [
            "fmt_pie56",
            "fmt_funnel56",
            "fmt_treemap56",
            "fmt_waterfall56",
            "fmt_scatter56",
            "fmt_bubble56",
        ],
        "Tiene",
        "Color por categoría y color predeterminado",
    ),
    (
        r"dataPoint",
        r"fillRule",
        ["fmt_special6"],
        "Parcial",
        "Escala continua de dos colores; sin reglas por campo",
    ),
    (r"legend", r"showTitle|titleText", ["fmt_special6"], "Tiene", "Título de leyenda"),
    (r"slices", r"startAngle", ["fmt_pie56"], "Tiene", "Ángulo inicial"),
    (
        r"centerBackground",
        r"show|fillColor|transparency|padding",
        ["fmt_pie56"],
        "Tiene",
        "Fondo circular del valor central",
    ),
    (
        r"centerBackground",
        r"image.*|fit",
        ["fmt_pie56"],
        "Falta",
        "Sin imagen central: requiere carga, selección y ajuste",
    ),
    (r"centerValue", r"show", ["fmt_pie56"], "Tiene", "Mostrar valor central"),
    (
        r"value",
        r"bold|fontColor|fontFamily|fontSize|italic|labelDisplayUnits|labelPrecision|show",
        ["fmt_pie56"],
        "Tiene",
        "Fuente y formato del valor central",
    ),
    (
        r"label",
        r"text|show",
        ["fmt_pie56"],
        "Parcial",
        "Prefijo del valor central; sin etiqueta independiente",
    ),
    (
        r"categoryAxis|categoryLabels",
        r"show|bold|color|fontFamily|fontSize|italic",
        ["fmt_funnel56", "fmt_treemap56", "fmt_gauge56"],
        "Tiene",
        "Fuente y visibilidad de categoría",
    ),
    (
        r"percentBarLabel",
        r"show|bold|color|fontFamily|fontSize|italic",
        ["fmt_funnel56"],
        "Tiene",
        "Porcentaje real de conversión y fuente propia",
    ),
    (
        r"labels",
        r"funnelLabelStyle",
        ["fmt_funnel56"],
        "Tiene",
        "Categoría, valor y porcentaje",
    ),
    (
        r"layout",
        r"innerPadding|outerPadding",
        ["fmt_treemap56"],
        "Tiene",
        "Espacio entre nodos y grupos",
    ),
    (
        r"layout",
        r"tilingMethod",
        ["fmt_treemap56"],
        "Falta",
        "ECharts no ofrece los algoritmos de disposición de Power BI",
    ),
    (
        r"calloutValue",
        r"show|bold|color|fontFamily|italic|labelDisplayUnits|labelPrecision",
        ["fmt_gauge56"],
        "Tiene",
        "Fuente y formato del valor del medidor",
    ),
    (
        r"calloutValue",
        r"showDynamicLabels|dynamicLabelValue",
        ["fmt_gauge56"],
        "Parcial",
        "Etiqueta manual con {value}; sin campo dinámico",
    ),
    (
        r"axis",
        r"target",
        ["fmt_gauge56"],
        "Parcial",
        "Objetivo numérico; sin campo de objetivo",
    ),
    (
        r"target",
        r"show|bold|color|fontFamily|fontSize|italic|labelDisplayUnits|labelPrecision",
        ["fmt_gauge56"],
        "Parcial",
        "Puntero y fuente propios; unidades y decimales compartidos con valor",
    ),
    (r"dataPoint", r"target", ["fmt_gauge56"], "Tiene", "Color del objetivo"),
    (
        r"breakdown",
        r"maxBreakdowns",
        ["fmt_waterfall56"],
        "Falta",
        "Requiere reagrupar consulta y preservar filtros de Otros",
    ),
    (
        r"bubbles",
        r"bubbleSize",
        ["fmt_special6"],
        "Tiene",
        "Multiplicador del tamaño de las burbujas",
    ),
    (
        r"bubbles",
        r"preventOverflow|markerRangeType",
        ["fmt_special6"],
        "Falta",
        "Sin ajuste de escala para contener marcadores ni modos de rango",
    ),
    (
        r"plotAreaShading",
        r"show|lowerShadingColor|upperShadingColor|transparency",
        ["fmt_special6"],
        "Tiene",
        "Semiplanos reales respecto de y=x; solo ejes numéricos lineales",
    ),
    (
        r"ratioLine",
        r"show|displayName|lineColor|style|transparency|width",
        ["fmt_special6"],
        "Tiene",
        "Línea y=x sobre el intervalo visible; solo ejes numéricos lineales",
    ),
]
NEW_CARD_RULES = [
    (
        r"labels|indicator|value",
        r"fontFamily|fontSize|fontColor|color|bold|italic|underline|horizontalAlignment|show|showBlankAs|textWrap|labelDisplayUnits|labelPrecision|indicatorDisplayUnits|indicatorPrecision",
        ["fmt_card5"],
        "Tiene",
        "Valor destacado: fuente, unidades y decimales",
    ),
    (
        r"categoryLabels|label",
        r"show|fontSize|color|fontColor|bold|italic|fontFamily|underline|textWrap|text|position|gap",
        ["fmt_card5"],
        "Tiene",
        "Etiqueta de categoría: texto, fuente, posición y separación",
    ),
    (
        r"labels|categoryLabels",
        r"preserveWhitespace",
        ["fmt_card5"],
        "Parcial",
        "Control de ajuste de texto; sin preservar espacios múltiples",
    ),
    (r"wordWrap", r"show", ["fmt_card5"], "Tiene", "Ajuste de texto por bloque"),
    (
        r"indicator",
        r"verticalAlignment",
        ["fmt_card5"],
        "Tiene",
        "Alineación vertical del contenido",
    ),
    (
        r"indicator",
        r"iconSize|showIcon",
        ["fmt_card5"],
        "Tiene",
        "Icono accesible de estado",
    ),
    (
        r"status",
        r"badColor|direction|goodColor|neutralColor",
        ["fmt_card5"],
        "Tiene",
        "Comparación contra objetivo, dirección favorable y margen neutro",
    ),
    (
        r"lastDate",
        r"bold|fontSize|italic|lastDateFontColor|lastDateFontFamily|underline",
        ["fmt_card5"],
        "Tiene",
        "Fuente de última fecha",
    ),
    (
        r"goals",
        r"bold|distanceFontColor|distanceFontFamily|fontSize|goalFontColor|goalFontFamily|goalText|italic|showDistance|showGoal|underline",
        ["fmt_card5"],
        "Tiene",
        "Objetivo fijo o métrica: texto y distancia con fuente propia",
    ),
    (
        r"goals",
        r"titleBold|titleFontSize|titleItalic|titleUnderline|labelPrecision",
        ["fmt_card5"],
        "Parcial",
        "Fuente de la fila completa; unidades y decimales compartidos con indicador",
    ),
    (
        r"goals",
        r"distanceLabel",
        ["fmt_card5"],
        "Parcial",
        "Valor absoluto o porcentaje; sin mostrar ambos a la vez",
    ),
    (
        r"goals",
        r"direction",
        ["fmt_card5"],
        "Parcial",
        "Dirección favorable compartida con estado; distancia con signo aritmético",
    ),
    (
        r"trendline",
        r"transparency",
        ["fmt_card5"],
        "Tiene",
        "Transparencia de tendencia",
    ),
]
CARD_RULES = [
    (
        r"labels",
        r"fontSize|color|bold|italic",
        [F],
        "Tiene",
        "Formato > Valor de la tarjeta",
    ),
    (
        r"indicator",
        r"fontSize|fontColor|bold|italic",
        [F],
        "Tiene",
        "Formato > Valor de la tarjeta",
    ),
    (
        r"indicator",
        r"indicatorDisplayUnits|indicatorPrecision",
        ["y_axis_format"],
        "Parcial",
        "Con código d3",
    ),
    (
        r"labels",
        r"labelDisplayUnits|labelPrecision",
        ["y_axis_format"],
        "Parcial",
        "Con código d3",
    ),
    (
        r"value",
        r"fontSize|fontColor|bold|italic",
        [F],
        "Tiene",
        "Formato > Valor de la tarjeta",
    ),
    (
        r"categoryLabels|label",
        r"show|fontSize|color|fontColor|bold|italic",
        [F],
        "Tiene",
        "Formato > Etiqueta de la tarjeta",
    ),
    (
        r"referenceLabelValue",
        r"valueFontSize|valueFontColor|valueBold|valueItalic",
        [F],
        "Tiene",
        "Formato > Valor de la tarjeta",
    ),
]
FILTER_RULES = [
    (
        r"header",
        r"background|bold|fontColor|fontFamily|italic|outlineStyle|show|textSize|underline",
        ["ok"],
        "Tiene",
        "Segmentador: encabezado",
    ),
    (r"header", r"text", ["none"], "Falta", "El encabezado es el nombre del filtro"),
    (
        r"items",
        r"background|bold|fontColor|fontFamily|italic|padding|textSize|underline",
        ["ok"],
        "Tiene",
        "Segmentador: valores de lista y botones",
    ),
    (
        r"label|value",
        r"bold|fontColor|fontFamily|fontSize|italic|show|textWrap|underline|text",
        ["ok"],
        "Tiene",
        "Segmentador: valores",
    ),
    (
        r"layout",
        r"columnCount|orientation|style|columnPadding|rowPadding|cellPadding|borderColor|borderWidth"
        r"|backgroundFillColor|backgroundShow|rectangleRoundedCurve",
        ["ok"],
        "Tiene",
        "Segmentador: disposición de lista, botones o cuadrícula",
    ),
    (
        r"layout",
        r"rowCount|autoGrid|maxTiles|alignment",
        ["none"],
        "Falta",
        "Las filas salen de los valores y las columnas",
    ),
    (
        r"selection",
        r"selectAllCheckboxEnabled",
        ["ok"],
        "Tiene",
        "Segmentador: seleccionar todo",
    ),
    (
        r"selection",
        r"singleSelect|strictSingleSelect",
        ["ok"],
        "Tiene",
        "Sigue la selección múltiple del filtro",
    ),
    (
        r"selectionIcon",
        r"show|color",
        ["ok"],
        "Tiene",
        "Segmentador: marca de selección",
    ),
    (
        r"search",
        r"backgroundColor|backgroundShow|borderColor|borderShow|cornerRadius|fontColor",
        ["ok"],
        "Tiene",
        "Segmentador: caja de búsqueda",
    ),
    (
        r"searchBox",
        r"fontColor|background",
        ["ok"],
        "Tiene",
        "Segmentador: caja de búsqueda",
    ),
    (
        r"inputText|inputTextBox",
        r"fontColor|fontFamily|fontSize|bold|italic|backgroundColor|borderColor",
        ["ok"],
        "Parcial",
        "Segmentador de texto: colores de la caja",
    ),
    (
        r"dropdown",
        r"borderColor|borderRadius",
        ["ok"],
        "Tiene",
        "Filtro de lienzo: caja",
    ),
    (
        r"dropdown|pills|search",
        r"accentBar.*|cornerRadius.+|individual.*|padding.+|dismiss.*|.*Transparency",
        ["none"],
        "Falta",
        "P2 de detalle sin hacer",
    ),
    (r"header", r"show", ["ok"], "Tiene", "Filtro de lienzo: ocultar etiqueta"),
    (
        r"header",
        r"textSize|bold|fontColor",
        ["ok"],
        "Tiene",
        "Filtro de lienzo: etiqueta",
    ),
    (r"items", r"fontColor|background", ["ok"], "Tiene", "Filtro de lienzo: caja"),
    (r"selection", r"singleSelect", ["ok"], "Parcial", "Ajuste del filtro nativo"),
]
PRI = {
    1: "title subTitle background border dropShadow padding divider general visualHeader categoryAxis valueAxis y2Axis labels legend dataPoint layout lineStyles markers totals columnHeaders rowHeaders values grid total subTotals rowTotal columnTotal columnFormatting calloutValue value label slices centerValue centerBackground categoryLabels indicator status goals trendline lastDate target axis sentimentColors bubbles selection items header dropdown".split(),
    2: "visualTooltip visualHeaderTooltip visualLink spacing plotArea referenceLine xAxisReferenceLine y1AxisReferenceLine trend zoom smallMultiplesLayout seriesLabels forecast sparklines blankRows columnWidth search selectionIcon pills percentBarLabel breakdown colorByCategory colorBorder fillPoint ratioLine plotAreaShading dataLabels cardTitle card".split(),
}


def prio(c, p=""):
    if (
        c == "visualHeader"
        and p.startswith("show")
        and p not in ("show", "showOptionsMenu", "showFilterRestatementButton")
    ):
        return 3
    if c == "general" and p in (
        "allowBinnedLineSample",
        "allowOverlappingPointsSample",
        "keepLayerOrder",
    ):
        return 3
    for k, l in PRI.items():
        if c in l:
            return k
    return 3


SEC = {
    "title": "Título",
    "subTitle": "Subtítulo",
    "background": "Fondo",
    "border": "Borde",
    "dropShadow": "Sombra",
    "padding": "Relleno",
    "divider": "Divisor",
    "general": "Propiedades",
    "visualHeader": "Iconos de cabecera",
    "visualHeaderTooltip": "Tooltip de iconos",
    "visualTooltip": "Tooltips",
    "visualLink": "Acción",
    "spacing": "Espaciado",
    "lockAspect": "Bloquear proporción",
    "categoryAxis": "Eje X / categorías",
    "valueAxis": "Eje Y / valores",
    "y2Axis": "Eje Y secundario",
    "labels": "Etiquetas de datos",
    "legend": "Leyenda",
    "dataPoint": "Colores / barras",
    "layout": "Disposición",
    "lineStyles": "Líneas",
    "markers": "Marcadores",
    "plotArea": "Fondo del área de trazado",
    "referenceLine": "Línea de referencia",
    "xAxisReferenceLine": "Línea de referencia X",
    "y1AxisReferenceLine": "Línea de referencia Y",
    "trend": "Línea de tendencia",
    "zoom": "Control deslizante de zoom",
    "smallMultiplesLayout": "Múltiplos pequeños",
    "seriesLabels": "Etiquetas de serie",
    "forecast": "Pronóstico",
    "error": "Barras de error",
    "anomalyDetection": "Anomalías",
    "totals": "Etiquetas de total",
    "ribbonBands": "Cintas",
    "subheader": "Encabezado de múltiplos",
    "annotationTemplate": "Anotaciones",
    "columnHeaders": "Encabezados de columna",
    "rowHeaders": "Encabezados de fila",
    "values": "Valores",
    "grid": "Cuadrícula",
    "total": "Totales",
    "subTotals": "Subtotales",
    "rowTotal": "Total general de filas",
    "columnTotal": "Total general de columnas",
    "columnFormatting": "Columna específica",
    "sparklines": "Minigráficos",
    "blankRows": "Filas en blanco",
    "calloutValue": "Valor principal",
    "categoryLabels": "Etiqueta de categoría",
    "slices": "Porciones",
    "centerValue": "Valor central",
    "indicator": "Indicador",
    "status": "Estado",
    "goals": "Objetivo",
    "trendline": "Tendencia",
    "lastDate": "Fecha",
}
GEN = set(common) - {"*"}


def typ_short(t):
    return re.sub(r"\s+", " ", t)[:140]


rows = []
summary = {}


def status(v, c, p):
    o = V2O[v]
    if o == "MAP":
        return "Por decidir", "Comparar con deck.gl y country_map: otro modelo de capas"
    rules = TABLE_RULES + RULES if o in ("table", "pivot") else FAMILY_RULES + RULES
    if o in ("bigtotal", "bigtrend"):
        rules = NEW_CARD_RULES + CARD_RULES + RULES
    if o == "FILTER":
        rules = FILTER_RULES + [
            x for x in RULES if x[2] is None or x[2] == [F] or x[0] == "general"
        ]
    S = set() if o in (None, "FILTER") else OURS[o]
    for cr, pr, ctrl, st, note in rules:
        if re.fullmatch(cr, c) and re.fullmatch(pr, p):
            if ctrl is None or ctrl == ["none"]:
                return st, note
            if ctrl == [F] or ctrl == ["ok"] or S & set(ctrl):
                # the box format of the dashboard is available to every chart
                return st, note + (
                    ""
                    if ctrl in ([F], ["ok"]) or ctrl[0].startswith("fmt_")
                    else " (" + "/".join(sorted(S & set(ctrl))) + ")"
                )
    if o is None:
        return "Falta", "No tenemos este gráfico"
    return "Falta", ""


for v, o in V2O.items():
    d = R["visual-" + v]
    path = os.path.join(OUT, "por-grafico", v + ".md")
    cnt = {}
    lines = []
    cards = sorted(
        [c for c in d if c != "*"], key=lambda c: (c in GEN, prio(c), SEC.get(c, c))
    )
    for tabname, sel in (
        ("Visual", lambda c: c not in GEN),
        ("General", lambda c: c in GEN),
    ):
        cs = [c for c in cards if sel(c) and d[c]]
        if not cs:
            continue
        lines.append(f"\n## {tabname}\n")
        for c in cs:
            rs = []
            for p, m in sorted(d[c].items()):
                st, note = status(v, c, p)
                t = m["title"] or p
                pr = prio(c, p)
                rows.append(
                    dict(
                        grafico=v,
                        grafico_es=ES[v],
                        pestana=tabname,
                        seccion=SEC.get(c, c),
                        tarjeta=c,
                        propiedad=p,
                        titulo=t,
                        tipo=typ_short(m["type"]),
                        descripcion=m["desc"],
                        prioridad=pr,
                        estado=st,
                        nota=note,
                    )
                )
                cnt[st] = cnt.get(st, 0) + 1
                rs.append(
                    (
                        p,
                        t,
                        typ_short(m["type"]).replace("|", "/"),
                        st,
                        note.replace("|", "/"),
                    )
                )
            have = sum(1 for r in rs if r[3] in ("Tiene", "Parcial"))
            lines.append(
                f"\n### {SEC.get(c, c)} (`{c}`) · P{prio(c)} · {have}/{len(rs)}\n\n| Opción | Clave | Valores | Estado | Nota |\n| --- | --- | --- | --- | --- |"
            )
            lines += [f"| {t} | `{p}` | {ty} | {st} | {n} |" for p, t, ty, st, n in rs]
    summary[v] = dict(cnt=cnt, ours=o)
    head = f"# {ES[v]} (`{v}`)\n\nNuestro gráfico: {o if o not in (None, 'MAP', 'FILTER') else {'MAP': 'mapas, sin cruzar', 'FILTER': 'filtro nativo y filtro de lienzo', None: 'ninguno'}[o]}. Generado desde `reportThemeSchema-2.159.json`.\n"
    open(path, "w").write(head + "\n".join(lines) + "\n")
with open(os.path.join(OUT, "opciones.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)


# The phase of the plan each chart belongs to; some sections go to their own
CHART_PHASE = {
    **dict.fromkeys(
        (
            "barChart",
            "columnChart",
            "clusteredBarChart",
            "clusteredColumnChart",
            "hundredPercentStackedBarChart",
            "hundredPercentStackedColumnChart",
            "lineChart",
            "areaChart",
            "stackedAreaChart",
            "hundredPercentStackedAreaChart",
            "lineClusteredColumnComboChart",
            "lineStackedColumnComboChart",
        ),
        3,
    ),
    **dict.fromkeys(("tableEx", "pivotTable"), 4),
    **dict.fromkeys(("card", "kpi", "pieChart", "donutChart"), 5),
    **dict.fromkeys(
        ("waterfallChart", "funnel", "treemap", "gauge", "scatterChart"), 6
    ),
    **dict.fromkeys(
        ("slicer", "listSlicer", "textSlicer", "advancedSlicerVisual"),
        7,
    ),
    **dict.fromkeys(("map", "filledMap", "shapeMap", "azureMap"), 11),
    **dict.fromkeys(("ribbonChart", "multiRowCard", "cardVisual"), 12),
}
SECTION_PHASE = {
    **dict.fromkeys(
        (
            "Línea de referencia",
            "Línea de referencia X",
            "Línea de referencia Y",
            "Línea de tendencia",
            "Control deslizante de zoom",
            "Múltiplos pequeños",
            "Encabezado de múltiplos",
            "Anotaciones",
            "Tooltips",
            "Tooltip de iconos",
        ),
        8,
    ),
    **dict.fromkeys(("Barras de error", "Anomalías", "Pronóstico", "Cintas"), 12),
}
PHASE_NAME = {
    2: "General, común a todos",
    3: "Barras, columnas, líneas, áreas y combinados",
    4: "Tabla y matriz",
    5: "Tarjeta, KPI, circular y anillo",
    6: "Cascada, embudo, treemap, medidor y dispersión",
    7: "Segmentadores",
    8: "Análisis y tooltips",
    11: "Mapas",
    12: "Resto de P3 y gráficos nuevos",
}


def phase_of(row):
    """The phase of the plan an option of the inventory belongs to."""
    chart_phase = CHART_PHASE[row["grafico"]]
    # A chart still to build or to decide takes all its options with it
    if chart_phase >= 7:
        return chart_phase
    if row["seccion"] in SECTION_PHASE:
        return SECTION_PHASE[row["seccion"]]
    return 2 if row["pestana"] == "General" else chart_phase


def write_summary():
    """Writes the coverage by chart and the list of what is left, by phase."""
    charts = {}
    for row in rows:
        counts = charts.setdefault(row["grafico_es"], {})
        counts[row["estado"]] = counts.get(row["estado"], 0) + 1
    out = [
        "# Cobertura de Power BI",
        "",
        "Generado por `scripts/mibi/format_inventory.py`: no lo edites a mano. El estado sale de comparar",
        "nombres de controles, no de probar cada opción.",
        "",
        "| Gráfico | Aplican | Tiene | % | Parcial | Falta | Por decidir | Excluido |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for name, counts in sorted(
        charts.items(), key=lambda item: -item[1].get("Tiene", 0)
    ):
        applies = sum(n for state, n in counts.items() if state != "Excluido")
        have = counts.get("Tiene", 0)
        out.append(
            f"| {name} | {applies} | {have} | {round(100 * have / applies)} % "
            f"| {counts.get('Parcial', 0)} | {counts.get('Falta', 0)} "
            f"| {counts.get('Por decidir', 0)} | {counts.get('Excluido', 0)} |"
        )
    with open(os.path.join(OUT, "cobertura.md"), "w") as f:
        f.write("\n".join(out) + "\n")

    pending = {}
    for row in rows:
        if row["estado"] not in ("Falta", "Parcial", "Por decidir"):
            continue
        key = (row["seccion"], row["propiedad"])
        entry = pending.setdefault(phase_of(row), {}).setdefault(
            key,
            {
                "titulo": row["titulo"],
                "estado": row["estado"],
                "nota": row["nota"],
                "prioridad": row["prioridad"],
                "graficos": set(),
            },
        )
        entry["graficos"].add(row["grafico_es"])
    out = [
        "# Lo que falta de Power BI, por fase",
        "",
        "Generado por `scripts/mibi/format_inventory.py`: no lo edites a mano. Cada opción sale una vez, con los",
        "gráficos donde falta. Lo que ya tenemos de cada gráfico está en [`por-grafico/`](por-grafico/).",
        "",
        "| Fase | Qué | Opciones abiertas | P1 | P2 | P3 |",
        "| ---: | --- | ---: | ---: | ---: | ---: |",
    ]
    for phase in sorted(pending):
        items = pending[phase].values()
        by_priority = [
            sum(1 for item in items if str(item["prioridad"]) == str(p))
            for p in (1, 2, 3)
        ]
        out.append(
            f"| {phase} | {PHASE_NAME[phase]} | {len(items)} "
            f"| {by_priority[0]} | {by_priority[1]} | {by_priority[2]} |"
        )
    for phase in sorted(pending):
        out += ["", f"## Fase {phase}: {PHASE_NAME[phase]}"]
        sections = {}
        for (section, prop), item in pending[phase].items():
            sections.setdefault(section, []).append((prop, item))
        for section in sorted(sections):
            out += [
                "",
                f"### {section}",
                "",
                "| Opción | Clave | P | Estado | Gráficos | Nota |",
                "| --- | --- | ---: | --- | ---: | --- |",
            ]
            for prop, item in sorted(sections[section]):
                title = (item["titulo"] or prop).replace("|", "/")
                note = item["nota"].replace("|", "/")
                out.append(
                    f"| {title} | `{prop}` | {item['prioridad']} | {item['estado']} "
                    f"| {len(item['graficos'])} | {note} |"
                )
    with open(os.path.join(OUT, "pendientes.md"), "w") as f:
        f.write("\n".join(out) + "\n")


write_summary()

total = {}
for row in rows:
    total[row["estado"]] = total.get(row["estado"], 0) + 1
print(len(rows), total)
