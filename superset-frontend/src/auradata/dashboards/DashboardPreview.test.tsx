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
import { glyphFor } from './DashboardPreview';

test('design elements get their own miniature', () => {
  expect(glyphFor('text')).toBe('text');
  expect(
    ['shape', 'image', 'button', 'filter', 'navigator'].map(glyphFor),
  ).toEqual(['block', 'block', 'block', 'block', 'block']);
});

test('chart types keep their miniature', () => {
  expect(glyphFor('markdown')).toBe('text');
  expect(glyphFor('echarts_timeseries_line')).toBe('line');
  expect(glyphFor('pie')).toBe('pie');
  expect(glyphFor('world_map')).toBe('map');
  expect(glyphFor('something_new')).toBe('chart');
});
