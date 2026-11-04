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
import { SupersetClient } from '@superset-ui/core';
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import getBootstrapData from 'src/utils/getBootstrapData';
import {
  addFieldChange,
  canChangeFields,
  clearPendingFields,
  fieldRole,
  fieldsKeptBy,
  followFieldSteps,
  hasPendingFields,
  isFieldWell,
  removeFieldChanges,
  revertChartFields,
  saveChartFields,
  setChartFieldValue,
  usesField,
  wellOrder,
} from './chartFields';

jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  buildV1ChartDataPayload: jest.fn(() =>
    Promise.resolve({ queries: [{ columns: ['b'] }] }),
  ),
}));
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { user_subjects: [] } })),
}));
const mockUserSubjects = (subjects: number[]) =>
  (getBootstrapData as jest.Mock).mockReturnValue({
    common: { user_subjects: subjects },
  });
jest.mock('src/auradata/dashboard/reloadSavedChart', () => ({
  fetchDashboardSlices: () => ({ type: 'FETCH_SLICES' }),
}));

const setup = (formData = { viz_type: 'pie', groupby: ['a'] }, chart = {}) => {
  const state: Record<string, any> = {
    charts: { 3: { id: 3, form_data: formData, ...chart } },
    dashboardLayout: { present: { 'CHART-1': { meta: {} } } },
  };
  const actions: any[] = [];
  const dispatch = (action: any): any => {
    if (typeof action === 'function') return action(dispatch, () => state);
    actions.push(action);
    if (action.type === 'ADD_TOAST') return action;
    if (action.chart) state.charts[3] = action.chart;
    return action;
  };
  return { state, actions, dispatch };
};

const change = (value: unknown, extra = {}) =>
  setChartFieldValue({
    id: 'CHART-1',
    chartId: 3,
    name: 'groupby',
    value,
    ask: 'query',
    invalid: false,
    ...extra,
  });

beforeEach(() => {
  clearPendingFields();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('roles follow the chart and the orientation of the bars', () => {
  const vertical = { viz_type: 'echarts_timeseries_bar' };
  const horizontal = { ...vertical, orientation: 'horizontal' };
  expect(fieldRole(vertical, 'x_axis')).toBe('X-axis');
  expect(fieldRole(horizontal, 'x_axis')).toBe('Y-axis');
  expect(fieldRole(horizontal, 'metrics')).toBe('X-axis');
  expect(fieldRole({ viz_type: 'other' }, 'metrics')).toBeUndefined();
});

test('a chart with roles only has those wells, and other charts any field', () => {
  const bars = { viz_type: 'echarts_timeseries_bar' };
  expect(isFieldWell(bars, 'metrics', 'DndMetricSelect')).toBe(true);
  expect(isFieldWell(bars, 'timeseries_limit_metric', 'DndMetricSelect')).toBe(
    false,
  );
  const other = { viz_type: 'other' };
  expect(isFieldWell(other, 'anything', 'DndColumnSelect')).toBe(true);
  expect(isFieldWell(other, 'adhoc_filters', 'DndFilterSelect')).toBe(false);
  expect(isFieldWell(other, 'row_limit', 'SelectControl')).toBe(false);
});

test('rows go before columns in a matrix', () => {
  const matrix = { viz_type: 'pivot_table_v2' };
  expect(wellOrder(matrix, 'groupbyRows')).toBeLessThan(
    wellOrder(matrix, 'groupbyColumns'),
  );
});

test('a change shows at once, asks once and waits for the save', () => {
  const { dispatch, actions, state } = setup();
  dispatch(change(['b']));
  dispatch(change(['c']));
  expect(state.charts[3].form_data.groupby).toEqual(['c']);
  expect(hasPendingFields(3)).toBe(true);
  jest.runAllTimers();
  expect(
    actions.filter(action => action.type === 'TRIGGER_QUERY'),
  ).toHaveLength(1);
  expect(actions.some(action => action.type === 'SET_UNSAVED_CHANGES')).toBe(
    true,
  );
});

test('a chart lacking a required field asks for no data', () => {
  const { dispatch, actions } = setup();
  dispatch(change([], { invalid: true }));
  jest.runAllTimers();
  expect(actions.some(action => action.type === 'TRIGGER_QUERY')).toBe(false);
});

test('going back to the saved value leaves nothing waiting', () => {
  const { dispatch } = setup();
  dispatch(change(['b']));
  dispatch(change(['a']));
  expect(hasPendingFields(3)).toBe(false);
});

test('reverting restores what the chart had', () => {
  const { dispatch, state } = setup();
  dispatch(change(['b']));
  dispatch(revertChartFields(3));
  expect(state.charts[3].form_data.groupby).toEqual(['a']);
  expect(hasPendingFields(3)).toBe(false);
});

test('saving writes only the changes over what the server keeps', async () => {
  jest.useRealTimers();
  const params = { viz_type: 'pie', groupby: ['a'], row_limit: 5 };
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { params: JSON.stringify(params) } },
  } as never);
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockResolvedValue({ json: {} } as never);
  const { dispatch } = setup({
    viz_type: 'pie',
    groupby: ['a'],
    extra_form_data: { filters: [] },
  } as never);
  dispatch(change(['b']));
  await dispatch(saveChartFields());
  const payload = put.mock.calls[0][0].jsonPayload as Record<string, string>;
  expect(JSON.parse(payload.params)).toEqual({ ...params, groupby: ['b'] });
  expect(JSON.parse(payload.query_context).queries[0].columns).toEqual(['b']);
  expect(hasPendingFields(3)).toBe(false);
});

