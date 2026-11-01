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
import type { DashboardLayout } from 'src/dashboard/types';
import {
  layoutToPositions,
  maxWidthCells,
  placeAt,
  posOf,
  posStyle,
} from './positions';

const item = (
  id: string,
  type: string,
  children: string[] = [],
  meta: Record<string, unknown> = {},
) => ({ id, type, children, parents: [], meta });

const flow = () =>
  ({
    ROOT_ID: item('ROOT_ID', 'ROOT', ['GRID_ID'], { mibiCells: true }),
    GRID_ID: item('GRID_ID', 'GRID', ['ROW-1', 'ROW-2']),
    'ROW-1': item('ROW-1', 'ROW', ['CHART-a', 'CHART-b']),
    'CHART-a': item('CHART-a', 'CHART', [], { width: 10, height: 8 }),
    'CHART-b': item('CHART-b', 'CHART', [], { width: 12, height: 6 }),
    'ROW-2': item('ROW-2', 'ROW', ['CHART-c']),
    'CHART-c': item('CHART-c', 'CHART', [], { width: 20, height: 5 }),
  }) as unknown as DashboardLayout;

test('an object without a cell has no position style', () => {
  expect(posOf({})).toBeUndefined();
  expect(posStyle({})).toBeUndefined();
  expect(posStyle({ mibiPos: { x: 2, y: 1 } })).toEqual({
    position: 'absolute',
    left: 64,
    top: 32,
  });
});

test('objects get the cell they have in the flow of their rows', () => {
  const next = layoutToPositions(flow());
  expect(posOf(next['CHART-a'].meta)).toEqual({ x: 0, y: 0 });
  expect(posOf(next['CHART-b'].meta)).toEqual({ x: 10, y: 0 });
  // The second row starts under the tallest object of the first
  expect(posOf(next['CHART-c'].meta)).toEqual({ x: 0, y: 8 });
});

test('positions are only given once', () => {
  const once = layoutToPositions(flow());
  expect(layoutToPositions(once)).toBe(once);
});

test('the page grows to hold what is below its bottom', () => {
  const layout = flow();
  layout['CHART-c'] = {
    ...layout['CHART-c'],
    meta: { width: 20, height: 40 },
  } as never;
  const next = layoutToPositions(layout);
  expect(next.ROOT_ID.meta.mibiCanvas).toEqual({
    size: { mode: 'custom', width: 1536, height: 48 * 32 },
  });
});

test('an object is placed on a cell and kept inside the page', () => {
  const layout = layoutToPositions(flow());
  const moved = placeAt(layout, 'CHART-a', { x: 5, y: 3 });
  expect(posOf(moved['CHART-a'].meta)).toEqual({ x: 5, y: 3 });
  // 48 columns: a 10 wide object cannot start after cell 38
  const edge = placeAt(layout, 'CHART-a', { x: 60, y: 0 });
  expect(posOf(edge['CHART-a'].meta)).toEqual({ x: 38, y: 0 });
  expect(placeAt(layout, 'CHART-a', { x: 0, y: 0 })).toBe(layout);
});

test('an object may grow to the right edge of the page', () => {
  const layout = placeAt(layoutToPositions(flow()), 'CHART-a', { x: 30, y: 0 });
  expect(maxWidthCells(layout['CHART-a'].meta)).toBeGreaterThanOrEqual(10);
  expect(maxWidthCells({})).toBeUndefined();
});
