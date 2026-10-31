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
import type { SeriesOption } from 'echarts';
import {
  applyAxisFormatting,
  applyConditionalFormatting,
  applyLegendFormatting,
  applySeriesStyle,
  applyValueLabelStyle,
  getActiveConditionalRules,
  getEchartsTextStyle,
  getGridlineStyle,
  matchesConditionalRule,
} from '../../src/utils/formatting';
import { LegendOrientation } from '../../src/types';

test('getEchartsTextStyle only returns properties set by the user', () => {
  expect(getEchartsTextStyle(undefined)).toEqual({});
  expect(getEchartsTextStyle({})).toEqual({});
  expect(
    getEchartsTextStyle({
      fontFamily: 'Georgia, serif',
      fontSize: 14,
      bold: true,
      italic: false,
      color: '#ff000080',
    }),
  ).toEqual({
    fontFamily: 'Georgia, serif',
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: 'rgba(255, 0, 0, 0.5)',
  });
});

test('applyValueLabelStyle leaves series untouched without customization', () => {
  const series = {
    type: 'bar',
    label: { show: true, position: 'top' },
  } as SeriesOption;
  expect(applyValueLabelStyle(series, {})).toBe(series);
  expect(applyValueLabelStyle(series, { rotate: 0, font: {} })).toBe(series);
});

test('applyValueLabelStyle merges font, background and rotation', () => {
  const formatter = () => 'x';
  const series = {
    type: 'bar',
    label: { show: true, position: 'top', formatter },
  } as SeriesOption;
  const styled = applyValueLabelStyle(series, {
    font: { fontSize: 16, color: '#00ff00', bold: true },
    background: '#000000',
    rotate: '90',
  }) as { label: Record<string, unknown> };
  expect(styled.label).toEqual({
    show: true,
    position: 'top',
    formatter,
    fontSize: 16,
    color: '#00ff00',
    fontWeight: 'bold',
    backgroundColor: '#000000',
    padding: [2, 4],
    borderRadius: 2,
    rotate: 90,
    align: 'left',
    verticalAlign: 'middle',
  });
});

test('applyValueLabelStyle keeps inside labels centered when rotated', () => {
  const series = {
    type: 'bar',
    label: { show: true, position: 'insideTop' },
  } as SeriesOption;
  const styled = applyValueLabelStyle(series, { rotate: 45 }) as {
    label: Record<string, unknown>;
  };
  expect(styled.label.rotate).toBe(45);
  expect(styled.label.align).toBeUndefined();
});

test('applyLegendFormatting is a no-op by default', () => {
  const legend = { top: 0, right: 0 };
  expect(applyLegendFormatting(legend, LegendOrientation.Top, {})).toBe(legend);
});

test('applyLegendFormatting aligns horizontal legends', () => {
  const legend = { top: 0, left: 40, right: 10 };
  expect(
    applyLegendFormatting(legend, LegendOrientation.Top, { align: 'center' }),
  ).toEqual({ top: 0, left: 'center' });
  expect(
    applyLegendFormatting(legend, LegendOrientation.Bottom, { align: 'end' }),
  ).toEqual({ top: 0, right: 10 });
  expect(
    applyLegendFormatting(legend, LegendOrientation.Top, { align: 'start' }),
  ).toEqual({ top: 0, left: 40 });
});

test('applyLegendFormatting aligns vertical legends', () => {
  const legend = { left: 0, top: 30 };
  expect(
    applyLegendFormatting(legend, LegendOrientation.Left, { align: 'center' }),
  ).toEqual({ left: 0, top: 'middle' });
  expect(
    applyLegendFormatting(legend, LegendOrientation.Right, { align: 'end' }),
  ).toEqual({ left: 0, bottom: 0 });
});

test('applyLegendFormatting merges text style and icon', () => {
  const legend = { textStyle: { width: 80, overflow: 'truncate' } };
  expect(
    applyLegendFormatting(legend, LegendOrientation.Right, {
      font: { fontSize: 15, italic: true },
      icon: 'circle',
    }),
  ).toEqual({
    textStyle: {
      width: 80,
      overflow: 'truncate',
      fontSize: 15,
      fontStyle: 'italic',
    },
    icon: 'circle',
  });
  // Unknown icons are ignored.
  expect(
    applyLegendFormatting(legend, LegendOrientation.Right, { icon: 'star' }),
  ).toBe(legend);
});

test('getGridlineStyle returns undefined for defaults', () => {
  expect(getGridlineStyle({})).toBeUndefined();
  expect(
    getGridlineStyle({ gridlineWidth: 1, gridlineStyle: 'solid' }),
  ).toBeUndefined();
  expect(
    getGridlineStyle({ gridlineColor: '#cccccc', gridlineStyle: 'dashed' }),
  ).toEqual({ color: '#cccccc', width: 1, type: 'dashed' });
});

test('applyAxisFormatting merges fonts, inverse and gridlines', () => {
  const formatter = () => '';
  const axis = {
    type: 'value',
    axisLabel: { show: true, formatter },
    splitLine: { show: true },
    name: 'Revenue',
  };
  expect(applyAxisFormatting(axis, {})).toEqual(axis);
  expect(
    applyAxisFormatting(axis, {
      labelFont: { fontSize: 10, color: '#333333' },
      titleFont: { bold: true },
      inverse: true,
      gridlineWidth: 2,
      gridlineStyle: 'dotted',
    }),
  ).toEqual({
    type: 'value',
    name: 'Revenue',
    axisLabel: { show: true, formatter, fontSize: 10, color: '#333333' },
    nameTextStyle: { fontWeight: 'bold' },
    inverse: true,
    splitLine: { show: true, lineStyle: { width: 2, type: 'dotted' } },
  });
});

