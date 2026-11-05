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
/** Placeholder shown in the client configs until a key is created. */
export const KEY_PLACEHOLDER = 'sst_…';

/** Name the MCP server takes in the AI client. */
const SERVER_NAME = 'auradata';

/** The address of the MCP service, or the app's own `/mcp` when none is set. */
export function mcpUrl(configured: string | null | undefined, origin: string) {
  return configured || `${origin.replace(/\/$/, '')}/mcp`;
}

/** The command that adds AuraData BI to Claude Code. */
export function claudeCodeCommand(url: string, key: string) {
  return `claude mcp add --transport http ${SERVER_NAME} ${url} --header "Authorization: Bearer ${key}"`;
}

/**
 * The `mcpServers` entry of Claude Desktop (claude_desktop_config.json). Claude
 * Desktop starts local servers only, so `mcp-remote` relays to the service; the
 * header goes through an environment variable, which keeps its space out of
 * the arguments.
 */
export function claudeDesktopConfig(url: string, key: string) {
  return JSON.stringify(
    {
      mcpServers: {
        [SERVER_NAME]: {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            url,
            '--header',
            'Authorization:${AURADATA_AUTH}',
            ...(url.startsWith('http://') ? ['--allow-http'] : []),
          ],
          env: { AURADATA_AUTH: `Bearer ${key}` },
        },
      },
    },
    null,
    2,
  );
}
