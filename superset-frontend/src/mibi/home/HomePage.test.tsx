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
import { HomeBanner, HomeContent, relativeTime } from './HomePage';

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
  fetchMock.get('glob:*/api/v1/mibi/dashboard_previews/?q=*', {
    result: [
      { id: 1, rows: [[{ width: 12, height: 50, kind: 'pie' }]] },
      { id: 2, rows: [] },
    ],
  });
  fetchMock.get('glob:*/api/v1/dashboard/favorite_status/?q=*', {
    result: [
      { id: 1, value: true },
      { id: 2, value: false },
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

test('formats relative times in the user locale', () => {
  const now = Date.UTC(2026, 0, 10, 12);
  expect(relativeTime(now - 5 * 60_000, now)).toBe('hace 5 minutos');
  expect(relativeTime(now - 2 * 86_400_000, now)).toBe('anteayer');
});

test('the banner offers the quick actions, without a greeting card', () => {
  render(<HomeBanner />, { useRouter: true });

  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  expect(screen.getAllByTestId('home-action')).toHaveLength(4);
  expect(screen.getByRole('link', { name: /New dashboard/ })).toHaveAttribute(
    'href',
    '/dashboard/new/',
  );
});

test('lists the dashboard cards without recently viewed items', async () => {
  render(<HomeContent />, { useRouter: true, useRedux: true });

  expect(await screen.findAllByTestId('mibi-dashboard-card')).toHaveLength(2);
  expect(screen.getByText('Published')).toBeInTheDocument();
  expect(screen.queryByText('Recently viewed')).not.toBeInTheDocument();
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/log/recent_activity/?q=*'),
  ).toHaveLength(0);
  // Layout previews arrive in one request for all the cards
  expect(await screen.findByTestId('dashboard-preview')).toBeInTheDocument();
  expect(screen.getByText('Empty dashboard')).toBeInTheDocument();
  expect(
    fetchMock.callHistory.calls('glob:*/api/v1/mibi/dashboard_previews/?q=*'),
  ).toHaveLength(1);
  expect(await screen.findAllByTestId('fave-unfave-icon')).toHaveLength(2);
});

test('the favorites tab shows an empty state', async () => {
  render(<HomeContent />, { useRouter: true, useRedux: true });
  await screen.findAllByTestId('mibi-dashboard-card');

  userEvent.click(screen.getByRole('tab', { name: 'Favorites' }));

  expect(
    await screen.findByText('Mark dashboards with a star to find them here.'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.called('favorites')).toBe(true);
});
