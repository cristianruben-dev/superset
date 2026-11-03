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
  type FontStyleValue,
  NumberFormatter,
  getNumberFormatter,
  toBoundedNumber,
  toCssColor,
} from '@superset-ui/core';
import {
  type AnalyticsOptions,
  analyticsSeries,
  zoomFormat,
} from './analyticsFormat';
import {
  type AxisFormatOptions,
  type EchartsTextStyle,
  VALUE_LABEL_BACKGROUND_PADDING,
  VALUE_LABEL_BACKGROUND_RADIUS,
  applySeriesStyle,
  getEchartsTextStyle,
  parseDashArray,
} from './formatting';

/*
 * The options of the Format pane for bars, columns, lines, areas and combos that
 * go beyond the look of a single part of the chart. As in formatting.ts, an option
 * left unset changes nothing, so a saved chart renders as before.
 */

type Numeric = number | string | null;

/** What one series changes over the options of the whole chart. */
export type SeriesOverride = {
  showLabels?: boolean | null;
  labelColor?: ColorInput;
  lineWidth?: Numeric;
  lineType?: string | null;
  lineHidden?: boolean | null;
  lineTransparency?: Numeric;
  lineInterpolation?: string | null;
  markerEnabled?: boolean | null;
  markerSymbol?: string | null;
  markerSize?: Numeric;
  barTransparency?: Numeric;
};

export type ChartFormatOptions = {
  // Axes
  xAxisSwitchPosition?: boolean | null;
  xAxisLog?: boolean | null;
  xAxisLabelUnits?: string | null;
  xAxisLabelDecimals?: Numeric;
  xAxisLabelMaxWidth?: Numeric;
  xAxisMinCategoryWidth?: Numeric;
  xAxisScrollPosition?: string | null;
  xGridlinesShow?: boolean | null;
  xGridlineColor?: ColorInput;
  xGridlineWidth?: Numeric;
  xGridlineStyle?: string | null;
  xGridlineDash?: string | null;
  xGridlineCap?: string | null;
  yAxisSwitchPosition?: boolean | null;
  yAxisLabelUnits?: string | null;
  yAxisLabelDecimals?: Numeric;
  yGridlinesHidden?: boolean | null;
  yGridlineColor?: ColorInput;
  yGridlineWidth?: Numeric;
  yGridlineStyle?: string | null;
  yGridlineDash?: string | null;
  yGridlineCap?: string | null;
  yAxisSecondaryHidden?: boolean | null;
  yAxisSecondaryLabelUnits?: string | null;
  yAxisSecondaryLabelDecimals?: Numeric;
  // Data labels
  valueLabelPosition?: string | null;
  valueLabelTransparency?: Numeric;
  valueLabelMaxWidth?: Numeric;
  valueLabelOverflow?: string | null;
  valueLabelHideOverlap?: boolean | null;
  valueLabelDistance?: Numeric;
  valueLabelAlign?: string | null;
  valueLabelUnits?: string | null;
  valueLabelDecimals?: Numeric;
  valueLabelHideValue?: boolean | null;
  valueLabelTitle?: string | null;
  valueLabelTitleFont?: FontStyleValue | null;
  valueLabelDetail?: string | null;
  valueLabelDetailFont?: FontStyleValue | null;
  valueLabelLayout?: string | null;
  // Legend
  legendTitle?: string | null;
  legendTitleFont?: FontStyleValue | null;
  legendMatchColor?: boolean | null;
  // Colors and bars
  seriesDefaultColor?: ColorInput;
  categoryColors?: Record<string, ColorInput> | null;
  colorScaleMin?: ColorInput;
  colorScaleMax?: ColorInput;
  barTransparency?: Numeric;
  barBorderMatchFill?: boolean | null;
  barBorderOnly?: boolean | null;
  barOverlap?: Numeric;
  barOverlapReverse?: boolean | null;
  // Lines and markers
  lineInterpolation?: string | null;
  lineSmoothness?: Numeric;
  lineHidden?: boolean | null;
  lineTransparency?: Numeric;
  seriesLineDash?: string | null;
  seriesLineCap?: string | null;
  seriesLineJoin?: string | null;
  areaColor?: ColorInput;
  markerColor?: ColorInput;
  markerTransparency?: Numeric;
  markerBorderColor?: ColorInput;
  markerBorderWidth?: Numeric;
  markerBorderMatchFill?: boolean | null;
  markerRotation?: Numeric;
  seriesFormat?: Record<string, SeriesOverride> | null;
  // Total labels
  totalLabelsShow?: boolean | null;
  totalLabelFont?: FontStyleValue | null;
  totalLabelBackground?: ColorInput;
  totalLabelUnits?: string | null;
  totalLabelDecimals?: Numeric;
  totalLabelSplitSign?: boolean | null;
  // Series labels
  seriesLabelsShow?: boolean | null;
  seriesLabelFont?: FontStyleValue | null;
  seriesLabelBackground?: ColorInput;
  seriesLabelMatchColor?: boolean | null;
  seriesLabelMaxWidth?: Numeric;
  seriesLabelOverflow?: string | null;
  // Plot area
  plotAreaColor?: ColorInput;
  plotAreaImage?: string | null;
  plotAreaImageRepeat?: string | null;
} & AnalyticsOptions;

