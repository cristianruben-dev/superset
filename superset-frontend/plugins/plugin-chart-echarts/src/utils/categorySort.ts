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
import {
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  type QueryFormColumn,
  type QueryFormData,
  type QueryFormMetric,
  type QueryFormOrderBy,
} from '@superset-ui/core';

/**
 * Sort of the categories of a pie or a funnel: by the metric or by one of the
 * dimensions, ascending or descending (`mibi_sort_by`, `mibi_sort_asc`).
 * Without `mibi_sort_by`, the "Sort by metric" setting applies as before.
 */

/** Labels the categories can be sorted by: the metric, then the dimensions. */
export function categorySortChoices(
  metric?: QueryFormMetric | null,
  groupby?: QueryFormColumn[] | null,
): string[] {
  return [
    ...(metric ? [getMetricLabel(metric)] : []),
    ...ensureIsArray(groupby).map(getColumnLabel),
  ];
}

/** The query order of a pie or a funnel. */
export function categoryOrderby(
  formData: QueryFormData,
): QueryFormOrderBy[] | undefined {
  const { metric, groupby, sort_by_metric, mibi_sort_by, mibi_sort_asc } =
    formData;
  if (mibi_sort_by) {
    const ascending = !!mibi_sort_asc;
    if (metric && mibi_sort_by === getMetricLabel(metric)) {
      return [[metric, ascending]];
    }
    const column = ensureIsArray(groupby as QueryFormColumn[]).find(
      col => getColumnLabel(col) === mibi_sort_by,
    );
    if (column !== undefined) return [[column, ascending]];
  }
  return sort_by_metric && metric ? [[metric, false]] : undefined;
}

/**
 * How ECharts orders a funnel's steps: by value when sorted by the metric,
 * in query order when sorted by a dimension, descending otherwise.
 */
export function funnelSort(
  formData: Pick<QueryFormData, 'metric'> & {
    mibiSortBy?: string | null;
    mibiSortAsc?: boolean;
  },
  fallback: 'descending' | 'ascending' | 'none' | undefined,
): 'descending' | 'ascending' | 'none' | undefined {
  const { metric, mibiSortBy, mibiSortAsc } = formData;
  if (!mibiSortBy) return fallback;
  if (metric && mibiSortBy === getMetricLabel(metric)) {
    return mibiSortAsc ? 'ascending' : 'descending';
  }
  return 'none';
}
