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
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { useDownloadMenuItems } from 'src/dashboard/components/menu/DownloadMenuItems';
import { useShareMenuItems } from 'src/dashboard/components/menu/ShareMenuItems';
import type { RootState } from 'src/dashboard/types';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { useHeaderReportMenuItems } from 'src/features/reports/ReportModal/HeaderReportDropdown';
import { setCanvasView, useCanvasView } from '../format/canvasView';
import { usePhoneScreen } from '../format/mobile';
import { setPresenting } from '../present/presentation';
import { useAppMenus } from '../shell/appMenus';
import { MenuBar } from '../shell/MenuBar';
import { useMenuBarSlot } from '../shell/menuBarSlot';
import {
  rememberDashboard,
  useRecentDashboards,
} from '../shell/recentDashboards';
import { recentMenuItem } from '../shell/recentMenu';
import { navigateTo } from 'src/utils/navigationUtils';
import { applyBookmark, bookmarksOf } from './bookmarks';
import { useFiltersChanged } from './ResetFiltersButton';
import { resetFilters } from './resetFilters';

const childrenOf = (item: MenuItem | null): MenuItem[] =>
  item && 'children' in item && Array.isArray(item.children)
    ? (item.children as MenuItem[])
    : item
      ? [item]
      : [];

const check = (on: boolean) =>
  on ? <Icons.CheckOutlined iconSize="s" /> : <span style={{ width: 14 }} />;

const toggleFullscreen = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
};

export interface ReportMenuBarProps {
  dashboardId: number;
  dashboardTitle: string;
  isLoading?: boolean;
  userCanEdit?: boolean;
  userCanShare?: boolean;
  userCanCurate?: boolean;
  userCanExport?: boolean;
  /** The report is open in the editor: what only reading needs leaves the menus */
  editing?: boolean;
  /** When it changed last, already in words ("2 hours ago") */
  modified?: string;
  logEvent?: Function;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
  onRefresh: () => void;
  onAutoRefresh: () => void;
  onEdit: () => void;
  onExport: () => void;
  onEmbed: () => void;
  showReportModal: () => void;
  setCurrentReportDeleting: (report: unknown) => void;
}

/**
 * The menu bar of a report (File, View, Go to, Filters, Export, Share, Help), on
 * the first row of the window, as a desktop application, in reading view and in
 * the editor, under which the ribbon goes on. It gathers the actions of the "⋯"
 * menu, which stays too, and the menus every other page has.
 */
