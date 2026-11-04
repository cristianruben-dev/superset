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
  clearRecentDashboards,
  readRecentDashboards,
  rememberDashboard,
} from './recentDashboards';

beforeEach(() => window.localStorage.clear());

const dashboard = (id: number) => ({
  id,
  title: `Dashboard ${id}`,
  url: `/superset/dashboard/${id}/`,
});

test('the dashboard opened last goes first, once', () => {
  rememberDashboard(dashboard(1), 1000);
  rememberDashboard(dashboard(2), 2000);
  rememberDashboard(dashboard(1), 3000);
  expect(readRecentDashboards().map(item => [item.id, item.openedAt])).toEqual([
    [1, 3000],
    [2, 2000],
  ]);
});

test('keeps the last eight dashboards', () => {
  Array.from({ length: 10 }, (_, index) => rememberDashboard(dashboard(index)));
  const list = readRecentDashboards();
  expect(list).toHaveLength(8);
  expect(list[0].id).toBe(9);
});

test('a broken list reads as empty and can be cleared', () => {
  window.localStorage.setItem('mibi.recentDashboards', '{not json');
  expect(readRecentDashboards()).toEqual([]);
  rememberDashboard(dashboard(1));
  clearRecentDashboards();
  expect(readRecentDashboards()).toEqual([]);
});
