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
  act,
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import {
  NativeFilterType,
  type DataMaskStateWithId,
  type Filter,
} from '@superset-ui/core';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { ElementTitle } from './ElementTitle';
import { DateSlicerView, RangeSlicerView } from './RangeSlicerView';

const dataMaskOf = (store: { getState: () => unknown }, id: string) =>
  (store.getState() as { dataMask: DataMaskStateWithId }).dataMask[id];

jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  requestChartDataResolved: jest.fn(),
}));

const filterOf = (id: string, filterType: string) =>
  ({
    id,
    name: 'Price',
    type: NativeFilterType.NativeFilter,
    filterType,
    targets: [{ datasetId: 1, column: { name: 'price' } }],
    controlValues: {},
    cascadeParentIds: [],
    defaultDataMask: {},
  }) as unknown as Filter;

const renderWithStore = async (node: JSX.Element) => {
  const store = createStore(
    { dataMask: {}, dashboardInfo: { id: 7 } },
    reducerIndex,
  );
  const view = render(node, { store });
  await act(async () => {
    await Promise.resolve();
  });
  return { ...view, store };
};

test('a range slicer filters between the two values typed', async () => {
  (requestChartDataResolved as jest.Mock).mockResolvedValue([
    { data: [{ min: 0, max: 100 }] },
  ]);
  const filter = filterOf('NATIVE_FILTER-R', 'filter_range');
  const { store } = await renderWithStore(
    <RangeSlicerView
      filter={filter}
      config={{ kind: 'filter', rangeStyle: 'between' }}
    />,
  );
  const lowest = screen.getByRole('spinbutton', { name: 'Lowest value' });
  expect(lowest).toHaveAttribute('placeholder', '0');
  fireEvent.change(lowest, { target: { value: '10' } });
  fireEvent.blur(lowest);
  expect(dataMaskOf(store, filter.id).extraFormData).toEqual({
    filters: [{ col: 'price', op: '>=', val: 10 }],
  });
});

test('a relative date slicer writes a time range', async () => {
  const filter = filterOf('NATIVE_FILTER-T', 'filter_time');
  const { store } = await renderWithStore(
    <DateSlicerView
      filter={filter}
      config={{ kind: 'filter', dateStyle: 'relative' }}
    />,
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Unit' }), {
    target: { value: 'year' },
  });
  expect(dataMaskOf(store, filter.id).extraFormData).toEqual({
    time_range: 'Last 1 year',
  });
  fireEvent.click(screen.getByTestId('auradata-date-slicer-clear'));
  expect(dataMaskOf(store, filter.id).extraFormData).toEqual({});
});

test('a date slicer between two days includes the last one', async () => {
  const filter = filterOf('NATIVE_FILTER-D', 'filter_time');
  const { store } = await renderWithStore(
    <DateSlicerView
      filter={filter}
      config={{ kind: 'filter', dateStyle: 'between' }}
    />,
  );
  fireEvent.change(screen.getByLabelText('To'), {
    target: { value: '2024-01-31' },
  });
  expect(dataMaskOf(store, filter.id).extraFormData).toEqual({
    time_range: 'Min : 2024-02-01',
  });
});

test('an element title only shows once it is turned on', () => {
  const { rerender } = render(
    <ElementTitle format={{ title: { subtitle: 'x' } }} fallback="Region" />,
  );
  expect(
    screen.queryByTestId('auradata-element-title'),
  ).not.toBeInTheDocument();
  rerender(
    <ElementTitle
      format={{ title: { show: true, subtitle: 'By country' } }}
      fallback="Region"
    />,
  );
  expect(screen.getByTestId('auradata-element-title')).toHaveTextContent(
    'Region',
  );
  expect(screen.getByTestId('auradata-element-subtitle')).toHaveTextContent(
    'By country',
  );
  rerender(
    <ElementTitle
      format={{ title: { show: true, template: 'Zona' } }}
      fallback="Region"
    />,
  );
  expect(screen.getByTestId('auradata-element-title')).toHaveTextContent(
    'Zona',
  );
});

test('leaving a range box without a change does not filter again', async () => {
  (requestChartDataResolved as jest.Mock).mockResolvedValue([
    { data: [{ min: 0, max: 100 }] },
  ]);
  const filter = filterOf('NATIVE_FILTER-R2', 'filter_range');
  const { store } = await renderWithStore(
    <RangeSlicerView
      filter={filter}
      config={{ kind: 'filter', rangeStyle: 'between' }}
    />,
  );
  const lowest = screen.getByRole('spinbutton', { name: 'Lowest value' });
  fireEvent.blur(lowest);
  expect(dataMaskOf(store, filter.id)).toBeUndefined();
  fireEvent.change(lowest, { target: { value: '10' } });
  fireEvent.keyDown(lowest, { key: 'Enter', keyCode: 13 });
  const first = dataMaskOf(store, filter.id);
  fireEvent.blur(lowest);
  expect(dataMaskOf(store, filter.id)).toBe(first);
});
