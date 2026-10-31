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
  VizType,
  type QueryFormColumn,
  type QueryFormData,
} from '@superset-ui/core';
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

const ADAPTERS: Partial<Record<string, SortAdapter>> = {
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
