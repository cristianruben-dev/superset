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
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type { LayoutItem, RootState } from 'src/dashboard/types';
import {
  cancelFormatPainter,
  copyFormat,
  pasteFormat,
} from 'src/auradata/format/formatPainter';

const slicer = (id: string, filterId: string, title: string) => ({
  id,
  type: 'DYNAMIC',
  children: [],
  parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
  meta: {
    componentKey: 'auradata-filter',
    width: 8,
    height: 4,
    auradataElement: { kind: 'filter', filterId, variant: 'list' },
    auradataFormat: { title: { show: true, template: title } },
  },
});

const layout = {
  ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'], meta: {} },
  GRID_ID: {
    id: 'GRID_ID',
    type: 'GRID',
    children: ['ROW-1'],
    parents: ['ROOT_ID'],
    meta: {},
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['DYNAMIC-a', 'DYNAMIC-b'],
    parents: ['ROOT_ID', 'GRID_ID'],
    meta: {},
  },
  'DYNAMIC-a': {
    ...slicer('DYNAMIC-a', 'NATIVE_FILTER-a', 'Zonas'),
    meta: {
      ...slicer('DYNAMIC-a', 'NATIVE_FILTER-a', 'Zonas').meta,
      auradataElement: {
        kind: 'filter',
        filterId: 'NATIVE_FILTER-a',
        variant: 'buttons',
        itemFill: '#ff0000',
      },
      auradataFormat: {
        radius: 4,
        title: { show: true, template: 'Zonas', size: 20 },
      },
    },
  },
  'DYNAMIC-b': slicer('DYNAMIC-b', 'NATIVE_FILTER-b', 'Productos'),
};

afterEach(() => cancelFormatPainter());

test('a slicer takes the look of another but keeps its filter and title', () => {
  const store = createStore(
    { dashboardLayout: { present: layout, past: [], future: [] } },
    reducerIndex,
  );
  copyFormat(layout['DYNAMIC-a'] as unknown as LayoutItem);
  (store.dispatch as unknown as (action: unknown) => void)(
    pasteFormat('DYNAMIC-b'),
  );
  const { meta } = (store.getState() as unknown as RootState).dashboardLayout
    .present['DYNAMIC-b'];
  expect(meta.auradataElement).toEqual({
    kind: 'filter',
    filterId: 'NATIVE_FILTER-b',
    variant: 'buttons',
    itemFill: '#ff0000',
  });
  expect(meta.auradataFormat).toEqual({
    radius: 4,
    title: { show: true, template: 'Productos', size: 20 },
  });
});
