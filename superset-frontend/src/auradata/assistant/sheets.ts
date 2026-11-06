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

/** A piece of a page that should not fall across two sheets. */
export interface SheetUnit {
  top: number;
  height: number;
}

/**
 * What each piece has to move down so that none falls across two sheets, by its index,
 * with `margin` kept free at the top and bottom of a sheet. A piece that moves takes all
 * that follow with it, and one taller than a sheet stays where it is: it can only be cut.
 */
export function sheetPushes(
  units: SheetUnit[],
  sheetHeight: number,
  margin = 0,
): Map<number, number> {
  const pushes = new Map<number, number>();
  let moved = 0;
  units.forEach(({ top, height }, index) => {
    const start = top + moved;
    const nextSheet = (Math.floor(start / sheetHeight) + 1) * sheetHeight;
    if (
      start + height > nextSheet - margin &&
      height <= sheetHeight - 2 * margin
    ) {
      const push = nextSheet + margin - start;
      pushes.set(index, push);
      moved += push;
    }
  });
  return pushes;
}

const UNITS =
  '[data-sheet-unit], [data-sheet-text] :is(p, li, h1, h2, h3, h4, pre, blockquote, table)';

/** Lays a page out on sheets: the pieces that would be cut move to the next one. */
export function layOutSheets(
  page: HTMLElement,
  sheetHeight: number,
  margin = 0,
) {
  const origin = page.getBoundingClientRect().top;
  const elements = Array.from(page.querySelectorAll<HTMLElement>(UNITS));
  const pushes = sheetPushes(
    elements.map(element => {
      const { top, height } = element.getBoundingClientRect();
      return { top: top - origin, height };
    }),
    sheetHeight,
    margin,
  );
  pushes.forEach((push, index) => {
    const element = elements[index];
    const margin = parseFloat(getComputedStyle(element).marginTop) || 0;
    element.style.marginTop = `${margin + push}px`;
  });
}
