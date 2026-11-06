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
import buildBarQuery from '../../../plugins/plugin-chart-echarts/src/Timeseries/buildQuery';
import { chartFormData, figureAsText, figureSource } from './figure';
import type { Figure } from './types';

const figure = (changes: Partial<Figure> = {}): Figure => ({
  dataset_id: 7,
  dataset_name: 'ventas',
  metrics: ['total'],
  columns: ['region'],
  filters: [],
  order_by: [],
  order_desc: true,
  row_limit: 1000,
  rows: [
    { region: 'Norte', total: 10 },
    { region: 'Sur', total: 4 },
  ],
  row_count: 2,
  from_dttm: null,
  to_dttm: null,
  ...changes,
});

test('a dimension and a metric draw bars of the same query', () => {
  const formData = chartFormData(
    figure({
      filters: [
        { col: 'pais', op: '==', val: 'MX' },
        { col: 'fecha', op: 'TEMPORAL_RANGE', val: 'Last year' },
      ],
    }),
    3,
  );

  expect(formData?.viz_type).toBe(VizType.Bar);
  expect(formData?.datasource).toBe('7__table');
  const [query] = buildBarQuery(formData!).queries;
  expect(query.metrics).toEqual(['total']);
  expect(query.columns).toEqual([expect.objectContaining({ label: 'region' })]);
  expect(query.filters).toEqual(
    expect.arrayContaining([
      { col: 'pais', op: '==', val: 'MX' },
      { col: 'fecha', op: 'TEMPORAL_RANGE', val: 'Last year' },
    ]),
  );
});

test('dates draw a line', () => {
  const rows = [
    { mes: '2026-01-01T00:00:00', total: 1 },
    { mes: '2026-02-01T00:00:00', total: 2 },
  ];

  const formData = chartFormData(figure({ columns: ['mes'], rows }), 3);

  expect(formData?.viz_type).toBe(VizType.Line);
});

test('one number draws a big number', () => {
  const formData = chartFormData(
    figure({ columns: [], rows: [{ total: 10 }], row_count: 1 }),
    3,
  );

  expect(formData?.viz_type).toBe(VizType.BigNumberTotal);
  expect(formData?.metric).toBe('total');
});

test.each([
  ['no metrics', { metrics: [] }],
  ['two dimensions', { columns: ['region', 'pais'] }],
  ['too many metrics', { metrics: ['a', 'b', 'c'] }],
  ['one row of a dimension', { row_count: 1 }],
  ['too many rows', { row_count: 31 }],
  ['a query cut by its limit', { row_count: 5, row_limit: 5 }],
])('%s read better as a table', (_name, changes) => {
  expect(chartFormData(figure(changes), 3)).toBeNull();
});

test('the source says the dataset and each filter that ran', () => {
  expect(
    figureSource(
      figure({
        filters: [
          { col: 'pais', op: 'IN', val: ['MX', 'AR'] },
          { col: 'fecha', op: 'TEMPORAL_RANGE', val: 'Last year' },
          { col: 'baja', op: 'IS NULL' },
        ],
      }),
    ),
  ).toBe('Dataset: ventas · pais IN MX, AR · fecha: Last year · baja IS NULL');
});

test('the source says when no filter ran', () => {
  expect(figureSource(figure())).toBe('Dataset: ventas · no filters');
});

test('the rows of a figure paste as a table, with their numbers as they came', () => {
  expect(
    figureAsText(
      figure({ rows: [{ region: 'Norte', total: 1234.5 }], row_count: 1 }),
    ),
  ).toBe('region\ttotal\nNorte\t1234.5');
});

test('a cell cannot break a row, and an empty one stays empty', () => {
  expect(
    figureAsText(
      figure({ rows: [{ region: 'Nor\tte\nSur', total: null }], row_count: 1 }),
    ),
  ).toBe('region\ttotal\nNor te Sur\t');
});

test('a text that looks like a formula pastes as text, and a negative number stays', () => {
  expect(
    figureAsText(
      figure({
        rows: [{ region: '=HYPERLINK("https://x.test")', total: -4 }],
        row_count: 1,
      }),
    ),
  ).toBe(`region\ttotal\n'=HYPERLINK("https://x.test")\t-4`);
});

test('rows cut by the limit say so', () => {
  expect(figureAsText(figure({ row_count: 9 }))).toContain(
    'Showing 2 of 9 rows.',
  );
});

test('a figure without rows copies nothing', () => {
  expect(figureAsText(figure({ rows: [], row_count: 0 }))).toBe('');
});
