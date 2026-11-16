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
import type { DashboardLayout } from 'src/dashboard/types';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { HIDDEN_PAGE_KEY } from 'src/auradata/present/dashboardTabs';
import {
  LANDING_PAGE_KEY,
  landingPageOf,
  savedLandingPage,
} from './landingPage';

const report = (
  landing: unknown,
  pageMeta: Record<string, Record<string, unknown>> = {},
) =>
  ({
    [DASHBOARD_ROOT_ID]: {
      id: DASHBOARD_ROOT_ID,
      type: 'ROOT',
      children: ['TABS-1'],
      meta: { [LANDING_PAGE_KEY]: landing },
    },
    'TABS-1': {
      id: 'TABS-1',
      type: 'TABS',
      children: ['TAB-1', 'TAB-2', 'TAB-3'],
      parents: [DASHBOARD_ROOT_ID],
      meta: {},
    },
    ...Object.fromEntries(
      ['TAB-1', 'TAB-2', 'TAB-3'].map(id => [
        id,
        {
          id,
          type: 'TAB',
          children: [],
          parents: [DASHBOARD_ROOT_ID, 'TABS-1'],
          meta: { text: id, ...pageMeta[id] },
        },
      ]),
    ),
  }) as unknown as DashboardLayout;

test('the report opens on its landing page', () => {
  expect(landingPageOf(report('TAB-2'))).toBe('TAB-2');
  expect(savedLandingPage(report('TAB-2'))).toBe('TAB-2');
});

test('without a landing page the report opens on the first page', () => {
  expect(landingPageOf(report(undefined))).toBeUndefined();
  expect(landingPageOf(report(''))).toBeUndefined();
  expect(landingPageOf(undefined)).toBeUndefined();
});

test('a deleted, hidden or tooltip landing page opens the first page', () => {
  expect(landingPageOf(report('TAB-9'))).toBeUndefined();
  expect(
    landingPageOf(report('TAB-2', { 'TAB-2': { [HIDDEN_PAGE_KEY]: true } })),
  ).toBeUndefined();
  expect(
    landingPageOf(
      report('TAB-3', {
        'TAB-3': { auradataTooltipPage: { width: 10, height: 8 } },
      }),
    ),
  ).toBeUndefined();
  // Still saved, so showing the page again brings it back
  expect(
    savedLandingPage(report('TAB-2', { 'TAB-2': { [HIDDEN_PAGE_KEY]: true } })),
  ).toBe('TAB-2');
});
