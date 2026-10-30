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
  CHART_SAVED,
  isChartSavedMessage,
  isPanelMode,
  withPanelParam,
} from './chartEditor';

test('adds the panel parameter to URLs', () => {
  expect(withPanelParam('/chart/add')).toBe('/chart/add?mibi_panel=1');
  expect(withPanelParam('/explore/?slice_id=3')).toBe(
    '/explore/?slice_id=3&mibi_panel=1',
  );
  expect(withPanelParam('/explore/?slice_id=3#tab')).toBe(
    '/explore/?slice_id=3&mibi_panel=1#tab',
  );
});

test('recognizes chart saved messages only', () => {
  expect(
    isChartSavedMessage({ type: CHART_SAVED, chartId: 3, isNew: true }),
  ).toBe(true);
  expect(isChartSavedMessage({ type: CHART_SAVED, chartId: '3' })).toBe(false);
  expect(isChartSavedMessage({ type: 'other', chartId: 3 })).toBe(false);
  expect(isChartSavedMessage('mibi:chart-saved')).toBe(false);
  expect(isChartSavedMessage(null)).toBe(false);
});

test('pages outside the panel are not in panel mode', () => {
  expect(isPanelMode()).toBe(false);
});
