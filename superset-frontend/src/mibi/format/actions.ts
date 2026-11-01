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
import { SupersetClient } from '@superset-ui/core';
import { UPDATE_COMPONENTS } from 'src/dashboard/actions/dashboardLayout';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';
import { activeTabIndex, topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { CHART_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import { placeAt, posOf, type Pos } from './positions';
import {
  CANVAS_FORMAT_KEY,
  CELL,
  VISUAL_FORMAT_KEY,
  type CanvasFormat,
  type VisualFormat,
} from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/**
 * Writes layout components like updateComponents does, tagged with a group
 * so consecutive changes of the same setting undo as one step.
 */
export const updateLayout =
  (nextComponents: Record<string, LayoutItem>, group: string) =>
  (dispatch: AppDispatch, getState: GetState) => {
    dispatch({
      type: UPDATE_COMPONENTS,
      payload: { nextComponents },
      formatGroup: group,
    });
    if (!getState().dashboardState.hasUnsavedChanges) {
      dispatch(setUnsavedChanges(true));
    }
  };

const withMeta = (
  item: LayoutItem,
  key: string,
  value: unknown,
): LayoutItem => {
  const meta = { ...item.meta };
  if (value === undefined) delete meta[key];
  else meta[key] = value;
  return { ...item, meta };
};

/** Sets (or clears, with undefined) one meta setting of a layout component. */
export const setComponentMeta =
  (id: string, key: string, value: unknown, group = `meta:${id}:${key}`) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!item) return;
    dispatch(updateLayout({ [id]: withMeta(item, key, value) }, group));
  };

/** Puts an object on a cell of the page, in one undo step. */
export const moveObject =
  (id: string, cell: Pos, group = `move:${id}:${Date.now()}`) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present;
    const next = placeAt(layout, id, cell);
    if (next !== layout) dispatch(updateLayout({ [id]: next[id] }, group));
  };

/** Sets the size and the cell of an object at once, in one undo step. */
export const resizeObject =
  (id: string, size: { width: number; height: number }, cell: Pos) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!item) return;
    dispatch(
      updateLayout(
        {
          [id]: {
            ...item,
            meta: { ...item.meta, ...size, mibiPos: { x: cell.x, y: cell.y } },
          },
        },
        `resize:${id}:${Date.now()}`,
      ),
    );
  };

/** Moves an object by whole cells; keys held down group into one undo step. */
export const nudgeObject =
  (id: string, dx: number, dy: number) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const pos = posOf(getState().dashboardLayout.present[id]?.meta);
    if (!pos) return;
    dispatch(moveObject(id, { x: pos.x + dx, y: pos.y + dy }, `nudge:${id}`));
  };

/** Sets (or clears, with undefined) the format of a visual. */
export const setVisualFormat =
  (id: string, format: VisualFormat | undefined, group = `visual:${id}`) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!item) return;
    dispatch(
      updateLayout({ [id]: withMeta(item, VISUAL_FORMAT_KEY, format) }, group),
    );
  };

/** What a chart keeps of its own format when it takes a shared style. */
export const keepOwnText = (
  format: VisualFormat | undefined,
): VisualFormat | undefined =>
  format?.title?.subtitle
    ? { title: { subtitle: format.title.subtitle } }
    : undefined;

/** The style to share, without the text that belongs to one chart. */
export const withoutOwnText = (
  format: VisualFormat | undefined,
): VisualFormat | undefined => {
  if (!format?.title || format.title.subtitle === undefined) return format;
  const { subtitle, ...title } = format.title;
  return { ...format, title };
};

/**
 * Makes ``format`` the style every chart shares (kept on the canvas, so
 * charts added later take it too), with ``canvas`` changes in the same undo
 * step. With ``resetCharts``, charts drop their own style but their subtitle.
 */
