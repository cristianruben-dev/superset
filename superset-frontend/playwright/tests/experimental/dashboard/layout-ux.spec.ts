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

import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../helpers/fixtures/testAssets';
import type { TestAssets } from '../../../helpers/fixtures/testAssets';
import { apiPutDashboard } from '../../../helpers/api/dashboard';
import { TIMEOUT } from '../../../utils/constants';
import { createTestDashboard } from './dashboard-test-helpers';

/**
 * How moving and resizing objects feels on the cell grid (AuraData BI).
 *
 * Each test builds its own dashboard with three shapes on known cells, then
 * drives it with the real mouse and keyboard, the way a person would, and
 * measures where everything lands. Nothing is saved from the editor, so the
 * tests are independent; run them one at a time (--workers=1).
 */

const CELL = 32;
const COLUMNS = 30;
const ROWS = 20;

interface Cells {
  x: number;
  y: number;
  w: number;
  h: number;
}

const shape = (
  id: string,
  row: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => ({
  id,
  type: 'DYNAMIC',
  children: [],
  parents: ['ROOT_ID', 'GRID_ID', row],
  meta: {
    componentKey: 'mibi-shape',
    width: w,
    height: h,
    mibiPos: { x, y },
    mibiFormat: { background: 'transparent', borderWidth: 0, padding: 0 },
    mibiElement: {
      kind: 'shape',
      shape: 'rectangle',
      fill: { type: 'solid', opacity: 100 },
      stroke: { width: 0, dash: 'solid' },
      radius: 12,
      rotation: 0,
      shadow: 'none',
      textStyle: {
        size: 16,
        weight: 600,
        align: 'center',
        verticalAlign: 'middle',
      },
    },
  },
});

const LAYOUT = {
  ROOT_ID: {
    id: 'ROOT_ID',
    type: 'ROOT',
    children: ['GRID_ID'],
    meta: {
      mibiCells: true,
      mibiCanvas: {
        size: { mode: 'custom', width: COLUMNS * CELL, height: ROWS * CELL },
      },
    },
  },
  GRID_ID: {
    id: 'GRID_ID',
    type: 'GRID',
    children: ['ROW-1'],
    parents: ['ROOT_ID'],
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['DYNAMIC-a', 'DYNAMIC-b', 'DYNAMIC-c'],
    parents: ['ROOT_ID', 'GRID_ID'],
    meta: { background: 'BACKGROUND_TRANSPARENT' },
  },
  'DYNAMIC-a': shape('DYNAMIC-a', 'ROW-1', 2, 2, 8, 5),
  'DYNAMIC-b': shape('DYNAMIC-b', 'ROW-1', 14, 2, 8, 5),
  'DYNAMIC-c': shape('DYNAMIC-c', 'ROW-1', 2, 10, 10, 4),
};

/** Errors the page throws while a test runs: the editor must never crash. */
const pageErrors = new WeakMap<Page, string[]>();

test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

async function openEditor(page: Page, testAssets: TestAssets) {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error =>
    errors.push(`${error.message}\n${error.stack}`),
  );
  page.on('console', message => {
    if (
      message.type() === 'error' &&
      !/ServiceWorker|service-worker/.test(message.text())
    )
      errors.push(message.text().slice(0, 1500));
  });
  const { id } = await createTestDashboard(page, testAssets, test.info(), {
    prefix: 'test_layout_ux',
  });
  const saved = await apiPutDashboard(page, id, {
    position_json: JSON.stringify(LAYOUT),
  });
  expect(saved.ok()).toBeTruthy();
  await page.goto(`superset/dashboard/${id}/?edit=true`);
  await expect(page.getByTestId('mibi-canvas')).toBeVisible({
    timeout: 90_000,
  });
  await expect(objects(page)).toHaveCount(3);
}

/** The three objects, in the order of the layout. */
const objects = (page: Page) =>
  page.locator('.mibi-canvas .dragdroppable[style*="position: absolute"]');

/** Screen pixels of one cell: the page is zoomed to fit its space. */
const unitOf = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('.mibi-canvas')!;
    return (canvas.getBoundingClientRect().width / canvas.offsetWidth) * 32;
  });

/** Where an object is on the page, in cells. */
async function cellsOf(page: Page, object: Locator): Promise<Cells> {
  const unit = await unitOf(page);
  const canvas = (await page.getByTestId('mibi-canvas').boundingBox())!;
  const box = (await object.boundingBox())!;
  const round = (value: number) => Math.round(value * 100) / 100 + 0; // + 0: no negative zero
  return {
    x: round((box.x - canvas.x) / unit),
    y: round((box.y - canvas.y) / unit),
    w: round(box.width / unit),
    h: round(box.height / unit),
  };
}

