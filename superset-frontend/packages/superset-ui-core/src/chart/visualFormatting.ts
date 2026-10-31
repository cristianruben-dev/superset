/*
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

/**
 * Shared, chart-agnostic helpers for the "Format" controls a user edits in
 * Explore (font styles, colors and value rules). They live in core so every
 * chart plugin (ECharts labels, legends and axes, the table) resolves the
 * same form-data values the same way.
 */

/** A color as stored by the color picker controls. */
export type ColorInput =
  | string
  | { r: number; g: number; b: number; a?: number }
  | null
  | undefined;

/** Value stored by the `FontControl` explore control. */
export interface FontStyleValue {
  /** CSS font family; empty means "inherit from the theme". */
  fontFamily?: string | null;
  /** Font size in pixels; empty means "use the default for this element". */
  fontSize?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  /** Text color; empty means "inherit from the theme". */
  color?: ColorInput;
}

export interface ResolvedFontStyle {
  fontFamily?: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color?: string;
}

export const FONT_FAMILY_OPTIONS: [string, string][] = [
  ['Inter, Helvetica, Arial, sans-serif', 'Inter'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Helvetica, Arial, sans-serif', 'Helvetica'],
  ['"Segoe UI", Roboto, sans-serif', 'Segoe UI'],
  ['Roboto, Arial, sans-serif', 'Roboto'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet MS'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Courier New", Courier, monospace', 'Courier New'],
];

const clampAlpha = (alpha: number) => Math.min(Math.max(alpha, 0), 1);

/**
 * Converts any color value stored by the color picker controls (hex string,
 * 8-digit hex with alpha, CSS color string or `{r, g, b, a}` object) into a
 * CSS color string that both the DOM and ECharts understand. Returns
 * `undefined` for empty values so callers can fall back to theme defaults.
 */
export function toCssColor(color: ColorInput): string | undefined {
  if (color === null || color === undefined || color === '') {
    return undefined;
  }
  if (typeof color === 'object') {
    const { r, g, b, a = 1 } = color;
    if ([r, g, b].some(channel => typeof channel !== 'number')) {
      return undefined;
    }
    return `rgba(${r}, ${g}, ${b}, ${clampAlpha(a)})`;
  }
  const value = color.trim();
  const hex8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(
    value,
  );
  if (hex8) {
    const [r, g, b, a] = hex8.slice(1).map(part => parseInt(part, 16));
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
  }
  return value || undefined;
}

/**
 * Parses a numeric control value (controls may store numbers as strings),
 * clamping it to `[min, max]` and falling back when it is empty or invalid.
 */
export function toBoundedNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Resolves a stored font style against element-specific defaults.
 */
export function resolveFontStyle(
  value: FontStyleValue | null | undefined,
  defaults: Partial<ResolvedFontStyle> & { fontSize: number },
): ResolvedFontStyle {
  const font = value && typeof value === 'object' ? value : {};
  return {
    fontFamily: font.fontFamily || defaults.fontFamily || undefined,
    fontSize: toBoundedNumber(font.fontSize, defaults.fontSize, 6, 96),
    bold: typeof font.bold === 'boolean' ? font.bold : Boolean(defaults.bold),
    italic:
      typeof font.italic === 'boolean' ? font.italic : Boolean(defaults.italic),
    color: toCssColor(font.color) ?? defaults.color,
  };
}

/**
 * Whether a stored font style differs from "inherit everything", i.e. the
 * user changed at least one property.
 */
export function hasCustomFontStyle(
  value: FontStyleValue | null | undefined,
): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Boolean(
    value.fontFamily ||
    (value.fontSize !== null &&
      value.fontSize !== undefined &&
      `${value.fontSize}` !== '') ||
    typeof value.bold === 'boolean' ||
    typeof value.italic === 'boolean' ||
    toCssColor(value.color),
  );
}

/** CSS properties for the font style properties the user explicitly set. */
export function getCustomFontCss(
  font: FontStyleValue | null | undefined,
): Partial<{
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  fontStyle: string;
  color: string;
}> {
  if (!font || !hasCustomFontStyle(font)) {
    return {};
  }
  const css: ReturnType<typeof getCustomFontCss> = {};
  if (font.fontFamily) css.fontFamily = font.fontFamily;
  const size = toBoundedNumber(font.fontSize, Number.NaN, 6, 96);
  if (Number.isFinite(size)) css.fontSize = `${size}px`;
  if (typeof font.bold === 'boolean') css.fontWeight = font.bold ? 700 : 400;
  if (typeof font.italic === 'boolean') {
    css.fontStyle = font.italic ? 'italic' : 'normal';
  }
  const color = toCssColor(font.color);
  if (color) css.color = color;
  return css;
}

/* -------------------------------------------------------------------------
 * Value rules shared by chart and table conditional formatting
 * ---------------------------------------------------------------------- */

export type ValueRuleOperator =
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'between';

export interface ValueRule {
  operator: ValueRuleOperator;
  value?: number | string | null;
  /** Upper bound for the `between` operator (inclusive). */
  value2?: number | string | null;
  color?: ColorInput;
}

const toFiniteRuleNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Whether a value satisfies a rule. Incomplete rules never match. */
export function matchesValueRule(rule: ValueRule, value: unknown): boolean {
  if (typeof value === 'boolean') return false;
  const numeric = toFiniteRuleNumber(value);
  const target = toFiniteRuleNumber(rule.value);
  if (numeric === undefined || target === undefined) return false;
  switch (rule.operator) {
    case '>':
      return numeric > target;
    case '>=':
      return numeric >= target;
    case '<':
      return numeric < target;
    case '<=':
      return numeric <= target;
    case '=':
      return numeric === target;
    case '!=':
      return numeric !== target;
    case 'between': {
      const upper = toFiniteRuleNumber(rule.value2);
      if (upper === undefined) return false;
      return (
        numeric >= Math.min(target, upper) && numeric <= Math.max(target, upper)
      );
    }
    default:
      return false;
  }
}

/** Keeps only rules complete enough to evaluate (operator, value, color). */
export function getCompleteValueRules<T extends ValueRule>(
  rules: unknown,
): T[] {
  if (!Array.isArray(rules)) return [];
  return rules.filter(
    (rule): rule is T =>
      typeof rule === 'object' &&
      rule !== null &&
      typeof (rule as ValueRule).operator === 'string' &&
      toFiniteRuleNumber((rule as ValueRule).value) !== undefined &&
      Boolean(toCssColor((rule as ValueRule).color)),
  );
}
