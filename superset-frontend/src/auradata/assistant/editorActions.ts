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
import type { AnyAction } from 'redux';
import type { History } from 'history';
import type { ThunkDispatch } from 'redux-thunk';
import { keepEditingOnSave } from 'src/dashboard/actions/dashboardState';
import { clearDashboardHistory } from 'src/dashboard/actions/dashboardLayout';
import { setDatasources } from 'src/dashboard/actions/datasources';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import type { GetState, RootState } from 'src/dashboard/types';
import {
  dashboardEndpoint,
  dashboardFromApi,
  datasetsFromApi,
} from 'src/hooks/apiResources/dashboards';
import { clearPendingFields } from '../format/chartFields';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

let save: (() => void) | null = null;

/** The header owns saving a report: it lends it to the assistant while it is up. */
export function setReportSave(next: (() => void) | null) {
  save = next;
}

/** Saves the report and stays in the editor, where the panel is. */
export const saveReport = () => (dispatch: AppDispatch) => {
  if (!save) return;
  dispatch(keepEditingOnSave());
  save();
};

/**
 * Reads the saved report again and shows it, without leaving the editor: what the
 * assistant changed, or the saved version over unsaved changes. The page, the filters
 * and the charts' cached state follow the same path as opening the report.
 */
export const reloadReport =
  (history: History) => async (dispatch: AppDispatch, getState: GetState) => {
    const { id } = getState().dashboardInfo;
    const [dashboard, charts, datasets] = await Promise.all([
      SupersetClient.get({ endpoint: dashboardEndpoint(id) }),
      SupersetClient.get({ endpoint: `/api/v1/dashboard/${id}/charts` }),
      SupersetClient.get({ endpoint: `/api/v1/dashboard/${id}/datasets` }),
    ]);
    clearPendingFields();
    dispatch(setDatasources(datasetsFromApi(datasets.json.result)));
    dispatch(
      hydrateDashboard({
        history,
        dashboard: dashboardFromApi(dashboard.json.result),
        charts: charts.json.result,
        dataMask: getState().dataMask,
        activeTabs: getState().dashboardState.activeTabs ?? null,
        chartStates: null,
        editMode: true,
      } as unknown as Parameters<typeof hydrateDashboard>[0]),
    );
    dispatch(clearDashboardHistory());
  };
