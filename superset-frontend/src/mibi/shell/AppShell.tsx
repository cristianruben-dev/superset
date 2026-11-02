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
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { css, styled } from '@apache-superset/core/theme';
import { useUiConfig } from 'src/components/UiConfigContext';
import { URL_PARAMS } from 'src/constants';
import type { MenuData } from 'src/types/bootstrapTypes';
import { getUrlParam } from 'src/utils/urlUtils';
import { isPanelMode } from '../chartEditor';
import { CommandPalette } from './CommandPalette';
import { buildNavSections, isReportRoute } from './navigation';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './Sidebar';
import { ThemeVariables } from './ThemeVariables';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'mibi.sidebarCollapsed';
// Narrower screens (phones, small tablets) always get the collapsed sidebar
const NARROW_SCREEN = 768;

// The screen width too: a page wider than a phone widens its window
const isNarrow = () =>
  Math.min(window.innerWidth, window.screen?.width || Infinity) < NARROW_SCREEN;

const useNarrowScreen = () => {
  const [narrow, setNarrow] = useState(isNarrow);
  useEffect(() => {
    const onResize = () => setNarrow(isNarrow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
};

const Main = styled.div<{ $offset: number }>`
  ${({ theme, $offset }) => css`
    margin-left: ${$offset}px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;

    /* A page taller than the window grows with its content, so its background
       reaches the bottom instead of the page overflowing it */
    & > .ant-layout {
      flex-shrink: 0;
    }
    transition: margin-left ${theme.motionDurationMid} ${theme.motionEaseInOut};
  `}
`;

const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

interface AppShellProps {
  data: MenuData;
  isFrontendRoute: (path?: string) => boolean;
  children: ReactNode;
}

/**
 * AuraData BI application frame: a collapsible sidebar with the navigation, a top bar
 * with search, create and user menus, and the page next to them. A dashboard takes
 * the whole width, as a Power BI report does: the logo moves to the top bar. Standalone
 * and embedded views render the page alone.
 */
export function AppShell({ data, isFrontendRoute, children }: AppShellProps) {
  const uiConfig = useUiConfig();
  const { pathname } = useLocation();
  const report = isReportRoute(pathname);
  const [preferCollapsed, setCollapsed] = useState(readCollapsed);
  const narrow = useNarrowScreen();
  const collapsed = preferCollapsed || narrow;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const [searching, setSearching] = useState(false);
  const sections = useMemo(() => buildNavSections(data.menu), [data.menu]);
  // Signed-out pages (login, register) and standalone or embedded views go alone
  const hidden =
    isPanelMode() ||
    !!getUrlParam(URL_PARAMS.standalone) ||
    uiConfig.hideNav ||
    data.navbar_right.user_is_anonymous;

  const toggleCollapsed = useCallback(() => {
    setCollapsed(value => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(!value));
      } catch {
        // the preference only lasts for this page
      }
      return !value;
    });
  }, []);

  useEffect(() => {
    // Lets the skin compact pages shown inside the chart editor panel
    document.body.classList.toggle('mibi-panel', isPanelMode());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (hidden) {
    return (
      <>
        <ThemeVariables />
        {children}
      </>
    );
  }

  return (
    <>
      <ThemeVariables />
      {!report && (
        <Sidebar
          sections={sections}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          isFrontendRoute={isFrontendRoute}
        />
      )}
      <Main $offset={report ? 0 : sidebarWidth} data-test="mibi-main">
        <TopBar
          data={data}
          isFrontendRoute={isFrontendRoute}
          onSearch={() => setSearching(true)}
          showBrand={report}
          compactBrand={narrow}
        />
        {children}
      </Main>
      <CommandPalette
        show={searching}
        onHide={() => setSearching(false)}
        sections={sections}
        isFrontendRoute={isFrontendRoute}
      />
    </>
  );
}
