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
/**
 * Grid density: how many columns a dashboard's layout has. Upstream Superset
 * always uses GRID_COLUMN_COUNT (12); Mi BI lets a dashboard use 24 or 48 so
 * objects can be smaller. Widths in the layout are in the dashboard's own
 * columns, and the count is kept on the root component (COLUMN_COUNT_KEY).
 *
 * Code that runs outside React (reducers, factories) reads the count of the
 * dashboard being edited with gridColumnCount(); the layout reducer keeps it
 * in sync on every change, undo and redo included.
 */
import {
  DASHBOARD_ROOT_ID,
  GRID_COLUMN_COUNT,
} from 'src/dashboard/util/constants';

export const COLUMN_COUNT_KEY = 'mibiColumns';
export const COLUMN_COUNTS = [12, 24, 48] as const;
export type ColumnCount = (typeof COLUMN_COUNTS)[number];

type LayoutLike = Record<
  string,
  { meta?: Record<string, unknown> } | undefined
>;

const isColumnCount = (value: unknown): value is ColumnCount =>
  COLUMN_COUNTS.includes(value as ColumnCount);

/** The column count of a layout: 12 unless its root says otherwise. */
export function columnCountOf(
  layout: LayoutLike | null | undefined,
): ColumnCount {
  const value = layout?.[DASHBOARD_ROOT_ID]?.meta?.[COLUMN_COUNT_KEY];
  return isColumnCount(value) ? value : GRID_COLUMN_COUNT;
}

let current: ColumnCount = GRID_COLUMN_COUNT;

/** The column count of the dashboard being shown or edited. */
export const gridColumnCount = (): ColumnCount => current;

/** Follows the layout of the dashboard being shown or edited. */
export function syncGridColumnCount(layout: LayoutLike | null | undefined) {
  current = columnCountOf(layout);
}

/**
 * A width given in 12-column units (Superset's defaults) in ``count``
 * columns, so a default chart takes the same share of every grid.
 */
export const scaledWidth = (width: number, count: number = current) =>
  Math.max(1, Math.round((width * count) / GRID_COLUMN_COUNT));

/**
 * The narrowest an object can be, in columns: about 48 px on a 1280 px
 * canvas. Denser grids have thinner columns than the fixed gap between
 * objects, so one column alone would be almost nothing.
 */
export const minObjectColumns = (count: number = current) =>
  Math.max(1, Math.round(count / 16));
