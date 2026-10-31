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
import { Filter, FilterScopeLevel, NativeFilterType } from '@superset-ui/core';
import { NativeFiltersFormItem } from '../types';
import { transformFilterForSave } from './filterTransformer';

const formItem = (overrides: Partial<NativeFiltersFormItem> = {}) =>
  ({
    type: NativeFilterType.NativeFilter,
    name: 'Region',
    filterType: 'filter_select',
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    controlValues: {},
    requiredFirst: {},
    defaultValue: null,
    defaultDataMask: { filterState: {}, extraFormData: {} },
    description: '',
    dataset: { value: 1, label: 'sales' },
    column: 'region',
    ...overrides,
  }) as unknown as NativeFiltersFormItem;

test('persists an explicit filter bar section', () => {
  const result = transformFilterForSave(
    'NATIVE_FILTER-level',
    formItem({ scopeLevel: FilterScopeLevel.Report }),
  ) as Filter;
  expect(result.scopeLevel).toBe(FilterScopeLevel.Report);
});

test('omits the filter bar section when it is derived automatically', () => {
  const result = transformFilterForSave(
    'NATIVE_FILTER-auto',
    formItem({ scopeLevel: 'auto' }),
  ) as Filter;
  expect(result).not.toHaveProperty('scopeLevel');
});

test('never stores an automatic section for forms without a dataset control', () => {
  const {
    dataset: _dataset,
    column: _column,
    ...timeFilter
  } = formItem({
    filterType: 'filter_time',
    scopeLevel: 'auto',
  }) as NativeFiltersFormItem & { dataset?: unknown; column?: unknown };
  const result = transformFilterForSave(
    'NATIVE_FILTER-time',
    timeFilter as unknown as NativeFiltersFormItem,
  ) as Filter;
  expect(result).not.toHaveProperty('scopeLevel');
});
