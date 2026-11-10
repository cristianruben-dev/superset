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
import type { LayoutItem } from 'src/dashboard/types';
import {
  addMobileBox,
  mobileCandidates,
  mobileComponent,
  mobileLayoutOf,
  mobilePageRows,
  mobileSizeOf,
  mobileViewOf,
  moveMobileBox,
  MOBILE_COLUMNS,
  MOBILE_LAYOUT_KEY,
  MOBILE_MIN_ROWS,
  removeMobileBox,
  resizeMobileBox,
  withMobileLayout,
  type MobileBox,
} from './mobileLayout';

const item = (
  id: string,
  type: string,
  children: string[] = [],
  meta: Record<string, unknown> = {},
) => ({ id, type, children, parents: [], meta }) as unknown as LayoutItem;

const report = (mobile?: unknown): Record<string, LayoutItem> => ({
  ROOT_ID: item('ROOT_ID', 'ROOT', ['TABS-1']),
  'TABS-1': item('TABS-1', 'TABS', ['TAB-a', 'TAB-b']),
  'TAB-a': item(
    'TAB-a',
    'TAB',
    ['ROW-1'],
    mobile ? { [MOBILE_LAYOUT_KEY]: mobile } : {},
  ),
  'TAB-b': item('TAB-b', 'TAB', ['ROW-2']),
  'ROW-1': item('ROW-1', 'ROW', ['CHART-a', 'MARKDOWN-a', 'HEADER-a']),
  'ROW-2': item('ROW-2', 'ROW', ['CHART-b']),
  'CHART-a': item('CHART-a', 'CHART', [], {
    width: 24,
    height: 12,
    auradataPos: { x: 4, y: 2 },
  }),
  'MARKDOWN-a': item('MARKDOWN-a', 'MARKDOWN', [], {
    width: 10,
    height: 4,
    auradataPos: { x: 30, y: 2 },
  }),
  'HEADER-a': item('HEADER-a', 'HEADER'),
  'CHART-b': item('CHART-b', 'CHART', [], {
    width: 12,
    height: 8,
    auradataPos: { x: 0, y: 0 },
  }),
});

const box = (id: string, x = 0, y = 0, width = 12, height = 6): MobileBox => ({
  id,
  x,
  y,
  width,
  height,
});

test('a page without a mobile layout has none', () => {
  expect(mobileLayoutOf(report(), 'TAB-a')).toBeNull();
  expect(mobileLayoutOf(report({ items: [] }), 'TAB-a')).toBeNull();
  expect(mobileLayoutOf(report(), undefined)).toBeNull();
});

test('the objects of a page can go on its phone page', () => {
  expect(mobileCandidates(report(), 'TAB-a')).toEqual([
    'CHART-a',
    'MARKDOWN-a',
  ]);
  expect(mobileCandidates(report(), 'TAB-b')).toEqual(['CHART-b']);
});

test('boxes of objects that left the page are left out', () => {
  const layout = report({
    items: [
      box('CHART-a'),
      box('MARKDOWN-a'),
      box('CHART-b'),
      box('CHART-gone'),
    ],
  });
  expect(mobileLayoutOf(layout, 'TAB-a')?.map(b => b.id)).toEqual([
    'CHART-a',
    'MARKDOWN-a',
  ]);
  expect(
    mobileLayoutOf(report({ items: [box('CHART-gone')] }), 'TAB-a'),
  ).toBeNull();
});

test('objects of the page with no mobile item go at the end of the layout', () => {
  const layout = report({ items: [box('CHART-a', 0, 0, 12, 6)] });
  const boxes = mobileLayoutOf(layout, 'TAB-a');
  expect(boxes?.map(b => b.id)).toEqual(['CHART-a', 'MARKDOWN-a']);
  expect(boxes?.[1].y).toBeGreaterThanOrEqual(6);
  expect(boxes?.[1].width).toBe(MOBILE_COLUMNS);
});

