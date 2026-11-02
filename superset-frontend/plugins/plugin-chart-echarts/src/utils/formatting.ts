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
  type ValueRule,
  type ValueRuleOperator,
  getCompleteValueRules,
  hasCustomFontStyle,
  matchesValueRule,
  toBoundedNumber,
  toCssColor,
} from '@superset-ui/core';
import { LegendOrientation } from '../types';

/*
 * Translates the "Format" controls (data labels, legend, axes) into ECharts
 * options. Every helper is a no-op when the user has not customized the
 * related controls, so existing charts render exactly as before.
 */

/** ECharts text style properties derived from a FontControl value. */
export type EchartsTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'bold' | 'normal';
  fontStyle?: 'italic' | 'normal';
  color?: string;
};

/**
 * Returns only the text style properties the user explicitly set, so that
 * unset properties keep inheriting from the theme and chart defaults.
 */
export function getEchartsTextStyle(
  font: FontStyleValue | null | undefined,
): EchartsTextStyle {
  if (!hasCustomFontStyle(font) || !font) {
    return {};
  }
  const style: EchartsTextStyle = {};
  if (font.fontFamily) {
    style.fontFamily = font.fontFamily;
  }
  const fontSize = toBoundedNumber(font.fontSize, Number.NaN, 6, 96);
  if (Number.isFinite(fontSize)) {
    style.fontSize = fontSize;
  }
  if (typeof font.bold === 'boolean') {
    style.fontWeight = font.bold ? 'bold' : 'normal';
  }
  if (typeof font.italic === 'boolean') {
    style.fontStyle = font.italic ? 'italic' : 'normal';
  }
  const color = toCssColor(font.color);
  if (color) {
    style.color = color;
  }
  return style;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* -------------------------------------------------------------------------
 * Data labels
 * ---------------------------------------------------------------------- */

export type ValueLabelStyleOptions = {
  font?: FontStyleValue | null;
  background?: ColorInput;
  rotate?: number | string | null;
};

export const VALUE_LABEL_BACKGROUND_PADDING: [number, number] = [2, 4];
export const VALUE_LABEL_BACKGROUND_RADIUS = 2;

/** Whether any data label style control differs from its default. */
export function hasValueLabelStyle({
  font,
  background,
  rotate,
}: ValueLabelStyleOptions): boolean {
  return (
    hasCustomFontStyle(font) ||
    Boolean(toCssColor(background)) ||
    toBoundedNumber(rotate, 0, -90, 90) !== 0
  );
}

const OUTSIDE_TOP_POSITIONS = new Set(['top', 'outside']);

/**
 * Applies the data label font, background and orientation to a series'
 * label, leaving its position and formatter untouched.
 */
export function applyValueLabelStyle<T extends object>(
  series: T,
  options: ValueLabelStyleOptions,
): T {
  const { label } = series as { label?: unknown };
  if (!isRecord(label) || !hasValueLabelStyle(options)) {
    return series;
  }
  const textStyle = getEchartsTextStyle(options.font);
  const background = toCssColor(options.background);
  const rotate = toBoundedNumber(options.rotate, 0, -90, 90);
  const position = typeof label.position === 'string' ? label.position : '';

  return {
    ...series,
    label: {
      ...label,
      ...textStyle,
      ...(background
        ? {
            backgroundColor: background,
            padding: VALUE_LABEL_BACKGROUND_PADDING,
            borderRadius: VALUE_LABEL_BACKGROUND_RADIUS,
          }
        : {}),
      ...(rotate !== 0
        ? {
            rotate,
            // Rotated text anchored above a point/bar should grow away from
            // it instead of being centered over it.
            ...(OUTSIDE_TOP_POSITIONS.has(position)
              ? { align: 'left', verticalAlign: 'middle' }
              : {}),
          }
        : {}),
    },
  };
}

/* -------------------------------------------------------------------------
 * Legend
 * ---------------------------------------------------------------------- */

export type LegendAlign = 'start' | 'center' | 'end';

export type LegendFormatOptions = {
  align?: LegendAlign | null;
  font?: FontStyleValue | null;
  icon?: string | null;
};

const LEGEND_ALIGNS: LegendAlign[] = ['start', 'center', 'end'];
export const LEGEND_ICONS = [
  'circle',
  'rect',
  'roundRect',
  'triangle',
  'diamond',
] as const;

export const resolveLegendAlign = (value: unknown): LegendAlign | undefined =>
  LEGEND_ALIGNS.includes(value as LegendAlign)
    ? (value as LegendAlign)
    : undefined;

export const resolveLegendIcon = (value: unknown): string | undefined =>
  (LEGEND_ICONS as readonly string[]).includes(value as string)
    ? (value as string)
    : undefined;

const isOffset = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && value !== '');

