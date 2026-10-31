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
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { NativeFilterScope } from '@superset-ui/core';
import { dashboardInfoChanged } from 'src/dashboard/actions/dashboardInfo';
import { setUnsavedChanges } from 'src/dashboard/actions/dashboardState';
import { DEFAULT_CROSS_FILTER_SCOPING } from 'src/dashboard/constants';
import {
  isCrossFilterScopeGlobal,
  type ChartConfiguration,
  type DashboardInfo,
  type GetState,
  type RootState,
} from 'src/dashboard/types';
import { getChartIdsInFilterScope } from 'src/dashboard/util/getChartIdsInFilterScope';

/**
 * "Edit interactions", as in Power BI: for the chart selected while editing,
 * choose which other charts its cross-filters reach. Stored in the cross-filter
 * scope of the dashboard metadata (chart_configuration), so it saves with the
 * dashboard and Discard throws it away. Superset charts filter each other but
 * cannot highlight, so the choices are "filter" and "none".
 */

export type InteractionMode = 'filter' | 'none';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

const EVENT = 'mibi:edit-interactions';
let editing = false;

/**
 * Whether "Edit interactions" is on. The source is the chart selected in the
 * Format pane; every other chart shows whether the source filters it.
 */
export const isEditingInteractions = () => editing;

export function setEditingInteractions(next: boolean) {
  if (editing === next) return;
  editing = next;
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useEditingInteractions(): boolean {
  const [value, setValue] = useState(editing);
  useEffect(() => {
    const onChange = () => setValue(editing);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}

/** Marks the interaction controls, so clicking them keeps the selection. */
export const INTERACTION_CONTROL = 'data-mibi-interaction';

export const isInteractionControl = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest(`[${INTERACTION_CONTROL}]`);

/** The explicit cross-filter scope of a chart (the global one copied over). */
export function crossFilterScope(
  metadata: DashboardInfo['metadata'],
  chartId: number,
): NativeFilterScope {
  const scope = metadata?.chart_configuration?.[chartId]?.crossFilters?.scope;
  if (scope && !isCrossFilterScopeGlobal(scope)) return scope;
  return (
    metadata?.global_chart_configuration?.scope ?? DEFAULT_CROSS_FILTER_SCOPING
  );
}

/** Whether cross-filters of ``sourceId`` reach ``targetId``. */
export function interactionMode(
  metadata: DashboardInfo['metadata'],
  sourceId: number,
  targetId: number,
): InteractionMode {
  return crossFilterScope(metadata, sourceId).excluded.includes(targetId)
    ? 'none'
    : 'filter';
}

/** Makes the cross-filters of ``sourceId`` reach ``targetId`` or not. */
export const setInteraction =
  (sourceId: number, targetId: number, mode: InteractionMode) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardInfo, dashboardLayout, charts } = getState();
    const { metadata } = dashboardInfo;
    const scope = crossFilterScope(metadata, sourceId);
    const excluded = new Set(scope.excluded);
    if (mode === 'none') excluded.add(targetId);
    else excluded.delete(targetId);
    const nextScope: NativeFilterScope = {
      ...scope,
      excluded: [...excluded],
    };
    // Applied filters read chartsInScope; saving rebuilds it from the scope
    const chartsInScope = getChartIdsInFilterScope(
      nextScope,
      Object.values(charts).map(chart => chart.id),
      Object.values(dashboardLayout.present),
    ).filter(id => id !== sourceId);
    const chartConfiguration: ChartConfiguration = {
      ...metadata?.chart_configuration,
      [sourceId]: {
        id: sourceId,
        crossFilters: { scope: nextScope, chartsInScope },
      },
    };
    dispatch(
      dashboardInfoChanged({
        metadata: { ...metadata, chart_configuration: chartConfiguration },
      }),
    );
    dispatch(setUnsavedChanges(true));
  };
