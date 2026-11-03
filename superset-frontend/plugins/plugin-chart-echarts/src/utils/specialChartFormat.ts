/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  toCssColor,
  toBoundedNumber,
  type ColorInput,
  type FontStyleValue,
} from '@superset-ui/core';
import type { CustomSeriesRenderItem } from 'echarts/types/src/chart/custom/CustomSeries';
import {
  applyAxisFormatting,
  getEchartsTextStyle,
  applyLegendFormatting,
  applySeriesStyle,
  parseDashArray,
} from './formatting';
import {
  applyChartFormat,
  applySeriesFormat,
  getDisplayFormatter,
  mixColors,
  xAxisFormatOptions,
  yAxisFormatOptions,
} from './chartFormatOptions';
import type { VisualFormatFormData } from '../types';

type Node = Record<string, unknown>;
type Kind =
  | 'pie'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'waterfall'
  | 'scatter'
  | 'bubble';
type Format = VisualFormatFormData & Record<string, unknown>;
const record = (value: unknown): Node =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : {};
const set = (value: unknown) =>
  value !== undefined && value !== null && value !== '';
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const color = (value: unknown) => toCssColor(value as ColorInput);
const font = (value: unknown) =>
  getEchartsTextStyle(value as FontStyleValue | null);
const bound = (value: unknown, fallback: number, min: number, max: number) =>
  toBoundedNumber(value as number | undefined, fallback, min, max);
const valueOf = (point: unknown): number | undefined => {
  const item = record(point);
  const value = item.originalValue ?? item.value ?? point;
  if (finite(value)) return value;
  if (Array.isArray(value) && finite(value[1])) return value[1];
  return undefined;
};
const metricValue = (params: Node) =>
  valueOf(record(params.data).originalValue ?? params.value ?? params.data);
const safeRich = (value: unknown) => String(value ?? '').replace(/[{}|]/g, '');

const FUNNEL_LABEL_TYPES = [
  'key',
  'value',
  'percent',
  'key_value',
  'key_percent',
  'key_value_percent',
  'value_percent',
];

/** A real category/value/percentage formatter, keeping the saved label content. */
function labelFormatter(
  kind: Kind,
  format: Format,
  fallback: (value: number) => string,
) {
  const numeric =
    getDisplayFormatter(format.valueLabelUnits, format.valueLabelDecimals) ??
    fallback;
  const percent = getDisplayFormatter(
    'none',
    format.specialPercentDecimals as number | undefined,
    true,
  );
  return (raw: unknown) => {
    const params = record(raw);
    const datum = record(params.data);
    const value = metricValue(params);
    const name = safeRich(params.name);
    let ratio: unknown = finite(params.percent)
      ? params.percent / 100
      : undefined;
    if (kind === 'funnel') {
      ratio = String(format.percentCalculationType).includes('previous')
        ? datum.prevStepPercent
        : String(format.percentCalculationType).includes('total')
          ? ratio
          : datum.firstStepPercent;
    }
    const percentage = finite(ratio)
      ? (percent ?? getDisplayFormatter('none', 2, true))!(ratio)
      : '';
    const valueText = value === undefined ? '' : numeric(value);
    const saved = format.labelType;
    const type = String(
      format.specialLabelStyle ??
        // A funnel saves the position of its choice in a list
        (typeof saved === 'number' ? FUNNEL_LABEL_TYPES[saved] : saved) ??
        (kind === 'treemap' ? 'key_value' : 'key'),
    );
    const category = `{category|${name}}`;
    const amount = `{value|${safeRich(valueText)}}`;
    const share = `{percent|${safeRich(percentage)}}`;
    if (format.labelTemplate && type === 'template')
      return String(format.labelTemplate)
        .replace(/\{(?:name|b)\}/g, name)
        .replace(/\{(?:value|c)\}/g, valueText)
        .replace(/\{(?:percent|d)\}/g, percentage);
    const parts: string[] = [];
    if (
      format.specialCategoryShow !== false &&
      (type.includes('key') || type === 'category' || type === 'all')
    )
      parts.push(category);
    if (type.includes('value') || type === 'all') parts.push(amount);
    if (
      (type.includes('percent') ||
        type === 'all' ||
        format.funnelPercentShow === true) &&
      format.funnelPercentShow !== false &&
      percentage
    )
      parts.push(share);
    return parts.join(': ');
  };
}

