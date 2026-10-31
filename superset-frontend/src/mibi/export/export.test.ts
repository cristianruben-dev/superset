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
import type { RootState } from 'src/dashboard/types';
import { appliedFilters, type Capture } from './capture';
import { buildPdf, exportFileName, paginate } from './document';
import { supersetTheme } from '@apache-superset/core/theme';

const capture = (height: number, breaks: number[]): Capture => ({
  canvas: { height, width: 100 } as HTMLCanvasElement,
  scale: 1,
  breaks: [...breaks, height],
});

test('fits short dashboards on one page', () => {
  expect(paginate(capture(500, [200]), 800, 1000)).toEqual([[0, 500]]);
});

test('breaks pages between visuals', () => {
  expect(paginate(capture(1500, [400, 700, 1100]), 800, 800)).toEqual([
    [0, 700],
    [700, 1500],
  ]);
});

test('cuts a visual taller than a page where the page ends', () => {
  expect(paginate(capture(2000, [1900]), 800, 800)).toEqual([
    [0, 800],
    [800, 1600],
    [1600, 2000],
  ]);
});

test('names the file after the dashboard and the day', () => {
  expect(
    exportFileName(
      'Ventas por región',
      new Date('2026-10-30T10:00:00Z'),
      'pdf',
    ),
  ).toBe('ventas-por-region-2026-10-30.pdf');
});

test('lists the filters that hold a value', () => {
  const state = {
    nativeFilters: {
      filters: {
        f1: { id: 'f1', name: 'Region' },
        f2: { id: 'f2', name: 'Channel' },
      },
    },
    dataMask: {
      f1: { filterState: { value: ['North', 'South'] } },
      f2: { filterState: {} },
    },
  } as unknown as RootState;
  expect(appliedFilters(state)).toEqual([
    { label: 'Region', value: 'North, South' },
  ]);
});

// A 2x2 JPEG, enough for jsPDF to embed
const JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzuiiivBP1k//Z';

const fakeCapture = (width: number, height: number, breaks: number[] = []) =>
  ({
    canvas: { width, height } as HTMLCanvasElement,
    scale: 2,
    breaks: [...breaks, height],
  }) as Capture;

const info = {
  title: 'Ventas',
  workspace: 'Comercial',
  filters: [{ label: 'Region', value: 'Norte' }],
  author: 'Ana',
  date: new Date('2026-10-31T10:00:00Z'),
  includeHeader: true,
};

const pageSizes = (doc: ReturnType<typeof buildPdf>) =>
  Array.from({ length: doc.getNumberOfPages() }, (_, index) => {
    doc.setPage(index + 1);
    return [
      Math.round(doc.internal.pageSize.getWidth()),
      Math.round(doc.internal.pageSize.getHeight()),
    ];
  });

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(JPEG);
});

afterEach(() => jest.restoreAllMocks());

test('PDF pages have the size of the dashboard, after a 16:9 cover', () => {
  // Two tabs of a 1280 px wide dashboard captured at 2x
  const doc = buildPdf(
    [
      { title: 'Resumen', capture: fakeCapture(2560, 2000) },
      { title: 'Canales', capture: fakeCapture(2560, 1200) },
    ],
    info,
    supersetTheme,
  );
  // 0.75 pt per CSS pixel
  expect(pageSizes(doc)).toEqual([
    [960, 540],
    [960, 750],
    [960, 450],
  ]);
});

test('a fixed canvas gives the cover its own size, and no cover is optional', () => {
  const fixed = [{ capture: fakeCapture(2560, 1440), fixed: true }];
  expect(pageSizes(buildPdf(fixed, info, supersetTheme))).toEqual([
    [960, 540],
    [960, 540],
  ]);
  expect(
    pageSizes(
      buildPdf(fixed, { ...info, includeHeader: false }, supersetTheme),
    ),
  ).toEqual([[960, 540]]);
});

test('pages taller than PDF viewers allow are split between visuals', () => {
  // 20000 CSS px tall: more than 14000 pt
  const doc = buildPdf(
    [{ capture: fakeCapture(2560, 40000, [20000, 30000]) }],
    { ...info, includeHeader: false },
    supersetTheme,
  );
  // Breaks at the last gap between visuals that fits (30000 px)
  expect(pageSizes(doc)).toEqual([
    [960, 11250],
    [960, 3750],
  ]);
});
