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
import { css, styled } from '@apache-superset/core/theme';
import { useUiConfig } from 'src/components/UiConfigContext';
import { URL_PARAMS } from 'src/constants';
import type { MenuData } from 'src/types/bootstrapTypes';
import { getUrlParam } from 'src/utils/urlUtils';
import { CommandPalette } from './CommandPalette';
import { buildNavSections } from './navigation';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './Sidebar';
import { TopBar } from './TopBar';

const COLLAPSED_KEY = 'mibi.sidebarCollapsed';

const Main = styled.div<{ $offset: number }>`
  ${({ theme, $offset }) => css`
    margin-left: ${$offset}px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
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
 * Mi BI application frame: a collapsible sidebar with the navigation, a top bar
 * with search, create and user menus, and the page next to them. Standalone and
 * embedded views render the page alone.
 */
export function AppShell({ data, isFrontendRoute, children }: AppShellProps) {
  const uiConfig = useUiConfig();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [searching, setSearching] = useState(false);
  const sections = useMemo(() => buildNavSections(data.menu), [data.menu]);
  // Signed-out pages (login, register) and standalone or embedded views go alone
  const hidden =
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
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar
        sections={sections}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        isFrontendRoute={isFrontendRoute}
      />
      <Main $offset={collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}>
        <TopBar
          data={data}
          isFrontendRoute={isFrontendRoute}
          onSearch={() => setSearching(true)}
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
