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
import type {
  MenuObjectChildProps,
  MenuObjectProps,
} from 'src/types/bootstrapTypes';

/** Icon names from @superset-ui/core/components/Icons. */
export type NavIconName =
  | 'HomeOutlined'
  | 'DashboardOutlined'
  | 'TableOutlined'
  | 'DatabaseOutlined'
  | 'ConsoleSqlOutlined'
  | 'SaveOutlined'
  | 'HistoryOutlined'
  | 'UserOutlined'
  | 'TeamOutlined'
  | 'GroupOutlined'
  | 'ProfileOutlined'
  | 'SafetyOutlined'
  | 'FormatPainterOutlined'
  | 'BgColorsOutlined'
  | 'HighlightOutlined'
  | 'AppstoreOutlined';

export interface NavItem {
  key: string;
  label: string;
  url: string;
  icon: NavIconName;
}

export interface NavSection {
  key: string;
  /** Sections without a title render as the primary navigation. */
  title?: string;
  /** Collapsible sections start closed unless one of their items is active. */
  collapsible?: boolean;
  items: NavItem[];
}

const HOME_URL = '/superset/welcome/';

const ICONS: Record<string, NavIconName> = {
  Dashboards: 'DashboardOutlined',
  Datasets: 'TableOutlined',
  Databases: 'DatabaseOutlined',
  'SQL Editor': 'ConsoleSqlOutlined',
  'Saved Queries': 'SaveOutlined',
  'Query Search': 'HistoryOutlined',
  'List Users': 'UserOutlined',
  'List Roles': 'TeamOutlined',
  'List Groups': 'GroupOutlined',
  'Action Log': 'ProfileOutlined',
  'Row Level Security': 'SafetyOutlined',
  'CSS Templates': 'FormatPainterOutlined',
  Themes: 'BgColorsOutlined',
  'Annotation Layers': 'HighlightOutlined',
};

/** Menus whose entries go to the primary navigation, in this order. */
const PRIMARY = ['Dashboards', 'Datasets', 'Data'];
/** Menus grouped under their own titled section, in this order. */
const SECTIONS: { key: string; menus: string[]; collapsible?: boolean }[] = [
  { key: 'sql', menus: ['SQL Lab'] },
  { key: 'admin', menus: ['Security', 'Manage'], collapsible: true },
];

/** Shorter labels than the backend menu ones, for the sidebar. */
const labels = (): Record<string, string> => ({
  Databases: t('Databases'),
});

const toItem = (entry: MenuObjectChildProps): NavItem | null => {
  if (!entry.url) {
    return null;
  }
  const key = entry.name || entry.label;
  return {
    key,
    label: labels()[key] || entry.label,
    url: entry.url,
    icon: ICONS[key] || 'AppstoreOutlined',
  };
};

/** The navigable entries of a menu: itself when it has a URL, else its children. */
const menuItems = (menu: MenuObjectProps): NavItem[] => {
  const children = (menu.childs || []).filter(
    (child): child is MenuObjectChildProps => typeof child !== 'string',
  );
  const entries = menu.url && !children.length ? [menu] : children;
  return entries.map(toItem).filter((item): item is NavItem => !!item);
};

/**
 * Group the backend menu into the sidebar sections. Only the menus the user can
 * access reach the frontend, so permissions are already applied.
 */
export function buildNavSections(menu: MenuObjectProps[]): NavSection[] {
  const byName = new Map(
    menu.filter(Boolean).map(item => [item.name || item.label, item]),
  );
  const pick = (names: string[]) =>
    names.flatMap(name => {
      const item = byName.get(name);
      return item ? menuItems(item) : [];
    });

  const sectionTitles: Record<string, string> = {
    sql: t('SQL'),
    admin: t('Administration'),
  };

  const sections: NavSection[] = [
    {
      key: 'main',
      items: [
        { key: 'Home', label: t('Home'), url: HOME_URL, icon: 'HomeOutlined' },
        ...pick(PRIMARY),
      ],
    },
    ...SECTIONS.map(({ key, menus, collapsible }) => ({
      key,
      title: sectionTitles[key],
      collapsible,
      items: pick(menus),
    })),
  ];

  // Menus this layout does not know about still show up, at the end
  const known = new Set([...PRIMARY, ...SECTIONS.flatMap(s => s.menus)]);
  const others = menu.filter(
    item => item && !known.has(item.name || item.label),
  );
  if (others.length) {
    sections.push({
      key: 'more',
      title: t('More'),
      collapsible: true,
      items: others.flatMap(menuItems),
    });
  }

  return sections.filter(section => section.items.length);
}

/** Whether a navigation item matches the current location. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.url === HOME_URL) {
    return pathname === HOME_URL;
  }
  const base = item.url.replace(/(list\/?)?$/, '');
  return (
    pathname === item.url || (base.length > 1 && pathname.startsWith(base))
  );
}
