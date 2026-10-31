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
import { Fragment } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { FilterScopeLevel, type Filter } from '@superset-ui/core';
import { Checkbox } from '@superset-ui/core/components';
import { deleteComponent } from 'src/dashboard/actions/dashboardLayout';
import { setFilterConfiguration } from 'src/dashboard/actions/nativeFilters';
import type {
  DashboardLayout,
  GetState,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import { DYNAMIC_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  ELEMENT_KEY,
  elementKind,
  type FilterElement,
} from 'src/mibi/elements/types';
import { updateLayout } from 'src/mibi/format/actions';
import { placeComponent } from 'src/mibi/format/clipboard';
import { Section } from 'src/mibi/format/controls';
import { HIDDEN_KEY, LOCKED_KEY } from 'src/mibi/format/types';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';

/**
 * "Sync slicers", as in Power BI, for a filter placed on the canvas: on which
 * pages it filters the charts (the scope of the native filter, saved right
 * away like any filter setting) and on which pages the slicer shows (a copy of
 * the element on that page, saved with the dashboard). Copies share their
 * value because they show the same filter.
 */

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

const Grid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    font-size: ${theme.fontSizeSM}px;

    .head {
      color: ${theme.colorTextTertiary};
      font-weight: 600;
      text-align: center;
    }

    .page {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cell {
      display: flex;
      justify-content: center;
    }
  `}
`;

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

/** Pages whose charts the filter reaches. */
function scopedPages(filter: Filter, pageIds: string[]): Set<string> {
  const rootPath = filter.scope?.rootPath ?? [DASHBOARD_ROOT_ID];
  if (rootPath.includes(DASHBOARD_ROOT_ID)) return new Set(pageIds);
  return new Set(pageIds.filter(id => rootPath.includes(id)));
}

/** Canvas slicers of ``filterId`` on each page. */
function slicersByPage(
  layout: DashboardLayout,
  filterId: string,
): Record<string, LayoutItem[]> {
  const byPage: Record<string, LayoutItem[]> = {};
  const pageIds = new Set(topLevelTabs(layout).map(tab => tab.id));
  Object.values(layout).forEach(item => {
    if (
      item.type !== DYNAMIC_TYPE ||
      elementKind(item.meta.componentKey) !== 'filter' ||
      (item.meta[ELEMENT_KEY] as FilterElement | undefined)?.filterId !==
        filterId
    ) {
      return;
    }
    const page = item.parents?.find(id => pageIds.has(id));
    if (page) (byPage[page] ??= []).push(item);
  });
  return byPage;
}

/** Makes the filter reach the charts of these pages (at least one). */
const setFilterPages =
  (filter: Filter, pages: string[]) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const all = topLevelTabs(getState().dashboardLayout.present).map(
      tab => tab.id,
    );
    const everyPage = all.every(id => pages.includes(id));
    const modified: Filter = {
      ...filter,
      scope: {
        rootPath: everyPage ? [DASHBOARD_ROOT_ID] : pages,
        excluded: filter.scope?.excluded ?? [],
      },
      scopeLevel: everyPage ? FilterScopeLevel.Report : FilterScopeLevel.Page,
    };
    return dispatch(
      setFilterConfiguration({
        modified: [modified],
        deleted: [],
        reordered: [],
      }) as never,
    );
  };

/** Shows a copy of the slicer ``sourceId`` on ``pageId``, or removes it. */
const setSlicerOnPage =
  (sourceId: string, filterId: string, pageId: string, visible: boolean) =>
  (dispatch: AppDispatch, getState: GetState) => {
    const layout = getState().dashboardLayout.present;
    const existing = slicersByPage(layout, filterId)[pageId] ?? [];
    if (!visible) {
      existing
        .filter(item => item.id !== sourceId)
        .forEach(item =>
          dispatch(
            deleteComponent(
              item.id,
              item.parents?.[item.parents.length - 1] ?? null,
            ) as never,
          ),
        );
      return;
    }
    if (existing.length) return;
    const meta = { ...layout[sourceId].meta };
    delete meta[HIDDEN_KEY];
    delete meta[LOCKED_KEY];
    const component = newComponentFactory(
      DYNAMIC_TYPE,
      meta,
    ) as unknown as LayoutItem;
    dispatch(
      updateLayout(
        placeComponent(layout, component, null, [pageId]),
        `sync-slicer:${component.id}`,
      ),
    );
  };

/** Sync slicers section of a canvas filter in the Format pane. */
export function SyncSlicers({
  elementId,
  filterId,
}: {
  elementId: string;
  filterId?: string;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const filter = useSelector((state: RootState) =>
    filterId ? (state.nativeFilters.filters[filterId] as Filter) : undefined,
  );
  const pages = topLevelTabs(layout);
  if (!filter || pages.length < 2) return null;

  const pageIds = pages.map(tab => tab.id);
  const scoped = scopedPages(filter, pageIds);
  const shown = slicersByPage(layout, filter.id);
  const ownPage = layout[elementId]?.parents?.find(id => pageIds.includes(id));

  const toggleScope = (pageId: string, on: boolean) => {
    const next = pageIds.filter(id => (id === pageId ? on : scoped.has(id)));
    if (next.length) dispatch(setFilterPages(filter, next));
  };

  return (
    <Section data-test="mibi-sync-slicers">
      <h4>{t('Sync slicers')}</h4>
      <Grid>
        <span />
        <span className="head">{t('Filters')}</span>
        <span className="head">{t('Visible')}</span>
        {pages.map(page => (
          <Fragment key={page.id}>
            <span className="page" title={page.title}>
              {page.title || t('Untitled')}
            </span>
            <span className="cell">
              <Checkbox
                checked={scoped.has(page.id)}
                disabled={scoped.has(page.id) && scoped.size === 1}
                aria-label={t('Filters the charts of %s', page.title)}
                onChange={event => toggleScope(page.id, event.target.checked)}
              />
            </span>
            <span className="cell">
              <Checkbox
                checked={!!shown[page.id]?.length}
                disabled={page.id === ownPage}
                aria-label={t('Shows the slicer on %s', page.title)}
                onChange={event =>
                  dispatch(
                    setSlicerOnPage(
                      elementId,
                      filter.id,
                      page.id,
                      event.target.checked,
                    ),
                  )
                }
              />
            </span>
          </Fragment>
        ))}
      </Grid>
      <Hint>
        {t(
          'Slicers of the same filter keep the same selection on every page. Which pages it filters is saved right away; copies on other pages are saved with the dashboard.',
        )}
      </Hint>
    </Section>
  );
}
