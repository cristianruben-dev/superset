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
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type {
  BinaryQueryObjectFilterClause,
  DataMaskStateWithId,
} from '@superset-ui/core';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import type { DashboardLayout, GetState, RootState } from 'src/dashboard/types';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import {
  topLevelTabs,
  type DashboardTab,
} from 'src/mibi/present/dashboardTabs';
import {
  DRILLTHROUGH_ID,
  DRILLTHROUGH_STATE_KEY,
  type DrillthroughField,
  type DrillthroughState,
} from './drillthroughScope';
import { DRILLTHROUGH_PAGE_KEY, type DrillthroughPage } from './types';

/**
 * "Drill through", as in Power BI: right-click a data point and open another
 * page filtered to it. The page lists the columns it accepts; the filter is a
 * data mask of its own, applied only to the charts of that page whose dataset
 * has those columns, and dropped when the dashboard reloads.
 */

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

export type { DrillthroughField, DrillthroughState } from './drillthroughScope';

export interface DrillthroughTarget {
  tab: DashboardTab;
  columns: string[];
}

/** Top level pages set up to receive a drill through. */
export function drillthroughPages(
  layout: DashboardLayout,
): DrillthroughTarget[] {
  return topLevelTabs(layout)
    .map(tab => ({
      tab,
      columns:
        (
          layout[tab.id]?.meta?.[DRILLTHROUGH_PAGE_KEY] as
            | DrillthroughPage
            | undefined
        )?.columns ?? [],
    }))
    .filter(({ columns }) => columns.length > 0);
}

/** The drill through applied to the dashboard, if any. */
export function activeDrillthrough(
  dataMask: DataMaskStateWithId,
  dashboardId: number,
): DrillthroughState | undefined {
  const state = dataMask[DRILLTHROUGH_ID]?.filterState?.[
    DRILLTHROUGH_STATE_KEY
  ] as DrillthroughState | undefined;
  return state?.dashboardId === dashboardId ? state : undefined;
}

/** The clicked point's values, one per plain column. */
export function pointFields(
  clauses: BinaryQueryObjectFilterClause[] | undefined,
): DrillthroughField[] {
  const fields: DrillthroughField[] = [];
  (clauses ?? []).forEach(clause => {
    if (
      typeof clause.col === 'string' &&
      clause.op === '==' &&
      !fields.some(field => field.column === clause.col)
    ) {
      fields.push({
        column: clause.col,
        value: clause.val,
        label: clause.formattedVal ?? String(clause.val),
      });
    }
  });
  return fields;
}

function datasetColumns(state: RootState, chartId: number): Set<string> {
  const datasource = state.charts[chartId]?.form_data?.datasource;
  const columns = datasource ? state.datasources[datasource]?.columns : [];
  return new Set((columns ?? []).map(column => column.column_name));
}

const activeTopTab = (state: RootState) => {
  const { activeTabs } = state.dashboardState;
  return topLevelTabs(state.dashboardLayout.present).find(tab =>
    activeTabs?.includes(tab.id),
  )?.id;
};

/** Opens ``tabId`` filtered to the values of the clicked point. */
export const drillThrough =
  (tabId: string, point: DrillthroughField[]) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const layout = state.dashboardLayout.present;
    const target = drillthroughPages(layout).find(
      page => page.tab.id === tabId,
    );
    if (!target) return;
    const fields = point.filter(field => target.columns.includes(field.column));
    if (!fields.length) return;
    // Only charts whose dataset has every column; the rest stay as they are
    const chartsInScope = Object.values(layout)
      .filter(item => item.type === CHART_TYPE && item.parents?.includes(tabId))
      .map(item => Number(item.meta.chartId))
      .filter(chartId => {
        const columns = datasetColumns(state, chartId);
        return fields.every(field => columns.has(field.column));
      });
    const drillthrough: DrillthroughState = {
      dashboardId: state.dashboardInfo.id,
      tabId,
      sourceTabId: activeTopTab(state),
      chartsInScope,
      fields,
    };
    dispatch(
      updateDataMask(DRILLTHROUGH_ID, {
        extraFormData: {
          filters: fields.map(field => ({
            col: field.column,
            op: 'IN' as const,
            val: [field.value] as (string | number | boolean)[],
          })),
        },
        filterState: {
          value: fields.map(field => field.label),
          [DRILLTHROUGH_STATE_KEY]: drillthrough,
        },
      }),
    );
    dispatch(setDirectPathToChild(target.tab.path));
    window.scrollTo(0, 0);
  };

/** Removes the drill through; with ``back``, also returns to its page. */
export const leaveDrillthrough =
  (back = false) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const current = activeDrillthrough(state.dataMask, state.dashboardInfo.id);
    dispatch(removeDataMask(DRILLTHROUGH_ID));
    if (back && current?.sourceTabId) {
      const tab = topLevelTabs(state.dashboardLayout.present).find(
        ({ id }) => id === current.sourceTabId,
      );
      if (tab) dispatch(setDirectPathToChild(tab.path));
    }
  };

export { DRILLTHROUGH_ID };
