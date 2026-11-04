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
import { t } from '@apache-superset/core/translation';
import { getNumberFormatter } from '@superset-ui/core';
import tinycolor from 'tinycolor2';
import { withOpacity } from 'src/mibi/format/styles';
import type {
  AccentBar,
  FilterElement,
  Sides,
  SlicerSelection,
  ValueUnits,
} from './types';

/** What the rules of a slicer work on, independent of how it is drawn. */
export type SlicerValue = string | number | boolean | null;

const UNIT_STEPS: [ValueUnits, number, string][] = [
  ['trillions', 1e12, 'T'],
  ['billions', 1e9, 'B'],
  ['millions', 1e6, 'M'],
  ['thousands', 1e3, 'K'],
];

/** A number with display units and decimals, as charts show them. */
export function formatNumber(
  value: number,
  units: ValueUnits | undefined,
  decimals: number | undefined,
): string {
  const digits =
    decimals === undefined ? '.2~' : `.${Math.min(Math.max(decimals, 0), 9)}`;
  const step =
    units === 'auto'
      ? UNIT_STEPS.find(([, divisor]) => Math.abs(value) >= divisor)
      : UNIT_STEPS.find(([name]) => name === units);
  const [, divisor, suffix] = step ?? ['none', 1, ''];
  return `${getNumberFormatter(`,${digits}f`)(value / divisor)}${suffix}`;
}

/** A number in a d3 format such as ",.0f", or undefined if it is not one. */
export function formatWithCode(value: number, code: string) {
  const formatter = getNumberFormatter(code);
  return formatter.isInvalid ? undefined : formatter(value);
}

