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
import { useEffect, useState } from 'react';

/** A dashboard the user opened, newest first in the list. */
export interface RecentDashboard {
  id: number;
  title: string;
  url: string;
  /** When it was opened, in milliseconds */
  openedAt: number;
}

const KEY = 'mibi.recentDashboards';
const LIMIT = 8;
const CHANGE_EVENT = 'mibi:recent-dashboards';

/** The dashboards opened in this browser, newest first. */
export function readRecentDashboards(): RecentDashboard[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    return Array.isArray(value)
      ? value.filter(
          (item): item is RecentDashboard =>
            typeof item?.id === 'number' && typeof item?.url === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** Puts a dashboard first in "Open recent". */
export function rememberDashboard(
  dashboard: Omit<RecentDashboard, 'openedAt'>,
  now = Date.now(),
) {
  const list = [
    { ...dashboard, openedAt: now },
    ...readRecentDashboards().filter(item => item.id !== dashboard.id),
  ].slice(0, LIMIT);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // the list only lasts for this page
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Empties "Open recent". */
export function clearRecentDashboards() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing was kept
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The recent dashboards, following changes in this tab and others. */
export function useRecentDashboards(): RecentDashboard[] {
  const [list, setList] = useState(readRecentDashboards);
  useEffect(() => {
    const update = () => setList(readRecentDashboards());
    window.addEventListener(CHANGE_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return list;
}
