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
  type QueryFormMetric,
  type QueryFormOrderBy,
} from '@superset-ui/core';

/**
 * The sort an editor saves on a table from the dashboard (Mi BI "Sort axis",
 * `mibi_table_sort`): columns or metrics by label, in order. It sorts the
 * query, so it decides which rows the row limit keeps, and viewers can still
 * re-sort the rows they see by clicking a header.
 */
export interface TableSortItem {
  key: string;
  desc: boolean;
}

/** The query order of a saved table sort; empty when none of it applies. */
export function tableSortOrderby(
  sort: TableSortItem[] | null | undefined,
  metrics: QueryFormMetric[] | null | undefined,
  columns: QueryFormColumn[] | null | undefined,
): QueryFormOrderBy[] {
  return ensureIsArray(sort).flatMap(({ key, desc }) => {
    const metric = ensureIsArray(metrics).find(
      item => getMetricLabel(item) === key,
    );
    if (metric !== undefined) return [[metric, !desc] as QueryFormOrderBy];
    const column = ensureIsArray(columns).find(
      item => getColumnLabel(item) === key,
    );
    return column !== undefined ? [[column, !desc] as QueryFormOrderBy] : [];
  });
}
