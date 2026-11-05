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
import type { DataMaskStateWithId } from '@superset-ui/core';
import type { RootState } from 'src/dashboard/types';
import type { AssistantContext } from './types';

/** The server refuses more than 8000 characters. */
export const MAX_CONTEXT_CHARS = 7000;
const MAX_PAGE_CHARS = 250;
const MAX_VALUES = 20;
const MAX_VALUE_CHARS = 200;

const shortValue = (value: unknown): unknown =>
  typeof value === 'string' ? value.slice(0, MAX_VALUE_CHARS) : value;

const shortValues = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.slice(0, MAX_VALUES).map(shortValue)
    : shortValue(value);

const isSet = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0);

type ContextState = Pick<RootState, 'dashboardLayout' | 'nativeFilters'> & {
  dashboardState: Pick<RootState['dashboardState'], 'activeTabs'>;
  dataMask: DataMaskStateWithId;
};

/** The name of the page on screen: the deepest tab open, when there are tabs. */
function pageOf({ dashboardLayout, dashboardState }: ContextState) {
  const open = (dashboardState.activeTabs ?? []).filter(
    id => dashboardLayout.present[id]?.meta?.text,
  );
  const last = open[open.length - 1];
  const text = last && dashboardLayout.present[last].meta.text;
  return text ? String(text).slice(0, MAX_PAGE_CHARS) : undefined;
}

/** The filters with a value, and what cross-filters and drills apply. */
function filtersOf({ nativeFilters, dataMask }: ContextState) {
  const filters: Record<string, unknown> = {};
  const native = nativeFilters?.filters ?? {};
  Object.entries(native).forEach(([id, filter]) => {
    const value = dataMask[id]?.filterState?.value;
    if (!isSet(value) || !('targets' in filter) || !filter.name) return;
    const target = filter.targets?.[0];
    filters[filter.name] = {
      column: target?.column?.name,
      dataset_id: target?.datasetId,
      value: shortValues(value),
    };
  });
  const others = Object.entries(dataMask).flatMap(([id, mask]) =>
    id in native ? [] : (mask.extraFormData?.filters ?? []),
  );
  if (others.length) {
    filters.cross_filters = others.slice(0, MAX_VALUES).map(filter => ({
      ...filter,
      val: shortValues('val' in filter ? filter.val : undefined),
    }));
  }
  return filters;
}

/**
 * Where the user is, for the assistant: a page name, and what the filters select,
 * with what the model needs to query it. It stays under what the server accepts:
 * the filters that do not fit are left out, and the context says how many.
 */
export function pageContext(
  state: ContextState,
  dashboardId: number,
): AssistantContext {
  const page = pageOf(state);
  const context: AssistantContext = {
    dashboard_id: dashboardId,
    ...(page && { page }),
  };
  const kept: Record<string, unknown> = {};
  const entries = Object.entries(filtersOf(state));
  let omitted = 0;
  entries.forEach(([name, value]) => {
    const next = { ...kept, [name]: value };
    if (
      JSON.stringify({ ...context, filters: next }).length > MAX_CONTEXT_CHARS
    ) {
      omitted += 1;
    } else {
      kept[name] = value;
    }
  });
  if (omitted) kept.omitted_filters = omitted;
  return entries.length ? { ...context, filters: kept } : context;
}
