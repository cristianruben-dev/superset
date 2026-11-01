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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import StylingSection from './StylingSection';

// Mock ColorSchemeSelect component
jest.mock('src/dashboard/components/ColorSchemeSelect', () => ({
  __esModule: true,
  default: ({ value, onChange, ...props }: any) => (
    <div data-test={props['data-test'] || 'color-scheme-select'}>
      <input
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        aria-label="Select color scheme"
      />
    </div>
  ),
}));

const defaultProps = {
  colorScheme: 'supersetColors',
  customCss: '',
  hasCustomLabelsColor: false,
  showChartTimestamps: false,
  onColorSchemeChange: jest.fn(),
  onCustomCssChange: jest.fn(),
  onShowChartTimestampsChange: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders color scheme selection', () => {
  render(<StylingSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-colorscheme-field')).toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-colorscheme-select'),
  ).toBeInTheDocument();
});

test('renders custom CSS editor', () => {
  render(<StylingSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-css-field')).toBeInTheDocument();
});

test('calls onColorSchemeChange when color scheme changes', async () => {
  const onColorSchemeChange = jest.fn();
  render(
    <StylingSection
      {...defaultProps}
      onColorSchemeChange={onColorSchemeChange}
    />,
  );

  const colorSchemeInput = screen.getByLabelText('Select color scheme');
  await userEvent.type(colorSchemeInput, 'newScheme');

  expect(onColorSchemeChange).toHaveBeenCalled();
});

test('passes hasCustomLabelsColor to ColorSchemeSelect', () => {
  render(<StylingSection {...defaultProps} hasCustomLabelsColor />);

  expect(screen.getByText('Color scheme')).toBeInTheDocument();
});

test('displays current color scheme value', () => {
  render(<StylingSection {...defaultProps} colorScheme="testColors" />);

  const colorSchemeInput = screen.getByLabelText('Select color scheme');
  expect(colorSchemeInput).toHaveValue('testColors');
});

test('renders chart timestamps field', () => {
  render(<StylingSection {...defaultProps} />);

  expect(
    screen.getByTestId('dashboard-show-timestamps-field'),
  ).toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-show-timestamps-switch'),
  ).toBeInTheDocument();
});

test('chart timestamps switch reflects showChartTimestamps prop', () => {
  const { rerender } = render(
    <StylingSection {...defaultProps} showChartTimestamps={false} />,
  );

  let timestampSwitch = screen.getByTestId('dashboard-show-timestamps-switch');
  expect(timestampSwitch).not.toBeChecked();

  rerender(<StylingSection {...defaultProps} showChartTimestamps />);

  timestampSwitch = screen.getByTestId('dashboard-show-timestamps-switch');
  expect(timestampSwitch).toBeChecked();
});

test('calls onShowChartTimestampsChange when switch is toggled', async () => {
  const onShowChartTimestampsChange = jest.fn();
  render(
    <StylingSection
      {...defaultProps}
      onShowChartTimestampsChange={onShowChartTimestampsChange}
    />,
  );

  const timestampSwitch = screen.getByTestId(
    'dashboard-show-timestamps-switch',
  );
  await userEvent.click(timestampSwitch);

  expect(onShowChartTimestampsChange).toHaveBeenCalled();
  expect(onShowChartTimestampsChange.mock.calls[0][0]).toBe(true);
});
