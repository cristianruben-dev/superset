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
import { act, render, screen, waitFor } from 'spec/helpers/testing-library';
import * as dashboardState from 'src/dashboard/actions/dashboardState';
import * as sliceEntities from 'src/dashboard/actions/sliceEntities';
import type { RootState } from 'src/dashboard/types';
import {
  CHART_SAVED,
  DATA_PANEL_URL,
  EDIT_CHART_FROM_PANEL,
  openChartEditor,
  SQL_PANEL_URL,
} from '../chartEditor';
import { ChartEditorPanel, newChartDestination } from './ChartEditorPanel';

type LayoutState = Pick<RootState, 'dashboardLayout' | 'dashboardState'>;

const layoutState = (
  present: Record<string, unknown>,
  activeTabs: string[] = [],
) =>
  ({
    dashboardLayout: { present },
    dashboardState: { activeTabs },
  }) as unknown as LayoutState;

test('new charts go to the end of the grid', () => {
  const state = layoutState({
    ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'] },
    GRID_ID: { id: 'GRID_ID', type: 'GRID', children: ['ROW-1', 'ROW-2'] },
  });

  expect(newChartDestination(state)).toEqual({
    id: 'GRID_ID',
    type: 'GRID',
    index: 2,
  });
});

test('new charts go to the end of the visible top tab', () => {
  const state = layoutState(
    {
      ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['TABS-1'] },
      'TABS-1': { id: 'TABS-1', type: 'TABS', children: ['TAB-a', 'TAB-b'] },
      'TAB-a': { id: 'TAB-a', type: 'TAB', children: ['ROW-1'] },
      'TAB-b': { id: 'TAB-b', type: 'TAB', children: [] },
    },
    ['TAB-b'],
  );

  expect(newChartDestination(state)).toEqual({
    id: 'TAB-b',
    type: 'TAB',
    index: 0,
  });
});

test('opens Explore in the panel and reloads the chart once it is saved', async () => {
  const fetchSlices = jest
    .spyOn(sliceEntities, 'fetchSlices')
    .mockReturnValue((() => Promise.resolve()) as never);
  const addSliceToDashboard = jest
    .spyOn(dashboardState, 'addSliceToDashboard')
    .mockReturnValue({ type: 'noop' } as never);

  render(<ChartEditorPanel />, {
    useRedux: true,
    initialState: {
      dashboardInfo: { id: 7 },
      dashboardState: { editMode: false },
    },
  });

  act(() => openChartEditor({ url: '/explore/?slice_id=3', chartId: 3 }));

  const frame = await screen.findByTestId('mibi-chart-editor-frame');
  expect(frame).toHaveAttribute('src', '/explore/?slice_id=3&mibi_panel=1');
  expect(screen.getByText('Edit visual')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: CHART_SAVED, chartId: 3, isNew: false },
      }),
    );
  });

  await waitFor(() => expect(addSliceToDashboard).toHaveBeenCalledWith(3));
  expect(fetchSlices).toHaveBeenCalledWith(
    undefined,
    undefined,
    'changed_on',
    7,
  );
  await waitFor(() =>
    expect(
      screen.queryByTestId('mibi-chart-editor-frame'),
    ).not.toBeInTheDocument(),
  );
  fetchSlices.mockRestore();
  addSliceToDashboard.mockRestore();
});

test('ignores messages from other origins', async () => {
  const addSliceToDashboard = jest.spyOn(dashboardState, 'addSliceToDashboard');
  render(<ChartEditorPanel />, {
    useRedux: true,
    initialState: { dashboardInfo: { id: 7 } },
  });

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example.com',
        data: { type: CHART_SAVED, chartId: 3, isNew: false },
      }),
    );
  });

  expect(addSliceToDashboard).not.toHaveBeenCalled();
  addSliceToDashboard.mockRestore();
});

test('opens SQL Lab wide and turns a saved dataset into a new chart', async () => {
  render(<ChartEditorPanel />, {
    useRedux: true,
    initialState: { dashboardInfo: { id: 7 }, charts: {} },
  });

  act(() => openChartEditor({ url: SQL_PANEL_URL, kind: 'sql' }));

  const frame = await screen.findByTestId('mibi-chart-editor-frame');
  expect(frame).toHaveAttribute('src', '/sqllab/?dashboard_id=7&mibi_panel=1');
  expect(screen.getByText('SQL editor')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          type: EDIT_CHART_FROM_PANEL,
          url: '/chart/add/?dataset=ventas',
        },
      }),
    );
  });

  await waitFor(() =>
    expect(screen.getByTestId('mibi-chart-editor-frame')).toHaveAttribute(
      'src',
      '/chart/add/?dataset=ventas&dashboard_id=7&mibi_panel=1',
    ),
  );
  expect(screen.getByText('New visual')).toBeInTheDocument();
});

test('refreshes the charts when the data panel closes', async () => {
  const refresh = jest
    .spyOn(dashboardState, 'onRefresh')
    .mockReturnValue({ type: 'noop' } as never);
  render(<ChartEditorPanel />, {
    useRedux: true,
    initialState: { dashboardInfo: { id: 7 }, charts: { 3: {}, 5: {} } },
  });

  act(() => openChartEditor({ url: DATA_PANEL_URL, kind: 'data' }));
  expect(await screen.findByText('Data')).toBeInTheDocument();

  act(() => {
    screen.getByRole('button', { name: 'Close' }).click();
  });

  expect(refresh).toHaveBeenCalledWith([3, 5], true, 0, 7);
  refresh.mockRestore();
});

test('opening the page it already shows does not leave it loading', async () => {
  render(<ChartEditorPanel />, {
    useRedux: true,
    initialState: { dashboardInfo: { id: 7 } },
  });

  act(() => openChartEditor({ url: '/explore/?slice_id=3', chartId: 3 }));
  const frame = await screen.findByTestId('mibi-chart-editor-frame');
  act(() => {
    frame.dispatchEvent(new Event('load'));
  });
  act(() => openChartEditor({ url: '/explore/?slice_id=3', chartId: 3 }));

  expect(
    screen.getByTestId('mibi-chart-editor').querySelector('.loading'),
  ).toBeNull();
});
