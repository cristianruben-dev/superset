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
import type { QueryFormData } from '@superset-ui/core';
import type { DashboardLayout } from 'src/dashboard/types';
import { isHiddenPage, topLevelTabs } from 'src/auradata/present/dashboardTabs';
import {
  chartDimensions,
  grainRange,
  isLessPrecise,
  markKey,
  QUERY_ABORTED,
  resolveTooltipPage,
  tooltipObjects,
  tooltipPageOf,
  tooltipPages,
  tooltipPosition,
  tooltipQueryKey,
  TooltipQueryCache,
  withMarkFilters,
} from './tooltipPages';

const item = (
  id: string,
  type: string,
  children: string[] = [],
  meta: Record<string, unknown> = {},
  parents: string[] = [],
) => ({ id, type, children, parents, meta });

const layout = () =>
  ({
    ROOT_ID: item('ROOT_ID', 'ROOT', ['TABS-1']),
    'TABS-1': item('TABS-1', 'TABS', ['TAB-main', 'TAB-tip', 'TAB-tip2'], {}, [
      'ROOT_ID',
    ]),
    'TAB-main': item('TAB-main', 'TAB', [], { text: 'Main' }),
    'TAB-tip': item('TAB-tip', 'TAB', [], {
      text: 'By region',
      auradataTooltipPage: { width: 10, height: 8, columns: ['region'] },
    }),
    'TAB-tip2': item('TAB-tip2', 'TAB', [], {
      text: 'By region and year',
      auradataTooltipPage: {
        width: 12,
        height: 6,
        columns: ['region', 'year'],
      },
    }),
    'CHART-in': item(
      'CHART-in',
      'CHART',
      [],
      {
        chartId: 7,
        width: 4,
        height: 3,
        auradataPos: { x: 1, y: 1 },
        auradataZ: 2,
      },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
    'MARKDOWN-in': item(
      'MARKDOWN-in',
      'MARKDOWN',
      [],
      { width: 4, height: 2, auradataPos: { x: 0, y: 0 } },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
    'CHART-out': item(
      'CHART-out',
      'CHART',
      [],
      { chartId: 8, width: 4, height: 3, auradataPos: { x: 12, y: 0 } },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
    'DYNAMIC-shape': item(
      'DYNAMIC-shape',
      'DYNAMIC',
      [],
      {
        componentKey: 'auradata-shape',
        width: 2,
        height: 1,
        auradataPos: { x: 6, y: 0 },
      },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
    'DYNAMIC-slicer': item(
      'DYNAMIC-slicer',
      'DYNAMIC',
      [],
      {
        componentKey: 'auradata-filter',
        width: 2,
        height: 1,
        auradataPos: { x: 8, y: 0 },
      },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
    'CHART-hidden': item(
      'CHART-hidden',
      'CHART',
      [],
      {
        chartId: 9,
        width: 2,
        height: 2,
        auradataPos: { x: 0, y: 4 },
        auradataHidden: true,
      },
      ['ROOT_ID', 'TABS-1', 'TAB-tip', 'ROW-1'],
    ),
  }) as unknown as DashboardLayout;

test('a tooltip page reads its size and fields, with defaults', () => {
  expect(tooltipPageOf({})).toBeUndefined();
  expect(tooltipPageOf({ auradataTooltipPage: {} })).toEqual({
    width: 10,
    height: 8,
    columns: [],
  });
  expect(
    tooltipPageOf({ auradataTooltipPage: { width: 500, height: 0.4 } }),
  ).toMatchObject({ width: 60, height: 2 });
});

test('tooltip pages are listed and hidden from viewers', () => {
  const current = layout();
  expect(tooltipPages(current).map(({ tab }) => tab.id)).toEqual([
    'TAB-tip',
    'TAB-tip2',
  ]);
  expect(isHiddenPage(current['TAB-tip'].meta)).toBe(true);
  expect(isHiddenPage(current['TAB-main'].meta)).toBe(false);
  expect(topLevelTabs(current).map(tab => tab.hidden)).toEqual([
    false,
    true,
    true,
  ]);
});

test('the dimensions of a chart come from its grouping keys', () => {
  expect(
    chartDimensions({
      x_axis: 'year',
      groupby: ['region', { label: 'adhoc' }],
      metrics: ['count'],
    }),
  ).toEqual(['year', 'region']);
  expect(chartDimensions(undefined)).toEqual([]);
});

test('a chart shows the page it names, or the best match on Auto', () => {
  const current = layout();
  expect(resolveTooltipPage(current, undefined, ['region'])).toBeUndefined();
  expect(
    resolveTooltipPage(current, { type: 'default' }, ['region']),
  ).toBeUndefined();
  expect(
    resolveTooltipPage(current, { type: 'page', page: 'TAB-tip2' }, []),
  ).toBe('TAB-tip2');
  // A page that is no longer a tooltip is not shown
  expect(
    resolveTooltipPage(current, { type: 'page', page: 'TAB-main' }, []),
  ).toBeUndefined();
  expect(resolveTooltipPage(current, { type: 'page' }, ['region'])).toBe(
    'TAB-tip',
  );
  expect(
    resolveTooltipPage(current, { type: 'page' }, ['year', 'region']),
  ).toBe('TAB-tip2');
  expect(
    resolveTooltipPage(current, { type: 'page' }, ['city']),
  ).toBeUndefined();
});

test('the tooltip shows its charts, texts and design elements, by layer', () => {
  const current = layout();
  const page = tooltipPageOf(current['TAB-tip'].meta)!;
  expect(tooltipObjects(current, 'TAB-tip', page)).toEqual([
    {
      id: 'MARKDOWN-in',
      type: 'MARKDOWN',
      chartId: undefined,
      x: 0,
      y: 0,
      width: 4,
      height: 2,
    },
    {
      id: 'DYNAMIC-shape',
      type: 'DYNAMIC',
      kind: 'shape',
      chartId: undefined,
      x: 6,
      y: 0,
      width: 2,
      height: 1,
    },
    {
      id: 'CHART-in',
      type: 'CHART',
      chartId: 7,
      x: 1,
      y: 1,
      width: 4,
      height: 3,
    },
  ]);
});

test('the values of a mark filter the columns the dataset has', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'pie',
    extra_form_data: { filters: [{ col: 'year', op: 'IN', val: [2024] }] },
  } as unknown as QueryFormData;
  const fields = [
    { column: 'region', value: 'North', label: 'North' },
    { column: 'city', value: 'Oslo', label: 'Oslo' },
  ];
  expect(
    withMarkFilters(formData, fields, new Set(['region', 'year']))
      .extra_form_data?.filters,
  ).toEqual([
    { col: 'year', op: 'IN', val: [2024] },
    { col: 'region', op: 'IN', val: ['North'] },
  ]);
  // Unknown columns: every value applies
  expect(
    withMarkFilters(formData, fields).extra_form_data?.filters,
  ).toHaveLength(3);
  // Nothing in common leaves the form data as it is
  expect(withMarkFilters(formData, fields, new Set(['year']))).toBe(formData);
});

test('a mark key does not depend on the order of its fields', () => {
  const a = { column: 'a', value: 1, label: '1' };
  const b = { column: 'b', value: 'x', label: 'x' };
  expect(markKey([a, b])).toBe(markKey([b, a]));
  expect(markKey([a])).not.toBe(markKey([b]));
  const formData = { viz_type: 'pie' } as QueryFormData;
  expect(tooltipQueryKey(1, formData)).toBe(
    tooltipQueryKey(1, { ...formData }),
  );
  expect(tooltipQueryKey(1, formData)).not.toBe(tooltipQueryKey(2, formData));
});

test('the cache shares a query by key and keeps its answer', async () => {
  const cache = new TooltipQueryCache<number>();
  const load = jest.fn(() => Promise.resolve(42));
  const first = cache.get('k', load);
  const second = cache.get('k', load);
  expect(first).toBe(second);
  await expect(first).resolves.toBe(42);
  expect(cache.has('k')).toBe(true);
  await cache.get('k', load);
  expect(load).toHaveBeenCalledTimes(1);
});

test('aborting forgets the queries still running, never the answered ones', async () => {
  const cache = new TooltipQueryCache<string>();
  let signal: AbortSignal | undefined;
  const pending = cache.get(
    'slow',
    s =>
      new Promise((resolve, reject) => {
        signal = s;
        s.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  );
  await cache.get('done', () => Promise.resolve('ok'));
  cache.abortPending();
  expect(signal?.aborted).toBe(true);
  await expect(pending).rejects.toBe(QUERY_ABORTED);
  expect(cache.has('done')).toBe(true);
  // The aborted key is asked again
  const again = jest.fn(() => Promise.resolve('fresh'));
  await expect(cache.get('slow', again)).resolves.toBe('fresh');
  expect(again).toHaveBeenCalledTimes(1);
});

test('a failed query is asked again next time', async () => {
  const cache = new TooltipQueryCache<string>();
  await expect(
    cache.get('k', () => Promise.reject(new Error('boom'))),
  ).rejects.toThrow('boom');
  await expect(cache.get('k', () => Promise.resolve('ok'))).resolves.toBe('ok');
});

test('the cache keeps the most recently used queries', async () => {
  const cache = new TooltipQueryCache<number>(2);
  await cache.get('a', () => Promise.resolve(1));
  await cache.get('b', () => Promise.resolve(2));
  await cache.get('a', () => Promise.resolve(1));
  await cache.get('c', () => Promise.resolve(3));
  expect(cache.has('a')).toBe(true);
  expect(cache.has('b')).toBe(false);
  expect(cache.has('c')).toBe(true);
});

test('the tooltip goes beside the pointer and stays on screen', () => {
  const size = { width: 320, height: 256 };
  const screen = { width: 1000, height: 800 };
  expect(tooltipPosition({ x: 100, y: 100 }, size, screen)).toEqual({
    left: 116,
    top: 116,
  });
  expect(tooltipPosition({ x: 900, y: 700 }, size, screen)).toEqual({
    left: 564,
    top: 428,
  });
});

test('a date of a grain filters its whole period', () => {
  const may = Date.UTC(2025, 4, 1);
  expect(grainRange(may, 'P1M')).toBe(
    '2025-05-01T00:00:00 : 2025-06-01T00:00:00',
  );
  expect(grainRange(may, 'P1W/1970-01-03T00:00:00Z')).toBe(
    '2025-05-01T00:00:00 : 2025-05-08T00:00:00',
  );
  expect(grainRange(Date.UTC(2024, 10, 1), 'P3M')).toBe(
    '2024-11-01T00:00:00 : 2025-02-01T00:00:00',
  );
  expect(grainRange(may, 'P2X')).toBeUndefined();
  expect(grainRange('not a date', 'P1D')).toBeUndefined();
  const formData = { viz_type: 'pie' } as QueryFormData;
  expect(
    withMarkFilters(formData, [
      { column: 'fecha', value: may, label: 'May 2025', grain: 'P1M' },
    ]).extra_form_data?.filters,
  ).toEqual([
    {
      col: 'fecha',
      op: 'TEMPORAL_RANGE',
      val: '2025-05-01T00:00:00 : 2025-06-01T00:00:00',
    },
  ]);
});

test('the line of a series does not replace the point under the pointer', () => {
  const point = {
    chartId: 1,
    fields: [
      { column: 'fecha', value: 1, label: '1' },
      { column: 'region', value: 'Sur', label: 'Sur' },
    ],
  };
  const line = { chartId: 1, fields: [point.fields[1]] };
  expect(isLessPrecise(line, point)).toBe(true);
  expect(isLessPrecise(line, undefined)).toBe(false);
  expect(isLessPrecise({ ...line, chartId: 2 }, point)).toBe(false);
  expect(
    isLessPrecise(
      { chartId: 1, fields: [{ column: 'region', value: 'Norte', label: '' }] },
      point,
    ),
  ).toBe(false);
});