test('applySeriesStyle is a no-op without customization', () => {
  const series = { type: 'line', name: 'A', lineStyle: {} } as SeriesOption;
  expect(applySeriesStyle(series, {})).toBe(series);
});

test('applySeriesStyle overrides the color of the named series only', () => {
  const series = {
    type: 'bar',
    name: 'Sales',
    itemStyle: { color: '#111111', borderColor: '#111111' },
  } as SeriesOption;
  expect(applySeriesStyle(series, { seriesColors: { Costs: '#ff0000' } })).toBe(
    series,
  );
  expect(
    (
      applySeriesStyle(series, { seriesColors: { Sales: '#ff0000' } }) as {
        itemStyle: Record<string, unknown>;
      }
    ).itemStyle,
  ).toEqual({ color: '#ff0000', borderColor: '#ff0000' });
});

test('applySeriesStyle styles lines and markers', () => {
  const series = {
    type: 'line',
    name: 'A',
    lineStyle: { opacity: 1 },
    symbol: 'emptyCircle',
  } as SeriesOption;
  expect(
    applySeriesStyle(series, {
      lineWidth: '4',
      lineType: 'dashed',
      markerSymbol: 'diamond',
    }),
  ).toEqual({
    type: 'line',
    name: 'A',
    lineStyle: { opacity: 1, width: 4, type: 'dashed' },
    symbol: 'diamond',
  });
  // Dash patterns of time comparison series are preserved.
  const dashed = {
    type: 'line',
    name: 'B',
    lineStyle: { type: [6, 15] },
  } as SeriesOption;
  expect(applySeriesStyle(dashed, { lineType: 'dotted' })).toBe(dashed);
});

test('applySeriesStyle styles bars', () => {
  const series = {
    type: 'bar',
    name: 'A',
    itemStyle: { color: '#111111' },
  } as SeriesOption;
  expect(
    applySeriesStyle(series, {
      barCategoryGap: 40,
      barBorderColor: '#000000',
      barBorderWidth: 2,
      barBorderRadius: 6,
    }),
  ).toEqual({
    type: 'bar',
    name: 'A',
    barCategoryGap: '40%',
    itemStyle: {
      color: '#111111',
      borderWidth: 2,
      borderType: 'solid',
      borderColor: '#000000',
      borderRadius: [6, 6, 0, 0],
    },
  });
  expect(
    (
      applySeriesStyle(series, { barBorderRadius: 6, isHorizontal: true }) as {
        itemStyle: Record<string, unknown>;
      }
    ).itemStyle.borderRadius,
  ).toEqual([0, 6, 6, 0]);
});

test('matchesConditionalRule evaluates every operator', () => {
  const rule = (operator: string, value: number, value2?: number) =>
    ({ operator, value, value2 }) as Parameters<
      typeof matchesConditionalRule
    >[0];
  expect(matchesConditionalRule(rule('>', 5), 6)).toBe(true);
  expect(matchesConditionalRule(rule('>', 5), 5)).toBe(false);
  expect(matchesConditionalRule(rule('>=', 5), 5)).toBe(true);
  expect(matchesConditionalRule(rule('<', 5), 4)).toBe(true);
  expect(matchesConditionalRule(rule('<=', 5), 6)).toBe(false);
  expect(matchesConditionalRule(rule('=', 5), 5)).toBe(true);
  expect(matchesConditionalRule(rule('!=', 5), 5)).toBe(false);
  expect(matchesConditionalRule(rule('between', 10, 1), 5)).toBe(true);
  expect(matchesConditionalRule(rule('between', 1, 10), 11)).toBe(false);
  expect(matchesConditionalRule(rule('>', 5), null)).toBe(false);
});

test('getActiveConditionalRules drops incomplete rules', () => {
  expect(
    getActiveConditionalRules([
      { operator: '>', value: 1, color: '#ff0000' },
      { operator: '>', value: null, color: '#ff0000' },
      { operator: '>', value: 1 },
      'nope',
    ]),
  ).toEqual([{ operator: '>', value: 1, color: '#ff0000' }]);
  expect(getActiveConditionalRules(undefined)).toEqual([]);
});

test('applyConditionalFormatting colors matching points and labels', () => {
  const series = {
    type: 'bar',
    name: 'Sales',
    data: [
      [1, 10],
      [2, 50],
      { value: [3, 90], label: { position: 'top' } },
      [4, null],
    ],
  } as SeriesOption;
  const styled = applyConditionalFormatting(
    series,
    [
      { operator: '>', value: 80, color: '#00ff00', target: 'both' },
      { operator: '>', value: 40, color: '#ff0000', target: 'mark' },
    ],
    1,
  ) as { data: unknown[] };
  expect(styled.data).toEqual([
    [1, 10],
    { value: [2, 50], itemStyle: { color: '#ff0000' } },
    {
      value: [3, 90],
      itemStyle: { color: '#00ff00' },
      label: { position: 'top', color: '#00ff00' },
    },
    [4, null],
  ]);
});

test('applyConditionalFormatting respects the rule series', () => {
  const series = {
    type: 'line',
    name: 'Costs',
    data: [[1, 100]],
  } as SeriesOption;
  expect(
    applyConditionalFormatting(
      series,
      [{ operator: '>', value: 1, color: '#ff0000', series: 'Sales' }],
      1,
    ),
  ).toBe(series);
});
