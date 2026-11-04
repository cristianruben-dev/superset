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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { WorkspaceTrash } from './WorkspaceTrash';

const TRASH = 'glob:*/api/v1/workspace/3/trash/';

const item = (uuid: string, blocked_by: string | null = null) => ({
  id: 1,
  uuid,
  dashboard_title: `Tablero ${uuid}`,
  deleted_at_delta_humanized: 'hace 2 días',
  blocked_by,
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('shows nothing while the trash is empty', async () => {
  fetchMock.get(TRASH, { result: [] });
  render(<WorkspaceTrash workspaceId={3} onRestored={jest.fn()} />, {
    useRedux: true,
  });

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(TRASH)).toHaveLength(1),
  );
  expect(screen.queryByTestId('workspace-trash')).not.toBeInTheDocument();
});

test('restores a deleted dashboard and tells the page', async () => {
  fetchMock.get(TRASH, { result: [item('a')] });
  fetchMock.post('glob:*/api/v1/dashboard/a/restore', { message: 'OK' });
  const onRestored = jest.fn();
  render(<WorkspaceTrash workspaceId={3} onRestored={onRestored} />, {
    useRedux: true,
  });

  userEvent.click(await screen.findByTestId('workspace-trash-restore'));

  await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/dashboard/a/restore'),
  ).toHaveLength(1);
});

test('explains why a dashboard whose charts moved cannot be restored', async () => {
  fetchMock.get(TRASH, {
    result: [item('b', '"Ventas" is now in "Resumen"')],
  });
  render(<WorkspaceTrash workspaceId={3} onRestored={jest.fn()} />, {
    useRedux: true,
  });

  expect(
    await screen.findByText(/"Ventas" is now in "Resumen"/),
  ).toBeInTheDocument();
  expect(screen.getByTestId('workspace-trash-restore')).toBeDisabled();
});
