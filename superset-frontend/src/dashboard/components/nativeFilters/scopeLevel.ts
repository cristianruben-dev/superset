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
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  Divider,
  Filter,
  FilterScopeLevel,
  NativeFilterType,
} from '@superset-ui/core';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { DYNAMIC_TYPE } from 'src/dashboard/util/componentTypes';
import {
  ELEMENT_KEY,
  elementKey,
  type FilterElement,
} from 'src/mibi/elements/types';
import { LayoutItem, RootState } from 'src/dashboard/types';
import { useDashboardHasTabs, useIsFilterInScope } from './state';

type ScopedFilter = Pick<
  Filter,
  'scope' | 'scopeLevel' | 'chartsInScope' | 'type'
>;

/**
 * Resolves the filter bar section of a native filter. An explicit
 * `scopeLevel` wins; otherwise the level is derived from the scope:
 * - scope rooted at one or more tabs -> page
 * - scope covering the whole dashboard -> report
 * - scope rooted at the dashboard but limited to a minority of its
 *   charts -> visual
 */
export function getFilterScopeLevel(filter: ScopedFilter): FilterScopeLevel {
  if (
    filter.scopeLevel &&
    Object.values(FilterScopeLevel).includes(filter.scopeLevel)
  ) {
    return filter.scopeLevel;
  }
  const rootPath = filter.scope?.rootPath ?? [DASHBOARD_ROOT_ID];
  const excluded = filter.scope?.excluded ?? [];

  if (rootPath.length > 0 && !rootPath.includes(DASHBOARD_ROOT_ID)) {
    return FilterScopeLevel.Page;
  }
  if (excluded.length === 0) {
    return FilterScopeLevel.Report;
  }
  if (
    Array.isArray(filter.chartsInScope) &&
    filter.chartsInScope.length < excluded.length
  ) {
    return FilterScopeLevel.Visual;
  }
  return FilterScopeLevel.Report;
}

export type FilterBarSections<T> = {
  report: T[];
  page: T[];
  visual: T[];
  /** filters not listed in the bar for the active tab */
  hidden: T[];
};

const isDivider = (filter: Pick<Filter | Divider, 'type'>) =>
  filter.type === NativeFilterType.Divider;

/**
 * Splits the ordered filter list into filter bar sections. Report filters
 * are always listed; page and visual filters only while in scope of the
 * active tab. Dividers follow the section of the next filter (or the
 * previous one when trailing) so they keep grouping the filters they were
 * placed with. Filters whose id is in `hiddenIds` are never listed.
 */
export function groupFiltersBySection<T extends Filter | Divider>(
  filters: T[],
  isInScope: (filter: T) => boolean,
  hiddenIds: Set<string> = new Set(),
): FilterBarSections<T> {
  const sections: FilterBarSections<T> = {
    report: [],
    page: [],
    visual: [],
    hidden: [],
  };

  const levelOf = (filter: T): FilterScopeLevel | null =>
    isDivider(filter) ? null : getFilterScopeLevel(filter as Filter);

  filters.forEach((filter, index) => {
    if (hiddenIds.has(filter.id)) {
      sections.hidden.push(filter);
      return;
    }
    let level = levelOf(filter);
    let anchor: T | undefined = filter;
    if (level === null) {
      anchor =
        filters.slice(index + 1).find(f => !isDivider(f)) ??
        filters
          .slice(0, index)
          .reverse()
          .find(f => !isDivider(f));
      level = anchor
        ? (levelOf(anchor) as FilterScopeLevel)
        : FilterScopeLevel.Report;
    }

    if (level === FilterScopeLevel.Report) {
      sections.report.push(filter);
    } else if (anchor && !isInScope(anchor)) {
      sections.hidden.push(filter);
    } else if (level === FilterScopeLevel.Page) {
      sections.page.push(filter);
    } else {
      sections.visual.push(filter);
    }
  });

  return sections;
}

/**
 * Ids of native filters placed on the dashboard canvas that should not be
 * listed in the filter bar as well.
 */
export function useCanvasOnlyFilterIds(): Set<string> {
  const layout = useSelector<RootState, Record<string, LayoutItem>>(
    state => state.dashboardLayout.present,
  );
  return useMemo(() => {
    const ids = new Set<string>();
    Object.values(layout || {}).forEach(item => {
      if (
        item?.type !== DYNAMIC_TYPE ||
        item.meta?.componentKey !== elementKey('filter')
      ) {
        return;
      }
      const config = item.meta[ELEMENT_KEY] as FilterElement | undefined;
      if (config?.filterId && config.showInFilterBar === false) {
        ids.add(config.filterId);
      }
    });
    return ids;
  }, [layout]);
}

/**
 * Hook that groups filters into filter bar sections for the active tab.
 */
export function useFilterBarSections<T extends Filter | Divider>(
  filters: T[],
): FilterBarSections<T> {
  const dashboardHasTabs = useDashboardHasTabs();
  const isFilterInScope = useIsFilterInScope();
  const canvasOnlyIds = useCanvasOnlyFilterIds();

  return useMemo(
    () =>
      groupFiltersBySection(
        filters,
        filter =>
          !dashboardHasTabs || !!isFilterInScope(filter as Filter | Divider),
        canvasOnlyIds,
      ),
    [filters, dashboardHasTabs, isFilterInScope, canvasOnlyIds],
  );
}
