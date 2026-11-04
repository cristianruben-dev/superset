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
import { DataMask } from '@superset-ui/core';
import { isCanvasSelectionChange } from './CanvasFilterControl';

const usMask: DataMask = {
  filterState: { value: ['US'] },
  extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['US'] }] },
};

test('a plugin echoing the applied value is not a change', () => {
  const echo: DataMask = {
    filterState: { value: ['US'], validateStatus: undefined },
    extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['US'] }] },
  };
  expect(isCanvasSelectionChange(usMask, echo)).toBe(false);
});

test('an empty filter reporting empty extra form data is not a change', () => {
  expect(
    isCanvasSelectionChange(
      { filterState: {} },
      { filterState: { value: undefined }, extraFormData: {} },
    ),
  ).toBe(false);
});

test('a new value is a change', () => {
  const france: DataMask = {
    filterState: { value: ['FR'] },
    extraFormData: { filters: [{ col: 'country', op: 'IN', val: ['FR'] }] },
  };
  expect(isCanvasSelectionChange(usMask, france)).toBe(true);
});

test('clearing a value is a change', () => {
  expect(
    isCanvasSelectionChange(usMask, {
      filterState: { value: null },
      extraFormData: {},
    }),
  ).toBe(true);
});
