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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import * as resolveCssImportsModule from 'src/dashboard/util/resolveCssImports';
import StylingSection from './StylingSection';

jest.mock('src/dashboard/util/resolveCssImports', () => ({
  ...jest.requireActual('src/dashboard/util/resolveCssImports'),
  resolveCssImports: jest.fn(),
}));

const mockResolveCssImports =
  resolveCssImportsModule.resolveCssImports as jest.MockedFunction<
    typeof resolveCssImportsModule.resolveCssImports
  >;

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
  // clearAllMocks() only clears call history, not implementations set via
  // mockResolvedValue/mockRejectedValue -- reset this one explicitly so a
  // value set by an earlier test can't leak into a test that forgets to
  // set its own.
  mockResolveCssImports.mockReset();
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

test('does not show the @import warning for ordinary CSS', () => {
  render(
    <StylingSection {...defaultProps} customCss=".header { color: red; }" />,
  );

  expect(screen.queryByTestId('css-import-warning')).not.toBeInTheDocument();
});

test('shows a convert button when the CSS contains @import', () => {
  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
    />,
  );

  expect(screen.getByTestId('css-import-warning')).toBeInTheDocument();
  expect(screen.getByTestId('convert-css-import-button')).toBeInTheDocument();
});

test('converting replaces the CSS and reports success', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockResolvedValue({
    css: "@font-face { font-family: 'Inter'; src: url('x.woff2'); }",
    resolvedCount: 1,
    unresolvedUrls: [],
  });

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(onCustomCssChange).toHaveBeenCalledWith(
      "@font-face { font-family: 'Inter'; src: url('x.woff2'); }",
    );
  });
  expect(screen.getByTestId('css-import-conversion-result')).toHaveTextContent(
    'Converted 1 @import',
  );
});

test('converting reports an unresolved import instead of silently dropping it', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockResolvedValue({
    css: "@import url('https://no-cors.example.com/x.css');",
    resolvedCount: 0,
    unresolvedUrls: ['https://no-cors.example.com/x.css'],
  });

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://no-cors.example.com/x.css');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(
      screen.getByTestId('css-import-conversion-result'),
    ).toHaveTextContent('no-cors.example.com');
  });
  expect(onCustomCssChange).not.toHaveBeenCalled();
});

test('converting surfaces a warning instead of an unhandled rejection on parse failure', async () => {
  const onCustomCssChange = jest.fn();
  mockResolveCssImports.mockRejectedValue(new Error('CssSyntaxError'));

  render(
    <StylingSection
      {...defaultProps}
      customCss="@import url('https://fonts.googleapis.com/css2?family=Inter');"
      onCustomCssChange={onCustomCssChange}
    />,
  );

  await userEvent.click(screen.getByTestId('convert-css-import-button'));

  await waitFor(() => {
    expect(
      screen.getByTestId('css-import-conversion-result'),
    ).toHaveTextContent('Could not parse the CSS');
  });
  expect(onCustomCssChange).not.toHaveBeenCalled();
});
