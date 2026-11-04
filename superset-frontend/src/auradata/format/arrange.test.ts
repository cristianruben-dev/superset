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

import type { GetState, LayoutItem } from 'src/dashboard/types';
import { alignObjects, distributeObjects, matchSize } from './arrange';

const object = (
  id: string,
  x: number,
  y: number,
  meta: Record<string, unknown> = {},
) =>
  ({
    id,
    type: 'CHART',
    children: [],
    meta: { width: 4, height: 4, mibiPos: { x, y }, ...meta },
  }) as unknown as LayoutItem;

const stateOf = (items: LayoutItem[]) =>
  (() => ({
    dashboardLayout: {
      present: Object.fromEntries(items.map(item => [item.id, item])),
    },
  })) as unknown as GetState;

test('aligning says how many objects changed', () => {
  const dispatch = jest.fn();
  const result = alignObjects(['A', 'B'], 'left')(
    dispatch,
    stateOf([object('A', 0, 0), object('B', 8, 0)]),
  );
  expect(result).toEqual({ changed: 1, locked: 0 });
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test('objects already in line change nothing and dispatch nothing', () => {
  const dispatch = jest.fn();
  const result = alignObjects(['A', 'B'], 'left')(
    dispatch,
    stateOf([object('A', 2, 0), object('B', 2, 8)]),
  );
  expect(result).toEqual({ changed: 0, locked: 0 });
  expect(dispatch).not.toHaveBeenCalled();
});

test('a locked object stays and is counted apart', () => {
  const dispatch = jest.fn();
  const result = alignObjects(['A', 'B'], 'left')(
    dispatch,
    stateOf([object('A', 0, 0), object('B', 8, 0, { mibiLocked: true })]),
  );
  expect(result).toEqual({ changed: 0, locked: 1 });
  expect(dispatch).not.toHaveBeenCalled();
});

test('distributing needs three objects and moves the ones between', () => {
  const dispatch = jest.fn();
  const items = [object('A', 0, 0), object('B', 5, 0), object('C', 20, 0)];
  expect(
    distributeObjects(['A', 'B'], 'horizontal')(dispatch, stateOf(items)),
  ).toEqual({ changed: 0, locked: 0 });
  expect(
    distributeObjects(['A', 'B', 'C'], 'horizontal')(dispatch, stateOf(items)),
  ).toEqual({ changed: 1, locked: 0 });
});

test('matching a size counts only the objects of another size', () => {
  const dispatch = jest.fn();
  const result = matchSize(
    ['A', 'B', 'C'],
    'A',
    'height',
  )(
    dispatch,
    stateOf([
      object('A', 0, 0),
      object('B', 4, 0),
      object('C', 8, 0, { height: 9 }),
    ]),
  );
  expect(result).toEqual({ changed: 1, locked: 0 });
});
