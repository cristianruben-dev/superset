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
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { workspaceInitials, type Workspace } from './api';
import { WorkspaceModal } from './WorkspaceModal';
import WorkspaceListPage from './WorkspaceListPage';
import { DashboardWorkspaceChip } from './DashboardWorkspaceChip';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ common: { locale: 'en' }, user: {} }),
}));

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: 1,
  uuid: null,
  name: 'Sales',
  description: 'Weekly numbers',
  color: '#5B5BD6',
  image_url: null,
  dashboard_ids: [1, 2],
  dashboard_count: 2,
  changed_on: new Date().toISOString(),
  created_by: { id: 1, first_name: 'Ana', last_name: 'Ruiz' },
  role: 'admin',
  can_edit: true,
  can_contribute: true,
  member_count: 1,
  members: [{ id: 1, first_name: 'Ana', last_name: 'Ruiz', role: 'admin' }],
  ...overrides,
});

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/format_theme/', {
    result: [{ id: 4, name: 'Corporativo', can_edit: true, theme: {} }],
  });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('builds up to two initials', () => {
  expect(workspaceInitials('Sales')).toBe('SA');
  expect(workspaceInitials('marketing digital team')).toBe('MD');
  expect(workspaceInitials('  ')).toBe('?');
});

test('lists the workspaces as cards', async () => {
  fetchMock.get('glob:*/api/v1/workspace/', {
    result: [
      workspace(),
      workspace({ id: 2, name: 'Finance', description: null }),
    ],
  });

  render(<WorkspaceListPage />, { useRouter: true, useRedux: true });

  const cards = await screen.findAllByTestId('workspace-card');
  expect(cards).toHaveLength(2);
  expect(cards[0]).toHaveAttribute('href', '/workspace/1/');
  expect(screen.getByText('Weekly numbers')).toBeInTheDocument();
  expect(screen.getByText('No description')).toBeInTheDocument();
});

test('filters the workspaces by name and description', async () => {
  fetchMock.get('glob:*/api/v1/workspace/', {
    result: [
      workspace(),
      workspace({ id: 2, name: 'Finance', description: null }),
    ],
  });
  render(<WorkspaceListPage />, { useRouter: true, useRedux: true });
  await screen.findAllByTestId('workspace-card');

  await userEvent.type(screen.getByPlaceholderText('Search workspaces'), 'fin');

  expect(screen.getAllByTestId('workspace-card')).toHaveLength(1);
  expect(screen.getByText('Finance')).toBeInTheDocument();
});

test('invites to create the first workspace', async () => {
  fetchMock.get('glob:*/api/v1/workspace/', { result: [] });

  render(<WorkspaceListPage />, { useRouter: true, useRedux: true });

  expect(
    await screen.findByText('Create your first workspace'),
  ).toBeInTheDocument();
});

test('creates a workspace with its name, description and color', async () => {
  fetchMock.post('glob:*/api/v1/workspace/', {
    result: workspace({ id: 7, name: 'Ops' }),
  });
  const onSaved = jest.fn();

  render(<WorkspaceModal show onHide={jest.fn()} onSaved={onSaved} />, {
    useRedux: true,
  });

  const create = screen.getByRole('button', { name: 'Create' });
  expect(create).toBeDisabled();
  await userEvent.type(screen.getByLabelText('Name'), '  Ops ');
  await userEvent.type(
    screen.getByPlaceholderText('What is this workspace for?'),
    'Logistics',
  );
  fireEvent.click(screen.getAllByRole('radio')[3]);
  await userEvent.click(create);

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const body = JSON.parse(
    fetchMock.callHistory.lastCall('glob:*/api/v1/workspace/')?.options
      .body as string,
  );
  expect(body).toEqual({
    name: 'Ops',
    description: 'Logistics',
    color: '#14B8A6',
    format_theme_id: null,
  });
  expect(onSaved.mock.calls[0][0].id).toBe(7);
});

test('gives the workspace a theme and applies it to its dashboards', async () => {
  fetchMock.put('glob:*/api/v1/workspace/1/', {
    result: workspace({ format_theme_id: 4 }),
  });
  fetchMock.post('glob:*/api/v1/format_theme/4/apply/', { result: [1] });
  const onSaved = jest.fn();
  render(
    <WorkspaceModal
      show
      workspace={workspace()}
      onHide={jest.fn()}
      onSaved={onSaved}
    />,
    { useRedux: true },
  );

  expect(
    screen.queryByTestId('workspace-theme-apply-all'),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox', { name: 'Format theme' }));
  await userEvent.click(await screen.findByText('Corporativo'));
  await userEvent.click(
    screen.getByText('Also apply it to the 2 dashboards it has'),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  const put = fetchMock.callHistory.lastCall('glob:*/api/v1/workspace/1/');
  expect(JSON.parse(put?.options.body as string).format_theme_id).toBe(4);
  const apply = fetchMock.callHistory.lastCall(
    'glob:*/api/v1/format_theme/4/apply/',
  );
  expect(JSON.parse(apply?.options.body as string)).toEqual({
    dashboard_ids: [1, 2],
    reset_visuals: true,
  });
});

test('uploads the picture after saving the workspace', async () => {
  fetchMock.put('glob:*/api/v1/workspace/1/', { result: workspace() });
  fetchMock.put('glob:*/api/v1/workspace/1/image/', {
    result: workspace({ image_url: '/api/v1/workspace/1/image/?v=1' }),
  });
  const onSaved = jest.fn();
  render(
    <WorkspaceModal
      show
      workspace={workspace()}
      onHide={jest.fn()}
      onSaved={onSaved}
    />,
    { useRedux: true },
  );
  global.URL.createObjectURL = jest.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = jest.fn();

  const file = new File(['png'], 'logo.png', { type: 'image/png' });
  await userEvent.upload(screen.getByTestId('workspace-image-input'), file);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(onSaved.mock.calls[0][0].image_url).toBe(
      '/api/v1/workspace/1/image/?v=1',
    ),
  );
  expect(fetchMock.callHistory.called('glob:*/api/v1/workspace/1/image/')).toBe(
    true,
  );
});

test('rejects pictures that are not images', async () => {
  render(<WorkspaceModal show onHide={jest.fn()} onSaved={jest.fn()} />, {
    useRedux: true,
  });

  const file = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
  fireEvent.change(screen.getByTestId('workspace-image-input'), {
    target: { files: [file] },
  });

  expect(screen.queryByText('Remove picture')).not.toBeInTheDocument();
});

test('links a dashboard to its workspace', async () => {
  fetchMock.get('glob:*/api/v1/workspace/of_dashboard/3/', {
    result: { id: 1, name: 'Sales', color: '#5B5BD6', image_url: null },
  });

  render(<DashboardWorkspaceChip dashboardId={3} />, { useRouter: true });

  const chip = await screen.findByTestId('dashboard-workspace-chip');
  expect(chip).toHaveAttribute('href', '/workspace/1/');
  expect(chip).toHaveTextContent('Sales');
});

test('shows nothing for dashboards outside any workspace', async () => {
  fetchMock.get('glob:*/api/v1/workspace/of_dashboard/3/', { result: null });

  render(<DashboardWorkspaceChip dashboardId={3} />, { useRouter: true });

  await waitFor(() => expect(fetchMock.callHistory.called()).toBe(true));
  expect(
    screen.queryByTestId('dashboard-workspace-chip'),
  ).not.toBeInTheDocument();
});
