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
import { t } from '@apache-superset/core/translation';
import type { HelpIllustrationKind } from './illustrations';

/**
 * Which drawing explains which control. Keys are the control names used by the
 * chart editor, so any chart that reuses a control gets its drawing for free.
 */
const BY_CONTROL: Record<string, HelpIllustrationKind> = {
  // Legend
  show_legend: 'legend',
  legendType: 'legend',
  legendOrientation: 'legend',
  legendMargin: 'legend',
  legend_align: 'legendAlign',
  legend_icon: 'legendMarker',
  legend_font: 'font',
  legendSort: 'legendSort',

  // Data labels
  show_value: 'dataLabels',
  show_labels: 'dataLabels',
  show_total: 'dataLabels',
  only_total: 'dataLabels',
  value_label_font: 'font',
  value_label_background: 'labelBackground',
  value_label_rotate: 'labelRotate',
  value_label_format: 'labelFormat',
  number_format: 'labelFormat',
  y_axis_format: 'labelFormat',
  x_axis_number_format: 'labelFormat',

  // Axes
  x_axis_label_font: 'axisLabels',
  y_axis_label_font: 'axisLabels',
  y_axis_secondary_label_font: 'axisLabels',
  x_axis_title_font: 'axisTitle',
  y_axis_title_font: 'axisTitle',
  y_axis_secondary_title_font: 'axisTitle',
  x_axis_title: 'axisTitle',
  y_axis_title: 'axisTitle',
  x_axis_title_margin: 'axisTitleMargin',
  y_axis_title_margin: 'axisTitleMargin',
  y_axis_title_position: 'axisTitleMargin',
  x_axis_inverse: 'axisInverse',
  y_axis_inverse: 'axisInverse',
  y_axis_bounds: 'axisBounds',
  xAxisBounds: 'axisBounds',
  xAxisLabelRotation: 'axisRotation',
  xAxisLabelInterval: 'axisLabels',
  x_axis_time_format: 'axisLabels',
  logAxis: 'axisLog',
  truncateYAxis: 'axisTruncate',
  truncateXAxis: 'axisTruncate',
  minorTicks: 'gridStyle',
  minorSplitLine: 'gridStyle',

  // Gridlines
  gridline_color: 'gridColor',
  gridline_width: 'gridWidth',
  gridline_style: 'gridStyle',

  // Series
  series_colors: 'seriesColors',
  series_line_width: 'lineWidth',
  series_line_style: 'gridStyle',
  markerEnabled: 'markers',
  markerSize: 'markers',
  series_marker: 'markers',
  bar_category_gap: 'barGap',
  bar_radius: 'barRadius',
  bar_border_width: 'barBorder',
  bar_border_color: 'barBorder',
  stack: 'stack',
  area: 'area',
  color_by_primary_axis: 'colorBy',
  chart_conditional_formatting: 'conditional',

  // Tooltip
  rich_tooltip: 'tooltip',
  tooltipTimeFormat: 'tooltip',
  tooltipValuesFormat: 'tooltip',
  tooltipSortByMetric: 'sort',
  showTooltipTotal: 'tooltip',
  showTooltipPercentage: 'tooltip',

  // Pie
  donut: 'donut',
  innerRadius: 'donut',
  roseType: 'rose',
  labels_outside: 'pieLabels',
  label_line: 'pieLabels',
  label_type: 'pieLabels',
  label_template: 'pieLabels',

  // Sorting and interaction
  sort_series_type: 'sort',
  sort_series_ascending: 'sort',
  sort_by_metric: 'sort',
  show_extra_controls: 'zoom',
  zoomable: 'zoom',
};

/** Matches names like `x_axis_label_font` that are not listed one by one. */
const BY_PATTERN: [RegExp, HelpIllustrationKind][] = [
  [/(^|_)font$/, 'font'],
  [/legend/i, 'legend'],
  [/grid/i, 'gridStyle'],
];

export const helpIllustrationFor = (
  controlName?: string,
): HelpIllustrationKind | undefined => {
  if (!controlName) return undefined;
  const exact = BY_CONTROL[controlName];
  if (exact) return exact;
  return BY_PATTERN.find(([pattern]) => pattern.test(controlName))?.[1];
};

