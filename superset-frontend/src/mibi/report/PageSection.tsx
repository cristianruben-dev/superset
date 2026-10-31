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
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Select, Switch } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { setComponentMeta } from 'src/mibi/format/actions';
import { Field, Section } from 'src/mibi/format/controls';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';
import { DRILLTHROUGH_PAGE_KEY, type DrillthroughPage } from './types';

const Hint = styled.p`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

/** Columns of the datasets the dashboard's charts use, sorted by name. */
function useDashboardColumns(): string[] {
  const datasources = useSelector((state: RootState) => state.datasources);
  return useMemo(() => {
    const names = new Set<string>();
    Object.values(datasources ?? {}).forEach(datasource =>
      (datasource.columns ?? []).forEach(column =>
        names.add(column.column_name),
      ),
    );
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [datasources]);
}

/**
 * Settings of the page being edited: whether other pages can "drill through"
 * to it, and on which columns.
 */
export function PageSection() {
  const dispatch = useDispatch();
  const layout = useSelector(
    (state: RootState) => state.dashboardLayout.present,
  );
  const activeTabs = useSelector(
    (state: RootState) => state.dashboardState.activeTabs,
  );
  const columns = useDashboardColumns();
  const page = topLevelTabs(layout).find(tab => activeTabs?.includes(tab.id));
  if (!page) return null;

  const drillthrough = layout[page.id]?.meta?.[DRILLTHROUGH_PAGE_KEY] as
    | DrillthroughPage
    | undefined;
  const save = (next: DrillthroughPage | undefined) =>
    dispatch(setComponentMeta(page.id, DRILLTHROUGH_PAGE_KEY, next) as never);

  return (
    <Section data-test="mibi-format-page">
      <h4>{t('Page: %s', page.title || t('Untitled'))}</h4>
      <Field label={t('Drill through to this page')}>
        <Switch
          size="small"
          checked={!!drillthrough}
          aria-label={t('Drill through to this page')}
          data-test="mibi-drillthrough-toggle"
          onChange={on => save(on ? { columns: [] } : undefined)}
        />
      </Field>
      {drillthrough && (
        <>
          <Select
            mode="multiple"
            ariaLabel={t('Drill through columns')}
            placeholder={t('Choose the columns')}
            value={drillthrough.columns}
            data-test="mibi-drillthrough-columns"
            onChange={value =>
              save({ columns: (value as string[]).map(String) })
            }
            options={columns.map(column => ({
              value: column,
              label: column,
            }))}
          />
          <Hint>
            {t(
              'On another page, right-click a data point and choose "Drill through" to open this page filtered to it.',
            )}
          </Hint>
        </>
      )}
    </Section>
  );
}
