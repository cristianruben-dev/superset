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
  betweenTimeRange,
  inputFilters,
  inputValues,
  nextSelection,
  parseBetweenTimeRange,
  parseRelativeTimeRange,
  relativeTimeRange,
  selectionMode,
  selectionSummary,
  slicerText,
  sortSlicerValues,
} from './slicer';

test('a click adds, keeps one or waits for Ctrl, by selection mode', () => {
  expect(nextSelection(['a'], 'b', 'multi')).toEqual(['a', 'b']);
  expect(nextSelection(['a', 'b'], 'a', 'multi')).toEqual(['b']);
  expect(nextSelection(['a'], 'b', 'single')).toEqual(['b']);
  expect(nextSelection(['a'], 'a', 'single')).toEqual([]);
  expect(nextSelection(['a'], 'b', 'ctrl')).toEqual(['b']);
  expect(nextSelection(['a'], 'b', 'ctrl', true)).toEqual(['a', 'b']);
});

test('the slicer chooses its mode unless its filter takes one value', () => {
  expect(selectionMode({}, true)).toBe('multi');
  expect(selectionMode({}, false)).toBe('single');
  expect(selectionMode({ selection: 'ctrl' }, true)).toBe('ctrl');
  expect(selectionMode({ selection: 'multi' }, false)).toBe('single');
});

test('values sort with blanks last', () => {
  expect(sortSlicerValues(['b', null, 'a10', 'a9'], 'asc')).toEqual([
    'a9',
    'a10',
    'b',
    null,
  ]);
  expect(sortSlicerValues([1, null, 3, 2], 'desc')).toEqual([3, 2, 1, null]);
  const values = ['b', 'a'];
  expect(sortSlicerValues(values, undefined)).toBe(values);
});

test('numbers take display units and blanks their own text', () => {
  expect(slicerText(1500, { valueUnits: 'thousands', valueDecimals: 1 })).toBe(
    '1.5K',
  );
  expect(slicerText(2_500_000, { valueUnits: 'auto' })).toBe('2.5M');
  expect(slicerText(1500, {})).toBe('1500');
  expect(slicerText(null, { blankText: 'Sin dato' })).toBe('Sin dato');
  expect(slicerText('', {})).toBe('(Blank)');
});

test('the summary counts the chosen values', () => {
  expect(selectionSummary([], {})).toBe('All values');
  expect(selectionSummary(['North'], {})).toBe('North');
  expect(selectionSummary(['North', 'South'], {})).toBe('2 selected');
});

test('a text slicer asks for part of a value or whole values', () => {
  expect(inputValues(' nor ', 'contains')).toEqual(['nor']);
  expect(inputValues('North, South,North,', 'exact')).toEqual([
    'North',
    'South',
  ]);
  expect(inputFilters('region', ['nor'], 'contains')).toEqual({
    filters: [{ col: 'region', op: 'ILIKE', val: '%nor%' }],
  });
  expect(inputFilters('region', ['North', 'South'], 'exact')).toEqual({
    filters: [{ col: 'region', op: 'IN', val: ['North', 'South'] }],
  });
  expect(inputFilters('region', [], 'exact')).toEqual({});
});

test('relative dates become time ranges and back', () => {
  const last = { scope: 'last', count: 3, unit: 'month' } as const;
  expect(relativeTimeRange(last)).toBe('Last 3 months');
  expect(parseRelativeTimeRange('Last 3 months')).toEqual(last);
  expect(relativeTimeRange({ scope: 'next', count: 1, unit: 'week' })).toBe(
    'Next 1 week',
  );
  expect(relativeTimeRange({ scope: 'this', count: 5, unit: 'year' })).toBe(
    'Current year',
  );
  expect(parseRelativeTimeRange('Current year')).toEqual({
    scope: 'this',
    count: 1,
    unit: 'year',
  });
  expect(parseRelativeTimeRange('2024-01-01 : 2024-02-01')).toBeUndefined();
});

test('dates between two days include the last one', () => {
  expect(betweenTimeRange('2024-01-01', '2024-01-31')).toBe(
    '2024-01-01 : 2024-02-01',
  );
  expect(betweenTimeRange(undefined, '2024-12-31')).toBe('Min : 2025-01-01');
  expect(betweenTimeRange('2024-03-01')).toBe('2024-03-01 : Max');
  expect(parseBetweenTimeRange('2024-01-01 : 2024-02-01')).toEqual([
    '2024-01-01',
    '2024-01-31',
  ]);
  expect(parseBetweenTimeRange('Min : Max')).toEqual([undefined, undefined]);
  expect(parseBetweenTimeRange('Last 3 months')).toBeUndefined();
});
