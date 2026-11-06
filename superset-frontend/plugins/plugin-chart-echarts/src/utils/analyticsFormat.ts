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
  type ColorInput,
  getMetricLabel,
  type QueryFormMetric,
  toBoundedNumber,
  toCssColor,
} from '@superset-ui/core';
import { FORMAT_LINE_COLOR } from './formatColors';
import { parseDashArray } from './formatting';

/*
 * The Analytics level of the Format pane: reference lines, trend lines and zoom
 * sliders, drawn over the finished options of a chart. Nothing is added when
 * they are not set.
 */

type Anything = Record<string, any>;
type Formatter = (value: number) => string;

export type ReferenceLineKind =
  | 'constant'
  | 'min'
  | 'max'
  | 'average'
  | 'median'
  | 'percentile';

/** A reference line as the Analytics level keeps it. */
export type ReferenceLine = {
  id?: string;
  show?: boolean;
  kind?: ReferenceLineKind;
  /** The value axis, or the axis of the categories or dates */
  axis?: 'value' | 'category';
  value?: number | string | null;
  percentile?: number | null;
  /** The series a calculated line reads; empty means all of them */
  series?: string | null;
  name?: string | null;
  color?: ColorInput;
  width?: number | null;
  style?: string | null;
  dash?: string | null;
  cap?: string | null;
  transparency?: number | null;
  behind?: boolean | null;
  label?: boolean | null;
  labelText?: string | null;
  labelColor?: ColorInput;
  labelPosition?: 'start' | 'middle' | 'end' | null;
  labelAbove?: boolean | null;
  labelUnits?: string | null;
  labelDecimals?: number | null;
  shade?: 'none' | 'before' | 'after' | null;
  shadeColor?: ColorInput;
  shadeTransparency?: number | null;
};

export type AnalyticsOptions = {
  referenceLines?: ReferenceLine[] | null;
  trendShow?: boolean | null;
  trendCombine?: boolean | null;
  trendColor?: ColorInput;
  trendWidth?: number | null;
  trendStyle?: string | null;
  trendDash?: string | null;
  trendCap?: string | null;
  trendTransparency?: number | null;
  zoomCategoryShow?: boolean | null;
  zoomCategoryStart?: number | null;
  zoomCategoryEnd?: number | null;
  zoomValueShow?: boolean | null;
  zoomValueStart?: number | null;
  zoomValueEnd?: number | null;
  /** The value sliders start and end at values of the axis, not at percents. */
  zoomInValues?: boolean | null;
  zoomValueMin?: number | null;
  zoomValueMax?: number | null;
  zoomSecondaryShow?: boolean | null;
  zoomSecondaryMin?: number | null;
  zoomSecondaryMax?: number | null;
  zoomSecondaryStart?: number | null;
  zoomSecondaryEnd?: number | null;
  zoomShowLabels?: boolean | null;
  zoomSize?: number | null;
  tooltipMetrics?: QueryFormMetric[] | null;
};

const isInternal = (series: Anything) =>
  String(series.id).startsWith('__auradata');

const pointOf = (point: unknown): unknown[] | undefined => {
  if (Array.isArray(point)) return point;
  const { value } = (point ?? {}) as Anything;
  return Array.isArray(value) ? value : undefined;
};

const opacityOf = (transparency: number | null | undefined) =>
  1 - toBoundedNumber(transparency, 0, 0, 100) / 100;

