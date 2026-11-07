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
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import type {
  MenuData,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { useSelector } from 'react-redux';
import { useAppMenus } from './appMenus';
import { MenuBar, withShortcut } from './MenuBar';
import { useRecentDashboards } from './recentDashboards';
import { recentMenuItem } from './recentMenu';

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
};

interface AppMenuBarProps {
  data: MenuData;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

/**
 * The menu bar of the pages out of a report (File, View, Go to, Help), under
 * the top bar. It gathers what the app can do from anywhere; each page keeps
 * its own commands in its header.
 */
export function AppMenuBar({
  data,
  sidebarCollapsed,
  onToggleSidebar,
}: AppMenuBarProps) {
  const user = useSelector<
    { user?: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles | undefined
  >(state => state.user);
  const { create, account, appearance, goTo, help, open } = useAppMenus();
  const recent = useRecentDashboards();

  const file: MenuItem[] = [
    ...create,
    recentMenuItem(recent, open),
    { type: 'divider' as const },
    ...account,
  ];

  const view: MenuItem[] = [
    {
      key: 'sidebar',
      icon: sidebarCollapsed ? (
        <Icons.MenuUnfoldOutlined iconSize="m" />
      ) : (
        <Icons.MenuFoldOutlined iconSize="m" />
      ),
      label: sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar'),
      onClick: onToggleSidebar,
    },
    {
      key: 'fullscreen',
      icon: <Icons.FullscreenOutlined iconSize="m" />,
      label: withShortcut(t('Full screen'), 'F11'),
      onClick: toggleFullscreen,
    },
    ...appearance,
  ];

  const who = user?.username;
  const version = data.navbar_right.version_string;

  return (
    <MenuBar
      data-test="auradata-app-menubar"
      menus={[
        { key: 'file', label: t('File'), items: file },
        { key: 'view', label: t('View'), items: view },
        { key: 'go', label: t('Go to'), items: goTo },
        { key: 'help', label: t('Help'), items: help },
      ]}
      end={
        <>
          {who && <span>{who}</span>}
          {version && <span>v{version}</span>}
        </>
      }
    />
  );
}
