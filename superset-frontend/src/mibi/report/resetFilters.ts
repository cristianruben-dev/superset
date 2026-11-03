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
import { isEqual } from 'lodash';
import type { DataMask } from '@superset-ui/core';
import type { GetState, RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { getInitialDataMask } from 'src/dataMask/reducer';
import { EMPTY_CROSS_FILTER, isCrossFilter } from './bookmarks';
import { activeDrillthrough, leaveDrillthrough } from './drillthrough';
import { setVisibilityOverrides } from './visibility';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/**
 * The data masks that bring the report back to how it was saved: each filter
 * and slicer with its default value (empty without one) and every
 * cross-filter cleared.
 */
export function savedDataMasks(
  state: Pick<RootState, 'dataMask' | 'nativeFilters'>,
): Record<string, DataMask> {
  const masks: Record<string, DataMask> = {};
  Object.values(state.nativeFilters?.filters ?? {}).forEach(filter => {
    if (!('defaultDataMask' in filter)) return;
    masks[filter.id] = getInitialDataMask(
      undefined,
      (filter.defaultDataMask ?? {}) as DataMask,
    ) as DataMask;
  });
  Object.values(state.dataMask ?? {}).forEach(mask => {
    const id = String(mask.id);
    if (isCrossFilter(id) && (mask.extraFormData?.filters?.length ?? 0) > 0) {
      masks[id] = EMPTY_CROSS_FILTER;
    }
  });
  return masks;
}

/**
 * "Reset to default", as in Power BI: filters, slicers and cross-filters go
 * back to the saved state of the report, a drill through is left and the
 * objects a bookmark showed or hid take their own visibility again.
 */
export const resetFilters =
  () => (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    Object.entries(savedDataMasks(state)).forEach(([id, mask]) =>
      dispatch(updateDataMask(id, mask)),
    );
    dispatch(leaveDrillthrough());
    setVisibilityOverrides(state.dashboardInfo.id, {});
  };

const valueOf = (mask: DataMask | undefined) => ({
  value: mask?.filterState?.value ?? null,
  filters: mask?.extraFormData ?? {},
});

/** Whether filters, slicers, cross-filters or a drill through changed. */
export function filtersChanged(
  state: Pick<RootState, 'dataMask' | 'nativeFilters' | 'dashboardInfo'>,
): boolean {
  if (activeDrillthrough(state.dataMask, state.dashboardInfo.id)) return true;
  return Object.entries(savedDataMasks(state)).some(
    ([id, saved]) => !isEqual(valueOf(state.dataMask[id]), valueOf(saved)),
  );
}
