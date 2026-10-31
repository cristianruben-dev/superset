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
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { QueryFormData } from '@superset-ui/core';
import type { Dataset } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';
import { css } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import type { RootState } from 'src/dashboard/types';
import { reloadSavedChart } from 'src/mibi/dashboard/reloadSavedChart';
import { sortAdapterFor } from './adapters';
import {
  canUndoChartSort,
  saveChartSort,
  undoChartSort,
} from './saveChartSort';
import type { VisualSort } from './types';

export const SORT_ASCENDING_KEY = 'mibi-sort-ascending';
export const SORT_DESCENDING_KEY = 'mibi-sort-descending';
export const SORT_UNDO_KEY = 'mibi-sort-undo';
const SORT_BY_PREFIX = 'mibi-sort-by:';

const checkIcon = (checked: boolean) => (
  <Icons.CheckOutlined
    iconSize="s"
    aria-hidden={!checked}
    css={css`
      visibility: ${checked ? 'visible' : 'hidden'};
    `}
  />
);

/** The chart definition the dashboard loaded, as saved on the server. */
const selectSavedFormData = (state: RootState, chartId: number) =>
  (state.sliceEntities.slices[chartId]?.form_data ??
    state.charts[chartId]?.form_data) as QueryFormData | undefined;

/**
 * The items of a visual's "Sort axis" menu, Power BI style: the direction,
 * then what the axis is sorted by, each with a check on the saved choice.
 * Choosing one saves it in the chart. Null when the visual cannot be sorted.
 */
export function useVisualSortMenuItems(chartId: number) {
  const dispatch = useDispatch();
  const { addSuccessToast, addDangerToast } = useToasts();
  const [saving, setSaving] = useState(false);
  const formData = useSelector((state: RootState) =>
    selectSavedFormData(state, chartId),
  );
  const datasource = useSelector((state: RootState) =>
    formData?.datasource ? state.datasources[formData.datasource] : undefined,
  ) as Dataset | undefined;

  const adapter = sortAdapterFor(formData?.viz_type);
  const options =
    formData && adapter ? adapter.options(formData, datasource) : null;
  const current = formData && adapter ? adapter.current(formData) : undefined;

  const run = useCallback(
    async (save: () => Promise<void>, done: string) => {
      setSaving(true);
      try {
        await save();
        await dispatch(reloadSavedChart(chartId) as never);
        addSuccessToast(done);
      } catch {
        addDangerToast(t("Couldn't save the sort"));
      } finally {
        setSaving(false);
      }
    },
    [addDangerToast, addSuccessToast, chartId, dispatch],
  );

  const onClick = useCallback(
    (key: string) => {
      if (!formData || !adapter || !options?.length) return;
      if (key === SORT_UNDO_KEY) {
        run(() => undoChartSort(chartId), t('Sort undone'));
        return;
      }
      const by = key.startsWith(SORT_BY_PREFIX)
        ? key.slice(SORT_BY_PREFIX.length)
        : (current?.by ?? options[0].value);
      const ascending =
        key === SORT_ASCENDING_KEY ||
        (key !== SORT_DESCENDING_KEY && (current?.ascending ?? true));
      const sort: VisualSort = { by, ascending };
      run(
        () => saveChartSort(chartId, adapter.toFormData(sort, formData)),
        t('Sort saved'),
      );
    },
    [adapter, chartId, current, formData, options, run],
  );

  if (!options?.length) {
    return { items: null, onClick, saving };
  }

  const items: MenuItem[] = [
    {
      key: SORT_DESCENDING_KEY,
      label: t('Sort descending'),
      icon: checkIcon(current?.ascending === false),
    },
    {
      key: SORT_ASCENDING_KEY,
      label: t('Sort ascending'),
      icon: checkIcon(current?.ascending === true),
    },
    { type: 'divider' },
    {
      type: 'group',
      key: 'mibi-sort-by',
      label: t('Sort by'),
      children: options.map(option => ({
        key: `${SORT_BY_PREFIX}${option.value}`,
        label: option.label,
        icon: checkIcon(current?.by === option.value),
      })),
    },
    ...(canUndoChartSort(chartId)
      ? ([
          { type: 'divider' },
          {
            key: SORT_UNDO_KEY,
            label: t('Undo'),
            icon: <Icons.Undo iconSize="s" />,
          },
        ] as MenuItem[])
      : []),
  ];

  return { items, onClick, saving };
}
