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
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import type { ReactNode } from 'react';
import {
  act,
  createStore,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import { useCanvasOnlyFilterIds } from 'src/dashboard/components/nativeFilters/scopeLevel';
import { FormatPane } from 'src/mibi/format/FormatPane';
import { selectVisual } from 'src/mibi/format/selection';
import { FilterView } from './FilterView';
import { ELEMENT_DEFAULTS, elementKey, elementKind } from './types';

jest.mock('./CanvasFilterControl', () => ({
  __esModule: true,
  default: ({ filter }: { filter: { name: string } }) => (
    <div data-test="canvas-filter-control">{filter.name}</div>
  ),
}));

const region = {
  id: 'NATIVE_FILTER-region',
  name: 'Región',
  type: 'NATIVE_FILTER',
  filterType: 'filter_select',
  targets: [],
  controlValues: {},
  cascadeParentIds: [],
  defaultDataMask: {},
  description: '',
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
};

const makeLayout = (element: Record<string, unknown>) =>
  ({
    ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'], meta: {} },
    GRID_ID: {
      id: 'GRID_ID',
      type: 'GRID',
      children: ['ROW-1'],
      parents: ['ROOT_ID'],
      meta: {},
    },
    'ROW-1': {
      id: 'ROW-1',
      type: 'ROW',
      children: ['DYNAMIC-filter'],
      parents: ['ROOT_ID', 'GRID_ID'],
      meta: {},
    },
    'DYNAMIC-filter': {
      id: 'DYNAMIC-filter',
      type: 'DYNAMIC',
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
      meta: {
        componentKey: elementKey('filter'),
        width: 3,
        height: 11,
        mibiElement: { ...ELEMENT_DEFAULTS.filter.element, ...element },
      },
    },
  }) as unknown as DashboardLayout;

const makeStore = (element: Record<string, unknown> = {}) =>
  createStore(
    {
      dashboardLayout: { present: makeLayout(element), past: [], future: [] },
      dashboardState: { editMode: true, activeTabs: [] },
      dashboardInfo: {
        id: 7,
        metadata: { native_filter_configuration: [region] },
      },
      nativeFilters: { filters: { [region.id]: region } },
      dataMask: {},
    },
    reducerIndex,
  );

const elementOf = (store: ReturnType<typeof makeStore>) =>
  (store.getState() as unknown as RootState).dashboardLayout.present[
    'DYNAMIC-filter'
  ].meta.mibiElement as { filterId?: string; showInFilterBar?: boolean };

afterEach(() => selectVisual(null));

test('recognises the filter element', () => {
  expect(elementKind('mibi-filter')).toBe('filter');
  expect(ELEMENT_DEFAULTS.filter.element).toEqual({
    kind: 'filter',
    showInFilterBar: true,
  });
});

test('shows the chosen dashboard filter', () => {
  render(
    <FilterView
      editMode={false}
      config={{ kind: 'filter', filterId: region.id }}
    />,
    { store: makeStore() },
  );
  expect(screen.getByTestId('canvas-filter-control')).toHaveTextContent(
    'Región',
  );
});

test('asks editors to pick a filter', () => {
  const store = makeStore();
  const { rerender } = render(
    <FilterView editMode config={{ kind: 'filter' }} />,
    { store },
  );
  expect(
    screen.getByText('Choose a dashboard filter in the Format pane'),
  ).toBeInTheDocument();

  rerender(<FilterView editMode={false} config={{ kind: 'filter' }} />);
  expect(screen.getByText('No filter selected')).toBeInTheDocument();
});

test('explains when the chosen filter was deleted', () => {
  render(
    <FilterView editMode config={{ kind: 'filter', filterId: 'gone' }} />,
    { store: makeStore() },
  );
  expect(
    screen.getByText('The selected filter no longer exists'),
  ).toBeInTheDocument();
});

test('the Format pane picks the filter and its filter bar visibility', async () => {
  const store = makeStore();
  render(<FormatPane />, { store });
  act(() => selectVisual('DYNAMIC-filter'));
  expect(screen.getByTestId('mibi-format-title')).toHaveTextContent('Filter');

  await userEvent.click(
    screen.getByRole('combobox', { name: 'Filter to show' }),
  );
  await userEvent.click(await screen.findByTitle('Región'));
  expect(elementOf(store).filterId).toBe(region.id);

  await userEvent.click(
    screen.getByRole('switch', { name: 'Also show in the filter bar' }),
  );
  expect(elementOf(store).showInFilterBar).toBe(false);
});

test('filters kept only on the canvas are left out of the filter bar', () => {
  const wrapper =
    (store: ReturnType<typeof makeStore>) =>
    ({ children }: { children?: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

  const shared = renderHook(() => useCanvasOnlyFilterIds(), {
    wrapper: wrapper(makeStore({ filterId: region.id })),
  });
  expect([...shared.result.current]).toEqual([]);

  const canvasOnly = renderHook(() => useCanvasOnlyFilterIds(), {
    wrapper: wrapper(
      makeStore({ filterId: region.id, showInFilterBar: false }),
    ),
  });
  expect([...canvasOnly.result.current]).toEqual([region.id]);
});
