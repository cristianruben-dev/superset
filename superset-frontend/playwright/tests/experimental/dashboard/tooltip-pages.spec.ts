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
 * Tooltip pages, Power BI style, over the rows of a raw records table, the
 * row headers of a matrix and the cells of a heatmap; and the export data
 * icon and button of a report.
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../../../helpers/fixtures/testAssets';
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import { apiPostChart } from '../../../helpers/api/chart';
import { apiPutDashboard } from '../../../helpers/api/dashboard';
import { getDatabaseByName } from '../../../helpers/api/database';
import { apiPostVirtualDataset } from '../../../helpers/api/dataset';
import { apiPut } from '../../../helpers/api/requests';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from '../../dashboard/dashboard-test-helpers';

const EMPLOYEES = [
  "SELECT 101 AS employee_id, 'Ana Ruiz' AS name, 'Ventas' AS dept, 5100 AS salary",
  "SELECT 102, 'Luis Gómez', 'Soporte', 4200",
  "SELECT 103, 'Marta Díaz', 'Ventas', 6300",
].join(' UNION ALL ');

const SALARY = {
  expressionType: 'SQL',
  sqlExpression: 'SUM(salary)',
  label: 'salary',
};

type Chart = { name: string; vizType: string; params: Record<string, unknown> };

/**
 * A report with a roster, a matrix, a heatmap and an export button. With
 * ``stacked`` the matrix sits right above the roster, touching it as objects
 * do on the grid, so the way to the roster's buttons crosses the matrix.
 */
