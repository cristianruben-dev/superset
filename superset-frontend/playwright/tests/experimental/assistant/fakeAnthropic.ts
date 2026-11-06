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

import { createServer, type Server } from 'node:http';
import { test as base, expect, type Page } from '@playwright/test';
import { apiDelete, apiGet, apiPost } from '../../../helpers/api/requests';

/**
 * Simulates Anthropic and nothing else: the browser, the web server, Redis, the worker,
 * the tools and the database are real. The worker reaches this server on the host,
 * because the SDK reads `ANTHROPIC_BASE_URL`. Only the turn of a worker started with
 * that variable comes here, so `scripts/auradata/assistant_fake_worker.sh start` goes
 * first: it also takes the queue from the normal worker, which would call the real API.
 * It costs nothing. Its usage is simulated and stays in the usage of the month, as cents.
 */

const PORT = Number(process.env.AURADATA_FAKE_ANTHROPIC_PORT ?? 9933);

/** What the assistant needs of a report: dataset 41 is literal values, nothing real. */
export const REPORT = Number(process.env.AURADATA_ASSISTANT_DASHBOARD ?? 147);
export const DATASET = 41;

const CHAT = 'api/v1/auradata/assistant/';

type Block =
  | { type: 'text'; text: string }
  | {
      type: 'tool_use';
      id: string;
      name: string;
      input: Record<string, unknown>;
    };

export type Reply = {
  content: Block[];
  stop_reason?: string;
  /** Milliseconds between one piece of text and the next. */
  pace?: number;
  /** What the model says it read from the cache: a tenth of the price of the rest. */
  cached_tokens?: number;
  /** Refuse the request as the API does with one that does not fit. */
  too_long?: boolean;
};

/** What the API answers to a request that does not fit. */
export const TOO_LONG = 'prompt is too long: 1000001 tokens > 1000000 maximum';

export const say = (text: string, pace?: number): Reply => ({
  content: [{ type: 'text', text }],
  pace,
});

let calls = 0;
export const call = (name: string, request: Record<string, unknown>): Reply => {
  calls += 1;
  return {
    content: [
      {
        type: 'tool_use',
        id: `toolu_fake${calls}`,
        name,
        input: { request },
      },
    ],
    stop_reason: 'tool_use',
  };
};

/** A reply that depends on what the model was told, such as the id of a document. */
export type Scripted = (request: Record<string, unknown>) => Reply;

export class FakeAnthropic {
  readonly requests: Record<string, unknown>[] = [];

  private replies: (Reply | Scripted)[] = [];

  private server?: Server;

  /** What the next calls of the model answer, in order. */
  script(...replies: (Reply | Scripted)[]): void {
    this.replies.push(...replies);
  }

  private async write(
    write: (event: string, data: Record<string, unknown>) => void,
    model: string,
    reply: Reply,
  ): Promise<void> {
    write('message_start', {
      type: 'message_start',
      message: {
        id: `msg_fake${this.requests.length}`,
        type: 'message',
        role: 'assistant',
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 1,
          cache_read_input_tokens: reply.cached_tokens ?? 0,
        },
      },
    });
    for (const [index, block] of reply.content.entries()) {
      if (block.type === 'text') {
        write('content_block_start', {
          type: 'content_block_start',
          index,
          content_block: { type: 'text', text: '' },
        });
        for (const word of block.text.split(/(?<= )/)) {
          write('content_block_delta', {
            type: 'content_block_delta',
            index,
            delta: { type: 'text_delta', text: word },
          });
          if (reply.pace) {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => {
              setTimeout(resolve, reply.pace);
            });
          }
        }
      } else {
        write('content_block_start', {
          type: 'content_block_start',
          index,
          content_block: { ...block, input: {} },
        });
        write('content_block_delta', {
          type: 'content_block_delta',
          index,
          delta: {
            type: 'input_json_delta',
            partial_json: JSON.stringify(block.input),
          },
        });
      }
      write('content_block_stop', { type: 'content_block_stop', index });
    }
    write('message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: reply.stop_reason ?? 'end_turn',
        stop_sequence: null,
      },
      usage: { output_tokens: 20 },
    });
    write('message_stop', { type: 'message_stop' });
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      if (request.method !== 'POST') {
        // The list of models: without it, the app uses its own table
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            type: 'error',
            error: { type: 'not_found_error', message: 'Not simulated' },
          }),
        );
        return;
      }
      const chunks: Buffer[] = [];
      request.on('data', chunk => chunks.push(chunk));
      request.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        const next = this.replies.shift();
        const reply = typeof next === 'function' ? next(body) : next;
        this.requests.push(body);
        if (!reply || reply.too_long) {
          const [status, type, message] = reply
            ? [400, 'invalid_request_error', TOO_LONG]
            : [500, 'api_error', 'No reply was scripted'];
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(
            JSON.stringify({ type: 'error', error: { type, message } }),
          );
          return;
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const write = (event: string, data: Record<string, unknown>) =>
          response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        this.write(write, body.model, reply).finally(() => response.end());
      });
    });
    await new Promise<void>(resolve => {
      this.server?.listen(PORT, '0.0.0.0', resolve);
    });
  }

  async stop(): Promise<void> {
    await new Promise(resolve => {
      this.server?.close(resolve);
      this.server?.closeAllConnections();
    });
  }
}

