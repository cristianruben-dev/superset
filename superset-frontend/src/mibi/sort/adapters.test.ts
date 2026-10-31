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
  ChartProps,
  DatasourceType,
  VizType,
  type ChartDataResponseResult,
  type QueryFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme } from '@apache-superset/core/theme';
import type { Dataset } from '@superset-ui/chart-controls';
import {
  TimeseriesDefaultFormData,
  TimeseriesTransformProps,
} from '@superset-ui/plugin-chart-echarts';
import { sortAdapterFor } from './adapters';
import type { VisualSort } from './types';

const dataset = {
  id: 1,
  type: DatasourceType.Table,
  columns: [
    { column_name: 'country', type_generic: GenericDataType.String },
    {
      column_name: 'ds',
      type_generic: GenericDataType.Temporal,
      is_dttm: true,
    },
  ],
  metrics: [],
  column_formats: {},
  verbose_map: {},
  main_dttm_col: 'ds',
  datasource_name: 'sales',
  description: null,
} as unknown as Dataset;

const barFormData = (extra: Partial<QueryFormData> = {}): QueryFormData => ({
  datasource: '1__table',
  viz_type: VizType.Bar,
  x_axis: 'country',
  metrics: ['SUM(sales)'],
  groupby: [],
  ...extra,
});

const adapter = sortAdapterFor(VizType.Bar)!;

/** Applies a sort the way the dashboard saves it. */
const sorted = (formData: QueryFormData, sort: VisualSort) => ({
  ...formData,
  ...adapter.toFormData(sort, formData),
});

test('bar, line, area, step, scatter and smooth line charts can be sorted', () => {
  [
    VizType.Bar,
    VizType.Line,
    VizType.Area,
    VizType.Step,
    VizType.Scatter,
    VizType.SmoothLine,
  ].forEach(vizType => expect(sortAdapterFor(vizType)).toBeDefined());
});

test('other charts have no sort adapter', () => {
  [VizType.Treemap, VizType.Gauge, VizType.Waterfall, undefined].forEach(
    vizType => expect(sortAdapterFor(vizType)).toBeUndefined(),
  );
});

test('a time axis offers no sort', () => {
  expect(adapter.options(barFormData({ x_axis: 'ds' }), dataset)).toBeNull();
});

test('a category axis offers the axis and the metrics', () => {
  expect(adapter.options(barFormData(), dataset)).toEqual([
    { value: 'country', label: 'country' },
    { value: 'SUM(sales)', label: 'SUM(sales)' },
  ]);
});

test('a chart without a saved sort has no current sort', () => {
  expect(adapter.current(barFormData())).toBeUndefined();
});

test('a vertical chart stores the sort as it reads', () => {
  const formData = sorted(barFormData(), {
    by: 'SUM(sales)',
    ascending: true,
  });
  expect(formData).toMatchObject({
    x_axis_sort: 'SUM(sales)',
    x_axis_sort_asc: true,
  });
  expect(adapter.current(formData)).toEqual({
    by: 'SUM(sales)',
    ascending: true,
  });
});

test('a horizontal chart stores the opposite order, as it is drawn bottom up', () => {
  const formData = sorted(barFormData({ orientation: 'horizontal' }), {
    by: 'SUM(sales)',
    ascending: true,
  });
  expect(formData.x_axis_sort_asc).toBe(false);
  expect(adapter.current(formData)).toEqual({
    by: 'SUM(sales)',
    ascending: true,
  });
});

test('"Reverse X axis" flips the stored order again', () => {
  const vertical = barFormData({ x_axis_inverse: true });
  const horizontal = barFormData({
    orientation: 'horizontal',
    x_axis_inverse: true,
  });
  const sort = { by: 'SUM(sales)', ascending: true };
  expect(adapter.toFormData(sort, vertical).x_axis_sort_asc).toBe(false);
  expect(adapter.toFormData(sort, horizontal).x_axis_sort_asc).toBe(true);
});

