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
import { render, screen } from '@superset-ui/core/spec';
import TimeseriesLegend, {
  type TimeseriesLegendProps,
} from '../../src/Timeseries/TimeseriesLegend';
import { LegendOrientation } from '../../src/types';

const baseProps: TimeseriesLegendProps = {
  grid: { top: 0, bottom: 0 },
  items: [
    { color: '#ff0000', interactive: true, name: 'Sales', selected: true },
    { color: '#0000ff', interactive: true, name: 'Costs', selected: false },
  ],
  orientation: LegendOrientation.Top,
  showSelectors: false,
  maxHeight: 100,
  onAll: jest.fn(),
  onInverse: jest.fn(),
  onToggle: jest.fn(),
};

test('renders with the default look when no style is given', () => {
  render(<TimeseriesLegend {...baseProps} />);
  const viewport = screen.getByTestId('timeseries-custom-legend');
  expect(viewport.style.fontSize).toBe('');
  expect(screen.getByRole('list')).toHaveStyle({
    justifyContent: 'flex-start',
  });
});

test('applies alignment, font and text color from the legend format', () => {
  render(
    <TimeseriesLegend
      {...baseProps}
      style={{
        align: 'center',
        icon: 'circle',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          fontStyle: 'italic',
          color: '#123456',
        },
      }}
    />,
  );
  const viewport = screen.getByTestId('timeseries-custom-legend');
  expect(viewport).toHaveStyle({
    fontSize: '16px',
    fontWeight: 'bold',
    fontStyle: 'italic',
  });
  expect(screen.getByRole('list')).toHaveStyle({ justifyContent: 'center' });
  // The chosen color applies to selected items; deselected ones stay muted.
  expect(screen.getByRole('button', { name: 'Sales' })).toHaveStyle({
    color: '#123456',
  });
  expect(screen.getByRole('button', { name: 'Costs' }).style.color).toBe('');
});
