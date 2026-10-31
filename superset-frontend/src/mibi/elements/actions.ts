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
import { useCallback } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { SupersetClient } from '@superset-ui/core';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { updateLayout } from 'src/mibi/format/actions';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { isSafeUrl } from './render';
import { ELEMENT_KEY, type ElementAction, type ElementConfig } from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** Replaces the settings of an element. */
export const setElementConfig =
  (id: string, config: ElementConfig, group = `element:${id}`) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const item = getState().dashboardLayout.present[id];
    if (!item) return;
    const next: LayoutItem = {
      ...item,
      meta: { ...item.meta, [ELEMENT_KEY]: config },
    };
    dispatch(updateLayout({ [id]: next }, group));
  };

/** Uploads the picture of an image element; returns its id and URL. */
export async function uploadElementImage(
  dashboardId: number,
  file: File,
): Promise<{ id: number; url: string }> {
  const body = new FormData();
  body.append('image', file);
  const { json } = await SupersetClient.post({
    endpoint: `/api/v1/dashboard_image/${dashboardId}/`,
    body,
    headers: { Accept: 'application/json' },
  });
  return json.result as { id: number; url: string };
}

export async function deleteElementImage(
  dashboardId: number,
  imageId: number,
): Promise<void> {
  await SupersetClient.delete({
    endpoint: `/api/v1/dashboard_image/${dashboardId}/${imageId}/`,
  });
}

/** Runs what an element does when clicked. */
export function runElementAction(
  action: ElementAction | undefined,
  dispatch: AppDispatch,
  getState: GetState,
) {
  if (!action || action.type === 'none') return;
  const state = getState();
  if (action.type === 'page') {
    const tab = topLevelTabs(state.dashboardLayout.present).find(
      ({ id }) => id === action.tabId,
    );
    if (tab) {
      dispatch(setDirectPathToChild(tab.path));
      window.scrollTo(0, 0);
    }
  } else if (action.type === 'url' && isSafeUrl(action.url)) {
    const url = action.url!.trim();
    if (action.newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.assign(url);
  } else if (action.type === 'reset-filters') {
    Object.values(state.nativeFilters?.filters ?? {}).forEach(filter => {
      if (!filter || !('defaultDataMask' in filter)) return;
      dispatch(
        updateDataMask(filter.id, {
          extraFormData: {},
          filterState: {},
          ...filter.defaultDataMask,
        }),
      );
    });
  } else if (action.type === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/** A click handler for an element action, or undefined when it does nothing. */
export function useElementAction(
  action: ElementAction | undefined,
  enabled: boolean,
) {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const run = useCallback(
    () => runElementAction(action, dispatch, store.getState),
    [action, dispatch, store],
  );
  return enabled && action && action.type !== 'none' ? run : undefined;
}
