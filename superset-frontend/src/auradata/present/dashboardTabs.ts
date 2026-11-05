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
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import { TABS_TYPE } from 'src/dashboard/util/componentTypes';
import type { DashboardLayout } from 'src/dashboard/types';

/** A page viewers do not see in the tabs; links and drill through still open it. */
export const HIDDEN_PAGE_KEY = 'auradataHiddenPage';
/** Same key as `TOOLTIP_PAGE_KEY` in `src/auradata/report/types`. */
const TOOLTIP_PAGE_KEY = 'auradataTooltipPage';

/** Whether viewers miss a page in the tabs: hidden, or a tooltip page. */
export const isHiddenPage = (meta: Record<string, unknown> | undefined) =>
  !!meta?.[HIDDEN_PAGE_KEY] || !!meta?.[TOOLTIP_PAGE_KEY];

export interface DashboardTab {
  id: string;
  title: string;
  /** Value for setDirectPathToChild that opens this tab. */
  path: string[];
  hidden: boolean;
}

/** The top level tabs of a dashboard, in order; empty when it has none. */
export function topLevelTabs(layout: DashboardLayout): DashboardTab[] {
  const rootChild = layout[DASHBOARD_ROOT_ID]?.children?.[0];
  const tabs = rootChild ? layout[rootChild] : undefined;
  if (!tabs || tabs.type !== TABS_TYPE) return [];
  const parents = tabs.parents ?? [DASHBOARD_ROOT_ID];
  return tabs.children
    .filter(id => layout[id])
    .map(id => ({
      id,
      title: String(layout[id].meta?.text ?? ''),
      path: [...parents, tabs.id, id],
      hidden: isHiddenPage(layout[id].meta),
    }));
}

/** The pages a viewer can go through: all but the hidden ones. */
export const visibleTabs = (layout: DashboardLayout): DashboardTab[] =>
  topLevelTabs(layout).filter(tab => !tab.hidden);

/** Index of the active tab among the top level tabs, 0 when unknown. */
export function activeTabIndex(
  tabs: DashboardTab[],
  activeTabs: string[] | undefined,
): number {
  const index = tabs.findIndex(tab => activeTabs?.includes(tab.id));
  return Math.max(0, index);
}

/** The container of the page on screen: its tab, or the grid without tabs. */
export function activePageId(
  layout: DashboardLayout,
  activeTabs: string[] | undefined,
): string {
  const tabs = topLevelTabs(layout);
  return tabs.length
    ? tabs[activeTabIndex(tabs, activeTabs)].id
    : DASHBOARD_GRID_ID;
}
