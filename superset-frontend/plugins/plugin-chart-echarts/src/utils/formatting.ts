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
  hasCustomFontStyle,
  toBoundedNumber,
  toCssColor,
} from '@superset-ui/core';
import type { SeriesOption } from 'echarts';
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
export function applyValueLabelStyle<T extends SeriesOption>(
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
  gridlineColor?: ColorInput;
  gridlineWidth?: number | string | null;
  gridlineStyle?: string | null;
};

const GRIDLINE_STYLES = ['solid', 'dashed', 'dotted'];

/** ECharts `lineStyle` for gridlines, or undefined when left at defaults. */
export function getGridlineStyle({
  gridlineColor,
  gridlineWidth,
  gridlineStyle,
}: AxisFormatOptions): Record<string, unknown> | undefined {
  const color = toCssColor(gridlineColor);
  const width = toBoundedNumber(gridlineWidth, 1, 1, 10);
  const type = GRIDLINE_STYLES.includes(gridlineStyle ?? '')
    ? (gridlineStyle as string)
    : 'solid';
  if (!color && width === 1 && type === 'solid') {
    return undefined;
  }
  return {
    ...(color ? { color } : {}),
    width,
    type,
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
  if (gridline) {
    const splitLine = isRecord(axis.splitLine) ? axis.splitLine : {};
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