type Anything = Record<string, any>;

const isRecord = (value: unknown): value is Anything =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSet = (value: unknown) =>
  value !== null && value !== undefined && value !== '';

/* -------------------------------------------------------------------------
 * Display units and decimals
 * ---------------------------------------------------------------------- */

const UNIT_STEPS: [string, number, string][] = [
  ['trillions', 1e12, 'T'],
  ['billions', 1e9, 'B'],
  ['millions', 1e6, 'M'],
  ['thousands', 1e3, 'K'],
];

const scaleOf = (units: string, value: number) => {
  if (units === 'auto') {
    return (
      UNIT_STEPS.find(([, divisor]) => Math.abs(value) >= divisor) ?? [
        'none',
        1,
        '',
      ]
    );
  }
  return UNIT_STEPS.find(([name]) => name === units) ?? ['none', 1, ''];
};

/**
 * A number formatter from display units and decimals, as Power BI offers them, or
 * undefined when both are left unset. A percentage keeps its scale.
 */
export function getDisplayFormatter(
  units: string | null | undefined,
  decimals: Numeric | undefined,
  percent = false,
): NumberFormatter | undefined {
  if (!isSet(units) && !isSet(decimals)) return undefined;
  const digits = isSet(decimals)
    ? `.${toBoundedNumber(decimals, 0, 0, 9)}`
    : '.2~';
  if (percent) return getNumberFormatter(`,${digits}%`);
  const number = getNumberFormatter(`,${digits}f`);
  return new NumberFormatter({
    id: `mibi-units-${units ?? 'none'}${digits}`,
    formatFunc: (value: number) => {
      const [, divisor, suffix] = scaleOf(units ?? 'none', value);
      return `${number(value / divisor)}${suffix}`;
    },
  });
}

/* -------------------------------------------------------------------------
 * Axes
 * ---------------------------------------------------------------------- */

const gridlineOf = (
  format: ChartFormatOptions & Anything,
  axis: 'x' | 'y',
): AxisFormatOptions => ({
  gridlineColor: format[`${axis}GridlineColor`] ?? format.gridlineColor,
  gridlineWidth: format[`${axis}GridlineWidth`] ?? format.gridlineWidth,
  gridlineStyle: format[`${axis}GridlineStyle`] ?? format.gridlineStyle,
  gridlineDash: format[`${axis}GridlineDash`],
  gridlineCap: format[`${axis}GridlineCap`],
});

/** The options of the dimension axis, before a horizontal chart swaps them. */
export const xAxisFormatOptions = (
  format: ChartFormatOptions,
  isHorizontal = false,
): AxisFormatOptions => ({
  ...gridlineOf(format, 'x'),
  showGridlines: format.xGridlinesShow,
  logScale: format.xAxisLog,
  labelMaxWidth: format.xAxisLabelMaxWidth,
  labelFormatter: getDisplayFormatter(
    format.xAxisLabelUnits,
    format.xAxisLabelDecimals,
  ),
  ...(format.xAxisSwitchPosition && {
    position: isHorizontal ? 'right' : 'top',
  }),
});

/** The options of the value axis, before a horizontal chart swaps them. */
export const yAxisFormatOptions = (
  format: ChartFormatOptions,
  { isHorizontal = false, percent = false } = {},
): AxisFormatOptions => ({
  ...gridlineOf(format, 'y'),
  hideGridlines:
    (format as Anything).gridlinesHidden || format.yGridlinesHidden,
  labelFormatter: getDisplayFormatter(
    format.yAxisLabelUnits,
    format.yAxisLabelDecimals,
    percent,
  ),
  ...(format.yAxisSwitchPosition && {
    position: isHorizontal ? 'top' : 'right',
  }),
});

