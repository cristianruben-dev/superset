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
import { VizType } from '@superset-ui/core';
import {
  blockFormData,
  blockSource,
  figureValue,
  grouped,
  metricsOf,
  oldestText,
} from './artifact';
import type {
  ArtifactBlock,
  ChartBlock,
  FigureBlock,
  TableBlock,
} from './types';

const QUERY = {
  dataset_id: 7,
  metrics: ['total'],
  columns: ['region'],
  filters: [{ col: 'pais', op: '==', val: 'MX' }],
};

const chart = (kind: ChartBlock['chart'], fields = {}): ChartBlock => ({
  id: 'c',
  type: 'chart',
  title: 'Ventas',
  chart: kind,
  query: { ...QUERY, ...fields },
});

const table = (fields = {}): TableBlock => ({
  id: 't',
  type: 'table',
  title: 'Filas',
  query: { ...QUERY, ...fields },
});

const figure: FigureBlock = {
  id: 'f',
  type: 'figure',
  label: 'Total',
  query: { dataset_id: 7, aggregates: [{ column: 'x', aggregate: 'SUM' }] },
};

test('an aggregate reads as the server names it', () => {
  expect(metricsOf(figure.query)).toEqual([
    {
      expressionType: 'SIMPLE',
      column: { column_name: 'x' },
      aggregate: 'SUM',
      label: 'SUM(x)',
    },
  ]);
});

test.each([
  ['bar', VizType.Bar],
  ['line', VizType.Line],
  ['area', VizType.Area],
] as const)('a %s chart keeps the query of its block', (kind, viz) => {
  const form = blockFormData(chart(kind), 3);

  expect(form).toMatchObject({
    viz_type: viz,
    datasource: '7__table',
    x_axis: 'region',
    metrics: ['total'],
    dashboardId: 3,
  });
  expect(form.adhoc_filters).toEqual([
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'pais',
      operator: '==',
      comparator: 'MX',
    },
  ]);
});

test('a second column splits a chart into series', () => {
  expect(
    blockFormData(chart('line', { columns: ['mes', 'region'] }), 3),
  ).toMatchObject({ x_axis: 'mes', groupby: ['region'], show_legend: true });
});

test('a pie takes its column and metric', () => {
  expect(blockFormData(chart('pie'), 3)).toMatchObject({
    viz_type: VizType.Pie,
    groupby: ['region'],
    metric: 'total',
  });
});

test('the order and limit of a query survive in a chart', () => {
  const form = blockFormData(
    chart('bar', { order_by: ['total'], order_desc: true, row_limit: 5 }),
    3,
  );

  expect(form).toMatchObject({
    row_limit: 5,
    series_limit_metric: 'total',
    x_axis_sort: 'total',
    x_axis_sort_asc: false,
  });
});

test('the order of a table goes by the metric it names', () => {
  const form = blockFormData(
    table({
      metrics: [],
      aggregates: [{ column: 'x', aggregate: 'SUM' }],
      order_by: ['SUM(x)'],
    }),
    3,
  );

  expect(form).toMatchObject({
    viz_type: VizType.Table,
    query_mode: 'aggregate',
    timeseries_limit_metric: { label: 'SUM(x)' },
  });
});

test('a table without metrics reads raw rows', () => {
  const form = blockFormData(table({ metrics: [], order_by: ['region'] }), 3);

  expect(form).toMatchObject({
    query_mode: 'raw',
    all_columns: ['region'],
    order_by_cols: ['["region",false]'],
  });
});

test('a time range becomes a filter on the column the server resolved', () => {
  const form = blockFormData(
    table({ time_range: 'Last year', time_column: 'fecha' }),
    3,
  );

  expect(form.adhoc_filters).toContainEqual(
    expect.objectContaining({
      subject: 'fecha',
      operator: 'TEMPORAL_RANGE',
      comparator: 'Last year',
    }),
  );
});

test('a figure reads as its block asks', () => {
  expect(figureValue([{ total: 1234.5 }], 'currency')).toMatch(/1.234.50/);
  expect(figureValue([{ total: 0.125 }], 'percent')).toBe('12.5%');
  expect(figureValue([{ total: null }])).toBe('–');
  expect(figureValue([{ total: 'n/d' }])).toBe('n/d');
});

test('a source says the dataset and its filters', () => {
  expect(blockSource(table(), 'ventas')).toContain('ventas');
  expect(blockSource(table(), 'ventas')).toContain('pais == MX');
});

test('the date of a document is that of its oldest text', () => {
  const blocks: ArtifactBlock[] = [
    { id: 'a', type: 'text', text: 'x', written_on: '2026-11-06T10:00:00' },
    figure,
    { id: 'b', type: 'text', text: 'y', written_on: '2026-11-01T10:00:00' },
  ];

  expect(oldestText(blocks)).toBe('2026-11-01T10:00:00');
  expect(oldestText([figure])).toBeNull();
});

test('figures that follow each other make a row, and nothing else does', () => {
  const groups = grouped([figure, { ...figure, id: 'g' }, table(), figure]);

  expect(groups.map(group => group.length)).toEqual([2, 1, 1]);
});
