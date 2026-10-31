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
import {
  Divider,
  Filter,
  FilterScopeLevel,
  NativeFilterType,
} from '@superset-ui/core';
import { getFilterScopeLevel, groupFiltersBySection } from './scopeLevel';

const makeFilter = (id: string, overrides: Partial<Filter> = {}): Filter =>
  ({
    id,
    name: id,
    type: NativeFilterType.NativeFilter,
    filterType: 'filter_select',
    targets: [],
    controlValues: {},
    cascadeParentIds: [],
    defaultDataMask: {},
    description: '',
    scope: { rootPath: ['ROOT_ID'], excluded: [] },
    ...overrides,
  }) as Filter;

const makeDivider = (id: string): Divider => ({
  id,
  type: NativeFilterType.Divider,
  title: id,
  description: '',
});

test('a whole-dashboard scope is a report filter', () => {
  expect(getFilterScopeLevel(makeFilter('f'))).toBe(FilterScopeLevel.Report);
});

test('a scope rooted at tabs is a page filter', () => {
  expect(
    getFilterScopeLevel(
      makeFilter('f', { scope: { rootPath: ['TAB-1'], excluded: [] } }),
    ),
  ).toBe(FilterScopeLevel.Page);
});

test('a dashboard scope excluding most charts is a visual filter', () => {
  expect(
    getFilterScopeLevel(
      makeFilter('f', {
        scope: { rootPath: ['ROOT_ID'], excluded: [2, 3, 4] },
        chartsInScope: [1],
      }),
    ),
  ).toBe(FilterScopeLevel.Visual);
});

test('a dashboard scope excluding a few charts stays a report filter', () => {
  expect(
    getFilterScopeLevel(
      makeFilter('f', {
        scope: { rootPath: ['ROOT_ID'], excluded: [4] },
        chartsInScope: [1, 2, 3],
      }),
    ),
  ).toBe(FilterScopeLevel.Report);
});

test('an explicit scopeLevel wins over the scope', () => {
  expect(
    getFilterScopeLevel(
      makeFilter('f', {
        scope: { rootPath: ['TAB-1'], excluded: [] },
        scopeLevel: FilterScopeLevel.Report,
      }),
    ),
  ).toBe(FilterScopeLevel.Report);
});

test('groupFiltersBySection lists report filters always and others only in scope', () => {
  const report = makeFilter('report', {
    scope: { rootPath: ['TAB-2'], excluded: [] },
    scopeLevel: FilterScopeLevel.Report,
  });
  const pageActive = makeFilter('page-active', {
    scope: { rootPath: ['TAB-1'], excluded: [] },
  });
  const pageOther = makeFilter('page-other', {
    scope: { rootPath: ['TAB-2'], excluded: [] },
  });
  const visual = makeFilter('visual', { scopeLevel: FilterScopeLevel.Visual });
  const inScope = new Set(['page-active', 'visual']);

  const sections = groupFiltersBySection(
    [report, pageActive, pageOther, visual],
    filter => inScope.has(filter.id),
  );

  expect(sections.report.map(f => f.id)).toEqual(['report']);
  expect(sections.page.map(f => f.id)).toEqual(['page-active']);
  expect(sections.visual.map(f => f.id)).toEqual(['visual']);
  expect(sections.hidden.map(f => f.id)).toEqual(['page-other']);
});

test('groupFiltersBySection keeps dividers with the filter that follows them', () => {
  const pageDivider = makeDivider('divider-page');
  const page = makeFilter('page', {
    scope: { rootPath: ['TAB-1'], excluded: [] },
  });
  const trailingDivider = makeDivider('divider-trailing');

  const sections = groupFiltersBySection(
    [makeFilter('report'), pageDivider, page, trailingDivider],
    () => true,
  );

  expect(sections.report.map(f => f.id)).toEqual(['report']);
  expect(sections.page.map(f => f.id)).toEqual([
    'divider-page',
    'page',
    'divider-trailing',
  ]);
});

test('groupFiltersBySection hides dividers of filters that are hidden', () => {
  const sections = groupFiltersBySection(
    [
      makeDivider('divider'),
      makeFilter('page', { scope: { rootPath: ['TAB-2'], excluded: [] } }),
    ],
    () => false,
  );
  expect(sections.hidden.map(f => f.id)).toEqual(['divider', 'page']);
});

test('groupFiltersBySection never lists canvas-only filters', () => {
  const sections = groupFiltersBySection(
    [makeFilter('report'), makeFilter('canvas-only')],
    () => true,
    new Set(['canvas-only']),
  );
  expect(sections.report.map(f => f.id)).toEqual(['report']);
  expect(sections.hidden.map(f => f.id)).toEqual(['canvas-only']);
});

test('an unknown stored level falls back to the scope', () => {
  expect(
    getFilterScopeLevel(
      makeFilter('f', {
        scope: { rootPath: ['TAB-1'], excluded: [] },
        scopeLevel: 'auto' as unknown as FilterScopeLevel,
      }),
    ),
  ).toBe(FilterScopeLevel.Page);
});
