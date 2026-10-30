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
import { appliedFilters, type Capture } from './capture';
import { exportFileName, paginate } from './document';

const capture = (height: number, breaks: number[]): Capture => ({
  canvas: { height, width: 100 } as HTMLCanvasElement,
  scale: 1,
  breaks: [...breaks, height],
});

test('fits short dashboards on one page', () => {
  expect(paginate(capture(500, [200]), 800, 1000)).toEqual([[0, 500]]);
});

test('breaks pages between visuals', () => {
  expect(paginate(capture(1500, [400, 700, 1100]), 800, 800)).toEqual([
    [0, 700],
    [700, 1500],
  ]);
});

test('cuts a visual taller than a page where the page ends', () => {
  expect(paginate(capture(2000, [1900]), 800, 800)).toEqual([
    [0, 800],
    [800, 1600],
    [1600, 2000],
  ]);
});

test('names the file after the dashboard and the day', () => {
  expect(
    exportFileName(
      'Ventas por región',
      new Date('2026-10-30T10:00:00Z'),
      'pdf',
    ),
  ).toBe('ventas-por-region-2026-10-30.pdf');
});

test('lists the filters that hold a value', () => {
  const state = {
    nativeFilters: {
      filters: {
        f1: { id: 'f1', name: 'Region' },
        f2: { id: 'f2', name: 'Channel' },
      },
    },
    dataMask: {
      f1: { filterState: { value: ['North', 'South'] } },
      f2: { filterState: {} },
    },
  } as unknown as RootState;
  expect(appliedFilters(state)).toEqual([
    { label: 'Region', value: 'North, South' },
  ]);
});
