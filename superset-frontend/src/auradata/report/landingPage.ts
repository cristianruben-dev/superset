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
import type { DashboardLayout } from 'src/dashboard/types';
import { topLevelTabs } from 'src/auradata/present/dashboardTabs';

/**
 * `ROOT_ID.meta.auradataLandingPage`: the page a report opens on when the
 * address names none, as Power BI's "Set as landing page". One id for the whole
 * report, so a copied page never becomes a second landing page.
 */
export const LANDING_PAGE_KEY = 'auradataLandingPage';

/** The id saved as the landing page, whether or not it still opens. */
export const savedLandingPage = (
  layout: DashboardLayout | undefined,
): string | undefined => {
  const id = layout?.[DASHBOARD_ROOT_ID]?.meta?.[LANDING_PAGE_KEY];
  return typeof id === 'string' && id ? id : undefined;
};

/**
 * The page the report opens on: its landing page while it is still a page
 * viewers can see. A deleted, hidden or tooltip page opens the first one.
 */
export function landingPageOf(
  layout: DashboardLayout | undefined,
): string | undefined {
  const id = savedLandingPage(layout);
  if (!layout || !id) return undefined;
  const page = topLevelTabs(layout).find(tab => tab.id === id);
  return page && !page.hidden ? page.id : undefined;
}