/**
 * Applies alignment, text style and marker shape to a native ECharts legend
 * built by `getLegendProps`.
 */
export function applyLegendFormatting<T extends Record<string, unknown>>(
  legend: T,
  orientation: LegendOrientation | string | undefined,
  { align, font, icon }: LegendFormatOptions,
): T {
  const resolvedAlign = resolveLegendAlign(align);
  const resolvedIcon = resolveLegendIcon(icon);
  const textStyle = getEchartsTextStyle(font);
  if (!resolvedAlign && !resolvedIcon && Object.keys(textStyle).length === 0) {
    return legend;
  }

  const next: Record<string, unknown> = { ...legend };
  if (Object.keys(textStyle).length > 0) {
    next.textStyle = {
      ...(isRecord(legend.textStyle) ? legend.textStyle : {}),
      ...textStyle,
    };
  }
  if (resolvedIcon) {
    next.icon = resolvedIcon;
  }
  if (resolvedAlign) {
    const isVertical =
      orientation === LegendOrientation.Left ||
      orientation === LegendOrientation.Right;
    if (isVertical) {
      const top = isOffset(legend.top) ? legend.top : 0;
      delete next.top;
      delete next.bottom;
      if (resolvedAlign === 'start') next.top = top;
      if (resolvedAlign === 'center') next.top = 'middle';
      if (resolvedAlign === 'end') next.bottom = 0;
    } else {
      const left = isOffset(legend.left) ? legend.left : 0;
      const right = isOffset(legend.right) ? legend.right : 0;
      delete next.left;
      delete next.right;
      if (resolvedAlign === 'start') next.left = left;
      if (resolvedAlign === 'center') next.left = 'center';
      if (resolvedAlign === 'end') next.right = right;
    }
  }
  return next as T;
}

/* -------------------------------------------------------------------------
 * Axes and gridlines
 * ---------------------------------------------------------------------- */

export type AxisFormatOptions = {
  labelFont?: FontStyleValue | null;
  titleFont?: FontStyleValue | null;
  inverse?: boolean | null;
  /** Hides the line, ticks and labels of the axis */
  hidden?: boolean | null;
  /** Hides the gridlines of the axis */
  hideGridlines?: boolean | null;
  gridlineColor?: ColorInput;
  gridlineWidth?: number | string | null;
  gridlineStyle?: string | null;
  /** Dash and gap lengths, as "4 2"; wins over the style */
  gridlineDash?: string | null;
  gridlineCap?: string | null;
  /** Draws the gridlines of an axis that has none by default */
  showGridlines?: boolean | null;
  /** Where the axis goes when it switches sides */
  position?: string | null;
  logScale?: boolean | null;
  /** Replaces the formatter of the labels of a numeric axis */
  labelFormatter?: ((value: number) => string) | null;
  labelMaxWidth?: number | string | null;
};

/** The dash pattern in a text like "4 2", or undefined if it has none. */
export function parseDashArray(value: unknown): number[] | undefined {
  if (typeof value !== 'string') return undefined;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  return parts.length > 0 && parts.every(part => part > 0) ? parts : undefined;
}

const GRIDLINE_STYLES = ['solid', 'dashed', 'dotted'];

/** ECharts `lineStyle` for gridlines, or undefined when left at defaults. */
export function getGridlineStyle({
  gridlineColor,
  gridlineWidth,
  gridlineStyle,
  gridlineDash,
  gridlineCap,
}: AxisFormatOptions): Record<string, unknown> | undefined {
  const color = toCssColor(gridlineColor);
  const width = toBoundedNumber(gridlineWidth, 1, 1, 10);
  const type = GRIDLINE_STYLES.includes(gridlineStyle ?? '')
    ? (gridlineStyle as string)
    : 'solid';
  const dash = parseDashArray(gridlineDash);
  if (!color && width === 1 && type === 'solid' && !dash && !gridlineCap) {
    return undefined;
  }
  return {
    ...(color ? { color } : {}),
    width,
    type: dash ?? type,
    ...(gridlineCap ? { cap: gridlineCap } : {}),
  };
}

/**
 * Applies label/title fonts, direction and gridline style to an ECharts axis
 * option. Visibility flags already set on the axis are preserved.
 */