/** The options of the second value axis, which faces the first. */
export const secondaryYAxisFormatOptions = (
  format: ChartFormatOptions,
  percent = false,
): AxisFormatOptions => ({
  hidden: format.yAxisSecondaryHidden,
  labelFormatter: getDisplayFormatter(
    format.yAxisSecondaryLabelUnits,
    format.yAxisSecondaryLabelDecimals,
    percent,
  ),
  ...(format.yAxisSwitchPosition && { position: 'left' }),
});

/* -------------------------------------------------------------------------
 * One series
 * ---------------------------------------------------------------------- */

const faded = (opacity: unknown, transparency: Numeric | undefined) =>
  (typeof opacity === 'number' ? opacity : 1) *
  (1 - toBoundedNumber(transparency, 0, 0, 100) / 100);

// A line keeps its own color when its markers have another one, and a bar
// drawn only by its border has it there
const colorOfSeries = (series: Anything): string | undefined =>
  series.lineStyle?.color ??
  (series.itemStyle?.color === 'transparent'
    ? series.itemStyle.borderColor
    : series.itemStyle?.color);

const BAR_POSITIONS: Record<string, [string, string]> = {
  outsideEnd: ['top', 'right'],
  insideEnd: ['insideTop', 'insideRight'],
  center: ['inside', 'inside'],
  insideBase: ['insideBottom', 'insideLeft'],
  above: ['top', 'right'],
  below: ['insideBottom', 'insideLeft'],
  left: ['inside', 'inside'],
  right: ['inside', 'inside'],
};

const LINE_POSITIONS: Record<string, string> = {
  outsideEnd: 'top',
  insideEnd: 'bottom',
  center: 'inside',
  insideBase: 'bottom',
  above: 'top',
  below: 'bottom',
  left: 'left',
  right: 'right',
};

const labelPosition = (
  position: string,
  type: unknown,
  isHorizontal: boolean,
) =>
  type === 'bar'
    ? BAR_POSITIONS[position]?.[isHorizontal ? 1 : 0]
    : LINE_POSITIONS[position];

function applyLabelFormat(
  next: Anything,
  format: ChartFormatOptions,
  own: SeriesOverride | undefined,
  isHorizontal: boolean,
) {
  if (!isRecord(next.label)) return;
  const label: Anything = { ...next.label };
  const position = format.valueLabelPosition
    ? labelPosition(format.valueLabelPosition, next.type, isHorizontal)
    : undefined;
  if (position) {
    label.position = position;
    // Negative bars ask for their own side: the choice applies to them too
    if (Array.isArray(next.data)) {
      next.data = next.data.map((point: unknown) => {
        if (!isRecord(point) || !isRecord(point.label)) return point;
        const { position: _position, ...rest } = point.label;
        return { ...point, label: rest };
      });
    }
  }
  if (isSet(format.valueLabelTransparency)) {
    label.opacity = faded(label.opacity, format.valueLabelTransparency);
  }
  const maxWidth = toBoundedNumber(format.valueLabelMaxWidth, 0, 0, 1000);
  if (maxWidth > 0) {
    label.width = maxWidth;
    label.overflow = format.valueLabelOverflow || 'truncate';
    label.ellipsis = '…';
  }
  if (isSet(format.valueLabelDistance)) {
    label.distance = toBoundedNumber(format.valueLabelDistance, 5, 0, 100);
  }
  if (format.valueLabelAlign) label.align = format.valueLabelAlign;
  if (typeof own?.showLabels === 'boolean') {
    label.show = own.showLabels;
    if (own.showLabels && next.type === 'line') next.showSymbol = true;
  }
  const ownColor = toCssColor(own?.labelColor);
  if (ownColor) label.color = ownColor;
  next.label = label;
  if (format.valueLabelHideOverlap) {
    next.labelLayout = { ...next.labelLayout, hideOverlap: true };
  }
}

function applyBarFormat(
  next: Anything,
  format: ChartFormatOptions,
  own: SeriesOverride | undefined,
) {
  const itemStyle: Anything = { ...next.itemStyle };
  const transparency = own?.barTransparency ?? format.barTransparency;
  if (isSet(transparency)) {
    itemStyle.opacity = faded(itemStyle.opacity, transparency);
  }
  const fill = itemStyle.color;
  if (format.barBorderMatchFill && fill) itemStyle.borderColor = fill;
  if (format.barBorderOnly && fill) {
    itemStyle.borderColor = itemStyle.borderColor ?? fill;
    itemStyle.borderWidth = Math.max(itemStyle.borderWidth ?? 0, 1);
    itemStyle.color = 'transparent';
  }
  next.itemStyle = itemStyle;
  if (isSet(format.barOverlap)) {
    next.barGap = `-${toBoundedNumber(format.barOverlap, 0, 0, 100)}%`;
  }
}

