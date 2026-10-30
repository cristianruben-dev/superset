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
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import { activeTabIndex, topLevelTabs } from './dashboardTabs';
import { isPresenting, setPresenting } from './presentation';
import { PresentationControls } from './PresentationControls';

const layout = {
  ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['TABS-1'], meta: {} },
  'TABS-1': {
    id: 'TABS-1',
    type: 'TABS',
    children: ['TAB-a', 'TAB-b'],
    parents: ['ROOT_ID'],
    meta: {},
  },
  'TAB-a': { id: 'TAB-a', type: 'TAB', children: [], meta: { text: 'Sales' } },
  'TAB-b': { id: 'TAB-b', type: 'TAB', children: [], meta: { text: 'Costs' } },
  HEADER_ID: {
    id: 'HEADER_ID',
    type: 'HEADER',
    children: [],
    meta: { text: 'Board' },
  },
} as unknown as DashboardLayout;

test('lists the top level tabs with the path that opens each', () => {
  expect(topLevelTabs(layout)).toEqual([
    { id: 'TAB-a', title: 'Sales', path: ['ROOT_ID', 'TABS-1', 'TAB-a'] },
    { id: 'TAB-b', title: 'Costs', path: ['ROOT_ID', 'TABS-1', 'TAB-b'] },
  ]);
});

test('has no tabs when the root holds the grid', () => {
  expect(
    topLevelTabs({
      ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'], meta: {} },
      GRID_ID: { id: 'GRID_ID', type: 'GRID', children: [], meta: {} },
    } as unknown as DashboardLayout),
  ).toEqual([]);
});

test('finds the active tab and falls back to the first', () => {
  const tabs = topLevelTabs(layout);
  expect(activeTabIndex(tabs, ['TAB-b'])).toBe(1);
  expect(activeTabIndex(tabs, [])).toBe(0);
});

test('marks the page while presenting', () => {
  setPresenting(true);
  expect(isPresenting()).toBe(true);
  expect(document.body).toHaveClass('mibi-presenting');
  setPresenting(false);
  expect(document.body).not.toHaveClass('mibi-presenting');
});

const renderControls = () => {
  const store = createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { activeTabs: ['TAB-a'], nativeFiltersBarOpen: false },
      dashboardInfo: {},
    },
    reducerIndex,
  );
  render(<PresentationControls />, { store });
  return store;
};

test('shows the dashboard, the page and goes to the next page', () => {
  setPresenting(true);
  const store = renderControls();
  expect(screen.getByText('Board')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-presentation-tab')).toHaveTextContent(
    '1 of 2 · Sales',
  );
  fireEvent.click(screen.getByTestId('mibi-presentation-next'));
  expect(
    (store.getState() as unknown as RootState).dashboardState.directPathToChild,
  ).toEqual(['ROOT_ID', 'TABS-1', 'TAB-b']);
});

test('ends the presentation with Escape', () => {
  setPresenting(true);
  renderControls();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(isPresenting()).toBe(false);
});
