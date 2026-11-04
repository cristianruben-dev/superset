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
 * The side panel of a dashboard: the dashboard opens Explore, the data pages or
 * SQL Lab inside it (an iframe in "panel mode"). Explore tells the dashboard when
 * the chart is saved, and the data pages ask it to build a chart from a dataset.
 */

export const PANEL_PARAM = 'mibi_panel';
export const OPEN_CHART_EDITOR = 'mibi:open-chart-editor';
export const DOCK_PARAM = 'mibi_dock';
export const CHART_SAVED = 'mibi:chart-saved';
export const CHART_FORM_DATA = 'mibi:chart-form-data';
export const EDIT_CHART_FROM_PANEL = 'mibi:edit-chart-from-panel';

/** What the side panel shows. */
export type PanelKind = 'chart' | 'data' | 'sql';

export const DATA_PANEL_URL = '/data/';
// Without "new", SQL Lab reopens the last query instead of adding a tab each time
export const SQL_PANEL_URL = '/sqllab/';

// Read once on load: Explore rewrites its URL and does not keep unknown params
const panelMode =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has(PANEL_PARAM);

// The editor docked beside the report: the chart is the dashboard's, not the page's
const dockMode =
  panelMode && new URLSearchParams(window.location.search).has(DOCK_PARAM);

// The dashboard of the panel, read once too: the panel navigates between pages
const panelDashboardId = panelMode
  ? Number(new URLSearchParams(window.location.search).get('dashboard_id')) ||
    undefined
  : undefined;

/** Whether this page runs inside the chart editor panel. */
export function isPanelMode(): boolean {
  return panelMode;
}

/** The dashboard whose side panel shows this page. */
export function isDockMode(): boolean {
  return dockMode;
}

export function getPanelDashboardId(): number | undefined {
  return panelDashboardId;
}

/** The URL with the panel mode parameter. */
export function withPanelParam(url: string): string {
  const [path, hash = ''] = url.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${PANEL_PARAM}=1${hash ? `#${hash}` : ''}`;
}

export interface OpenChartEditorDetail {
  /** Explore, chart creation, data or SQL Lab URL to open in the panel */
  url: string;
  /** The chart being edited; undefined to create one */
  chartId?: number;
  /** What the panel shows, a chart when undefined */
  kind?: PanelKind;
}

/** Ask the dashboard on this page to open its side panel. */
export function openChartEditor(detail: OpenChartEditorDetail) {
  window.dispatchEvent(
    new CustomEvent<OpenChartEditorDetail>(OPEN_CHART_EDITOR, { detail }),
  );
}

export interface EditChartFromPanelMessage {
  type: typeof EDIT_CHART_FROM_PANEL;
  /** Explore or chart creation URL, without the dashboard */
  url: string;
}

/**
 * From the data or SQL panel: ask the dashboard to build a chart at this URL
 * (a dataset just saved, a query to explore). False outside the panel, where the
 * caller navigates as usual.
 */
export function editChartFromPanel(url: string): boolean {
  if (!panelMode) {
    return false;
  }
  const message: EditChartFromPanelMessage = {
    type: EDIT_CHART_FROM_PANEL,
    url,
  };
  window.parent.postMessage(message, window.location.origin);
  return true;
}

export function isEditChartFromPanelMessage(
  data: unknown,
): data is EditChartFromPanelMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as EditChartFromPanelMessage).type === EDIT_CHART_FROM_PANEL &&
    typeof (data as EditChartFromPanelMessage).url === 'string'
  );
}

/** The URL with the dashboard its chart is saved to. */
export function withDockParam(url: string): string {
  const [path, hash = ''] = url.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${DOCK_PARAM}=1${hash ? `#${hash}` : ''}`;
}

export function withDashboardParam(url: string, dashboardId: number): string {
  const [path, hash = ''] = url.split('#');
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}dashboard_id=${dashboardId}${hash ? `#${hash}` : ''}`;
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

/** The settings of the chart being edited, as they stand and not yet saved. */
export interface ChartFormDataMessage {
  type: typeof CHART_FORM_DATA;
  chartId: number;
  formData: Record<string, unknown>;
  /** `render` when only how it looks changed, `query` when its data did */
  kind: 'render' | 'query';
  /** Orders the messages: a late one is ignored */
  seq: number;
}

export function notifyChartFormData(
  message: Omit<ChartFormDataMessage, 'type'>,
) {
  window.parent.postMessage(
    { type: CHART_FORM_DATA, ...message },
    window.location.origin,
  );
}

export function isChartFormDataMessage(
  data: unknown,
): data is ChartFormDataMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as ChartFormDataMessage).type === CHART_FORM_DATA &&
    typeof (data as ChartFormDataMessage).chartId === 'number' &&
    typeof (data as ChartFormDataMessage).seq === 'number'
  );
}
