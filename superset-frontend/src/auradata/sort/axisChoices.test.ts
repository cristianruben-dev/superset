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
import { DatasourceType, type QueryFormData } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  xAxisSortControl,
  type ControlPanelState,
  type ControlState,
  type Dataset,
} from '@superset-ui/chart-controls';
import { isSortableAxis, xAxisSortChoices } from './axisChoices';

const dataset = {
  id: 1,
  type: DatasourceType.Table,
  columns: [
    { column_name: 'country', type_generic: GenericDataType.String },
    { column_name: 'active', type_generic: GenericDataType.Boolean },
    { column_name: 'year', type_generic: GenericDataType.Numeric },
    {
      column_name: 'ds',
      type_generic: GenericDataType.Temporal,
      is_dttm: true,
    },
  ],
  metrics: [],
  column_formats: {},
  verbose_map: { country: 'País', 'SUM(sales)': 'Ventas' },
  main_dttm_col: 'ds',
  datasource_name: 'sales',
  description: null,
} as unknown as Dataset;

const formData = (extra: Partial<QueryFormData> = {}): QueryFormData => ({
  datasource: '1__table',
  viz_type: 'echarts_timeseries_bar',
  x_axis: 'country',
  metrics: ['SUM(sales)'],
  groupby: [],
  ...extra,
});

/** Options the chart editor's X-axis sort control shows for the same chart. */
const editorOptions = (fd: QueryFormData) => {
  const state = {
    controls: {
      x_axis: { value: fd.x_axis },
      groupby: { value: fd.groupby },
      metrics: { value: fd.metrics },
      timeseries_limit_metric: { value: fd.timeseries_limit_metric },
      datasource: { datasource: dataset },
    },
    datasource: dataset,
    form_data: fd,
  } as unknown as ControlPanelState;
  const { options } = xAxisSortControl.config.mapStateToProps(state, {
    value: undefined,
  } as ControlState);
  return options;
};

test('string and boolean axes can be sorted', () => {
  expect(isSortableAxis(formData(), dataset)).toBe(true);
  expect(isSortableAxis(formData({ x_axis: 'active' }), dataset)).toBe(true);
});

test('time and plain numeric axes cannot be sorted', () => {
  expect(isSortableAxis(formData({ x_axis: 'ds' }), dataset)).toBe(false);
  expect(isSortableAxis(formData({ x_axis: 'year' }), dataset)).toBe(false);
  expect(xAxisSortChoices(formData({ x_axis: 'ds' }), dataset)).toEqual([]);
});

test('a numeric axis forced to categories can be sorted', () => {
  expect(
    isSortableAxis(
      formData({ x_axis: 'year', xAxisForceCategorical: true }),
      dataset,
    ),
  ).toBe(true);
});

test('a custom SQL axis can be sorted, a chart without axis cannot', () => {
  const sqlAxis = {
    expressionType: 'SQL',
    label: 'region',
    sqlExpression: 'UPPER(region)',
  };
  expect(isSortableAxis(formData({ x_axis: sqlAxis }), dataset)).toBe(true);
  expect(isSortableAxis(formData({ x_axis: undefined }), dataset)).toBe(false);
});

test('without a dataset only custom SQL axes can be sorted', () => {
  expect(isSortableAxis(formData())).toBe(false);
  expect(xAxisSortChoices(formData())).toEqual([]);
});

test('a single series sorts by the axis or a metric, with verbose names', () => {
  expect(
    xAxisSortChoices(
      formData({ timeseries_limit_metric: 'COUNT(*)' }),
      dataset,
    ),
  ).toEqual([
    { value: 'country', label: 'País' },
    { value: 'SUM(sales)', label: 'Ventas' },
    { value: 'COUNT(*)', label: 'COUNT(*)' },
  ]);
});

test('dimensions sort by an aggregate of the series', () => {
  expect(
    xAxisSortChoices(formData({ groupby: ['region'] }), dataset).map(
      choice => choice.value,
    ),
  ).toEqual(['name', 'sum', 'min', 'max', 'avg']);
});

test.each([
  ['a single series', formData({ timeseries_limit_metric: 'COUNT(*)' })],
  ['two metrics', formData({ metrics: ['SUM(sales)', 'COUNT(*)'] })],
  ['a dimension', formData({ groupby: ['region'] })],
  [
    'the same metric twice',
    formData({ timeseries_limit_metric: 'SUM(sales)' }),
  ],
])('matches the chart editor with %s', (_, fd) => {
  expect(xAxisSortChoices(fd, dataset)).toEqual(editorOptions(fd));
});
