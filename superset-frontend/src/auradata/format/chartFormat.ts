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
import { isEqual } from 'lodash-es';
import { renderTriggered } from 'src/components/Chart/chartAction';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import type { CanvasFormat, VisualFormat } from './types';
import { mergeVisualFormat } from './styles';

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

/** Read older card styles as defaults for the unified controls without rewriting saved layouts. */
export function legacyCardFormat(
  format: VisualFormat | undefined,
): ChartFormat {
  const result: ChartFormat = {};
  for (const [key, source] of [
    ['card_value', format?.value],
    ['card_label', format?.label],
    ['card_subtitle', format?.label],
  ] as const) {
    if (!source) continue;
    const { size, color, bold, italic } = source;
    result[`${key}_font`] = { fontSize: size, color, bold, italic };
  }
  if (format?.value?.align) result.card_value_align = format.value.align;
  return result;
}

/** What the layout changes of the chart of a component, outside React. */
export function layoutChartFormat(
  layout: DashboardLayout | undefined,
  componentId: string,
): ChartFormat | undefined {
  const own = layout?.[componentId]?.meta?.auradataFormat as
    | VisualFormat
    | undefined;
  const shared = (
    layout?.[DASHBOARD_ROOT_ID]?.meta?.auradataCanvas as
      | CanvasFormat
      | undefined
  )?.visuals;
  const legacy = legacyCardFormat(mergeVisualFormat(shared, own));
  return own?.chart || shared?.chart || Object.keys(legacy).length
    ? { ...legacy, ...shared?.chart, ...own?.chart }
    : undefined;
}

/** What the layout changes of a chart: its own settings over the shared ones. */
export function useChartFormat(componentId: string): ChartFormat | undefined {
  return useSelector(
    (state: RootState) =>
      layoutChartFormat(state.dashboardLayout?.present, componentId),
    isEqual,
  );
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
