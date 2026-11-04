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
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { mergeVisualFormat } from './styles';
import type { CanvasFormat, VisualFormat } from './types';

const selectShared = (state: RootState) =>
  (
    state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas as
      | CanvasFormat
      | undefined
  )?.visuals;

/** The style every chart of the dashboard shares, if any. */
export const useSharedVisualFormat = () => useSelector(selectShared);

/** A chart's own format over the style every chart shares. */
export function useMergedVisualFormat(
  own: VisualFormat | undefined,
): VisualFormat | undefined {
  const shared = useSelector(selectShared);
  return useMemo(() => mergeVisualFormat(shared, own), [shared, own]);
}

/** The format the chart of a layout component shows. */
export function useVisualFormat(
  componentId: string | undefined,
): VisualFormat | undefined {
  const own = useSelector((state: RootState) =>
    componentId
      ? (state.dashboardLayout?.present?.[componentId]?.meta?.mibiFormat as
          | VisualFormat
          | undefined)
      : undefined,
  );
  return useMergedVisualFormat(own);
}
