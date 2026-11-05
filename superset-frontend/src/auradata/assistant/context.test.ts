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
import { MAX_CONTEXT_CHARS, pageContext } from './context';

type State = Parameters<typeof pageContext>[0];

const target = { column: { name: 'region' }, datasetId: 7 };

const state = (changes: Record<string, unknown> = {}) =>
  ({
    dashboardLayout: {
      present: {
        'TAB-1': { meta: { text: 'Ventas' } },
        'TAB-2': { meta: { text: 'Detalle' } },
      },
    },
    dashboardState: { activeTabs: ['TAB-1', 'TAB-2'] },
    nativeFilters: { filters: {} },
    dataMask: {},
    ...changes,
  }) as unknown as State;

const filtered = (count: number, value: unknown) =>
  state({
    nativeFilters: {
      filters: Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          `F-${index}`,
          { name: `Filtro ${index}`, targets: [target] },
        ]),
      ),
    },
    dataMask: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `F-${index}`,
        { filterState: { value } },
      ]),
    ),
  });

test('says the page on screen, the deepest open', () => {
  expect(pageContext(state(), 3)).toEqual({
    dashboard_id: 3,
    page: 'Detalle',
  });
});

test('a report without tabs has no page name', () => {
  const context = pageContext(state({ dashboardState: { activeTabs: [] } }), 3);

  expect(context).toEqual({ dashboard_id: 3 });
});

test('says what each filter selects and what it filters', () => {
  expect(pageContext(filtered(1, ['Norte']), 3).filters).toEqual({
    'Filtro 0': { column: 'region', dataset_id: 7, value: ['Norte'] },
  });
});

test('leaves out filters without a value', () => {
  const context = pageContext(filtered(2, []), 3);

  expect(context.filters).toBeUndefined();
});

test('adds the cross-filters of the charts', () => {
  const context = pageContext(
    state({
      dataMask: {
        12: {
          extraFormData: {
            filters: [{ col: 'pais', op: 'IN', val: ['MX'] }],
          },
        },
      },
    }),
    3,
  );

  expect(context.filters).toEqual({
    cross_filters: [{ col: 'pais', op: 'IN', val: ['MX'] }],
  });
});

test('always stays under what the server accepts, and says what it left out', () => {
  const huge = Array.from({ length: 1000 }, () => 'x'.repeat(500));

  const context = pageContext(filtered(50, huge), 3);

  expect(JSON.stringify(context).length).toBeLessThanOrEqual(
    MAX_CONTEXT_CHARS + 30,
  );
  expect(context.filters?.omitted_filters).toBeGreaterThan(0);
  expect(context.filters?.['Filtro 0']).toBeDefined();
});
