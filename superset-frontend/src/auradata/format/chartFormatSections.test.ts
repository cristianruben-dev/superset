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
import type { ControlPanelSectionConfig } from '@superset-ui/chart-controls';
import { legacyValue, seedControls } from './ChartFormatSections';

const sections = [
  {
    label: 'Chart Options',
    controlSetRows: [
      [{ name: 'gridlines_hidden', config: { type: 'CheckboxControl' } }],
      [{ name: 'special_start_angle', config: { type: 'NumberControl' } }],
    ],
  },
] as unknown as ControlPanelSectionConfig[];

test('shows the gridlines a chart saved with the switch of 7.0 as hidden', () => {
  expect(legacyValue('gridlines_hidden', { gridlines: false })).toBe(true);
  expect(legacyValue('gridlines_hidden', { gridlines: true })).toBeUndefined();
  expect(legacyValue('gridlines_hidden', {})).toBeUndefined();
  expect(legacyValue('other', { gridlines: false })).toBeUndefined();
});

test('the pane reads what the chart saved before it had the control', () => {
  const read = (formData: Record<string, unknown>) =>
    seedControls(sections, formData, undefined);

  expect(read({ gridlines: false }).gridlines_hidden.value).toBe(true);
  expect(read({ startAngle: 45 }).special_start_angle.value).toBe(45);
  // What the pane saved wins
  expect(
    read({ gridlines: false, gridlines_hidden: false }).gridlines_hidden.value,
  ).toBe(false);
  expect(
    read({ startAngle: 45, special_start_angle: 200 }).special_start_angle
      .value,
  ).toBe(200);
});
