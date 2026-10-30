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
import { render, screen } from 'spec/helpers/testing-library';
import { VizTypeIcon, VizTypeTile, vizIconKind } from './VizTypeIcon';

test.each([
  ['echarts_timeseries_bar', 'bar'],
  ['echarts_timeseries_smooth', 'line'],
  ['pie', 'pie'],
  ['big_number_total', 'kpi'],
  ['big_number', 'kpiTrend'],
  ['pivot_table_v2', 'pivot'],
  ['deck_arc', 'map'],
  ['country_map', 'map'],
  ['ag-grid-table', 'table'],
  ['some_new_plugin', 'chart'],
  [undefined, 'chart'],
])('draws %s as %s', (vizType, kind) => {
  expect(vizIconKind(vizType)).toBe(kind);
});

test('renders an accessible drawing when it has a title', () => {
  render(<VizTypeIcon vizType="pie" title="Pie chart" size={24} />);

  const icon = screen.getByRole('img', { name: 'Pie chart' });
  expect(icon).toHaveAttribute('data-kind', 'pie');
  expect(icon).toHaveAttribute('width', '24');
});

test('hides decorative drawings from assistive technology', () => {
  render(<VizTypeTile vizType="table" />);

  expect(screen.getByTestId('viz-type-icon')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});
