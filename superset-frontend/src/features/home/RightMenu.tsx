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
import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import {
  getExtensionsRegistry,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import {
  styled,
  css,
  SupersetTheme,
  useTheme,
} from '@apache-superset/core/theme';
import {
  Tag,
  Menu,
  Icons,
  Typography,
  TelemetryPixel,
  Drawer,
  Button,
} from '@superset-ui/core/components';
import type { ItemType, MenuItem } from '@superset-ui/core/components/Menu';
import { openChartEditor } from 'src/auradata/chartEditor';
import { useConfirmLogout } from 'src/auradata/shell/logout';
import { isReportRoute } from 'src/auradata/shell/navigation';
import {
  ensureAppRoot,
  navigateTo,
  stripAppRoot,
} from 'src/utils/navigationUtils';
import { useIsMobile } from 'src/hooks/useIsMobile';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import { findPermission } from 'src/utils/findPermission';
import {
  MenuObjectProps,
  UserWithPermissionsAndRoles,
  MenuObjectChildProps,
} from 'src/types/bootstrapTypes';
import { RootState } from 'src/dashboard/types';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { useThemeMenuItems } from 'src/hooks/useThemeMenuItems';
import { useLanguageMenuItems } from './LanguagePicker';
import { RightMenuProps } from './types';
import { NAVBAR_MENU_POPUP_OFFSET } from './commonMenuData';

const extensionsRegistry = getExtensionsRegistry();

const StyledDiv = styled.div<{ align: string }>`
  display: flex;
  height: 100%;
  flex-direction: row;
  justify-content: ${({ align }) => align};
  align-items: center;
`;

const StyledMenuItemWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const StyledAnchor = styled.a`
  padding-right: ${({ theme }) => theme.sizeUnit}px;
  padding-left: ${({ theme }) => theme.sizeUnit}px;
`;

const RightMenu = ({
  align,
  settings,
  navbarRight,
  isFrontendRoute,
  environmentTag,
  menu,
  newLabel,
  settingsLabel,
}: RightMenuProps) => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const dashboardId = useSelector<RootState, number | undefined>(
    state => state.dashboardInfo?.id,
  );
  const canEditDashboard = useSelector<RootState, boolean>(
    state =>
      Number.isInteger(state.dashboardInfo?.id) &&
      !!state.dashboardInfo?.dash_edit_perm,
  );
  // The store keeps the last dashboard after leaving it
  const onReport = isReportRoute(useLocation().pathname);
  const userValues = user || {};
  const { roles } = userValues;
  const scarfAnalytics = useSelector<any, boolean | undefined>(
    state => state.common?.conf?.SCARF_ANALYTICS,
  );
  const canDashboard = findPermission('can_write', 'Dashboard', roles);
  const canChart = findPermission('can_write', 'Chart', roles);

  const showActionDropdown = canChart || canDashboard;
  const { setThemeMode, themeMode, canSetMode, canDetectOSPreference } =
    useThemeContext();
  // AuraData BI: connections, datasets, uploads and SQL Lab open from the
  // "Data" menu of a dashboard, where the report is built
  const dropdownItems: MenuObjectProps[] = [
    // Charts belong to a single dashboard (AuraData BI): only offered inside
    // one the user can edit, and they open in its side panel
    ...(onReport && canEditDashboard
      ? [
          {
            label: t('Chart'),
            onClick: () =>
              openChartEditor({
                url: `/chart/add?dashboard_id=${dashboardId}`,
              }),
            icon: (
              <Icons.BarChartOutlined data-test={`menu-item-${t('Chart')}`} />
            ),
            perm: 'can_write',
            view: 'Chart',
          },
        ]
      : []),
    {
      label: t('Dashboard'),
      url: '/dashboard/new/',
      icon: (
        <Icons.DashboardOutlined data-test={`menu-item-${t('Dashboard')}`} />
      ),
      perm: 'can_write',
      view: 'Dashboard',
    },
    // AuraData BI: workspaces hold dashboards, so they follow its permission
    {
      label: t('Workspace'),
      url: '/workspace/list/?new=true',
      icon: (
        <Icons.AppstoreOutlined data-test={`menu-item-${t('Workspace')}`} />
      ),
      perm: 'can_write',
      view: 'Dashboard',
    },
  ];

  const buildMenuItem = (item: MenuObjectChildProps): MenuItem => ({
    key: item.name || item.label,
    label: item.url ? (
      <Typography.Link href={ensureAppRoot(item.url)}>
        {item.label}
      </Typography.Link>
    ) : (
      item.label
    ),
    disabled: item.disable,
  });

  const RightMenuExtension = extensionsRegistry.get('navbar.right');
  const RightMenuItemIconExtension = extensionsRegistry.get(
    'navbar.right-menu.item.icon',
  );

  const [confirmLogout, logoutHolder] = useConfirmLogout(
    navbarRight.user_logout_url,
  );

  // Use the theme menu hook
  const themeMenuItem = useThemeMenuItems({
    setThemeMode,
    themeMode,
    allowOSPreference: canDetectOSPreference(),
  });

  const languageMenuItem = useLanguageMenuItems({
    locale: navbarRight.locale || 'en',
    languages: navbarRight.languages || {},
  });

  // Build main menu items
  const menuItems = useMemo(() => {
    // Build menu items for the new dropdown
    const buildNewDropdownItems = (): MenuItem[] => {
      const items: MenuItem[] = [];

      dropdownItems?.forEach(menu => {
        if (menu.onClick) {
          if (findPermission(menu.perm as string, menu.view as string, roles)) {
            items.push({
              key: menu.label,
              label: menu.label,
              icon: menu.icon,
              onClick: menu.onClick,
            });
          }
          return;
        }
        const canShowChild = menu.childs?.some(
          item => typeof item === 'object' && !!item.perm,
        );

        if (menu.childs) {
          if (canShowChild) {
            const childItems: MenuItem[] = [];
            menu.childs.forEach((item, idx) => {
              if (typeof item !== 'string' && item.name && item.perm) {
                if (idx === 3) {
                  childItems.push({ type: 'divider', key: `divider-${idx}` });
                }
                childItems.push(buildMenuItem(item));
              }
            });

            items.push({
              key: `sub2_${menu.label}`,
              label: menu.label,
              icon: menu.icon,
              children: childItems,
              popupOffset: NAVBAR_MENU_POPUP_OFFSET,
            });
          } else if (menu.url) {
            if (
              findPermission(menu.perm as string, menu.view as string, roles)
            ) {
              items.push({
                key: menu.label,
                label: isFrontendRoute(menu.url) ? (
                  <Link to={stripAppRoot(menu.url || '')}>{menu.label}</Link>
                ) : (
                  <Typography.Link href={ensureAppRoot(menu.url || '')}>
                    {menu.label}
                  </Typography.Link>
                ),
                icon: menu.icon,
              });
            }
          }
        } else if (
          findPermission(menu.perm as string, menu.view as string, roles)
        ) {
          items.push({
            key: menu.label,
            label: isFrontendRoute(menu.url) ? (
              <Link to={stripAppRoot(menu.url || '')}>{menu.label}</Link>
            ) : (
              <Typography.Link href={ensureAppRoot(menu.url || '')}>
                {menu.label}
              </Typography.Link>
            ),
            icon: menu.icon,
          });
        }
      });

      return items;
    };

    // Build settings menu items
    const buildSettingsMenuItems = (): MenuItem[] => {
      const items: MenuItem[] = [];

      settings?.forEach((section, index) => {
        const sectionItems: MenuItem[] = [];

        section.childs?.forEach(child => {
          if (typeof child !== 'string') {
            const menuItemDisplay = RightMenuItemIconExtension ? (
              <StyledMenuItemWithIcon>
                {child.label}
                <RightMenuItemIconExtension menuChild={child} />
              </StyledMenuItemWithIcon>
            ) : (
              child.label
            );

            sectionItems.push({
              key: child.label,
              label: isFrontendRoute(child.url) ? (
                <Link to={stripAppRoot(child.url || '')}>
                  {menuItemDisplay}
                </Link>
              ) : (
                <Typography.Link
                  href={child.url || ''}
                  css={css`
                    display: flex;
                    align-items: center;
                    line-height: ${theme.sizeUnit * 10}px;
                  `}
                >
                  {menuItemDisplay}
                </Typography.Link>
              ),
            });
          }
        });

        items.push({
          type: 'group',
          label: section.label,
          key: section.label,
          children: sectionItems,
        });

        if (index < settings.length - 1) {
          items.push({ type: 'divider', key: `divider_${index}` });
        }
      });

      if (!navbarRight.user_is_anonymous) {
        if (items.length) {
          items.push({ type: 'divider', key: 'user-divider' });
        }

        const userItems: MenuItem[] = [];
        if (navbarRight.user_info_url) {
          userItems.push({
            key: 'info',
            label: (
              <Typography.Link href={ensureAppRoot(navbarRight.user_info_url)}>
                {t('Info')}
              </Typography.Link>
            ),
          });
        }
        // AuraData BI: the user's API keys for an AI client
        if (isFeatureEnabled(FeatureFlag.FabApiKeyEnabled)) {
          userItems.push({
            key: 'connect-ai',
            label: (
              <Typography.Link href={ensureAppRoot('/connect-ai/')}>
                {t('Connect AI')}
              </Typography.Link>
            ),
          });
        }
        const showLogout =
          !isEmbedded() ||
          !isFeatureEnabled(FeatureFlag.DisableEmbeddedSupersetLogout);
        if (showLogout) {
          userItems.push({
            key: 'logout',
            label: (
              <Typography.Link
                href={navbarRight.user_logout_url}
                onClick={event => {
                  // The link keeps its address for assistive tech and a
                  // middle click; a plain click asks first.
                  event.preventDefault();
                  confirmLogout();
                }}
              >
                {t('Logout')}
              </Typography.Link>
            ),
          });
        }

        items.push({
          type: 'group',
          label: t('User'),
          key: 'user-section',
          children: userItems,
        });
      }

      if (navbarRight.version_string || navbarRight.version_sha) {
        items.push({ type: 'divider', key: 'version-info-divider' });

        const aboutItem: ItemType = {
          type: 'group',
          label: t('About'),
          key: 'about-section',
          children: [
            {
              key: 'about-info',
              style: { height: 'auto', minHeight: 'auto' },
              label: (
                <div
                  css={(themeArg: SupersetTheme) => css`
                    font-size: ${themeArg.fontSizeSM}px;
                    color: ${themeArg.colorTextSecondary || themeArg.colorText};
                    white-space: pre-wrap;
                    padding: ${themeArg.sizeUnit}px ${themeArg.sizeUnit * 2}px;
                  `}
                >
                  {[
                    navbarRight.show_watermark &&
                      t('Powered by Apache Superset'),
                    navbarRight.version_string &&
                      `${t('Version')}: ${navbarRight.version_string}`,
                    navbarRight.version_sha &&
                      `${t('SHA')}: ${navbarRight.version_sha}`,
                    navbarRight.build_number &&
                      `${t('Build')}: ${navbarRight.build_number}`,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </div>
              ),
            },
          ],
        };
        items.push(aboutItem);
      }
      return items;
    };

    const items: MenuItem[] = [];

    if (RightMenuExtension) {
      items.push({
        key: 'extension',
        label: <RightMenuExtension />,
      });
    }

    if (!navbarRight.user_is_anonymous && showActionDropdown) {
      items.push({
        key: 'new-dropdown',
        label: newLabel ?? <Icons.PlusOutlined data-test="new-dropdown-icon" />,
        className: newLabel ? 'auradata-new-dropdown' : 'submenu-with-caret',
        icon: newLabel ? undefined : <Icons.DownOutlined iconSize="xs" />,
        children: buildNewDropdownItems(),
        popupOffset: NAVBAR_MENU_POPUP_OFFSET,
      });
    }

    if (canSetMode()) {
      items.push(themeMenuItem);
    }

    if (navbarRight.show_language_picker && languageMenuItem) {
      items.push(languageMenuItem);
    }

    items.push({
      key: 'settings',
      label: settingsLabel ?? t('Settings'),
      icon: settingsLabel ? undefined : <Icons.DownOutlined iconSize="xs" />,
      children: buildSettingsMenuItems(),
      className: settingsLabel
        ? 'auradata-user-dropdown'
        : 'submenu-with-caret',
      popupOffset: NAVBAR_MENU_POPUP_OFFSET,
    });

    return items;
  }, [
    RightMenuExtension,
    navbarRight,
    showActionDropdown,
    canSetMode,
    theme.colorPrimary,
    themeMenuItem,
    languageMenuItem,
    dropdownItems,
    roles,
    settings,
    RightMenuItemIconExtension,
    buildMenuItem,
    confirmLogout,
    newLabel,
    settingsLabel,
  ]);

  // Build mobile menu items - consumption only (no create/admin actions)
  const mobileMenuItems = useMemo(() => {
    const items: MenuItem[] = [];

    // Add Dashboards link at top (from main menu)
    // Match on the FAB-internal `name`, which is stable across locales
    // (`label` is translated and would break in non-English deployments)
    const dashboardsMenu = menu?.find(item => item.name === 'Dashboards');
    if (dashboardsMenu) {
      const dashboardUrl = dashboardsMenu.url || '/dashboard/list/';
      items.push({
        key: 'dashboards',
        label: isFrontendRoute(dashboardUrl) ? (
          <Link to={stripAppRoot(dashboardUrl)}>{t('Dashboards')}</Link>
        ) : (
          <Typography.Link href={ensureAppRoot(dashboardUrl)}>
            {t('Dashboards')}
          </Typography.Link>
        ),
        icon: <Icons.DashboardOutlined />,
      });
    }

    // Add theme menu (flatten children directly)
    menuItems.forEach(item => {
      if (!item || !('key' in item)) return;

      // Only include theme-sub-menu and language picker
      if (item.key === 'theme-sub-menu' || item.key === 'language-submenu') {
        items.push({ type: 'divider', key: `divider-before-${item.key}` });

        if ('children' in item && item.children) {
          // Theme menu already has a nested group, so just add its children directly
          item.children.forEach(child => {
            items.push(child);
          });
        } else {
          items.push(item);
        }
      }

      // Extract user-related items from settings
      if (item.key === 'settings' && 'children' in item && item.children) {
        item.children.forEach(child => {
          if (!child || !('key' in child)) return;

          // Only include user-section and about-section
          if (child.key === 'user-section' || child.key === 'about-section') {
            items.push({ type: 'divider', key: `divider-before-${child.key}` });
            items.push(child);
          }
        });
      }
    });

    return items;
  }, [menu, menuItems, isFrontendRoute]);

  return (
    <StyledDiv align={align}>
      {logoutHolder}
      {environmentTag?.text &&
        (() => {
          // Map color values to Ant Design semantic colors
          const validAntDesignColors = [
            'error',
            'warning',
            'success',
            'processing',
            'default',
          ];

          const tagColor = validAntDesignColors.includes(environmentTag.color)
            ? environmentTag.color
            : 'default';

          return (
            <Tag
              color={tagColor}
              css={css`
                border-radius: ${theme.sizeUnit * 125}px;
              `}
            >
              {environmentTag.text}
            </Tag>
          );
        })()}
      {/* Mobile: hamburger menu with drawer */}
      {isMobile && (
        <>
          <Button
            buttonStyle="link"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={t('Menu')}
          >
            <Icons.MenuOutlined iconSize="l" />
          </Button>
          <Drawer
            title={null}
            placement="right"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            width={280}
            styles={{
              header: { display: 'none' },
              body: { padding: 0 },
            }}
          >
            <Menu
              mode="inline"
              selectable={false}
              onClick={info => {
                // The reused desktop items navigate via anchors that only
                // span their label text, but the drawer's tap target is the
                // full menu row — navigate explicitly so row taps work.
                if (info.key === 'info' && navbarRight.user_info_url) {
                  navigateTo(navbarRight.user_info_url);
                  return;
                }
                if (info.key === 'connect-ai') {
                  navigateTo('/connect-ai/');
                  return;
                }
                if (info.key === 'logout' && navbarRight.user_logout_url) {
                  setMobileMenuOpen(false);
                  confirmLogout();
                  return;
                }
                setMobileMenuOpen(false);
              }}
              items={mobileMenuItems}
              css={css`
                border-inline-end: none !important;
              `}
            />
          </Drawer>
        </>
      )}
      {/* Desktop: horizontal menu */}
      {!isMobile && (
        <Menu
          css={css`
            display: flex;
            flex-direction: row;
            align-items: center;
            height: 100%;
            border-bottom: none !important;

            /* Remove the underline from menu items */
            .ant-menu-item:after,
            .ant-menu-submenu:after {
              content: none !important;
            }

            .submenu-with-caret {
              height: 100%;
              padding: 0;
              .ant-menu-submenu-title {
                align-items: center;
                display: flex;
                gap: ${theme.sizeUnit * 2}px;
                flex-direction: row-reverse;
                height: 100%;
              }
              [data-icon='down'] {
                color: ${theme.colorIcon};
                /* sizeXS (an antd token, always computed) rather than
                   fontSizeXS (a Superset custom token seeded only via
                   THEME_DEFAULT in config.py) so this stays small in
                   contexts that construct a theme without that seed, e.g.
                   Storybook and Jest. Both resolve to the same 8px in the
                   app's default theme. */
                font-size: ${theme.sizeXS}px;
              }
              &.ant-menu-submenu::after {
                inset-inline: ${theme.sizeUnit}px;
              }
              &.ant-menu-submenu:hover,
              &.ant-menu-submenu-active {
                .ant-menu-title-content {
                  color: ${theme.colorPrimary};
                }
              }
            }
          `}
          selectable={false}
          mode="horizontal"
          disabledOverflow
          items={menuItems}
        />
      )}
      {navbarRight.documentation_url && (
        <>
          <StyledAnchor
            href={navbarRight.documentation_url}
            target="_blank"
            rel="noreferrer"
            title={navbarRight.documentation_text || t('Documentation')}
            aria-label={navbarRight.documentation_text || t('Documentation')}
          >
            {navbarRight.documentation_icon ? (
              <Icons.BookOutlined />
            ) : (
              <Icons.QuestionCircleOutlined />
            )}
          </StyledAnchor>
          <span>&nbsp;</span>
        </>
      )}
      {navbarRight.bug_report_url && (
        <>
          <StyledAnchor
            href={navbarRight.bug_report_url}
            target="_blank"
            rel="noreferrer"
            title={navbarRight.bug_report_text || t('Report a bug')}
            aria-label={navbarRight.bug_report_text || t('Report a bug')}
          >
            {navbarRight.bug_report_icon ? (
              <i className={navbarRight.bug_report_icon} />
            ) : (
              <Icons.BugOutlined />
            )}
          </StyledAnchor>
          <span>&nbsp;</span>
        </>
      )}
      {navbarRight.user_is_anonymous && (
        <StyledAnchor href={navbarRight.user_login_url}>
          <Icons.LoginOutlined /> {t('Login')}
        </StyledAnchor>
      )}
      <TelemetryPixel
        version={navbarRight.version_string}
        // Build details may be redacted to empty/null for non-admins; fall back
        // to the component's "unknown" defaults instead of emitting empty path
        // segments in the Scarf pixel URL.
        sha={navbarRight.version_sha || undefined}
        build={navbarRight.build_number || undefined}
        enabled={scarfAnalytics !== false}
      />
    </StyledDiv>
  );
};

export default RightMenu;
