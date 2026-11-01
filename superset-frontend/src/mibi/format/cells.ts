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
 * Layouts saved before the cell grid have widths in 12, 24 or 48 columns,
 * heights in steps of 8 px and a canvas with margins and gaps. This module
 * converts them once, keeping each object about where and as big as it was.
 * The converted layout carries CELLS_KEY on its root so it is never
 * converted twice; layouts written by code that predates the cell grid
 * (importers, the MCP tools) lack it and are converted when loaded.
 */
import {
  DASHBOARD_ROOT_ID,
  GRID_BASE_UNIT,
  GRID_GUTTER_SIZE,
} from 'src/dashboard/util/constants';
import { COLUMN_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  CELLS_KEY,
  LEGACY_COLUMN_COUNT_KEY,
  MIN_OBJECT_ROWS,
  minObjectColumns,
} from './columns';
import { CANVAS_FORMAT_KEY, CELL, type CanvasFormat } from './types';

type Item = {
  id?: string;
  type?: string;
  children?: string[];
  meta?: Record<string, unknown>;
};
type LayoutLike = Record<string, Item | undefined | string>;

// Pixel sizes of the pages before the cell grid
const LEGACY_PAGE: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '4:3': [960, 720],
  letter: [816, 1056],
};

const legacyPage = (canvas: CanvasFormat | undefined): [number, number] => {
  const size = canvas?.size;
  if (size?.mode === 'custom') {
    return [size.width || 1280, size.height || 720];
  }
  return LEGACY_PAGE[size?.mode ?? ''] ?? LEGACY_PAGE['16:9'];
};

const toCells = (pixels: number, min = 1) =>
  Math.max(min, Math.round(pixels / CELL));

/** Whether a layout already has its sizes in cells. */
export const isInCells = (layout: LayoutLike | null | undefined) =>
  !!(layout?.[DASHBOARD_ROOT_ID] as Item | undefined)?.meta?.[CELLS_KEY];

/**
 * The layout with its sizes in cells; the same object when it already is.
 * A layout without sized objects only gets the marker.
 */
export function layoutToCells<T extends LayoutLike>(layout: T): T {
  const root = layout?.[DASHBOARD_ROOT_ID] as Item | undefined;
  if (!root || root.meta?.[CELLS_KEY]) return layout;

  const items = Object.values(layout).filter(
    (item): item is Item => !!item && typeof item === 'object',
  );
  const sized = items.some(item => typeof item.meta?.width === 'number');
  const marked = {
    ...layout,
    [DASHBOARD_ROOT_ID]: {
      ...root,
      meta: { ...root.meta, [CELLS_KEY]: true },
    },
  } as T;
  if (!sized) return marked;

  const canvas = root.meta?.[CANVAS_FORMAT_KEY] as
    | (CanvasFormat & { padding?: number; gap?: number })
    | undefined;
  const legacyColumns = Number(root.meta?.[LEGACY_COLUMN_COUNT_KEY]) || 12;
  const [pageWidth, pageHeight] = legacyPage(canvas);
  const content = pageWidth - 2 * (canvas?.padding ?? 0);
  const step = (content + GRID_GUTTER_SIZE) / legacyColumns;
  const columns = toCells(pageWidth, 10);

  const widths: Record<string, number> = {};
  items.forEach(item => {
    if (item.id && typeof item.meta?.width === 'number') {
      const pixels = item.meta.width * step - GRID_GUTTER_SIZE;
      widths[item.id] = Math.min(columns, toCells(pixels, minObjectColumns()));
    }
  });
  // Rounding must not make a row wider than the page
  items.forEach(item => {
    if (item.type !== ROW_TYPE) return;
    const kids = (item.children ?? []).filter(id => widths[id] !== undefined);
    if (!kids.length) return;
    let total = kids.reduce((sum, id) => sum + widths[id], 0);
    while (total > columns) {
      const widest = kids.reduce((a, b) => (widths[b] > widths[a] ? b : a));
      if (widths[widest] <= minObjectColumns()) break;
      widths[widest] -= 1;
      total -= 1;
    }
  });
  // Objects in a column stay within it
  items.forEach(item => {
    if (item.type !== COLUMN_TYPE || !item.id || !widths[item.id]) return;
    const visit = (id: string) => {
      if (widths[id] !== undefined) {
        widths[id] = Math.min(widths[id], widths[item.id as string]);
      }
      ((layout[id] as Item | undefined)?.children ?? []).forEach(visit);
    };
    (item.children ?? []).forEach(visit);
  });

  const next: Record<string, unknown> = { ...marked };
  items.forEach(item => {
    if (!item.id || item.id === DASHBOARD_ROOT_ID) return;
    const { meta } = item;
    if (!meta || (widths[item.id] === undefined && !('height' in meta))) {
      return;
    }
    const changed: Record<string, unknown> = { ...meta };
    if (widths[item.id] !== undefined) changed.width = widths[item.id];
    if (typeof meta.height === 'number') {
      changed.height = toCells(meta.height * GRID_BASE_UNIT, MIN_OBJECT_ROWS);
    }
    next[item.id] = { ...item, meta: changed };
  });

  const markedRoot = next[DASHBOARD_ROOT_ID] as Item;
  const rootMeta = { ...markedRoot.meta };
  delete rootMeta[LEGACY_COLUMN_COUNT_KEY];
  const kept: Record<string, unknown> = { ...canvas };
  delete kept.padding;
  delete kept.gap;
  rootMeta[CANVAS_FORMAT_KEY] = {
    ...kept,
    // The same page, in whole cells
    size: {
      mode: 'custom',
      width: columns * CELL,
      height: toCells(pageHeight, 10) * CELL,
    },
  };
  next[DASHBOARD_ROOT_ID] = { ...markedRoot, meta: rootMeta };
  return next as T;
}
