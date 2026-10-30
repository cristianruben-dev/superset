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
import { Route } from 'react-router-dom';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import DataPage from './DataPage';
import DatasetPage, { genericType } from './DatasetPage';

jest.mock('src/features/databases/DatabaseModal', () => () => null);
jest.mock('src/features/databases/UploadDataModel', () => () => null);

const state = {
  user: {
    userId: 1,
    roles: {
      Admin: [
        ['can_write', 'Database'],
        ['can_write', 'Dataset'],
        ['can_upload', 'Database'],
      ],
    },
  },
  common: { conf: { CSV_EXTENSIONS: ['csv'], ALLOWED_EXTENSIONS: ['csv'] } },
};

const dataset = (id: number, name: string, database: number, kind = 'physical') => ({
  id,
  table_name: name,
  kind,
  schema: 'public',
  description: null,
  database: { id: database, database_name: database === 1 ? 'Ventas' : 'Finanzas' },
  changed_on_delta_humanized: '1 hour ago',
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('lists connections with their dataset count and filters by them', async () => {
  fetchMock.get('glob:*/api/v1/database/?q=*', {
    result: [
      { id: 1, database_name: 'Ventas', backend: 'postgresql', allow_file_upload: true, expose_in_sqllab: true, changed_on_delta_humanized: '' },
      { id: 2, database_name: 'Finanzas', backend: 'mysql', allow_file_upload: false, expose_in_sqllab: false, changed_on_delta_humanized: '' },
    ],
  });
  fetchMock.get('glob:*/api/v1/dataset/?q=*', {
    result: [
      dataset(1, 'orders', 1),
      dataset(2, 'by_region', 1, 'virtual'),
      dataset(3, 'ledger', 2),
    ],
  });

  render(<DataPage />, { useRedux: true, useRouter: true, initialState: state });

  const cards = await screen.findAllByTestId('data-connection');
  expect(cards).toHaveLength(2);
  expect(within(cards[0]).getByText('2 datasets')).toBeInTheDocument();
  expect(screen.getAllByTestId('data-dataset')).toHaveLength(3);

  fireEvent.click(cards[1]);
  expect(screen.getAllByTestId('data-dataset')).toHaveLength(1);
  expect(screen.getByText('ledger')).toBeInTheDocument();

  fireEvent.click(cards[1]);
  await userEvent.click(screen.getByRole('button', { name: 'SQL queries' }));
  expect(screen.getAllByTestId('data-dataset')).toHaveLength(1);
  expect(screen.getByText('by_region')).toBeInTheDocument();
});

test.each([
  [{ type: 'BIGINT' }, GenericDataType.Numeric],
  [{ type: 'NUMERIC(10,2)' }, GenericDataType.Numeric],
  [{ type: 'BOOLEAN' }, GenericDataType.Boolean],
  [{ type: 'TIMESTAMP' }, GenericDataType.Temporal],
  [{ type: 'VARCHAR', is_dttm: true }, GenericDataType.Temporal],
  [{ type: 'TEXT' }, GenericDataType.String],
  [{ type: '', expression: 'a + b' }, 'expression'],
])('reads %p as %p', (column, expected) => {
  expect(
    genericType({
      id: 1,
      column_name: 'c',
      filterable: true,
      groupby: true,
      is_active: true,
      is_dttm: false,
      ...column,
    }),
  ).toBe(expected);
});

const detail = {
  id: 5,
  table_name: 'orders',
  kind: 'physical',
  description: 'All orders',
  database: { id: 1, database_name: 'Ventas' },
  columns: [
    { id: 1, column_name: 'amount', type: 'NUMERIC', is_dttm: false, groupby: true, filterable: true, is_active: true, extra: null },
  ],
  metrics: [
    { id: 9, metric_name: 'count', expression: 'COUNT(*)', verbose_name: null, metric_type: 'count', uuid: 'u' },
  ],
  owners: [],
};

const renderDataset = () => {
  window.history.pushState({}, '', '/data/dataset/5/');
  return render(
    <Route path="/data/dataset/:datasetId/">
      <DatasetPage />
    </Route>,
    { useRedux: true, useRouter: true, initialState: state },
  );
};

test('creates a metric and keeps the existing ones', async () => {
  fetchMock.get('glob:*/api/v1/dataset/5', { result: detail });
  fetchMock.put('glob:*/api/v1/dataset/5', { result: {} });

  renderDataset();

  expect(await screen.findByRole('heading', { name: 'orders' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: /Metrics/ }));
  expect(screen.getAllByTestId('dataset-metric')).toHaveLength(1);

  await userEvent.click(screen.getAllByRole('button', { name: /New metric/ })[0]);
  await userEvent.type(screen.getByLabelText('Name'), 'revenue');
  await userEvent.type(screen.getByLabelText('SQL expression'), 'SUM(amount)');
  await userEvent.click(screen.getByRole('button', { name: 'Create' }));

  await waitFor(() =>
    expect(fetchMock.callHistory.called('glob:*/api/v1/dataset/5', { method: 'PUT' })).toBe(true),
  );
  const body = JSON.parse(
    fetchMock.callHistory.lastCall('glob:*/api/v1/dataset/5', { method: 'PUT' })
      ?.options.body as string,
  );
  expect(body.metrics).toEqual([
    {
      id: 9,
      metric_name: 'count',
      expression: 'COUNT(*)',
      verbose_name: null,
      description: null,
      d3format: null,
    },
    {
      metric_name: 'revenue',
      expression: 'SUM(amount)',
      verbose_name: null,
      description: null,
      d3format: null,
    },
  ]);
});

test('deleting a metric sends the others', async () => {
  fetchMock.get('glob:*/api/v1/dataset/5', { result: detail });
  fetchMock.put('glob:*/api/v1/dataset/5', { result: {} });

  renderDataset();
  await screen.findByRole('heading', { name: 'orders' });
  await userEvent.click(screen.getByRole('tab', { name: /Metrics/ }));
  await userEvent.click(screen.getByLabelText('Delete count'));

  await waitFor(() =>
    expect(fetchMock.callHistory.called('glob:*/api/v1/dataset/5', { method: 'PUT' })).toBe(true),
  );
  const body = JSON.parse(
    fetchMock.callHistory.lastCall('glob:*/api/v1/dataset/5', { method: 'PUT' })
      ?.options.body as string,
  );
  expect(body.metrics).toEqual([]);
});