test('a chart saved without a direction sorts ascending, as the editor does', () => {
  expect(adapter.current(barFormData({ x_axis_sort: 'country' }))).toEqual({
    by: 'country',
    ascending: true,
  });
});

/**
 * Category labels in the order a reader sees them: left to right, or top to
 * bottom on a horizontal chart, for a chart with dimensions, which is sorted
 * in the browser by the chart's own transformProps.
 */
const screenOrder = (formData: QueryFormData): string[] => {
  const queriesData = [
    {
      data: [
        { country: 'Brazil', East: 5, West: 5 },
        { country: 'Chile', East: 1, West: 1 },
        { country: 'Peru', East: 3, West: 0 },
      ],
      colnames: ['country', 'East', 'West'],
      coltypes: [
        GenericDataType.String,
        GenericDataType.Numeric,
        GenericDataType.Numeric,
      ],
      label_map: { East: ['East'], West: ['West'] },
      rowcount: 3,
    } as unknown as ChartDataResponseResult,
  ];
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    queriesData,
    theme: supersetTheme,
    datasource: { verboseMap: {}, columnFormats: {}, currencyFormats: {} },
  });
  // The chart reads its settings in camel case, over the chart's defaults
  const { echartOptions } = TimeseriesTransformProps({
    ...chartProps,
    formData: { ...TimeseriesDefaultFormData, ...chartProps.formData },
    queriesData,
  } as unknown as Parameters<typeof TimeseriesTransformProps>[0]);

  const horizontal = formData.orientation === 'horizontal';
  const axis = (horizontal ? echartOptions.yAxis : echartOptions.xAxis) as {
    inverse?: boolean;
  };
  const series = echartOptions.series as { data: [unknown, unknown][] }[];
  const categories = series[0].data.map(
    ([x, y]) => (horizontal ? y : x) as string,
  );
  // ECharts draws a vertical category axis from the bottom up
  const flipped = horizontal !== !!axis.inverse;
  return flipped ? [...categories].reverse() : categories;
};

test.each([
  ['vertical', {}],
  ['horizontal', { orientation: 'horizontal' }],
  [
    'horizontal and reversed',
    { orientation: 'horizontal', x_axis_inverse: true },
  ],
])('ascending puts the smallest total first on a %s chart', (_, extra) => {
  const formData = barFormData({ groupby: ['region'], ...extra });
  const sum = { by: 'sum', ascending: true };
  expect(screenOrder(sorted(formData, sum))).toEqual([
    'Chile',
    'Peru',
    'Brazil',
  ]);
  expect(screenOrder(sorted(formData, { ...sum, ascending: false }))).toEqual([
    'Brazil',
    'Peru',
    'Chile',
  ]);
});

test('pie and funnel charts sort by the metric or a dimension', () => {
  [VizType.Pie, VizType.Funnel].forEach(vizType => {
    const categories = sortAdapterFor(vizType)!;
    const formData = barFormData({
      viz_type: vizType,
      x_axis: undefined,
      metric: 'SUM(sales)',
      groupby: ['country'],
    });
    expect(categories.options(formData, dataset)).toEqual([
      { value: 'SUM(sales)', label: 'SUM(sales)' },
      { value: 'country', label: 'country' },
    ]);
    expect(
      categories.toFormData({ by: 'country', ascending: true }, formData),
    ).toEqual({ mibi_sort_by: 'country', mibi_sort_asc: true });
  });
});

test('a pie without a sort of its own shows "Sort by metric"', () => {
  const pie = sortAdapterFor(VizType.Pie)!;
  const formData = barFormData({ viz_type: VizType.Pie, metric: 'SUM(sales)' });
  expect(pie.current(formData)).toEqual({
    by: 'SUM(sales)',
    ascending: false,
  });
  expect(pie.current({ ...formData, sort_by_metric: false })).toBeUndefined();
  expect(
    pie.current({ ...formData, mibi_sort_by: 'country', mibi_sort_asc: true }),
  ).toEqual({ by: 'country', ascending: true });
});
