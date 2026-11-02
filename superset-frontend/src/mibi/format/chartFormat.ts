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
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash';
import { renderTriggered } from 'src/components/Chart/chartAction';
import type { RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import type { CanvasFormat, VisualFormat } from './types';

type ChartFormat = NonNullable<VisualFormat['chart']>;

/**
 * The saved settings of a chart with what its report changes on top. Keeps the
 * same object when the report changes nothing, so charts without a format
 * render exactly as before.
 */
export function withChartFormat<T extends object>(
  formData: T | undefined,
  format: ChartFormat | undefined,
): T | undefined {
  return format && formData ? { ...formData, ...format } : formData;
}

/** What the layout changes of a chart: its own settings over the shared ones. */
export function useChartFormat(componentId: string): ChartFormat | undefined {
  return useSelector((state: RootState) => {
    const layout = state.dashboardLayout?.present;
    const own = (layout?.[componentId]?.meta?.mibiFormat as VisualFormat)
      ?.chart;
    const shared = (
      layout?.[DASHBOARD_ROOT_ID]?.meta?.mibiCanvas as CanvasFormat | undefined
    )?.visuals?.chart;
    return own || shared ? { ...shared, ...own } : undefined;
  }, isEqual);
}

/**
 * Charts repaint on request only. A change of format, undone or not, repaints
 * the chart with the data it already has.
 */
export function useRepaintOnChartFormat(
  chartId: number,
  format: ChartFormat | undefined,
) {
  const dispatch = useDispatch();
  const shown = useRef(format);
  useEffect(() => {
    if (shown.current === format) return;
    shown.current = format;
    dispatch(renderTriggered(Date.now(), chartId));
  }, [chartId, dispatch, format]);
}
