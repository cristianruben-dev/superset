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
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
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
const updateLayout =
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
