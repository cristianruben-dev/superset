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
import { relativeTime } from '../time';
import { withShortcut } from './MenuBar';
import {
  clearRecentDashboards,
  type RecentDashboard,
} from './recentDashboards';

/**
 * "Open recent" of a File menu: the dashboards opened last, with when, and a
 * way to empty the list. Leaves out the dashboard on screen.
 */
export function recentMenuItem(
  recent: RecentDashboard[],
  open: (url: string) => void,
  currentId?: number,
): MenuItem {
  const list = recent.filter(item => item.id !== currentId);
  return {
    key: 'recent',
    icon: <Icons.HistoryOutlined iconSize="m" />,
    label: t('Open recent'),
    disabled: !list.length,
    children: list.length
      ? [
          ...list.map(item => ({
            key: `recent-${item.id}`,
            icon: <Icons.DashboardOutlined iconSize="m" />,
            label: withShortcut(item.title, relativeTime(item.openedAt)),
            onClick: () => open(item.url),
          })),
          { type: 'divider' as const },
          {
            key: 'recent-clear',
            label: t('Clear recent list'),
            onClick: clearRecentDashboards,
          },
        ]
      : undefined,
  };
}
