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
 * Format themes: a named dashboard style (canvas, the style every chart
 * shares and the color palette) saved from the Format pane and applied to
 * other dashboards. The backend, superset/mibi/format_themes.py, stores them
 * and applies them to dashboards that are not open.
 */
import {
  getCategoricalSchemeRegistry,
  SupersetClient,
} from '@superset-ui/core';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, RootState } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import {
  setColorScheme,
  setDashboardMetadata,
} from 'src/dashboard/actions/dashboardState';
import {
  applyColors,
  getColorSchemeDomain,
  getFreshLabelsColorMapEntries,
} from 'src/utils/colorScheme';
import { setSharedVisualFormat, withoutOwnText } from './actions';
import {
  CANVAS_FORMAT_KEY,
  type CanvasFormat,
  type VisualFormat,
} from './types';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

export interface FormatThemeValue {
  canvas?: CanvasFormat;
  visuals?: VisualFormat;
  colorScheme?: string;
}

export interface FormatTheme {
  id: number;
  name: string;
  theme: FormatThemeValue;
  can_edit: boolean;
}

const BASE = '/api/v1/format_theme/';

export async function listThemes(): Promise<FormatTheme[]> {
  const { json } = await SupersetClient.get({ endpoint: BASE });
  return json.result as FormatTheme[];
}

export async function saveTheme(
  name: string,
  theme: FormatThemeValue,
): Promise<FormatTheme> {
  const { json } = await SupersetClient.post({
    endpoint: BASE,
    jsonPayload: { name, theme },
  });
  return json.result as FormatTheme;
}

export async function updateTheme(
  id: number,
  changes: { name?: string; theme?: FormatThemeValue },
): Promise<FormatTheme> {
  const { json } = await SupersetClient.put({
    endpoint: `${BASE}${id}/`,
    jsonPayload: changes,
  });
  return json.result as FormatTheme;
}

export async function deleteTheme(id: number): Promise<void> {
  await SupersetClient.delete({ endpoint: `${BASE}${id}/` });
}

/** Gives saved dashboards a theme; returns the ids of the ones that got it. */
export async function applyThemeToDashboards(
  id: number,
  dashboardIds: number[],
  resetVisuals = true,
): Promise<number[]> {
  const { json } = await SupersetClient.post({
    endpoint: `${BASE}${id}/apply/`,
    jsonPayload: { dashboard_ids: dashboardIds, reset_visuals: resetVisuals },
  });
  return json.result as number[];
}

/**
 * The theme of a dashboard: its canvas without the background picture (it
 * belongs to this dashboard), the style its charts share and its palette.
 */
export function themeOf(
  canvas: CanvasFormat | undefined,
  colorScheme: string | undefined,
): FormatThemeValue {
  const theme: FormatThemeValue = {};
  if (canvas) {
    const { visuals, ...rest } = canvas;
    if (rest.background?.type === 'image') {
      rest.background = { type: 'none' };
    } else if (rest.background) {
      const { image, ...background } = rest.background;
      rest.background = background;
    }
    if (Object.keys(rest).length) theme.canvas = rest;
    const shared = withoutOwnText(visuals);
    if (shared && Object.keys(shared).length) theme.visuals = shared;
  }
  if (colorScheme) theme.colorScheme = colorScheme;
  return theme;
}

/** The theme of the dashboard being edited. */
export const currentTheme = (state: RootState): FormatThemeValue =>
  themeOf(
    state.dashboardLayout.present[DASHBOARD_ROOT_ID]?.meta?.[
      CANVAS_FORMAT_KEY
    ] as CanvasFormat | undefined,
    (state.dashboardInfo.metadata?.color_scheme as string | undefined) ||
      state.dashboardState.colorScheme ||
      undefined,
  );

/** Gives the charts the categorical palette ``scheme``, if it exists. */
export const applyColorScheme =
  (scheme: string) => (dispatch: AppDispatch, getState: GetState) => {
    if (!getCategoricalSchemeRegistry().has(scheme)) return;
    const metadata = getState().dashboardInfo.metadata ?? {};
    const labelColors = (metadata.label_colors || {}) as Record<string, string>;
    applyColors({ ...metadata, color_scheme: scheme }, true);
    dispatch(
      setDashboardMetadata({
        color_scheme: scheme,
        color_scheme_domain: getColorSchemeDomain(scheme),
        map_label_colors: getFreshLabelsColorMapEntries(labelColors),
      }),
    );
    dispatch(setColorScheme(scheme));
  };

/**
 * Gives the dashboard being edited a theme, in one undo step for the layout.
 * A theme without a background keeps the dashboard's own one. With
 * ``resetCharts``, charts drop their own style so the theme shows on all.
 */
export const applyTheme =
  (theme: FormatThemeValue, { resetCharts = true } = {}) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const current = getState().dashboardLayout.present[DASHBOARD_ROOT_ID]
      ?.meta?.[CANVAS_FORMAT_KEY] as CanvasFormat | undefined;
    const canvas: CanvasFormat = { ...theme.canvas };
    if (!canvas.background && current?.background) {
      canvas.background = current.background;
    }
    dispatch(setSharedVisualFormat(theme.visuals, { resetCharts, canvas }));
    if (theme.colorScheme) dispatch(applyColorScheme(theme.colorScheme));
  };
