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
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import * as reload from 'src/mibi/dashboard/reloadSavedChart';
import { SortAxisButton } from './SortAxisButton';
import * as save from './saveChartSort';

jest.mock('./saveChartSort', () => ({
  saveChartSort: jest.fn(() => Promise.resolve()),
  undoChartSort: jest.fn(() => Promise.resolve()),
  canUndoChartSort: jest.fn(() => false),
}));

const CHART_ID = 10;

const state = (formData: object) => ({
  sliceEntities: {
    slices: {
      [CHART_ID]: {
        slice_id: CHART_ID,
        form_data: {
          datasource: '1__table',
          viz_type: 'echarts_timeseries_bar',
          x_axis: 'country',
          metrics: ['SUM(sales)'],
          groupby: [],
          ...formData,
        },
      },
    },
  },
  charts: {},
  datasources: {
    '1__table': {
      id: 1,
      type: 'table',
      columns: [
        { column_name: 'country', type_generic: GenericDataType.String },
        {
          column_name: 'ds',
          type_generic: GenericDataType.Temporal,
          is_dttm: true,
        },
      ],
      metrics: [],
      verbose_map: { country: 'País' },
    },
  },
});

const renderButton = (formData: object = {}) =>
  render(<SortAxisButton chartId={CHART_ID} />, {
    useRedux: true,
    initialState: state(formData),
  });

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Sort axis' }));
  return screen.findByTestId(`mibi-sort-menu-${CHART_ID}`);
};

/** The menu entries showing a check mark, among some labels. */
const checked = (menu: HTMLElement, labels: string[]) =>
  labels.filter(label =>
    within(menu)
      .getByText(label)
      .closest('li')
      ?.querySelector('[aria-label="check"]:not([aria-hidden="true"])'),
  );

/** Waits until the save started from the menu has finished. */
const settled = () =>
  waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sort axis' })).toBeEnabled(),
  );

let reloadSpy: jest.SpyInstance;

beforeEach(() => {
  reloadSpy = jest
    .spyOn(reload, 'reloadSavedChart')
    .mockReturnValue((() => Promise.resolve()) as never);
});

afterEach(() => {
  jest.clearAllMocks();
  reloadSpy.mockRestore();
});

test('is absent when the axis cannot be sorted', () => {
  renderButton({ x_axis: 'ds' });
  expect(
    screen.queryByRole('button', { name: 'Sort axis' }),
  ).not.toBeInTheDocument();
});

test('is absent for chart types without sorting', () => {
  renderButton({ viz_type: 'treemap_v2' });
  expect(
    screen.queryByRole('button', { name: 'Sort axis' }),
  ).not.toBeInTheDocument();
});

test('lists the directions and the fields, checking the saved sort', async () => {
  renderButton({ x_axis_sort: 'SUM(sales)', x_axis_sort_asc: false });
  const menu = await openMenu();
  expect(within(menu).getByText('Sort by')).toBeInTheDocument();
  expect(
    checked(menu, ['Sort descending', 'Sort ascending', 'País', 'SUM(sales)']),
  ).toEqual(['Sort descending', 'SUM(sales)']);
});

test('choosing a direction saves it on the chart and reloads it', async () => {
  renderButton({ x_axis_sort: 'SUM(sales)', x_axis_sort_asc: false });
  const menu = await openMenu();
  await userEvent.click(within(menu).getByText('Sort ascending'));

  await waitFor(() =>
    expect(save.saveChartSort).toHaveBeenCalledWith(CHART_ID, {
      x_axis_sort: 'SUM(sales)',
      x_axis_sort_asc: true,
    }),
  );
  await waitFor(() =>
    expect(reload.reloadSavedChart).toHaveBeenCalledWith(CHART_ID),
  );
  await settled();
});

test('choosing a field keeps the direction', async () => {
  renderButton({ x_axis_sort: 'SUM(sales)', x_axis_sort_asc: false });
  const menu = await openMenu();
  await userEvent.click(within(menu).getByText('País'));

  await waitFor(() =>
    expect(save.saveChartSort).toHaveBeenCalledWith(CHART_ID, {
      x_axis_sort: 'country',
      x_axis_sort_asc: false,
    }),
  );
  await settled();
});

test('a direction without a saved field sorts by the first field', async () => {
  renderButton();
  const menu = await openMenu();
  await userEvent.click(within(menu).getByText('Sort descending'));

  await waitFor(() =>
    expect(save.saveChartSort).toHaveBeenCalledWith(CHART_ID, {
      x_axis_sort: 'country',
      x_axis_sort_asc: false,
    }),
  );
  await settled();
});

test('offers undo after a sort was saved', async () => {
  jest.mocked(save.canUndoChartSort).mockReturnValue(true);
  renderButton({ x_axis_sort: 'country', x_axis_sort_asc: true });
  const menu = await openMenu();
  await userEvent.click(within(menu).getByText('Undo'));

  await waitFor(() =>
    expect(save.undoChartSort).toHaveBeenCalledWith(CHART_ID),
  );
  await settled();
});

test('a failed save shows an error and does not reload', async () => {
  jest.mocked(save.saveChartSort).mockRejectedValueOnce(new Error('403'));
  renderButton();
  const menu = await openMenu();
  await userEvent.click(within(menu).getByText('Sort ascending'));

  await waitFor(() => expect(save.saveChartSort).toHaveBeenCalled());
  expect(reload.reloadSavedChart).not.toHaveBeenCalled();
  await settled();
});
