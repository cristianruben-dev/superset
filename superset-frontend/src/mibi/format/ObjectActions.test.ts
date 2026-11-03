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

import { placeActions } from './ObjectActions';

const area = { top: 100, left: 0, right: 800, bottom: 700 };
const bar = { width: 200, height: 40 };

test('the buttons sit above the right end of the object', () => {
  const object = { top: 300, left: 100, right: 500, bottom: 500 };
  expect(placeActions(object, area, bar)).toEqual({ x: 300, y: 256 });
});

test('with no room above, they go inside the object', () => {
  const object = { top: 110, left: 100, right: 500, bottom: 500 };
  expect(placeActions(object, area, bar)).toEqual({ x: 300, y: 114 });
});

test('an object cut by the scroll area keeps its buttons in view', () => {
  const object = { top: 50, left: 600, right: 1200, bottom: 500 };
  expect(placeActions(object, area, bar)).toEqual({ x: 596, y: 104 });
  const narrow = { top: 300, left: 0, right: 80, bottom: 400 };
  expect(placeActions(narrow, area, bar)?.x).toBe(4);
});

test('an object out of view has no buttons', () => {
  const object = { top: 800, left: 100, right: 500, bottom: 900 };
  expect(placeActions(object, area, bar)).toBeNull();
});
