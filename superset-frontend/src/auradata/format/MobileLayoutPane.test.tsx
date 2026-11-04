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
  createStore,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { MobileLayoutEditor } from './MobileLayoutEditor';
import { MobileLayoutPane } from './MobileLayoutPane';
import { MOBILE_LAYOUT_KEY, mobileLayoutOf } from './mobileLayout';

const layout = {
  [DASHBOARD_ROOT_ID]: {
    id: DASHBOARD_ROOT_ID,
    type: 'ROOT',
    children: ['GRID_ID'],
    meta: {},
  },
  GRID_ID: {
    id: 'GRID_ID',
    type: 'GRID',
    children: ['ROW-1'],
    parents: [DASHBOARD_ROOT_ID],
    meta: {},
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['CHART-1', 'CHART-2'],
    parents: [DASHBOARD_ROOT_ID, 'GRID_ID'],
    meta: {},
  },
  'CHART-1': {
    id: 'CHART-1',
    type: 'CHART',
    children: [],
    parents: [DASHBOARD_ROOT_ID, 'GRID_ID', 'ROW-1'],
    meta: { chartId: 1, sliceName: 'Sales', width: 24, height: 12 },
  },
  'CHART-2': {
    id: 'CHART-2',
    type: 'CHART',
    children: [],
    parents: [DASHBOARD_ROOT_ID, 'GRID_ID', 'ROW-1'],
    meta: { chartId: 2, sliceName: 'Costs', width: 12, height: 8 },
  },
};

const storeWith = (gridMeta: Record<string, unknown> = {}) =>
  createStore(
    {
      dashboardLayout: {
        present: { ...layout, GRID_ID: { ...layout.GRID_ID, meta: gridMeta } },
        past: [],
        future: [],
      },
      dashboardState: { activeTabs: [], hasUnsavedChanges: false },
      nativeFilters: { filters: {} },
    },
    reducerIndex,
  );

const boxesOf = (store: ReturnType<typeof storeWith>) =>
  mobileLayoutOf(
    (
      store.getState() as unknown as {
        dashboardLayout: { present: typeof layout };
      }
    ).dashboardLayout.present,
    'GRID_ID',
  );

test('the pane adds the visuals of the page to the phone and takes them off', () => {
  const store = storeWith();
  render(<MobileLayoutPane />, { store });
  expect(screen.getAllByTestId('auradata-mobile-candidate')).toHaveLength(2);

  userEvent.click(screen.getByRole('button', { name: /Add Sales/ }));
  expect(boxesOf(store)).toEqual([
    { id: 'CHART-1', x: 0, y: 0, width: 12, height: 6 },
  ]);
  userEvent.click(screen.getByRole('button', { name: /Add Costs/ }));
  expect(boxesOf(store)?.[1]).toMatchObject({ id: 'CHART-2', y: 6 });

  userEvent.click(screen.getByRole('button', { name: /Remove Sales/ }));
  expect(boxesOf(store)?.map(box => box.id)).toEqual(['CHART-2']);

  userEvent.click(screen.getByTestId('auradata-mobile-clear'));
  expect(boxesOf(store)).toBeNull();
});

test('the cross of a box on the phone takes it off the mobile layout', () => {
  const items = [{ id: 'CHART-1', x: 0, y: 0, width: 12, height: 6 }];
  const store = storeWith({ [MOBILE_LAYOUT_KEY]: { items } });
  render(<MobileLayoutEditor pageId="GRID_ID" boxes={items} zoom={1} />, {
    store,
  });
  expect(screen.getByRole('group', { name: 'Sales' })).toBeInTheDocument();
  userEvent.click(screen.getByTestId('auradata-mobile-remove'));
  expect(boxesOf(store)).toBeNull();
  // The chart itself stays on the canvas
  expect(
    (
      store.getState() as unknown as {
        dashboardLayout: { present: typeof layout };
      }
    ).dashboardLayout.present['CHART-1'],
  ).toBeDefined();
});
