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
import { WorkspaceAssistantModal } from './WorkspaceAssistantModal';

const URL = 'glob:*/api/v1/auradata_assistant/workspace/7/';

const settings = {
  enabled: true,
  edit_enabled: true,
  monthly_budget_usd: 20,
  spent_usd: 4.5,
  global_enabled: true,
  global_edit_enabled: true,
};

const setup = () => {
  const onHide = jest.fn();
  render(<WorkspaceAssistantModal workspaceId={7} show onHide={onHide} />, {
    useRedux: true,
  });
  return onHide;
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('it shows the month of the workspace and saves its switches', async () => {
  fetchMock.get(URL, { result: settings });
  fetchMock.put(URL, { result: settings });
  const onHide = setup();

  expect(await screen.findByText('$4.50')).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('switch', { name: 'Let it change reports' }),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(onHide).toHaveBeenCalled());
  expect(
    JSON.parse(fetchMock.callHistory.lastCall(URL)?.options?.body as string),
  ).toEqual({ enabled: true, edit_enabled: false, monthly_budget_usd: 20 });
});

test('what the platform turned off shows off and cannot be turned on', async () => {
  fetchMock.get(URL, {
    result: { ...settings, global_enabled: false, global_edit_enabled: false },
  });
  setup();

  const assistant = await screen.findByRole('switch', {
    name: 'Turn on the assistant',
  });
  expect(assistant).not.toBeChecked();
  expect(assistant).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Let it change reports' }),
  ).toBeDisabled();
});
