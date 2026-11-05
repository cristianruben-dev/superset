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
import { SupersetClient } from '@superset-ui/core';
import type { History } from 'history';
import { ON_SAVE } from 'src/dashboard/actions/dashboardState';
import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import { reloadReport, saveReport, setReportSave } from './editorActions';

jest.mock('src/dashboard/actions/hydrate', () => ({
  ...jest.requireActual('src/dashboard/actions/hydrate'),
  hydrateDashboard: jest.fn(params => ({ type: 'hydrate', params })),
}));

const getState = () =>
  ({
    dashboardInfo: { id: 3 },
    dashboardState: { activeTabs: ['TAB-2'] },
    dataMask: { F: { filterState: { value: ['Norte'] } } },
  }) as never;

const results: Record<string, unknown> = {
  charts: [{ id: 8 }],
  datasets: [
    { metrics: [{ metric_name: 'total', currency: { symbol: '$' } }] },
  ],
  dashboard: { json_metadata: '{"a":1}', position_json: '{"ROOT_ID":{}}' },
};

test('reloading reads the saved report and stays in the editor, on the same page', async () => {
  jest.spyOn(SupersetClient, 'get').mockImplementation(({ endpoint }) => {
    const kind = /charts$/.test(endpoint as string)
      ? 'charts'
      : /datasets$/.test(endpoint as string)
        ? 'datasets'
        : 'dashboard';
    return Promise.resolve({ json: { result: results[kind] } }) as never;
  });
  const dispatch = jest.fn();
  const history = {} as History;

  await reloadReport(history)(dispatch, getState);

  expect(hydrateDashboard).toHaveBeenCalledWith(
    expect.objectContaining({
      history,
      editMode: true,
      activeTabs: ['TAB-2'],
      dataMask: getState()['dataMask' as never],
      charts: results.charts,
      dashboard: expect.objectContaining({
        metadata: { a: 1 },
        position_data: { ROOT_ID: {} },
      }),
    }),
  );
  expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual(
    expect.arrayContaining(['hydrate']),
  );
});

test('saving from the panel stays in the editor, once', () => {
  const save = jest.fn();
  const editing = { editMode: true } as never;
  const actions: { type: string }[] = [];
  setReportSave(save);

  saveReport()(action => actions.push(action as never) as never);

  expect(save).toHaveBeenCalledTimes(1);
  const asked = dashboardStateReducer(editing, actions[0] as never);
  const saved = dashboardStateReducer(asked, {
    type: ON_SAVE,
    lastModifiedTime: 1,
  } as never);
  const finished = dashboardStateReducer(saved, {
    type: 'SAVE_DASHBOARD_FINISHED',
  } as never);
  expect(saved.editMode).toBe(true);
  expect(finished.keepEditingOnSave).toBe(false);
  setReportSave(null);
});

test('a save of the editor itself still leaves it', () => {
  const saved = dashboardStateReducer(
    { editMode: true } as never,
    {
      type: ON_SAVE,
      lastModifiedTime: 1,
    } as never,
  );

  expect(saved.editMode).toBe(false);
});
