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
import {
  claudeCodeCommand,
  claudeDesktopConfig,
  KEY_PLACEHOLDER,
  mcpUrl,
} from './clientConfig';

test('uses the configured address or the app with /mcp', () => {
  expect(mcpUrl('https://bi.example.com/mcp', 'https://x.test')).toBe(
    'https://bi.example.com/mcp',
  );
  expect(mcpUrl(null, 'https://bi.example.com/')).toBe(
    'https://bi.example.com/mcp',
  );
});

test('builds the Claude Code command with the key as a bearer header', () => {
  expect(claudeCodeCommand('https://bi.example.com/mcp', 'sst_abc')).toBe(
    'claude mcp add --transport http auradata https://bi.example.com/mcp --header "Authorization: Bearer sst_abc"',
  );
});

test('builds the Claude Desktop entry through mcp-remote', () => {
  const config = JSON.parse(
    claudeDesktopConfig('https://bi.example.com/mcp', KEY_PLACEHOLDER),
  );

  expect(config.mcpServers.auradata).toEqual({
    command: 'npx',
    args: [
      '-y',
      'mcp-remote',
      'https://bi.example.com/mcp',
      '--header',
      'Authorization:${AURADATA_AUTH}',
    ],
    env: { AURADATA_AUTH: 'Bearer sst_…' },
  });
});

test('lets mcp-remote reach a plain http address', () => {
  const config = JSON.parse(
    claudeDesktopConfig('http://localhost:5008/mcp', 'sst_abc'),
  );

  expect(config.mcpServers.auradata.args).toContain('--allow-http');
});
