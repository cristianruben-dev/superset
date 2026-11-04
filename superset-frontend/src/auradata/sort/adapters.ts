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
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
  QueryMode,
  VizType,
  type QueryFormColumn,
  type QueryFormData,
  type QueryFormMetric,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { DEFAULT_XAXIS_SORT_SERIES_DATA } from '@superset-ui/chart-controls';
import { xAxisSortChoices } from './axisChoices';
import type { SortAdapter } from './types';

/**
 * Whether the stored axis order runs against the reading order. A category
 * axis lists its values in data order, left to right; on a horizontal chart
 * it becomes the vertical axis, which ECharts draws from the bottom up, and
 * "Reverse X axis" flips either one.
 */
const runsAgainstReading = (formData: QueryFormData) =>
  (formData.orientation === 'horizontal') !== !!formData.x_axis_inverse;

/** Bar, line, area, step, scatter and smooth line charts: `x_axis_sort`. */
const categoryAxisAdapter: SortAdapter = {
  options: (formData, datasource) => {
    const choices = xAxisSortChoices(formData, datasource);
    return choices.length ? choices : null;
  },
  current: formData => {
    const by = formData.x_axis_sort;
    if (typeof by !== 'string' || !by) return undefined;
    const stored =
      formData.x_axis_sort_asc ??
      DEFAULT_XAXIS_SORT_SERIES_DATA.sort_series_ascending;
    return {
      by,
      ascending: runsAgainstReading(formData) ? !stored : !!stored,
    };
  },
  toFormData: ({ by, ascending }, formData) => ({
    x_axis_sort: by,
    x_axis_sort_asc: runsAgainstReading(formData) ? !ascending : ascending,
  }),
};

/**
 * Pie and funnel charts: `mibi_sort_by` and `mibi_sort_asc`. Their categories
 * read in data order (clockwise from the top, or top down), so ascending is
 * stored as is. A chart without its own sort shows the "Sort by metric" one.
 */
const categoryAdapter: SortAdapter = {
  options: (formData, datasource) => {
    // As the chart's own "Sort by" control: the metric, then the dimensions
    const labels = [
      ...(formData.metric ? [getMetricLabel(formData.metric)] : []),
      ...ensureIsArray(formData.groupby as QueryFormColumn[]).map(
        getColumnLabel,
      ),
    ];
    return labels.length
      ? labels.map(value => ({
          value,
          label: datasource?.verbose_map?.[value] || value,
        }))
      : null;
  },
  current: formData => {
    if (formData.mibi_sort_by) {
      return { by: formData.mibi_sort_by, ascending: !!formData.mibi_sort_asc };
    }
    // The chart editor checks "Sort by metric" by default
    return formData.metric && formData.sort_by_metric !== false
      ? { by: getMetricLabel(formData.metric), ascending: false }
      : undefined;
  },
  toFormData: ({ by, ascending }) => ({
    mibi_sort_by: by,
    mibi_sort_asc: ascending,
  }),
};

/** Raw records or aggregated, as the table chart decides it. */
const isRawTable = (formData: QueryFormData) =>
  formData.query_mode === QueryMode.Raw ||
  (formData.query_mode !== QueryMode.Aggregate &&
    ensureIsArray(formData.all_columns).length > 0);

const metricLabels = (formData: QueryFormData) =>
  ensureIsArray(formData.metrics as QueryFormMetric[]).map(getMetricLabel);

/**
 * Tables: `mibi_table_sort`, which sorts the query by a column or a metric.
 * Viewers can still re-sort what they see by clicking a header.
 */
const tableAdapter: SortAdapter = {
  options: (formData, datasource) => {
    const labels = isRawTable(formData)
      ? ensureIsArray(formData.all_columns as QueryFormColumn[]).map(
          getColumnLabel,
        )
      : [
          ...ensureIsArray(formData.groupby as QueryFormColumn[]).map(
            getColumnLabel,
          ),
          ...metricLabels(formData),
        ];
    return labels.length
      ? labels.map(value => ({
          value,
          label: datasource?.verbose_map?.[value] || value,
        }))
      : null;
  },
  current: formData => {
    const [saved] = ensureIsArray(formData.mibi_table_sort);
    if (saved?.key) return { by: saved.key, ascending: !saved.desc };
    if (isRawTable(formData)) return undefined;
    // Without a sort of its own, a table sorts by its "Sort by" metric, or
    // by its first metric descending
    const [sortMetric] = ensureIsArray(formData.timeseries_limit_metric);
    if (sortMetric) {
      return {
        by: getMetricLabel(sortMetric),
        ascending: formData.order_desc === false,
      };
    }
    const [first] = metricLabels(formData);
    return first ? { by: first, ascending: false } : undefined;
  },
  toFormData: ({ by, ascending }) => ({
    mibi_table_sort: [{ key: by, desc: !ascending }],
  }),
};

const PIVOT_ROW_ORDERS: Record<string, string> = {
  'key:asc': 'key_a_to_z',
  'key:desc': 'key_z_to_a',
  'value:asc': 'value_a_to_z',
  'value:desc': 'value_z_to_a',
};

/** Pivot tables: `rowOrder`, by the row labels or by the values. */
const pivotTableAdapter: SortAdapter = {
  options: () => [
    { value: 'key', label: t('Row labels') },
    { value: 'value', label: t('Value') },
  ],
  current: formData => {
    const order = formData.rowOrder || 'key_a_to_z';
    const entry = Object.entries(PIVOT_ROW_ORDERS).find(
      ([, value]) => value === order,
    );
    if (!entry) return undefined;
    const [by, direction] = entry[0].split(':');
    return { by, ascending: direction === 'asc' };
  },
  toFormData: ({ by, ascending }) => ({
    rowOrder: PIVOT_ROW_ORDERS[`${by}:${ascending ? 'asc' : 'desc'}`],
  }),
};

const ADAPTERS: Partial<Record<string, SortAdapter>> = {
  [VizType.Table]: tableAdapter,
  [VizType.PivotTable]: pivotTableAdapter,
  [VizType.Pie]: categoryAdapter,
  [VizType.Funnel]: categoryAdapter,
  [VizType.Bar]: categoryAxisAdapter,
  [VizType.Line]: categoryAxisAdapter,
  [VizType.Area]: categoryAxisAdapter,
  [VizType.Step]: categoryAxisAdapter,
  [VizType.Scatter]: categoryAxisAdapter,
  [VizType.SmoothLine]: categoryAxisAdapter,
};

/** The sort adapter of a chart type, if visuals of that type can be sorted. */
export const sortAdapterFor = (vizType?: string): SortAdapter | undefined =>
  vizType ? ADAPTERS[vizType] : undefined;
