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
 * Free placement on the cell grid. Every chart, element and text box has an
 * absolute position on the page, in cells from its top-left corner
 * (``meta.mibiPos``), so moving or resizing one never moves another. The rows
 * of the layout stay as containers: they keep the order of the mobile layout.
 */
import type { CSSProperties } from 'react';
import type { DropTargetMonitor } from 'react-dnd';
import type { DashboardLayout } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DYNAMIC_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import { columnCountOf, gridColumnCount } from './columns';
import { canvasSize } from './styles';
import { CANVAS_FORMAT_KEY, CELL, type CanvasFormat } from './types';

export const POS_KEY = 'mibiPos';
/** Key of the empty cells the row-based layout used before absolute positions. */
const LEGACY_OFFSET_KEY = 'mibiOffset';

export interface Pos {
  x: number;
  y: number;
}

type Meta = Record<string, unknown> | undefined;

const whole = (value: unknown) =>
  Number.isFinite(value) ? Math.max(0, Math.round(value as number)) : 0;

/** Whether objects of this type are placed on the page by position. */
export const isPositioned = (type: string | undefined) =>
  type === CHART_TYPE || type === DYNAMIC_TYPE || type === MARKDOWN_TYPE;

/** The cell an object sits on, or undefined while it follows the row. */
export function posOf(meta: Meta): Pos | undefined {
  const raw = meta?.[POS_KEY] as Partial<Pos> | undefined;
  return raw ? { x: whole(raw.x), y: whole(raw.y) } : undefined;
}

/** The style that places an object on its cell. */
export function posStyle(meta: Meta): CSSProperties | undefined {
  const pos = posOf(meta);
  if (!pos) return undefined;
  return { position: 'absolute', left: pos.x * CELL, top: pos.y * CELL };
}

interface Point {
  x: number;
  y: number;
}

// Where the dragged object was last seen: the monitor no longer reports it
// when the drop happens
let lastSeen: { source: Point | null; pointer: Point | null } = {
  source: null,
  pointer: null,
};

/** Remembers the position of the dragged object; call while hovering. */
export function trackDrag(monitor: DropTargetMonitor) {
  lastSeen = {
    source: monitor.getSourceClientOffset() ?? lastSeen.source,
    pointer: monitor.getClientOffset() ?? lastSeen.pointer,
  };
}

export const clearDragTrack = () => {
  lastSeen = { source: null, pointer: null };
};

const pageOf = (element: HTMLElement | null | undefined) =>
  element?.closest<HTMLElement>('.mibi-canvas') ??
  document.querySelector<HTMLElement>('.mibi-canvas');

/**
 * The cell where the dragged object's top-left corner lands, from the left
 * and top of the page. A new object (dragged from the panel) lands where the
 * pointer is.
 */
export function dropCell(
  monitor: DropTargetMonitor,
  target: HTMLElement | null | undefined,
): Pos | undefined {
  const page = pageOf(target);
  if (!page) return undefined;
  const isNew =
    (monitor.getItem() as { parentId?: string } | null)?.parentId ===
    NEW_COMPONENTS_SOURCE_ID;
  const corner = isNew
    ? (monitor.getClientOffset() ?? lastSeen.pointer)
    : (monitor.getSourceClientOffset() ?? lastSeen.source);
  if (!corner) return undefined;
  const box = page.getBoundingClientRect();
  // A fixed size page is zoomed to fit: measure in its own pixels
  const zoom = page.offsetWidth ? box.width / page.offsetWidth : 1;
  const unit = CELL * (zoom || 1);
  return {
    x: Math.max(0, Math.round((corner.x - box.left) / unit)),
    y: Math.max(0, Math.round((corner.y - box.top) / unit)),
  };
}

/** The cell nearest to ``cell`` where an object of this size fits the page. */
export function clampToPage(
  layout: DashboardLayout,
  meta: Meta,
  cell: Pos,
): Pos {
  const columns = columnCountOf(layout);
  const width = Number(meta?.width) || 1;
  return {
    x: Math.max(0, Math.min(cell.x, columns - width)),
    y: Math.max(0, cell.y),
  };
}

/** The layout with an object placed on a cell of the page. */
export function placeAt(
  layout: DashboardLayout,
  id: string | undefined,
  cell: Pos | undefined,
): DashboardLayout {
  const item = id ? layout[id] : undefined;
  if (!id || !item || !cell || !isPositioned(item.type)) return layout;
  const next = clampToPage(layout, item.meta, cell);
  const current = posOf(item.meta);
  if (current?.x === next.x && current?.y === next.y) return layout;
  return {
    ...layout,
    [id]: { ...item, meta: { ...item.meta, [POS_KEY]: next } },
  } as DashboardLayout;
}

