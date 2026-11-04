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
import { slicerStyle, SlicerView } from './SlicerView';

const dataMaskOf = (store: { getState: () => unknown }, id: string) =>
  (store.getState() as { dataMask: DataMaskStateWithId }).dataMask[id];

jest.mock('src/components/Chart/chartAction', () => ({
  ...jest.requireActual('src/components/Chart/chartAction'),
  requestChartDataResolved: jest.fn(),
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
  (requestChartDataResolved as jest.Mock).mockResolvedValue([
    { data: [{ region: 'North' }, { region: 'South' }] },
  ]);
  const store = createStore(initial, reducerIndex);
  const view = render(
    <SlicerView filter={filter} config={{ kind: 'filter', ...config }} />,
    { store },
  );
  await act(async () => {
    await Promise.resolve();
  });
  return { ...view, store };
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
  expect(
    screen.queryByRole('button', { name: 'South' }),
  ).not.toBeInTheDocument();
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

test('a single selection slicer keeps one value', async () => {
  await renderSlicer({ variant: 'buttons', selection: 'single' });
  fireEvent.click(await screen.findByRole('button', { name: 'North' }));
  fireEvent.click(screen.getByRole('button', { name: 'South' }));
  expect(
    await screen.findByRole('button', { name: 'South', pressed: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'North', pressed: false }),
  ).toBeInTheDocument();
});

test('with Ctrl selection a plain click replaces and Ctrl adds', async () => {
  await renderSlicer({ variant: 'list', selection: 'ctrl' });
  fireEvent.click(await screen.findByRole('button', { name: 'North' }));
  fireEvent.click(screen.getByRole('button', { name: 'South' }));
  expect(
    await screen.findByRole('button', { name: 'North', pressed: false }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'North' }), {
    ctrlKey: true,
  });
  expect(
    await screen.findByRole('button', { name: 'North', pressed: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'South', pressed: true }),
  ).toBeInTheDocument();
});

test('an Apply button holds the choices until it is pressed', async () => {
  const { store } = await renderSlicer({
    variant: 'list',
    applyButton: true,
    showSummary: true,
  });
  fireEvent.click(await screen.findByRole('button', { name: 'North' }));
  expect(
    screen.getByRole('img', { name: 'Changes not applied' }),
  ).toBeVisible();
  expect(dataMaskOf(store, filter.id)).toBeUndefined();
  fireEvent.click(screen.getByTestId('mibi-slicer-apply'));
  expect(dataMaskOf(store, filter.id)?.filterState?.value).toEqual(['North']);
  expect(screen.getByTestId('mibi-slicer-summary')).toHaveTextContent('North');
  expect(
    screen.queryByRole('img', { name: 'Changes not applied' }),
  ).not.toBeInTheDocument();
});

test('the chosen values show as chips that remove them', async () => {
  await renderSlicer({ variant: 'buttons', showPills: true });
  fireEvent.click(await screen.findByRole('button', { name: 'North' }));
  const chip = await screen.findByRole('button', {
    name: 'Remove the value North',
  });
  fireEvent.click(chip);
  expect(
    await screen.findByRole('button', { name: 'North', pressed: false }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('mibi-slicer-pills')).not.toBeInTheDocument();
});

test('values can be sorted', async () => {
  await renderSlicer({ variant: 'list', sortValues: 'desc' });
  await screen.findByRole('button', { name: 'North' });
  expect(
    screen.getAllByTestId('mibi-slicer-item').map(item => item.textContent),
  ).toEqual(['South', 'North']);
});

test('a text slicer of whole values filters by the list', async () => {
  const { store } = await renderSlicer({
    variant: 'input',
    inputMatch: 'exact',
  });
  const input = screen.getByTestId('mibi-slicer-input');
  fireEvent.change(input, { target: { value: 'North, South' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(dataMaskOf(store, filter.id).extraFormData).toEqual({
    filters: [{ col: 'region', op: 'IN', val: ['North', 'South'] }],
  });
});

test('applying the same text again does not filter again', async () => {
  const { store } = await renderSlicer({ variant: 'input' });
  const input = screen.getByTestId('mibi-slicer-input');
  fireEvent.change(input, { target: { value: 'nor' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  const first = dataMaskOf(store, filter.id);
  fireEvent.blur(input);
  expect(dataMaskOf(store, filter.id)).toBe(first);
});

test('a filter of one value keeps one whatever the slicer says', async () => {
  const single = {
    ...filter,
    controlValues: { multiSelect: false },
  } as unknown as Filter;
  (requestChartDataResolved as jest.Mock).mockResolvedValue([
    { data: [{ region: 'North' }, { region: 'South' }] },
  ]);
  render(
    <SlicerView
      filter={single}
      config={{ kind: 'filter', variant: 'list', selection: 'multi' }}
    />,
    { useRedux: true, initialState: state },
  );
  fireEvent.click(await screen.findByRole('button', { name: 'North' }));
  fireEvent.click(screen.getByRole('button', { name: 'South' }));
  expect(
    await screen.findByRole('button', { name: 'North', pressed: false }),
  ).toBeInTheDocument();
});

test('values left out are not listed nor chosen by select all', async () => {
  const { store } = await renderSlicer({
    variant: 'list',
    hiddenValues: ['South'],
    showSelectAll: true,
  });
  await screen.findByRole('button', { name: 'North' });
  expect(
    screen.queryByRole('button', { name: 'South' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByTestId('mibi-slicer-all'));
  expect(dataMaskOf(store, filter.id)?.filterState?.value).toEqual(['North']);
});

test('a numeric text slicer filters by whole numbers', async () => {
  const { store } = await renderSlicer({
    variant: 'input',
    inputNumeric: true,
  });
  const input = screen.getByTestId('mibi-slicer-input');
  fireEvent.change(input, { target: { value: '5, abc, 7' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(dataMaskOf(store, filter.id)?.extraFormData).toEqual({
    filters: [{ col: 'region', op: 'IN', val: [5, 7] }],
  });
});

test('the look sets corners and transparency', () => {
  expect(
    slicerStyle({
      kind: 'filter',
      itemCorners: [1, 2, 3, 4],
      itemFill: '#ff0000',
      itemFillOpacity: 50,
    }),
  ).toEqual({
    '--mb-s-radius': '1px 2px 3px 4px',
    '--mb-s-fill': 'rgba(255, 0, 0, 0.5)',
  });
});