async function createReport(
  page: Page,
  testAssets: TestAssets,
  { stacked = false }: { stacked?: boolean } = {},
) {
  const databaseName = process.env.PLAYWRIGHT_DATABASE || 'examples';
  const database = await getDatabaseByName(page, databaseName);
  expect(database?.id, `${databaseName} database`).toBeTruthy();
  const datasetResponse = await apiPostVirtualDataset(page, {
    database: database!.id,
    schema: '',
    table_name: `test_tooltips_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sql: EMPLOYEES,
    editors: [],
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
    { prefix: 'test_tooltips' },
  );
  const create = async ({ name, vizType, params }: Chart) => {
    const response = await apiPostChart(page, {
      slice_name: name,
      datasource_id: datasetId,
      datasource_type: 'table',
      viz_type: vizType,
      dashboards: [dashboardId],
      params: JSON.stringify({
        datasource: `${datasetId}__table`,
        viz_type: vizType,
        adhoc_filters: [],
        row_limit: 100,
        ...params,
      }),
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const id = body.result?.id ?? body.id;
    testAssets.trackChart(id);
    return id as number;
  };
  const roster = await create({
    name: 'Employees',
    vizType: 'table',
    params: {
      query_mode: 'raw',
      all_columns: ['employee_id', 'name', 'dept'],
    },
  });
  const matrix = await create({
    name: 'Salary by employee',
    vizType: 'pivot_table_v2',
    params: {
      groupbyRows: ['name'],
      groupbyColumns: ['dept'],
      metrics: [SALARY],
      aggregateFunction: 'Sum',
      rowTotals: true,
    },
  });
  const heatmap = await create({
    name: 'Salary heatmap',
    vizType: 'heatmap_v2',
    params: { x_axis: 'dept', groupby: 'name', metric: SALARY },
  });
  const detail = await create({
    name: 'Employee detail',
    vizType: 'table',
    params: {
      query_mode: 'raw',
      all_columns: ['name', 'dept', 'salary'],
    },
  });

  const tab = (id: string, text: string, children: string[], meta = {}) => ({
    type: 'TAB',
    id,
    children,
    parents: ['ROOT_ID', 'TABS-x'],
    meta: { text, defaultText: 'Tab', ...meta },
  });
  const row = (id: string, tabId: string, children: string[]) => ({
    type: 'ROW',
    id,
    children,
    parents: ['ROOT_ID', 'TABS-x', tabId],
    meta: { background: 'BACKGROUND_TRANSPARENT' },
  });
  const chart = (
    id: string,
    rowPath: string[],
    chartId: number,
    pos: { x: number; y: number },
    size: { width: number; height: number },
    format: Record<string, unknown> = {},
  ) => ({
    type: 'CHART',
    id,
    children: [],
    parents: rowPath,
    meta: {
      chartId,
      ...size,
      auradataPos: pos,
      auradataFormat: {
        tooltipPage: { type: 'page', page: 'TAB-tip' },
        ...format,
      },
    },
  });
  const pageA = ['ROOT_ID', 'TABS-x', 'TAB-a', 'ROW-a'];
  const layout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: {
      type: 'ROOT',
      id: 'ROOT_ID',
      children: ['TABS-x'],
      meta: { auradataCells: true },
    },
    'TABS-x': {
      type: 'TABS',
      id: 'TABS-x',
      children: ['TAB-a', 'TAB-tip'],
      parents: ['ROOT_ID'],
      meta: {},
    },
    'TAB-a': tab('TAB-a', 'Employees', ['ROW-a']),
    'TAB-tip': tab('TAB-tip', 'Employee tooltip', ['ROW-tip'], {
      auradataTooltipPage: { width: 12, height: 6, columns: ['name'] },
      auradataPageBackground: { type: 'color', color: '#FFF7E6' },
    }),
    'ROW-a': row('ROW-a', 'TAB-a', [
      'CHART-roster',
      'CHART-matrix',
      'CHART-heat',
      'DYNAMIC-export',
    ]),
    'CHART-roster': chart(
      'CHART-roster',
      pageA,
      roster,
      stacked ? { x: 1, y: 10 } : { x: 1, y: 1 },
      { width: 18, height: 10 },
      { header: { export: true } },
    ),
    'CHART-matrix': chart(
      'CHART-matrix',
      pageA,
      matrix,
      stacked ? { x: 1, y: 0 } : { x: 20, y: 1 },
      { width: 18, height: 10 },
    ),
    'CHART-heat': chart(
      'CHART-heat',
      pageA,
      heatmap,
      { x: 39, y: 1 },
      { width: 18, height: 14 },
    ),
    'DYNAMIC-export': {
      type: 'DYNAMIC',
      id: 'DYNAMIC-export',
      children: [],
      parents: pageA,
      meta: {
        componentKey: 'auradata-button',
        width: 8,
        height: 2,
        auradataPos: stacked ? { x: 1, y: 22 } : { x: 1, y: 13 },
        auradataElement: {
          kind: 'button',
          label: 'Download employees',
          action: { type: 'export', chartId: roster, exportFormat: 'csv' },
        },
      },
    },
    'ROW-tip': row('ROW-tip', 'TAB-tip', ['CHART-detail']),
    'CHART-detail': {
      type: 'CHART',
      id: 'CHART-detail',
      children: [],
      parents: ['ROOT_ID', 'TABS-x', 'TAB-tip', 'ROW-tip'],
      meta: {
        chartId: detail,
        width: 12,
        height: 6,
        auradataPos: { x: 0, y: 0 },
      },
    },
  };
  const layoutResponse = await apiPutDashboard(page, dashboardId, {
    position_json: JSON.stringify(layout),
  });
  expect(layoutResponse.ok()).toBe(true);
  return { dashboardId, roster, matrix, heatmap };
}

const tooltip = (page: Page) => page.getByTestId('auradata-tooltip-page');

async function expectEmployee(page: Page, name: string, others: string[]) {
  await expect(tooltip(page)).toBeVisible({ timeout: TIMEOUT.API_RESPONSE });
  await expect(tooltip(page)).toContainText(name, {
    timeout: TIMEOUT.API_RESPONSE,
  });
  for (const other of others) {
    await expect(tooltip(page)).not.toContainText(other);
  }
}

test('tooltip pages follow the row, header or cell under the pointer', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  const { dashboardId, roster, matrix, heatmap } = await createReport(
    page,
    testAssets,
  );
  await page.goto(`dashboard/${dashboardId}/`);
  const rosterChart = page.locator(`[data-test-chart-id="${roster}"]`);
  await expect(rosterChart.getByText('Luis Gómez')).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // A row of a raw records table: the employee's own detail
  await rosterChart.getByText('Luis Gómez').hover();
  await expectEmployee(page, 'Luis Gómez', ['Ana Ruiz', 'Marta Díaz']);
  await expect(tooltip(page)).toContainText('4200');
  await page.screenshot({
    path: test.info().outputPath('tooltip-raw-table.png'),
  });
  // Another cell of another row moves the tooltip to that employee
  await rosterChart.getByText('103', { exact: true }).hover();
  await expectEmployee(page, 'Marta Díaz', ['Luis Gómez']);
  await page.mouse.move(2, 2);
  await expect(tooltip(page)).toBeHidden();

  // A row header of a matrix
  const matrixChart = page.locator(`[data-test-chart-id="${matrix}"]`);
  await matrixChart.locator('th.pvtRowLabel', { hasText: 'Ana Ruiz' }).hover();
  await expectEmployee(page, 'Ana Ruiz', ['Luis Gómez', 'Marta Díaz']);
  await page.screenshot({
    path: test.info().outputPath('tooltip-matrix-header.png'),
  });
  await page.mouse.move(2, 2);
  await expect(tooltip(page)).toBeHidden();

  // A cell of a heatmap, drawn by ECharts
  const heatCanvas = page
    .locator(`[data-test-chart-id="${heatmap}"]`)
    .locator('canvas')
    .first();
  await expect(heatCanvas).toBeVisible({ timeout: TIMEOUT.API_RESPONSE });
  const box = (await heatCanvas.boundingBox())!;
  let found = false;
  for (const fy of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    for (const fx of [0.35, 0.65]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      if (
        await tooltip(page)
          .isVisible({ timeout: 1500 })
          .catch(() => false)
      ) {
        found = true;
        break;
      }
      await page.waitForTimeout(600);
      if (await tooltip(page).isVisible()) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  expect(found, 'a heatmap cell shows the tooltip page').toBe(true);
  await expect(tooltip(page)).toContainText(/Ana Ruiz|Luis Gómez|Marta Díaz/, {
    timeout: TIMEOUT.API_RESPONSE,
  });
  await page.screenshot({
    path: test.info().outputPath('tooltip-heatmap.png'),
  });
});

test('the export icon and an export button download the chart data', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(120_000);
  const { dashboardId, roster } = await createReport(page, testAssets);
  await page.goto(`dashboard/${dashboardId}/`);
  const rosterChart = page.locator(`[data-test-chart-id="${roster}"]`);
  await expect(rosterChart.getByText('Luis Gómez')).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // The icons of a chart show over its title while the pointer is on it
  await page.getByText('Employees', { exact: true }).first().hover();
  await page.getByTestId('auradata-header-export').click();
  await expect(page.getByText('Export to Excel')).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('export-header-menu.png'),
  });
  const csv = page.waitForEvent('download', {
    timeout: TIMEOUT.API_RESPONSE * 2,
  });
  await page.getByText('Export to .CSV').click();
  const iconFile = await csv;
  const iconPath = test.info().outputPath(iconFile.suggestedFilename());
  await iconFile.saveAs(iconPath);
  expect(iconFile.suggestedFilename()).toMatch(/\.csv$/);

  const button = page.getByTestId('auradata-button').filter({
    hasText: 'Download employees',
  });
  await expect(button).toBeVisible();
  const fromButton = page.waitForEvent('download', {
    timeout: TIMEOUT.API_RESPONSE * 2,
  });
  await button.click();
  const buttonFile = await fromButton;
  expect(buttonFile.suggestedFilename()).toMatch(/\.csv$/);
  const contents = await (
    await import('fs/promises')
  ).readFile((await buttonFile.path())!, 'utf8');
  expect(contents).toContain('Luis Gómez');
  expect(contents).toContain('Marta Díaz');
});

async function glide(page: Page, x: number, y: number) {
  await page.mouse.move(x, y, { steps: 1 });
}

/**
 * Moves the pointer as a person does: a few pixels at a time, so it touches
 * whatever lies on the way (each move already takes a while to dispatch).
 */
async function glideFrom(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 6),
  );
  for (let step = 1; step <= steps; step += 1) {
    await glide(
      page,
      from.x + ((to.x - from.x) * step) / steps,
      from.y + ((to.y - from.y) * step) / steps,
    );
  }
}

const centerOf = (box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

test('the export icon stays while the pointer crosses the next object to reach it', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(120_000);
  const { dashboardId, roster, matrix } = await createReport(page, testAssets, {
    stacked: true,
  });
  await page.goto(`dashboard/${dashboardId}/`);
  const rosterChart = page.locator(`[data-test-chart-id="${roster}"]`);
  await expect(rosterChart.getByText('Luis Gómez')).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });
  const matrixChart = page.locator(`[data-test-chart-id="${matrix}"]`);
  await expect(matrixChart.locator('th.pvtRowLabel').first()).toBeVisible({
    timeout: TIMEOUT.API_RESPONSE,
  });

  // The pointer rests on the roster, then travels to its export icon, which
  // sits above it, over the matrix
  const start = centerOf((await rosterChart.boundingBox())!);
  await glide(page, start.x, start.y);
  const icon = page.getByTestId('auradata-header-export');
  await expect(icon).toBeVisible();
  const iconAt = centerOf((await icon.boundingBox())!);
  const matrixBox = (await matrixChart.boundingBox())!;
  expect(iconAt.y, 'the icon sits over the matrix').toBeLessThan(
    matrixBox.y + matrixBox.height,
  );
  // Up past the edge of the roster, next to the bar and so over the matrix,
  // then right into the bar
  const bar = (await page
    .locator('.auradata-object-actions', { has: icon })
    .boundingBox())!;
  const corner = { x: bar.x - 6, y: bar.y + bar.height - 4 };
  await glideFrom(page, start, corner);
  await glideFrom(page, corner, iconAt);
  await expect(icon).toBeVisible();
  await page.mouse.down();
  await page.mouse.up();
  const item = page.getByText('Export to .CSV');
  await expect(item).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('export-icon-reached.png'),
  });

  // On the way to an item of its menu the bar stays, and so does the menu
  const itemAt = centerOf((await item.boundingBox())!);
  await glideFrom(page, iconAt, itemAt);
  await expect(icon).toBeVisible();
  const csv = page.waitForEvent('download', {
    timeout: TIMEOUT.API_RESPONSE * 2,
  });
  await page.mouse.down();
  await page.mouse.up();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);

  // Resting on the matrix moves the buttons to it
  const matrixAt = centerOf(matrixBox);
  await glideFrom(page, itemAt, matrixAt);
  await expect(icon).toBeHidden();
});
