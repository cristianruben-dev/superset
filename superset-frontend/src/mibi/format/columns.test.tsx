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
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import {
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { rescaleLayout, setColumnCount } from './actions';
import {
  columnCountOf,
  gridColumnCount,
  minObjectColumns,
  scaledWidth,
  syncGridColumnCount,
} from './columns';
import { GridSection } from './GridSection';

const item = (
  id: string,
  type: string,
  children: string[] = [],
  meta: Record<string, unknown> = {},
) => ({ id, type, children, parents: [], meta });

const layout = {
  ROOT_ID: item('ROOT_ID', 'ROOT', ['GRID_ID']),
  GRID_ID: item('GRID_ID', 'GRID', ['ROW-1', 'ROW-2']),
  'ROW-1': item('ROW-1', 'ROW', ['CHART-a', 'CHART-b', 'COLUMN-c']),
  'CHART-a': item('CHART-a', 'CHART', [], { chartId: 1, width: 5 }),
  'CHART-b': item('CHART-b', 'CHART', [], { chartId: 2, width: 4 }),
  'COLUMN-c': item('COLUMN-c', 'COLUMN', ['CHART-d'], { width: 3 }),
  'CHART-d': item('CHART-d', 'CHART', [], { chartId: 3, width: 3 }),
  'ROW-2': item('ROW-2', 'ROW', ['CHART-e']),
  'CHART-e': item('CHART-e', 'CHART', [], { chartId: 4, width: 12 }),
} as unknown as DashboardLayout;

const widths = (next: DashboardLayout): Record<string, number> =>
  Object.fromEntries(
    Object.values(next)
      .filter(entry => typeof entry.meta?.width === 'number')
      .map(entry => [entry.id, entry.meta.width as number]),
  );

const makeStore = () =>
  createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { editMode: true, hasUnsavedChanges: false },
      dashboardInfo: { id: 7 },
    },
    reducerIndex,
  );

const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as RootState;

const dispatcher = (store: ReturnType<typeof makeStore>) =>
  store.dispatch as unknown as (action: unknown) => void;

afterEach(() => syncGridColumnCount(null));

test('reads the column count of a layout', () => {
  expect(columnCountOf(layout)).toBe(12);
  expect(
    columnCountOf({ ROOT_ID: { meta: { mibiColumns: 48 } } } as never),
  ).toBe(48);
  expect(
    columnCountOf({ ROOT_ID: { meta: { mibiColumns: 5 } } } as never),
  ).toBe(12);
  expect(columnCountOf(null)).toBe(12);
  expect(scaledWidth(4, 48)).toBe(16);
  expect(scaledWidth(1, 12)).toBe(1);
  // About 48 px on a 1280 px canvas, whatever the density
  expect([12, 24, 48].map(minObjectColumns)).toEqual([1, 2, 3]);
});

test('keeps the share of every width when the grid gets denser', () => {
  const changed = rescaleLayout(layout, 48);
  expect(widths({ ...layout, ...changed })).toEqual({
    'CHART-a': 20,
    'CHART-b': 16,
    'COLUMN-c': 12,
    'CHART-d': 12,
    'CHART-e': 48,
  });
  expect(changed.ROOT_ID.meta.mibiColumns).toBe(48);
});

test('fits rows and columns when the grid gets coarser', () => {
  const dense = {
    ...layout,
    ROOT_ID: item('ROOT_ID', 'ROOT', ['GRID_ID'], { mibiColumns: 48 }),
    'CHART-a': item('CHART-a', 'CHART', [], { chartId: 1, width: 18 }),
    'CHART-b': item('CHART-b', 'CHART', [], { chartId: 2, width: 18 }),
    'COLUMN-c': item('COLUMN-c', 'COLUMN', ['CHART-d'], { width: 6 }),
    'CHART-d': item('CHART-d', 'CHART', [], { chartId: 3, width: 10 }),
    'CHART-e': item('CHART-e', 'CHART', [], { chartId: 4, width: 1 }),
  } as unknown as DashboardLayout;
  const next = { ...dense, ...rescaleLayout(dense, 12) };
  const {
    'CHART-a': a = 0,
    'CHART-b': b = 0,
    'COLUMN-c': c = 0,
    'CHART-d': d = 0,
    'CHART-e': e = 0,
  } = widths(next);
  // 18/48 rounds to 5 of 12 twice, plus 2: one column goes back
  expect(a + b + c).toBe(12);
  // An object never gets wider than its column, nor narrower than one
  expect(d).toBeLessThanOrEqual(c);
  expect(e).toBe(1);
  expect(next.ROOT_ID.meta).not.toHaveProperty('mibiColumns');
});

test('changes the density in one undo step and follows undo', () => {
  const store = makeStore();
  dispatcher(store)(setColumnCount(24));
  expect(stateOf(store).dashboardLayout.present['CHART-a'].meta.width).toBe(10);
  expect(gridColumnCount()).toBe(24);
  // Objects created afterwards take the same share of the denser grid
  expect(newComponentFactory(CHART_TYPE).meta.width).toBe(8);

  dispatcher(store)(UndoActionCreators.undo());
  expect(stateOf(store).dashboardLayout.present['CHART-a'].meta.width).toBe(5);
  expect(gridColumnCount()).toBe(12);
  expect(newComponentFactory(CHART_TYPE).meta.width).toBe(4);
});

test('picks the density from the Grid section', () => {
  const store = makeStore();
  render(<GridSection />, { store });
  expect(screen.getByRole('radio', { name: '12' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  fireEvent.click(screen.getByRole('radio', { name: '48' }));
  expect(stateOf(store).dashboardLayout.present.ROOT_ID.meta.mibiColumns).toBe(
    48,
  );
  expect(screen.getByRole('radio', { name: '48' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
