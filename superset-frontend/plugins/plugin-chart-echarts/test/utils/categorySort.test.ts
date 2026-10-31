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
import type { AdhocMetric, QueryFormData } from '@superset-ui/core';
import {
  categoryOrderby,
  categorySortChoices,
  funnelSort,
} from '../../src/utils/categorySort';
import PieBuildQuery from '../../src/Pie/buildQuery';
import FunnelBuildQuery from '../../src/Funnel/buildQuery';

const sqlMetric: AdhocMetric = {
  expressionType: 'SQL',
  sqlExpression: 'SUM(sales)',
  label: 'Sales',
};

const formData = (extra: Partial<QueryFormData> = {}): QueryFormData => ({
  datasource: '1__table',
  viz_type: 'pie',
  metric: 'count',
  groupby: ['country', 'region'],
  ...extra,
});

test('the metric and the dimensions can be sorted by', () => {
  expect(categorySortChoices(sqlMetric, ['country', 'region'])).toEqual([
    'Sales',
    'country',
    'region',
  ]);
  expect(categorySortChoices(undefined, undefined)).toEqual([]);
});

test('without a sort of its own, "Sort by metric" sorts descending', () => {
  expect(categoryOrderby(formData({ sort_by_metric: true }))).toEqual([
    ['count', false],
  ]);
  expect(categoryOrderby(formData({ sort_by_metric: false }))).toBeUndefined();
});

test('a sort by the metric follows its direction', () => {
  expect(
    categoryOrderby(
      formData({
        metric: sqlMetric,
        mibi_sort_by: 'Sales',
        mibi_sort_asc: true,
      }),
    ),
  ).toEqual([[sqlMetric, true]]);
});

test('a sort by a dimension orders by that column', () => {
  expect(
    categoryOrderby(formData({ mibi_sort_by: 'region', sort_by_metric: true })),
  ).toEqual([['region', false]]);
});

test('a sort by a field the chart no longer has falls back', () => {
  expect(
    categoryOrderby(formData({ mibi_sort_by: 'city', sort_by_metric: true })),
  ).toEqual([['count', false]]);
});

test('pie and funnel queries use the sort', () => {
  const sorted = formData({ mibi_sort_by: 'count', mibi_sort_asc: true });
  expect(PieBuildQuery(sorted).queries[0].orderby).toEqual([['count', true]]);
  expect(
    FunnelBuildQuery({ ...sorted, viz_type: 'funnel' }).queries[0].orderby,
  ).toEqual([['count', true]]);
});

test('a funnel sorted by the metric is drawn by value', () => {
  expect(
    funnelSort(
      { metric: 'count', mibiSortBy: 'count', mibiSortAsc: true },
      'descending',
    ),
  ).toBe('ascending');
  expect(
    funnelSort(
      { metric: 'count', mibiSortBy: 'count', mibiSortAsc: false },
      'none',
    ),
  ).toBe('descending');
});

test('a funnel sorted by a dimension keeps the query order', () => {
  expect(
    funnelSort({ metric: 'count', mibiSortBy: 'country' }, 'descending'),
  ).toBe('none');
});

test('a funnel without a sort of its own keeps its default', () => {
  expect(funnelSort({ metric: 'count' }, 'descending')).toBe('descending');
});
