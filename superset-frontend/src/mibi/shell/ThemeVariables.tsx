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
import { Global } from '@emotion/react';
import { css, useTheme } from '@apache-superset/core/theme';

/**
 * Publishes the theme colors as CSS variables (--mb-*) so the global stylesheet
 * (src/assets/mibi/skin.css) can use them and follow light/dark mode.
 */
export function ThemeVariables() {
  const theme = useTheme();
  return (
    <Global
      styles={css`
        :root {
          --mb-primary: ${theme.colorPrimary};
          --mb-primary-bg: ${theme.colorPrimaryBg};
          --mb-primary-border: ${theme.colorPrimaryBorder};
          --mb-bg-container: ${theme.colorBgContainer};
          --mb-bg-layout: ${theme.colorBgLayout};
          --mb-fill: ${theme.colorFillSecondary};
          --mb-text: ${theme.colorText};
          --mb-text-secondary: ${theme.colorTextSecondary};
          --mb-text-tertiary: ${theme.colorTextTertiary};
          --mb-border: ${theme.colorBorder};
          --mb-border-secondary: ${theme.colorBorderSecondary};
        }
      `}
    />
  );
}