test('a failed save keeps the changes waiting', async () => {
  jest.useRealTimers();
  jest.spyOn(SupersetClient, 'get').mockRejectedValue(new Error('no'));
  const { dispatch, actions } = setup();
  dispatch(change(['b']));
  await dispatch(saveChartFields());
  expect(hasPendingFields(3)).toBe(true);
  expect(actions.some(action => action.type === 'ADD_TOAST')).toBe(true);
});

test('a save the server forbids goes back to the saved fields', async () => {
  jest.useRealTimers();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { params: '{}' } },
  } as never);
  jest
    .spyOn(SupersetClient, 'put')
    .mockRejectedValue({ status: 403, statusText: 'FORBIDDEN' });
  const { dispatch, state, actions } = setup();
  dispatch(change(['b']));
  await dispatch(saveChartFields());
  expect(hasPendingFields(3)).toBe(false);
  expect(state.charts[3].form_data.groupby).toEqual(['a']);
  expect(
    actions.some(
      action =>
        action.type === 'ADD_TOAST' &&
        /don't own/.test(String(action.payload?.text)),
    ),
  ).toBe(true);
});

test('a chart lacking a required field goes back instead of saving', async () => {
  jest.useRealTimers();
  const put = jest.spyOn(SupersetClient, 'put');
  const { dispatch, state } = setup();
  dispatch(change([], { invalid: true }));
  await dispatch(saveChartFields());
  expect(put).not.toHaveBeenCalled();
  expect(state.charts[3].form_data.groupby).toEqual(['a']);
});

test('only editors and admins change the fields of a chart', () => {
  const user = { userId: 1, roles: { Gamma: [] } } as never;
  const admin = {
    userId: 2,
    username: 'admin',
    roles: { Admin: [] },
    permissions: {},
  } as never;
  // The viewer is the subjects 1 (their user) and 5 (one of their roles)
  mockUserSubjects([1, 5]);
  expect(canChangeFields(user, [{ id: 5 }])).toBe(true);
  expect(canChangeFields(user, [{ id: 9 }])).toBe(false);
  expect(canChangeFields(admin, [{ id: 9 }])).toBe(true);
  expect(canChangeFields(user, undefined)).toBe(true);
  // A workspace contributor edits the dashboard without being a chart editor
  expect(canChangeFields(user, [{ id: 9 }], true)).toBe(true);
});

test('names the fields of a butterfly chart by their side', () => {
  const butterfly = { viz_type: 'butterfly' };

  expect(fieldRole(butterfly, 'groupby')).toBe('Category');
  expect(fieldRole(butterfly, 'left_metric')).toBe('Left values');
  expect(fieldRole(butterfly, 'right_metric')).toBe('Right values');
  expect(isFieldWell(butterfly, 'left_metric', 'MetricsControl')).toBe(true);
  expect(isFieldWell(butterfly, 'order_desc', 'CheckboxControl')).toBe(false);
});

