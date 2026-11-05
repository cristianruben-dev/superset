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
import { render, screen, selectOption } from 'spec/helpers/testing-library';
import { AssistantUsage } from './AssistantUsage';

const USAGE = 'glob:*/api/v1/auradata_assistant/usage/*';

const report = (month: string, total: number) => ({
  month,
  total_usd: total,
  monthly_budget_usd: 100,
  months: [
    { month: '2026-11', cost_usd: 42.5 },
    { month: '2026-10', cost_usd: 3 },
  ],
  by_model: [
    { model: 'claude-sonnet-5-5', cost_usd: total, tokens: 1200, answers: 7 },
  ],
  by_workspace: [
    { workspace_id: 1, name: 'Ventas', cost_usd: 40, tokens: 900, answers: 5 },
    { workspace_id: null, name: null, cost_usd: 2.5, tokens: 300, answers: 2 },
  ],
  by_user: [{ user_id: null, name: null, cost_usd: 1, tokens: 3, answers: 1 }],
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('it breaks the month down and names what no longer exists', async () => {
  fetchMock.get(USAGE, { result: report('2026-11', 42.5) });

  render(<AssistantUsage />);

  expect(await screen.findByTestId('assistant-usage-total')).toHaveTextContent(
    '$42.50 / $100.00',
  );
  expect(screen.getByText('claude-sonnet-5-5')).toBeInTheDocument();
  expect(screen.getByText('Ventas')).toBeInTheDocument();
  expect(screen.getByText('No workspace')).toBeInTheDocument();
  expect(screen.getByText('Deleted user')).toBeInTheDocument();
  expect(screen.getAllByText('$40.00')[0].closest('td')).toHaveClass(
    'auradata-figure',
  );
});

test('choosing a month asks the server for it', async () => {
  fetchMock.get(USAGE, ({ url }) => ({
    result: url.includes('month=2026-10')
      ? report('2026-10', 3)
      : report('2026-11', 42.5),
  }));

  render(<AssistantUsage />);
  await screen.findByTestId('assistant-usage-total');

  await selectOption('2026-10 · $3.00', 'Month');

  expect(await screen.findByText('$3.00 / $100.00')).toBeInTheDocument();
});

test('a failure says so instead of showing zeros', async () => {
  fetchMock.get(USAGE, 500);

  render(<AssistantUsage />);

  expect(
    await screen.findByText('The usage could not be loaded.'),
  ).toBeInTheDocument();
});
