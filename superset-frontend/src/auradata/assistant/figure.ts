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
  VizType,
  type QueryFormData,
  type SimpleAdhocFilter,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { Figure, FigureFilter } from './types';

/** More rows than this read better as a table. */
const MAX_CHART_ROWS = 30;
const MAX_CHART_METRICS = 2;
/** From here a number on an axis is a date in milliseconds. */
const EPOCH_MS_FROM = 1e11;

const looksLikeDate = (value: unknown) =>
  typeof value === 'string'
    ? /^\d{4}-\d{2}-\d{2}/.test(value)
    : typeof value === 'number' && value >= EPOCH_MS_FROM;

const adhocFilter = ({ col, op, val }: FigureFilter) =>
  ({
    expressionType: 'SIMPLE',
    clause: 'WHERE',
    subject: col,
    operator: op,
    comparator: val,
  }) as SimpleAdhocFilter;

/**
 * The query of a figure as a chart, or null when its shape reads better as a table.
 * It repeats what ran through the normal chart data API, so that API decides whether
 * this user reaches the dataset. A query its limit cut, as a top five, stays a table:
 * without its order and limit the chart would show other rows. Nothing here is saved.
 */
export function chartFormData(
  figure: Figure,
  dashboardId: number,
): QueryFormData | null {
  const { metrics, columns, row_count: rows } = figure;
  const common = {
    datasource: `${figure.dataset_id}__table`,
    adhoc_filters: figure.filters.map(adhocFilter),
    row_limit: MAX_CHART_ROWS,
    dashboardId,
  };
  if (columns.length === 0 && metrics.length === 1 && rows === 1) {
    return {
      ...common,
      viz_type: VizType.BigNumberTotal,
      metric: metrics[0],
      header_font_size: 0.3,
      subheader_font_size: 0.125,
    };
  }
  if (
    columns.length !== 1 ||
    metrics.length < 1 ||
    metrics.length > MAX_CHART_METRICS ||
    rows < 2 ||
    rows > MAX_CHART_ROWS ||
    rows >= figure.row_limit
  ) {
    return null;
  }
  const [axis] = columns;
  return {
    ...common,
    viz_type: looksLikeDate(figure.rows[0]?.[axis])
      ? VizType.Line
      : VizType.Bar,
    x_axis: axis,
    metrics,
    show_legend: metrics.length > 1,
    rich_tooltip: true,
  };
}

const valueText = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : String(value);

const filterText = ({ col, op, val }: FigureFilter) => {
  if (op === 'TEMPORAL_RANGE') return `${col}: ${valueText(val)}`;
  return val === undefined || val === null
    ? `${col} ${op}`
    : `${col} ${op} ${valueText(val)}`;
};

/** Which dataset and filters a figure comes from, in one line. */
export function figureSource(figure: Figure): string {
  const dataset = t('Dataset: %s', figure.dataset_name);
  return figure.filters.length
    ? `${dataset} · ${figure.filters.map(filterText).join(' · ')}`
    : `${dataset} · ${t('no filters')}`;
}

const TSV_BREAKS = /[\t\r\n]+/g;
/** A spreadsheet runs a pasted cell that starts like this as a formula. */
const FORMULA_START = /^[=+\-@]/;

const tsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  const text = String(value).replace(TSV_BREAKS, ' ');
  return FORMULA_START.test(text) ? `'${text}` : text;
};

/**
 * The rows of a figure, separated by tabs so they paste as a table. Numbers stay as
 * they came, without the separators of a language. Nothing when it has no rows.
 */
export function figureAsText(figure: Figure): string {
  const columns = Object.keys(figure.rows[0] ?? {});
  if (!columns.length) return '';
  const lines = [
    columns.map(tsvCell),
    ...figure.rows.map(row => columns.map(column => tsvCell(row[column]))),
  ].map(cells => cells.join('\t'));
  if (figure.row_count > figure.rows.length) {
    lines.push(
      t('Showing %s of %s rows.', figure.rows.length, figure.row_count),
    );
  }
  return lines.join('\n');
}
