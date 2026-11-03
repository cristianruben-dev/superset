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
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import { NativeFilterType, type Filter } from '@superset-ui/core';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { slicerStyle, SlicerView } from './SlicerView';

jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  getChartDataRequest: jest.fn(),
}));

const filter = {
  id: 'NATIVE_FILTER-1',
  name: 'Region',
  type: NativeFilterType.NativeFilter,
  filterType: 'filter_select',
  targets: [{ datasetId: 1, column: { name: 'region' } }],
  controlValues: { multiSelect: true },
  cascadeParentIds: [],
  defaultDataMask: {},
} as unknown as Filter;

const state = {
  dataMask: {},
  dashboardInfo: { id: 7 },
  nativeFilters: { filters: { [filter.id]: filter } },
};

const renderSlicer = async (config: object, initial: object = state) => {
  (getChartDataRequest as jest.Mock).mockResolvedValue({
    response: { status: 200 },
    json: { result: [{ data: [{ region: 'North' }, { region: 'South' }] }] },
  });
  const view = render(
    <SlicerView filter={filter} config={{ kind: 'filter', ...config }} />,
    { useRedux: true, initialState: initial },
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

test('lists the values and selects them', async () => {
  await renderSlicer({ variant: 'list' });
  const north = await screen.findByRole('button', { name: 'North' });
  expect(north).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(north);
  expect(
    await screen.findByRole('button', { name: 'North', pressed: true }),
  ).toBeInTheDocument();
});

test('offers select all and search when asked', async () => {
  await renderSlicer({
    variant: 'buttons',
    showSelectAll: true,
    showSearch: true,
  });
  fireEvent.click(await screen.findByTestId('mibi-slicer-all'));
  expect(
    await screen.findByRole('button', { name: 'South', pressed: true }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByTestId('mibi-slicer-search'), {
    target: { value: 'nor' },
  });
  expect(screen.queryByRole('button', { name: 'South' })).toBeNull();
});

test('a text slicer filters by what it contains', async () => {
  await renderSlicer({ variant: 'input' });
  const input = screen.getByTestId('mibi-slicer-input');
  fireEvent.change(input, { target: { value: 'nor' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input).toHaveValue('nor');
});

test('the look only sets what was chosen', () => {
  expect(slicerStyle({ kind: 'filter' })).toEqual({});
  expect(
    slicerStyle({
      kind: 'filter',
      itemSize: 14,
      itemBold: false,
      layout: 'grid',
      columns: 3,
    }),
  ).toEqual({
    '--mb-s-size': '14px',
    '--mb-s-weight': 400,
    '--mb-s-columns': 'repeat(3, minmax(0, 1fr))',
  });
});
