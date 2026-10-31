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

import type { Page } from '@playwright/test';
import { test, expect } from '../../../helpers/fixtures/testAssets';
import {
  apiPostDashboard,
  apiPutDashboard,
} from '../../../helpers/api/dashboard';
import { TIMEOUT } from '../../../utils/constants';

/**
 * Stress tests: screens must survive extreme text (very long words, HTML,
 * emoji, right-to-left scripts) without widening the page or running
 * anything a user typed.
 */

const LONG_WORD = 'Supercalifragilisticoespialidoso'.repeat(12);
const HTML =
  '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
const WORLD = '📊🚀 Ñandú 日本語 עברית العربية';

async function expectSturdy(page: Page) {
  const state = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    xss: (window as unknown as { __xss?: number }).__xss ?? 0,
  }));
  expect(state.xss).toBe(0);
  expect(state.overflow).toBeLessThanOrEqual(1);
}

async function csrf(page: Page) {
  await page.goto('superset/welcome/');
  return page.evaluate(
    async () =>
      (await (await fetch('/api/v1/security/csrf_token/')).json()).result,
  );
}

test('a workspace with an extreme name and description stays readable', async ({
  page,
}) => {
  const token = await csrf(page);
  const created = await page.request.post('api/v1/workspace/', {
    headers: { 'X-CSRFToken': token, Referer: page.url() },
    data: {
      name: `${LONG_WORD}`.slice(0, 250),
      description: `${HTML} ${WORLD} ${'Lorem ipsum '.repeat(70)}`.slice(
        0,
        1000,
      ),
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()).result;
  try {
    await page.goto(`workspace/${id}/`);
    await expect(page.getByTestId('workspace-page')).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expectSturdy(page);
    await page.goto('workspace/list/');
    await expect(page.getByText(LONG_WORD.slice(0, 20)).first()).toBeVisible({
      timeout: TIMEOUT.PAGE_LOAD,
    });
    await expectSturdy(page);
  } finally {
    await page.request.delete(`api/v1/workspace/${id}/`, {
      headers: { 'X-CSRFToken': token, Referer: page.url() },
    });
  }
});

test('a dashboard with extreme titles, tabs and elements stays inside the screen', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(90_000);
  const created = await apiPostDashboard(page, {
    dashboard_title: `${LONG_WORD} ${WORLD}`.slice(0, 500),
  });
  expect(created.ok()).toBe(true);
  const body = await created.json();
  const id = body.result?.id ?? body.id;
  testAssets.trackDashboard(id);

  const tab = (tabId: string, title: string, children: string[] = []) => ({
    type: 'TAB',
    id: tabId,
    children,
    parents: ['ROOT_ID', 'TABS-x'],
    meta: { text: title, defaultText: 'Tab' },
  });
  const element = (elementId: string, meta: Record<string, unknown>) => ({
    type: 'DYNAMIC',
    id: elementId,
    children: [],
    parents: ['ROOT_ID', 'TABS-x', 'TAB-a', 'ROW-a'],
    meta,
  });
  const positions = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['TABS-x'] },
    'TABS-x': {
      type: 'TABS',
      id: 'TABS-x',
      children: ['TAB-a', 'TAB-b'],
      parents: ['ROOT_ID'],
      meta: {},
    },
    'TAB-a': tab('TAB-a', LONG_WORD, ['ROW-a']),
    'TAB-b': tab('TAB-b', HTML),
    'ROW-a': {
      type: 'ROW',
      id: 'ROW-a',
      children: ['DYNAMIC-text', 'DYNAMIC-button', 'DYNAMIC-shape'],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-a'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'DYNAMIC-text': element('DYNAMIC-text', {
      componentKey: 'mibi-text',
      width: 4,
      height: 20,
      mibiElement: { kind: 'text', html: `<h1>${LONG_WORD}</h1>${HTML}` },
    }),
    'DYNAMIC-button': element('DYNAMIC-button', {
      componentKey: 'mibi-button',
      width: 4,
      height: 7,
      mibiElement: {
        kind: 'button',
        label: LONG_WORD,
        iconPosition: 'only',
        icon: 'NotAnIcon',
        tooltip: HTML,
      },
    }),
    'DYNAMIC-shape': element('DYNAMIC-shape', {
      componentKey: 'mibi-shape',
      width: 4,
      height: 20,
      mibiElement: {
        kind: 'shape',
        shape: 'star',
        text: `${LONG_WORD} ${WORLD}`,
      },
    }),
  };
  const saved = await apiPutDashboard(page, id, {
    json_metadata: JSON.stringify({ positions }),
  });
  expect(saved.ok()).toBe(true);

  await page.goto(`superset/dashboard/${id}/`);
  await expect(page.getByTestId('mibi-button')).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
  await expectSturdy(page);
  await expect(page.getByText('Supercalifragilistico').first()).toBeVisible();
  await page.getByRole('tab').nth(1).click();
  await expectSturdy(page);
});
