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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import type { BinaryQueryObjectFilterClause } from '@superset-ui/core';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import { drillThrough, drillthroughPages, pointFields } from './drillthrough';

const EMPTY: MenuItem[] = [];

/**
 * "Drill through" entries for a chart's right-click menu: one per page set up
 * to receive it, enabled when the clicked point has one of its columns. None
 * outside a dashboard or while editing it.
 */
export function useDrillthroughMenuItems(
  clauses: BinaryQueryObjectFilterClause[] | undefined,
  onDone: () => void,
): MenuItem[] {
  const dispatch = useDispatch();
  const layout = useSelector<RootState, DashboardLayout | undefined>(
    state => state.dashboardLayout?.present,
  );
  const editMode = useSelector<RootState, boolean>(
    state => !!state.dashboardState?.editMode,
  );
  const activeTabs = useSelector<RootState, string[] | undefined>(
    state => state.dashboardState?.activeTabs,
  );
  if (!layout || editMode) return EMPTY;
  const pages = drillthroughPages(layout).filter(
    page => !activeTabs?.includes(page.tab.id),
  );
  if (!pages.length) return EMPTY;

  const point = pointFields(clauses);
  if (!point.length) {
    return [
      {
        key: 'mibi-drillthrough',
        label: t('Drill through'),
        disabled: true,
        title: t('Right-click a single data point to drill through'),
      },
    ];
  }
  return [
    {
      key: 'mibi-drillthrough',
      label: t('Drill through'),
      children: pages.map(({ tab, columns }) => ({
        key: `mibi-drillthrough-${tab.id}`,
        label: tab.title || t('Page'),
        disabled: !point.some(field => columns.includes(field.column)),
        onClick: () => {
          dispatch(drillThrough(tab.id, point) as never);
          onDone();
        },
      })),
    },
  ];
}
