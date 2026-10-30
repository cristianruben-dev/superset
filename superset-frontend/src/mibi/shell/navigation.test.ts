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
import type { MenuObjectProps } from 'src/types/bootstrapTypes';
import { buildNavSections, isNavItemActive } from './navigation';

const menu: MenuObjectProps[] = [
  {
    name: 'Security',
    label: 'Security',
    childs: ['-', { name: 'List Users', label: 'List Users', url: '/users/' }],
  },
  {
    name: 'Data',
    label: 'Data',
    childs: [
      {
        name: 'Databases',
        label: 'Database Connections',
        url: '/databaseview/list/',
      },
    ],
  },
  { name: 'Dashboards', label: 'Dashboards', url: '/dashboard/list/' },
  { name: 'Datasets', label: 'Datasets', url: '/tablemodelview/list/' },
  {
    name: 'SQL Lab',
    label: 'SQL',
    childs: [
      { name: 'SQL Editor', label: 'SQL Lab', url: '/sqllab/' },
      { name: 'Query Search', label: 'Query History', url: '/sqllab/history/' },
    ],
  },
  {
    name: 'Plugins',
    label: 'Plugins',
    childs: [{ name: 'Custom', label: 'Custom', url: '/custom/' }],
  },
];

test('groups the menu into primary, SQL, admin and extra sections', () => {
  const sections = buildNavSections(menu);

  expect(sections.map(section => section.key)).toEqual([
    'main',
    'sql',
    'admin',
    'more',
  ]);
  expect(sections[0].items.map(item => item.key)).toEqual([
    'Home',
    'Workspaces',
    'Dashboards',
    'Datasets',
    'Databases',
  ]);
  expect(sections[1].items.map(item => item.url)).toEqual([
    '/sqllab/',
    '/sqllab/history/',
  ]);
  expect(sections[2]).toMatchObject({ collapsible: true });
  expect(sections[2].items[0]).toMatchObject({
    key: 'List Users',
    icon: 'UserOutlined',
  });
  expect(sections[3].items[0]).toMatchObject({
    key: 'Custom',
    icon: 'AppstoreOutlined',
  });
});

test('uses the short sidebar label for databases', () => {
  const [main] = buildNavSections(menu);

  expect(main.items.find(item => item.key === 'Databases')?.label).toBe(
    'Databases',
  );
});

test('drops sections the user cannot access', () => {
  const sections = buildNavSections([
    { name: 'Dashboards', label: 'Dashboards', url: '/dashboard/list/' },
  ]);

  expect(sections.map(section => section.key)).toEqual(['main']);
});

test('matches the current location to a navigation item', () => {
  const [main, sql] = buildNavSections(menu);
  const [home, workspaces, dashboards] = main.items;

  expect(isNavItemActive(home, '/superset/welcome/')).toBe(true);
  expect(isNavItemActive(home, '/dashboard/list/')).toBe(false);
  expect(isNavItemActive(dashboards, '/dashboard/list/')).toBe(true);
  expect(isNavItemActive(workspaces, '/workspace/list/')).toBe(true);
  expect(isNavItemActive(workspaces, '/workspace/3/')).toBe(true);
  expect(isNavItemActive(dashboards, '/superset/dashboard/1/')).toBe(false);
  expect(isNavItemActive(sql.items[1], '/sqllab/history/')).toBe(true);
});

test('shows workspaces only to users who can see dashboards', () => {
  const [main] = buildNavSections([
    { name: 'Datasets', label: 'Datasets', url: '/tablemodelview/list/' },
  ]);

  expect(main.items.map(item => item.key)).toEqual(['Home', 'Datasets']);
});
