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
 * The mobile layout of a page, as in Power BI: a phone sized page where the
 * author places and sizes some of the visuals the page already has. It is kept
 * in the page itself (``TAB-*.meta.auradataMobile``, or the grid of a report of one
 * page), in cells of a phone grid ``MOBILE_COLUMNS`` wide, so it saves, undoes
 * and exports with the report. A page without one shows its canvas on phones.
 */
import { createContext, useContext } from 'react';
import type { LayoutItem } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  MIN_CHART_COLUMNS,
  MIN_CHART_ROWS,
  MIN_OBJECT_ROWS,
  minObjectColumns,
} from './columns';
import { isPositioned } from './positions';
import { CELL } from './types';

export const MOBILE_LAYOUT_KEY = 'auradataMobile';

/** Width of the phone page in cells: 384 px, the width of most phones. */
export const MOBILE_COLUMNS = 12;

/** Height of the phone page while it is nearly empty, in cells. */
export const MOBILE_MIN_ROWS = 24;

/** Tallest an object takes when it is added to the phone page, in cells. */
const MOBILE_DEFAULT_MAX_ROWS = 12;

/** Where an object of the page sits on its phone page, in cells. */
export interface MobileBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What ``meta.auradataMobile`` holds: the boxes, from back to front. */
export interface MobileLayout {
  items: MobileBox[];
}

type Layout = Record<string, LayoutItem | undefined>;

const whole = (value: unknown, fallback: number) =>
  Number.isFinite(value) ? Math.round(value as number) : fallback;

const minWidthOf = (item: LayoutItem | undefined) =>
  item?.type === CHART_TYPE ? MIN_CHART_COLUMNS : minObjectColumns();

const minHeightOf = (item: LayoutItem | undefined) =>
  item?.type === CHART_TYPE ? MIN_CHART_ROWS : MIN_OBJECT_ROWS;

/** A box kept inside the phone page, with whole cells and the least size. */
function fitBox(box: MobileBox, item: LayoutItem | undefined): MobileBox {
  const width = Math.min(
    MOBILE_COLUMNS,
    Math.max(minWidthOf(item), whole(box.width, MOBILE_COLUMNS)),
  );
  return {
    id: box.id,
    x: Math.max(0, Math.min(MOBILE_COLUMNS - width, whole(box.x, 0))),
    y: Math.max(0, whole(box.y, 0)),
    width,
    height: Math.max(minHeightOf(item), whole(box.height, minHeightOf(item))),
  };
}

/**
 * The objects a mobile layout can hold: the charts, elements and text boxes
 * of the page, without those inside a set of tabs placed on it.
 */
export function mobileCandidates(layout: Layout, pageId: string): string[] {
  const found: string[] = [];
  const visit = (id: string) => {
    const item = layout[id];
    if (!item) return;
    if (isPositioned(item.type)) {
      found.push(id);
      return;
    }
    if (item.type === TABS_TYPE && id !== pageId) return;
    (item.children ?? []).forEach(visit);
  };
  visit(pageId);
  return found;
}

/**
 * The mobile layout of a page: its boxes, from back to front, or null when the
 * page has none. Boxes of objects that left the page (removed, cut, moved to
 * another page) are left out, so nothing else has to keep it in step.
 */
export function mobileLayoutOf(
  layout: Layout,
  pageId: string | undefined,
): MobileBox[] | null {
  if (!pageId) return null;
  const raw = layout[pageId]?.meta?.[
    MOBILE_LAYOUT_KEY as keyof LayoutItem['meta']
  ] as Partial<MobileLayout> | undefined;
  if (!Array.isArray(raw?.items) || !raw.items.length) return null;
  const candidates = new Set(mobileCandidates(layout, pageId));
  const seen = new Set<string>();
  const boxes = raw.items
    .filter(box => {
      if (!box || !candidates.has(box.id) || seen.has(box.id)) return false;
      seen.add(box.id);
      return true;
    })
    .map(box => fitBox(box, layout[box.id]));
  return boxes.length ? boxes : null;
}

/** Height of the phone page in cells: down to the lowest box, at least a screen. */
export function mobilePageRows(boxes: MobileBox[] | null): number {
  const bottom = Math.max(0, ...(boxes ?? []).map(box => box.y + box.height));
  return Math.max(MOBILE_MIN_ROWS, bottom);
}

/** The page with these boxes as its mobile layout (none clears it). */
export function withMobileLayout(
  page: LayoutItem,
  boxes: MobileBox[],
): LayoutItem {
  const meta = { ...page.meta } as Record<string, unknown>;
  if (boxes.length) meta[MOBILE_LAYOUT_KEY] = { items: boxes };
  else delete meta[MOBILE_LAYOUT_KEY];
  return { ...page, meta: meta as LayoutItem['meta'] };
}

/**
 * The size an object takes when it is added to the phone page: the full width
 * and the shape it has on the canvas, within reason.
 */
