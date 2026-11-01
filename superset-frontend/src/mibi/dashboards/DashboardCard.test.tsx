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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { DashboardCard } from './DashboardCard';
import { DashboardPreview, glyphFor } from './DashboardPreview';

const props = {
  id: 3,
  title: 'Ventas 2025',
  url: '/superset/dashboard/3/',
  published: true,
  modified: 'Modified 1 hour ago',
};

test('maps viz types to preview glyphs', () => {
  expect(glyphFor('big_number_total')).toBe('number');
  expect(glyphFor('echarts_timeseries_bar')).toBe('bar');
  expect(glyphFor('echarts_timeseries_line')).toBe('line');
  expect(glyphFor('echarts_area')).toBe('line');
  expect(glyphFor('pie')).toBe('pie');
  expect(glyphFor('pivot_table_v2')).toBe('table');
  expect(glyphFor('deck_scatter')).toBe('map');
  expect(glyphFor('markdown')).toBe('text');
  expect(glyphFor('something_else')).toBe('chart');
});

test('shows the layout preview, title, date and status', () => {
  render(
    <DashboardCard
      {...props}
      preview={[
        [
          { width: 4, height: 30, kind: 'big_number_total' },
          {
            width: 8,
            height: 60,
            kind: 'column',
            cells: [
              { width: 8, height: 30, kind: 'pie' },
              { width: 8, height: 30, kind: 'table' },
            ],
          },
        ],
      ]}
    />,
    { useRouter: true },
  );

  const preview = screen.getByTestId('dashboard-preview');
  expect(preview.querySelectorAll('.leaf')).toHaveLength(3);
  expect(screen.getByRole('link', { name: 'Ventas 2025' })).toHaveAttribute(
    'href',
    '/superset/dashboard/3/',
  );
  expect(screen.getByText('Modified 1 hour ago')).toBeInTheDocument();
  expect(screen.getByText('Published')).toBeInTheDocument();
});

test('shows the layout preview until the screenshot is ready', async () => {
  jest.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:thumb');
  fetchMock.get(
    'glob:*/thumb.png',
    new Response(new Blob(['png'], { type: 'image/png' }), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    }),
  );
  const { container } = render(
    <DashboardCard {...props} thumbnailUrl="/thumb.png" preview={[]} />,
    { useRouter: true },
  );

  expect(screen.getByText('Empty dashboard')).toBeInTheDocument();
  await waitFor(() =>
    expect(container.querySelector('img')).toHaveAttribute('src', 'blob:thumb'),
  );
  expect(screen.queryByText('Empty dashboard')).not.toBeInTheDocument();
  fetchMock.removeRoutes().clearHistory();
});

test('selects instead of navigating in bulk mode', () => {
  const onSelect = jest.fn();
  render(<DashboardCard {...props} published={false} onSelect={onSelect} />, {
    useRouter: true,
  });

  userEvent.click(screen.getByRole('link', { name: 'Ventas 2025' }));

  expect(onSelect).toHaveBeenCalled();
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('never draws NaN coordinates, even before the dashboard id is known', () => {
  const { container } = render(
    <DashboardPreview
      seed={Number.NaN}
      rows={[
        [
          { kind: 'echarts_timeseries_line', width: 6, height: 50 },
          { kind: 'dist_bar', width: 6, height: 50 },
        ],
      ]}
    />,
  );
  expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  expect(container.innerHTML).not.toContain('NaN');
});
