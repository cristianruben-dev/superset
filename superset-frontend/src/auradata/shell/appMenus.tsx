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
import { useLayoutEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
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
import { navigateTo, openInNewTab } from 'src/utils/navigationUtils';
import { useConfirmLogout } from './logout';
import { withShortcut } from './MenuBar';
import type { NavSection } from './navigation';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const check = (on: boolean) =>
  on ? <Icons.CheckOutlined iconSize="s" /> : <span style={{ width: 14 }} />;

/** What every menu bar offers, on a report and on any other page. */
export interface AppMenus {
  /** New dashboard, new workspace */
  create: MenuItem[];
  /** Profile, Connect AI, logout */
  account: MenuItem[];
  /** Theme and language */
  appearance: MenuItem[];
  goTo: MenuItem[];
  help: MenuItem[];
  /** Opens a page of the app, inside it when it can */
  open: (url: string) => void;
}

const NO_MENUS: AppMenus = {
  create: [],
  account: [],
  appearance: [],
  goTo: [],
  help: [],
  open: url => navigateTo(url, { assign: true }),
};

// Pages mount outside the tree of the application frame, so a React context
// from the frame would never reach them
let current = NO_MENUS;
const listeners = new Set<() => void>();

const publish = (menus: AppMenus) => {
  current = menus;
  listeners.forEach(listener => listener());
};

/** The shared menus; empty without the application frame. */
export function useAppMenus(): AppMenus {
  const [menus, setMenus] = useState(current);
  useLayoutEffect(() => {
    const update = () => setMenus(current);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return menus;
}

interface AppMenusHostProps {
  data: MenuData;
  sections: NavSection[];
  isFrontendRoute: (path?: string) => boolean;
  onSearch: () => void;
}

/** Builds the shared menus and holds the dialogs of the Help menu. */
export function AppMenusHost({
  data,
  sections,
  isFrontendRoute,
  onSearch,
}: AppMenusHostProps) {
  const history = useHistory();
  const user = useSelector<
    { user?: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles | undefined
  >(state => state.user);
  const { themeMode, setThemeMode, canSetMode, canDetectOSPreference } =
    useThemeContext();
  const [dialog, setDialog] = useState<'about' | 'shortcuts' | null>(null);
  const { navbar_right: navbar } = data;
  const [confirmLogout, logoutHolder] = useConfirmLogout(
    navbar.user_logout_url,
  );
  const canWriteDashboards = findPermission(
    'can_write',
    'Dashboard',
    user?.roles,
  );
  const themable = canSetMode();
  const followsSystem = canDetectOSPreference();

  const menus = useMemo<AppMenus>(() => {
    const open = (url: string) => {
      if (isFrontendRoute(url)) {
        history.push(url);
      } else {
        navigateTo(url, { assign: true });
      }
    };

    const create: MenuItem[] = canWriteDashboards
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
      : [];

    const account: MenuItem[] = [
      ...(navbar.user_info_url
        ? [
            {
              key: 'profile',
              icon: <Icons.UserOutlined iconSize="m" />,
              label: t('Profile'),
              onClick: () => open(navbar.user_info_url),
            },
          ]
        : []),
      ...(isFeatureEnabled(FeatureFlag.FabApiKeyEnabled)
        ? [
            {
              key: 'connect-ai',
              icon: <Icons.ApiOutlined iconSize="m" />,
              label: t('Connect AI'),
              onClick: () => open('/connect-ai/'),
            },
          ]
        : []),
      {
        key: 'logout',
        icon: <Icons.ExportOutlined iconSize="m" />,
        label: t('Logout'),
        onClick: confirmLogout,
      },
    ];

    const themes = [
      { mode: ThemeMode.DEFAULT, label: t('Light') },
      { mode: ThemeMode.DARK, label: t('Dark') },
      ...(followsSystem
        ? [{ mode: ThemeMode.SYSTEM, label: t('Match system') }]
        : []),
    ];
    const languages = Object.entries(navbar.languages || {});
    const appearance: MenuItem[] = [
      ...(themable
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
        onClick: () => open(item.url),
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
        label: withShortcut(t('Search…'), `${MOD} K`),
        onClick: onSearch,
      },
      {
        key: 'shortcuts',
        icon: <Icons.ThunderboltOutlined iconSize="m" />,
        label: t('Keyboard shortcuts'),
        onClick: () => setDialog('shortcuts'),
      },
      { type: 'divider' },
      ...(navbar.documentation_url
        ? [
            {
              key: 'docs',
              icon: <Icons.BookOutlined iconSize="m" />,
              label: navbar.documentation_text || t('Documentation'),
              onClick: () => openInNewTab(navbar.documentation_url!),
            },
          ]
        : []),
      ...(navbar.bug_report_url
        ? [
            {
              key: 'bug-report',
              icon: <Icons.BugOutlined iconSize="m" />,
              label: navbar.bug_report_text || t('Report a bug'),
              onClick: () => openInNewTab(navbar.bug_report_url!),
            },
          ]
        : []),
      {
        key: 'website',
        icon: <Icons.GlobalOutlined iconSize="m" />,
        label: t('AuraData website'),
        onClick: () => openInNewTab('https://auradata.mx'),
      },
      {
        key: 'about',
        icon: <Icons.InfoCircleOutlined iconSize="m" />,
        label: t('About AuraData BI'),
        onClick: () => setDialog('about'),
      },
    ];

    return { create, account, appearance, goTo, help, open };
  }, [
    canWriteDashboards,
    confirmLogout,
    followsSystem,
    history,
    isFrontendRoute,
    navbar,
    onSearch,
    sections,
    setThemeMode,
    themable,
    themeMode,
  ]);

  useLayoutEffect(() => {
    publish(menus);
    return () => publish(NO_MENUS);
  }, [menus]);

  const shortcuts: [string, string][] = [
    [t('Search…'), `${MOD} K`],
    [t('Full screen'), 'F11'],
    [t('Undo'), `${MOD} Z`],
    [t('Redo'), `${MOD} Y`],
    [t('Exit presentation'), 'Esc'],
  ];
  const facts: [string, string | undefined][] = [
    [t('Version'), navbar.version_string],
    [t('SHA'), navbar.version_sha],
    [t('Build'), navbar.build_number],
  ];
  const rows = dialog === 'about' ? facts : shortcuts;

  return (
    <>
      {logoutHolder}
      <Modal
        show={!!dialog}
        onHide={() => setDialog(null)}
        title={
          dialog === 'shortcuts'
            ? t('Keyboard shortcuts')
            : t('About AuraData BI')
        }
        hideFooter
      >
        <dl
          data-test="auradata-menu-dialog"
          css={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} style={{ display: 'contents' }}>
                <dt>{label}</dt>
                <dd style={{ margin: 0 }}>{value}</dd>
              </div>
            ))}
        </dl>
      </Modal>
    </>
  );
}
