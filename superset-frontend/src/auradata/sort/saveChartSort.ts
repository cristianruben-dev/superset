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
import { SupersetClient, type QueryFormData } from '@superset-ui/core';
import { buildV1ChartDataPayload } from 'src/explore/exploreUtils';

/**
 * The sort of a visual is saved in its chart, the one place every viewer and
 * the chart editor read it from (a chart belongs to a single dashboard). The
 * change is written right away, as the chart editor does, so the dashboard's
 * own undo does not reach it: the sort menu offers its own undo instead.
 */

type FormDataChanges = Partial<QueryFormData>;

/** Previous values of the last sort saved on each chart, for "Undo". */
const lastChanges = new Map<number, FormDataChanges>();

/** Applies changes to form data; an undefined value removes the setting. */
export function applyChanges(
  formData: QueryFormData,
  changes: FormDataChanges,
): QueryFormData {
  const next = { ...formData, ...changes };
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined) delete next[key];
  });
  return next;
}

/**
 * Writes some settings into a chart's saved form data and rebuilds its query
 * context, as saving from the chart editor does, so reports, alerts and the
 * API keep running the same query. Returns the values it replaced.
 */
export async function saveChartParams(
  chartId: number,
  changes: FormDataChanges,
): Promise<FormDataChanges> {
  const endpoint = `/api/v1/chart/${chartId}`;
  const { json } = await SupersetClient.get({ endpoint });
  const saved = JSON.parse(json?.result?.params || '{}') as QueryFormData;
  const previous = Object.fromEntries(
    Object.keys(changes).map(key => [key, saved[key]]),
  ) as FormDataChanges;
  const formData = applyChanges(saved, changes);
  const queryContext = await buildV1ChartDataPayload({
    formData,
    force: false,
    resultFormat: 'json',
    resultType: 'full',
    setDataMask: undefined,
    ownState: undefined,
  });
  await SupersetClient.put({
    endpoint,
    jsonPayload: {
      params: JSON.stringify(formData),
      query_context: JSON.stringify(queryContext),
    },
  });
  return previous;
}

/** Saves a visual's sort and remembers what it replaced. */
export async function saveChartSort(
  chartId: number,
  changes: FormDataChanges,
): Promise<void> {
  const previous = await saveChartParams(chartId, changes);
  lastChanges.set(chartId, previous);
}

/** Whether the last sort saved on a chart in this visit can be undone. */
export const canUndoChartSort = (chartId: number) => lastChanges.has(chartId);

/** Restores the sort a chart had before the last one saved. */
export async function undoChartSort(chartId: number): Promise<void> {
  const previous = lastChanges.get(chartId);
  if (!previous) return;
  await saveChartParams(chartId, previous);
  lastChanges.delete(chartId);
}
