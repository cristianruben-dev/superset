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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { linkDatasetToDashboard, type WorkspaceDataset } from './api';
import { WorkspaceDatasets } from './WorkspaceDatasets';

const dataset = (id: number, name: string): WorkspaceDataset => ({
  id,
  table_name: name,
  schema: 'public',
  database_name: 'ventas_db',
  kind: 'physical',
  changed_on_delta_humanized: 'hace 1 hora',
  can_edit: true,
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('a dataset made in a dashboard joins its workspace', async () => {
  fetchMock.get('glob:*/api/v1/workspace/of_dashboard/7/', {
    result: { id: 3, name: 'Ventas' },
  });
  fetchMock.put('glob:*/api/v1/workspace/3/datasets/', { result: {} });

  await linkDatasetToDashboard(12, 7);

  const [call] = fetchMock.callHistory.calls(
    'glob:*/api/v1/workspace/3/datasets/',
  );
  expect(JSON.parse(call.options.body as string)).toEqual({ add: [12] });
});

test('datasets of dashboards outside workspaces stay shared', async () => {
  fetchMock.get('glob:*/api/v1/workspace/of_dashboard/7/', { result: null });

  await linkDatasetToDashboard(12, 7);
  await linkDatasetToDashboard(12, undefined);

  expect(fetchMock.callHistory.calls(/datasets/)).toHaveLength(0);
});

test('lists the datasets of a workspace and shares them', () => {
  const onShare = jest.fn();
  render(
    <WorkspaceDatasets
      datasets={[dataset(1, 'ventas'), dataset(2, 'clientes')]}
      canContribute
      onShare={onShare}
    />,
    { useRouter: true },
  );

  expect(screen.getAllByTestId('workspace-dataset')).toHaveLength(2);
  expect(screen.getByRole('link', { name: /ventas/ })).toHaveAttribute(
    'href',
    '/data/dataset/1/',
  );
  userEvent.click(
    screen.getAllByRole('button', { name: 'Share with every workspace' })[1],
  );
  expect(onShare).toHaveBeenCalledWith(dataset(2, 'clientes'));
});

test('viewers see the datasets without sharing them', () => {
  render(
    <WorkspaceDatasets
      datasets={[dataset(1, 'ventas')]}
      canContribute={false}
      onShare={jest.fn()}
    />,
    { useRouter: true },
  );

  expect(
    screen.queryByRole('button', { name: 'Share with every workspace' }),
  ).not.toBeInTheDocument();
});