const all = async (page: Page) => [
  await cellsOf(page, objects(page).nth(0)),
  await cellsOf(page, objects(page).nth(1)),
  await cellsOf(page, objects(page).nth(2)),
];

/** Presses on an object, moves the mouse by whole cells in steps, and returns. */
async function pick(page: Page, object: Locator) {
  const box = (await object.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  return start;
}

async function dragBy(
  page: Page,
  object: Locator,
  cellsX: number,
  cellsY: number,
) {
  const unit = await unitOf(page);
  const start = await pick(page, object);
  await page.mouse.move(start.x + cellsX * unit, start.y + cellsY * unit, {
    steps: 12,
  });
  return { start, unit };
}

test('objects are drawn on the cells they are saved at', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  expect(await all(page)).toEqual([
    { x: 2, y: 2, w: 8, h: 5 },
    { x: 14, y: 2, w: 8, h: 5 },
    { x: 2, y: 10, w: 10, h: 4 },
  ]);
  // The grid is there and its squares are the cells
  await expect(page.getByTestId('mibi-grid-guide')).toBeVisible();
  await expect(page.getByTestId('mibi-grid-guide')).toHaveCSS(
    'background-size',
    '32px 32px, 32px 32px',
  );
});

test('an object follows the mouse cell by cell and lands where it showed', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await dragBy(page, first, 5, 3);

  // Before letting go, it already shows its landing cell, a whole one
  await expect
    .poll(async () => {
      const { x, y } = await cellsOf(page, first);
      return [x, y];
    })
    .toEqual([7, 5]);
  await page.mouse.up();

  const after = await all(page);
  expect(after[0]).toEqual({ x: 7, y: 5, w: 8, h: 5 });
  // Nothing else moved
  expect(after[1]).toEqual({ x: 14, y: 2, w: 8, h: 5 });
  expect(after[2]).toEqual({ x: 2, y: 10, w: 10, h: 4 });
});

test('a few pixels of wobble do not move an object or lose the click', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  const start = await pick(page, first);
  await page.mouse.move(start.x + 2, start.y + 1);
  await page.mouse.up();
  expect((await all(page))[0]).toEqual({ x: 2, y: 2, w: 8, h: 5 });
});

test('an object cannot leave the page', async ({ page, testAssets }) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await dragBy(page, first, 60, 60);
  await page.mouse.up();
  // 30 columns and 20 rows: an 8 x 5 object ends at the bottom right corner
  expect((await all(page))[0]).toEqual({
    x: COLUMNS - 8,
    y: ROWS - 5,
    w: 8,
    h: 5,
  });

  const second = objects(page).nth(1);
  await dragBy(page, second, -60, -60);
  await page.mouse.up();
  expect((await all(page))[1]).toEqual({ x: 0, y: 0, w: 8, h: 5 });
});

test('Escape while dragging puts the object back', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await dragBy(page, first, 6, 4);
  await expect.poll(async () => (await cellsOf(page, first)).x).toBe(8);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await all(page))[0]).toEqual({ x: 2, y: 2, w: 8, h: 5 });
});

test('objects can overlap and sit next to each other without gaps', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  // The second object, flush against the right edge of the first: cell 10
  const second = objects(page).nth(1);
  await dragBy(page, second, -4, 0);
  await page.mouse.up();
  expect((await all(page))[1]).toEqual({ x: 10, y: 2, w: 8, h: 5 });
  expect((await all(page))[0]).toEqual({ x: 2, y: 2, w: 8, h: 5 });
});

test('moving is one undo step', async ({ page, testAssets }) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await dragBy(page, first, 4, 2);
  await page.mouse.up();
  expect((await all(page))[0]).toMatchObject({ x: 6, y: 4 });
  await page.keyboard.press('ControlOrMeta+z');
  expect((await all(page))[0]).toMatchObject({ x: 2, y: 2 });
  await page.keyboard.press('ControlOrMeta+Shift+z');
  expect((await all(page))[0]).toMatchObject({ x: 6, y: 4 });
});

test('the arrow keys move the selected object a cell, Shift five', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await first.click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  expect((await all(page))[0]).toMatchObject({ x: 5, y: 7 });
  // Held keys group into one step
  await page.keyboard.press('ControlOrMeta+z');
  expect((await all(page))[0]).toMatchObject({ x: 2, y: 2 });
  // Never off the page
  for (let i = 0; i < 4; i += 1) await page.keyboard.press('Shift+ArrowLeft');
  expect((await all(page))[0]).toMatchObject({ x: 0 });
});