function applyInterpolation(
  next: Anything,
  format: ChartFormatOptions,
  own: SeriesOverride | undefined,
  isHorizontal: boolean,
) {
  const kind = own?.lineInterpolation ?? format.lineInterpolation;
  if (!kind) return;
  const smoothness = isSet(format.lineSmoothness)
    ? toBoundedNumber(format.lineSmoothness, 50, 0, 100) / 100
    : true;
  next.step = undefined;
  next.smooth = false;
  next.smoothMonotone = undefined;
  if (kind === 'smooth') next.smooth = smoothness;
  if (kind === 'monotone') {
    next.smooth = smoothness;
    next.smoothMonotone = isHorizontal ? 'y' : 'x';
  }
  if (['start', 'middle', 'end'].includes(kind)) next.step = kind;
}

function applyLineFormat(
  next: Anything,
  format: ChartFormatOptions,
  own: SeriesOverride | undefined,
) {
  const lineStyle: Anything = { ...next.lineStyle };
  const width = own?.lineWidth;
  if (isSet(width)) lineStyle.width = toBoundedNumber(width, 2, 1, 10);
  if (own?.lineType) lineStyle.type = own.lineType;
  const dash = parseDashArray(format.seriesLineDash);
  // Time comparisons keep their dash pattern, as with the style of the line
  if (dash && !Array.isArray(lineStyle.type)) lineStyle.type = dash;
  if (format.seriesLineCap) lineStyle.cap = format.seriesLineCap;
  if (format.seriesLineJoin) lineStyle.join = format.seriesLineJoin;
  const transparency = own?.lineTransparency ?? format.lineTransparency;
  if (isSet(transparency)) {
    lineStyle.opacity = faded(lineStyle.opacity, transparency);
  }
  if (own?.lineHidden ?? format.lineHidden) {
    lineStyle.opacity = 0;
    lineStyle.width = 0;
  }
  const areaColor = toCssColor(format.areaColor);
  if (areaColor && next.areaStyle) {
    next.areaStyle = { ...next.areaStyle, color: areaColor };
  }
  next.lineStyle = lineStyle;
}

function applyMarkerFormat(
  next: Anything,
  format: ChartFormatOptions,
  own: SeriesOverride | undefined,
) {
  const itemStyle: Anything = { ...next.itemStyle };
  const seriesColor = itemStyle.color;
  const markerColor = toCssColor(format.markerColor);
  if (markerColor) {
    // The line and the area take this color unless they have their own
    itemStyle.color = markerColor;
    next.lineStyle = { color: seriesColor, ...next.lineStyle };
    if (next.areaStyle) {
      next.areaStyle = { color: seriesColor, ...next.areaStyle };
    }
  }
  if (isSet(format.markerTransparency)) {
    itemStyle.opacity = faded(itemStyle.opacity, format.markerTransparency);
  }
  const borderWidth = toBoundedNumber(format.markerBorderWidth, 0, 0, 10);
  if (borderWidth > 0) {
    itemStyle.borderWidth = borderWidth;
    itemStyle.borderType = 'solid';
    const borderColor = format.markerBorderMatchFill
      ? itemStyle.color
      : toCssColor(format.markerBorderColor);
    if (borderColor) itemStyle.borderColor = borderColor;
  }
  if (typeof own?.markerEnabled === 'boolean') {
    next.showSymbol = own.markerEnabled;
    // A line without markers keeps them invisible to stay clickable
    if (own.markerEnabled && itemStyle.opacity === 0) itemStyle.opacity = 1;
  }
  if (own?.markerSymbol) next.symbol = own.markerSymbol;
  if (isSet(own?.markerSize)) {
    next.symbolSize = toBoundedNumber(own?.markerSize, 6, 0, 100);
  }
  if (isSet(format.markerRotation)) {
    next.symbolRotate = toBoundedNumber(format.markerRotation, 0, 0, 360);
  }
  next.itemStyle = itemStyle;
}

const pointValues = (point: unknown): unknown[] | undefined => {
  if (Array.isArray(point)) return point;
  return isRecord(point) && Array.isArray(point.value)
    ? point.value
    : undefined;
};

function applyCategoryColors(
  next: Anything,
  colors: Record<string, ColorInput>,
  categoryIndex: number,
) {
  if (!Array.isArray(next.data)) return;
  next.data = next.data.map((point: unknown) => {
    const category = pointValues(point)?.[categoryIndex];
    const color = toCssColor(colors[String(category)]);
    if (!color) return point;
    const base: Anything = isRecord(point) ? point : { value: point };
    return { ...base, itemStyle: { ...base.itemStyle, color } };
  });
}

