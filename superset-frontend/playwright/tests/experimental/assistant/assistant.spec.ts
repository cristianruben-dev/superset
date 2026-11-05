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

import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The panel of each mode, with a simulated Anthropic: every route of the assistant
 * answers here, so nothing reaches the API and no key or migration is needed. The
 * report itself is real. The bundle must hold the assistant, so `npm run build` (or a
 * dev server) comes first:
 *
 *   INCLUDE_EXPERIMENTAL=1 PLAYWRIGHT_BASE_URL=http://localhost:8188 \
 *   PLAYWRIGHT_ADMIN_PASSWORD=admin node_modules/.bin/playwright test \
 *   tests/experimental/assistant/assistant.spec.ts --workers=1 --project=chromium
 *
 * AURADATA_ASSISTANT_DASHBOARD picks the report, 187 by default.
 */

const DASHBOARD = process.env.AURADATA_ASSISTANT_DASHBOARD ?? '187';
const CHAT = '**/api/v1/auradata/assistant/';
const CONVERSATION = '11111111-1111-4111-8111-111111111111';

const MODELS = {
  available: true,
  edit_available: true,
  // Without this the panel stays on the privacy notice
  privacy_accepted: true,
  budget: { level: 'ok', scope: null },
  models: [
    {
      id: 'claude-sonnet-5-5',
      name: 'Claude Sonnet 5.5',
      family: 'sonnet',
      price: 'balanced',
      default: true,
      tool_search: true,
      max_input_tokens: 1000000,
    },
  ],
};

const FIGURE = {
  dataset_id: 41,
  dataset_name: 'qa_referencia',
  metrics: ['count'],
  columns: ['region'],
  filters: [],
  order_by: [],
  order_desc: true,
  row_limit: 1000,
  rows: [{ region: 'Sur', count: 36 }],
  row_count: 1,
  from_dttm: null,
  to_dttm: null,
};

const DONE = {
  model: 'claude-sonnet-5-5',
  stop_reason: 'end_turn',
  input_tokens: 100,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  cost_usd: 0.0003,
  context_tokens: 100,
  budget: { level: 'ok', scope: null },
};

type Event = [string, Record<string, unknown>];

const stream = (route: Route, events: Event[]) =>
  route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: events
      .map(
        ([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      )
      .join(''),
  });

const conversationEvent = (mode: string): Event => [
  'conversation',
  { id: CONVERSATION, mode, model: 'claude-sonnet-5-5' },
];

/** The routes every test needs. What each turn says goes in its own test. */
async function simulateAssistant(page: Page): Promise<void> {
  await page.route('**/api/v1/auradata/assistant/models/**', route =>
    route.fulfill({ json: MODELS }),
  );
  await page.route('**/api/v1/auradata/assistant/conversations/?*', route =>
    route.fulfill({ json: { result: [] } }),
  );
}

test.use({
  headless: true,
  viewport: { width: 1600, height: 1000 },
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
});

test.beforeEach(async ({ page }) => {
  // The app treats `navigator.webdriver` as a bot and changes what it draws
  await page.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
      get: () => false,
    });
  });
  await simulateAssistant(page);
});

test('read mode answers with a figure and offers no way to change anything', async ({
  page,
}) => {
  const questions: Record<string, unknown>[] = [];
  await page.route(CHAT, route => {
    questions.push(route.request().postDataJSON());
    return stream(route, [
      conversationEvent('read'),
      ['tool_start', { id: 'toolu_1', name: 'query_dataset', changes: false }],
      [
        'tool_end',
        {
          id: 'toolu_1',
          name: 'query_dataset',
          is_error: false,
          changed: false,
          figure: FIGURE,
        },
      ],
      ['text', { text: 'La región Sur tiene **36** registros.' }],
      ['done', DONE],
    ]);
  });

  await page.goto(`dashboard/${DASHBOARD}/`);
  await page.getByTestId('auradata-assistant-button').click();
  const panel = page.getByTestId('auradata-assistant-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('auradata-assistant-privacy')).toHaveCount(0);

  await page
    .getByTestId('auradata-assistant-input')
    .fill('¿Cuántos registros?');
  await page.getByTestId('auradata-assistant-send').click();

  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    '36',
  );
  await expect(page.getByTestId('auradata-assistant-step')).toHaveCount(1);
  await expect(panel).toContainText('qa_referencia');
  expect(questions).toHaveLength(1);
  expect(questions[0]).toMatchObject({
    mode: 'read',
    context: { dashboard_id: Number(DASHBOARD) },
  });
  await expect(page.getByTestId('auradata-assistant-confirmation')).toHaveCount(
    0,
  );
  await expect(page.getByTestId('auradata-assistant-undo')).toHaveCount(0);
});

test('edit mode waits for the card, runs on approval and can be undone', async ({
  page,
}) => {
  const decisions: Record<string, unknown>[] = [];
  let undone = 0;
  await page.route(CHAT, route =>
    stream(route, [
      conversationEvent('edit'),
      ['text', { text: 'Voy a borrar la página.' }],
      [
        'confirm',
        {
          id: 'toolu_1',
          name: 'delete_page',
          title: 'Delete a report page',
          input: { request: { page: 'Nueva' } },
        },
      ],
      ['done', { ...DONE, stop_reason: 'tool_use' }],
    ]),
  );
  await page.route('**/conversations/*/decide/', route => {
    decisions.push(route.request().postDataJSON());
    return stream(route, [
      ['tool_start', { id: 'toolu_1', name: 'delete_page', changes: true }],
      [
        'tool_end',
        {
          id: 'toolu_1',
          name: 'delete_page',
          is_error: false,
          changed: true,
        },
      ],
      ['text', { text: 'Listo, la borré.' }],
      ['done', { ...DONE, can_undo: true }],
    ]);
  });
  await page.route('**/conversations/*/undo/', route => {
    undone += 1;
    return route.fulfill({
      json: { result: { skipped_charts: 0, can_undo: false } },
    });
  });

  await page.goto(`dashboard/${DASHBOARD}/`);
  await page.getByTestId('edit-dashboard-button').click();
  await page.getByRole('tab', { name: /Asistente|Assistant/ }).click();

  await page
    .getByTestId('auradata-assistant-input')
    .fill('Borra la página Nueva');
  await page.getByTestId('auradata-assistant-send').click();

  const card = page.getByTestId('auradata-assistant-confirmation');
  await expect(card).toBeVisible();
  expect(decisions).toHaveLength(0);

  await page.getByTestId('auradata-assistant-approve').click();

  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('Listo, la borré.');
  expect(decisions).toHaveLength(1);
  expect(decisions[0]).toMatchObject({
    tool_use_id: 'toolu_1',
    approved: true,
  });
  await expect(card).toHaveCount(0);

  await page.getByTestId('auradata-assistant-undo').click();
  await expect.poll(() => undone).toBe(1);
});
