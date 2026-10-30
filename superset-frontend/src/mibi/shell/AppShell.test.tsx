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
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { MenuData } from 'src/types/bootstrapTypes';
import { AppShell } from './AppShell';

jest.mock('src/features/home/RightMenu', () => ({
  __esModule: true,
  default: ({ newLabel }: { newLabel: React.ReactNode }) => (
    <div data-test="right-menu">{newLabel}</div>
  ),
}));

const data = (anonymous = false) =>
  ({
    menu: [
      { name: 'Dashboards', label: 'Dashboards', url: '/dashboard/list/' },
      {
        name: 'SQL Lab',
        label: 'SQL',
        childs: [{ name: 'SQL Editor', label: 'SQL Lab', url: '/sqllab/' }],
      },
    ],
    brand: { path: '/', icon: '', alt: '', tooltip: '', text: '' },
    navbar_right: { user_is_anonymous: anonymous },
    settings: [],
    environment_tag: { text: '', color: '' },
  }) as unknown as MenuData;

const renderShell = (anonymous = false) =>
  render(
    <AppShell data={data(anonymous)} isFrontendRoute={() => true}>
      <div>page content</div>
    </AppShell>,
    {
      useRedux: true,
      useRouter: true,
      initialState: { user: { firstName: 'Ana', lastName: 'Pérez' } },
    },
  );

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.get('glob:*/api/v1/dashboard/?q=*', {
    result: [
      { id: 7, dashboard_title: 'Ventas', url: '/superset/dashboard/7/' },
    ],
  });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('renders the sidebar, the top bar and the page', () => {
  renderShell();

  expect(screen.getByTestId('mibi-sidebar')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-topbar')).toBeInTheDocument();
  expect(screen.getByText('page content')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Dashboards/ })).toHaveAttribute(
    'href',
    '/dashboard/list/',
  );
  expect(screen.getByText('New')).toBeInTheDocument();
});

test('signed-out pages render without the navigation', () => {
  renderShell(true);

  expect(screen.queryByTestId('mibi-sidebar')).not.toBeInTheDocument();
  expect(screen.getByText('page content')).toBeInTheDocument();
});

test('collapses the sidebar and remembers it', () => {
  renderShell();

  userEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

  expect(screen.queryByText('Dashboards')).not.toBeInTheDocument();
  expect(window.localStorage.getItem('mibi.sidebarCollapsed')).toBe('true');
});

test('Ctrl+K opens the search with dashboards and pages', async () => {
  renderShell();

  fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

  expect(await screen.findByTestId('mibi-command-input')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('option', { name: /Ventas/ })).toBeInTheDocument(),
  );
  expect(screen.getByRole('option', { name: /SQL Lab/ })).toBeInTheDocument();
});