export function applyAxisFormatting<T extends Record<string, unknown>>(
  axis: T,
  options: AxisFormatOptions,
): T {
  const labelStyle = getEchartsTextStyle(options.labelFont);
  const titleStyle = getEchartsTextStyle(options.titleFont);
  const gridline = getGridlineStyle(options);
  const next: Record<string, unknown> = { ...axis };

  if (Object.keys(labelStyle).length > 0) {
    next.axisLabel = {
      ...(isRecord(axis.axisLabel) ? axis.axisLabel : {}),
      ...labelStyle,
    };
  }
  if (Object.keys(titleStyle).length > 0) {
    next.nameTextStyle = {
      ...(isRecord(axis.nameTextStyle) ? axis.nameTextStyle : {}),
      ...titleStyle,
    };
  }
  if (options.inverse) {
    next.inverse = true;
  }
  if (options.hidden) {
    // `show: false` would take the gridlines with it
    for (const part of ['axisLine', 'axisTick', 'axisLabel']) {
      next[part] = {
        ...(isRecord(next[part]) ? (next[part] as object) : {}),
        show: false,
      };
    }
  }
  if (options.position) {
    next.position = options.position;
  }
  if (options.logScale && axis.type === 'value') {
    next.type = 'log';
  }
  const isNumeric = next.type === 'value' || next.type === 'log';
  const maxWidth = toBoundedNumber(options.labelMaxWidth, 0, 0, 2000);
  if ((options.labelFormatter && isNumeric) || maxWidth > 0) {
    next.axisLabel = {
      ...(isRecord(next.axisLabel) ? next.axisLabel : {}),
      ...(options.labelFormatter && isNumeric
        ? { formatter: options.labelFormatter }
        : {}),
      ...(maxWidth > 0 ? { width: maxWidth, overflow: 'truncate' } : {}),
    };
  }
  if (options.showGridlines && !options.hideGridlines) {
    next.splitLine = {
      ...(isRecord(next.splitLine) ? next.splitLine : {}),
      show: true,
    };
  }
  if (options.hideGridlines) {
    next.splitLine = {
      ...(isRecord(next.splitLine) ? (next.splitLine as object) : {}),
      show: false,
    };
  } else if (gridline) {
    const splitLine = isRecord(next.splitLine) ? next.splitLine : {};
    next.splitLine = {
      ...splitLine,
      lineStyle: {
        ...(isRecord(splitLine.lineStyle) ? splitLine.lineStyle : {}),
        ...gridline,
      },
    };
  }
  return next as T;
}

/* -------------------------------------------------------------------------
 * Series (lines, markers, bars)
 * ---------------------------------------------------------------------- */

export type SeriesStyleOptions = {
  /** Color overrides keyed by series name. */
  seriesColors?: Record<string, ColorInput> | null;
  lineWidth?: number | string | null;
  lineType?: string | null;
  markerSymbol?: string | null;
  /** Gap between bar categories, as a percentage of the category width. */
  barCategoryGap?: number | string | null;
  barBorderColor?: ColorInput;
  barBorderWidth?: number | string | null;
  barBorderRadius?: number | string | null;
  isHorizontal?: boolean;
};

export const MARKER_SYMBOLS = [
  'circle',
  'emptyCircle',
  'rect',
  'roundRect',
  'triangle',
  'diamond',
  'pin',
  'arrow',
] as const;

const isEmptyNumber = (value: unknown) =>
  value === null || value === undefined || value === '';

/**
 * Applies the "Series format" controls to a single series: color override,
 * line width/style, marker shape, and bar spacing/border/rounded corners.
 */