export const setSharedVisualFormat =
  (
    format: VisualFormat | undefined,
    {
      resetCharts = true,
      canvas,
    }: { resetCharts?: boolean; canvas?: CanvasFormat } = {},
  ) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present;
    const root = layout[DASHBOARD_ROOT_ID];
    if (!root) return;
    const next: Record<string, LayoutItem> = {};
    const nextCanvas: CanvasFormat = {
      ...(canvas ?? (root.meta?.[CANVAS_FORMAT_KEY] as CanvasFormat)),
    };
    const shared = withoutOwnText(format);
    if (shared && Object.keys(shared).length) nextCanvas.visuals = shared;
    else delete nextCanvas.visuals;
    next[DASHBOARD_ROOT_ID] = withMeta(
      root,
      CANVAS_FORMAT_KEY,
      Object.keys(nextCanvas).length ? nextCanvas : undefined,
    );
    if (resetCharts) {
      Object.values(layout).forEach(item => {
        if (item.type === CHART_TYPE && item.meta?.[VISUAL_FORMAT_KEY]) {
          next[item.id] = withMeta(
            item,
            VISUAL_FORMAT_KEY,
            keepOwnText(item.meta[VISUAL_FORMAT_KEY] as VisualFormat),
          );
        }
      });
    }
    dispatch(updateLayout(next, `shared:${Date.now()}`));
  };

/** Sets the canvas format, kept on the root component. */
export const setCanvasFormat =
  (format: CanvasFormat | undefined, group = 'canvas') =>
  (dispatch: AppDispatch, getState: GetState) => {
    const root = getState().dashboardLayout.present[DASHBOARD_ROOT_ID];
    if (!root) return;
    dispatch(
      updateLayout(
        { [DASHBOARD_ROOT_ID]: withMeta(root, CANVAS_FORMAT_KEY, format) },
        group,
      ),
    );
  };

/** Room each row takes besides its visuals: rows touch, so none. */
const ROW_OVERHEAD = 0;

/**
 * Shrinks or grows the visuals on screen (the active page) so their content,
 * now ``content`` pixels tall, fits ``target`` pixels.
 */
export const fitToCanvas =
  (target: number, content: number) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout, dashboardState } = getState();
    const layout = dashboardLayout.present;
    const tabs = topLevelTabs(layout);
    const rootId = tabs.length
      ? tabs[activeTabIndex(tabs, dashboardState.activeTabs)].id
      : DASHBOARD_GRID_ID;
    const sized: LayoutItem[] = [];
    let rows = 0;
    const visit = (id: string) => {
      const item = layout[id];
      if (!item) return;
      if (item.type === ROW_TYPE) rows += 1;
      if (typeof item.meta?.height === 'number') sized.push(item);
      item.children.forEach(visit);
    };
    visit(rootId);
    const overhead = rows * ROW_OVERHEAD;
    if (!sized.length || content <= overhead) return;
    const factor = (target - overhead) / (content - overhead);
    const next: Record<string, LayoutItem> = {};
    sized.forEach(item => {
      const height = Math.max(
        GRID_MIN_ROW_UNITS,
        Math.floor((item.meta.height as number) * factor),
      );
      if (height !== item.meta.height) {
        next[item.id] = { ...item, meta: { ...item.meta, height } };
      }
    });
    if (Object.keys(next).length) {
      dispatch(updateLayout(next, `fit:${Date.now()}`));
    }
  };

/** Height in pixels of a layout height in cells. */
export const gridUnitsToPixels = (units: number) => units * CELL;

/** Uploads the canvas background picture and returns its URL. */
export async function uploadBackground(
  dashboardId: number,
  file: File,
): Promise<string> {
  const body = new FormData();
  body.append('image', file);
  const { json } = await SupersetClient.put({
    endpoint: `/api/v1/dashboard_background/${dashboardId}/`,
    body,
    headers: { Accept: 'application/json' },
  });
  return json.result.url as string;
}

export async function deleteBackground(dashboardId: number): Promise<void> {
  await SupersetClient.delete({
    endpoint: `/api/v1/dashboard_background/${dashboardId}/`,
  });
}
