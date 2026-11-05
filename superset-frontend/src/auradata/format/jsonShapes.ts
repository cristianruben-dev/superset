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
import { FONT_FAMILY_OPTIONS, type FontStyleValue } from '@superset-ui/core';
import {
  bool,
  color,
  fontSize,
  num,
  percent,
  px,
  text,
  type Described,
  type FieldSpec,
} from './generalFormat';

/**
 * The shape of the value the most used `json` controls of the Format pane
 * save, by control component, so a tool that formats a chart without the pane
 * knows what to send. Colors also take `{r, g, b, a}`.
 */
export interface JsonShape {
  value: FieldSpec;
  note?: string;
}

const enumOf = (...values: string[]) => ({ type: 'enum', values }) as const;
const lineStyle = enumOf('solid', 'dashed', 'dotted');

const font: Described<FontStyleValue> = {
  fontFamily: {
    type: 'enum',
    values: FONT_FAMILY_OPTIONS.map(([value]) => value),
  },
  fontSize,
  bold: bool,
  italic: bool,
  color,
};

/** Options of one series over those of the chart (`SeriesFormatControl`). */
const seriesOptions: Record<string, FieldSpec> = {
  showLabels: bool,
  labelColor: color,
  barTransparency: percent,
  lineWidth: { type: 'number', min: 1, max: 10 },
  lineType: lineStyle,
  lineInterpolation: enumOf(
    'linear',
    'smooth',
    'monotone',
    'start',
    'middle',
    'end',
  ),
  lineTransparency: percent,
  axis: enumOf('primary', 'secondary'),
  markerEnabled: bool,
  markerSymbol: enumOf('circle', 'rect', 'triangle', 'diamond'),
  markerSize: { type: 'number', min: 0, max: 100 },
};

/** A reference line of the Analytics level (`ReferenceLine` of analyticsFormat). */
const referenceLine: Record<string, FieldSpec> = {
  id: text,
  show: bool,
  kind: enumOf('constant', 'min', 'max', 'average', 'median', 'percentile'),
  axis: enumOf('value', 'category'),
  value: num,
  percentile: { type: 'number', min: 0, max: 100 },
  series: text,
  name: text,
  color,
  width: px,
  style: lineStyle,
  dash: text,
  cap: enumOf('butt', 'round', 'square'),
  transparency: percent,
  behind: bool,
  label: bool,
  labelText: text,
  labelColor: color,
  labelPosition: enumOf('start', 'middle', 'end'),
  labelAbove: bool,
  labelUnits: text,
  labelDecimals: { type: 'number', min: 0, integer: true },
  shade: enumOf('none', 'before', 'after'),
  shadeColor: color,
  shadeTransparency: percent,
};

export const JSON_SHAPES: Record<string, JsonShape> = {
  FontControl: {
    value: { type: 'object', fields: font },
    note: 'Empty properties inherit from the theme or the element.',
  },
  SeriesColorsControl: {
    value: { type: 'map', keys: 'series or category name', values: color },
  },
  SeriesFormatControl: {
    value: {
      type: 'map',
      keys: 'series name',
      values: { type: 'object', fields: seriesOptions },
    },
    note: 'Only what differs from the chart; axis "secondary" moves a line, area or step series to a second Y axis.',
  },
  ReferenceLinesControl: {
    value: { type: 'array', items: { type: 'object', fields: referenceLine } },
    note: 'value is a number, or a date for axis "category"; kind other than constant is calculated from series (all when empty).',
  },
  BoundsControl: {
    value: { type: 'array', items: num, length: 2 },
    note: '[min, max]; null leaves a bound to the data.',
  },
};