export function applySeriesStyle<T extends object>(
  series: T,
  options: SeriesStyleOptions,
): T {
  const next = { ...series } as Record<string, unknown>;
  const type = next.type as string | undefined;
  const name = next.name === undefined ? undefined : String(next.name);
  let changed = false;

  const color =
    name !== undefined && isRecord(options.seriesColors)
      ? toCssColor(options.seriesColors[name])
      : undefined;
  if (color) {
    const itemStyle = isRecord(next.itemStyle) ? next.itemStyle : {};
    next.itemStyle = {
      ...itemStyle,
      color,
      // Dotted "connect nulls" bar borders follow the series color.
      ...(itemStyle.borderColor !== undefined &&
      itemStyle.borderColor === itemStyle.color
        ? { borderColor: color }
        : {}),
    };
    if (isRecord(next.lineStyle) && next.lineStyle.color !== undefined) {
      next.lineStyle = { ...next.lineStyle, color };
    }
    changed = true;
  }

  if (type === 'line') {
    const lineStyle = isRecord(next.lineStyle) ? next.lineStyle : {};
    const patch: Record<string, unknown> = {};
    if (!isEmptyNumber(options.lineWidth)) {
      patch.width = toBoundedNumber(options.lineWidth, 2, 1, 10);
    }
    // Time comparison series already use dash patterns to stay
    // distinguishable, so only solid lines take the user's style.
    if (
      (options.lineType === 'dashed' || options.lineType === 'dotted') &&
      (lineStyle.type === undefined || lineStyle.type === 'solid')
    ) {
      patch.type = options.lineType;
    }
    if (Object.keys(patch).length > 0) {
      next.lineStyle = { ...lineStyle, ...patch };
      changed = true;
    }
  }

  if (
    (type === 'line' || type === 'scatter') &&
    (MARKER_SYMBOLS as readonly string[]).includes(options.markerSymbol ?? '')
  ) {
    next.symbol = options.markerSymbol;
    changed = true;
  }

  if (type === 'bar') {
    if (!isEmptyNumber(options.barCategoryGap)) {
      next.barCategoryGap = `${toBoundedNumber(options.barCategoryGap, 20, 0, 95)}%`;
      changed = true;
    }
    const borderWidth = toBoundedNumber(options.barBorderWidth, 0, 0, 10);
    const borderColor = toCssColor(options.barBorderColor);
    const radius = toBoundedNumber(options.barBorderRadius, 0, 0, 50);
    if (borderWidth > 0 || radius > 0) {
      const itemStyle = isRecord(next.itemStyle) ? next.itemStyle : {};
      next.itemStyle = {
        ...itemStyle,
        ...(borderWidth > 0
          ? {
              borderWidth,
              borderType: 'solid',
              ...(borderColor ? { borderColor } : {}),
            }
          : {}),
        // Round only the bar end, like a column's top edge.
        ...(radius > 0
          ? {
              borderRadius: options.isHorizontal
                ? [0, radius, radius, 0]
                : [radius, radius, 0, 0],
            }
          : {}),
      };
      changed = true;
    }
  }

  return changed ? (next as T) : series;
}

/* -------------------------------------------------------------------------
 * Conditional formatting of chart marks and labels
 * ---------------------------------------------------------------------- */

export type ChartConditionalOperator = ValueRuleOperator;

export type ChartConditionalTarget = 'mark' | 'label' | 'both';

export interface ChartConditionalRule extends ValueRule {
  target?: ChartConditionalTarget;
  /** Series name the rule applies to; empty means every series. */
  series?: string | null;
}

/** Whether a value satisfies a rule. Invalid rules never match. */
export const matchesConditionalRule = (
  rule: ChartConditionalRule,
  value: unknown,
): boolean => matchesValueRule(rule, value);

/** Rules that are complete enough to evaluate. */
export const getActiveConditionalRules = (
  rules: unknown,
): ChartConditionalRule[] => getCompleteValueRules<ChartConditionalRule>(rules);

/**
 * Colors individual data points (bars, markers) and/or their labels when
 * their value matches a rule. The first matching rule wins. Points are
 * turned into `{ value, itemStyle, label }` objects, which every series path
 * in the chart already supports.
 */
export function applyConditionalFormatting<T extends object>(
  series: T,
  rules: ChartConditionalRule[],
  valueIndex: number,
): T {
  const { name: rawName } = series as { name?: unknown };
  const name = rawName === undefined ? '' : String(rawName);
  const seriesRules = rules.filter(
    rule => !rule.series || rule.series === name,
  );
  const { data } = series as { data?: unknown };
  if (seriesRules.length === 0 || !Array.isArray(data)) {
    return series;
  }
  let changed = false;
  const nextData = data.map(point => {
    const tuple = Array.isArray(point)
      ? point
      : isRecord(point) && Array.isArray(point.value)
        ? point.value
        : undefined;
    if (!tuple) return point;
    const rule = seriesRules.find(r =>
      matchesConditionalRule(r, tuple[valueIndex]),
    );
    if (!rule) return point;
    const color = toCssColor(rule.color);
    const target = rule.target ?? 'mark';
    const base: Record<string, unknown> = isRecord(point)
      ? point
      : { value: point };
    changed = true;
    return {
      ...base,
      ...(target === 'mark' || target === 'both'
        ? {
            itemStyle: {
              ...(isRecord(base.itemStyle) ? base.itemStyle : {}),
              color,
            },
          }
        : {}),
      ...(target === 'label' || target === 'both'
        ? {
            label: {
              ...(isRecord(base.label) ? base.label : {}),
              color,
            },
          }
        : {}),
    };
  });
  return changed ? ({ ...series, data: nextData } as T) : series;
}

