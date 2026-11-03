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
import { ChartMetadata, getChartMetadataRegistry } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { OPEN_CHART_EDITOR } from 'src/mibi/chartEditor';
import UnavailableChart, { isUnavailableChartType } from './UnavailableChart';

test('a type is unavailable only once the plugins are known', () => {
  const registry = getChartMetadataRegistry();
  expect(isUnavailableChartType('horizon')).toBe(false);

  registry.registerValue(
    'table',
    new ChartMetadata({ name: 'Table', thumbnail: '' }),
  );
  expect(isUnavailableChartType('horizon')).toBe(true);
  expect(isUnavailableChartType('table')).toBe(false);
  expect(isUnavailableChartType(undefined)).toBe(false);
  registry.remove('table');
});

test('editors can change the type of a removed chart', () => {
  const onOpen = jest.fn();
  window.addEventListener(OPEN_CHART_EDITOR, onOpen);
  render(
    <UnavailableChart
      chartId={7}
      vizType="horizon"
      height={200}
      canChangeType
    />,
  );

  expect(
    screen.getByText('This chart type is no longer available'),
  ).toBeInTheDocument();
  expect(screen.getByText(/Horizon Chart charts were removed/)).toBeVisible();
  userEvent.click(screen.getByRole('button', { name: 'Change chart type' }));

  expect(onOpen).toHaveBeenCalledTimes(1);
  expect((onOpen.mock.calls[0][0] as CustomEvent).detail).toEqual({
    url: '/explore/?slice_id=7',
    chartId: 7,
  });
  window.removeEventListener(OPEN_CHART_EDITOR, onOpen);
});

test('viewers are told to ask an editor', () => {
  render(
    <UnavailableChart
      chartId={7}
      vizType="para"
      height={200}
      canChangeType={false}
    />,
  );

  expect(
    screen.getByText(/Parallel Coordinates charts were removed. Ask an editor/),
  ).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
