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
import { useEffect, useLayoutEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import type { NavSection } from './navigation';
import { isNavItemActive } from './navigation';

/** One step of the breadcrumb trail; the last one is the current page. */
export interface Crumb {
  label: string;
  url?: string;
}

let extra: Crumb[] = [];
const listeners = new Set<() => void>();

const publish = (crumbs: Crumb[]) => {
  extra = crumbs;
  listeners.forEach(listener => listener());
};

/**
 * Adds the steps a page knows past its navigation entry (a workspace name) to
 * the breadcrumb trail of the shell, while the page is mounted.
 */
export function usePageCrumbs(crumbs: Crumb[]) {
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    publish(JSON.parse(key) as Crumb[]);
    return () => publish([]);
  }, [key]);
}

/** The steps pages add to the trail. */
export function useExtraCrumbs(): Crumb[] {
  const [current, setCurrent] = useState(extra);
  useLayoutEffect(() => {
    const update = () => setCurrent(extra);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return current;
}

export const HOME_URL = '/welcome/';

/**
 * The trail of a location from the navigation: home, the section title when
 * the entry sits in one, then the entry itself.
 */
export function navCrumbs(sections: NavSection[], pathname: string): Crumb[] {
  const home = { label: t('Home'), url: HOME_URL };
  for (const section of sections) {
    const item = section.items.find(entry => isNavItemActive(entry, pathname));
    if (item) {
      // Home is the root: its own header names it
      return item.url === HOME_URL
        ? []
        : [
            home,
            ...(section.title ? [{ label: section.title }] : []),
            { label: item.label, url: item.url },
          ];
    }
  }
  return [home];
}