test('boxes stay inside the phone page with whole cells', () => {
  const layout = report({
    items: [
      { id: 'CHART-a', x: 10.4, y: -3, width: 40, height: 1 },
      { id: 'MARKDOWN-a', x: 0, y: 3, width: 12, height: 5 },
    ],
  });
  expect(mobileLayoutOf(layout, 'TAB-a')).toEqual([
    { id: 'CHART-a', x: 0, y: 0, width: MOBILE_COLUMNS, height: 3 },
    { id: 'MARKDOWN-a', x: 0, y: 3, width: MOBILE_COLUMNS, height: 5 },
  ]);
});

test('a new object takes the full width below the lowest one', () => {
  const layout = report();
  const one = addMobileBox(layout, [], 'CHART-a');
  // 24 x 12 on the canvas keeps its shape at the phone width
  expect(one).toEqual([box('CHART-a', 0, 0, 12, 6)]);
  const two = addMobileBox(layout, one, 'MARKDOWN-a');
  expect(two[1]).toEqual(box('MARKDOWN-a', 0, 6, 12, 5));
  // Adding it again changes nothing
  expect(addMobileBox(layout, two, 'CHART-a')).toBe(two);
});

test('an object dropped on a cell lands there', () => {
  const layout = report();
  expect(addMobileBox(layout, [], 'CHART-a', { x: 20, y: 7 })).toEqual([
    box('CHART-a', 0, 7, 12, 6),
  ]);
  const placed = [box('CHART-a', 0, 0, 6, 6)];
  expect(addMobileBox(layout, placed, 'CHART-a', { x: 3, y: 2 })).toEqual([
    box('CHART-a', 3, 2, 6, 6),
  ]);
});

test('moving and resizing keep the box on the phone page', () => {
  const layout = report();
  const boxes = [box('CHART-a', 0, 0, 6, 6), box('MARKDOWN-a', 0, 6)];
  expect(moveMobileBox(layout, boxes, 'CHART-a', { x: 9, y: 4 })[0]).toEqual(
    box('CHART-a', 6, 4, 6, 6),
  );
  const moved = [box('CHART-a', 4, 0, 6, 6)];
  expect(
    resizeMobileBox(layout, moved, 'CHART-a', { width: 20, height: 1 })[0],
  ).toEqual(box('CHART-a', 4, 0, 8, 3));
  expect(removeMobileBox(boxes, 'CHART-a')).toEqual([boxes[1]]);
});

test('the size of a new object follows its shape on the canvas', () => {
  const layout = report();
  expect(mobileSizeOf(layout['CHART-b'])).toEqual({ width: 12, height: 8 });
  expect(mobileSizeOf(layout['MARKDOWN-a'])).toEqual({ width: 12, height: 5 });
  expect(
    mobileSizeOf(item('CHART-c', 'CHART', [], { width: 4, height: 30 })),
  ).toEqual({ width: 12, height: 12 });
});

test('the phone page is as tall as its lowest object, a screen at least', () => {
  expect(mobilePageRows(null)).toBe(MOBILE_MIN_ROWS);
  expect(mobilePageRows([box('CHART-a', 0, 30, 12, 6)])).toBe(36);
});

test('the mobile layout is written into the page, and cleared', () => {
  const page = report()['TAB-a'];
  const written = withMobileLayout(page, [box('CHART-a')]);
  expect(written.meta).toEqual({
    [MOBILE_LAYOUT_KEY]: { items: [box('CHART-a')] },
  });
  expect(withMobileLayout(written, []).meta).toEqual({});
});

test('the mobile view places the objects of the phone and hides the rest', () => {
  const layout = report();
  const view = mobileViewOf(layout, 'TAB-a', [box('CHART-a', 0, 3, 12, 6)]);
  expect(mobileComponent(layout['CHART-a'], view)?.meta).toMatchObject({
    width: 12,
    height: 6,
    auradataPos: { x: 0, y: 3 },
    auradataZ: 1,
  });
  expect(mobileComponent(layout['MARKDOWN-a'], view)).toBeNull();
  expect(mobileComponent(layout['HEADER-a'], view)).toBeNull();
  // Containers and the objects of other pages stay as they are
  expect(mobileComponent(layout['ROW-1'], view)).toBe(layout['ROW-1']);
  expect(mobileComponent(layout['CHART-b'], view)).toBe(layout['CHART-b']);
  expect(mobileComponent(layout['CHART-a'], null)).toBe(layout['CHART-a']);
});
