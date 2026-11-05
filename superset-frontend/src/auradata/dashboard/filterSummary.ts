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
import { t } from '@apache-superset/core/translation';

/**
 * The line under the name of a filter in the filter pane, as in Power BI:
 * "is (All)" without a selection, "is North, South" with one.
 */
export function filterSummary(
  filterState: { value?: unknown; label?: unknown } | undefined,
): string {
  const value = filterState?.value;
  const empty =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.every(item => item === null));
  if (empty) return t('is (All)');
  const label = filterState?.label;
  if (typeof label === 'string' && label.trim()) return t('is %s', label);
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] !== 'string') {
      const [from, to] = value;
      if (from === null || from === undefined) return t('is at most %s', to);
      if (to === null || to === undefined) return t('is at least %s', from);
      return t('is between %s and %s', from, to);
    }
    return t('is %s', value.map(String).join(', '));
  }
  return t('is %s', String(value));
}

const OPEN_KEY = 'auradata:filter-card-open';

function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(window.localStorage.getItem(OPEN_KEY) || '{}');
  } catch {
    return {};
  }
}

/** Whether the card of a filter was left open in this browser. */
export const isFilterCardOpen = (filterId: string) =>
  readOpen()[filterId] ?? false;

export function setFilterCardOpen(filterId: string, open: boolean) {
  try {
    window.localStorage.setItem(
      OPEN_KEY,
      JSON.stringify({ ...readOpen(), [filterId]: open }),
    );
  } catch {
    // A browser without storage opens every card closed next time
  }
}
