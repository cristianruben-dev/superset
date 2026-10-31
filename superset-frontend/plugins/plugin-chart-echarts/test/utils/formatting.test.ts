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
  applyLegendFormatting,
  applyValueLabelStyle,
  getEchartsTextStyle,
  getGridlineStyle,
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
