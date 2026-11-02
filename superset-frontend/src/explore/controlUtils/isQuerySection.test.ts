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
import { isQuerySection } from './getSectionsToRender';

const section = (config: Record<string, unknown>, tabOverride?: string) =>
  ({
    tabOverride,
    controlSetRows: [[{ name: 'any', config }]],
  }) as unknown as ControlPanelSectionConfig;

test('a section with a control that asks for data goes with the data', () => {
  expect(isQuerySection(section({ renderTrigger: false }))).toBe(true);
  expect(isQuerySection(section({ renderTrigger: true }))).toBe(false);
});

test('a section that asks for a tab keeps to it', () => {
  expect(isQuerySection(section({ renderTrigger: false }, 'customize'))).toBe(
    false,
  );
  expect(isQuerySection(section({ renderTrigger: true }, 'data'))).toBe(true);
});

test('a control that asks for the data tab takes its section there', () => {
  expect(
    isQuerySection(section({ renderTrigger: true, tabOverride: 'data' })),
  ).toBe(true);
});
