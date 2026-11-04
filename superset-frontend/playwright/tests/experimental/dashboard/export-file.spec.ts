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
 * PDF and PNG export of a report: page names with emojis stay readable in
 * the PDF contents, and a chart title on two lines keeps both in the picture.
 */

import { readFile } from 'fs/promises';
import { inflateSync } from 'zlib';
import type { Page } from '@playwright/test';
import { test, expect } from '../../../helpers/fixtures/testAssets';
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import { apiPostChart } from '../../../helpers/api/chart';
import { apiPutDashboard } from '../../../helpers/api/dashboard';
import { getDatabaseByName } from '../../../helpers/api/database';
import { apiPostVirtualDataset } from '../../../helpers/api/dataset';
import { apiPut } from '../../../helpers/api/requests';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from './dashboard-test-helpers';

const LONG_TITLE = 'Total revenue by product line and quarter of the year';

async function createReport(page: Page, testAssets: TestAssets) {
  const databaseName = process.env.PLAYWRIGHT_DATABASE || 'examples';
  const database = await getDatabaseByName(page, databaseName);
  expect(database?.id, `${databaseName} database`).toBeTruthy();
  const datasetResponse = await apiPostVirtualDataset(page, {
    database: database!.id,
    schema: '',
    table_name: `test_export_${Date.now()}`,
    sql: "SELECT 'North' AS region, 5 AS sales UNION ALL SELECT 'South', 3",
    owners: [],
  });
  expect(datasetResponse.ok()).toBe(true);
  const datasetBody = await datasetResponse.json();
  const datasetId = datasetBody.result?.id ?? datasetBody.id;
  testAssets.trackDataset(datasetId);
  await apiPut(page, `api/v1/dataset/${datasetId}/refresh`);

  const { id: dashboardId } = await createTestDashboard(
    page,
    testAssets,
    test.info(),
    { prefix: 'test_export' },
  );
  const chartResponse = await apiPostChart(page, {
    slice_name: LONG_TITLE,
    datasource_id: datasetId,
    datasource_type: 'table',
    viz_type: 'echarts_timeseries_bar',
    dashboards: [dashboardId],
    params: JSON.stringify({
      datasource: `${datasetId}__table`,
      viz_type: 'echarts_timeseries_bar',
      x_axis: 'region',
      metrics: [
        { expressionType: 'SQL', sqlExpression: 'SUM(sales)', label: 'sales' },
      ],
      groupby: [],
      adhoc_filters: [],
      row_limit: 100,
    }),
  });
  expect(chartResponse.ok()).toBe(true);
  const chartBody = await chartResponse.json();
  const chartId = chartBody.result?.id ?? chartBody.id;
  testAssets.trackChart(chartId);

  const tab = (id: string, text: string, children: string[]) => ({
    type: 'TAB',
    id,
    children,
    parents: ['ROOT_ID', 'TABS-x'],
    meta: { text, defaultText: 'Tab' },
  });
  const layout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: {
      type: 'ROOT',
      id: 'ROOT_ID',
      children: ['TABS-x'],
      meta: { mibiCells: true },
    },
    'TABS-x': {
      type: 'TABS',
      id: 'TABS-x',
      children: ['TAB-a', 'TAB-b'],
      parents: ['ROOT_ID'],
      meta: {},
    },
    'TAB-a': tab('TAB-a', '📊 Sales summary', ['ROW-a']),
    'TAB-b': tab('TAB-b', '🌎 Countries', ['ROW-b']),
    'ROW-a': {
      type: 'ROW',
      id: 'ROW-a',
      children: ['CHART-a'],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-a'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'CHART-a': {
      type: 'CHART',
      id: 'CHART-a',
      children: [],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-a', 'ROW-a'],
      meta: {
        chartId,
        width: 8,
        height: 10,
        sliceName: LONG_TITLE,
        mibiPos: { x: 1, y: 1 },
      },
    },
    'ROW-b': {
      type: 'ROW',
      id: 'ROW-b',
      children: ['MARKDOWN-b'],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-b'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'MARKDOWN-b': {
      type: 'MARKDOWN',
      id: 'MARKDOWN-b',
      children: [],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-b', 'ROW-b'],
      meta: {
        width: 10,
        height: 4,
        code: 'Countries',
        mibiPos: { x: 1, y: 1 },
      },
    },
  };
  const layoutResponse = await apiPutDashboard(page, dashboardId, {
    position_json: JSON.stringify(layout),
  });
  expect(layoutResponse.ok()).toBe(true);
  return { dashboardId, chartId };
}

/** The text of a PDF's streams, inflated. */
async function pdfStreams(path: string) {
  const bytes = await readFile(path);
  const text = bytes.toString('latin1');
  const streams: string[] = [];
  const pattern = /stream\r?\n/g;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    try {
      streams.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      // Not compressed, or a picture
    }
  }
  return streams.join('\n');
}

async function exportFile(page: Page, format: 'pdf' | 'png', all: boolean) {
  await page.getByTestId('mibi-export-button').click();
  const modal = page.getByTestId('mibi-export-modal');
  await modal.getByTestId(`mibi-export-${format}`).click();
  if (all) await modal.getByText(/^All pages/).click();
  const download = page.waitForEvent('download', {
    timeout: TIMEOUT.API_RESPONSE * 3,
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Export', exact: true })
    .click();
  const file = await download;
  const path = test.info().outputPath(file.suggestedFilename());
  await file.saveAs(path);
  return path;
}

test('the PDF lists pages named with emojis and the PNG keeps two line titles', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(120_000);
  const { dashboardId, chartId } = await createReport(page, testAssets);
  await page.goto(`dashboard/${dashboardId}/`);
  const chart = page.locator(`[data-test-chart-id="${chartId}"]`);
  await expect(chart.locator('canvas').first()).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
  // The title takes two lines on screen
  const titleLines = await chart
    .locator('.header-title')
    .first()
    .evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(
        Array.from(range.getClientRects()).map(rect => Math.round(rect.top)),
      ).size;
    });
  expect(titleLines).toBeGreaterThan(1);

  const pdf = await pdfStreams(await exportFile(page, 'pdf', true));
  // Written as plain text, not as UTF-16 with the emoji
  expect(pdf).toContain('(Sales summary)');
  expect(pdf).toContain('(Countries)');

  const png = await exportFile(page, 'png', false);
  await test.info().attach('export.png', { path: png });
});
