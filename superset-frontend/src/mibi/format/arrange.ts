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

import type { GetState, LayoutItem } from 'src/dashboard/types';
import { updateLayout } from './actions';
import { gridColumnCount } from './columns';
import { isObjectLocked } from './lock';
import { isPositioned, POS_KEY, posOf } from './positions';

export type AlignMode =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom';

export const GROUP_KEY = 'mibiGroup';
export const Z_KEY = 'mibiZ';

type Layout = Record<string, LayoutItem>;
type Dispatch = (action: unknown) => unknown;

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const boxOf = (layout: Layout, id: string): Box | null => {
  const item = layout[id];
  const pos = posOf(item?.meta);
  if (!item || !pos) return null;
  return {
    id,
    x: pos.x,
    y: pos.y,
    w: Number(item.meta.width) || 1,
    h: Number(item.meta.height) || 1,
  };
};

const withPos = (item: LayoutItem, x: number, y: number): LayoutItem => ({
  ...item,
  meta: { ...item.meta, [POS_KEY]: { x: Math.max(0, x), y: Math.max(0, y) } },
});

const boxes = (layout: Layout, ids: string[]) =>
  ids.map(id => boxOf(layout, id)).filter((box): box is Box => !!box);

/** Changes that move or resize objects: locked ones keep where they are. */
const withoutLocked = (changes: Layout): Layout =>
  Object.fromEntries(
    Object.entries(changes).filter(([, item]) => !isObjectLocked(item.meta)),
  );

const commit = (dispatch: Dispatch, changes: Layout, setting: string) => {
  if (Object.keys(changes).length) {
    dispatch(updateLayout(changes, `arrange:${setting}:${Date.now()}`));
  }
};

/** What a command did: the objects it changed and the locked ones it left. */
export interface ArrangeResult {
  changed: number;
  locked: number;
}

/** Applies the changes to the objects that are not locked and says how it went. */
const commitUnlocked = (
  dispatch: Dispatch,
  changes: Layout,
  setting: string,
): ArrangeResult => {
  const unlocked = withoutLocked(changes);
  commit(dispatch, unlocked, setting);
  const changed = Object.keys(unlocked).length;
  return { changed, locked: Object.keys(changes).length - changed };
};

/** Lines the objects up against the first, the last or the middle of them all. */
export const alignObjects =
  (ids: string[], mode: AlignMode) =>
  (dispatch: Dispatch, getState: GetState): ArrangeResult => {
    const layout = getState().dashboardLayout.present as Layout;
    const picked = boxes(layout, ids);
    if (picked.length < 2) return { changed: 0, locked: 0 };
    const left = Math.min(...picked.map(b => b.x));
    const right = Math.max(...picked.map(b => b.x + b.w));
    const top = Math.min(...picked.map(b => b.y));
    const bottom = Math.max(...picked.map(b => b.y + b.h));
    const changes: Layout = {};
    picked.forEach(b => {
      let { x, y } = b;
      if (mode === 'left') x = left;
      if (mode === 'right') x = right - b.w;
      if (mode === 'center') x = Math.round((left + right - b.w) / 2);
      if (mode === 'top') y = top;
      if (mode === 'bottom') y = bottom - b.h;
      if (mode === 'middle') y = Math.round((top + bottom - b.h) / 2);
      if (x !== b.x || y !== b.y) changes[b.id] = withPos(layout[b.id], x, y);
    });
    return commitUnlocked(dispatch, changes, mode);
  };

