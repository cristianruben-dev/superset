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
import { memo, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEmpty, isEqual } from 'lodash';
import { DataMask, DataMaskStateWithId, Filter } from '@superset-ui/core';
import { updateDataMask } from 'src/dataMask/actions';
import { FilterBarOrientation, RootState } from 'src/dashboard/types';
import FilterControl from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/FilterControl';
import { FilterElement } from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/types';

type CanvasFilterControlProps = {
  filter: Filter;
};

const sameExtraFormData = (
  a: DataMask['extraFormData'],
  b: DataMask['extraFormData'],
) => (isEmpty(a) && isEmpty(b)) || isEqual(a, b);

/**
 * Returns true when `next` would change what is applied to the charts.
 * Filter plugins report their value on mount and whenever their data
 * reloads; those echoes of the applied state must not be dispatched.
 */
export function isCanvasSelectionChange(
  applied: DataMask | undefined,
  next: DataMask,
): boolean {
  return (
    !isEqual(next.filterState?.value, applied?.filterState?.value) ||
    !sameExtraFormData(next.extraFormData, applied?.extraFormData)
  );
}

/**
 * A native filter control rendered on the dashboard canvas. Unlike the
 * filter bar, it has no pending state: every selection is applied to the
 * charts immediately, and the filter bar picks it up from the applied
 * data mask.
 */
const CanvasFilterControl = ({ filter }: CanvasFilterControlProps) => {
  const dispatch = useDispatch();
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const appliedDataMask = dataMask[filter.id];
  const appliedRef = useRef(appliedDataMask);
  appliedRef.current = appliedDataMask;

  const filterWithDataMask = useMemo(
    () => ({ ...filter, dataMask: appliedDataMask }),
    [filter, appliedDataMask],
  );

  const handleSelectionChange = useCallback(
    (_: FilterElement, nextDataMask: DataMask) => {
      if (!isCanvasSelectionChange(appliedRef.current, nextDataMask)) {
        return;
      }
      const { filterState } = nextDataMask;
      dispatch(
        updateDataMask(filter.id, {
          ...nextDataMask,
          ...(filterState && {
            filterState: { ...filterState, validateStatus: undefined },
          }),
        }),
      );
    },
    [dispatch, filter.id],
  );

  return (
    <FilterControl
      filter={filterWithDataMask}
      dataMaskSelected={dataMask}
      onFilterSelectionChange={handleSelectionChange}
      orientation={FilterBarOrientation.Vertical}
      inView
    />
  );
};

export default memo(CanvasFilterControl);
