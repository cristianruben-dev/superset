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
import { nanoid } from 'nanoid';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { DataMask } from '@superset-ui/core';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import type { DashboardLayout, GetState, RootState } from 'src/dashboard/types';
import { CHART_TYPE, DYNAMIC_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { updateDataMask } from 'src/dataMask/actions';
import { elementKind } from 'src/mibi/elements/types';
import { setComponentMeta } from 'src/mibi/format/actions';
import { HIDDEN_KEY } from 'src/mibi/format/types';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { BOOKMARKS_KEY, type Bookmark, type BookmarkOptions } from './types';
import { setVisibilityOverrides, visibilityOverride } from './visibility';

/**
 * Bookmarks, as in Power BI: a saved view of the report (its page, the filter
 * and cross-filter selections and which objects show) that viewers bring
 * back from the bookmarks menu or a button. Kept on the layout root, so they
 * save, undo and export with the dashboard.
 */

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

const NATIVE_FILTER_PREFIX = 'NATIVE_FILTER-';
const isNativeFilter = (id: string) => id.startsWith(NATIVE_FILTER_PREFIX);
const isCrossFilter = (id: string) => /^\d+$/.test(id);

export const DEFAULT_BOOKMARK_OPTIONS: BookmarkOptions = {
  data: true,
  display: true,
  page: true,
};

export const bookmarksOf = (layout: DashboardLayout | undefined): Bookmark[] =>
  (layout?.[DASHBOARD_ROOT_ID]?.meta?.[BOOKMARKS_KEY] as
    | Bookmark[]
    | undefined) ?? [];

const saveBookmarks =
  (bookmarks: Bookmark[], group: string) => (dispatch: AppDispatch) =>
    dispatch(
      setComponentMeta(
        DASHBOARD_ROOT_ID,
        BOOKMARKS_KEY,
        bookmarks.length ? bookmarks : undefined,
        group,
      ),
    );

/** Charts and design elements, whose visibility a bookmark keeps. */
const objectIds = (layout: DashboardLayout) =>
  Object.values(layout)
    .filter(
      item =>
        item.type === CHART_TYPE ||
        (item.type === DYNAMIC_TYPE && !!elementKind(item.meta.componentKey)),
    )
    .map(item => item.id);

/** The current view of the report. */
function captureView(
  state: RootState,
): Pick<Bookmark, 'page' | 'filters' | 'visibility'> {
  const layout = state.dashboardLayout.present;
  const dashboardId = state.dashboardInfo.id;
  const page = topLevelTabs(layout).find(tab =>
    state.dashboardState.activeTabs?.includes(tab.id),
  )?.id;
  const filters: Bookmark['filters'] = {};
  Object.values(state.dataMask).forEach(mask => {
    const id = String(mask.id);
    if (!isNativeFilter(id) && !isCrossFilter(id)) return;
    filters[id] = {
      extraFormData: (mask.extraFormData ?? {}) as Record<string, unknown>,
      filterState: (mask.filterState ?? {}) as Record<string, unknown>,
    };
  });
  const visibility: Record<string, boolean> = {};
  objectIds(layout).forEach(id => {
    visibility[id] =
      visibilityOverride(dashboardId, id) ?? !!layout[id].meta[HIDDEN_KEY];
  });
  return { page, filters, visibility };
}

/** Adds a bookmark of the current view. */
export const addBookmark =
  (name: string) => (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const bookmark: Bookmark = {
      id: nanoid(10),
      name,
      options: DEFAULT_BOOKMARK_OPTIONS,
      ...captureView(state),
    };
    dispatch(
      saveBookmarks(
        [...bookmarksOf(state.dashboardLayout.present), bookmark],
        `bookmark-add:${bookmark.id}`,
      ),
    );
    return bookmark;
  };

/** Replaces the view of a bookmark with the current one. */
export const updateBookmark =
  (id: string) => (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const view = captureView(state);
    dispatch(
      saveBookmarks(
        bookmarksOf(state.dashboardLayout.present).map(bookmark =>
          bookmark.id === id ? { ...bookmark, ...view } : bookmark,
        ),
        `bookmark-update:${id}:${Date.now()}`,
      ),
    );
  };

/** Changes the name or options of a bookmark. */
export const editBookmark =
  (id: string, patch: Partial<Pick<Bookmark, 'name' | 'options'>>) =>
  (dispatch: AppDispatch, getState: GetState) =>
    dispatch(
      saveBookmarks(
        bookmarksOf(getState().dashboardLayout.present).map(bookmark =>
          bookmark.id === id ? { ...bookmark, ...patch } : bookmark,
        ),
        `bookmark-edit:${id}:${Object.keys(patch).join()}`,
      ),
    );

export const deleteBookmark =
  (id: string) => (dispatch: AppDispatch, getState: GetState) =>
    dispatch(
      saveBookmarks(
        bookmarksOf(getState().dashboardLayout.present).filter(
          bookmark => bookmark.id !== id,
        ),
        `bookmark-delete:${id}`,
      ),
    );

/** Moves a bookmark one place up (-1) or down (1). */
export const moveBookmark =
  (id: string, step: -1 | 1) => (dispatch: AppDispatch, getState: GetState) => {
    const bookmarks = [...bookmarksOf(getState().dashboardLayout.present)];
    const index = bookmarks.findIndex(bookmark => bookmark.id === id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= bookmarks.length) return;
    [bookmarks[index], bookmarks[target]] = [
      bookmarks[target],
      bookmarks[index],
    ];
    dispatch(saveBookmarks(bookmarks, `bookmark-move:${id}:${Date.now()}`));
  };

const EMPTY_CROSS_FILTER: DataMask = {
  extraFormData: { filters: [] },
  filterState: { value: null, selectedValues: null },
};

/**
 * Brings back the view of a bookmark. Pages, filters or objects removed since
 * it was saved are skipped.
 */
export const applyBookmark =
  (id: string) => (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const layout = state.dashboardLayout.present;
    const bookmark = bookmarksOf(layout).find(item => item.id === id);
    if (!bookmark) return;
    const { options } = bookmark;

    if (options.data && bookmark.filters) {
      const saved = bookmark.filters;
      Object.values(state.dataMask).forEach(mask => {
        const maskId = String(mask.id);
        // Cross-filters the bookmark did not have are cleared
        if (isCrossFilter(maskId) && !saved[maskId]) {
          dispatch(updateDataMask(maskId, EMPTY_CROSS_FILTER));
        }
      });
      Object.entries(saved).forEach(([maskId, mask]) => {
        const exists = isNativeFilter(maskId)
          ? !!state.nativeFilters.filters[maskId]
          : !!state.charts[maskId];
        if (exists) dispatch(updateDataMask(maskId, mask as DataMask));
      });
    }

    if (options.display && bookmark.visibility) {
      const visibility: Record<string, boolean> = {};
      Object.entries(bookmark.visibility).forEach(([objectId, hidden]) => {
        if (layout[objectId]) visibility[objectId] = hidden;
      });
      setVisibilityOverrides(state.dashboardInfo.id, visibility);
    }

    if (options.page && bookmark.page) {
      const tab = topLevelTabs(layout).find(
        ({ id: tabId }) => tabId === bookmark.page,
      );
      if (tab) {
        dispatch(setDirectPathToChild(tab.path));
        window.scrollTo(0, 0);
      }
    }
  };