/** The value of a calculated line, from the marks of the chart. */
export function referenceValue(
  line: ReferenceLine,
  list: Anything[],
  valueIndex: number,
): number | undefined {
  const kind = line.kind ?? 'constant';
  if (kind === 'constant') {
    const value = Number(line.value);
    return line.value === '' || line.value == null || !Number.isFinite(value)
      ? undefined
      : value;
  }
  const values = list
    .filter(
      series =>
        !isInternal(series) && (!line.series || series.name === line.series),
    )
    .flatMap(series => series.data ?? [])
    .map(point => Number(pointOf(point)?.[valueIndex]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!values.length) return undefined;
  if (kind === 'min') return values[0];
  if (kind === 'max') return values[values.length - 1];
  if (kind === 'average')
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  const share =
    kind === 'median'
      ? 0.5
      : toBoundedNumber(line.percentile, 50, 0, 100) / 100;
  const position = (values.length - 1) * share;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return values[low] + (values[high] - values[low]) * (position - low);
}

const lineStyle = (
  format: {
    color?: ColorInput;
    width?: number | null;
    style?: string | null;
    dash?: string | null;
    cap?: string | null;
    transparency?: number | null;
  },
  fallback?: string,
) => ({
  color: toCssColor(format.color) ?? fallback ?? FORMAT_LINE_COLOR,
  width: toBoundedNumber(format.width, 1, 0, 20),
  type: parseDashArray(format.dash) ?? format.style ?? 'dashed',
  ...(format.cap ? { cap: format.cap } : {}),
  opacity: opacityOf(format.transparency),
});

const LABEL_POSITIONS = {
  start: ['insideStartTop', 'insideStartBottom'],
  middle: ['insideMiddleTop', 'insideMiddleBottom'],
  end: ['insideEndTop', 'insideEndBottom'],
};

/** The band from a line to the edge of the plot, in its real coordinates. */
function shadeSeries(
  line: ReferenceLine,
  value: number,
  index: number,
  onValueAxis: boolean,
  isHorizontal: boolean,
  anchor: unknown[],
) {
  // The value axis goes across a horizontal chart
  const across = onValueAxis === isHorizontal;
  const after = line.shade === 'after';
  return {
    id: `__auradata_reference_shade_${index}`,
    name: `__auradata_reference_shade_${index}`,
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    data: [anchor],
    silent: true,
    tooltip: { show: false },
    z: 0,
    renderItem: (params: Anything, api: Anything) => {
      const { x, y, width, height } = params.coordSys;
      const here = across
        ? api.coord([value, anchor[1]])[0]
        : api.coord([anchor[0], value])[1];
      const onLowSide = across ? !after : after;
      const start = across ? x : y;
      const size = across ? width : height;
      const from = onLowSide ? start : Math.max(start, here);
      const to = onLowSide ? Math.min(start + size, here) : start + size;
      return {
        type: 'rect',
        shape: across
          ? { x: from, y, width: Math.max(0, to - from), height }
          : { x, y: from, width, height: Math.max(0, to - from) },
        style: {
          fill:
            toCssColor(line.shadeColor) ??
            toCssColor(line.color) ??
            FORMAT_LINE_COLOR,
          opacity: opacityOf(line.shadeTransparency ?? 80),
        },
      };
    },
  };
}

function referenceSeries(
  list: Anything[],
  lines: ReferenceLine[],
  {
    isHorizontal,
    display,
    formatter,
  }: {
    isHorizontal: boolean;
    display: (line: ReferenceLine) => Formatter | undefined;
    formatter?: Formatter;
  },
) {
  const valueIndex = isHorizontal ? 0 : 1;
  const anchor = list
    .filter(series => !isInternal(series))
    .flatMap(series => series.data ?? [])
    .map(pointOf)
    .find(point => point && Number.isFinite(Number(point[valueIndex])));
  const shades: Anything[] = [];
  const front: Anything[] = [];
  const behind: Anything[] = [];
  lines.forEach((line, index) => {
    if (line.show === false) return;
    const onValueAxis = line.axis !== 'category';
    const calculated = line.kind && line.kind !== 'constant';
    const value = onValueAxis
      ? referenceValue(line, list, valueIndex)
      : (line.value ?? undefined);
    if (value === undefined || value === '') return;
    const number = typeof value === 'number' ? value : undefined;
    const text =
      number === undefined
        ? String(value)
        : (display(line) ?? formatter ?? String)(number);
    const name = line.labelText ?? line.name;
    const [above, below] =
      LABEL_POSITIONS[line.labelPosition ?? 'end'] ?? LABEL_POSITIONS.end;
    const key = onValueAxis === isHorizontal ? 'xAxis' : 'yAxis';
    (line.behind ? behind : front).push({
      [key]: value,
      name: line.name ?? undefined,
      lineStyle: lineStyle(line),
      label: {
        show: line.label === true,
        position: line.labelAbove === false ? below : above,
        formatter: name ? `${name}: ${text}` : text,
        ...(toCssColor(line.labelColor)
          ? { color: toCssColor(line.labelColor) }
          : {}),
      },
    });
    if (
      anchor &&
      number !== undefined &&
      (line.shade === 'before' || line.shade === 'after') &&
      (onValueAxis || !calculated)
    ) {
      shades.push(
        shadeSeries(line, number, index, onValueAxis, isHorizontal, anchor),
      );
    }
  });
  const carrier = (id: string, data: Anything[], z: number) => ({
    id,
    name: id,
    type: 'line',
    data: [],
    silent: true,
    tooltip: { show: false },
    z,
    markLine: {
      silent: true,
      symbol: ['none', 'none'],
      animation: false,
      precision: 10,
      z,
      data,
    },
  });
  return [
    ...shades,
    ...(behind.length
      ? [carrier('__auradata_reference_behind', behind, 1)]
      : []),
    ...(front.length ? [carrier('__auradata_reference_front', front, 10)] : []),
  ];
}

/** The straight line that best fits some points, by least squares. */
export function fitLine(points: [number, number][]) {
  if (points.length < 2) return undefined;
  const n = points.length;
  const sumX = points.reduce((sum, [x]) => sum + x, 0);
  const sumY = points.reduce((sum, [, y]) => sum + y, 0);
  const sumXY = points.reduce((sum, [x, y]) => sum + x * y, 0);
  const sumXX = points.reduce((sum, [x]) => sum + x * x, 0);
  const divisor = n * sumXX - sumX * sumX;
  if (divisor === 0) return undefined;
  const slope = (n * sumXY - sumX * sumY) / divisor;
  return { slope, intercept: (sumY - slope * sumX) / n };
}

function trendSeries(
  list: Anything[],
  format: AnalyticsOptions,
  isHorizontal: boolean,
) {
  const categoryIndex = isHorizontal ? 1 : 0;
  const valueIndex = isHorizontal ? 0 : 1;
  const marks = list.filter(series => !isInternal(series) && series.data);
  const categories: unknown[] = [];
  marks.forEach(series =>
    series.data.forEach((point: unknown) => {
      const category = pointOf(point)?.[categoryIndex];
      if (typeof category === 'string' && !categories.includes(category)) {
        categories.push(category);
      }
    }),
  );
  const positionOf = (category: unknown) =>
    typeof category === 'string'
      ? categories.indexOf(category)
      : Number(category);
  const groups = format.trendCombine === false ? marks.map(m => [m]) : [marks];
  return groups.flatMap((group, index) => {
    const points = group
      .flatMap(series => series.data as unknown[])
      .map(pointOf)
      .filter(point => point)
      .map(
        point =>
          [positionOf(point?.[categoryIndex]), Number(point?.[valueIndex])] as [
            number,
            number,
          ],
      )
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    const fit = fitLine(points);
    if (!fit) return [];
    const xs = points.map(([x]) => x);
    const ends: unknown[] = categories.length
      ? categories
      : [Math.min(...xs), Math.max(...xs)];
    const color =
      group.length === 1
        ? (group[0].lineStyle?.color ?? group[0].itemStyle?.color)
        : undefined;
    return [
      {
        id: `__auradata_trend_${index}`,
        name: `__auradata_trend_${index}`,
        type: 'line',
        silent: true,
        tooltip: { show: false },
        showSymbol: false,
        symbol: 'none',
        z: 9,
        yAxisIndex: group[0].yAxisIndex,
        lineStyle: lineStyle(
          {
            color: format.trendColor,
            width: format.trendWidth ?? 2,
            style: format.trendStyle,
            dash: format.trendDash,
            cap: format.trendCap,
            transparency: format.trendTransparency,
          },
          color,
        ),
        data: ends.map(end => {
          const fitted = fit.slope * positionOf(end) + fit.intercept;
          return isHorizontal ? [fitted, end] : [end, fitted];
        }),
      },
    ];
  });
}

/** The series the Analytics level adds to a chart. */
export function analyticsSeries(
  list: Anything[],
  format: AnalyticsOptions,
  context: {
    isHorizontal: boolean;
    display: (line: ReferenceLine) => Formatter | undefined;
    formatter?: Formatter;
  },
) {
  return [
    ...(format.trendShow
      ? trendSeries(list, format, context.isHorizontal)
      : []),
    ...(Array.isArray(format.referenceLines) && format.referenceLines.length
      ? referenceSeries(list, format.referenceLines, context)
      : []),
  ];
}

const ZOOM_SIZE = 18;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** The zoom sliders of a chart, with the margin they need in its plot. */
export function zoomFormat(
  options: Anything,
  format: AnalyticsOptions,
  isHorizontal: boolean,
) {
  const hasSecondary =
    Array.isArray(options.yAxis) && options.yAxis.length > 1 && !isHorizontal;
  const secondaryOn = !!format.zoomSecondaryShow && hasSecondary;
  if (!format.zoomCategoryShow && !format.zoomValueShow && !secondaryOn) {
    return undefined;
  }
  const size = toBoundedNumber(format.zoomSize, ZOOM_SIZE, 8, 60);
  const showDetail = format.zoomShowLabels !== false;
  const inside = (options.dataZoom ?? []).filter(
    (zoom: Anything) => zoom.type !== 'slider',
  );
  const grid: Anything = { ...options.grid };
  const margin = (side: string) => {
    grid[side] = Number(grid[side] ?? 0) + size + 8;
  };
  const sliders: Anything[] = [];
  const slider = (
    across: boolean,
    range: { start?: unknown; end?: unknown; min?: unknown; max?: unknown },
    { axisIndex = 0, side }: { axisIndex?: number; side?: string } = {},
  ) => {
    // An axis along the bottom scrolls there, and one up the side at the right
    const at = side ?? (across ? 'bottom' : 'right');
    margin(at);
    const inValues = isNumber(range.min) || isNumber(range.max);
    sliders.push({
      type: 'slider',
      ...(across ? { xAxisIndex: axisIndex } : { yAxisIndex: axisIndex }),
      filterMode: 'none',
      ...(inValues
        ? {
            ...(isNumber(range.min) && { startValue: range.min }),
            ...(isNumber(range.max) && { endValue: range.max }),
          }
        : {
            start: toBoundedNumber(range.start, 0, 0, 100),
            end: toBoundedNumber(range.end, 100, 0, 100),
          }),
      showDetail,
      ...(across ? { bottom: 4, height: size } : { [at]: 4, width: size }),
    });
  };
  if (format.zoomCategoryShow) {
    slider(!isHorizontal, {
      start: format.zoomCategoryStart,
      end: format.zoomCategoryEnd,
    });
  }
  if (format.zoomValueShow) {
    slider(
      isHorizontal,
      format.zoomInValues
        ? { min: format.zoomValueMin, max: format.zoomValueMax }
        : { start: format.zoomValueStart, end: format.zoomValueEnd },
    );
  }
  if (secondaryOn) {
    // The second axis faces the first, so its slider goes on the other side
    slider(
      false,
      format.zoomInValues
        ? { min: format.zoomSecondaryMin, max: format.zoomSecondaryMax }
        : { start: format.zoomSecondaryStart, end: format.zoomSecondaryEnd },
      { axisIndex: 1, side: 'left' },
    );
  }
  return { dataZoom: [...inside, ...sliders], grid };
}

type TooltipRow = Record<string, unknown>;

/**
 * The fields a tooltip adds for a mark: the value of each extra metric, for its
 * series when the chart has groups, or added up when it does not say which.
 */
export function tooltipFieldRows(
  rows: TooltipRow[] | undefined,
  metrics: QueryFormMetric[] | null | undefined,
  {
    xColumn,
    groupby,
    xValue,
    seriesName,
    formatter,
  }: {
    xColumn: string;
    groupby: string[];
    xValue: unknown;
    seriesName?: string;
    formatter: Formatter;
  },
): string[][] {
  if (!rows?.length || !metrics?.length) return [];
  const matching = rows.filter(
    row =>
      row[xColumn] === xValue &&
      (!seriesName ||
        !groupby.length ||
        groupby.map(column => String(row[column])).join(', ') === seriesName),
  );
  if (!matching.length) return [];
  return metrics.map(metric => {
    const label = getMetricLabel(metric);
    const total = matching.reduce(
      (sum, row) => sum + (Number(row[label]) || 0),
      0,
    );
    return [label, formatter(total)];
  });
}
