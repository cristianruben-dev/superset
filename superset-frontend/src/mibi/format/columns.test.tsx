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
import { render, screen } from 'spec/helpers/testing-library';
import type { DashboardLayout } from 'src/dashboard/types';
import { layoutToCells } from './cells';
import {
  CELL,
  CELLS_KEY,
  columnCountOf,
  gridColumnCount,
  syncGridColumnCount,
} from './columns';
import { GridSection } from './GridSection';

const item = (
  id: string,
  type: string,
  children: string[] = [],
  meta: Record<string, unknown> = {},
) => ({ id, type, children, parents: [], meta });

const legacy = (rootMeta: Record<string, unknown> = {}) =>
  ({
    ROOT_ID: item('ROOT_ID', 'ROOT', ['GRID_ID'], rootMeta),
    GRID_ID: item('GRID_ID', 'GRID', ['ROW-1', 'ROW-2']),
    'ROW-1': item('ROW-1', 'ROW', ['CHART-a', 'CHART-b', 'CHART-c']),
    'CHART-a': item('CHART-a', 'CHART', [], { width: 4, height: 50 }),
    'CHART-b': item('CHART-b', 'CHART', [], { width: 4, height: 50 }),
    'CHART-c': item('CHART-c', 'CHART', [], { width: 4, height: 50 }),
    'ROW-2': item('ROW-2', 'ROW', ['CHART-d']),
    'CHART-d': item('CHART-d', 'CHART', [], { width: 12, height: 25 }),
  }) as unknown as DashboardLayout;

test('the columns of a layout are the width of its canvas in cells', () => {
  expect(columnCountOf({})).toBe(48);
  expect(
    columnCountOf({
      ROOT_ID: {
        meta: { mibiCanvas: { size: { mode: 'custom', width: 10 * CELL } } },
      },
    }),
  ).toBe(10);
  expect(
    columnCountOf({
      ROOT_ID: { meta: { mibiCanvas: { size: { mode: '4:3' } } } },
    }),
  ).toBe(40);
});

test('the columns follow the layout being edited', () => {
  syncGridColumnCount({
    ROOT_ID: {
      meta: { mibiCanvas: { size: { mode: 'custom', width: 20 * CELL } } },
    },
  });
  expect(gridColumnCount()).toBe(20);
});

test('a legacy layout is converted to cells, keeping what it showed', () => {
  const next = layoutToCells(legacy());
  expect(next.ROOT_ID.meta[CELLS_KEY]).toBe(true);
  // 1280 px wide page: a third of it is about 13 cells
  expect(next['CHART-a'].meta.width).toBe(13);
  // 50 steps of 8 px are 400 px: 12.5 cells
  expect(next['CHART-a'].meta.height).toBe(13);
  expect(next['CHART-d'].meta.width).toBe(40);
  expect(next['CHART-d'].meta.height).toBe(6);
  expect(next.ROOT_ID.meta.mibiCanvas).toEqual({
    size: { mode: 'custom', width: 1280, height: 736 },
  });
  const row = ['CHART-a', 'CHART-b', 'CHART-c'].reduce(
    (sum, id) => sum + (next[id].meta.width as number),
    0,
  );
  expect(row).toBeLessThanOrEqual(40);
});

test('a legacy layout in 24 columns keeps its shares', () => {
  const dense = legacy({ mibiColumns: 24 });
  const next = layoutToCells(dense);
  expect(next.ROOT_ID.meta.mibiColumns).toBeUndefined();
  // 4 of 24 columns: a sixth of the page
  expect(next['CHART-a'].meta.width).toBe(7);
});

test('margins and gaps of the canvas are dropped', () => {
  const next = layoutToCells(
    legacy({
      mibiCanvas: { padding: 16, gap: 8, background: { type: 'none' } },
    }),
  );
  expect(next.ROOT_ID.meta.mibiCanvas).toEqual({
    background: { type: 'none' },
    size: { mode: 'custom', width: 1280, height: 736 },
  });
});

test('a converted layout is never converted twice', () => {
  const once = layoutToCells(legacy());
  expect(layoutToCells(once)).toBe(once);
});

test('a layout without sized objects only gets the marker', () => {
  const empty = {
    ROOT_ID: item('ROOT_ID', 'ROOT', ['GRID_ID']),
    GRID_ID: item('GRID_ID', 'GRID'),
  } as unknown as DashboardLayout;
  const next = layoutToCells(empty);
  expect(next.ROOT_ID.meta[CELLS_KEY]).toBe(true);
  expect(next.ROOT_ID.meta.mibiCanvas).toBeUndefined();
});

test('the grid section only styles the grid', () => {
  render(<GridSection />, { useRedux: true });
  expect(screen.getByTestId('mibi-format-grid-color')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-format-grid-opacity')).toBeInTheDocument();
  expect(screen.queryByTestId('mibi-format-columns')).not.toBeInTheDocument();
  expect(screen.queryByTestId('mibi-format-show-grid')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('mibi-format-grid-square'),
  ).not.toBeInTheDocument();
});
