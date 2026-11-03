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
import type { CSSProperties } from 'react';
import {
  getCustomFontCss,
  toCssColor,
  type FontStyleValue,
  type ColorInput,
} from '@superset-ui/core';

export type CardTextGroup =
  | 'cardValue'
  | 'cardLabel'
  | 'cardSubtitle'
  | 'cardDate'
  | 'kpiGoal'
  | 'kpiDistance';
export type CardFormat = Partial<
  Record<`${CardTextGroup}Font`, FontStyleValue | null>
> &
  Partial<
    Record<`${CardTextGroup}Underline` | `${CardTextGroup}Wrap`, boolean | null>
  > &
  Partial<Record<`${CardTextGroup}Align`, string | null>> & {
    cardValueShow?: boolean | null;
    cardValueUnits?: string | null;
    cardValueDecimals?: number | null;
    cardBlankText?: string | null;
    cardLabelShow?: boolean | null;
    cardLabelText?: string | null;
    cardLabelPosition?: string | null;
    cardLabelGap?: number | null;
    cardVerticalAlign?: string | null;
    kpiTargetValue?: number | null;
    kpiGoalShow?: boolean | null;
    kpiGoalLabel?: string | null;
    kpiDistanceShow?: boolean | null;
    kpiDistanceLabel?: string | null;
    kpiDistanceMode?: string | null;
    kpiDirection?: string | null;
    kpiNeutralBand?: number | null;
    kpiGoodColor?: ColorInput;
    kpiBadColor?: ColorInput;
    kpiNeutralColor?: ColorInput;
    kpiShowIcon?: boolean | null;
    kpiIconSize?: number | null;
    kpiTrendTransparency?: number | null;
  };
/** Resolve only explicit styles; automatic sizing remains the fallback. */
export function cardTextStyle(
  format: CardFormat,
  group: CardTextGroup,
): CSSProperties {
  const align = format[`${group}Align`];
  const wrap = format[`${group}Wrap`];
  const underline = format[`${group}Underline`];
  const font = getCustomFontCss(format[`${group}Font`]);
  // Older dashboard CSS used important rules; scoped variables keep its saved styles editable.
  const legacyPrefix = group === 'cardValue' ? 'value' : 'label';
  const legacy = Object.fromEntries(
    Object.entries({
      size: font.fontSize,
      color: font.color,
      weight: font.fontWeight,
      style: font.fontStyle,
    })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        `--mb-v-${legacyPrefix}-${key}`,
        key === 'size' && typeof value === 'number' ? `${value}px` : value,
      ]),
  );
  return {
    ...font,
    ...legacy,
    ...(['left', 'center', 'right'].includes(align ?? '')
      ? {
          textAlign: align as CSSProperties['textAlign'],
          justifyContent:
            align === 'left'
              ? 'flex-start'
              : align === 'right'
                ? 'flex-end'
                : 'center',
          alignSelf: 'stretch',
          width: '100%',
          '--mb-v-value-items':
            align === 'left'
              ? 'flex-start'
              : align === 'right'
                ? 'flex-end'
                : 'center',
        }
      : {}),
    ...(typeof wrap === 'boolean'
      ? {
          whiteSpace: wrap ? 'normal' : 'nowrap',
          ...(wrap ? { height: 'auto' } : {}),
          overflowWrap: 'anywhere',
        }
      : {}),
    ...(typeof underline === 'boolean'
      ? { textDecoration: underline ? 'underline' : 'none' }
      : {}),
  };
}
/** Zero is a valid target; absent and non-finite inputs are not targets. */
export function finiteTarget(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}
/** Compare the indicator to its explicit goal, with an optional neutral band. */
export function kpiStatus(
  value: unknown,
  goal: number | undefined,
  format: CardFormat,
): 'good' | 'bad' | 'neutral' | undefined {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    goal === undefined
  )
    return undefined;
  const delta = value - goal;
  const band = Math.max(0, finiteTarget(format.kpiNeutralBand) ?? 0);
  if (Math.abs(delta) <= band) return 'neutral';
  return delta * (format.kpiDirection === 'lower' ? -1 : 1) > 0
    ? 'good'
    : 'bad';
}
/** The selected status color, leaving theme fallbacks to the caller. */
export function kpiColor(
  status: ReturnType<typeof kpiStatus>,
  format: CardFormat,
): string | undefined {
  return status
    ? toCssColor(
        status === 'good'
          ? format.kpiGoodColor
          : status === 'bad'
            ? format.kpiBadColor
            : format.kpiNeutralColor,
      )
    : undefined;
}
