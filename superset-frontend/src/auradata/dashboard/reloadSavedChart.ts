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
import { addSliceToDashboard } from 'src/dashboard/actions/dashboardState';
import { fetchSlices } from 'src/dashboard/actions/sliceEntities';
import type { GetState, RootState } from 'src/dashboard/types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/** Fetches the saved definitions (form data, name) of the dashboard's charts. */
export const fetchDashboardSlices =
  () => (dispatch: AppDispatch, getState: GetState) =>
    dispatch(
      fetchSlices(
        undefined,
        undefined,
        'changed_on',
        getState().dashboardInfo.id,
      ) as never,
    );

/** Reloads a chart in place with the definition saved on the server. */
export const reloadSavedChart =
  (chartId: number) => async (dispatch: AppDispatch) => {
    await dispatch(fetchDashboardSlices());
    await dispatch(addSliceToDashboard(chartId) as never);
  };
