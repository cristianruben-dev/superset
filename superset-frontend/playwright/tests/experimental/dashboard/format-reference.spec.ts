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
import { test, expect } from '@playwright/test';

/**
 * Each chart type as it looks with no format of the report, to catch format
 * work changing charts nobody formatted. Needs the dashboard that
 * scripts/mibi/format_reference.py creates; run with --workers=1.
 */
const TITLE = 'QA referencia de formato';

test('charts without a format keep their look', async ({ page }) => {
  test.setTimeout(180000);
  const query = `(filters:!((col:dashboard_title,opr:eq,value:'${TITLE}')))`;
  const response = await page.request.get(`api/v1/dashboard/?q=${query}`);
  const dashboard = (await response.json()).result?.[0];
  test.skip(!dashboard, 'Run scripts/mibi/format_reference.py first');

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`dashboard/${dashboard.id}/`);
  const charts = page.locator('[data-test="dashboard-component-chart-holder"]');
  await expect(charts).toHaveCount(15, { timeout: 60000 });
  await expect(page.locator('[data-test="loading-indicator"]')).toHaveCount(0, {
    timeout: 120000,
  });
  // The animation of the charts ends before the capture
  await page.waitForTimeout(2000);

  const count = await charts.count();
  for (let index = 0; index < count; index += 1) {
    const chart = charts.nth(index);
    const name = await chart
      .locator('[data-test="editable-title"], .header-title')
      .first()
      .innerText();
    await expect
      .soft(chart)
      .toHaveScreenshot(`${name.trim().replace(/\s+/g, '-')}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
  }
});