export function ReportMenuBar({
  dashboardId,
  dashboardTitle,
  isLoading,
  userCanEdit,
  userCanShare,
  userCanCurate,
  userCanExport,
  editing,
  modified,
  logEvent,
  addSuccessToast,
  addDangerToast,
  onRefresh,
  onAutoRefresh,
  onEdit,
  onExport,
  onEmbed,
  showReportModal,
  setCurrentReportDeleting,
}: ReportMenuBarProps) {
  const dispatch = useDispatch();
  const view = useCanvasView();
  const filtersChanged = useFiltersChanged();
  const bookmarks = useSelector((state: RootState) =>
    bookmarksOf(state.dashboardLayout?.present),
  );
  const phone = usePhoneScreen();
  // The first row of the window; without the app frame there is no menu bar
  const slot = useMenuBarSlot();
  const recent = useRecentDashboards();
  const app = useAppMenus();

  // The report goes first in "Open recent" of every File menu
  useEffect(() => {
    if (dashboardId && dashboardTitle) {
      rememberDashboard({
        id: dashboardId,
        title: dashboardTitle,
        url: `/dashboard/${dashboardId}/`,
      });
    }
  }, [dashboardId, dashboardTitle]);

  const url = useMemo(
    () =>
      getDashboardUrl({
        pathname: window.location.pathname,
        filters: getActiveFilters(),
        hash: window.location.hash,
      }),
    [],
  );
  const share = useShareMenuItems({
    title: t('Share'),
    disabled: isLoading,
    url,
    dashboardId,
    copyMenuItemTitle: t('Copy permalink to clipboard'),
    emailMenuItemTitle: t('Share permalink by email'),
    emailSubject: `${t('Superset dashboard')} ${dashboardTitle}`,
    emailBody: t('Check out this dashboard: '),
    addSuccessToast,
    addDangerToast,
  });
  const download = useDownloadMenuItems({
    pdfMenuItemTitle: t('Export to PDF'),
    imageMenuItemTitle: t('Download as Image'),
    dashboardTitle,
    dashboardId,
    title: t('Download'),
    disabled: isLoading,
    logEvent,
    userCanExport,
  });
  const report = useHeaderReportMenuItems({
    dashboardId,
    showReportModal,
    setCurrentReportDeleting,
  });

  if (phone || !slot) return null;

  const file: MenuItem[] = [
    ...app.create,
    recentMenuItem(
      recent,
      url => navigateTo(url, { assign: true }),
      dashboardId,
    ),
    { type: 'divider' },
    {
      key: 'refresh',
      icon: <Icons.SyncOutlined iconSize="m" />,
      label: t('Refresh dashboard'),
      disabled: isLoading,
      onClick: onRefresh,
    },
    {
      key: 'auto-refresh',
      icon: <Icons.FieldTimeOutlined iconSize="m" />,
      label: t('Set auto-refresh'),
      disabled: isLoading,
      onClick: onAutoRefresh,
    },
    ...(userCanEdit && !editing
      ? [
          {
            key: 'edit',
            icon: <Icons.EditOutlined iconSize="m" />,
            label: t('Edit dashboard'),
            onClick: onEdit,
          },
        ]
      : []),
    ...(app.account.length ? [{ type: 'divider' as const }] : []),
    ...app.account,
  ];

  const viewMenu: MenuItem[] = [
    ...(editing
      ? []
      : [
          {
            key: 'present',
            icon: <Icons.FundProjectionScreenOutlined iconSize="m" />,
            label: t('Present'),
            onClick: () => setPresenting(true),
          },
        ]),
    {
      key: 'fullscreen',
      icon: <Icons.FullscreenOutlined iconSize="m" />,
      label: t('Full screen'),
      onClick: toggleFullscreen,
    },
    { type: 'divider' },
    {
      type: 'group',
      key: 'zoom',
      label: t('Scale to fit'),
      children: [
        {
          key: 'fit-page',
          icon: check(view.mode === 'fit-page'),
          label: t('Fit page'),
          onClick: () => setCanvasView({ mode: 'fit-page' }),
        },
        {
          key: 'fit-width',
          icon: check(view.mode === 'fit-width'),
          label: t('Fit width'),
          onClick: () => setCanvasView({ mode: 'fit-width' }),
        },
        {
          key: 'actual-size',
          icon: check(view.mode === 'custom' && view.zoom === 1),
          label: t('Actual size'),
          onClick: () => setCanvasView({ mode: 'custom', zoom: 1 }),
        },
      ],
    },
    ...app.appearance,
  ];

  const filters: MenuItem[] = [
    {
      key: 'reset',
      icon: <Icons.Undo iconSize="m" />,
      label: t('Reset filters'),
      disabled: !filtersChanged,
      onClick: () => dispatch(resetFilters() as never),
    },
    ...(bookmarks.length && !editing
      ? [
          { type: 'divider' as const },
          {
            type: 'group' as const,
            key: 'bookmarks',
            label: t('Bookmarks'),
            children: bookmarks.map(bookmark => ({
              key: `bookmark-${bookmark.id}`,
              icon: <Icons.BookOutlined iconSize="m" />,
              label: bookmark.name,
              onClick: () => dispatch(applyBookmark(bookmark.id) as never),
            })),
          },
        ]
      : []),
  ];

  const exportMenu: MenuItem[] = [
    {
      key: 'export-layout',
      icon: <Icons.FilePdfOutlined iconSize="m" />,
      label: t('PDF or image'),
      disabled: isLoading,
      onClick: onExport,
    },
    { type: 'divider' },
    ...childrenOf(download),
  ];

  const shareMenu: MenuItem[] = [
    ...(userCanShare ? childrenOf(share) : []),
    ...(userCanCurate
      ? [
          {
            key: 'embed',
            icon: <Icons.ShareAltOutlined iconSize="m" />,
            label: t('Embed dashboard'),
            onClick: onEmbed,
          },
        ]
      : []),
    ...(report ? [{ type: 'divider' as const }, report] : []),
  ];

  return createPortal(
    <MenuBar
      data-test="auradata-report-menubar"
      menus={[
        { key: 'file', label: t('File'), items: file },
        { key: 'view', label: t('View'), items: viewMenu },
        { key: 'go', label: t('Go to'), items: app.goTo },
        { key: 'filters', label: t('Filters'), items: filters },
        { key: 'export', label: t('Export'), items: exportMenu },
        { key: 'share', label: t('Share'), items: shareMenu },
        { key: 'help', label: t('Help'), items: app.help },
      ]}
      end={modified ? t('Modified %s', modified) : undefined}
    />,
    slot,
  );
}
