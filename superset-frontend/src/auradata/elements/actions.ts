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
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
  VizType,
  type QueryFormData,
} from '@superset-ui/core';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { selectChartCustomizationFromRedux } from 'src/dashboard/components/nativeFilters/state';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { removeDataMask, updateDataMask } from 'src/dataMask/actions';
import { exportChart } from 'src/explore/exploreUtils';
import { enforceSharedLabelsColorsArray } from 'src/utils/colorScheme';
import { updateLayout } from 'src/auradata/format/actions';
import {
  layoutChartFormat,
  withChartFormat,
} from 'src/auradata/format/chartFormat';
import { topLevelTabs } from 'src/auradata/present/dashboardTabs';
import { applyBookmark } from 'src/auradata/report/bookmarks';
import {
  activeDrillthrough,
  leaveDrillthrough,
} from 'src/auradata/report/drillthrough';
import { DRILLTHROUGH_ID } from 'src/auradata/report/drillthroughScope';
import { goBackTo } from 'src/auradata/report/pageHistory';
import { navigateTo } from 'src/utils/navigationUtils';
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

export interface ElementActionOptions {
  /** Chart owning the action button or header link; used when action.chartId is omitted */
  chartId?: number;
}

function buildExportFormData(
  state: RootState,
  chartId: number,
): QueryFormData | undefined {
  const chart = state.charts[chartId];
  if (!chart?.form_data) return undefined;
  const layout = state.dashboardLayout.present;
  const metadata = state.dashboardInfo.metadata ?? {};
  const componentId = Object.values(layout).find(
    item => item.type === CHART_TYPE && Number(item.meta?.chartId) === chartId,
  )?.id;
  const formData = (
    componentId
      ? withChartFormat(chart.form_data, layoutChartFormat(layout, componentId))
      : chart.form_data
  ) as QueryFormData;
  return getFormDataWithExtraFilters({
    chart: { id: chartId, form_data: formData },
    chartConfiguration: metadata.chart_configuration,
    chartCustomizationItems: selectChartCustomizationFromRedux(state) as never,
    filters: getAppliedFilterValues(chartId),
    colorScheme: state.dashboardState.colorScheme,
    colorNamespace: (state.dashboardState as { colorNamespace?: string })
      .colorNamespace,
    sliceId: chartId,
    nativeFilters: state.nativeFilters?.filters,
    allSliceIds: state.dashboardState.sliceIds,
    dataMask: state.dataMask,
    extraControls: {},
    labelsColor: metadata.label_colors || {},
    labelsColorMap: metadata.map_label_colors || {},
    sharedLabelsColors: enforceSharedLabelsColorsArray(
      metadata.shared_label_colors,
    ),
    ownColorScheme: chart.form_data.color_scheme as string | undefined,
  }) as unknown as QueryFormData;
}

/** Runs what an element does when clicked. */
export function runElementAction(
  action: ElementAction | undefined,
  dispatch: AppDispatch,
  getState: GetState,
  options?: ElementActionOptions,
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
    navigateTo(action.url!.trim(), {
      newWindow: !!action.newTab,
      assign: !action.newTab,
    });
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
    // Cross-filters and a drill through are selections too
    Object.keys(state.dataMask ?? {})
      .filter(id => /^\d+$/.test(id))
      .forEach(id =>
        dispatch(
          updateDataMask(id, {
            extraFormData: { filters: [] },
            filterState: { value: null, selectedValues: null },
          }),
        ),
      );
    dispatch(removeDataMask(DRILLTHROUGH_ID));
  } else if (action.type === 'bookmark' && action.bookmarkId) {
    dispatch(applyBookmark(action.bookmarkId));
  } else if (action.type === 'back') {
    if (activeDrillthrough(state.dataMask, state.dashboardInfo.id)) {
      dispatch(leaveDrillthrough(true));
      return;
    }
    const previous = goBackTo();
    const tab = topLevelTabs(state.dashboardLayout.present).find(
      ({ id }) => id === previous,
    );
    if (tab) {
      dispatch(setDirectPathToChild(tab.path));
      window.scrollTo(0, 0);
    }
  } else if (action.type === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (action.type === 'export') {
    const canDownload = Boolean(
      (state.dashboardInfo as { superset_can_download?: boolean })
        ?.superset_can_download,
    );
    if (!canDownload) {
      dispatch(
        addDangerToast(
          t('You do not have permission to export data from this report.'),
        ),
      );
      return;
    }
    const targetChartId = action.chartId ?? options?.chartId;
    if (!targetChartId) return;
    const baseFormData = buildExportFormData(state, targetChartId);
    if (!baseFormData) return;
    const format = action.exportFormat ?? 'xlsx';
    const isFull = format === 'full_csv' || format === 'full_xlsx';
    const resultFormat =
      format === 'csv' || format === 'full_csv' ? 'csv' : 'xlsx';
    const maxRows = state.dashboardInfo.common?.conf?.SQL_MAX_ROW as
      | number
      | undefined;
    const exportFormData =
      isFull && isFeatureEnabled(FeatureFlag.AllowFullCsvExport) && maxRows
        ? { ...baseFormData, row_limit: maxRows }
        : baseFormData;
    const isPivot = baseFormData.viz_type === VizType.PivotTable;
    const resultType = isPivot ? 'post_processed' : 'full';
    const ownState =
      (state.dataMask?.[targetChartId]?.ownState as Record<string, unknown>) ||
      {};
    Promise.resolve(
      exportChart({
        formData: exportFormData,
        resultType,
        resultFormat,
        ownState,
      }),
    ).catch(
      (error: Error & { status?: number; response?: { status?: number } }) => {
        const status = error?.status || error?.response?.status;
        if (status === 413) {
          dispatch(
            addDangerToast(
              t(
                'The chart data is too large to download. Please try reducing the date range, limiting rows, or using fewer columns.',
              ),
            ),
          );
        } else {
          dispatch(
            addDangerToast(
              error?.message ||
                t(
                  'Failed to export chart data. Please try again or contact your administrator.',
                ),
            ),
          );
        }
      },
    );
  }
}

/** A click handler for an element action, or undefined when it does nothing. */
export function useElementAction(
  action: ElementAction | undefined,
  enabled: boolean,
  options?: ElementActionOptions,
) {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const canDownload = useSelector((state: RootState) =>
    Boolean(
      (state.dashboardInfo as { superset_can_download?: boolean })
        ?.superset_can_download,
    ),
  );
  const optionChartId = options?.chartId;
  const run = useCallback(
    () =>
      runElementAction(
        action,
        dispatch,
        store.getState,
        optionChartId ? { chartId: optionChartId } : undefined,
      ),
    [action, dispatch, store, optionChartId],
  );
  if (!enabled || !action || action.type === 'none') return undefined;
  if (action.type === 'export') {
    const targetChartId = action.chartId ?? optionChartId;
    return canDownload && targetChartId ? run : undefined;
  }
  return run;
}