test('undo and redo move through the field changes', () => {
  const store = createStore(
    {
      charts: {
        3: { id: 3, form_data: { viz_type: 'pie', groupby: ['a'] } },
      },
      dashboardState: { hasUnsavedChanges: false },
      dashboardLayout: {
        past: [],
        future: [],
        present: {
          [DASHBOARD_ROOT_ID]: {
            id: DASHBOARD_ROOT_ID,
            type: 'ROOT',
            meta: {},
          },
          'CHART-1': {
            id: 'CHART-1',
            type: 'CHART',
            meta: { chartId: 3, mibiFormat: { chart: { groupby: ['x'] } } },
          },
        },
      },
    },
    reducerIndex,
  );
  const dispatch = store.dispatch as (action: unknown) => unknown;
  const groupby = () => (store.getState() as any).charts[3].form_data.groupby;
  const own = () =>
    (store.getState() as any).dashboardLayout.present['CHART-1'].meta.mibiFormat
      .chart;
  dispatch(change(['b']));
  dispatch(change(['c']));
  expect(groupby()).toEqual(['c']);
  expect(own()).toEqual({});

  dispatch(UndoActionCreators.undo());
  dispatch(followFieldSteps());
  expect(groupby()).toEqual(['b']);

  dispatch(UndoActionCreators.undo());
  dispatch(followFieldSteps());
  expect(groupby()).toEqual(['a']);
  // The format key the first change moved out comes back with it
  expect(own()).toEqual({ groupby: ['x'] });
  expect(hasPendingFields(3)).toBe(false);

  dispatch(UndoActionCreators.redo());
  dispatch(UndoActionCreators.redo());
  dispatch(followFieldSteps());
  expect(groupby()).toEqual(['c']);
  expect(hasPendingFields(3)).toBe(true);

  // Going back to the saved fields is one more step, which undo takes back
  dispatch(revertChartFields(3, 'CHART-1'));
  expect(groupby()).toEqual(['a']);
  dispatch(UndoActionCreators.undo());
  dispatch(followFieldSteps());
  expect(groupby()).toEqual(['c']);
});

test('a ticked field goes to the well Power BI would choose', () => {
  const bars = { viz_type: 'echarts_timeseries_bar', metrics: ['m'] };
  const asMetric = (column: unknown) => ({ sum: column });
  const region = {
    kind: 'column' as const,
    name: 'region',
    numeric: false,
    value: { column_name: 'region' },
  };
  expect(addFieldChange(bars, region, asMetric)).toEqual({
    name: 'x_axis',
    value: 'region',
  });
  expect(addFieldChange({ ...bars, x_axis: 'date' }, region, asMetric)).toEqual(
    { name: 'groupby', value: ['region'] },
  );
  const sales = { ...region, name: 'sales', numeric: true };
  expect(addFieldChange(bars, sales, asMetric)).toEqual({
    name: 'metrics',
    value: ['m', { sum: sales.value }],
  });
  // A card takes one value: a second one has nowhere to go
  expect(
    addFieldChange(
      { viz_type: 'big_number_total', metric: 'm' },
      { kind: 'metric', name: 'n' },
      asMetric,
    ),
  ).toBeUndefined();
});

test('a field is found and taken out of every well that has it', () => {
  const pie = {
    viz_type: 'pie',
    groupby: ['region', 'product'],
    metric: { column: { column_name: 'sales' }, aggregate: 'SUM' },
  };
  const region = {
    kind: 'column' as const,
    name: 'region',
    numeric: false,
    value: {},
  };
  const sales = { ...region, name: 'sales', numeric: true };
  expect(usesField(pie, region)).toBe(true);
  expect(usesField(pie, sales)).toBe(true);
  expect(usesField(pie, { kind: 'metric', name: 'region' })).toBe(false);
  expect(removeFieldChanges(pie, region)).toEqual([
    { name: 'groupby', value: ['product'] },
  ]);
  expect(removeFieldChanges(pie, sales)).toEqual([
    { name: 'metric', value: undefined },
  ]);
});

test('a new dataset keeps only the fields it has', () => {
  const bars = {
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'date',
    groupby: ['region', 'product'],
    metrics: ['total', { column: { column_name: 'amount' }, aggregate: 'SUM' }],
    adhoc_filters: [{ subject: 'region' }, { subject: 'year' }],
  };
  const dataset = {
    columns: [{ column_name: 'region' }, { column_name: 'amount' }],
    metrics: [],
  };
  expect(fieldsKeptBy(bars, dataset)).toEqual({
    kept: {
      x_axis: undefined,
      groupby: ['region'],
      metrics: [{ column: { column_name: 'amount' }, aggregate: 'SUM' }],
      adhoc_filters: [{ subject: 'region' }],
    },
    emptied: true,
  });
});

test('saving a chart moved to another dataset tells the server which', async () => {
  jest.useRealTimers();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { params: '{}' } },
  } as never);
  const put = jest
    .spyOn(SupersetClient, 'put')
    .mockResolvedValue({ json: {} } as never);
  const { dispatch } = setup();
  dispatch(change('5__table', { name: 'datasource' }));
  await dispatch(saveChartFields());
  expect(put.mock.calls[0][0].jsonPayload).toMatchObject({
    datasource_id: 5,
    datasource_type: 'table',
  });
});

test('a dataset the server refuses goes back to the saved fields', async () => {
  jest.useRealTimers();
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { params: '{}' } },
  } as never);
  jest.spyOn(SupersetClient, 'put').mockRejectedValue({ status: 422 });
  const { dispatch, state } = setup();
  dispatch(change('5__table', { name: 'datasource' }));
  await dispatch(saveChartFields());
  expect(hasPendingFields(3)).toBe(false);
  expect(state.charts[3].form_data.datasource).toBeUndefined();
});