/** Clip a plot rectangle against the y=x line, in rendered pixel coordinates. */
function halfPlane(
  points: number[][],
  side: (point: number[]) => number,
  upper: boolean,
): number[][] {
  const output: number[][] = [];
  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const a = side(previous) * (upper ? 1 : -1);
    const b = side(point) * (upper ? 1 : -1);
    if (a >= 0 !== b >= 0) {
      const share = a / (a - b);
      output.push([
        previous[0] + (point[0] - previous[0]) * share,
        previous[1] + (point[1] - previous[1]) * share,
      ]);
    }
    if (b >= 0) output.push(point);
  });
  return output;
}

/** Numeric scatter extras use the actual values, never a synthetic trend. */
function scatterExtras(options: Node, list: Node[], format: Format) {
  const x = record(
    Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis,
  );
  const y = record(
    Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis,
  );
  if (x.type !== 'value' || y.type !== 'value') return;
  if (format.scatterRatioShow === true && list.length) {
    const points = list
      .flatMap(series => (Array.isArray(series.data) ? series.data : []))
      .map(point => (Array.isArray(point) ? point : record(point).value))
      .filter(
        (point): point is number[] =>
          Array.isArray(point) && finite(point[0]) && finite(point[1]),
      );
    if (points.length) {
      const extent = points.reduce(
        (range, point) => [
          Math.min(range[0], point[0]),
          Math.max(range[1], point[0]),
          Math.min(range[2], point[1]),
          Math.max(range[3], point[1]),
        ],
        [Infinity, -Infinity, Infinity, -Infinity],
      );
      const low = Math.max(
        finite(x.min) ? x.min : extent[0],
        finite(y.min) ? y.min : extent[2],
      );
      const high = Math.min(
        finite(x.max) ? x.max : extent[1],
        finite(y.max) ? y.max : extent[3],
      );
      if (low <= high)
        list[0] = {
          ...list[0],
          markLine: {
            ...record(list[0].markLine),
            silent: true,
            symbol: ['none', 'none'],
            label: {
              show: !!format.scatterRatioLabel,
              // Outside the plot it would go off the edge of the chart
              position: 'insideEndTop',
              formatter: String(format.scatterRatioLabel ?? ''),
            },
            lineStyle: {
              color: color(format.scatterRatioColor) ?? '#666',
              width: bound(format.scatterRatioWidth, 1, 0, 20),
              type:
                parseDashArray(format.scatterRatioDash) ??
                format.scatterRatioStyle ??
                'solid',
              opacity:
                1 - bound(format.scatterRatioTransparency, 0, 0, 100) / 100,
            },
            data: [
              ...(Array.isArray(record(list[0].markLine).data)
                ? (record(list[0].markLine).data as unknown[])
                : []),
              [{ coord: [low, low] }, { coord: [high, high] }],
            ],
          },
        };
    }
  }
  const firstPoint = list
    .flatMap(series => (Array.isArray(series.data) ? series.data : []))
    .map(point => (Array.isArray(point) ? point : record(point).value))
    .find(
      point => Array.isArray(point) && finite(point[0]) && finite(point[1]),
    );
  if (format.scatterShadingShow === true && firstPoint) {
    for (const upper of [false, true]) {
      const fill =
        color(upper ? format.scatterUpperColor : format.scatterLowerColor) ??
        (upper ? '#2563eb' : '#10b981');
      const renderItem: CustomSeriesRenderItem = (params, api) => {
        const rect = record(params.coordSys);
        if (
          !finite(rect.x) ||
          !finite(rect.y) ||
          !finite(rect.width) ||
          !finite(rect.height)
        )
          return undefined;
        const origin = api.coord([0, 0]);
        const diagonal = api.coord([1, 1]);
        if (!origin || !diagonal || diagonal[0] === origin[0]) return undefined;
        const slope = (diagonal[1] - origin[1]) / (diagonal[0] - origin[0]);
        const sign = Math.sign(api.coord([0, 1])[1] - origin[1]);
        const polygon = halfPlane(
          [
            [rect.x, rect.y],
            [rect.x + rect.width, rect.y],
            [rect.x + rect.width, rect.y + rect.height],
            [rect.x, rect.y + rect.height],
          ],
          point =>
            (point[1] - origin[1] - (point[0] - origin[0]) * slope) * sign,
          upper,
        );
        return {
          type: 'polygon',
          shape: { points: polygon },
          style: {
            fill,
            opacity:
              1 - bound(format.scatterShadingTransparency, 80, 0, 100) / 100,
          },
        };
      };
      list.push({
        id: `__mibi_shading_${upper}`,
        type: 'custom',
        coordinateSystem: 'cartesian2d',
        // A point the chart already has, so the axes keep their range
        data: [firstPoint],
        silent: true,
        tooltip: { show: false },
        z: 0,
        renderItem,
      });
    }
  }
}