/** Spaces three or more objects evenly between the outer two. */
export const distributeObjects =
  (ids: string[], axis: 'horizontal' | 'vertical') =>
  (dispatch: Dispatch, getState: GetState): ArrangeResult => {
    const layout = getState().dashboardLayout.present as Layout;
    const picked = boxes(layout, ids);
    if (picked.length < 3) return { changed: 0, locked: 0 };
    const horizontal = axis === 'horizontal';
    const start = (b: Box) => (horizontal ? b.x : b.y);
    const size = (b: Box) => (horizontal ? b.w : b.h);
    const sorted = [...picked].sort((a, b) => start(a) - start(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = start(last) + size(last) - start(first);
    const free = span - sorted.reduce((sum, b) => sum + size(b), 0);
    const gap = free / (sorted.length - 1);
    const changes: Layout = {};
    let cursor = start(first) + size(first) + gap;
    sorted.slice(1, -1).forEach(b => {
      const at = Math.round(cursor);
      const x = horizontal ? at : b.x;
      const y = horizontal ? b.y : at;
      if (x !== b.x || y !== b.y) changes[b.id] = withPos(layout[b.id], x, y);
      cursor += size(b) + gap;
    });
    return commitUnlocked(dispatch, changes, axis);
  };

/** Gives the objects the size of the one the pane is editing. */
export const matchSize =
  (ids: string[], source: string, dimension: 'width' | 'height' | 'both') =>
  (dispatch: Dispatch, getState: GetState): ArrangeResult => {
    const layout = getState().dashboardLayout.present as Layout;
    const from = boxOf(layout, source);
    if (!from) return { changed: 0, locked: 0 };
    const columns = gridColumnCount();
    const changes: Layout = {};
    ids.forEach(id => {
      const item = layout[id];
      if (!item || id === source || !posOf(item.meta)) return;
      const meta = { ...item.meta };
      if (dimension !== 'height') {
        const pos = posOf(meta);
        meta.width = Math.min(from.w, columns - (pos?.x ?? 0));
      }
      if (dimension !== 'width') meta.height = from.h;
      if (meta.width !== item.meta.width || meta.height !== item.meta.height) {
        changes[id] = { ...item, meta };
      }
    });
    return commitUnlocked(dispatch, changes, `size-${dimension}`);
  };

/** The objects of a page, in the order they are stacked (back to front). */
export function pageObjects(layout: Layout, pageId: string | undefined) {
  const found: string[] = [];
  const visit = (id: string) => {
    const item = layout[id];
    if (!item) return;
    if (isPositioned(item.type)) {
      found.push(id);
      return;
    }
    (item.children ?? []).forEach(visit);
  };
  if (pageId) visit(pageId);
  return found
    .map((id, index) => ({ id, index, z: Number(layout[id].meta?.[Z_KEY]) }))
    .sort((a, b) => {
      const za = Number.isFinite(a.z) ? a.z : a.index + 1;
      const zb = Number.isFinite(b.z) ? b.z : b.index + 1;
      return za - zb || a.index - b.index;
    })
    .map(entry => entry.id);
}

/** Moves an object in the stack: to the front or back, or one step. */
export const arrangeLayer =
  (
    pageId: string | undefined,
    id: string,
    move: 'front' | 'back' | 'forward' | 'backward',
  ) =>
  (dispatch: Dispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present as Layout;
    const order = pageObjects(layout, pageId);
    const from = order.indexOf(id);
    if (from < 0) return;
    order.splice(from, 1);
    const to = {
      front: order.length,
      back: 0,
      forward: Math.min(order.length, from + 1),
      backward: Math.max(0, from - 1),
    }[move];
    order.splice(to, 0, id);
    const changes: Layout = {};
    order.forEach((key, index) => {
      if (Number(layout[key].meta?.[Z_KEY]) !== index + 1) {
        changes[key] = {
          ...layout[key],
          meta: { ...layout[key].meta, [Z_KEY]: index + 1 },
        };
      }
    });
    commit(dispatch, changes, `layer-${id}`);
  };

/** Objects that move and align together, or ungroups them. */
export const groupObjects =
  (ids: string[], on: boolean) => (dispatch: Dispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present as Layout;
    const tag = `g-${Date.now().toString(36)}`;
    const changes: Layout = {};
    ids.forEach(id => {
      const item = layout[id];
      if (!item) return;
      const meta = { ...item.meta };
      if (on) meta[GROUP_KEY] = tag;
      else delete meta[GROUP_KEY];
      changes[id] = { ...item, meta };
    });
    commit(dispatch, changes, on ? 'group' : 'ungroup');
  };

/** The objects grouped with `id`, itself included. */
export function groupMembers(layout: Layout, id: string): string[] {
  const tag = layout[id]?.meta?.[GROUP_KEY];
  if (!tag) return [id];
  return Object.keys(layout).filter(
    key => layout[key]?.meta?.[GROUP_KEY] === tag,
  );
}
