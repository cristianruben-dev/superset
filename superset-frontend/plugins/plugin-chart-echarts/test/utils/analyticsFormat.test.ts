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
  analyticsSeries,
  fitLine,
  referenceValue,
  tooltipFieldRows,
  zoomFormat,
} from '../../src/utils/analyticsFormat';
import { applyChartFormat } from '../../src/utils/chartFormatOptions';

const bars = (name: string, values: number[]) => ({
  name,
  type: 'bar',
  data: values.map((value, index) => [`c${index}`, value]),
  itemStyle: { color: '#ff0000' },
});

test('without options nothing is added', () => {
  const options = { series: [bars('A', [1])], grid: {} };
  expect(applyChartFormat(options, {})).toBe(options);
});

test('a reference value can be fixed or come from the marks', () => {
  const list = [bars('A', [1, 2, 3]), bars('B', [10])];
  const of = (line: object) => referenceValue(line, list, 1);
  expect(of({ kind: 'constant', value: '7' })).toBe(7);
  expect(of({ kind: 'constant', value: '' })).toBeUndefined();
  expect(of({ kind: 'min' })).toBe(1);
  expect(of({ kind: 'max' })).toBe(10);
  expect(of({ kind: 'average' })).toBe(4);
  expect(of({ kind: 'median' })).toBe(2.5);
  expect(of({ kind: 'percentile', percentile: 100 })).toBe(10);
  expect(of({ kind: 'max', series: 'A' })).toBe(3);
});

test('a line goes on the axis it names, by the orientation of the chart', () => {
  const lineOf = (isHorizontal: boolean, axis: 'value' | 'category') => {
    const [carrier] = analyticsSeries(
      [bars('A', [1])],
      { referenceLines: [{ kind: 'constant', value: 5, axis, label: true }] },
      { isHorizontal, display: () => undefined },
    ) as any[];
    return carrier.markLine.data[0];
  };
  expect(lineOf(false, 'value').yAxis).toBe(5);
  expect(lineOf(true, 'value').xAxis).toBe(5);
  expect(lineOf(false, 'category').xAxis).toBe(5);
  expect(lineOf(true, 'category').yAxis).toBe(5);
});

test('a hidden line or one without value draws nothing', () => {
  expect(
    analyticsSeries(
      [bars('A', [1])],
      {
        referenceLines: [
          { kind: 'max', show: false },
          { kind: 'constant', value: null },
        ],
      },
      { isHorizontal: false, display: () => undefined },
    ),
  ).toEqual([]);
});

test('a label says its text and value, and a shade adds its band', () => {
  const series = analyticsSeries(
    [bars('A', [1, 2])],
    {
      referenceLines: [
        {
          kind: 'constant',
          value: 5,
          label: true,
          labelText: 'Goal',
          shade: 'after',
        },
      ],
    },
    { isHorizontal: false, display: () => undefined, formatter: String },
  ) as any[];
  expect(series.map(item => item.type)).toEqual(['custom', 'line']);
  expect(series[1].markLine.data[0].label.formatter).toBe('Goal: 5');
  expect(series[0].data[0]).toEqual(['c0', 1]);
});

test('the trend fits the points, together or by series', () => {
  expect(
    fitLine([
      [0, 1],
      [1, 3],
      [2, 5],
    ]),
  ).toEqual({ slope: 2, intercept: 1 });
  expect(fitLine([[0, 1]])).toBeUndefined();
  const list = [bars('A', [1, 3, 5]), bars('B', [5, 3, 1])];
  const context = { isHorizontal: false, display: () => undefined };
  const together = analyticsSeries(list, { trendShow: true }, context) as any[];
  expect(together).toHaveLength(1);
  expect(together[0].data).toEqual([
    ['c0', 3],
    ['c1', 3],
    ['c2', 3],
  ]);
  const apart = analyticsSeries(
    list,
    { trendShow: true, trendCombine: false },
    context,
  ) as any[];
  expect(apart).toHaveLength(2);
  expect(apart[0].lineStyle.color).toBe('#ff0000');
  expect(apart[0].data[2]).toEqual(['c2', 5]);
});

test('zoom sliders go along their axis and make room', () => {
  const zoom = zoomFormat(
    {
      grid: { bottom: 10 },
      dataZoom: [{ type: 'slider' }, { type: 'inside' }],
    },
    { zoomCategoryShow: true, zoomCategoryStart: 20, zoomCategoryEnd: 80 },
    false,
  ) as any;
  expect(zoom.dataZoom).toHaveLength(2);
  expect(zoom.dataZoom[1]).toMatchObject({
    xAxisIndex: 0,
    start: 20,
    end: 80,
    bottom: 4,
  });
  expect(zoom.grid.bottom).toBe(36);
  const across = zoomFormat({}, { zoomValueShow: true }, false) as any;
  expect(across.dataZoom[0]).toMatchObject({ yAxisIndex: 0, right: 4 });
  const horizontal = zoomFormat({}, { zoomCategoryShow: true }, true) as any;
  expect(horizontal.dataZoom[0].yAxisIndex).toBe(0);
  expect(zoomFormat({}, {}, false)).toBeUndefined();
});

test('tooltip fields read their row, by series when it has groups', () => {
  const rows = [
    { x: 'a', region: 'N', cost: 2 },
    { x: 'a', region: 'S', cost: 3 },
    { x: 'b', region: 'N', cost: 9 },
  ];
  const options = {
    xColumn: 'x',
    groupby: ['region'],
    xValue: 'a',
    formatter: String,
  };
  expect(tooltipFieldRows(rows, ['cost'], options)).toEqual([['cost', '5']]);
  expect(
    tooltipFieldRows(rows, ['cost'], { ...options, seriesName: 'S' }),
  ).toEqual([['cost', '3']]);
  expect(tooltipFieldRows(undefined, ['cost'], options)).toEqual([]);
  expect(tooltipFieldRows(rows, [], options)).toEqual([]);
});