test('resizing snaps to cells, shows the size and moves nothing else', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await first.hover();
  const handle = first.locator('.resize-handle--bottom-right');
  await expect(handle).toBeVisible();
  const grip = (await handle.boundingBox())!;
  const unit = await unitOf(page);
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 3 * unit, from.y + 2 * unit, { steps: 12 });

  // While resizing the size shows, in cells, and the object is already that size
  await expect(page.getByTestId('mibi-size-badge')).toHaveText('11 × 7');
  await expect
    .poll(async () => {
      const { w, h } = await cellsOf(page, first);
      return [w, h];
    })
    .toEqual([11, 7]);
  await page.mouse.up();

  const after = await all(page);
  expect(after[0]).toEqual({ x: 2, y: 2, w: 11, h: 7 });
  expect(after[1]).toEqual({ x: 14, y: 2, w: 8, h: 5 });
  expect(after[2]).toEqual({ x: 2, y: 10, w: 10, h: 4 });
});

test('an object cannot be resized past the edge of the page', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const second = objects(page).nth(1);
  await second.hover();
  const grip = (await second
    .locator('.resize-handle--bottom-right')
    .boundingBox())!;
  const unit = await unitOf(page);
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40 * unit, from.y + 40 * unit, { steps: 12 });
  await page.mouse.up();
  const after = (await all(page))[1];
  expect(after.x + after.w).toBeLessThanOrEqual(COLUMNS);
  expect(after.y + after.h).toBeLessThanOrEqual(ROWS);
});

test('the controls inside an object keep working', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  await first.hover();
  // The menu over an object is a button: pressing it must not start a move
  const menu = first
    .locator('.hover-menu button, .hover-menu [role="button"]')
    .first();
  if (await menu.count()) {
    const box = (await menu.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 80, { steps: 6 });
    await page.mouse.up();
    expect((await all(page))[0]).toMatchObject({ x: 2, y: 2 });
  }
});

/** Presses on a resize handle of an object and returns where the mouse is. */
async function grab(page: Page, object: Locator, handle: string) {
  await object.hover();
  const grip = object.locator(`.resize-handle--${handle}`);
  await expect(grip).toBeVisible();
  const box = (await grip.boundingBox())!;
  const unit = await unitOf(page);
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  return { from, unit };
}

test('resizing from the left edge keeps the right edge where it is', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  const { from, unit } = await grab(page, first, 'left');
  await page.mouse.move(from.x - 2 * unit, from.y, { steps: 10 });
  await expect.poll(async () => (await cellsOf(page, first)).x).toBe(0);
  await page.mouse.up();
  const after = await all(page);
  expect(after[0]).toEqual({ x: 0, y: 2, w: 10, h: 5 });
  expect(after[1]).toEqual({ x: 14, y: 2, w: 8, h: 5 });
});

test('resizing from a corner moves the corner and keeps the opposite one', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  const { from, unit } = await grab(page, first, 'top-left');
  await page.mouse.move(from.x + 2 * unit, from.y + 1 * unit, { steps: 10 });
  await expect.poll(async () => (await cellsOf(page, first)).x).toBe(4);
  await page.mouse.up();
  // The bottom right corner stayed on cell (10, 7)
  expect((await all(page))[0]).toEqual({ x: 4, y: 3, w: 6, h: 4 });
});

test('the left edge cannot be pulled past the edge of the page', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  const first = objects(page).nth(0);
  const { from, unit } = await grab(page, first, 'left');
  await page.mouse.move(from.x - 20 * unit, from.y, { steps: 10 });
  await page.mouse.up();
  const after = (await all(page))[0];
  expect(after.x).toBe(0);
  // The right edge is still on cell 10
  expect(after.x + after.w).toBe(10);
});

test('an element dragged from the panel lands under the pointer', async ({
  page,
  testAssets,
}) => {
  test.setTimeout(150_000);
  await openEditor(page, testAssets);
  await page
    .getByRole('tab', { name: /Layout elements|Elementos de diseño/ })
    .click();
  const source = page
    .getByTestId('new-component')
    .filter({ hasText: /Shape|Forma/ })
    .first();
  await expect(source).toBeVisible();
  const from = (await source.boundingBox())!;
  const unit = await unitOf(page);
  const canvas = (await page.getByTestId('mibi-canvas').boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 18 * unit, canvas.y + 14 * unit, {
    steps: 14,
  });
  await page.mouse.up();
  await expect(objects(page)).toHaveCount(4);
  const added = await cellsOf(page, objects(page).nth(3));
  // Under the pointer, on whole cells and inside the page
  expect(Math.abs(added.x - 18)).toBeLessThanOrEqual(1);
  expect(Math.abs(added.y - 14)).toBeLessThanOrEqual(1);
  expect(added.x).toBe(Math.round(added.x));
  expect(added.x + added.w).toBeLessThanOrEqual(COLUMNS);
  expect(added.y + added.h).toBeLessThanOrEqual(ROWS);
  // The others stayed
  const rest = await all(page);
  expect(rest[0]).toEqual({ x: 2, y: 2, w: 8, h: 5 });
});
