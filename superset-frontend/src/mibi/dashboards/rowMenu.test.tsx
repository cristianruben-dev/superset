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
import fetchMock from 'fetch-mock';
import { renderHook } from '@testing-library/react-hooks';
import { useDashboardRowMenu } from './rowMenu';

const row = { id: 7, dashboard_title: 'Ventas', url: '/superset/dashboard/7/' };

const options = (permissions: {
  canEdit: boolean;
  canExport: boolean;
  canDelete: boolean;
}) => ({
  ...permissions,
  isStarred: () => false,
  toggleStar: jest.fn(),
  onEdit: jest.fn(),
  onExport: jest.fn(),
  onDelete: jest.fn(),
  onMoved: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
});

const keysOf = (items: { key?: unknown }[]) =>
  items.map(item => item.key).filter(Boolean);

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/workspace/*', { result: [] });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('a viewer can open, copy and star a dashboard', () => {
  const { result } = renderHook(() =>
    useDashboardRowMenu(
      options({ canEdit: false, canExport: false, canDelete: false }),
    ),
  );
  expect(keysOf(result.current(row))).toEqual([
    'open',
    'open-tab',
    'copy-link',
    'star',
  ]);
});

test('an editor also edits, exports and deletes it', () => {
  const props = options({ canEdit: true, canExport: true, canDelete: true });
  const { result } = renderHook(() => useDashboardRowMenu(props));
  const items = result.current(row);
  expect(keysOf(items)).toEqual(
    expect.arrayContaining(['properties', 'export', 'delete']),
  );
  const remove = items.find(item => item?.key === 'delete') as {
    onClick: () => void;
  };
  remove.onClick();
  expect(props.onDelete).toHaveBeenCalledWith(row);
});
