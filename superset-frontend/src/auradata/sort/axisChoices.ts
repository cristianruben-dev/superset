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
  isPhysicalColumn,
  type QueryFormColumn,
  type QueryFormData,
  type QueryFormMetric,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import {
  checkColumnType,
  isTemporalColumn,
  SORT_SERIES_CHOICES,
  type Dataset,
} from '@superset-ui/chart-controls';

/**
 * "Sort axis" choices of a chart, read from its saved form data and its
 * dataset, so the dashboard can offer them outside the chart editor. They
 * follow the X-axis sort control of the chart editor (`xAxisSortControl` and
 * `isSortable` in @superset-ui/chart-controls), which is left untouched.
 */

export interface SortChoice {
  /** Value of `x_axis_sort`: a column or metric label, or a series aggregate */
  value: string;
  label: string;
}

const xAxisOf = (formData: QueryFormData) =>
  formData.x_axis as QueryFormColumn | undefined;

/** Whether the chart's category axis can be sorted (not a time axis). */
export function isSortableAxis(
  formData: QueryFormData,
  datasource?: Dataset,
): boolean {
  const xAxis = xAxisOf(formData);
  if (xAxis === undefined || xAxis === null || xAxis === '') return false;
  // The type of a custom SQL column is unknown, so it is left to the user
  if (!isPhysicalColumn(xAxis)) return true;
  const label = getColumnLabel(xAxis);
  const forcedCategorical =
    !!formData.xAxisForceCategorical &&
    checkColumnType(label, datasource ?? null, [GenericDataType.Numeric]);
  return (
    forcedCategorical ||
    checkColumnType(label, datasource ?? null, [
      GenericDataType.String,
      GenericDataType.Boolean,
    ])
  );
}

/**
 * What the axis can be sorted by. With a single series: the axis itself or
 * one of the metrics. With dimensions or several metrics: an aggregate of the
 * series (name, total, minimum, maximum or average).
 */
export function xAxisSortChoices(
  formData: QueryFormData,
  datasource?: Dataset,
): SortChoice[] {
  if (!isSortableAxis(formData, datasource)) return [];
  const xAxis = xAxisOf(formData) as QueryFormColumn;
  if (isTemporalColumn(getColumnLabel(xAxis), datasource ?? null)) return [];

  const groupby = ensureIsArray(formData.groupby);
  const metrics = ensureIsArray(formData.metrics as QueryFormMetric[]);
  const singleSort = groupby.length === 0;
  const multiSort = groupby.length > 0 || metrics.length > 1;
  const verbose = (value: string) => datasource?.verbose_map?.[value] || value;

  const sortMetrics = [
    ...metrics,
    formData.timeseries_limit_metric as QueryFormMetric | undefined,
  ].filter((metric): metric is QueryFormMetric => !!metric);
  const metricLabels = [...new Set(sortMetrics.map(getMetricLabel))];

  const axisLabel = getColumnLabel(xAxis);
  return [
    ...(singleSort
      ? [axisLabel, ...metricLabels].map(value => ({
          value,
          label: verbose(value),
        }))
      : []),
    ...(multiSort
      ? SORT_SERIES_CHOICES.map(([value, label]) => ({
          value: String(value),
          label: String(label),
        }))
      : []),
  ];
}