/**
 * On stacked bars only the segment at the top of each stack keeps the
 * rounded corners, so a stack reads as one rounded column instead of a pile
 * of rounded blocks. ECharts draws the last series of a stack on top.
 */
export function keepBarRadiusOnStackTop<T extends object>(series: T[]): T[] {
  const seenStacks = new Set<string>();
  const result = [...series];
  for (let i = result.length - 1; i >= 0; i -= 1) {
    const item = result[i] as Record<string, unknown>;
    const { stack, itemStyle } = item;
    if (
      item.type === 'bar' &&
      typeof stack === 'string' &&
      stack !== '' &&
      isRecord(itemStyle) &&
      itemStyle.borderRadius !== undefined
    ) {
      if (seenStacks.has(stack)) {
        const { borderRadius, ...rest } = itemStyle;
        result[i] = { ...item, itemStyle: rest } as T;
      } else {
        seenStacks.add(stack);
      }
    }
  }
  return result;
}

/** What the page around a chart asks of it, as a JSON string. */
export type HostFormat = {
  sampling?: boolean;
  tooltip?: {
    show?: boolean;
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    textColor?: string;
    labelColor?: string;
    valueColor?: string;
    boldValues?: boolean;
    background?: string;
    sentence?: string;
  };
};

const escapeHtml = (text: unknown) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const tooltipValue = (value: unknown) => {
  if (Array.isArray(value)) return value[value.length - 1];
  return value;
};

/** A sentence for each mark under the mouse, instead of the usual table. */
export const sentenceFormatter = (template: string) => (params: unknown) =>
  (Array.isArray(params) ? params : [params])
    .map((mark: { seriesName?: string; name?: string; value?: unknown }) =>
      escapeHtml(template)
        .replace(/\{series\}/g, escapeHtml(mark.seriesName))
        .replace(/\{name\}/g, escapeHtml(mark.name))
        .replace(/\{value\}/g, escapeHtml(tooltipValue(mark.value))),
    )
    .join('<br/>');

/**
 * Adds what the page around a chart asks of it to its options: the look of the
 * tooltips and sampling of dense series. Without a request, the options stay as
 * they are.
 */
export function applyHostFormat<T extends Record<string, any>>(
  options: T,
  hostFormat: string | undefined,
): T {
  if (!hostFormat) return options;
  let format: HostFormat;
  try {
    format = JSON.parse(hostFormat);
  } catch {
    return options;
  }
  const next: Record<string, any> = { ...options };
  const { tooltip, sampling } = format;
  if (tooltip) {
    const cssVars = [
      tooltip.labelColor && `--mb-tt-label:${tooltip.labelColor}`,
      tooltip.valueColor && `--mb-tt-value:${tooltip.valueColor}`,
      tooltip.boldValues && '--mb-tt-value-weight:700',
      tooltip.underline && '--mb-tt-decoration:underline',
    ].filter(Boolean);
    next.tooltip = {
      ...options.tooltip,
      ...(tooltip.show === false && { show: false }),
      ...(tooltip.background && { backgroundColor: tooltip.background }),
      className: `${options.tooltip?.className ?? ''} mibi-tooltip`.trim(),
      textStyle: {
        ...options.tooltip?.textStyle,
        ...(tooltip.textColor && { color: tooltip.textColor }),
        ...(tooltip.fontFamily && { fontFamily: tooltip.fontFamily }),
        ...(tooltip.fontSize && { fontSize: tooltip.fontSize }),
        ...(tooltip.bold && { fontWeight: 'bold' }),
        ...(tooltip.italic && { fontStyle: 'italic' }),
      },
      extraCssText: [options.tooltip?.extraCssText, ...cssVars]
        .filter(Boolean)
        .join(';'),
      ...(tooltip.sentence && {
        formatter: sentenceFormatter(tooltip.sentence),
      }),
    };
  }
  if (sampling && Array.isArray(options.series)) {
    next.series = options.series.map((series: Record<string, unknown>) =>
      series.type === 'scatter'
        ? { ...series, large: true }
        : { ...series, sampling: 'lttb' },
    );
  }
  return next as T;
}
