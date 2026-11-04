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
import { filterSummary } from './filterSummary';

test('a filter without a selection reads as all values', () => {
  expect(filterSummary(undefined)).toBe('is (All)');
  expect(filterSummary({ value: [] })).toBe('is (All)');
  expect(filterSummary({ value: [null, null] })).toBe('is (All)');
});

test('a filter names what it selects', () => {
  expect(filterSummary({ value: ['North', 'South'] })).toBe('is North, South');
  expect(filterSummary({ value: ['x'], label: 'North (2)' })).toBe(
    'is North (2)',
  );
  expect(filterSummary({ value: 'Last week' })).toBe('is Last week');
});

test('a range reads as its bounds', () => {
  expect(filterSummary({ value: [10, 20] })).toBe('is between 10 and 20');
  expect(filterSummary({ value: [null, 20] })).toBe('is at most 20');
  expect(filterSummary({ value: [10, null] })).toBe('is at least 10');
});
