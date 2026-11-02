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
import { buildFormatCards, cardControlNames } from './formatCards';

const control = (name: string) => ({
  name,
  config: { type: 'TextControl', renderTrigger: true },
});

const section = (label: string, names: string[]) =>
  ({
    label,
    controlSetRows: names.map(name => [control(name)]),
  }) as unknown as ControlPanelSectionConfig;

test('sorts controls into the sections of the pane, whatever their source', () => {
  const cards = buildFormatCards([
    section('Chart Options', ['show_legend', 'legendType']),
    section('Legend format', ['legend_font']),
  ]);
  expect(cards).toHaveLength(1);
  expect(cards[0].id).toBe('legend');
  expect(cards[0].toggle?.control).toBe('show_legend');
  expect(cards[0].items.map(item => item.name)).toEqual([
    'legendType',
    'legend_font',
  ]);
});

test('a chart only shows the sections it has controls for', () => {
  const ids = buildFormatCards([section('Any', ['gridline_color'])]).map(
    card => card.id,
  );
  expect(ids).toEqual(['gridlines']);
});

test('a control no section knows stays under its own section', () => {
  const cards = buildFormatCards([section('Gauge', ['overlap', 'round_cap'])]);
  expect(cards.map(card => card.title)).toEqual(['Gauge']);
  expect(cards[0].items.map(item => item.name)).toEqual([
    'overlap',
    'round_cap',
  ]);
});

test('text between the controls and repeated controls are left out', () => {
  const cards = buildFormatCards([
    {
      label: 'Any',
      controlSetRows: [
        ['<header>' as never],
        [control('legend_font')],
        [control('legend_font')],
        [null],
      ],
    } as unknown as ControlPanelSectionConfig,
  ]);
  expect(cards[0].items).toHaveLength(1);
});

test('resetting a section includes its switch', () => {
  const [card] = buildFormatCards([
    section('Any', ['show_legend', 'legend_font']),
  ]);
  expect(cardControlNames(card)).toEqual(['show_legend', 'legend_font']);
});

test('the first switch a chart has rules the section', () => {
  const [card] = buildFormatCards([section('Any', ['show_labels'])]);
  expect(card.toggle?.control).toBe('show_labels');
});

test('a format without axes goes under the values', () => {
  const pie = buildFormatCards([section('Any', ['currency_format'])]);
  expect(pie.map(card => card.id)).toEqual(['values']);
  const bars = buildFormatCards([
    section('Any', ['currency_format', 'y_axis_title']),
  ]);
  expect(bars.map(card => card.id)).toEqual(['y-axis']);
});

test('a section can start a group above one of its controls', () => {
  const cards = buildFormatCards([
    {
      label: 'Series format',
      controlSetRows: [
        [{ name: 'series_line_width', config: { type: 'NumberControl' } }],
        [{ name: 'series_line_type', config: { type: 'SelectControl' } }],
      ],
    },
  ] as never);
  const series = cards.find(card => card.id === 'series');
  expect(series?.items.map(item => item.heading)).toEqual(['Lines', undefined]);
});

test('a control declared twice keeps both, as bars do for each orientation', () => {
  const horizontal = () => false;
  const vertical = () => true;
  const cards = buildFormatCards([
    {
      label: 'Chart',
      controlSetRows: [
        [{ name: 'y_axis_title', config: { visibility: horizontal } }],
        [{ name: 'y_axis_title', config: { visibility: vertical } }],
      ],
    },
  ] as never);
  const [item] = cards.find(card => card.id === 'y-axis')?.items ?? [];
  expect(item.config?.visibility).toBe(horizontal);
  expect(item.alternatives?.[0].config?.visibility).toBe(vertical);
});
