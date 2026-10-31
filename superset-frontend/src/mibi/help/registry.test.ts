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
import { helpIllustrationFor, helpIllustrationForSection } from './registry';

test.each([
  ['legendType', 'legend'],
  ['legend_icon', 'legendMarker'],
  ['gridline_style', 'gridStyle'],
  ['bar_category_gap', 'barGap'],
  ['y_axis_secondary_label_font', 'axisLabels'],
  ['some_new_font', 'font'],
])('draws %s as %s', (name, kind) => {
  expect(helpIllustrationFor(name)).toBe(kind);
});

test('has no drawing for unknown controls', () => {
  expect(helpIllustrationFor('datasource')).toBeUndefined();
  expect(helpIllustrationFor(undefined)).toBeUndefined();
});

test('finds the drawing of a Format section by its label', () => {
  expect(helpIllustrationForSection('Legend format')).toBe('legend');
  expect(helpIllustrationForSection('Something else')).toBeUndefined();
});
