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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import copyTextToClipboard from 'src/utils/copy';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { navigateTo } from 'src/utils/navigationUtils';
import {
  fetchWorkspaces,
  moveDashboards,
  type Workspace,
} from '../workspaces/api';

/** What a row of the dashboard list needs for its menu. */
export interface DashboardRow {
  id: number;
  dashboard_title: string;
  url: string;
}

interface DashboardRowMenuOptions<T extends DashboardRow> {
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
  isStarred: (id: number) => boolean;
  toggleStar: (id: number, starred: boolean) => void;
  onEdit: (row: T) => void;
  onExport: (row: T) => void;
  onDelete: (row: T) => void;
  onMoved: () => void;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
}

const absoluteUrl = (url: string) =>
  new URL(ensureAppRoot(url), window.location.origin).toString();

/**
 * The menu of a right click on a dashboard of the list: open it here or in a
 * new tab, copy its link, star it, move it to a workspace, and the actions of
 * its row (properties, export, delete).
 */
export function useDashboardRowMenu<T extends DashboardRow>({
  canEdit,
  canExport,
  canDelete,
  isStarred,
  toggleStar,
  onEdit,
  onExport,
  onDelete,
  onMoved,
  addSuccessToast,
  addDangerToast,
}: DashboardRowMenuOptions<T>): (row: T) => MenuItem[] {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    if (!canEdit) return;
    fetchWorkspaces()
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]));
  }, [canEdit]);

  const moveTo = useCallback(
    async (row: T, workspace: Workspace) => {
      try {
        await moveDashboards(workspace.id, { add: [row.id] });
        addSuccessToast(
          t('«%s» moved to %s', row.dashboard_title, workspace.name),
        );
        onMoved();
      } catch {
        addDangerToast(t('The dashboard could not be moved'));
      }
    },
    [addDangerToast, addSuccessToast, onMoved],
  );

  return useCallback(
    (row: T): MenuItem[] => {
      const starred = isStarred(row.id);
      return [
        {
          key: 'open',
          icon: <Icons.DashboardOutlined iconSize="m" />,
          label: t('Open'),
          onClick: () => navigateTo(row.url, { assign: true }),
        },
        {
          key: 'open-tab',
          icon: <Icons.ExportOutlined iconSize="m" />,
          label: t('Open in a new tab'),
          onClick: () =>
            window.open(absoluteUrl(row.url), '_blank', 'noopener'),
        },
        {
          key: 'copy-link',
          icon: <Icons.LinkOutlined iconSize="m" />,
          label: t('Copy link'),
          onClick: () =>
            copyTextToClipboard(() => Promise.resolve(absoluteUrl(row.url)))
              .then(() => addSuccessToast(t('Link copied to clipboard')))
              .catch(() => addDangerToast(t('The link could not be copied'))),
        },
        { type: 'divider' },
        {
          key: 'star',
          icon: starred ? (
            <Icons.StarFilled iconSize="m" />
          ) : (
            <Icons.StarOutlined iconSize="m" />
          ),
          label: starred ? t('Remove from favorites') : t('Add to favorites'),
          onClick: () => toggleStar(row.id, starred),
        },
        ...(canEdit && workspaces.length
          ? [
              {
                key: 'move',
                icon: <Icons.AppstoreOutlined iconSize="m" />,
                label: t('Move to workspace'),
                children: workspaces.map(workspace => ({
                  key: `move-${workspace.id}`,
                  label: workspace.name,
                  onClick: () => moveTo(row, workspace),
                })),
              },
            ]
          : []),
        ...(canEdit || canExport ? [{ type: 'divider' as const }] : []),
        ...(canEdit
          ? [
              {
                key: 'properties',
                icon: <Icons.EditOutlined iconSize="m" />,
                label: t('Edit properties'),
                onClick: () => onEdit(row),
              },
            ]
          : []),
        ...(canExport
          ? [
              {
                key: 'export',
                icon: <Icons.UploadOutlined iconSize="m" />,
                label: t('Export'),
                onClick: () => onExport(row),
              },
            ]
          : []),
        ...(canDelete
          ? [
              { type: 'divider' as const },
              {
                key: 'delete',
                icon: <Icons.DeleteOutlined iconSize="m" />,
                label: t('Delete'),
                danger: true,
                onClick: () => onDelete(row),
              },
            ]
          : []),
      ];
    },
    [
      addDangerToast,
      addSuccessToast,
      canDelete,
      canEdit,
      canExport,
      isStarred,
      moveTo,
      onDelete,
      onEdit,
      onExport,
      toggleStar,
      workspaces,
    ],
  );
}
