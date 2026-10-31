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
import { NativeFilterType } from '@superset-ui/core';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  NATIVE_FILTER_COMPONENT_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import { LayoutItem } from 'src/dashboard/types';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import NativeFilter from './NativeFilter';

jest.mock('./CanvasFilterControl', () => ({
  __esModule: true,
  default: ({ filter }: { filter: { name: string } }) => (
    <div data-test="canvas-filter-control">{filter.name}</div>
  ),
}));

const nativeFilter = {
  id: 'NATIVE_FILTER-1',
  name: 'Country',
  type: NativeFilterType.NativeFilter,
  filterType: 'filter_select',
  targets: [],
  controlValues: {},
  cascadeParentIds: [],
  defaultDataMask: {},
  description: '',
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
};

const initialState = {
  dashboardInfo: {
    metadata: { native_filter_configuration: [nativeFilter] },
  },
  dashboardState: {},
};

const makeComponent = (meta: Record<string, unknown> = {}) => {
  const component = newComponentFactory(NATIVE_FILTER_COMPONENT_TYPE, meta);
  return component as unknown as LayoutItem;
};

const setup = (overrides: Partial<Parameters<typeof NativeFilter>[0]> = {}) => {
  const props = {
    id: 'FILTER-1',
    parentId: 'ROW-1',
    component: makeComponent(),
    parentComponent: newComponentFactory(ROW_TYPE) as unknown as LayoutItem,
    index: 0,
    depth: 3,
    editMode: false,
    columnWidth: 100,
    availableColumnCount: 8,
    handleComponentDrop: jest.fn(),
    onResizeStart: jest.fn(),
    onResize: jest.fn(),
    onResizeStop: jest.fn(),
    deleteComponent: jest.fn(),
    updateComponents: jest.fn(),
    ...overrides,
  };
  render(<NativeFilter {...props} />, {
    useDnd: true,
    useRedux: true,
    initialState,
  });
  return props;
};

test('new filter components are listed in the filter bar by default', () => {
  expect(makeComponent().meta.showInFilterBar).toBe(true);
});

test('renders the configured filter', () => {
  setup({ component: makeComponent({ filterId: 'NATIVE_FILTER-1' }) });
  expect(screen.getByTestId('canvas-filter-control')).toHaveTextContent(
    'Country',
  );
});

test('shows a placeholder when no filter is selected', () => {
  setup();
  expect(screen.getByText('No filter selected')).toBeInTheDocument();
  expect(screen.queryByTestId('hover-menu')).not.toBeInTheDocument();
});

test('explains when the selected filter was deleted', () => {
  setup({ component: makeComponent({ filterId: 'NATIVE_FILTER-gone' }) });
  expect(
    screen.getByText('The selected filter no longer exists'),
  ).toBeInTheDocument();
});

test('lets editors pick the filter to show', async () => {
  const { updateComponents, component } = setup({ editMode: true });
  expect(
    screen.getByText('Choose a dashboard filter to show here'),
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('combobox', { name: 'Filter to show' }),
  );
  await userEvent.click(await screen.findByText('Country'));

  expect(updateComponents).toHaveBeenCalledWith({
    [component.id]: expect.objectContaining({
      meta: expect.objectContaining({ filterId: 'NATIVE_FILTER-1' }),
    }),
  });
});

test('lets editors hide the filter from the filter bar', async () => {
  const { updateComponents, component } = setup({
    editMode: true,
    component: makeComponent({ filterId: 'NATIVE_FILTER-1' }),
  });

  await userEvent.click(
    screen.getByRole('checkbox', { name: 'Also show in the filter bar' }),
  );

  expect(updateComponents).toHaveBeenCalledWith({
    [component.id]: expect.objectContaining({
      meta: expect.objectContaining({ showInFilterBar: false }),
    }),
  });
});

test('calls deleteComponent from the hover menu', async () => {
  const { deleteComponent } = setup({ editMode: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete component' }),
  );
  expect(deleteComponent).toHaveBeenCalledWith('FILTER-1', 'ROW-1');
});
