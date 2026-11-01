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
 * The grid of the canvas: square cells of CELL pixels. The canvas size is a
 * whole number of cells, so the number of columns of a layout is its width in
 * cells, and every width and height in the layout is in cells too.
 *
 * Code that runs outside React (reducers, factories) reads the columns of the
 * dashboard being edited with gridColumnCount(); the layout reducer keeps it
 * in sync on every change, undo and redo included.
 */
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { canvasSize } from './styles';
import {
  CANVAS_FORMAT_KEY,
  CELL,
  DEFAULT_CANVAS_SIZE,
  CANVAS_PRESETS,
} from './types';

export { CELL };

/** Layout root meta key marking a layout whose sizes are in cells. */
export const CELLS_KEY = 'mibiCells';
/** Layout root meta key that held the column count before the cell grid. */
export const LEGACY_COLUMN_COUNT_KEY = 'mibiColumns';

type LayoutLike = Record<
  string,
  { meta?: Record<string, unknown> } | undefined
>;

const DEFAULT_COLUMNS = CANVAS_PRESETS[DEFAULT_CANVAS_SIZE][0] / CELL;

/** The columns of a layout: the width of its canvas, in cells. */
export function columnCountOf(layout: LayoutLike | null | undefined): number {
  const canvas = layout?.[DASHBOARD_ROOT_ID]?.meta?.[CANVAS_FORMAT_KEY];
  return Math.round(
    canvasSize(canvas as Parameters<typeof canvasSize>[0]).width / CELL,
  );
}

let current = DEFAULT_COLUMNS;

/** The columns of the dashboard being shown or edited. */
export const gridColumnCount = (): number => current;

/** Follows the layout of the dashboard being shown or edited. */
export function syncGridColumnCount(layout: LayoutLike | null | undefined) {
  current = columnCountOf(layout);
}

/** The narrowest an object can be, in cells. */
export const minObjectColumns = () => 2;

/** The shortest an object can be, in cells. */
export const MIN_OBJECT_ROWS = 2;

/** Default size of a new chart or element, in cells. */
export const DEFAULT_OBJECT_COLUMNS = 12;
export const DEFAULT_OBJECT_ROWS = 12;
