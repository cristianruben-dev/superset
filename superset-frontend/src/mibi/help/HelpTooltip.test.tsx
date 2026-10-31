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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { HelpCard, HelpTooltip } from './HelpTooltip';
import { HelpIllustration, type HelpIllustrationKind } from './illustrations';

const KINDS: HelpIllustrationKind[] = [
  'legend',
  'legendAlign',
  'legendMarker',
  'legendSort',
  'dataLabels',
  'labelRotate',
  'labelFormat',
  'labelBackground',
  'font',
  'axisLabels',
  'axisTitle',
  'axisTitleMargin',
  'axisInverse',
  'axisBounds',
  'axisRotation',
  'axisLog',
  'axisTruncate',
  'gridColor',
  'gridWidth',
  'gridStyle',
  'seriesColors',
  'lineWidth',
  'markers',
  'barGap',
  'barRadius',
  'barBorder',
  'stack',
  'area',
  'conditional',
  'tooltip',
  'donut',
  'rose',
  'pieLabels',
  'sort',
  'zoom',
  'colorBy',
];

test.each(KINDS)('draws the %s illustration', kind => {
  render(<HelpIllustration kind={kind} />);

  const drawing = screen.getByTestId('help-illustration');
  expect(drawing).toHaveAttribute('data-kind', kind);
  expect(drawing.childElementCount).toBeGreaterThan(0);
});

test('shows the title, the description and the drawing', () => {
  render(
    <HelpCard
      title="Legend marker"
      description="Shape of the markers"
      kind="legendMarker"
    />,
  );

  expect(screen.getByText('Legend marker')).toBeInTheDocument();
  expect(screen.getByText('Shape of the markers')).toBeInTheDocument();
  expect(screen.getByTestId('help-illustration')).toHaveAttribute(
    'data-kind',
    'legendMarker',
  );
});

test('shows only text when the control has no drawing', () => {
  render(<HelpCard description="Just text" />);

  expect(screen.getByText('Just text')).toBeInTheDocument();
  expect(screen.queryByTestId('help-illustration')).not.toBeInTheDocument();
});

test('opens on hover with the drawing of the control', async () => {
  render(
    <HelpTooltip
      controlName="gridline_style"
      title="Gridline style"
      description="Line style of the gridlines"
    >
      <button type="button">help</button>
    </HelpTooltip>,
  );

  await userEvent.hover(screen.getByRole('button', { name: 'help' }));

  expect(
    await screen.findByText('Line style of the gridlines'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('help-illustration')).toHaveAttribute(
    'data-kind',
    'gridStyle',
  );
});
