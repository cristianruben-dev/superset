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

import { readFileSync } from 'fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * Round trip of a report built only through the MCP: the editor opens what
 * the MCP wrote without converting it, every page draws its charts, the
 * slicer filters and the bookmark applies.
 *
 * The report comes from `scripts/auradata/mcp_scenario.py`; point
 * AURADATA_SCENARIO_SUMMARY at the `summary.json` it writes:
 *
 *   AURADATA_SCENARIO_SUMMARY=../tmp/mcp-scenario/<run>/summary.json \
 *   INCLUDE_EXPERIMENTAL=1 PLAYWRIGHT_BASE_URL=http://localhost:8188 \
 *   PLAYWRIGHT_ADMIN_PASSWORD=admin node_modules/.bin/playwright test \
 *   tests/experimental/mcp/report-roundtrip.spec.ts --workers=1
 */

interface ScenarioChart {
  chart_id: number;
  object: string;
  page: string;
  name: string;
}

interface ScenarioSummary {
  dashboard_id: number;
  pages: string[];
  charts: Record<string, ScenarioChart>;
  slicer: { filter_id: string; column: string; value: string; page: string };
  bookmark: { id: string; name: string; page: string };
}

function loadSummary(): ScenarioSummary | null {
  const path = process.env.AURADATA_SCENARIO_SUMMARY;
  if (!path) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as ScenarioSummary;
}

const summary = loadSummary();

// The app treats `navigator.webdriver` as a bot and changes what it draws
test.use({
  headless: true,
  viewport: { width: 1600, height: 1000 },
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] },
});

test.beforeEach(async ({ page }) => {
  test.skip(
    !summary,
    'Run scripts/auradata/mcp_scenario.py and set AURADATA_SCENARIO_SUMMARY',
  );
  await page.addInitScript(() => {
    Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', {
      get: () => false,
    });
  });
});

/** Errors the page logs, minus noise of the browser itself. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

/**
 * The Redux store of the app, found through React's root fiber: the served
 * bundle is a production build without the devtools hook.
 */
async function attachStore(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const win = window as unknown as Record<string, unknown>;
          if (win.__auradataStore) return true;
          const root = document.getElementById('app') as unknown as Record<
            string,
            unknown
          > | null;
          const key =
            root &&
            Object.keys(root).find(k => k.startsWith('__reactContainer$'));
          if (!root || !key) return false;
          type Fiber = {
            child?: Fiber;
            sibling?: Fiber;
            memoizedProps?: { store?: { getState?: unknown } };
          };
          const stack: Fiber[] = [root[key] as Fiber];
          while (stack.length) {
            const fiber = stack.pop();
            if (fiber) {
              const store = fiber.memoizedProps?.store;
              if (store && typeof store.getState === 'function') {
                win.__auradataStore = store;
                return true;
              }
              if (fiber.sibling) stack.push(fiber.sibling);
              if (fiber.child) stack.push(fiber.child);
            }
          }
          return false;
        }),
      { timeout: 30000 },
    )
    .toBe(true);
}

/** A JSON copy of part of the app state. */
async function state<T>(page: Page, pick: string): Promise<T> {
  return page.evaluate(path => {
    const store = (
      window as unknown as Record<string, { getState: () => unknown }>
    ).__auradataStore;
    let value: unknown = store.getState();
    for (const part of path.split('.')) {
      value = (value as Record<string, unknown> | undefined)?.[part];
    }
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }, pick) as Promise<T>;
}

/** Waits until every chart of a page has drawn, and none failed. */
async function expectPageCharts(page: Page, pageName: string): Promise<void> {
  const charts = Object.values(summary!.charts).filter(
    c => c.page === pageName,
  );
  for (const chart of charts) {
    await expect(
      page.locator(`[data-test-chart-id="${chart.chart_id}"]`),
    ).toBeVisible({
      timeout: 30000,
    });
    await expect
      .poll(() => state<string>(page, `charts.${chart.chart_id}.chartStatus`), {
        message: `${chart.name} draws`,
        timeout: 30000,
      })
      .toBe('rendered');
    expect(
      await state<string | null>(page, `charts.${chart.chart_id}.chartAlert`),
      `${chart.name} has no error`,
    ).toBeFalsy();
  }
}

