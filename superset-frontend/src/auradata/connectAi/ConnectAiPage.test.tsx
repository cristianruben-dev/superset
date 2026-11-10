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
import { FeatureFlag } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import type { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import ConnectAiPage from './ConnectAiPage';

const CONNECTION = 'glob:*/api/v1/auradata/mcp_connection/';
const KEYS = 'glob:*/api/v1/security/api_keys/';

const user = {
  username: 'ana',
  roles: {
    Gamma: [
      ['can_read', 'Dashboard'],
      ['can_write', 'Dashboard'],
      ['can_read', 'Chart'],
    ],
  },
} as unknown as UserWithPermissionsAndRoles;

let previousFlags: typeof window.featureFlags;

beforeEach(() => {
  previousFlags = window.featureFlags;
  window.featureFlags = {
    ...window.featureFlags,
    [FeatureFlag.FabApiKeyEnabled]: true,
  };
  fetchMock.get(KEYS, { result: [] });
});

afterEach(() => {
  window.featureFlags = previousFlags;
  fetchMock.clearHistory().removeRoutes();
});

test('explains that the AI acts as the user and shows the MCP address', async () => {
  fetchMock.get(CONNECTION, {
    result: { url: 'https://bi.example.com/mcp', api_keys_enabled: true },
  });
  render(<ConnectAiPage user={user} />, { useRedux: true, useRouter: true });

  expect(await screen.findByTestId('connect-ai-url')).toHaveTextContent(
    'https://bi.example.com/mcp',
  );
  expect(screen.getByText('Your AI works as you')).toBeInTheDocument();
  expect(screen.getByLabelText('Claude Code command')).toHaveTextContent(
    'claude mcp add --transport http auradata https://bi.example.com/mcp --header "Authorization: Bearer sst_…"',
  );
});

test('creates a read-only key with the scopes the user may grant', async () => {
  fetchMock.get(CONNECTION, {
    result: { url: null, api_keys_enabled: true },
  });
  render(<ConnectAiPage user={user} />, { useRedux: true, useRouter: true });

  userEvent.click(await screen.findByRole('button', { name: /New key/ }));

  expect(
    await screen.findByText('superset:dashboard:read'),
  ).toBeInTheDocument();
  expect(screen.getByText('superset:chart:read')).toBeInTheDocument();
  expect(
    screen.queryByText('superset:dashboard:write'),
  ).not.toBeInTheDocument();
});

test('says so when the MCP service takes no API keys', async () => {
  fetchMock.get(CONNECTION, {
    result: { url: null, api_keys_enabled: false },
  });
  render(<ConnectAiPage user={user} />, { useRedux: true, useRouter: true });

  expect(
    await screen.findByText('API keys are turned off'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('connect-ai-url')).not.toBeInTheDocument();
});

test('renders keys list inside the keys table wrapper', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(CONNECTION, {
    result: { url: 'https://bi.example.com/mcp', api_keys_enabled: true },
  });
  fetchMock.get(KEYS, {
    result: [
      {
        uuid: 'key-1',
        name: 'My Test Key',
        key_prefix: 'sst_test',
        active: true,
        created_on: '2026-11-09T00:00:00Z',
        expires_on: null,
        revoked_on: null,
        last_used_on: null,
        scopes: null,
      },
    ],
  });
  render(<ConnectAiPage user={user} />, { useRedux: true, useRouter: true });

  expect(await screen.findByText('Your keys')).toBeInTheDocument();
  expect(await screen.findByText('My Test Key')).toBeInTheDocument();
  expect(screen.getByText('sst_test...')).toBeInTheDocument();
});
