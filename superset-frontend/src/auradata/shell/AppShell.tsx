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
import { isDockMode, isPanelMode } from '../chartEditor';
import { usePhoneScreen } from '../format/mobile';
import { CommandPalette } from './CommandPalette';
import { buildNavSections, isReportRoute } from './navigation';
import { AppMenuBar } from './AppMenuBar';
import { MENU_BAR_HEIGHT } from './MenuBar';
import { setMenuBarSlot } from './menuBarSlot';
import { STATUS_BAR_HEIGHT, StatusBar } from './StatusBar';
import { ShellCrumbs } from './PageHeader';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './Sidebar';
import { ThemeVariables } from './ThemeVariables';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'auradata.sidebarCollapsed';
// Narrower screens (phones, small tablets) always get the collapsed sidebar
const NARROW_SCREEN = 768;
// Below this, the top bar has no room for the title and actions of a report
const REPORT_HEADER_SCREEN = 1200;

// The screen width too: a page wider than a phone widens its window
const isBelow = (width: number) =>
  Math.min(window.innerWidth, window.screen?.width || Infinity) < width;

const useScreenBelow = (width: number) => {
  const [below, setBelow] = useState(() => isBelow(width));
  useEffect(() => {
    const onResize = () => setBelow(isBelow(width));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width]);
  return below;
};

// The window: the menu bar on its first row, then the page
const Frame = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

// Dims the page behind the navigation drawer of a phone
const Backdrop = styled.div<{ $top: number }>`
  ${({ theme, $top }) => css`
    position: fixed;
    inset: ${$top}px 0 0 0;
    z-index: 99;
    background: ${theme.colorBgMask};
  `}
`;

const MenuRow = styled.div`
  position: relative;
  z-index: 110;
  flex: none;

  &:empty {
    display: none;
  }
`;

const Main = styled.div<{ $offset: number; $bottom: number }>`
  ${({ theme, $offset, $bottom }) => css`
    margin-left: ${$offset}px;
    padding-bottom: ${$bottom}px;
    flex: 1;
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
  const narrow = useScreenBelow(NARROW_SCREEN);
  const reportHeaderFits = !useScreenBelow(REPORT_HEADER_SCREEN);
  // A phone has no room for the rail: the navigation opens as a drawer
  const phone = usePhoneScreen();
  // The page the drawer was opened on: moving to another page closes it
  const [navOpenOn, setNavOpenOn] = useState<string | null>(null);
  const navOpen = phone && navOpenOn === pathname;
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

  const toggleNav = useCallback(
    () => setNavOpenOn(value => (value === pathname ? null : pathname)),
    [pathname],
  );
  const closeNav = useCallback(() => setNavOpenOn(null), []);

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpenOn(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  useEffect(() => {
    // Lets the skin compact pages shown inside the chart editor panel
    document.body.classList.toggle('auradata-panel', isPanelMode());
    document.body.classList.toggle('auradata-dock', isDockMode());
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
      <Frame>
        {/* The menu bar of the page; a report puts its own here */}
        <MenuRow ref={setMenuBarSlot} data-test="auradata-menubar-row">
          {!report && (
            <AppMenuBar
              data={data}
              sections={sections}
              isFrontendRoute={isFrontendRoute}
              onSearch={() => setSearching(true)}
              sidebarCollapsed={phone ? !navOpen : collapsed}
              onToggleSidebar={phone ? toggleNav : toggleCollapsed}
            />
          )}
        </MenuRow>
        {!report && (!phone || navOpen) && (
          <Sidebar
            sections={sections}
            collapsed={phone ? false : collapsed}
            onToggleCollapsed={phone ? closeNav : toggleCollapsed}
            isFrontendRoute={isFrontendRoute}
            top={MENU_BAR_HEIGHT}
            bottom={phone ? 0 : STATUS_BAR_HEIGHT}
          />
        )}
        {!report && phone && navOpen && (
          <Backdrop
            $top={MENU_BAR_HEIGHT}
            onClick={closeNav}
            data-test="auradata-nav-backdrop"
          />
        )}
        <Main
          $offset={report || phone ? 0 : sidebarWidth}
          $bottom={report ? 0 : STATUS_BAR_HEIGHT}
          data-test="auradata-main"
        >
          <TopBar
            data={data}
            isFrontendRoute={isFrontendRoute}
            onSearch={() => setSearching(true)}
            showBrand={report || phone}
            compactBrand={narrow}
            onOpenNav={!report && phone ? toggleNav : undefined}
            reportHeader={report && reportHeaderFits}
          />
          {!report && <ShellCrumbs sections={sections} pathname={pathname} />}
          {children}
        </Main>
      </Frame>
      {/* A report has its page bar at the bottom instead */}
      {!report && <StatusBar locale={data.navbar_right.locale} />}
      <CommandPalette
        show={searching}
        onHide={() => setSearching(false)}
        sections={sections}
        isFrontendRoute={isFrontendRoute}
      />
    </>
  );
}
