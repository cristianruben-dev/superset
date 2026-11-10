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
import rison from 'rison';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { MemoryRouter } from 'react-router-dom';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ActionLogList from '.';

const LOG = 'glob:*/api/v1/log/?*';
const INFO = 'glob:*/api/v1/log/_info*';

const row = {
  action: 'assistant_tool_call',
  dttm: '2026-11-05T10:00:00',
  json: '{"tool": "add_page", "model": "claude-sonnet-5-5"}',
  user: { username: 'ana' },
};

const lastQuery = () => {
  const { url } = fetchMock.callHistory.lastCall(LOG) as { url: string };
  return rison.decode(new URL(url).searchParams.get('q') as string) as {
    filters?: { col: string; opr: string; value: unknown }[];
  };
};

const setup = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <ActionLogList />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true },
  );

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(INFO, { permissions: ['can_read'] });
  fetchMock.get(LOG, { result: [row], count: 1 });
});

test('a call of the assistant says so, with its model', async () => {
  setup();

  expect(
    await screen.findByText('Done by the assistant (claude-sonnet-5-5)'),
  ).toBeInTheDocument();
});

test('the log can be narrowed to what the assistant did', async () => {
  setup();
  await screen.findByText('Done by the assistant (claude-sonnet-5-5)');

  await userEvent.click(screen.getByRole('button', { name: 'Done by' }));
  await userEvent.click(await screen.findByText('The assistant'));

  await waitFor(() =>
    expect(lastQuery().filters).toContainEqual({
      col: 'action',
      opr: 'eq',
      value: 'assistant_tool_call',
    }),
  );
});

test('renders action log table headers and content', async () => {
  setup();

  expect(await screen.findByText('Action')).toBeInTheDocument();
  expect(screen.getByText('User')).toBeInTheDocument();
  expect(screen.getByText('Duration Ms')).toBeInTheDocument();
  expect(screen.getByText('Dashboard Id')).toBeInTheDocument();
  expect(screen.getByText('Slice Id')).toBeInTheDocument();
  expect(screen.getByText('JSON')).toBeInTheDocument();
  expect(screen.getByText('Referrer')).toBeInTheDocument();
  expect(screen.getByText('Dttm')).toBeInTheDocument();
});