/**
 * The options of the pane that apply to a single series, with what that series
 * changes on its own. It runs before the conditional rules, so those still win.
 */
export function applySeriesFormat<T extends object>(
  series: T,
  format: ChartFormatOptions,
  isHorizontal = false,
): T {
  const base = series as Anything;
  const name = base.name === undefined ? '' : String(base.name);
  const own = isRecord(format.seriesFormat)
    ? format.seriesFormat[name]
    : undefined;
  const seriesColors = (format as Anything).seriesColors as
    | Record<string, unknown>
    | undefined;
  let next: Anything = { ...base };

  if (toCssColor(format.seriesDefaultColor) && !seriesColors?.[name]) {
    next = applySeriesStyle(next, {
      seriesColors: { [name]: format.seriesDefaultColor },
    });
  }
  applyLabelFormat(next, format, own, isHorizontal);
  if (next.type === 'bar') {
    applyBarFormat(next, format, own);
    if (isRecord(format.categoryColors)) {
      applyCategoryColors(next, format.categoryColors, isHorizontal ? 1 : 0);
    }
  }
  if (next.type === 'line') {
    applyInterpolation(next, format, own, isHorizontal);
    applyLineFormat(next, format, own);
  }
  if (next.type === 'line' || next.type === 'scatter') {
    applyMarkerFormat(next, format, own);
  }
  const changed = Object.keys(next).some(
    key =>
      next[key] !== base[key] &&
      JSON.stringify(next[key]) !== JSON.stringify(base[key]),
  );
  return changed ? (next as T) : series;
}

/* -------------------------------------------------------------------------
 * The whole chart
 * ---------------------------------------------------------------------- */