export function mobileSizeOf(item: LayoutItem | undefined): {
  width: number;
  height: number;
} {
  const width = Number(item?.meta?.width) || MOBILE_COLUMNS;
  const height = Number(item?.meta?.height) || MOBILE_DEFAULT_MAX_ROWS;
  const scaled = Math.round((height * MOBILE_COLUMNS) / width);
  return {
    width: MOBILE_COLUMNS,
    height: Math.max(
      minHeightOf(item),
      Math.min(MOBILE_DEFAULT_MAX_ROWS, scaled),
    ),
  };
}

/** The boxes with one of them put on another cell. */
export function moveMobileBox(
  layout: Layout,
  boxes: MobileBox[],
  id: string,
  cell: { x: number; y: number },
): MobileBox[] {
  return boxes.map(box =>
    box.id === id ? fitBox({ ...box, ...cell }, layout[id]) : box,
  );
}

/**
 * The boxes with an object added (or moved, when it is there already). Without
 * a cell it goes below the lowest box, at the left.
 */
export function addMobileBox(
  layout: Layout,
  boxes: MobileBox[],
  id: string,
  cell?: { x: number; y: number },
): MobileBox[] {
  const current = boxes.find(box => box.id === id);
  if (current && cell) return moveMobileBox(layout, boxes, id, cell);
  if (current) return boxes;
  const size = mobileSizeOf(layout[id]);
  const bottom = Math.max(0, ...boxes.map(box => box.y + box.height));
  const box = fitBox(
    { id, x: cell?.x ?? 0, y: cell?.y ?? bottom, ...size },
    layout[id],
  );
  return [...boxes, box];
}

/** The boxes with one of them resized, its top left corner kept. */
export function resizeMobileBox(
  layout: Layout,
  boxes: MobileBox[],
  id: string,
  size: { width: number; height: number },
): MobileBox[] {
  return boxes.map(box => {
    if (box.id !== id) return box;
    const width = Math.min(size.width, MOBILE_COLUMNS - box.x);
    return fitBox({ ...box, width, height: size.height }, layout[id]);
  });
}

/** The boxes without one object: it stays on the canvas, off the phone. */
export const removeMobileBox = (boxes: MobileBox[], id: string) =>
  boxes.filter(box => box.id !== id);

/** The cell under a point of the phone page, in its own (unzoomed) pixels. */
export const mobileCellAt = (x: number, y: number) => ({
  x: Math.max(0, Math.floor(x / CELL)),
  y: Math.max(0, Math.floor(y / CELL)),
});

/**
 * What the canvas shows of a page in its mobile layout: the boxes of the
 * objects placed on the phone page, and every object of that page, so the
 * ones left out stay hidden.
 */
export interface MobileView {
  /** The boxes by object, with their place in the stack (from 1, the back) */
  boxes: Record<string, MobileBox & { z: number }>;
  members: Set<string>;
}

export function mobileViewOf(
  layout: Layout,
  pageId: string,
  boxes: MobileBox[],
): MobileView {
  const members = new Set<string>();
  const visit = (id: string) => {
    const item = layout[id];
    if (!item) return;
    if (id !== pageId) members.add(id);
    (item.children ?? []).forEach(visit);
  };
  visit(pageId);
  return {
    boxes: Object.fromEntries(
      boxes.map((box, index) => [box.id, { ...box, z: index + 1 }]),
    ),
    members,
  };
}

/**
 * A component of the layout as the mobile layout shows it: an object on the
 * phone page takes its box there, while one left out, the headers, dividers
 * and tabs inside the page are not shown (null). The rest is unchanged.
 */
export function mobileComponent(
  component: LayoutItem | undefined,
  view: MobileView | null,
): LayoutItem | null | undefined {
  if (!component || !view?.members.has(component.id)) {
    return component;
  }
  if (isPositioned(component.type)) {
    const box = view.boxes[component.id];
    if (!box) return null;
    return {
      ...component,
      meta: {
        ...component.meta,
        width: box.width,
        height: box.height,
        auradataPos: { x: box.x, y: box.y },
        auradataZ: box.z,
      } as LayoutItem['meta'],
    };
  }
  if (
    component.type === HEADER_TYPE ||
    component.type === DIVIDER_TYPE ||
    component.type === TABS_TYPE
  ) {
    return null;
  }
  return component;
}

const MobileViewContext = createContext<MobileView | null>(null);
const CanvasReadOnlyContext = createContext(false);

/**
 * Marks a canvas that only shows its objects: the phone of the editor and the
 * mobile layout of a viewer. Its objects are not edited in place.
 */
export const CanvasReadOnlyProvider = CanvasReadOnlyContext.Provider;

export const useCanvasReadOnly = () => useContext(CanvasReadOnlyContext);

/** Gives the components of the canvas the mobile layout they show, if any. */
export const MobileViewProvider = MobileViewContext.Provider;

/** The mobile layout the canvas shows, or null for the canvas itself. */
export const useMobileView = () => useContext(MobileViewContext);
