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
import type { VisualFormat } from './types';

type ChartFormat = NonNullable<VisualFormat['chart']>;

/**
 * Settings that make sense for one chart only, because they name its series,
 * talk about its data or change what kind of chart it is: copying a format or
 * sharing a style leaves them out.
 */
export const OWN_CHART_SETTINGS = [
  'special_category_colors',
  'card_label_text',
  'kpi_target_value',
  'goal_metric',
  'gauge_target_metric',
  'kpi_goal_label',
  'kpi_distance_label',
  'kpi_neutral_band',
  'center_label',
  'center_image',
  'gauge_target_value',
  'gauge_target_label',
  'gauge_value_label',
  'scatter_ratio_label',
  'series_colors',
  'series_format',
  'category_colors',
  'legend_title',
  'x_axis_title',
  'x_axis_label',
  'y_axis_title',
  'y_axis_label',
  'yAxisTitleSecondary',
  'increase_label',
  'decrease_label',
  'total_label',
  'waterfall_other_label',
  'label_template',
  'chart_conditional_formatting',
  'conditional_formatting',
  'table_conditional_icons',
  'column_config',
  'metricsLayout',
  'transposePivot',
  'combineMetric',
  'table_sparkline_columns',
  'table_row_subtotal_levels',
  'table_column_subtotal_levels',
  'table_total_label',
  'table_alt_text_column',
  'table_row_reference_column',
  'table_row_subtotal_label',
  'table_column_subtotal_label',
  'echart_options',
  'orientation',
  'stack',
  'stackDimension',
  'only_total',
  'percentage_threshold',
  'seriesType',
  'area',
  'markerEnabled',
  'roseType',
  'donut',
  'innerRadius',
  'outerRadius',
  'y_axis_bounds',
  'zoom_value_min',
  'zoom_value_max',
  'zoom_secondary_min',
  'zoom_secondary_max',
  'y_axis_bounds_secondary',
  'xAxisBounds',
  'logAxis',
  'logAxisSecondary',
];

const pickChart = (
  format: ChartFormat | undefined,
  keep: (name: string) => boolean,
): ChartFormat | undefined => {
  if (!format) return undefined;
  const entries = Object.entries(format).filter(([name]) => keep(name));
  return entries.length ? Object.fromEntries(entries) : undefined;
};

/** The settings of a chart another chart can take. */
export const sharableChartFormat = (format: ChartFormat | undefined) =>
  pickChart(format, name => !OWN_CHART_SETTINGS.includes(name));

/** The settings a chart keeps when it takes the format of another. */
export const ownChartFormat = (format: ChartFormat | undefined) =>
  pickChart(format, name => OWN_CHART_SETTINGS.includes(name));

/**
 * A format as another object can take it: without what says something about one
 * chart, like its subtitle, its alt text or where its action leads.
 */
export function sharableFormat(
  format: VisualFormat | undefined,
): VisualFormat | undefined {
  if (!format) return format;
  const { chart, link: _link, actionButton: _actionButton, ...rest } = format;
  const sharable = sharableChartFormat(chart);
  const shared: VisualFormat = {
    ...rest,
    ...(sharable && { chart: sharable }),
  };
  if (shared.title?.subtitle !== undefined) {
    const { subtitle: _subtitle, ...title } = shared.title;
    shared.title = title;
  }
  if (shared.header?.tooltip?.text !== undefined) {
    const { text: _text, ...tooltip } = shared.header.tooltip;
    shared.header = { ...shared.header, tooltip };
  }
  return shared;
}

/** What a chart keeps of its own format when it takes that of another. */
export function ownFormat(
  format: VisualFormat | undefined,
): VisualFormat | undefined {
  const chart = ownChartFormat(format?.chart);
  const text = format?.header?.tooltip?.text;
  const kept: VisualFormat = {
    ...(format?.title?.subtitle && {
      title: { subtitle: format.title.subtitle },
    }),
    ...(text && { header: { tooltip: { text } } }),
    ...(format?.link && { link: format.link }),
    ...(format?.actionButton && { actionButton: format.actionButton }),
    ...(chart && { chart }),
  };
  return Object.keys(kept).length ? kept : undefined;
}

/** A shared format with what a chart keeps of its own on top. */
export function withOwnFormat(
  shared: VisualFormat | undefined,
  own: VisualFormat | undefined,
): VisualFormat | undefined {
  if (!own) return shared;
  return {
    ...shared,
    ...own,
    ...(own.title && { title: { ...shared?.title, ...own.title } }),
    ...(own.header && {
      header: {
        ...shared?.header,
        ...own.header,
        tooltip: { ...shared?.header?.tooltip, ...own.header.tooltip },
      },
    }),
    ...(own.chart && { chart: { ...shared?.chart, ...own.chart } }),
  };
}
