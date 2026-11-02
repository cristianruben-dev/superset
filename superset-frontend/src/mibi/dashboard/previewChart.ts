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

import {
  addChart,
  renderTriggered,
  triggerQuery,
} from 'src/components/Chart/chartAction';
import type { ChartState } from 'src/explore/types';
import type { GetState } from 'src/dashboard/types';

type Dispatch = (action: unknown) => unknown;

/**
 * Shows the settings being edited on the chart of the report, without saving
 * them or marking the dashboard as changed. A change of its look repaints the
 * data it already has; a change of its data asks for the data again.
 */
export const previewChartFormData =
  (
    chartId: number,
    formData: Record<string, unknown>,
    kind: 'render' | 'query',
  ) =>
  (dispatch: Dispatch, getState: GetState) => {
    const chart = (getState().charts as Record<number, ChartState>)[chartId];
    if (!chart) return;
    dispatch(
      addChart(
        { ...chart, form_data: { ...formData } } as unknown as ChartState,
        chartId,
      ),
    );
    dispatch(
      kind === 'query'
        ? triggerQuery(true, chartId)
        : renderTriggered(Date.now(), chartId),
    );
  };
