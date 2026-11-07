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
import AssistantSettingsPage from './AssistantSettingsPage';

const SETTINGS = 'glob:*/api/v1/auradata_assistant/settings/';
const REFRESH = 'glob:*/api/v1/auradata_assistant/settings/?refresh=true';

const sonnet = {
  id: 'claude-sonnet-5-5',
  display_name: 'Claude Sonnet 5.5',
  status: 'current',
  known: true,
  offered: true,
  input_price: 2,
  output_price: 10,
};
const haiku = {
  ...sonnet,
  id: 'claude-haiku-5-5',
  display_name: 'Claude Haiku 5.5',
  input_price: 0.1,
  output_price: 0.5,
};
const unknown = {
  ...sonnet,
  id: 'claude-new',
  display_name: 'Claude New',
  status: 'available',
  known: false,
  offered: false,
  input_price: 10,
  output_price: 50,
};

const settings = {
  enabled: false,
  edit_enabled: true,
  effort: null,
  thinking: true,
  default_model: 'claude-sonnet-5-5',
  allowed_models: null,
  monthly_budget_usd: null,
  has_api_key: true,
  models: [haiku, sonnet, unknown],
  models_source: 'live',
  models_problem: null,
};

const renderPage = async () => {
  render(<AssistantSettingsPage />, { useRedux: true });
  await screen.findByText('Availability');
};

const saveButton = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('shows the live models with their prices', async () => {
  fetchMock.get(SETTINGS, { result: settings });

  await renderPage();

  expect(
    screen.getByRole('checkbox', { name: 'Claude Sonnet 5.5' }),
  ).toBeChecked();
  expect(screen.getByText('$2.00 / $10.00')).toBeInTheDocument();
  expect(screen.queryByTestId('assistant-models-problem')).toBeNull();
  expect(saveButton()).toBeDisabled();
});

test('says why the list is not the live one', async () => {
  fetchMock.get(SETTINGS, {
    result: {
      ...settings,
      has_api_key: false,
      models_source: 'table',
      models_problem: 'no_api_key',
    },
  });

  await renderPage();

  expect(screen.getByTestId('assistant-models-problem')).toHaveTextContent(
    'ANTHROPIC_API_KEY',
  );
});

test('notes the models it does not know', async () => {
  fetchMock.get(SETTINGS, { result: settings });

  await renderPage();

  expect(screen.getByText(/does not know this model yet/)).toBeInTheDocument();
});

test('starts from the offered models and saves the changes', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.put(SETTINGS, {
    result: {
      ...settings,
      enabled: true,
      allowed_models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-new'],
    },
  });

  await renderPage();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Claude New' }));
  await userEvent.click(
    screen.getByRole('switch', { name: 'Turn on the assistant' }),
  );
  await userEvent.click(saveButton());

  await waitFor(() =>
    expect(fetchMock.callHistory.called(SETTINGS)).toBe(true),
  );
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(SETTINGS, { method: 'PUT' }),
    ).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls(SETTINGS, { method: 'PUT' });
  expect(JSON.parse(call.options.body as string)).toEqual({
    edit_enabled: true,
    effort: null,
    thinking: true,
    enabled: true,
    default_model: 'claude-sonnet-5-5',
    allowed_models: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-new'],
    monthly_budget_usd: null,
  });
  await waitFor(() => expect(saveButton()).toBeDisabled());
});

test('dropping the default model moves the default to another allowed one', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.put(SETTINGS, { result: settings });

  await renderPage();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Claude Sonnet 5.5' }),
  );
  await userEvent.click(saveButton());

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls(SETTINGS, { method: 'PUT' }),
    ).toHaveLength(1),
  );
  const [call] = fetchMock.callHistory.calls(SETTINGS, { method: 'PUT' });
  const body = JSON.parse(call.options.body as string);
  expect(body.allowed_models).toEqual(['claude-haiku-5-5']);
  expect(body.default_model).toBe('claude-haiku-5-5');
});

test('needs at least one model to save', async () => {
  fetchMock.get(SETTINGS, {
    result: { ...settings, allowed_models: ['claude-sonnet-5-5'] },
  });

  await renderPage();
  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Claude Sonnet 5.5' }),
  );

  expect(saveButton()).toBeDisabled();
});

test('refreshes the list from Anthropic and keeps the changes in progress', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.get(REFRESH, {
    result: {
      ...settings,
      models: [
        ...settings.models,
        { ...unknown, id: 'claude-newer', display_name: 'Claude Newer' },
      ],
    },
  });

  await renderPage();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Claude New' }));
  await userEvent.click(screen.getByRole('button', { name: /Refresh list/ }));

  expect(await screen.findByText('Claude Newer')).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Claude New' })).toBeChecked();
});

test('tells when the settings cannot be loaded', async () => {
  fetchMock.get(SETTINGS, 500);

  render(<AssistantSettingsPage />, { useRedux: true });

  expect(
    await screen.findByText('The settings could not be loaded.'),
  ).toBeInTheDocument();
});

test('the copilot has a switch of its own', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.put(SETTINGS, { result: { ...settings, edit_enabled: false } });

  await renderPage();
  await userEvent.click(
    screen.getByRole('switch', { name: 'Let it change reports' }),
  );
  await userEvent.click(saveButton());

  await waitFor(() =>
    expect(
      JSON.parse(
        fetchMock.callHistory.lastCall(SETTINGS, { method: 'PUT' })?.options
          ?.body as string,
      ).edit_enabled,
    ).toBe(false),
  );
});

test('thinking is saved with the rest of the settings', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.put(SETTINGS, { result: { ...settings, thinking: false } });

  await renderPage();
  await userEvent.click(
    screen.getByRole('switch', { name: 'Let the model think' }),
  );
  await userEvent.click(saveButton());

  await waitFor(() =>
    expect(
      JSON.parse(
        fetchMock.callHistory.lastCall(SETTINGS, { method: 'PUT' })?.options
          ?.body as string,
      ),
    ).toMatchObject({ thinking: false, effort: null }),
  );
});

test('the usage is a tab of the page', async () => {
  fetchMock.get(SETTINGS, { result: settings });
  fetchMock.get('glob:*/api/v1/auradata_assistant/usage/', {
    result: {
      month: '2026-11',
      total_usd: 1,
      monthly_budget_usd: null,
      months: [],
      by_model: [],
      by_workspace: [],
      by_user: [],
    },
  });

  await renderPage();
  await userEvent.click(screen.getByRole('tab', { name: 'Usage' }));

  expect(await screen.findByTestId('assistant-usage')).toBeInTheDocument();
});
