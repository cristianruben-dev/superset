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
import type { RootState } from 'src/dashboard/types';
import { DRILLTHROUGH_ID, DRILLTHROUGH_STATE_KEY } from './drillthroughScope';
import { filtersChanged, savedDataMasks } from './resetFilters';

const filter = (id: string, value?: unknown) => ({
  id,
  type: 'NATIVE_FILTER',
  defaultDataMask: value
    ? {
        extraFormData: { filters: [{ col: 'region', op: 'IN', val: value }] },
        filterState: { value },
      }
    : {},
});

const state = (dataMask: Record<string, unknown>) =>
  ({
    dashboardInfo: { id: 5 },
    nativeFilters: {
      filters: {
        'NATIVE_FILTER-a': filter('NATIVE_FILTER-a', ['North']),
        'NATIVE_FILTER-b': filter('NATIVE_FILTER-b'),
        'NATIVE_FILTER_DIVIDER-c': { id: 'NATIVE_FILTER_DIVIDER-c' },
      },
    },
    dataMask,
  }) as unknown as RootState;

const saved = {
  'NATIVE_FILTER-a': {
    id: 'NATIVE_FILTER-a',
    extraFormData: { filters: [{ col: 'region', op: 'IN', val: ['North'] }] },
    filterState: { value: ['North'] },
  },
  'NATIVE_FILTER-b': {
    id: 'NATIVE_FILTER-b',
    extraFormData: {},
    filterState: {},
  },
};

test('filters go back to their defaults and cross-filters are cleared', () => {
  const masks = savedDataMasks(
    state({
      ...saved,
      'NATIVE_FILTER-b': {
        id: 'NATIVE_FILTER-b',
        extraFormData: { filters: [{ col: 'year', op: 'IN', val: [2024] }] },
        filterState: { value: [2024] },
      },
      '12': {
        id: 12,
        extraFormData: { filters: [{ col: 'city', op: 'IN', val: ['Oslo'] }] },
        filterState: { value: ['Oslo'] },
      },
      '13': { id: 13, extraFormData: { filters: [] }, filterState: {} },
    }),
  );
  expect(Object.keys(masks).sort()).toEqual([
    '12',
    'NATIVE_FILTER-a',
    'NATIVE_FILTER-b',
  ]);
  expect(masks['NATIVE_FILTER-a'].filterState).toEqual({ value: ['North'] });
  expect(masks['NATIVE_FILTER-b']).toEqual({
    extraFormData: {},
    filterState: {},
    ownState: {},
  });
  expect(masks['12'].extraFormData).toEqual({ filters: [] });
});

test('the report tells when its filters differ from the saved ones', () => {
  expect(filtersChanged(state(saved))).toBe(false);
  expect(
    filtersChanged(
      state({
        ...saved,
        'NATIVE_FILTER-a': {
          id: 'NATIVE_FILTER-a',
          extraFormData: {},
          filterState: { value: null },
        },
      }),
    ),
  ).toBe(true);
  expect(
    filtersChanged(
      state({
        ...saved,
        '12': {
          id: 12,
          extraFormData: { filters: [{ col: 'c', op: 'IN', val: [1] }] },
          filterState: {},
        },
      }),
    ),
  ).toBe(true);
  expect(
    filtersChanged(
      state({
        ...saved,
        [DRILLTHROUGH_ID]: {
          id: DRILLTHROUGH_ID,
          filterState: { [DRILLTHROUGH_STATE_KEY]: { dashboardId: 5 } },
        },
      }),
    ),
  ).toBe(true);
});