const parseColor = (color: string): [number, number, number, number] => {
  const hex = color.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = parseInt(hex[1], 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
};

/** The color at a share between two colors, for the color scale. */
export function mixColors(from: string, to: string, share: number): string {
  const start = parseColor(from);
  const end = parseColor(to);
  const [r, g, b, a] = start.map((part, index) =>
    index === 3
      ? part + (end[index] - part) * share
      : Math.round(part + (end[index] - part) * share),
  );
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Colors each bar by its value, leaving those a rule has already colored. */
function applyColorScale(
  list: Anything[],
  from: string,
  to: string,
  valueIndex: number,
) {
  const values = list
    .filter(series => series.type === 'bar')
    .flatMap(series =>
      (series.data ?? [])
        .map((point: unknown) => pointValues(point)?.[valueIndex])
        .filter((value: unknown) => typeof value === 'number'),
    ) as number[];
  if (!values.length) return list;
  const min = values.reduce((a, b) => Math.min(a, b));
  const range = values.reduce((a, b) => Math.max(a, b)) - min || 1;
  return list.map(series => {
    if (series.type !== 'bar') return series;
    return {
      ...series,
      data: (series.data ?? []).map((point: unknown) => {
        const value = pointValues(point)?.[valueIndex];
        if (typeof value !== 'number') return point;
        const mark: Anything = isRecord(point) ? point : { value: point };
        if (mark.itemStyle?.color) return point;
        return {
          ...mark,
          itemStyle: {
            ...mark.itemStyle,
            color: mixColors(from, to, (value - min) / range),
          },
        };
      }),
    };
  });
}

const richText = (text: unknown) => String(text ?? '').replace(/[{}|]/g, '');

type Blocks = {
  title?: string | null;
  detail?: string | null;
};

function blockText(
  block: string | null | undefined,
  params: Anything,
  categoryIndex: number,
  valueIndex: number,
  categoryTotals: Map<unknown, number>,
  categoryFormatter: ((value: any) => string) | undefined,
) {
  const values = pointValues(params.value) ?? [];
  const category = values[categoryIndex];
  if (block === 'series') return params.seriesName;
  if (block === 'category') {
    return categoryFormatter ? categoryFormatter(category) : category;
  }
  if (block === 'percent') {
    const total = categoryTotals.get(category);
    const value = Number(values[valueIndex]);
    return total ? getNumberFormatter('.1%')(value / total) : '';
  }
  return '';
}

/** Data labels made of a title, the value and a detail, each with its style. */
function applyLabelBlocks(
  list: Anything[],
  format: ChartFormatOptions,
  isHorizontal: boolean,
  categoryFormatter: ((value: any) => string) | undefined,
) {
  const blocks: Blocks = {
    title: format.valueLabelTitle,
    detail: format.valueLabelDetail,
  };
  if (!blocks.title && !blocks.detail && !format.valueLabelHideValue) {
    return list;
  }
  const categoryIndex = isHorizontal ? 1 : 0;
  const valueIndex = isHorizontal ? 0 : 1;
  const categoryTotals = new Map<unknown, number>();
  list.forEach(series =>
    (series.data ?? []).forEach((point: unknown) => {
      const values = pointValues(point);
      if (!values) return;
      const value = Number(values[valueIndex]);
      if (Number.isFinite(value)) {
        categoryTotals.set(
          values[categoryIndex],
          (categoryTotals.get(values[categoryIndex]) ?? 0) + value,
        );
      }
    }),
  );
  const separator = format.valueLabelLayout === 'inline' ? '  ' : '\n';
  return list.map(series => {
    const { label } = series;
    if (!isRecord(label) || typeof label.formatter !== 'function') {
      return series;
    }
    const valueOf = label.formatter;
    return {
      ...series,
      label: {
        ...label,
        rich: {
          ...label.rich,
          title: getEchartsTextStyle(format.valueLabelTitleFont),
          detail: getEchartsTextStyle(format.valueLabelDetailFont),
        },
        formatter: (params: Anything) => {
          const value = valueOf(params);
          // The stacks hide some of their labels by leaving them empty
          if (value === '' || value === undefined) return '';
          const text = (block: string | null | undefined) =>
            richText(
              blockText(
                block,
                params,
                categoryIndex,
                valueIndex,
                categoryTotals,
                categoryFormatter,
              ),
            );
          return [
            blocks.title && `{title|${text(blocks.title)}}`,
            !format.valueLabelHideValue && value,
            blocks.detail && `{detail|${text(blocks.detail)}}`,
          ]
            .filter(part => part !== false && !!part)
            .join(separator);
        },
      },
    };
  });
}

/**
 * A mark of no height at the end of each stack, whose label says the total of
 * the stack. It takes part in the stack, so it always sits right on top.
 */
function totalLabelSeries(
  list: Anything[],
  format: ChartFormatOptions,
  {
    isHorizontal,
    legendState,
    formatter,
  }: {
    isHorizontal: boolean;
    legendState?: Record<string, boolean>;
    formatter?: (value: number) => string;
  },
) {
  const categoryIndex = isHorizontal ? 1 : 0;
  const valueIndex = isHorizontal ? 0 : 1;
  const stacks = new Map<string, Anything[]>();
  list.forEach(series => {
    if (!series.stack || !['bar', 'line'].includes(series.type)) return;
    // A stream has no top
    if (series.stackStrategy === 'all') return;
    if (legendState && legendState[series.name] === false) return;
    stacks.set(series.stack, [...(stacks.get(series.stack) ?? []), series]);
  });
  const display =
    getDisplayFormatter(format.totalLabelUnits, format.totalLabelDecimals) ??
    formatter;
  const background = toCssColor(format.totalLabelBackground);
  const textStyle: EchartsTextStyle = getEchartsTextStyle(
    format.totalLabelFont,
  );
  const signs = format.totalLabelSplitSign
    ? ([1, -1] as const)
    : ([0] as const);

  return Array.from(stacks.entries()).flatMap(([stack, members]) =>
    signs.map(sign => {
      const totals = new Map<unknown, number>();
      members.forEach(series =>
        (series.data ?? []).forEach((point: unknown) => {
          const values = pointValues(point);
          const value = Number(values?.[valueIndex]);
          if (!values || !Number.isFinite(value)) return;
          if (sign !== 0 && Math.sign(value) !== sign) return;
          totals.set(
            values[categoryIndex],
            (totals.get(values[categoryIndex]) ?? 0) + value,
          );
        }),
      );
      const categories = Array.from(totals.keys());
      // A value below zero joins the negative side of the stack
      const height = sign === -1 ? -1e-9 : 0;
      const isLine = members[0].type === 'line';
      const outside = sign === -1 ? ['bottom', 'left'] : ['top', 'right'];
      return {
        id: `__mibi_total_${stack}_${sign}`,
        name: `__mibi_total_${stack}_${sign}`,
        type: members[0].type,
        stack,
        stackStrategy: 'samesign',
        yAxisIndex: members[0].yAxisIndex,
        silent: true,
        tooltip: { show: false },
        legendHoverLink: false,
        itemStyle: { color: 'transparent', borderWidth: 0 },
        ...(isLine && {
          // A line only draws the labels of the points it has a symbol for
          showSymbol: true,
          showAllSymbol: true,
          symbolSize: 0,
          lineStyle: { opacity: 0, width: 0 },
        }),
        data: categories.map(category =>
          isHorizontal ? [height, category] : [category, height],
        ),
        label: {
          show: true,
          position: outside[isHorizontal ? 1 : 0],
          ...textStyle,
          ...(background && {
            backgroundColor: background,
            padding: VALUE_LABEL_BACKGROUND_PADDING,
            borderRadius: VALUE_LABEL_BACKGROUND_RADIUS,
          }),
          formatter: ({ dataIndex }: { dataIndex: number }) => {
            const total = totals.get(categories[dataIndex]) as number;
            if (sign !== 0 && !total) return '';
            return display ? display(total) : String(total);
          },
        },
      };
    }),
  );
}

const SERIES_LABEL_WIDTH = 96;
const AXIS_LABELS_WIDTH = 45;

/** Whether the numbers of a value axis sit where the series labels go. */
const hasAxisOnTheRight = (yAxis: unknown) =>
  Array.isArray(yAxis)
    ? yAxis.some(axis => axis.position === 'right') ||
      (yAxis.length > 1 && !yAxis[1].position)
    : isRecord(yAxis) && yAxis.position === 'right';

function applySeriesLabels(
  list: Anything[],
  format: ChartFormatOptions,
  clearOfAxis: boolean,
) {
  const maxWidth = toBoundedNumber(
    format.seriesLabelMaxWidth,
    SERIES_LABEL_WIDTH,
    20,
    400,
  );
  const background = toCssColor(format.seriesLabelBackground);
  const textStyle = getEchartsTextStyle(format.seriesLabelFont);
  return list.map(series =>
    series.type === 'line' && !String(series.id).startsWith('__mibi')
      ? {
          ...series,
          endLabel: {
            show: true,
            ...(clearOfAxis && { distance: AXIS_LABELS_WIDTH }),
            formatter: ({ seriesName }: { seriesName: string }) => seriesName,
            width: maxWidth,
            overflow: format.seriesLabelOverflow || 'truncate',
            ellipsis: '…',
            ...textStyle,
            ...(format.seriesLabelMatchColor && {
              color: colorOfSeries(series),
            }),
            ...(background && {
              backgroundColor: background,
              padding: VALUE_LABEL_BACKGROUND_PADDING,
              borderRadius: VALUE_LABEL_BACKGROUND_RADIUS,
            }),
          },
          labelLayout: { ...series.labelLayout, moveOverlap: 'shiftY' },
        }
      : series,
  );
}

function applyLegendExtras(
  legend: Anything,
  list: Anything[],
  format: ChartFormatOptions,
) {
  const title = format.legendTitle?.trim();
  if (!format.legendMatchColor && !format.barBorderOnly && !title) {
    return { legend, list };
  }
  const colors = new Map(
    list.map(series => [String(series.name), colorOfSeries(series)]),
  );
  const items: unknown[] = (legend.data ?? []).map((item: unknown) => {
    const base: Anything = isRecord(item) ? item : { name: item };
    const color = colors.get(String(base.name));
    if (!color) return item;
    return {
      ...base,
      ...(format.legendMatchColor && {
        textStyle: { ...base.textStyle, color },
      }),
      // A bar without fill would leave its marker empty
      ...(format.barBorderOnly && { itemStyle: { color } }),
    };
  });
  if (!title) return { legend: { ...legend, data: items }, list };
  // A legend only lists series, so its title is a series without marks
  return {
    legend: {
      ...legend,
      data: [
        {
          name: title,
          icon: 'none',
          textStyle: {
            fontWeight: 'bold',
            ...getEchartsTextStyle(format.legendTitleFont),
          },
        },
        ...items,
      ],
    },
    list: [
      ...list,
      {
        id: '__mibi_legend_title',
        name: title,
        type: list[0]?.type ?? 'line',
        data: [],
        silent: true,
        tooltip: { show: false },
      },
    ],
  };
}

function plotAreaGrid(format: ChartFormatOptions) {
  const color = toCssColor(format.plotAreaColor);
  const image = format.plotAreaImage?.trim();
  if (!color && !image) return undefined;
  return {
    show: true,
    borderWidth: 0,
    backgroundColor: image
      ? { image, repeat: format.plotAreaImageRepeat || 'repeat' }
      : color,
  };
}

const SCROLLBAR_SIZE = 20;

/**
 * Keeps each category at the width asked for: when they do not all fit, the axis
 * shows the ones that do and scrolls to the others.
 */
function categoryScroll(
  options: Anything,
  format: ChartFormatOptions,
  isHorizontal: boolean,
  size: number,
) {
  const minWidth = toBoundedNumber(format.xAxisMinCategoryWidth, 0, 0, 500);
  const axis = isHorizontal ? options.yAxis : options.xAxis;
  if (minWidth <= 0 || axis?.type !== 'category' || options.dataZoom?.length) {
    return undefined;
  }
  const categories = new Set(
    (options.series as Anything[]).flatMap(series =>
      (series.data ?? []).map(
        (point: unknown) => pointValues(point)?.[isHorizontal ? 1 : 0],
      ),
    ),
  );
  const fits = Math.max(1, Math.floor(size / minWidth));
  if (categories.size <= fits) return undefined;
  const atEnd = format.xAxisScrollPosition === 'end';
  const range = {
    startValue: atEnd ? categories.size - fits : 0,
    endValue: atEnd ? categories.size - 1 : fits - 1,
  };
  const axisIndex = isHorizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  return [
    {
      type: 'slider',
      ...axisIndex,
      ...range,
      zoomLock: true,
      brushSelect: false,
      showDetail: false,
      showDataShadow: false,
      // Readable over the light and the dark look of a report
      borderColor: 'transparent',
      fillerColor: 'rgba(128, 128, 128, 0.35)',
      ...(isHorizontal
        ? { right: 0, width: SCROLLBAR_SIZE - 6 }
        : { bottom: 0, height: SCROLLBAR_SIZE - 6 }),
    },
    {
      type: 'inside',
      ...axisIndex,
      zoomOnMouseWheel: false,
      moveOnMouseWheel: true,
    },
  ];
}

/**
 * The options of the pane that take the whole chart to work out. It runs on the
 * finished options, and returns them untouched when none of these is set.
 */
export function applyChartFormat<T extends object>(
  options: T,
  format: ChartFormatOptions,
  {
    isHorizontal = false,
    width = 0,
    height = 0,
    legendState,
    formatter,
    categoryFormatter,
  }: {
    isHorizontal?: boolean;
    width?: number;
    height?: number;
    legendState?: Record<string, boolean>;
    formatter?: (value: number) => string;
    categoryFormatter?: (value: any) => string;
  } = {},
): T {
  const source = options as Anything;
  let list = source.series as Anything[];
  if (!Array.isArray(list)) return options;
  const next: Anything = { ...source };

  const from = toCssColor(format.colorScaleMin);
  const to = toCssColor(format.colorScaleMax);
  if (from && to) {
    list = applyColorScale(list, from, to, isHorizontal ? 0 : 1);
  }
  if (format.barOverlapReverse && isSet(format.barOverlap)) {
    list = list.map((series, index) => ({ ...series, z: list.length - index }));
  }
  list = applyLabelBlocks(list, format, isHorizontal, categoryFormatter);
  if (format.totalLabelsShow) {
    list = [
      ...list,
      ...totalLabelSeries(list, format, {
        isHorizontal,
        legendState,
        formatter,
      }),
    ];
  }
  if (format.seriesLabelsShow) {
    list = applySeriesLabels(list, format, hasAxisOnTheRight(source.yAxis));
    next.grid = {
      ...next.grid,
      right:
        Number(next.grid?.right ?? 0) +
        toBoundedNumber(
          format.seriesLabelMaxWidth,
          SERIES_LABEL_WIDTH,
          20,
          400,
        ),
    };
  }
  if (isRecord(source.legend)) {
    const extras = applyLegendExtras(source.legend, list, format);
    next.legend = extras.legend;
    list = extras.list;
  }
  const plotArea = plotAreaGrid(format);
  if (plotArea) next.grid = { ...next.grid, ...plotArea };

  const scroll = categoryScroll(
    { ...next, series: list },
    format,
    isHorizontal,
    isHorizontal ? height : width,
  );
  if (scroll) {
    next.dataZoom = scroll;
    const side = isHorizontal ? 'right' : 'bottom';
    next.grid = {
      ...next.grid,
      [side]: Number(next.grid?.[side] ?? 0) + SCROLLBAR_SIZE,
    };
  }
  const zoom = zoomFormat({ ...next, series: list }, format, isHorizontal);
  if (zoom) {
    next.dataZoom = zoom.dataZoom;
    next.grid = zoom.grid;
  }
  const added = analyticsSeries(list, format, {
    isHorizontal,
    formatter,
    display: line =>
      getDisplayFormatter(line.labelUnits, line.labelDecimals) ?? undefined,
  });
  if (added.length) list = [...list, ...added];
  next.series = list;

  const unchanged =
    list === source.series &&
    next.grid === source.grid &&
    next.legend === source.legend &&
    next.dataZoom === source.dataZoom;
  return unchanged ? options : (next as T);
}
