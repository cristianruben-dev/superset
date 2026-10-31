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
import { useEffect, useState } from 'react';
import rison from 'rison';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { addSliceToDashboard } from 'src/dashboard/actions/dashboardState';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DYNAMIC_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_GRID_ID,
  GRID_COLUMN_COUNT,
} from 'src/dashboard/util/constants';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { uploadElementImage } from 'src/mibi/elements/actions';
import {
  ELEMENT_KEY,
  elementKind,
  type ImageElement,
} from 'src/mibi/elements/types';
import { activeTabIndex, topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { updateLayout } from './actions';
import { selectVisual } from './selection';
import { HIDDEN_KEY, LOCKED_KEY } from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

const STORAGE_KEY = 'mibi.clipboard';
const EVENT = 'mibi:clipboard';

/** A copied chart or design element, kept across dashboards of this browser. */
export interface CopiedObject {
  type: typeof CHART_TYPE | typeof DYNAMIC_TYPE;
  dashboardId: number;
  meta: LayoutItem['meta'];
}

let memory: CopiedObject | null = null;

export function readClipboard(): CopiedObject | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CopiedObject) : memory;
  } catch {
    return memory;
  }
}

function writeClipboard(value: CopiedObject) {
  memory = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // the copy lasts for this page only
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useClipboard(): CopiedObject | null {
  const [value, setValue] = useState(readClipboard);
  useEffect(() => {
    const onChange = () => setValue(readClipboard());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return value;
}

export const isCopyable = (item: LayoutItem | undefined) =>
  !!item &&
  (item.type === CHART_TYPE ||
    (item.type === DYNAMIC_TYPE && !!elementKind(item.meta.componentKey)));

/** Copies a chart or a design element. */
export const copyObject =
  (id: string) => (_dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout, dashboardInfo } = getState();
    const item = dashboardLayout.present[id];
    if (!isCopyable(item)) return;
    writeClipboard({
      type: item.type as CopiedObject['type'],
      dashboardId: dashboardInfo.id,
      meta: item.meta,
    });
  };

/** Creates a copy of a chart in a dashboard; returns its id and name. */
async function cloneChart(
  chartId: number,
  dashboardId: number,
): Promise<{ id: number; name: string }> {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/chart/?q=${rison.encode({
      filters: [{ col: 'id', opr: 'eq', value: chartId }],
      columns: [
        'slice_name',
        'viz_type',
        'params',
        'datasource_id',
        'datasource_type',
        'description',
        'cache_timeout',
      ],
    })}`,
  });
  const source = json.result?.[0];
  if (!source) throw new Error('Chart not found');
  const name = t('%s (copy)', source.slice_name);
  const created = await SupersetClient.post({
    endpoint: '/api/v1/chart/',
    jsonPayload: {
      slice_name: name,
      viz_type: source.viz_type,
      params: source.params,
      datasource_id: source.datasource_id,
      datasource_type: source.datasource_type,
      description: source.description ?? undefined,
      cache_timeout: source.cache_timeout ?? undefined,
      dashboards: [dashboardId],
    },
  });
  return { id: created.json.id as number, name };
}

/** A picture uploaded to another dashboard, uploaded again to this one. */
async function copyPicture(
  element: ImageElement,
  fromDashboard: number,
  toDashboard: number,
): Promise<ImageElement> {
  if (fromDashboard === toDashboard || !element.imageId || !element.src) {
    return element;
  }
  const blob = await (await fetch(element.src)).blob();
  const file = new File([blob], element.alt || 'image', { type: blob.type });
  const image = await uploadElementImage(toDashboard, file);
  return { ...element, src: image.url, imageId: image.id };
}

const usedColumns = (row: LayoutItem, layout: Record<string, LayoutItem>) =>
  row.children.reduce(
    (sum, childId) => sum + Number(layout[childId]?.meta?.width ?? 0),
    0,
  );

/**
 * Puts a new component next to ``afterId`` (in its row when it fits, else in
 * a new row below), or in a new row at the end of the page on screen.
 */
export function placeComponent(
  layout: Record<string, LayoutItem>,
  component: LayoutItem,
  afterId: string | null,
  activeTabs: string[] | undefined,
): Record<string, LayoutItem> {
  const width = Number(component.meta.width ?? GRID_COLUMN_COUNT);
  const after = afterId ? layout[afterId] : undefined;
  const parentId = after?.parents?.[after.parents.length - 1];
  const parent = parentId ? layout[parentId] : undefined;

  if (after && parent?.type === ROW_TYPE) {
    if (usedColumns(parent, layout) + width <= GRID_COLUMN_COUNT) {
      const children = [...parent.children];
      children.splice(children.indexOf(after.id) + 1, 0, component.id);
      return {
        [component.id]: {
          ...component,
          parents: [...(parent.parents ?? []), parent.id],
        },
        [parent.id]: { ...parent, children },
      };
    }
  }

  // A new row: below the row of ``afterId``, or at the end of the page
  let containerId: string;
  let index: number;
  if (after && parent?.type === ROW_TYPE) {
    containerId = parent.parents![parent.parents!.length - 1];
    index = layout[containerId].children.indexOf(parent.id) + 1;
  } else {
    const tabs = topLevelTabs(layout);
    containerId = tabs.length
      ? tabs[activeTabIndex(tabs, activeTabs)].id
      : DASHBOARD_GRID_ID;
    index = layout[containerId].children.length;
  }
  const container = layout[containerId];
  const row = newComponentFactory(ROW_TYPE) as unknown as LayoutItem;
  const rowParents = [...(container.parents ?? []), container.id];
  const children = [...container.children];
  children.splice(index, 0, row.id);
  return {
    [row.id]: { ...row, parents: rowParents, children: [component.id] },
    [component.id]: { ...component, parents: [...rowParents, row.id] },
    [container.id]: { ...container, children },
  };
}

/** Pastes the copied object next to the selected one, or at the end. */
export const pasteObject =
  (afterId: string | null) =>
  async (dispatch: AppDispatch, getState: GetState) => {
    const copied = readClipboard();
    if (!copied) return;
    const { dashboardInfo } = getState();
    const dashboardId = dashboardInfo.id;
    // A pasted object is visible and free to move
    const meta = { ...copied.meta };
    delete meta[HIDDEN_KEY];
    delete meta[LOCKED_KEY];

    let component: LayoutItem;
    if (copied.type === CHART_TYPE) {
      const chart = await cloneChart(Number(meta.chartId), dashboardId);
      await dispatch(
        fetchSlices(undefined, '', 'changed_on', dashboardId) as never,
      );
      await dispatch(addSliceToDashboard(chart.id) as never);
      delete meta.uuid;
      delete meta.sliceNameOverride;
      component = newComponentFactory(CHART_TYPE, {
        ...meta,
        chartId: chart.id,
        sliceName: chart.name,
      }) as unknown as LayoutItem;
    } else {
      if (meta[ELEMENT_KEY] && elementKind(meta.componentKey) === 'image') {
        meta[ELEMENT_KEY] = await copyPicture(
          meta[ELEMENT_KEY] as ImageElement,
          copied.dashboardId,
          dashboardId,
        );
      }
      component = newComponentFactory(
        DYNAMIC_TYPE,
        meta,
      ) as unknown as LayoutItem;
    }

    const { dashboardLayout, dashboardState } = getState();
    const next = placeComponent(
      dashboardLayout.present,
      component,
      afterId && dashboardLayout.present[afterId] ? afterId : null,
      dashboardState.activeTabs,
    );
    dispatch(updateLayout(next, `paste-object:${component.id}`));
    selectVisual(component.id);
  };

/** Copies an object and pastes it right after itself. */
export const duplicateObject =
  (id: string) => async (dispatch: AppDispatch) => {
    dispatch(copyObject(id));
    await dispatch(pasteObject(id));
  };
