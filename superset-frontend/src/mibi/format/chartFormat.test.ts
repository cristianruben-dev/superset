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
import { withChartFormat, legacyCardFormat } from './chartFormat';
import {
  ownChartFormat,
  ownFormat,
  sharableFormat,
  withOwnFormat,
} from './chartFormatSettings';
import { mergeVisualFormat } from './styles';

test('keeps the same settings when the report changes nothing', () => {
  const formData = { viz_type: 'pie', legend_font: { fontSize: 10 } };
  expect(withChartFormat(formData, undefined)).toBe(formData);
});

test('the format of the report wins over what the chart saved', () => {
  expect(
    withChartFormat(
      { viz_type: 'pie', legend_font: { fontSize: 10 }, show_legend: true },
      { legend_font: { fontSize: 24 } },
    ),
  ).toEqual({
    viz_type: 'pie',
    legend_font: { fontSize: 24 },
    show_legend: true,
  });
});

test('has nothing to apply on a chart without settings', () => {
  expect(withChartFormat(undefined, { show_legend: true })).toBeUndefined();
});

test('a chart keeps the shared chart settings it does not change', () => {
  expect(
    mergeVisualFormat(
      { chart: { show_legend: true, gridline_width: 2 } },
      { chart: { gridline_width: 1 } },
    )?.chart,
  ).toEqual({ show_legend: true, gridline_width: 1 });
});

test('what belongs to the data of a chart is not copied to another', () => {
  expect(
    sharableFormat({
      radius: 4,
      chart: { legend_font: { fontSize: 20 }, series_colors: { a: '#000' } },
    }),
  ).toEqual({ radius: 4, chart: { legend_font: { fontSize: 20 } } });
  expect(sharableFormat({ chart: { series_colors: {} } })).toEqual({});
  expect(ownChartFormat({ legend_font: {}, x_axis_title: 'Ventas' })).toEqual({
    x_axis_title: 'Ventas',
  });
});

test('what says something about one chart stays with it', () => {
  const format = {
    title: { subtitle: 'Sales', bold: true },
    header: { focus: true, tooltip: { text: 'Help', bold: true } },
    link: { show: true },
    actionButton: { show: true },
    chart: { series_colors: {}, legend_font: { bold: true } },
  } as never;
  expect(sharableFormat(format)).toEqual({
    title: { bold: true },
    header: { focus: true, tooltip: { bold: true } },
    chart: { legend_font: { bold: true } },
  });
  expect(
    withOwnFormat(
      { title: { bold: true }, header: { focus: true } },
      ownFormat(format),
    ),
  ).toEqual({
    title: { bold: true, subtitle: 'Sales' },
    header: { focus: true, tooltip: { text: 'Help' } },
    link: { show: true },
    actionButton: { show: true },
    chart: { series_colors: {} },
  });
});

test('legacy card styles become defaults for the unified format controls', () => {
  expect(
    legacyCardFormat({
      value: { size: 48, bold: false, align: 'right' },
      label: { color: '#ff0000' },
    }),
  ).toMatchObject({
    card_value_font: { fontSize: 48, bold: false },
    card_value_align: 'right',
    card_label_font: { color: '#ff0000' },
    card_subtitle_font: { color: '#ff0000' },
  });
});
