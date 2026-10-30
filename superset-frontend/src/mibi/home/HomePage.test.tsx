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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { greeting, HomeBanner, HomeContent, relativeTime } from './HomePage';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: { locale: 'es' },
    user: { firstName: 'Ana', username: 'ana' },
  }),
}));

const dashboard = (id: number, title: string, published = false) => ({
  id,
  dashboard_title: title,
  url: `/superset/dashboard/${id}/`,
  published,
  changed_on_delta_humanized: 'hace 1 hora',
});

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/log/recent_activity/?q=*', {
    result: [
      {
        item_type: 'dashboard',
        item_url: '/superset/dashboard/1/',
        item_title: 'Ventas',
        time: Date.now() - 60_000,
      },
      {
        item_type: 'dashboard',
        item_url: '/superset/dashboard/1/',
        item_title: 'Ventas',
        time: Date.now() - 120_000,
      },
      {
        item_type: 'slice',
        item_url: '/explore/?slice_id=3',
        item_title: 'Un gráfico',
        time: Date.now(),
      },
    ],
  });
  fetchMock.get(
    'glob:*/api/v1/dashboard/?q=*dashboard_is_favorite*',
    { result: [] },
    { name: 'favorites' },
  );
  fetchMock.get('glob:*/api/v1/dashboard/?q=*', {
    result: [dashboard(1, 'Ventas', true), dashboard(2, 'Finanzas')],
  });
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('greets by the time of day', () => {
  expect(greeting(8)).toBe('Good morning');
  expect(greeting(15)).toBe('Good afternoon');
  expect(greeting(22)).toBe('Good evening');
});

test('formats relative times in the user locale', () => {
  const now = Date.UTC(2026, 0, 10, 12);
  expect(relativeTime(now - 5 * 60_000, now)).toBe('hace 5 minutos');
  expect(relativeTime(now - 2 * 86_400_000, now)).toBe('anteayer');
});

test('the banner greets the user and offers the quick actions', () => {
  render(<HomeBanner />, { useRouter: true });

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ana');
  expect(screen.getAllByTestId('home-action')).toHaveLength(4);
  expect(screen.getByRole('link', { name: /New dashboard/ })).toHaveAttribute(
    'href',
    '/dashboard/new/',
  );
});

test('lists recent dashboards once and the dashboard cards', async () => {
  render(<HomeContent />, { useRouter: true });

  expect(await screen.findAllByTestId('home-dashboard-card')).toHaveLength(2);
  expect(screen.getByText('Published')).toBeInTheDocument();
  expect(screen.getByText('Recently viewed')).toBeInTheDocument();
  expect(screen.queryByText('Un gráfico')).not.toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: /Ventas/ })).toHaveLength(2);
});

test('the favorites tab shows an empty state', async () => {
  render(<HomeContent />, { useRouter: true });
  await screen.findAllByTestId('home-dashboard-card');

  userEvent.click(screen.getByRole('tab', { name: 'Favorites' }));

  expect(
    await screen.findByText('Mark dashboards with a star to find them here.'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.called('favorites')).toBe(true);
});
