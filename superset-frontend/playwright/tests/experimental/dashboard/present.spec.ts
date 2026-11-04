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

/**
 * Presentation mode: the report goes full screen and its page is scaled to
 * fit the screen whole, as in Power BI.
 */

import { test, expect } from '../../../helpers/fixtures/testAssets';
import { apiPutDashboard } from '../../../helpers/api/dashboard';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from '../../dashboard/dashboard-test-helpers';

test('presenting fits a 4:3 page in the screen, full screen', async ({
  page,
  testAssets,
}) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  const { id } = await createTestDashboard(page, testAssets, test.info(), {
    prefix: 'test_present',
  });
  const layout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: {
      type: 'ROOT',
      id: 'ROOT_ID',
      children: ['GRID_ID'],
      meta: { mibiCells: true, mibiCanvas: { size: { mode: '4:3' } } },
    },
    GRID_ID: {
      type: 'GRID',
      id: 'GRID_ID',
      children: ['ROW-present'],
      parents: ['ROOT_ID'],
    },
    'ROW-present': {
      type: 'ROW',
      id: 'ROW-present',
      children: ['MARKDOWN-present'],
      parents: ['ROOT_ID', 'GRID_ID'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'MARKDOWN-present': {
      type: 'MARKDOWN',
      id: 'MARKDOWN-present',
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-present'],
      meta: { width: 12, height: 6, code: 'Q4', mibiPos: { x: 1, y: 1 } },
    },
  };
  const response = await apiPutDashboard(page, id, {
    position_json: JSON.stringify(layout),
  });
  expect(response.ok()).toBe(true);

  await page.goto(`dashboard/${id}/`);
  const present = page.getByTestId('mibi-present-button');
  await expect(present).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });
  await present.click();

  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  const measure = () =>
    page.evaluate(() => {
      const canvas = document
        .querySelector('[data-test="mibi-canvas"]')!
        .getBoundingClientRect();
      return {
        top: canvas.top,
        bottom: canvas.bottom,
        left: canvas.left,
        right: canvas.right,
        width: window.innerWidth,
        height: window.innerHeight,
        scrolls:
          document.scrollingElement!.scrollHeight > window.innerHeight + 1,
      };
    });
  // The page scales once the screen has its full screen size
  await expect
    .poll(async () => {
      const { bottom, height } = await measure();
      return bottom <= height;
    })
    .toBe(true);
  const fit = await measure();
  expect(fit.top).toBeGreaterThanOrEqual(0);
  expect(fit.bottom).toBeLessThanOrEqual(fit.height);
  expect(fit.scrolls).toBe(false);
  // Centered across the screen
  expect(Math.abs(fit.left - (fit.width - fit.right))).toBeLessThanOrEqual(16);

  await page.keyboard.press('Escape');
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await expect(present).toBeVisible();
});