/** Apply optional family controls to an existing option, preserving its data and hooks. */
export function applySpecialChartFormat<T extends object>(
  options: T,
  format: Format,
  kind: Kind,
  {
    width,
    height,
    formatter = (value: number) => String(value),
  }: { width: number; height: number; formatter?: (value: number) => string },
): T {
  const source = options as Node;
  const prefixes = [
    'special',
    'center',
    'gauge',
    'treemap',
    'waterfallConnector',
    'scatter',
    'valueLabel',
    'legend',
    'xAxis',
    'yAxis',
    'gridline',
    'series',
    'marker',
    'colorScale',
  ];
  if (
    !Object.entries(format).some(
      ([key, value]) =>
        set(value) && prefixes.some(prefix => key.startsWith(prefix)),
    )
  )
    return options;
  const next: Node = { ...source };
  let list = (Array.isArray(source.series) ? source.series : []).map(item => ({
    ...record(item),
  }));
  const numeric = getDisplayFormatter(
    format.valueLabelUnits,
    format.valueLabelDecimals,
  );
  const labelFont = font(format.valueLabelFont);
  const categoryFont = font(format.specialCategoryFont);
  const customText =
    !!numeric ||
    set(format.specialPercentDecimals) ||
    set(format.specialLabelStyle) ||
    set(format.specialCategoryShow) ||
    set(format.specialCategoryFont) ||
    set(format.funnelPercentShow) ||
    set(format.funnelPercentFont);
  const flatten = (data: unknown[]): Node[] =>
    data.flatMap(value => {
      const node = Array.isArray(value) ? { value } : record(value);
      return [
        node,
        ...(Array.isArray(node.children) ? flatten(node.children) : []),
      ];
    });
  const nodes = list.flatMap(series =>
    Array.isArray(series.data) ? flatten(series.data) : [],
  );
  const extent = nodes.reduce(
    (range, node) => {
      const value = valueOf(node);
      return value === undefined
        ? range
        : [Math.min(range[0], value), Math.max(range[1], value)];
    },
    [Infinity, -Infinity],
  );
  const minColor = color(format.colorScaleMin),
    maxColor = color(format.colorScaleMax);
  const dataStyle = (raw: unknown): unknown => {
    const node = record(raw);
    if (!Object.keys(node).length) return raw;
    const item: Node = { ...record(node.itemStyle) };
    const name = String(node.name ?? '');
    const categories = record(format.specialCategoryColors);
    let fill = color(categories[name]) ?? color(format.specialFillColor);
    const value = valueOf(node);
    if (!fill && minColor && maxColor && value !== undefined)
      fill = mixColors(
        minColor,
        maxColor,
        extent[1] === extent[0]
          ? 0.5
          : (value - extent[0]) / (extent[1] - extent[0]),
      );
    if (fill) item.color = fill;
    if (set(format.specialFillTransparency))
      item.opacity =
        (finite(item.opacity) ? item.opacity : 1) *
        (1 - bound(format.specialFillTransparency, 0, 0, 100) / 100);
    if (format.specialBorderShow === false) item.borderWidth = 0;
    else if (
      format.specialBorderShow === true ||
      set(format.specialBorderWidth) ||
      format.specialBorderOnly === true
    )
      item.borderWidth = bound(format.specialBorderWidth, 1, 0, 20);
    const border = format.specialBorderMatchFill
      ? item.color
      : color(format.specialBorderColor);
    if (border) item.borderColor = border;
    if (
      set(format.specialBorderTransparency) &&
      typeof item.borderColor === 'string'
    )
      item.borderColor = mixColors(
        item.borderColor,
        'rgba(0,0,0,0)',
        bound(format.specialBorderTransparency, 0, 0, 100) / 100,
      );
    if (format.specialBorderOnly === true) {
      item.borderColor = border ?? item.color;
      item.color = 'transparent';
    }
    if (kind === 'treemap') {
      if (set(format.treemapInnerPadding))
        item.gapWidth = bound(format.treemapInnerPadding, 0, 0, 100);
      if (set(format.treemapOuterPadding))
        item.borderWidth = bound(format.treemapOuterPadding, 0, 0, 100);
    }
    return {
      ...node,
      itemStyle: item,
      ...(Array.isArray(node.children)
        ? { children: node.children.map(dataStyle) }
        : {}),
    };
  };
  list = list.map((series, index) => {
    if (kind === 'waterfall' && index === 0) return series;
    let result: Node = { ...series };
    if (['scatter', 'bubble', 'waterfall'].includes(kind))
      result.itemStyle = record(dataStyle(series)).itemStyle;
    if (kind === 'bubble')
      result = applySeriesFormat(
        applySeriesStyle(result, {
          seriesColors: format.seriesColors,
          markerSymbol: format.seriesMarkerSymbol,
        }),
        format,
      );
    const label: Node = { ...record(series.label), ...labelFont };
    if (typeof format.specialLabelsShow === 'boolean')
      label.show = format.specialLabelsShow;
    if (color(format.valueLabelBackground))
      label.backgroundColor = color(format.valueLabelBackground);
    if (format.specialLabelPosition)
      label.position = format.specialLabelPosition;
    if (set(format.specialLabelRotation))
      label.rotate = bound(format.specialLabelRotation, 0, -180, 180);
    if (set(format.specialLabelMaxWidth)) {
      label.width = bound(format.specialLabelMaxWidth, 0, 0, 2000);
      label.overflow = format.specialLabelOverflow ?? 'truncate';
    }
    if (customText && kind !== 'gauge') {
      label.formatter = labelFormatter(kind, format, formatter);
      label.rich = {
        ...record(label.rich),
        category: {
          ...categoryFont,
          ...(color(format.specialCategoryBackground)
            ? { backgroundColor: color(format.specialCategoryBackground) }
            : {}),
        },
        value: labelFont,
        percent: {
          ...font(format.funnelPercentFont),
          ...(color(format.funnelPercentBackground)
            ? { backgroundColor: color(format.funnelPercentBackground) }
            : {}),
        },
      };
    }
    result.label = label;
    if (Array.isArray(series.data)) result.data = series.data.map(dataStyle);
    if (kind === 'waterfall') {
      result = applySeriesFormat(
        applySeriesStyle(result, {
          seriesColors: format.seriesColors,
          barCategoryGap: format.barCategoryGap,
          barBorderColor: format.barBorderColor,
          barBorderWidth: format.barBorderWidth,
          barBorderRadius: format.barBorderRadius,
        }),
        format,
      );
    }
    if (kind === 'scatter' || kind === 'bubble') {
      if (set(format.scatterSizeMultiplier)) {
        const original = series.symbolSize;
        const multiplier = bound(format.scatterSizeMultiplier, 1, 0, 10);
        result.symbolSize =
          typeof original === 'function'
            ? (value: unknown, params: unknown) => {
                const size = (
                  original as (value: unknown, params: unknown) => unknown
                )(value, params);
                return typeof size === 'number' ? size * multiplier : size;
              }
            : (finite(original) ? original : 6) * multiplier;
      }
    }
    if (kind === 'pie' && set(format.specialStartAngle))
      result.startAngle = bound(format.specialStartAngle, 90, 0, 360);
    if (kind === 'treemap')
      result.upperLabel = {
        ...record(series.upperLabel),
        ...categoryFont,
        ...(typeof format.specialCategoryShow === 'boolean'
          ? { show: format.specialCategoryShow }
          : {}),
        ...(color(format.specialCategoryBackground)
          ? { backgroundColor: color(format.specialCategoryBackground) }
          : {}),
      };
    if (kind === 'gauge') {
      const detail: Node = {
        ...record(series.detail),
        ...labelFont,
        ...(color(format.valueLabelBackground)
          ? { backgroundColor: color(format.valueLabelBackground) }
          : {}),
        ...font(format.gaugeValueFont),
        ...(typeof (format.gaugeValueShow ?? format.specialLabelsShow) ===
        'boolean'
          ? { show: format.gaugeValueShow ?? format.specialLabelsShow }
          : {}),
      };
      if (numeric || set(format.gaugeValueLabel))
        detail.formatter = (value: number) => {
          const text = (numeric ?? formatter)(value);
          return format.gaugeValueLabel
            ? String(format.gaugeValueLabel).includes('{value}')
              ? String(format.gaugeValueLabel).replace(/\{value\}/g, text)
              : `${format.gaugeValueLabel}: ${text}`
            : text;
        };
      result.detail = detail;
      result.axisLabel = {
        ...record(series.axisLabel),
        ...font(format.gaugeAxisFont),
      };
      result.title = {
        ...record(series.title),
        ...categoryFont,
        ...(typeof format.specialCategoryShow === 'boolean'
          ? { show: format.specialCategoryShow }
          : {}),
      };
      result.data = (Array.isArray(series.data) ? series.data : []).map(raw => {
        const datum = record(raw);
        return {
          ...datum,
          detail: {
            ...record(datum.detail),
            ...labelFont,
            ...(color(format.valueLabelBackground)
              ? { backgroundColor: color(format.valueLabelBackground) }
              : {}),
            ...font(format.gaugeValueFont),
            ...(typeof (format.gaugeValueShow ?? format.specialLabelsShow) ===
            'boolean'
              ? { show: format.gaugeValueShow ?? format.specialLabelsShow }
              : {}),
          },
          title: {
            ...record(datum.title),
            ...categoryFont,
            ...(typeof format.specialCategoryShow === 'boolean'
              ? { show: format.specialCategoryShow }
              : {}),
          },
        };
      });
    }
    return result;
  });
  if (kind === 'waterfall' || kind === 'bubble') {
    if (source.xAxis)
      next.xAxis = applyAxisFormatting(record(source.xAxis), {
        labelFont: format.xAxisLabelFont,
        titleFont: format.xAxisTitleFont,
        inverse: format.xAxisInverse,
        hidden: format.xAxisHidden,
        hideGridlines: format.gridlinesHidden,
        ...xAxisFormatOptions(format),
      });
    if (source.yAxis)
      next.yAxis = applyAxisFormatting(record(source.yAxis), {
        labelFont: format.yAxisLabelFont,
        titleFont: format.yAxisTitleFont,
        inverse: format.yAxisInverse,
        hidden: format.yAxisHidden,
        hideGridlines: format.gridlinesHidden,
        ...yAxisFormatOptions(format),
      });
  }
  if (source.legend && kind !== 'scatter')
    next.legend = applyLegendFormatting(
      record(source.legend),
      format.legendOrientation as import('../types').LegendOrientation,
      {
        font: format.legendFont,
        align: format.legendAlign,
        icon: format.legendIcon,
      },
    );
  if (
    kind === 'pie' &&
    (set(format.centerValueShow) ||
      set(format.centerValueFont) ||
      set(format.centerValueUnits) ||
      set(format.centerValueDecimals) ||
      set(format.centerLabel) ||
      set(format.centerLabelFont) ||
      set(format.centerBackgroundShow) ||
      set(format.centerBackgroundColor))
  ) {
    if (format.centerValueShow === false) next.graphic = null;
    else {
      const base = record(source.graphic);
      const style = record(base.style);
      const total = (
        Array.isArray(list[0]?.data) ? list[0].data : []
      ).reduce<number>((sum, point) => sum + (valueOf(point) ?? 0), 0);
      const number = (
        getDisplayFormatter(
          format.centerValueUnits as string | undefined,
          format.centerValueDecimals as number | undefined,
        ) ?? formatter
      )(total);
      const textStyle = font(format.centerValueFont);
      const { color: textColor, ...rest } = textStyle;
      const { color: labelColor, ...labelRest } = font(format.centerLabelFont);
      // The label has its own line and style over the value
      const text = format.centerLabel
        ? `{label|${safeRich(format.centerLabel)}}\n{value|${safeRich(number)}}`
        : number;
      const center = {
        ...base,
        type: 'text',
        left: base.left ?? 'center',
        top: base.top ?? 'middle',
        z: 10,
        style: {
          ...style,
          text,
          ...rest,
          ...(textColor ? { fill: textColor } : {}),
          ...(format.centerLabel
            ? {
                rich: {
                  label: {
                    lineHeight: (labelRest.fontSize ?? 12) * 1.5,
                    ...labelRest,
                    ...(labelColor ? { fill: labelColor } : {}),
                  },
                  value: {
                    lineHeight: (rest.fontSize ?? 16) * 1.3,
                    ...rest,
                    ...(textColor ? { fill: textColor } : {}),
                  },
                },
              }
            : {}),
          align: 'center',
          verticalAlign: 'middle',
        },
      };
      const radius = Array.isArray(list[0]?.radius)
        ? (parseFloat(String(list[0].radius[0])) * Math.min(width, height)) /
          200
        : Math.min(width, height) * 0.2;
      next.graphic =
        format.centerBackgroundShow === true &&
        color(format.centerBackgroundColor)
          ? [
              {
                type: 'circle',
                left: 'center',
                top: 'middle',
                z: 9,
                shape: {
                  r: Math.max(
                    0,
                    radius - bound(format.centerBackgroundPadding, 0, 0, 100),
                  ),
                },
                style: {
                  fill: color(format.centerBackgroundColor),
                  opacity:
                    1 -
                    bound(format.centerBackgroundTransparency, 0, 0, 100) / 100,
                },
              },
              center,
            ]
          : center;
    }
  }
  if (
    kind === 'gauge' &&
    finite(format.gaugeTargetValue) &&
    format.gaugeTargetShow !== false &&
    list[0]
  ) {
    const base = list[0];
    list.push({
      type: 'gauge',
      id: '__mibi_gauge_target',
      min: base.min,
      max: base.max,
      startAngle: base.startAngle,
      endAngle: base.endAngle,
      radius: base.radius,
      center: base.center,
      animation: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
      progress: { show: false },
      pointer: {
        show: true,
        length: '85%',
        width: 2,
        itemStyle: { color: color(format.gaugeTargetColor) ?? '#666' },
      },
      detail: {
        show: true,
        offsetCenter: [0, '90%'],
        fontSize: 12,
        ...font(format.gaugeTargetFont),
        formatter: (value: number) =>
          `${format.gaugeTargetLabel ?? ''}${format.gaugeTargetLabel ? ': ' : ''}${(numeric ?? formatter)(value)}`,
      },
      title: { show: false },
      tooltip: { show: false },
      silent: true,
      data: [{ value: format.gaugeTargetValue }],
    });
  }
  if (kind === 'waterfall' && format.waterfallConnectorsShow === true) {
    const totals: Map<number, number> = new Map();
    list.slice(1).forEach(series =>
      (Array.isArray(series.data) ? series.data : []).forEach(
        (point, index) => {
          const total = record(point).totalSum;
          if (finite(total)) totals.set(index, total);
        },
      ),
    );
    const data = [...totals.entries()].filter(([index]) =>
      totals.has(index + 1),
    );
    const renderItem: CustomSeriesRenderItem = (_params, api) => {
      const index = Number(api.value(0));
      const value = Number(api.value(1));
      const from = api.coord([index, value]);
      const to = api.coord([index + 1, value]);
      const gap = Math.abs(to[0] - from[0]) * 0.3;
      return {
        type: 'line',
        shape: { x1: from[0] + gap, y1: from[1], x2: to[0] - gap, y2: to[1] },
        style: {
          stroke: color(format.waterfallConnectorColor) ?? '#666',
          lineWidth: bound(format.waterfallConnectorWidth, 1, 0, 20),
          lineDash:
            format.waterfallConnectorStyle === 'dashed'
              ? [5, 3]
              : format.waterfallConnectorStyle === 'dotted'
                ? [1, 2]
                : undefined,
        },
      };
    };
    list.push({
      type: 'custom',
      id: '__mibi_waterfall_connectors',
      coordinateSystem: 'cartesian2d',
      data,
      renderItem,
      silent: true,
      tooltip: { show: false },
      z: 3,
    });
  }
  if (kind === 'scatter' || kind === 'bubble')
    scatterExtras({ ...source, ...next }, list, format);
  next.series = list;
  if (
    (kind === 'scatter' || kind === 'bubble') &&
    minColor &&
    maxColor &&
    Number.isFinite(extent[0])
  )
    next.visualMap = {
      show: format.specialGradientLegend === true,
      min: extent[0],
      max: extent[1],
      dimension: 1,
      seriesIndex: list.flatMap((series, index) =>
        series.type === 'scatter' ? [index] : [],
      ),
      inRange: { color: [minColor, maxColor] },
    };
  // Timeseries already applies its shared chart formatting before this layer.
  if (kind === 'scatter') return next as T;
  return applyChartFormat(
    next,
    kind === 'waterfall'
      ? { ...format, colorScaleMin: undefined, colorScaleMax: undefined }
      : format,
    { width, height, formatter },
  ) as T;
}
