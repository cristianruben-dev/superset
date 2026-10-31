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

import { test, expect } from '../../../helpers/fixtures/testAssets';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from './dashboard-test-helpers';

/**
 * Dashboard Format pane E2E tests (Mi BI).
 *
 * They create their own empty dashboard, so they only need a running
 * Superset and the admin user authenticated by global-setup.
 */

// A 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('canvas format is saved with the dashboard and applied when viewing it', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(90_000);
  const { id } = await createTestDashboard(page, testAssets, test.info(), {
    prefix: 'test_format',
  });

  await page.goto(`superset/dashboard/${id}/`);
  await page.getByTestId('edit-dashboard-button').click();
  await page.getByRole('tab', { name: /Format|Formato/ }).click();
  const pane = page.getByTestId('mibi-format-pane');
  await expect(pane).toBeVisible({ timeout: TIMEOUT.PAGE_LOAD });

  // Gradient background and a 16:9 page
  await page
    .getByTestId('mibi-format-canvas-type')
    .getByRole('radio')
    .nth(2)
    .click();
  await page.getByTestId('mibi-format-size').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: '16:9' })
    .click();

  const canvas = page.getByTestId('mibi-canvas');
  await expect(canvas).toHaveCSS('width', '1280px');

  await page.getByTestId('header-save-button').click();
  await expect(page.getByTestId('edit-dashboard-button')).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  await page.reload();
  await expect(canvas).toHaveCSS('width', '1280px', {
    timeout: TIMEOUT.PAGE_LOAD,
  });
  await expect(canvas).toHaveCSS('background-image', /linear-gradient/);
});

test('background pictures are stored per dashboard and only accept images', async ({
  page,
  testAssets,
}) => {
  const { id } = await createTestDashboard(page, testAssets, test.info(), {
    prefix: 'test_background',
  });
  await page.goto('superset/welcome/');
  const csrf = await page.evaluate(
    async () =>
      (await (await fetch('/api/v1/security/csrf_token/')).json()).result,
  );
  const endpoint = `api/v1/dashboard_background/${id}/`;
  const headers = { 'X-CSRFToken': csrf, Referer: page.url() };

  const uploaded = await page.request.put(endpoint, {
    headers,
    multipart: {
      image: { name: 'bg.png', mimeType: 'image/png', buffer: PNG },
    },
  });
  expect(uploaded.status()).toBe(200);
  const { url } = (await uploaded.json()).result;
  expect(url).toContain(`/api/v1/dashboard_background/${id}/`);

  const served = await page.request.get(endpoint);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toBe('image/png');

  const rejected = await page.request.put(endpoint, {
    headers,
    multipart: {
      image: {
        name: 'x.svg',
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg/>'),
      },
    },
  });
  expect(rejected.status()).toBe(400);

  const removed = await page.request.delete(endpoint, { headers });
  expect(removed.status()).toBe(200);
  expect((await page.request.get(endpoint)).status()).toBe(404);
});

test('image elements store their pictures per dashboard', async ({
  page,
  testAssets,
}) => {
  const { id } = await createTestDashboard(page, testAssets, test.info(), {
    prefix: 'test_image_element',
  });
  await page.goto('superset/welcome/');
  const csrf = await page.evaluate(
    async () =>
      (await (await fetch('/api/v1/security/csrf_token/')).json()).result,
  );
  const headers = { 'X-CSRFToken': csrf, Referer: page.url() };

  const created = await page.request.post(`api/v1/dashboard_image/${id}/`, {
    headers,
    multipart: {
      image: { name: 'logo.png', mimeType: 'image/png', buffer: PNG },
    },
  });
  expect(created.status()).toBe(201);
  const { url } = (await created.json()).result;

  const served = await page.request.get(url.replace(/^\//, ''));
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toBe('image/png');

  const removed = await page.request.delete(url.replace(/^\//, ''), {
    headers,
  });
  expect(removed.status()).toBe(200);
  expect((await page.request.get(url.replace(/^\//, ''))).status()).toBe(404);
});
