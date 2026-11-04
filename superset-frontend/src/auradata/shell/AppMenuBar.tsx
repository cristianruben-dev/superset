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
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { ThemeMode } from '@apache-superset/core/theme';
import { Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { useThemeContext } from 'src/theme/ThemeProvider';
import type {
  MenuData,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { navigateTo } from 'src/utils/navigationUtils';
import { MenuBar, withShortcut } from './MenuBar';
import { useRecentDashboards } from './recentDashboards';
import { recentMenuItem } from './recentMenu';
import type { NavSection } from './navigation';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);

const check = (on: boolean) =>
  on ? <Icons.CheckOutlined iconSize="s" /> : <span style={{ width: 14 }} />;

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
};

interface AppMenuBarProps {
  data: MenuData;
  sections: NavSection[];
  isFrontendRoute: (path?: string) => boolean;
  onSearch: () => void;
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
  sections,
  isFrontendRoute,
  onSearch,
  sidebarCollapsed,
  onToggleSidebar,
}: AppMenuBarProps) {
  const history = useHistory();
  const user = useSelector<
    { user?: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles | undefined
  >(state => state.user);
  const { themeMode, setThemeMode, canSetMode, canDetectOSPreference } =
    useThemeContext();
  const [showingAbout, setShowingAbout] = useState(false);
  const recent = useRecentDashboards();
  const { navbar_right: navbar } = data;
  const canWriteDashboards = findPermission(
    'can_write',
    'Dashboard',
    user?.roles,
  );

  const go = (url: string) => {
    if (isFrontendRoute(url)) {
      history.push(url);
    } else {
      navigateTo(url, { assign: true });
    }
  };

  const file: MenuItem[] = [
    ...(canWriteDashboards
      ? [
          {
            key: 'new-dashboard',
            icon: <Icons.DashboardOutlined iconSize="m" />,
            label: t('New dashboard'),
            onClick: () => navigateTo('/dashboard/new', { assign: true }),
          },
          {
            key: 'new-workspace',
            icon: <Icons.AppstoreOutlined iconSize="m" />,
            label: t('New workspace'),
            onClick: () =>
              navigateTo('/workspace/list/?new=true', { assign: true }),
          },
        ]
      : []),
    recentMenuItem(recent, go),
    { type: 'divider' as const },
    ...(navbar.user_info_url
      ? [
          {
            key: 'profile',
            icon: <Icons.UserOutlined iconSize="m" />,
            label: t('Profile'),
            onClick: () => go(navbar.user_info_url),
          },
        ]
      : []),
    {
      key: 'logout',
      icon: <Icons.ExportOutlined iconSize="m" />,
      label: t('Logout'),
      onClick: () => navigateTo(navbar.user_logout_url, { assign: true }),
    },
  ];

  const themes = [
    { mode: ThemeMode.DEFAULT, label: t('Light') },
    { mode: ThemeMode.DARK, label: t('Dark') },
    ...(canDetectOSPreference()
      ? [{ mode: ThemeMode.SYSTEM, label: t('Match system') }]
      : []),
  ];
  const languages = Object.entries(navbar.languages || {});

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
    ...(canSetMode()
      ? [
          { type: 'divider' as const },
          {
            type: 'group' as const,
            key: 'theme',
            label: t('Theme'),
            children: themes.map(({ mode, label }) => ({
              key: `theme-${mode}`,
              icon: check(themeMode === mode),
              label,
              onClick: () => setThemeMode(mode),
            })),
          },
        ]
      : []),
    ...(languages.length > 1
      ? [
          { type: 'divider' as const },
          {
            type: 'group' as const,
            key: 'language',
            label: t('Language'),
            children: languages.map(([key, language]) => ({
              key: `language-${key}`,
              icon: check(key === navbar.locale),
              label: language.name,
              onClick: () => {
                if (language.url) navigateTo(language.url, { assign: true });
              },
            })),
          },
        ]
      : []),
  ];

  const goTo: MenuItem[] = sections.flatMap((section, index) => {
    const items = section.items.map(item => ({
      key: `go-${item.key}`,
      icon: (() => {
        const Icon = Icons[item.icon];
        return <Icon iconSize="m" />;
      })(),
      label: item.label,
      onClick: () => go(item.url),
    }));
    return [
      ...(index > 0 ? [{ type: 'divider' as const }] : []),
      section.title
        ? {
            type: 'group' as const,
            key: `go-section-${section.key}`,
            label: section.title,
            children: items,
          }
        : items,
    ].flat();
  });

  const help: MenuItem[] = [
    {
      key: 'search',
      icon: <Icons.SearchOutlined iconSize="m" />,
      label: withShortcut(t('Search…'), isMac ? '⌘ K' : 'Ctrl K'),
      onClick: onSearch,
    },
    { type: 'divider' },
    ...(navbar.documentation_url
      ? [
          {
            key: 'docs',
            icon: <Icons.BookOutlined iconSize="m" />,
            label: navbar.documentation_text || t('Documentation'),
            onClick: () =>
              window.open(navbar.documentation_url, '_blank', 'noopener'),
          },
        ]
      : []),
    {
      key: 'website',
      icon: <Icons.GlobalOutlined iconSize="m" />,
      label: t('AuraData website'),
      onClick: () => window.open('https://auradata.mx', '_blank', 'noopener'),
    },
    {
      key: 'about',
      icon: <Icons.InfoCircleOutlined iconSize="m" />,
      label: t('About AuraData BI'),
      onClick: () => setShowingAbout(true),
    },
  ];

  const who = user?.username;
  const version = navbar.version_string;

  return (
    <>
      <MenuBar
        data-test="mibi-app-menubar"
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
      <Modal
        show={showingAbout}
        onHide={() => setShowingAbout(false)}
        title={t('About AuraData BI')}
        footer={null}
      >
        <dl
          css={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {version && (
            <>
              <dt>{t('Version')}</dt>
              <dd style={{ margin: 0 }}>{version}</dd>
            </>
          )}
          {navbar.version_sha && (
            <>
              <dt>{t('SHA')}</dt>
              <dd style={{ margin: 0 }}>{navbar.version_sha}</dd>
            </>
          )}
          {navbar.build_number && (
            <>
              <dt>{t('Build')}</dt>
              <dd style={{ margin: 0 }}>{navbar.build_number}</dd>
            </>
          )}
        </dl>
      </Modal>
    </>
  );
}
