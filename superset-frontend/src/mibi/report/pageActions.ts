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
import { t } from '@apache-superset/core/translation';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import {
  addSliceToDashboard,
  setDirectPathToChild,
} from 'src/dashboard/actions/dashboardState';
import {
  createComponent,
  createTopLevelTabs,
} from 'src/dashboard/actions/dashboardLayout';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import {
  CHART_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_COMPONENTS_SOURCE_ID,
  NEW_TABS_ID,
  NEW_TAB_ID,
} from 'src/dashboard/util/constants';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { cloneChart } from 'src/mibi/format/clipboard';
import { GROUP_KEY } from 'src/mibi/format/arrange';
import { updateLayout } from 'src/mibi/format/actions';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** Adds a page at the end of the report, making its first tabs if it has none. */
export const insertPage = () => (dispatch: AppDispatch, getState: GetState) => {
  const layout = getState().dashboardLayout.present;
  const top = layout[layout[DASHBOARD_ROOT_ID]?.children?.[0]];
  if (top?.type === TABS_TYPE) {
    dispatch(
      createComponent({
        destination: {
          id: top.id,
          type: top.type,
          index: top.children.length,
        },
        dragging: { id: NEW_TAB_ID, type: TAB_TYPE },
      } as DropResult),
    );
    return;
  }
  dispatch(
    createTopLevelTabs({
      source: { id: NEW_COMPONENTS_SOURCE_ID },
      dragging: { id: NEW_TABS_ID, type: TABS_TYPE },
    } as DropResult),
  );
};

/**
 * Copies a page right after itself. As a chart belongs to one dashboard place,
 * its charts are copied too (keeping their names, as they are on another page).
 */
export const duplicatePage =
  (pageId: string) => async (dispatch: AppDispatch, getState: GetState) => {
    const start = getState();
    const layout = start.dashboardLayout.present;
    const page = layout[pageId];
    const parentId = page?.parents?.[page.parents.length - 1];
    const parent = parentId ? layout[parentId] : undefined;
    if (!page || !parent) return;
    const dashboardId = start.dashboardInfo.id;

    // Charts first: a failure leaves the layout as it was
    const chartIds: number[] = [];
    const collect = (id: string) => {
      const item = layout[id];
      if (!item) return;
      if (item.type === CHART_TYPE) chartIds.push(Number(item.meta.chartId));
      (item.children ?? []).forEach(collect);
    };
    collect(pageId);
    const clones = new Map<number, { id: number; name: string }>();
    for (const chartId of chartIds) {
      // One after the other: the server handles a request at a time
      // eslint-disable-next-line no-await-in-loop
      const clone = await cloneChart(chartId, dashboardId, { keepName: true });
      clones.set(chartId, clone);
    }
    if (chartIds.length) {
      await dispatch(
        fetchSlices(undefined, '', 'changed_on', dashboardId) as never,
      );
      for (const clone of clones.values()) {
        // eslint-disable-next-line no-await-in-loop
        await dispatch(addSliceToDashboard(clone.id) as never);
      }
    }

    const fresh = getState().dashboardLayout.present;
    const next: Record<string, LayoutItem> = {};
    const groups = new Map<string, string>();
    const copy = (id: string, parents: string[]): string => {
      const item = fresh[id];
      const meta = { ...item.meta };
      delete meta.uuid;
      if (item.type === CHART_TYPE) {
        const clone = clones.get(Number(meta.chartId))!;
        meta.chartId = clone.id;
        meta.sliceName = clone.name;
        delete meta.sliceNameOverride;
      }
      const group = meta[GROUP_KEY] as string | undefined;
      if (group) {
        if (!groups.has(group)) {
          groups.set(group, `g-${Date.now().toString(36)}-${groups.size}`);
        }
        meta[GROUP_KEY] = groups.get(group);
      }
      const made = newComponentFactory(
        item.type,
        meta,
      ) as unknown as LayoutItem;
      const childParents = [...parents, made.id];
      next[made.id] = {
        ...made,
        parents,
        children: (item.children ?? []).map(child => copy(child, childParents)),
      };
      return made.id;
    };
    const parentPath = [...(parent.parents ?? []), parent.id];
    const newId = copy(pageId, parentPath);
    next[newId] = {
      ...next[newId],
      meta: {
        ...next[newId].meta,
        text: t('%s (copy)', String(page.meta?.text ?? '')),
      },
    };
    const children = [...fresh[parent.id].children];
    children.splice(children.indexOf(pageId) + 1, 0, newId);
    next[parent.id] = { ...fresh[parent.id], children };
    dispatch(updateLayout(next, `duplicate-page:${newId}`));
    dispatch(setDirectPathToChild([...parentPath, newId]));
  };