async function openPage(page: Page, pageName: string): Promise<void> {
  await page.getByRole('tab', { name: pageName, exact: true }).first().click();
}

test('the editor opens the report as the MCP saved it, every page drawn', async ({
  page,
}) => {
  const { dashboard_id: id, pages } = summary!;
  const response = await page.request.get(`api/v1/dashboard/${id}`);
  expect(response.ok()).toBe(true);
  const saved = JSON.parse((await response.json()).result.position_json);

  const errors = collectErrors(page);
  await page.goto(`dashboard/${id}/?edit=true`);
  await attachStore(page);
  await expect
    .poll(() => state<boolean>(page, 'dashboardState.editMode'))
    .toBe(true);
  await expectPageCharts(page, pages[0]);

  // What the editor holds is what it would save: equal to the saved layout,
  // so the load converted nothing, and nothing waits to be saved
  expect(await state(page, 'dashboardLayout.present')).toEqual(saved);
  expect(await state<boolean>(page, 'dashboardState.hasUnsavedChanges')).toBe(
    false,
  );

  for (const pageName of pages.slice(1)) {
    await openPage(page, pageName);
    await expectPageCharts(page, pageName);
  }
  expect(await state<boolean>(page, 'dashboardState.hasUnsavedChanges')).toBe(
    false,
  );
  expect(await state(page, 'dashboardLayout.present')).toEqual(saved);
  expect(errors, 'console errors').toEqual([]);
});

test('the slicer filters the charts and the bookmark applies', async ({
  page,
}) => {
  const { dashboard_id: id, pages, slicer, bookmark, charts } = summary!;
  const errors = collectErrors(page);
  await page.goto(`dashboard/${id}/`);
  await attachStore(page);
  await expectPageCharts(page, pages[0]);

  // A click on a button of the slicer filters the bars to that region
  const filtered = page.waitForRequest(
    request =>
      request.url().includes('/api/v1/chart/data') &&
      (request.postData() ?? '').includes(slicer.value),
  );
  await page
    .getByTestId('auradata-slicer-item')
    .filter({ hasText: new RegExp(`^${slicer.value}$`) })
    .click();
  await filtered;
  await expect
    .poll(() =>
      state<unknown>(page, `dataMask.${slicer.filter_id}.filterState.value`),
    )
    .toEqual([slicer.value]);
  await expect
    .poll(
      () =>
        state<unknown[]>(
          page,
          `charts.${charts.bars.chart_id}.queriesResponse.0.data`,
        ).then(rows => rows?.length),
      { message: 'one bar left', timeout: 30000 },
    )
    .toBe(1);

  // Fresh load, on the other page: the bookmark brings back its page and filter
  await page.goto(`dashboard/${id}/`);
  await attachStore(page);
  await expectPageCharts(page, pages[0]);
  expect(
    await state<unknown>(
      page,
      `dataMask.${slicer.filter_id}.filterState.value`,
    ),
  ).toBeFalsy();
  await openPage(page, pages[1]);
  await expectPageCharts(page, pages[1]);
  await page.getByTestId('auradata-bookmarks-button').click();
  await page.getByRole('menuitem', { name: bookmark.name }).click();
  await expect(
    page.getByRole('tab', { name: bookmark.page, exact: true }).first(),
  ).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() =>
      state<unknown>(page, `dataMask.${slicer.filter_id}.filterState.value`),
    )
    .toEqual([slicer.value]);
  await expectPageCharts(page, bookmark.page);
  expect(errors, 'console errors').toEqual([]);
});
