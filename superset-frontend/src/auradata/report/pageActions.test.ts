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
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DashboardLayout } from 'src/dashboard/types';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import { topLevelTabs } from 'src/auradata/present/dashboardTabs';
import {
  MOBILE_LAYOUT_KEY,
  mobileLayoutOf,
} from 'src/auradata/format/mobileLayout';
import { insertPage } from './pageActions';

test('the mobile layout of a report of one page goes to its first page', () => {
  const items = [{ id: 'CHART-1', x: 0, y: 0, width: 12, height: 6 }];
  const store = createStore(
    {
      dashboardLayout: {
        present: {
          [DASHBOARD_ROOT_ID]: {
            id: DASHBOARD_ROOT_ID,
            type: 'ROOT',
            children: [DASHBOARD_GRID_ID],
            meta: {},
          },
          [DASHBOARD_GRID_ID]: {
            id: DASHBOARD_GRID_ID,
            type: 'GRID',
            children: ['ROW-1'],
            parents: [DASHBOARD_ROOT_ID],
            meta: { [MOBILE_LAYOUT_KEY]: { items } },
          },
          'ROW-1': {
            id: 'ROW-1',
            type: 'ROW',
            children: ['CHART-1'],
            parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
            meta: {},
          },
          'CHART-1': {
            id: 'CHART-1',
            type: 'CHART',
            children: [],
            parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-1'],
            meta: {
              chartId: 1,
              width: 24,
              height: 12,
              auradataPos: { x: 0, y: 0 },
            },
          },
        },
        past: [],
        future: [],
      },
      dashboardState: { activeTabs: [], hasUnsavedChanges: false },
      dashboardInfo: { id: 1 },
    },
    reducerIndex,
  );
  store.dispatch(insertPage() as never);
  const layout = (
    store.getState() as unknown as {
      dashboardLayout: { present: DashboardLayout };
    }
  ).dashboardLayout.present;
  const [first] = topLevelTabs(layout);
  expect(mobileLayoutOf(layout, first.id)).toEqual(items);
  expect(mobileLayoutOf(layout, DASHBOARD_GRID_ID)).toBeNull();
});
