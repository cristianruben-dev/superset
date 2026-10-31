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
import type { DataRecordValue } from '@superset-ui/core';

/** The drill through data mask: its id, state and the charts it reaches. */

/** Non-numeric, so it never matches a chart's cross-filter. */
export const DRILLTHROUGH_ID = 'mibi-drillthrough';
export const DRILLTHROUGH_STATE_KEY = 'mibiDrillthrough';

export interface DrillthroughField {
  column: string;
  value: DataRecordValue;
  label: string;
}

export interface DrillthroughState {
  dashboardId: number;
  /** Page opened by the drill through */
  tabId: string;
  /** Page it came from, for "Back" */
  sourceTabId?: string;
  chartsInScope: number[];
  fields: DrillthroughField[];
}

/**
 * Charts reached by a data mask that is a drill through; undefined for any
 * other mask. Read where the dashboard works out which charts a filter hits.
 */
export function drillthroughChartsInScope(
  filterId: string,
  filterState: Record<string, unknown> | undefined,
): number[] | undefined {
  if (filterId !== DRILLTHROUGH_ID) return undefined;
  return (
    filterState?.[DRILLTHROUGH_STATE_KEY] as DrillthroughState | undefined
  )?.chartsInScope;
}