/** The text a slicer shows for one of its values. */
export function slicerText(
  value: SlicerValue,
  config: Pick<
    FilterElement,
    'blankText' | 'valueUnits' | 'valueDecimals' | 'valueFormat'
  >,
): string {
  if (value === null || value === '') return config.blankText || t('(Blank)');
  if (typeof value === 'number' && config.valueFormat) {
    const coded = formatWithCode(value, config.valueFormat);
    if (coded !== undefined) return coded;
  }
  const numeric =
    typeof value === 'number' &&
    (config.valueUnits !== undefined || config.valueDecimals !== undefined);
  return numeric
    ? formatNumber(value as number, config.valueUnits, config.valueDecimals)
    : String(value);
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

/** The values in the chosen order; blanks always go last. */
export function sortSlicerValues(
  values: SlicerValue[],
  order: FilterElement['sortValues'],
): SlicerValue[] {
  if (!order) return values;
  const sign = order === 'desc' ? -1 : 1;
  return [...values].sort((a, b) => {
    if (a === null) return b === null ? 0 : 1;
    if (b === null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
    return sign * collator.compare(String(a), String(b));
  });
}

/**
 * How many values a click picks, from the slicer or else from its filter. A
 * filter that takes one value keeps it whatever the slicer says, since its
 * own control in the filter bar could not show more.
 */
export const selectionMode = (
  config: Pick<FilterElement, 'selection'>,
  filterMultiSelect: boolean,
): SlicerSelection =>
  filterMultiSelect ? (config.selection ?? 'multi') : 'single';

/**
 * The selection after a click on a value. `additive` is a click with Ctrl or
 * Cmd held, which only matters to the `ctrl` mode.
 */
export function nextSelection(
  selected: SlicerValue[],
  value: SlicerValue,
  mode: SlicerSelection,
  additive = false,
): SlicerValue[] {
  const chosen = selected.includes(value);
  if (mode === 'multi' || (mode === 'ctrl' && additive)) {
    return chosen
      ? selected.filter(item => item !== value)
      : [...selected, value];
  }
  return chosen && selected.length === 1 ? [] : [value];
}

/** The same key for a value wherever it is stored, blanks included. */
export const slicerValueKey = (value: SlicerValue) =>
  value === null ? '\u0000blank' : String(value);

/** The values a slicer shows, without those the editor left out. */
export function visibleValues(
  values: SlicerValue[],
  hidden: FilterElement['hiddenValues'],
): SlicerValue[] {
  if (!hidden?.length) return values;
  const left = new Set(hidden);
  return values.filter(value => !left.has(slicerValueKey(value)));
}

/**
 * What a text slicer asks for: one part of a value, or whole values. A slicer
 * of numbers takes whole numbers separated by commas and drops what is not one.
 */
export function inputValues(
  text: string,
  match: FilterElement['inputMatch'],
  numeric = false,
): (string | number)[] {
  if (numeric) {
    const numbers = text
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    return Array.from(new Set(numbers));
  }
  if (match !== 'exact') {
    const clean = text.trim();
    return clean ? [clean] : [];
  }
  return Array.from(
    new Set(
      text
        .split(',')
        .map(part => part.trim())
        .filter(Boolean),
    ),
  );
}

/** The data mask filters of a text slicer. */
export function inputFilters(
  column: string,
  values: (string | number)[],
  match: FilterElement['inputMatch'],
  numeric = false,
) {
  if (!values.length) return {};
  return match === 'exact' || numeric
    ? { filters: [{ col: column, op: 'IN' as const, val: values }] }
    : {
        filters: [{ col: column, op: 'ILIKE' as const, val: `%${values[0]}%` }],
      };
}

/** "3 selected", or the value when there is only one. */
export function selectionSummary(
  selected: SlicerValue[],
  config: Parameters<typeof slicerText>[1],
): string {
  if (!selected.length) return t('All values');
  if (selected.length === 1) return slicerText(selected[0], config);
  return t('%s selected', selected.length);
}

export type RelativeScope = 'last' | 'next' | 'this';
export type RelativeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface RelativeDate {
  scope: RelativeScope;
  count: number;
  unit: RelativeUnit;
}

const CURRENT: Record<RelativeUnit, string> = {
  day: 'Current day',
  week: 'Current week',
  month: 'Current month',
  quarter: 'Current quarter',
  year: 'Current year',
};

/** The time range Superset understands for a relative date. */
export function relativeTimeRange({ scope, count, unit }: RelativeDate) {
  if (scope === 'this') return CURRENT[unit];
  const n = Math.max(1, Math.round(count));
  return `${scope === 'last' ? 'Last' : 'Next'} ${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** The relative date a time range of a slicer stands for, if it is one. */
export function parseRelativeTimeRange(
  range: string | undefined,
): RelativeDate | undefined {
  if (!range) return undefined;
  const current = Object.entries(CURRENT).find(([, text]) => text === range);
  if (current) {
    return { scope: 'this', count: 1, unit: current[0] as RelativeUnit };
  }
  const match = range.match(
    /^(Last|Next) (\d+) (day|week|month|quarter|year)s?$/,
  );
  if (!match) return undefined;
  return {
    scope: match[1] === 'Last' ? 'last' : 'next',
    count: Number(match[2]),
    unit: match[3] as RelativeUnit,
  };
}

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

/**
 * The time range between two days, both included. Superset leaves the end of
 * a range out, so it ends the day after.
 */
export function betweenTimeRange(start?: string, end?: string): string {
  const until = end ? new Date(`${end}T00:00:00`) : undefined;
  if (until) until.setDate(until.getDate() + 1);
  return `${start || 'Min'} : ${until ? isoDate(until) : 'Max'}`;
}

/** The two days a time range of a slicer stands for, if it is between days. */
export function parseBetweenTimeRange(
  range: string | undefined,
): [string | undefined, string | undefined] | undefined {
  const match = range?.match(
    /^(\d{4}-\d{2}-\d{2}|Min) : (\d{4}-\d{2}-\d{2}|Max)$/,
  );
  if (!match) return undefined;
  let end: string | undefined;
  if (match[2] !== 'Max') {
    const until = new Date(`${match[2]}T00:00:00`);
    until.setDate(until.getDate() - 1);
    end = isoDate(until);
  }
  return [match[1] === 'Min' ? undefined : match[1], end];
}

/**
 * The padding of a part of a slicer as CSS: each side when they were set one by
 * one, else the uniform padding (twice as wide on the sides), else nothing.
 */
export function paddingOf(
  sides: Sides | undefined,
  uniform: number | undefined,
): string | undefined {
  if (sides) return sides.map(side => `${side}px`).join(' ');
  return uniform === undefined ? undefined : `${uniform}px ${uniform * 2}px`;
}

const ACCENT_OFFSET = {
  left: (width: number) => `${width}px 0`,
  right: (width: number) => `-${width}px 0`,
  top: (width: number) => `0 ${width}px`,
  bottom: (width: number) => `0 -${width}px`,
} as const;

/**
 * An accent bar as an inset box shadow, so it takes no room and follows the
 * corners of the box; undefined when the bar has no color or width.
 */
export function accentShadow(
  bar: AccentBar | undefined,
  fallbackColor: string,
): string | undefined {
  if (!bar) return undefined;
  const width = bar.width ?? 4;
  if (width <= 0) return undefined;
  const color = withOpacity(bar.color || fallbackColor, bar.opacity ?? 100);
  return `inset ${ACCENT_OFFSET[bar.position ?? 'left'](width)} 0 0 ${color}`;
}

/**
 * How readable a text color is on a background, as the WCAG contrast ratio, or
 * undefined when a color cannot be read. 4.5 is the least for normal text.
 */
export function contrastRatio(text?: string, background?: string) {
  if (!text || !background) return undefined;
  const fg = tinycolor(text);
  const bg = tinycolor(background);
  if (!fg.isValid() || !bg.isValid()) return undefined;
  return Math.round(tinycolor.readability(fg, bg) * 10) / 10;
}
