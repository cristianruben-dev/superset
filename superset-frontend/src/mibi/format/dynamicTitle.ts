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
import type { RootState } from 'src/dashboard/types';

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

interface Selection {
  name: string;
  label: string;
}

const labelOf = (state: unknown): string => {
  const filterState = (state as { filterState?: Record<string, unknown> })
    ?.filterState;
  if (!filterState) return '';
  if (typeof filterState.label === 'string' && filterState.label)
    return filterState.label;
  const value = filterState.value;
  if (Array.isArray(value)) return value.map(String).join(', ');
  return value === undefined || value === null ? '' : String(value);
};

/**
 * Fills the tokens of a dynamic title:
 * `{value}` the first number the chart shows, `{filters}` every selection
 * made on the page, `{filter:Name}` the selection of one filter, `{chart}`
 * the plain name of the chart.
 */
export function resolveTitle(
  template: string,
  chartName: string,
  firstNumber: number | undefined,
  selections: Selection[],
  empty: string,
): string {
  return template.replace(/\{([^{}]+)\}/g, (token, raw: string) => {
    const key = raw.trim();
    if (key === 'chart') return chartName;
    if (key === 'value')
      return firstNumber === undefined ? '' : numberFormat.format(firstNumber);
    if (key === 'filters') {
      const used = selections.filter(item => item.label);
      return used.length ? used.map(item => item.label).join(' · ') : empty;
    }
    if (key.startsWith('filter:')) {
      const name = key.slice('filter:'.length).trim().toLowerCase();
      const found = selections.find(item => item.name.toLowerCase() === name);
      return found?.label || empty;
    }
    return token;
  });
}

/** The title a chart shows: its name, or its dynamic title when it has one. */
export function useDynamicTitle(
  template: string | undefined,
  chartName: string,
  chartId: number,
  empty: string,
): string {
  const rows = useSelector(
    (state: RootState) =>
      (
        state.charts?.[chartId]?.queriesResponse?.[0] as
          | { data?: Record<string, unknown>[] }
          | undefined
      )?.data,
  );
  const filters = useSelector(
    (state: RootState) => state.nativeFilters?.filters,
  );
  const dataMask = useSelector((state: RootState) => state.dataMask);
  return useMemo(() => {
    if (!template) return chartName;
    const first = rows?.[0];
    const number = first
      ? Object.values(first).find(value => typeof value === 'number')
      : undefined;
    const selections: Selection[] = Object.values(filters ?? {})
      .filter(filter => filter && 'name' in filter)
      .map(filter => ({
        name: String((filter as { name?: string }).name ?? ''),
        label: labelOf(dataMask?.[(filter as { id: string }).id]),
      }));
    return resolveTitle(
      template,
      chartName,
      number as number | undefined,
      selections,
      empty,
    );
  }, [template, chartName, rows, filters, dataMask, empty]);
}
