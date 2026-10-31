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
  GRID_BASE_UNIT,
  GRID_MIN_ROW_UNITS,
} from 'src/dashboard/util/constants';
import { activeTabIndex, topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { CHART_TYPE, ROW_TYPE } from 'src/dashboard/util/componentTypes';
import {
  CANVAS_FORMAT_KEY,
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

/** Hides an object from viewers, or locks it in place (HIDDEN_KEY, LOCKED_KEY). */
export const setObjectFlag =
  (id: string, key: string, value: boolean) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!item) return;
    dispatch(
      updateLayout(
        { [id]: withMeta(item, key, value || undefined) },
        `flag:${id}:${key}:${Date.now()}`,
      ),
    );
  };

/** Gives every chart of the dashboard the same format. */
export const setAllVisualsFormat =
  (format: VisualFormat | undefined) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present;
    const next: Record<string, LayoutItem> = {};
    Object.values(layout).forEach(item => {
      if (item.type === CHART_TYPE) {
        next[item.id] = withMeta(item, VISUAL_FORMAT_KEY, format);
      }
    });
    dispatch(updateLayout(next, `all:${Date.now()}`));
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

/** Room each row takes besides its visuals: the gutter below it. */
const ROW_OVERHEAD = 16;

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

/** Height in pixels of a layout height in grid units. */
export const gridUnitsToPixels = (units: number) => units * GRID_BASE_UNIT;

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
