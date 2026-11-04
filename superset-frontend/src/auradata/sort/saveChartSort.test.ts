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
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';
import {
  applyChanges,
  canUndoChartSort,
  saveChartParams,
  saveChartSort,
  undoChartSort,
} from './saveChartSort';

jest.mock('src/explore/exploreUtils', () => ({
  buildV1ChartDataPayload: jest.fn(async ({ formData }) => ({
    queries: [{ built_from: formData }],
  })),
}));

const savedParams = {
  datasource: '1__table',
  viz_type: 'echarts_timeseries_bar',
  x_axis: 'country',
  metrics: ['SUM(sales)'],
};

/** The chart API, holding each chart's saved params. */
const charts: Record<number, string> = {};
const put = jest.spyOn(SupersetClient, 'put');
jest.spyOn(SupersetClient, 'get').mockImplementation((async ({
  endpoint,
}: {
  endpoint: string;
}) => {
  const id = Number(endpoint.split('/').pop());
  return { json: { result: { id, params: charts[id] } } };
}) as never);

const mockChart = (id: number, params: object = savedParams) => {
  charts[id] = JSON.stringify(params);
  put.mockImplementation((async ({
    endpoint,
    jsonPayload,
  }: {
    endpoint: string;
    jsonPayload: { params: string };
  }) => {
    charts[Number(endpoint.split('/').pop())] = jsonPayload.params;
    return { json: {} };
  }) as never);
};

const lastPut = (id: number) => {
  const call = put.mock.calls
    .map(
      ([request]) =>
        request as { endpoint: string; jsonPayload: Record<string, string> },
    )
    .filter(({ endpoint }) => endpoint === `/api/v1/chart/${id}`)
    .pop();
  return {
    params: JSON.parse(call!.jsonPayload.params),
    queryContext: JSON.parse(call!.jsonPayload.query_context),
  };
};

afterEach(() => {
  jest.clearAllMocks();
});

test('applyChanges removes the settings set to undefined', () => {
  expect(
    applyChanges(
      { ...savedParams, x_axis_sort: 'country' },
      {
        x_axis_sort: undefined,
        x_axis_sort_asc: false,
      },
    ),
  ).toEqual({ ...savedParams, x_axis_sort_asc: false });
});

test('saving merges the changes into the saved params and rebuilds the query', async () => {
  mockChart(1);
  const previous = await saveChartParams(1, {
    x_axis_sort: 'SUM(sales)',
    x_axis_sort_asc: false,
  });

  expect(previous).toEqual({
    x_axis_sort: undefined,
    x_axis_sort_asc: undefined,
  });
  const expected = {
    ...savedParams,
    x_axis_sort: 'SUM(sales)',
    x_axis_sort_asc: false,
  };
  const { params, queryContext } = lastPut(1);
  expect(params).toEqual(expected);
  expect(buildV1ChartDataPayload).toHaveBeenCalledWith(
    expect.objectContaining({ formData: expected, force: false }),
  );
  expect(queryContext).toEqual({ queries: [{ built_from: expected }] });
});

test('undo restores the sort the chart had before', async () => {
  mockChart(2, {
    ...savedParams,
    x_axis_sort: 'country',
    x_axis_sort_asc: true,
  });
  expect(canUndoChartSort(2)).toBe(false);

  await saveChartSort(2, { x_axis_sort: 'SUM(sales)', x_axis_sort_asc: false });
  expect(canUndoChartSort(2)).toBe(true);

  await undoChartSort(2);
  expect(lastPut(2).params).toMatchObject({
    x_axis_sort: 'country',
    x_axis_sort_asc: true,
  });
  expect(canUndoChartSort(2)).toBe(false);
});

test('undo removes a sort the chart did not have', async () => {
  mockChart(3);
  await saveChartSort(3, { x_axis_sort: 'country', x_axis_sort_asc: true });
  await undoChartSort(3);
  expect(lastPut(3).params).toEqual(savedParams);
});

test('a failed save throws and leaves nothing to undo', async () => {
  charts[4] = JSON.stringify(savedParams);
  put.mockRejectedValueOnce(new Response(null, { status: 403 }));

  await expect(
    saveChartSort(4, { x_axis_sort: 'country', x_axis_sort_asc: true }),
  ).rejects.toBeTruthy();
  expect(canUndoChartSort(4)).toBe(false);
});
