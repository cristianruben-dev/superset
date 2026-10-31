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
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import { apiGetChart, apiPostChart } from '../../../helpers/api/chart';
import { apiPutDashboard } from '../../../helpers/api/dashboard';
import { getDatabaseByName } from '../../../helpers/api/database';
import { apiPostVirtualDataset } from '../../../helpers/api/dataset';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from './dashboard-test-helpers';

/**
 * Visual sorting E2E tests (AuraData BI "Sort axis").
 *
 * Each test builds its own dataset, bar chart and dashboard through the API,
 * so it only needs a running Superset with the examples database.
 */

const CATEGORIES = { Brazil: 5, Chile: 1, Peru: 3 };

const SORT_ASCENDING = /^(Sort ascending|Orden ascendente)$/;
const UNDO = /^(Undo|Deshacer)$/;

interface SortFixture {
  dashboardId: number;
  chartId: number;
}

async function createSortFixture(
  page: Page,
  testAssets: TestAssets,
  name: string,
): Promise<SortFixture> {
  const database = await getDatabaseByName(page, 'examples');
  expect(database?.id, 'examples database').toBeTruthy();
  const sql = Object.entries(CATEGORIES)
    .map(
      ([country, sales]) => `SELECT '${country}' AS country, ${sales} AS sales`,
    )
    .join(' UNION ALL ');
  const datasetResponse = await apiPostVirtualDataset(page, {
    database: database!.id,
    schema: '',
    table_name: `${name}_data`,
    sql,
    owners: [],
  });
  expect(datasetResponse.ok()).toBe(true);
  const datasetBody = await datasetResponse.json();
  const datasetId = datasetBody.result?.id ?? datasetBody.id;
  testAssets.trackDataset(datasetId);

  const { id: dashboardId } = await createTestDashboard(
    page,
    testAssets,
    test.info(),
    { prefix: name },
  );

  const chartResponse = await apiPostChart(page, {
    slice_name: `${name}_bars`,
    datasource_id: datasetId,
    datasource_type: 'table',
    viz_type: 'echarts_timeseries_bar',
    dashboards: [dashboardId],
    params: JSON.stringify({
      datasource: `${datasetId}__table`,
      viz_type: 'echarts_timeseries_bar',
      x_axis: 'country',
      metrics: [
        {
          expressionType: 'SQL',
          sqlExpression: 'SUM(sales)',
          label: 'sales',
        },
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

  const layout = {
    DASHBOARD_VERSION_KEY: 'v2',
    ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: ['GRID_ID'] },
    GRID_ID: {
      type: 'GRID',
      id: 'GRID_ID',
      children: ['ROW-sort'],
      parents: ['ROOT_ID'],
    },
    'ROW-sort': {
      type: 'ROW',
      id: 'ROW-sort',
      children: ['CHART-sort'],
      parents: ['ROOT_ID', 'GRID_ID'],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    },
    'CHART-sort': {
      type: 'CHART',
      id: 'CHART-sort',
      children: [],
      parents: ['ROOT_ID', 'GRID_ID', 'ROW-sort'],
      meta: { chartId, width: 6, height: 50, sliceName: `${name}_bars` },
    },
  };
  const layoutResponse = await apiPutDashboard(page, dashboardId, {
    position_json: JSON.stringify(layout),
  });
  expect(layoutResponse.ok()).toBe(true);

  return { dashboardId, chartId };
}

async function savedParams(page: Page, chartId: number) {
  const response = await apiGetChart(page, chartId);
  const body = await response.json();
  return JSON.parse(body.result.params);
}

/**
 * The categories in the order the next chart query returns them (the
 * dashboard has a single chart). Start waiting before the action that
 * triggers the query.
 */
async function nextQueryCategories(page: Page) {
  const response = await page.waitForResponse(
    res =>
      res.url().includes('api/v1/chart/data') &&
      res.request().method() === 'POST' &&
      res.ok(),
    { timeout: TIMEOUT.API_RESPONSE },
  );
  const body = await response.json();
  return (body.result[0].data as { country: string }[]).map(row => row.country);
}

test('an editor sorts a bar chart from its header and viewers see that order', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(120_000);
  const { dashboardId, chartId } = await createSortFixture(
    page,
    testAssets,
    'test_sort',
  );

  // Viewing: no sort option
  await page.goto(`superset/dashboard/${dashboardId}/`);
  await expect(page.getByTestId('edit-dashboard-button')).toBeVisible({
    timeout: TIMEOUT.PAGE_LOAD,
  });
  await expect(page.getByTestId(`mibi-sort-button-${chartId}`)).toHaveCount(0);

  // Editing: sort by the metric, ascending (the default direction)
  await page.getByTestId('edit-dashboard-button').click();
  const sortButton = page.getByTestId(`mibi-sort-button-${chartId}`);
  await sortButton.click();
  const menu = page.getByTestId(`mibi-sort-menu-${chartId}`);
  const reloaded = nextQueryCategories(page);
  await menu.getByText('sales', { exact: true }).click();
  expect(await reloaded).toEqual(['Chile', 'Peru', 'Brazil']);

  expect(await savedParams(page, chartId)).toMatchObject({
    x_axis_sort: 'sales',
    x_axis_sort_asc: true,
  });

  // Anyone opening the dashboard gets the saved order
  const afterReload = nextQueryCategories(page);
  await page.reload();
  expect(await afterReload).toEqual(['Chile', 'Peru', 'Brazil']);
  await expect(page.getByTestId(`mibi-sort-button-${chartId}`)).toHaveCount(0);
});

test('an editor undoes the last sort saved', async ({ page, testAssets }) => {
  test.setTimeout(120_000);
  const { dashboardId, chartId } = await createSortFixture(
    page,
    testAssets,
    'test_sort_undo',
  );

  await page.goto(`superset/dashboard/${dashboardId}/`);
  await page.getByTestId('edit-dashboard-button').click();
  const sortButton = page.getByTestId(`mibi-sort-button-${chartId}`);
  const menu = page.getByTestId(`mibi-sort-menu-${chartId}`);

  await sortButton.click();
  await menu.getByText(SORT_ASCENDING).click();
  await expect(sortButton).toBeEnabled({ timeout: TIMEOUT.API_RESPONSE });
  expect(await savedParams(page, chartId)).toMatchObject({
    x_axis_sort: 'country',
    x_axis_sort_asc: true,
  });

  await sortButton.click();
  await menu.getByText(UNDO).click();
  await expect(sortButton).toBeEnabled({ timeout: TIMEOUT.API_RESPONSE });
  const params = await savedParams(page, chartId);
  expect(params.x_axis_sort).toBeUndefined();
  expect(params.x_axis_sort_asc).toBeUndefined();
});
