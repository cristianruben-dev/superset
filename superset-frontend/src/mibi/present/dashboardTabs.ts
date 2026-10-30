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
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { TABS_TYPE } from 'src/dashboard/util/componentTypes';
import type { DashboardLayout } from 'src/dashboard/types';

export interface DashboardTab {
  id: string;
  title: string;
  /** Value for setDirectPathToChild that opens this tab. */
  path: string[];
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
    }));
}

/** Index of the active tab among the top level tabs, 0 when unknown. */
export function activeTabIndex(
  tabs: DashboardTab[],
  activeTabs: string[] | undefined,
): number {
  const index = tabs.findIndex(tab => activeTabs?.includes(tab.id));
  return Math.max(0, index);
}
