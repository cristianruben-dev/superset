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
  getNumberFormatter,
  VizType,
  type AdhocMetric,
  type QueryData,
  type QueryFormData,
  type QueryFormMetric,
} from '@superset-ui/core';
import { adhocFilter, figureSource } from './figure';
import type {
  ArtifactBlock,
  ArtifactQuery,
  DataBlock,
  FigureFilter,
  FigureFormat,
} from './types';

const VIZ_OF = {
  bar: VizType.Bar,
  line: VizType.Line,
  area: VizType.Area,
  pie: VizType.Pie,
};

const NUMBER_FORMATS: Record<FigureFormat, string> = {
  number: ',.0f',
  compact: '.3~s',
  percent: ',.1%',
  currency: '$,.2f',
};

const DEFAULT_ROW_LIMIT = 30;

/** An aggregate over a column, as the server names it when it reads the query. */
const aggregateMetric = (column: string, aggregate: string) =>
  ({
    expressionType: 'SIMPLE',
    column: { column_name: column },
    aggregate,
    label: `${aggregate}(${column})`,
  }) as AdhocMetric;

/** The numbers a query asks for, saved metrics and aggregates alike. */
export const metricsOf = ({
  metrics = [],
  aggregates = [],
}: ArtifactQuery): QueryFormMetric[] => [
  ...metrics,
  ...aggregates.map(({ column, aggregate }) =>
    aggregateMetric(column, aggregate),
  ),
];

const filtersOf = (query: ArtifactQuery): FigureFilter[] => [
  ...(query.filters ?? []),
  ...(query.time_range && query.time_column
    ? [
        {
          col: query.time_column,
          op: 'TEMPORAL_RANGE',
          val: query.time_range,
        },
      ]
    : []),
];

const labelOf = (metric: QueryFormMetric) =>
  typeof metric === 'string' ? metric : metric.label;

/** What a query sorts by, as a form data takes it. */
function sortOf(query: ArtifactQuery) {
  const [name] = query.order_by ?? [];
  if (!name) return {};
  const metric = metricsOf(query).find(item => labelOf(item) === name);
  return { sort: metric ?? name, name };
}

/**
 * The query of a block as a chart of the normal API, which decides whether this person
 * reaches its dataset. It only uses what the server held against the dataset, and
 * nothing here is saved: the numbers stay in this page.
 */
export function blockFormData(
  block: DataBlock,
  dashboardId: number,
): QueryFormData {
  const { query } = block;
  const metrics = metricsOf(query);
  const columns = query.columns ?? [];
  const { sort, name } = sortOf(query);
  const common = {
    datasource: `${query.dataset_id}__table`,
    adhoc_filters: filtersOf(query).map(adhocFilter),
    row_limit: query.row_limit ?? DEFAULT_ROW_LIMIT,
    order_desc: query.order_desc ?? true,
    dashboardId,
  };
  if (block.type === 'chart' && block.chart === 'pie') {
    return {
      ...common,
      viz_type: VizType.Pie,
      groupby: columns,
      metric: metrics[0],
      show_labels: true,
      show_legend: true,
      label_type: 'key_percent',
      sort_by_metric: true,
      ...(name && {
        auradata_sort_by: name,
        auradata_sort_asc: !(query.order_desc ?? true),
      }),
    };
  }
  if (block.type === 'chart') {
    const [axis, series] = columns;
    return {
      ...common,
      viz_type: VIZ_OF[block.chart],
      x_axis: axis,
      metrics,
      groupby: series ? [series] : [],
      show_legend: metrics.length > 1 || !!series,
      rich_tooltip: true,
      ...(sort && {
        series_limit_metric: sort,
        x_axis_sort: name,
        x_axis_sort_asc: !(query.order_desc ?? true),
      }),
    };
  }
  // A figure and a table only read rows: the panel draws them itself
  if (metrics.length) {
    return {
      ...common,
      viz_type: VizType.Table,
      query_mode: 'aggregate',
      groupby: columns,
      metrics,
      ...(sort && { timeseries_limit_metric: sort }),
    };
  }
  return {
    ...common,
    viz_type: VizType.Table,
    query_mode: 'raw',
    all_columns: columns,
    ...(name && {
      order_by_cols: [JSON.stringify([name, !(query.order_desc ?? true)])],
    }),
  };
}

/** The rows a query gave back. */
export const rowsOf = (data: QueryData[]) =>
  (data[0]?.data ?? []) as Record<string, unknown>[];

/** The number of a figure block, as the block asks to read it. */
export function figureValue(
  rows: Record<string, unknown>[],
  format: FigureFormat = 'number',
): string {
  const value = Object.values(rows[0] ?? {})[0];
  if (value === null || value === undefined) return '–';
  return typeof value === 'number'
    ? getNumberFormatter(NUMBER_FORMATS[format])(value)
    : String(value);
}

/** Which dataset and filters a block reads, in one line. */
export const blockSource = (block: DataBlock, datasetName: string) =>
  figureSource({
    dataset_name: datasetName,
    filters: filtersOf(block.query),
  });

/**
 * The date of the oldest text of a document: its numbers are read on opening, and that
 * text says what they were then.
 */
export function oldestText(blocks: ArtifactBlock[]): string | null {
  const dates = blocks.flatMap(block =>
    block.type === 'text' ? [block.written_on] : [],
  );
  return dates.length ? [...dates].sort()[0] : null;
}

/** Figures that follow each other read as one row. */
export function grouped(blocks: ArtifactBlock[]): ArtifactBlock[][] {
  const groups: ArtifactBlock[][] = [];
  blocks.forEach(block => {
    const last = groups[groups.length - 1];
    if (block.type === 'figure' && last?.[0].type === 'figure') {
      last.push(block);
    } else {
      groups.push([block]);
    }
  });
  return groups;
}