/** Drawings for the Format sections of the chart editor, found by their label. */
export const helpIllustrationForSection = (
  label: unknown,
): HelpIllustrationKind | undefined => {
  const byLabel: [string, HelpIllustrationKind][] = [
    [t('Data labels format'), 'dataLabels'],
    [t('Legend format'), 'legend'],
    [t('Axes & gridlines format'), 'axisLabels'],
    [t('Series format'), 'seriesColors'],
    [t('Conditional formatting'), 'conditional'],
    [t('Chart Options'), 'colorBy'],
  ];
  return byLabel.find(([text]) => text === label)?.[1];
};

/** What a control does, for those that come without a description of their own. */
export const helpDescriptionFor = (
  controlName?: string,
): string | undefined => {
  switch (controlName) {
    case 'legendMargin':
      return t('Space between the legend and the edge of the chart.');
    case 'legendOrientation':
      return t('Places the legend at the top, bottom, left or right.');
    case 'legendType':
      return t('A scrolling legend keeps long lists on one line.');
    case 'y_axis_title_position':
    case 'tooltipTimeFormat':
    case 'tooltipValuesFormat':
    case 'showTooltipTotal':
    case 'showTooltipPercentage':
    case 'x_axis_time_format':
    case 'xAxisLabelInterval':
    case 'minorTicks':
    case 'minorSplitLine':
    case 'series_line_style':
      return undefined;
    default:
      break;
  }
  switch (helpIllustrationFor(controlName)) {
    case 'legend':
      return t('Shows which color or marker belongs to each series.');
    case 'legendAlign':
      return t('Where the legend sits along its edge.');
    case 'legendMarker':
      return t('Shape of the marker next to each legend entry.');
    case 'legendSort':
      return t('Order of the entries in the legend.');
    case 'dataLabels':
      return t('Shows the value on each bar, point or slice.');
    case 'labelRotate':
      return t('Tilts the text of the data labels.');
    case 'labelFormat':
      return t('How numbers are written: units, decimals and separators.');
    case 'labelBackground':
      return t('Draws a colored pill behind each data label.');
    case 'font':
      return t('Font family, size, weight and color of this text.');
    case 'axisLabels':
      return t('Style and format of the values along the axis.');
    case 'axisTitle':
      return t('Name of the axis, written next to it.');
    case 'axisTitleMargin':
      return t('Distance between the axis title and the axis.');
    case 'axisInverse':
      return t('Flips the direction of the axis.');
    case 'axisBounds':
      return t('Lowest and highest values shown on the axis.');
    case 'axisRotation':
      return t('Tilts the axis labels so long names fit.');
    case 'axisLog':
      return t(
        'Uses a logarithmic scale, where each step multiplies the value.',
      );
    case 'axisTruncate':
      return t('Starts the axis near the data instead of at zero.');
    case 'gridColor':
      return t('Color of the guide lines behind the chart.');
    case 'gridWidth':
      return t('Thickness of the guide lines behind the chart.');
    case 'gridStyle':
      return t('Solid, dashed or dotted guide lines.');
    case 'seriesColors':
      return t('Color of each series of the chart.');
    case 'lineWidth':
      return t('Thickness of the lines.');
    case 'markers':
      return t('Dots drawn on each data point of a line.');
    case 'barGap':
      return t('Space between neighboring bars.');
    case 'barRadius':
      return t('Rounds the ends of the bars.');
    case 'barBorder':
      return t('Outline drawn around each bar.');
    case 'stack':
      return t(
        'Stacks the series on top of each other instead of side by side.',
      );
    case 'area':
      return t('Fills the space under the line.');
    case 'conditional':
      return t(
        'Colors the values that meet a rule, like greater than a number.',
      );
    case 'tooltip':
      return t('The card that appears when you point at the chart.');
    case 'donut':
      return t('Opens a hole in the center of the pie.');
    case 'rose':
      return t('Slices share the angle and differ in radius.');
    case 'pieLabels':
      return t('Where and how each slice is named.');
    case 'sort':
      return t('Order in which series or values are shown.');
    case 'zoom':
      return t('Lets viewers zoom into a range of the chart.');
    case 'colorBy':
      return t('Gives each category its own color.');
    default:
      return undefined;
  }
};
