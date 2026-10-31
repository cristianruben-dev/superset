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
import fetchMock from 'fetch-mock';
import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import {
  createStore,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import { applyTheme, themeOf, type FormatTheme } from './themes';
import { ThemeSection } from './ThemeSection';

const layout = {
  ROOT_ID: {
    id: 'ROOT_ID',
    type: 'ROOT',
    children: ['GRID_ID'],
    meta: {
      mibiCanvas: {
        background: { type: 'image', image: '/bg.png' },
        gap: 8,
        visuals: { radius: 3, title: { size: 20, subtitle: 'Mes' } },
      },
    },
  },
  GRID_ID: { id: 'GRID_ID', type: 'GRID', children: [], meta: {} },
  'CHART-a': {
    id: 'CHART-a',
    type: 'CHART',
    children: [],
    meta: {
      chartId: 1,
      mibiFormat: { radius: 30, title: { subtitle: 'Ventas del mes' } },
    },
  },
  'CHART-b': {
    id: 'CHART-b',
    type: 'CHART',
    children: [],
    meta: { chartId: 2, mibiFormat: { shadow: 'strong' } },
  },
} as unknown as DashboardLayout;

const makeStore = () =>
  createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { editMode: true, hasUnsavedChanges: false },
      dashboardInfo: { id: 7, metadata: { color_scheme: 'old' } },
    },
    reducerIndex,
  );

const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as RootState;

const dispatcher = (store: ReturnType<typeof makeStore>) =>
  store.dispatch as unknown as (action: unknown) => void;

const saved: FormatTheme = {
  id: 4,
  name: 'Corporativo',
  can_edit: true,
  theme: {
    canvas: { background: { type: 'color', color: '#eef2f7' } },
    visuals: { radius: 4, shadow: 'none' },
    colorScheme: 'themeTest',
  },
};

beforeAll(() => {
  getCategoricalSchemeRegistry().registerValue(
    'themeTest',
    new CategoricalScheme({ id: 'themeTest', colors: ['#111111', '#222222'] }),
  );
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('a theme leaves out the picture and the text of each chart', () => {
  expect(
    themeOf(
      stateOf(makeStore()).dashboardLayout.present.ROOT_ID.meta.mibiCanvas,
      'neon',
    ),
  ).toEqual({
    canvas: { background: { type: 'none' }, gap: 8 },
    visuals: { radius: 3, title: { size: 20 } },
    colorScheme: 'neon',
  });
  expect(themeOf(undefined, undefined)).toEqual({});
});

test('applies a theme in one step, keeping subtitles', () => {
  const store = makeStore();
  dispatcher(store)(applyTheme(saved.theme));
  const state = stateOf(store);
  const { present } = state.dashboardLayout;
  expect(present.ROOT_ID.meta.mibiCanvas).toEqual({
    background: { type: 'color', color: '#eef2f7' },
    visuals: { radius: 4, shadow: 'none' },
  });
  expect(present['CHART-a'].meta.mibiFormat).toEqual({
    title: { subtitle: 'Ventas del mes' },
  });
  expect(present['CHART-b'].meta).not.toHaveProperty('mibiFormat');
  expect(state.dashboardInfo.metadata.color_scheme).toBe('themeTest');
  expect(state.dashboardState.colorScheme).toBe('themeTest');
  expect(state.dashboardState.hasUnsavedChanges).toBe(true);
});

test('a theme without a background keeps the picture, and charts can stay', () => {
  const store = makeStore();
  dispatcher(store)(
    applyTheme(
      { visuals: { radius: 1 }, colorScheme: 'missing' },
      { resetCharts: false },
    ),
  );
  const state = stateOf(store);
  expect(state.dashboardLayout.present.ROOT_ID.meta.mibiCanvas).toEqual({
    background: { type: 'image', image: '/bg.png' },
    visuals: { radius: 1 },
  });
  expect(state.dashboardLayout.present['CHART-b'].meta.mibiFormat).toEqual({
    shadow: 'strong',
  });
  // An unknown palette is ignored
  expect(state.dashboardInfo.metadata.color_scheme).toBe('old');
});

test('picks, applies and saves themes from the Format pane', async () => {
  fetchMock.get('glob:*/api/v1/format_theme/', { result: [saved] });
  fetchMock.post('glob:*/api/v1/format_theme/', {
    result: { ...saved, id: 5, name: 'Mío' },
  });
  const store = makeStore();
  render(<ThemeSection />, { store });

  await userEvent.click(await screen.findByRole('combobox', { name: 'Theme' }));
  await userEvent.click(await screen.findByText('Corporativo'));
  fireEvent.click(screen.getByTestId('mibi-theme-apply'));
  expect(
    stateOf(store).dashboardLayout.present.ROOT_ID.meta.mibiCanvas?.visuals,
  ).toEqual({ radius: 4, shadow: 'none' });

  fireEvent.click(screen.getByTestId('mibi-theme-save-as'));
  await userEvent.type(screen.getByTestId('mibi-theme-name'), '  Mío ');
  fireEvent.click(screen.getByTestId('mibi-theme-save'));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/format_theme/'),
    ).toHaveLength(2),
  );
  const post = fetchMock.callHistory.lastCall('glob:*/api/v1/format_theme/');
  expect(JSON.parse(post?.options.body as string)).toEqual({
    name: 'Mío',
    theme: {
      canvas: { background: { type: 'color', color: '#eef2f7' } },
      visuals: { radius: 4, shadow: 'none' },
      colorScheme: 'themeTest',
    },
  });
  expect(await screen.findByTestId('mibi-theme-update')).toBeInTheDocument();
});

test('says when there are no themes yet', async () => {
  fetchMock.get('glob:*/api/v1/format_theme/', { result: [] });
  render(<ThemeSection />, { store: makeStore() });
  expect(await screen.findByText('No saved themes')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-theme-apply')).toBeDisabled();
});