/** The conversations a test leaves are deleted with it. */
async function deleteConversations(
  page: Page,
  dashboards: number[],
): Promise<void> {
  for (const dashboard of dashboards) {
    // eslint-disable-next-line no-await-in-loop
    const response = await apiGet(
      page,
      `${CHAT}conversations/?dashboard_id=${dashboard}`,
    );
    // eslint-disable-next-line no-await-in-loop
    const { result } = await response.json();
    for (const { id } of result) {
      // eslint-disable-next-line no-await-in-loop
      await apiDelete(page, `${CHAT}conversations/${id}/`, {
        failOnStatusCode: false,
      });
    }
  }
}

export const test = base.extend<
  { dashboards: number[]; workspaces: number[] },
  { anthropic: FakeAnthropic }
>({
  anthropic: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const anthropic = new FakeAnthropic();
      await anthropic.start();
      await use(anthropic);
      await anthropic.stop();
    },
    { scope: 'worker' },
  ],
  workspaces: async ({ page }, use) => {
    const workspaces: number[] = [];
    await use(workspaces);
    for (const id of workspaces) {
      // eslint-disable-next-line no-await-in-loop
      await apiDelete(page, `api/v1/workspace/${id}/`, {
        failOnStatusCode: false,
      });
    }
  },
  /** The reports of a test, whose conversations go with it. All but the first too. */
  dashboards: [
    async ({ page, anthropic, workspaces: _workspaces }, use) => {
      const dashboards = [REPORT];
      anthropic.requests.length = 0;
      await page.addInitScript(() => {
        // The app treats `navigator.webdriver` as a bot and changes what it draws
        Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
          get: () => false,
        });
      });
      await use(dashboards);
      await deleteConversations(page, dashboards);
      for (const id of dashboards.slice(1)) {
        // eslint-disable-next-line no-await-in-loop
        await apiDelete(page, `api/v1/dashboard/${id}`, {
          failOnStatusCode: false,
        });
      }
    },
    { auto: true },
  ],
});

test.use({
  headless: true,
  viewport: { width: 1600, height: 1000 },
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
});

export { expect };

/** A copy of a report to change. A test adds it to `dashboards` to delete it after. */
export async function copyReport(page: Page, title: string): Promise<number> {
  const source = await apiGet(page, `api/v1/dashboard/${REPORT}`);
  const { position_json: positions } = (await source.json()).result;
  const response = await apiPost(page, `api/v1/dashboard/${REPORT}/copy/`, {
    dashboard_title: title,
    json_metadata: JSON.stringify({ positions: JSON.parse(positions) }),
    duplicate_slices: true,
  });
  const { result } = await response.json();
  return result.id;
}

/** Opens the panel on a report, past the privacy notice. */
export async function openPanel(page: Page, dashboard = REPORT): Promise<void> {
  await page.goto(`dashboard/${dashboard}/`);
  await page.getByTestId('auradata-assistant-button').click();
  await acceptPrivacy(page);
  await expect(page.getByTestId('auradata-assistant-input')).toBeVisible();
}

/** The panel after a reload: the tab remembers whether it was open. */
export async function panelAfterReload(page: Page): Promise<void> {
  const button = page.getByTestId('auradata-assistant-button');
  await expect(button).toBeVisible();
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(1000);
  if (!(await page.getByTestId('auradata-assistant-input').isVisible())) {
    await button.click();
  }
  await expect(page.getByTestId('auradata-assistant-input')).toBeVisible();
}

export async function acceptPrivacy(page: Page): Promise<void> {
  const panel = page.getByTestId('auradata-assistant-panel');
  await expect(panel).toBeVisible();
  const accept = page.getByTestId('auradata-assistant-accept');
  await expect(
    accept.or(page.getByTestId('auradata-assistant-input')),
  ).toBeVisible();
  if (await accept.isVisible()) {
    await accept.click();
  }
}

export async function ask(page: Page, message: string): Promise<void> {
  await page.getByTestId('auradata-assistant-input').fill(message);
  await page.getByTestId('auradata-assistant-send').click();
}

/** The block of a document as a data block of dataset 41. */
export const salesQuery = (columns: string[] = []) => ({
  dataset_id: DATASET,
  columns,
  aggregates: [{ column: 'ventas', aggregate: 'SUM', label: 'Ventas' }],
});

/** What the model read last: the text of the last message of the last request. */
export const lastMessageOf = (request: Record<string, unknown>) =>
  (request.messages as { content: Record<string, unknown>[] }[]).at(-1)
    ?.content ?? [];
