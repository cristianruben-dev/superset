/*
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
import '@testing-library/jest-dom';
import { render, screen } from '@superset-ui/core/spec';
import { SuperChart } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { ChartKeys, DiligentChartPlugin } from './MockChartPlugins';

const QUERIES_DATA = [{ data: ['foo', 'bar'] }];

beforeAll(() => {
  new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
});

afterAll(() => {
  new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).unregister();
});

const renderChart = (formData: Record<string, unknown>) =>
  render(
    <SuperChart
      chartType={ChartKeys.DILIGENT}
      queriesData={QUERIES_DATA}
      width={400}
      height={300}
      theme={supersetTheme}
      formData={formData}
    />,
  );

const getDimensionText = async () =>
  (await screen.findByText(/^\d+x\d+$/)).textContent;

test('renders the chart without a frame when no format option is set', async () => {
  renderChart({ abc: 1 });
  expect(await getDimensionText()).toBe('400x300');
  expect(screen.queryByTestId('visual-container')).not.toBeInTheDocument();
});

test('renders title and subtitle and shrinks the chart below them', async () => {
  renderChart({
    visual_title_show: true,
    visual_title_text: 'Revenue',
    visual_subtitle_show: true,
    visual_subtitle_text: 'Last 12 months',
    visual_header_spacing: 8,
  });

  expect(await screen.findByRole('heading', { name: 'Revenue' })).toBeVisible();
  expect(screen.getByText('Last 12 months')).toBeVisible();
  // header = ceil(16 * 1.3) + 2 + ceil(12 * 1.3) + 8 = 21 + 2 + 16 + 8 = 47
  expect(await getDimensionText()).toBe('400x253');
});

test('applies frame effects and subtracts border, padding and shadow', async () => {
  renderChart({
    visual_background_show: true,
    visual_background_color: '#123456',
    visual_border_show: true,
    visual_border_width: 2,
    visual_border_radius: 6,
    visual_shadow_show: true,
    visual_padding: 10,
  });

  const frame = await screen.findByTestId('visual-container');
  expect(frame).toHaveStyle({
    background: '#123456',
    borderRadius: '6px',
    padding: '10px',
  });
  expect(frame.style.boxShadow).toContain('8px');
  // chrome per side = 8 (shadow) + 2 (border) + 10 (padding) = 20
  expect(await getDimensionText()).toBe('360x260');
});

test('renders a divider using the chosen style', async () => {
  renderChart({
    visual_divider_show: true,
    visual_divider_width: 3,
    visual_divider_style: 'dotted',
    visual_divider_color: '#ff0000',
  });

  const divider = await screen.findByRole('separator');
  expect(divider).toHaveStyle({ borderTop: '3px dotted rgb(255, 0, 0)' });
});
