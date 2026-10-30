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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import type { Workspace, WorkspaceMember } from './api';
import { WorkspaceAccessModal } from './WorkspaceAccessModal';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ common: { locale: 'en' }, user: { userId: 2 } }),
}));

const members: WorkspaceMember[] = [
  { id: 1, first_name: 'Ana', last_name: 'Ruiz', username: 'ana', role: 'admin' },
  { id: 2, first_name: 'Bea', last_name: 'Lopez', username: 'bea', role: 'viewer' },
];

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: 3,
  uuid: null,
  name: 'Sales',
  description: null,
  color: null,
  image_url: null,
  dashboard_ids: [],
  dashboard_count: 0,
  changed_on: null,
  created_by: null,
  role: 'admin',
  can_edit: true,
  can_contribute: true,
  member_count: 2,
  members,
  ...overrides,
});

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/workspace/3/members/', { result: members });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('admins change roles and see who can be added', async () => {
  render(
    <WorkspaceAccessModal
      show
      workspace={workspace()}
      onHide={jest.fn()}
      onChanged={jest.fn()}
    />,
    { useRedux: true },
  );

  const list = await screen.findByTestId('workspace-members');
  await waitFor(() => expect(within(list).getByText('Ana Ruiz')).toBeInTheDocument());
  expect(screen.getByText('Add people')).toBeInTheDocument();
  expect(screen.getAllByLabelText('Role of Bea Lopez').length).toBeGreaterThan(0);
  // The only admin cannot be demoted nor removed
  expect(screen.getByLabelText('Remove Ana Ruiz')).toBeDisabled();
});

test('other members only see the roles and can leave', async () => {
  fetchMock.delete('glob:*/api/v1/workspace/3/members/2/', { result: null });
  const onChanged = jest.fn();
  render(
    <WorkspaceAccessModal
      show
      workspace={workspace({ role: 'viewer', can_edit: false, can_contribute: false })}
      onHide={jest.fn()}
      onChanged={onChanged}
    />,
    { useRedux: true },
  );

  const list = await screen.findByTestId('workspace-members');
  await waitFor(() =>
    expect(within(list).getAllByTestId('workspace-role-badge')).toHaveLength(2),
  );
  expect(screen.queryByText('Add people')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Remove Ana Ruiz')).not.toBeInTheDocument();
  expect(screen.getByText('(you)')).toBeInTheDocument();

  screen.getByLabelText('Leave the workspace').click();

  await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
});
