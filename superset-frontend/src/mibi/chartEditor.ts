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
/**
 * The chart editor panel: a dashboard opens Explore inside a side panel (an
 * iframe in "panel mode") and Explore tells the dashboard when the chart is saved.
 */

export const PANEL_PARAM = 'mibi_panel';
export const OPEN_CHART_EDITOR = 'mibi:open-chart-editor';
export const CHART_SAVED = 'mibi:chart-saved';

// Read once on load: Explore rewrites its URL and does not keep unknown params
const panelMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has(PANEL_PARAM);

/** Whether this page runs inside the chart editor panel. */
export function isPanelMode(): boolean {
  return panelMode;
}

/** The URL with the panel mode parameter. */
export function withPanelParam(url: string): string {
  const [path, hash = ''] = url.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${PANEL_PARAM}=1${hash ? `#${hash}` : ''}`;
}

export interface OpenChartEditorDetail {
  /** Explore or chart creation URL to open in the panel */
  url: string;
  /** The chart being edited; undefined to create one */
  chartId?: number;
}

/** Ask the dashboard on this page to open the chart editor panel. */
export function openChartEditor(detail: OpenChartEditorDetail) {
  window.dispatchEvent(
    new CustomEvent<OpenChartEditorDetail>(OPEN_CHART_EDITOR, { detail }),
  );
}

export interface ChartSavedMessage {
  type: typeof CHART_SAVED;
  chartId: number;
  isNew: boolean;
}

/** From the panel: tell the dashboard that a chart was saved. */
export function notifyChartSaved(chartId: number, isNew: boolean) {
  const message: ChartSavedMessage = { type: CHART_SAVED, chartId, isNew };
  window.parent.postMessage(message, window.location.origin);
}

export function isChartSavedMessage(data: unknown): data is ChartSavedMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ChartSavedMessage).type === CHART_SAVED &&
    typeof (data as ChartSavedMessage).chartId === 'number'
  );
}
