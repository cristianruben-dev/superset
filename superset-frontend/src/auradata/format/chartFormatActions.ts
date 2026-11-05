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
import { isEqual } from 'lodash-es';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { setVisualFormat } from './actions';
import type { CanvasFormat, VisualFormat } from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

const withChart = (
  format: VisualFormat,
  chart: NonNullable<VisualFormat['chart']>,
): VisualFormat | undefined => {
  const { chart: _previous, ...rest } = format;
  const next: VisualFormat = Object.keys(chart).length
    ? { ...rest, chart }
    : rest;
  return Object.keys(next).length ? next : undefined;
};

/**
 * Changes a setting of a chart in the layout of its report. A value equal to what
 * the chart saved takes no room, unless it overrides the style charts share.
 */
export const setChartFormatValue =
  (id: string, chartId: number, name: string, value: unknown) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const state = getState();
    const layout = state.dashboardLayout.present;
    const own = (layout[id]?.meta?.auradataFormat ?? {}) as VisualFormat;
    const shared = (
      layout[DASHBOARD_ROOT_ID]?.meta?.auradataCanvas as
        | CanvasFormat
        | undefined
    )?.visuals?.chart;
    const saved = (
      state.charts as unknown as Record<
        number,
        { form_data?: Record<string, unknown> }
      >
    )[chartId]?.form_data?.[name];
    const chart = { ...own.chart };
    const isSaved =
      isEqual(value, saved) || (value == null && saved === undefined);
    if (isSaved && !(shared && name in shared)) delete chart[name];
    else chart[name] = value;
    dispatch(
      setVisualFormat(id, withChart(own, chart), `visual:${id}:chart-${name}`),
    );
  };

/** Takes settings back to what the chart saved. */
export const resetChartFormat =
  (id: string, names: string[]) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const own = (getState().dashboardLayout.present[id]?.meta?.auradataFormat ??
      {}) as VisualFormat;
    const chart = { ...own.chart };
    names.forEach(name => delete chart[name]);
    // The style of a card from before its controls goes with them
    const { value, label, ...rest } = own;
    const kept: VisualFormat = {
      ...rest,
      ...(!names.includes('card_value_font') && value && { value }),
      ...(!names.includes('card_label_font') &&
        !names.includes('card_subtitle_font') &&
        label && { label }),
    };
    dispatch(
      setVisualFormat(
        id,
        withChart(kept, chart),
        `visual:${id}:chart-reset-${Date.now()}`,
      ),
    );
  };
