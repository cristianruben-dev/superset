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
import type { NavSection } from './navigation';
import { HOME_URL, navCrumbs } from './pageCrumbs';

const sections: NavSection[] = [
  {
    key: 'main',
    items: [
      { key: 'Home', label: 'Home', url: HOME_URL, icon: 'HomeOutlined' },
      {
        key: 'Dashboards',
        label: 'Dashboards',
        url: '/dashboard/list/',
        icon: 'DashboardOutlined',
      },
    ],
  },
  {
    key: 'admin',
    title: 'Administration',
    items: [
      {
        key: 'Databases',
        label: 'Connections',
        url: '/databaseview/list/',
        icon: 'DatabaseOutlined',
      },
    ],
  },
];

test('home has no trail of its own', () => {
  expect(navCrumbs(sections, HOME_URL)).toEqual([]);
});

test('a primary page follows home', () => {
  expect(navCrumbs(sections, '/dashboard/list/')).toEqual([
    { label: 'Home', url: HOME_URL },
    { label: 'Dashboards', url: '/dashboard/list/' },
  ]);
});

test('a page of a section names the section', () => {
  expect(navCrumbs(sections, '/databaseview/list/')).toEqual([
    { label: 'Home', url: HOME_URL },
    { label: 'Administration' },
    { label: 'Connections', url: '/databaseview/list/' },
  ]);
});

test('an unknown page only shows home', () => {
  expect(navCrumbs(sections, '/somewhere/')).toEqual([
    { label: 'Home', url: HOME_URL },
  ]);
});