/** The widest an object can be before it leaves the page, in cells. */
export function maxWidthCells(meta: Meta): number | undefined {
  const pos = posOf(meta);
  if (!pos) return undefined;
  return Math.max(Number(meta?.width) || 1, gridColumnCount() - pos.x);
}

// Height of the components that have none of their own, in cells
const HEADER_ROWS: Record<string, number> = {
  SMALL_HEADER: 1,
  MEDIUM_HEADER: 2,
  LARGE_HEADER: 3,
};

/**
 * Gives every object without a position the cell it has in the flow of the
 * layout: rows side by side, stacked from the top of each page. Objects that
 * have one are left alone. The same layout when nothing is missing.
 */
export function layoutToPositions(layout: DashboardLayout): DashboardLayout {
  const items = Object.values(layout) as {
    id: string;
    type: string;
    meta?: Record<string, unknown>;
  }[];
  if (!layout[DASHBOARD_ROOT_ID]) return layout;
  if (!items.some(item => isPositioned(item.type) && !posOf(item.meta))) {
    return layout;
  }

  const next: Record<string, unknown> = { ...layout };
  const visit = (id: string, x: number, y: number): number => {
    const item = layout[id] as
      | {
          type: string;
          children?: string[];
          meta?: Record<string, unknown>;
        }
      | undefined;
    if (!item) return 0;
    const meta = item.meta ?? {};
    const old = meta[LEGACY_OFFSET_KEY] as Partial<Pos> | undefined;
    const left = x + whole(old?.x);
    const top = y + whole(old?.y);
    const height = Number(meta.height) || 0;

    if (isPositioned(item.type)) {
      if (!posOf(meta)) {
        const rest = { ...meta };
        delete rest[LEGACY_OFFSET_KEY];
        next[id] = {
          ...item,
          meta: { ...rest, [POS_KEY]: { x: left, y: top } },
        };
      }
      return whole(old?.y) + height;
    }
    if (item.type === HEADER_TYPE) {
      return HEADER_ROWS[String(meta.headerSize)] ?? 2;
    }
    if (item.type === ROW_TYPE) {
      let cursor = x;
      let tallest = 0;
      (item.children ?? []).forEach(childId => {
        const child = layout[childId] as
          | { type: string; meta?: Record<string, unknown> }
          | undefined;
        const childOld = child?.meta?.[LEGACY_OFFSET_KEY] as
          | Partial<Pos>
          | undefined;
        tallest = Math.max(tallest, visit(childId, cursor, y));
        cursor += whole(childOld?.x) + (Number(child?.meta?.width) || 0);
      });
      return tallest;
    }
    // Columns and the page itself stack what they hold; each page of a set of
    // tabs starts again from the top
    const sameStart = item.type === TABS_TYPE;
    let cursor = y;
    let used = 0;
    (item.children ?? []).forEach(childId => {
      const taken = visit(childId, x, sameStart ? 0 : cursor);
      if (sameStart) {
        used = Math.max(used, taken);
      } else {
        cursor += taken;
        used += taken;
      }
    });
    return used;
  };
  visit(DASHBOARD_ROOT_ID, 0, 0);

  // The page grows to hold what was laid out below its bottom, so converting a
  // layout never hides an object
  const bottom = Math.max(
    0,
    ...Object.values(next).map(entry => {
      const item = entry as { type: string; meta?: Record<string, unknown> };
      const pos = isPositioned(item.type) ? posOf(item.meta) : undefined;
      return pos ? pos.y + (Number(item.meta?.height) || 0) : 0;
    }),
  );
  const root = next[DASHBOARD_ROOT_ID] as {
    meta?: Record<string, unknown>;
  };
  const canvas = root.meta?.[CANVAS_FORMAT_KEY] as CanvasFormat | undefined;
  const size = canvasSize(canvas);
  if (bottom * CELL > size.height) {
    next[DASHBOARD_ROOT_ID] = {
      ...root,
      meta: {
        ...root.meta,
        [CANVAS_FORMAT_KEY]: {
          ...canvas,
          size: { mode: 'custom', width: size.width, height: bottom * CELL },
        },
      },
    };
  }
  return next as DashboardLayout;
}
