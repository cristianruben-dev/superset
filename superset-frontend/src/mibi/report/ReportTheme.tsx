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
import { CSSProperties, ReactNode, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ConfigProvider } from 'antd';
import tinycolor from 'tinycolor2';
import {
  Theme,
  ThemeProvider,
  normalizeThemeConfig,
  useThemeMode,
  type AnyThemeConfig,
  type SupersetTheme,
} from '@apache-superset/core/theme';
import getBootstrapData from 'src/utils/getBootstrapData';
import { themeCssVariables } from '../shell/ThemeVariables';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import type { RootState } from 'src/dashboard/types';
import {
  DEFAULT_APPEARANCE,
  type AreaStyle,
  type CanvasFormat,
  type ReportAppearance,
} from '../format/types';

/** The parts of a report that can have colors of their own. */
export type ReportArea = 'page' | 'filterBar' | 'tabs';

/** Ant Design seed tokens an area style changes. Everything else derives. */
export const areaTokens = (style?: AreaStyle): Record<string, string> => ({
  ...(style?.background ? { colorBgContainer: style.background } : {}),
  ...(style?.text ? { colorText: style.text } : {}),
  ...(style?.accent ? { colorPrimary: style.accent } : {}),
});

/**
 * The theme config of a report: the app's light or dark theme, whichever the
 * report asks for, with the colors of one area on top.
 */
export function reportThemeConfig(
  dark: boolean,
  style?: AreaStyle,
): AnyThemeConfig | undefined {
  const {
    common: { theme },
  } = getBootstrapData();
  const base = (dark ? theme?.dark : theme?.default) as
    | AnyThemeConfig
    | undefined;
  const tokens = areaTokens(style);
  if (!base) return undefined;
  if (!Object.keys(tokens).length) return base;
  const antd = normalizeThemeConfig(base);
  return { ...antd, token: { ...antd.token, ...tokens } };
}

export const useReportAppearance = (): ReportAppearance =>
  useSelector(
    (state: RootState) =>
      (
        state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta
          ?.mibiCanvas as CanvasFormat | undefined
      )?.appearance ?? DEFAULT_APPEARANCE,
  );

const useAreaStyle = (area: ReportArea): AreaStyle | undefined =>
  useSelector((state: RootState) =>
    area === 'page'
      ? undefined
      : (
          state.dashboardLayout?.present?.[DASHBOARD_ROOT_ID]?.meta
            ?.mibiCanvas as CanvasFormat | undefined
        )?.[area],
  );

type Built = {
  theme: SupersetTheme;
  antd: ReturnType<typeof normalizeThemeConfig>;
  dark: boolean;
};

/**
 * The look of a part of the report: the app's light or dark theme as the
 * report asks, with the colors of that area on top. Null when it follows the
 * app and has no colors of its own.
 */
export function useReportLook(area: ReportArea = 'page'): Built | null {
  const appearance = useReportAppearance();
  const style = useAreaStyle(area);
  const appIsDark = useThemeMode();
  // An area with its own background is dark or light by that color, so its
  // text and controls stay readable whatever the rest of the report is
  const appearanceDark =
    appearance === 'app' ? appIsDark : appearance === 'dark';
  const dark = style?.background
    ? tinycolor(style.background).isDark()
    : appearanceDark;
  const hasStyle = Object.keys(areaTokens(style)).length > 0;
  const follows = appearance === 'app' && !hasStyle;

  return useMemo(() => {
    if (follows) return null;
    const config = reportThemeConfig(dark, style);
    if (!config) return null;
    return {
      theme: Theme.fromConfig(config).theme,
      antd: normalizeThemeConfig(config),
      dark,
    };
  }, [follows, dark, style]);
}

/**
 * Gives a part of a report its own look: light (or dark) as the report says,
 * not as the app is, plus the colors set for that area. It only provides
 * tokens; it never touches the page's global styles.
 */
export function ReportTheme({
  area = 'page',
  children,
}: {
  area?: ReportArea;
  children: ReactNode;
}) {
  const built = useReportLook(area);
  if (!built) return <>{children}</>;
  return (
    <ThemeProvider theme={built.theme}>
      <ConfigProvider theme={built.antd}>
        <div
          data-test="mibi-report-theme"
          data-appearance={built.dark ? 'dark' : 'light'}
          style={
            {
              display: 'contents',
              colorScheme: built.dark ? 'dark' : 'light',
              color: built.theme.colorText,
              ...themeCssVariables(built.theme),
            } as CSSProperties
          }
        >
          {children}
        </div>
      </ConfigProvider>
    </ThemeProvider>
  );
}
