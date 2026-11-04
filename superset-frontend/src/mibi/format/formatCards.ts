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
import type {
  ControlPanelSectionConfig,
  CustomControlItem,
} from '@superset-ui/chart-controls';

/** The control whose switch sits in the heading of a section of the pane. */
export interface CardToggle {
  control: string;
  /** The control says the opposite of the switch, as "Hide legend" does */
  inverted?: boolean;
}

/**
 * A section of the Visual level, in the order and with the names of the Power
 * BI format pane. A chart only shows the controls its control panel declares.
 */
export interface CardDefinition {
  id: string;
  title: () => string;
  toggles?: CardToggle[];
  controls: string[];
  /**
   * Controls that alone do not make the section: a pie has a number format but
   * no axes, so its format goes under "Values".
   */
  softControls?: string[];
  /** A heading above a control, which starts a group of the section */
  headings?: Record<string, () => string>;
  /** The level of the pane it belongs to, other than Visual */
  level?: 'analytics' | 'fields';
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    id: 'layout',
    title: () => t('Layout'),
    controls: [
      'orientation',
      'stack',
      'stackDimension',
      'only_total',
      'percentage_threshold',
      'seriesType',
      'yAxisIndex',
      'roseType',
      'show_query_identifiers',
    ],
  },
  {
    id: 'x-axis',
    title: () => t('X axis'),
    toggles: [{ control: 'x_axis_hidden', inverted: true }],
    controls: [
      'x_axis_title',
      'x_axis_label',
      'x_axis_title_margin',
      'x_axis_title_font',
      'x_axis_label_font',
      'x_axis_time_format',
      'x_axis_number_format',
      'xAxisFormat',
      'xAxisLabelRotation',
      'xAxisLabelInterval',
      'x_ticks_layout',
      'force_max_interval',
      'forceCategorical',
      'x_axis_inverse',
      'x_axis_switch_position',
      'truncateXAxis',
      'xAxisBounds',
      'logXAxis',
      'x_axis_log',
      'show_x_axis',
      'show_x_axis_min_max_labels',
      'x_axis_label_units',
      'x_axis_label_decimals',
      'x_axis_label_max_width',
      'x_axis_min_category_width',
      'x_axis_scroll_position',
      'x_gridlines_show',
      'x_gridline_color',
      'x_gridline_width',
      'x_gridline_style',
      'x_gridline_cap',
      'x_gridline_dash',
    ],
    headings: {
      x_axis_label_units: () => t('Values'),
      x_axis_min_category_width: () => t('Categories'),
      x_gridlines_show: () => t('Gridlines'),
    },
  },
  {
    id: 'y-axis',
    title: () => t('Y axis'),
    toggles: [{ control: 'y_axis_hidden', inverted: true }],
    controls: [
      'y_axis_title',
      'y_axis_label',
      'y_axis_title_margin',
      'y_axis_title_position',
      'y_axis_title_font',
      'y_axis_label_font',
      'y_axis_format',
      'y_axis_label_units',
      'y_axis_label_decimals',
      'currency_format',
      'yAxisLabelRotation',
      'y_axis_inverse',
      'y_axis_switch_position',
      'logAxis',
      'logYAxis',
      'truncateYAxis',
      'y_axis_bounds',
      'minorTicks',
      'show_y_axis',
      'show_y_axis_min_max_labels',
      'start_y_axis_at_zero',
      'y_gridlines_hidden',
      'y_gridline_color',
      'y_gridline_width',
      'y_gridline_style',
      'y_gridline_cap',
      'y_gridline_dash',
    ],
    softControls: ['y_axis_format', 'currency_format'],
    headings: { y_gridlines_hidden: () => t('Gridlines') },
  },
  {
    id: 'values',
    title: () => t('Values'),
    controls: [],
  },
  {
    id: 'y-axis-secondary',
    title: () => t('Secondary Y axis'),
    toggles: [{ control: 'y_axis_secondary_hidden', inverted: true }],
    controls: [
      'yAxisTitleSecondary',
      'y_axis_secondary_title_font',
      'y_axis_secondary_label_font',
      'y_axis_format_secondary',
      'y_axis_secondary_label_units',
      'y_axis_secondary_label_decimals',
      'currency_format_secondary',
      'logAxisSecondary',
      'y_axis_bounds_secondary',
    ],
  },
  {
    id: 'gridlines',
    title: () => t('Gridlines'),
    toggles: [{ control: 'gridlines_hidden', inverted: true }],
    controls: [
      'gridline_color',
      'gridline_width',
      'gridline_style',
      'minorSplitLine',
      'show_split_line',
      'split_number',
      'show_axis_tick',
      'axisTicks',
    ],
  },
  {
    id: 'legend',
    title: () => t('Legend'),
    toggles: [{ control: 'show_legend' }],
    controls: [
      'legendType',
      'legendOrientation',
      'legendMargin',
      'legendSort',
      'legend_align',
      'legend_icon',
      'legend_font',
      'legend_match_color',
      'legend_title',
      'legend_title_font',
    ],
    headings: { legend_title: () => t('Title') },
  },
  {
    id: 'series',
    title: () => t('Colors and series'),
    controls: [
      'color_scheme',
      'series_default_color',
      'series_colors',
      'color_by_primary_axis',
      'category_colors',
      'color_scale_min',
      'color_scale_max',
      'time_shift_color',
      'increase_color',
      'increase_label',
      'decrease_color',
      'decrease_label',
      'total_color',
      'total_label',
      'sort_series_type',
      'sort_series_ascending',
      'bar_category_gap',
      'bar_border_radius',
      'bar_border_color',
      'bar_border_width',
      'bar_border_match_fill',
      'bar_border_only',
      'bar_transparency',
      'bar_overlap',
      'bar_overlap_reverse',
      'series_line_width',
      'series_line_type',
      'line_interpolation',
      'line_smoothness',
      'line_transparency',
      'line_hidden',
      'series_line_cap',
      'series_line_join',
      'series_line_dash',
      'area',
      'opacity',
      'area_color',
      'markerEnabled',
      'markerSize',
      'series_marker_symbol',
      'marker_rotation',
      'marker_color',
      'marker_transparency',
      'marker_border_width',
      'marker_border_match_fill',
      'marker_border_color',
      'max_bubble_size',
      'minMarkerSize',
      'maxMarkerSize',
      'series_format',
    ],
    headings: {
      bar_category_gap: () => t('Bars'),
      series_line_width: () => t('Lines'),
      area: () => t('Area'),
      markerEnabled: () => t('Markers'),
      series_format: () => t('By series'),
    },
  },
  {
    id: 'labels',
    title: () => t('Data labels'),
    toggles: [{ control: 'show_value' }, { control: 'show_labels' }],
    controls: [
      'label_type',
      'label_template',
      'show_total',
      'show_upper_labels',
      'labels_outside',
      'label_line',
      'show_labels_threshold',
      'threshold_for_other',
      'percent_calculation_type',
      'number_format',
      'date_format',
      'value_label_font',
      'value_label_background',
      'value_label_rotate',
      'value_label_format',
      'value_label_units',
      'value_label_decimals',
      'label_position',
      'value_label_position',
      'value_label_align',
      'value_label_distance',
      'value_label_transparency',
      'value_label_max_width',
      'value_label_overflow',
      'value_label_hide_overlap',
      'value_label_density',
      'special_labels_show',
      'special_percent_decimals',
      'special_label_position',
      'special_label_rotation',
      'special_label_max_width',
      'special_label_overflow',
      'value_label_hide_value',
      'value_label_title',
      'value_label_title_font',
      'value_label_detail',
      'value_label_detail_font',
      'value_label_layout',
    ],
    headings: {
      label_position: () => t('Layout'),
      value_label_position: () => t('Layout'),
      value_label_hide_value: () => t('Content'),
    },
  },
  {
    id: 'total-labels',
    title: () => t('Total labels'),
    toggles: [{ control: 'total_labels_show' }],
    controls: [
      'total_label_font',
      'total_label_background',
      'total_label_units',
      'total_label_decimals',
      'total_label_split_sign',
    ],
  },
  {
    id: 'series-labels',
    title: () => t('Series labels'),
    toggles: [{ control: 'series_labels_show' }],
    controls: [
      'series_label_font',
      'series_label_background',
      'series_label_match_color',
      'series_label_max_width',
      'series_label_overflow',
    ],
  },
  {
    id: 'plot-area',
    title: () => t('Plot area'),
    controls: ['plot_area_color', 'plot_area_image', 'plot_area_image_repeat'],
  },
  {
    id: 'tooltip',
    title: () => t('Tooltips'),
    toggles: [{ control: 'rich_tooltip' }, { control: 'show_tooltip_labels' }],
    controls: [
      'tooltip_label_type',
      'tooltipTruncation',
      'tooltipTimeFormat',
      'tooltipValuesFormat',
      'tooltipSizeFormat',
      'tooltipSortByMetric',
      'showTooltipTotal',
      'showTooltipPercentage',
    ],
  },
  {
    id: 'card-value',
    title: () => t('Callout value'),
    controls: [
      'card_value_show',
      'card_value_font',
      'card_value_underline',
      'card_value_wrap',
      'card_value_align',
      'card_value_units',
      'card_value_decimals',
      'card_blank_text',
      'card_vertical_align',
      'header_font_size',
    ],
  },
  {
    id: 'card-label',
    title: () => t('Category label'),
    controls: [
      'card_label_show',
      'card_label_text',
      'card_label_font',
      'card_label_underline',
      'card_label_wrap',
      'card_label_align',
      'card_label_position',
      'card_label_gap',
      'show_metric_name',
      'metric_name_font_size',
    ],
  },
  {
    id: 'card-subtitle',
    title: () => t('Subtitle'),
    controls: [
      'card_subtitle_font',
      'card_subtitle_underline',
      'card_subtitle_wrap',
      'card_subtitle_align',
      'subtitle',
      'subtitle_font_size',
      'subheader',
      'subheader_font_size',
    ],
  },
  {
    id: 'kpi-goal',
    title: () => t('Goal'),
    controls: [
      'kpi_target_value',
      'kpi_goal_show',
      'kpi_goal_label',
      'kpi_goal_font',
      'kpi_goal_underline',
      'kpi_goal_wrap',
      'kpi_goal_align',
      'kpi_distance_show',
      'kpi_distance_label',
      'kpi_distance_font',
      'kpi_distance_underline',
      'kpi_distance_wrap',
      'kpi_distance_align',
      'kpi_distance_mode',
      'kpi_direction',
      'kpi_neutral_band',
    ],
  },
  {
    id: 'kpi-status',
    title: () => t('Status'),
    controls: [
      'kpi_good_color',
      'kpi_bad_color',
      'kpi_neutral_color',
      'kpi_show_icon',
      'kpi_icon_size',
    ],
  },
  {
    id: 'card-date',
    title: () => t('Last date'),
    controls: [
      'show_timestamp',
      'card_date_font',
      'card_date_underline',
      'card_date_wrap',
      'card_date_align',
    ],
  },
  {
    id: 'kpi-trend',
    title: () => t('Trend'),
    controls: ['show_trend_line', 'kpi_trend_transparency', 'color_picker'],
  },
  {
    id: 'special-colors',
    title: () => t('Colors and borders'),
    controls: [
      'special_fill_color',
      'special_fill_transparency',
      'special_border_show',
      'special_border_match_fill',
      'special_border_color',
      'special_border_width',
      'special_border_transparency',
      'special_border_only',
      'special_category_colors',
    ],
  },
  {
    id: 'special-category',
    title: () => t('Category label'),
    controls: [
      'special_category_show',
      'special_category_font',
      'special_category_background',
    ],
  },
  {
    id: 'pie-slices',
    title: () => t('Slices'),
    controls: ['special_start_angle', 'sweptAngle'],
  },
  {
    id: 'pie-center',
    title: () => t('Center value'),
    controls: [
      'center_value_show',
      'center_label',
      'center_label_font',
      'center_value_font',
      'center_value_units',
      'center_value_decimals',
      'center_background_show',
      'center_background_color',
      'center_background_transparency',
      'center_background_padding',
      'center_image',
      'center_image_size',
      'center_image_transparency',
    ],
    headings: { center_image: () => t('Image') },
  },
  {
    id: 'funnel-conversion',
    title: () => t('Conversion labels'),
    controls: [
      'special_label_style',
      'funnel_percent_font',
      'funnel_percent_background',
      'funnel_percent_show',
    ],
  },
  {
    id: 'treemap-layout',
    title: () => t('Layout'),
    controls: ['treemap_inner_padding', 'treemap_outer_padding'],
  },
  {
    id: 'gauge-value',
    title: () => t('Gauge value'),
    controls: ['gauge_value_show', 'gauge_value_font', 'gauge_value_label'],
  },
  {
    id: 'gauge-axis',
    title: () => t('Gauge axis'),
    controls: ['gauge_axis_font'],
  },
  {
    id: 'gauge-target',
    title: () => t('Target'),
    controls: [
      'gauge_target_value',
      'gauge_target_show',
      'gauge_target_color',
      'gauge_target_font',
      'gauge_target_label',
    ],
  },
  {
    id: 'waterfall-breakdown',
    title: () => t('Breakdown'),
    controls: ['waterfall_max_breakdowns', 'waterfall_other_label'],
  },
  {
    id: 'waterfall-connectors',
    title: () => t('Connectors'),
    controls: [
      'waterfall_connectors_show',
      'waterfall_connector_color',
      'waterfall_connector_width',
      'waterfall_connector_style',
    ],
  },
  {
    id: 'scatter-bubbles',
    title: () => t('Bubbles'),
    controls: ['scatter_size_multiplier'],
  },
  {
    id: 'scatter-ratio',
    title: () => t('Ratio line'),
    controls: [
      'scatter_ratio_show',
      'scatter_ratio_label',
      'scatter_ratio_color',
      'scatter_ratio_width',
      'scatter_ratio_style',
      'scatter_ratio_dash',
      'scatter_ratio_transparency',
      'scatter_shading_show',
      'scatter_upper_color',
      'scatter_lower_color',
      'scatter_shading_transparency',
    ],
  },
  {
    id: 'table_header',
    title: () => t('Column headers'),
    controls: [
      'table_header_font',
      'table_header_background',
      'table_header_align',
      'table_header_underline',
      'table_header_wrap',
      'table_header_outline',
      'table_header_outline_color',
      'table_header_outline_width',
      'table_header_title_align',
      'table_column_expand_depth',
      'table_header_url_icon',
      'table_column_sizing',
      'table_default_column_width',
    ],
  },
  {
    id: 'table_row_header',
    title: () => t('Row headers'),
    controls: [
      'table_row_header_font',
      'table_row_header_background',
      'table_row_header_align',
      'table_row_header_underline',
      'table_row_header_wrap',
      'table_row_header_outline',
      'table_row_header_outline_color',
      'table_row_header_outline_width',
      'table_row_header_url_icon',
      'table_banded_row_headers',
      'table_freeze_row_headers',
      'table_stepped',
      'table_stepped_indent',
      'table_row_expand_depth',
      'table_repeat_headers',
      'table_expand_icons',
      'table_expand_icon_color',
      'table_expand_icon_size',
    ],
  },
  {
    id: 'table-accessibility',
    title: () => t('Accessibility'),
    controls: ['table_alt_text_column', 'table_row_reference_column'],
  },
  {
    id: 'table_cell',
    title: () => t('Values'),
    controls: [
      'valueFormat',
      'date_format',
      'table_cell_font',
      'table_cell_background',
      'table_cell_align',
      'table_cell_underline',
      'table_cell_wrap',
      'table_cell_outline',
      'table_cell_outline_color',
      'table_cell_outline_width',
      'table_stripe_color',
      'table_alternate_text_color',
      'table_image_width',
      'table_image_height',
      'table_url_icon',
      'metricsLayout',
    ],
  },
  {
    id: 'table_total',
    title: () => t('Totals'),
    controls: [
      'table_total_apply_labels',
      'table_total_font',
      'table_total_background',
      'table_total_align',
      'table_total_underline',
      'table_total_wrap',
      'table_total_outline',
      'table_total_outline_color',
      'table_total_outline_width',
      'table_total_label',
      'show_totals',
    ],
  },
  {
    id: 'table_subtotal',
    title: () => t('Subtotals'),
    controls: [
      'table_subtotal_apply_labels',
      'table_subtotal_font',
      'table_subtotal_background',
      'table_subtotal_align',
      'table_subtotal_underline',
      'table_subtotal_wrap',
      'table_subtotal_outline',
      'table_subtotal_outline_color',
      'table_subtotal_outline_width',
      'rowSubTotals',
      'colSubTotals',
      'rowSubtotalPosition',
      'colSubtotalPosition',
      'table_row_subtotal_label',
      'table_row_subtotal_levels',
      'table_column_subtotal_levels',
      'table_column_subtotal_label',
    ],
  },
  {
    id: 'table_row_total',
    title: () => t('Row grand total'),
    controls: [
      'table_row_total_apply_labels',
      'table_row_total_font',
      'table_row_total_background',
      'table_row_total_align',
      'table_row_total_underline',
      'table_row_total_wrap',
      'table_row_total_outline',
      'table_row_total_outline_color',
      'table_row_total_outline_width',
      'rowTotals',
    ],
  },
  {
    id: 'table_column_total',
    title: () => t('Column grand total'),
    controls: [
      'table_column_total_apply_labels',
      'table_column_total_font',
      'table_column_total_background',
      'table_column_total_align',
      'table_column_total_underline',
      'table_column_total_wrap',
      'table_column_total_outline',
      'table_column_total_outline_color',
      'table_column_total_outline_width',
      'colTotals',
    ],
  },
  {
    id: 'table-grid',
    title: () => t('Table grid'),
    controls: [
      'table_grid_horizontal',
      'table_grid_vertical',
      'table_grid_horizontal_color',
      'table_grid_vertical_color',
      'table_grid_horizontal_width',
      'table_grid_vertical_width',
      'table_row_padding',
      'table_text_size',
      'table_outline',
      'table_outline_color',
      'table_outline_width',
      'table_grid_color',
    ],
  },
  {
    id: 'table-blank',
    title: () => t('Blank rows'),
    controls: [
      'table_blank_rows',
      'table_blank_background',
      'table_blank_height',
      'table_blank_outline',
      'table_blank_outline_color',
      'table_blank_outline_width',
    ],
  },
  {
    id: 'table-column',
    title: () => t('Specific column'),
    controls: ['column_config'],
  },
  {
    id: 'table-sparklines',
    title: () => t('Sparklines'),
    controls: [
      'table_sparkline_columns',
      'table_sparkline_type',
      'table_sparkline_color',
      'table_sparkline_width',
      'table_sparkline_markers',
      'table_sparkline_marker_color',
      'table_sparkline_marker_size',
      'table_sparkline_marker_shape',
    ],
  },
  {
    id: 'table',
    title: () => t('Table style'),
    controls: [
      'table_style_preset',
      'show_cell_bars',
      'align_pn',
      'color_pn',
      'comparison_color_enabled',
      'comparison_color_scheme',
    ],
  },
  {
    id: 'rules',
    title: () => t('Conditional formatting'),
    controls: [
      'chart_conditional_formatting',
      'conditional_formatting',
      'table_conditional_icons',
    ],
  },
  {
    id: 'zoom',
    title: () => t('Zoom and controls'),
    toggles: [{ control: 'zoomable' }],
    controls: ['show_extra_controls'],
  },
  {
    id: 'analytics-reference',
    title: () => t('Reference lines'),
    level: 'analytics',
    controls: ['reference_lines'],
  },
  {
    id: 'analytics-trend',
    title: () => t('Trend line'),
    level: 'analytics',
    toggles: [{ control: 'trend_show' }],
    controls: [
      'trend_combine',
      'trend_color',
      'trend_width',
      'trend_transparency',
      'trend_style',
      'trend_dash',
    ],
  },
  {
    id: 'analytics-zoom',
    title: () => t('Zoom sliders'),
    level: 'analytics',
    controls: [
      'zoom_category_show',
      'zoom_category_start',
      'zoom_category_end',
      'zoom_value_show',
      'zoom_in_values',
      'zoom_value_start',
      'zoom_value_end',
      'zoom_value_min',
      'zoom_value_max',
      'zoom_secondary_show',
      'zoom_secondary_start',
      'zoom_secondary_end',
      'zoom_secondary_min',
      'zoom_secondary_max',
      'zoom_show_labels',
      'zoom_size',
    ],
  },
  {
    id: 'analytics-tooltip',
    title: () => t('Tooltip fields'),
    level: 'fields',
    controls: ['tooltip_metrics'],
  },
  {
    id: 'analytics-multiples',
    title: () => t('Small multiples'),
    level: 'analytics',
    toggles: [{ control: 'matrixify_enable' }],
    controls: [
      'matrixify_mode_columns',
      'matrixify_columns',
      'matrixify_dimension_selection_mode_columns',
      'matrixify_dimension_columns',
      'matrixify_topn_value_columns',
      'matrixify_topn_metric_columns',
      'matrixify_topn_order_columns',
      'matrixify_all_sort_by_columns',
      'matrixify_show_column_headers',
      'matrixify_fit_columns_dynamically',
      'matrixify_charts_per_row',
      'matrixify_mode_rows',
      'matrixify_rows',
      'matrixify_dimension_selection_mode_rows',
      'matrixify_dimension_rows',
      'matrixify_topn_value_rows',
      'matrixify_topn_metric_rows',
      'matrixify_topn_order_rows',
      'matrixify_all_sort_by_rows',
      'matrixify_show_row_labels',
      'matrixify_row_height',
      'matrixify_cell_title_template',
      'matrixify_grid_gap',
      'matrixify_cell_radius',
      'matrixify_cell_border_show',
      'matrixify_cell_border_width',
      'matrixify_cell_border_color',
      'matrixify_cell_background',
      'matrixify_header_font',
      'matrixify_header_background',
      'matrixify_header_align',
    ],
    headings: {
      matrixify_mode_columns: () => t('Columns'),
      matrixify_mode_rows: () => t('Rows'),
      matrixify_grid_gap: () => t('Grid'),
      matrixify_header_font: () => t('Headers'),
    },
  },
  {
    id: 'second-query',
    title: () => t('Second query'),
    controls: [
      'seriesTypeB',
      'stackB',
      'only_totalB',
      'yAxisIndexB',
      'show_valueB',
      'areaB',
      'opacityB',
      'markerEnabledB',
      'markerSizeB',
      'sort_series_typeB',
      'sort_series_ascendingB',
    ],
  },
  {
    id: 'advanced',
    title: () => t('Advanced'),
    controls: ['echart_options'],
  },
];

/**
 * Controls of a chart that the Format pane never draws because one of its own
 * says the same: the charts read what they saved (`resolveGridlines`,
 * `resolveStartAngle`), so old charts do not change.
 */
export const SUPERSEDED_CONTROLS = [
  // "Hide gridlines" of the Gridlines section
  'gridlines',
  // "Start angle" of the Slices section
  'startAngle',
];

export interface FormatCardItem extends CustomControlItem {
  /** Whether the section of the control panel it comes from shows */
  sectionVisibility?: ControlPanelSectionConfig['visibility'];
  /** A heading above it, which starts a group of the section */
  heading?: string;
  /**
   * The same control again: a chart may declare it twice, each one for a case,
   * as bars do for each orientation
   */
  alternatives?: FormatCardItem[];
}

export interface FormatCard {
  id: string;
  title: string;
  level?: 'analytics' | 'fields';
  toggle?: CardToggle & { item: FormatCardItem };
  items: FormatCardItem[];
}

const isControlItem = (item: unknown): item is CustomControlItem =>
  !!item &&
  typeof item === 'object' &&
  'name' in item &&
  'config' in item &&
  !!(item as CustomControlItem).config;

/**
 * Sorts the look controls of a chart into the sections of the pane. A control no
 * section knows stays under the title of its section in the control panel, so
 * no option of any chart is ever lost.
 */
export function buildFormatCards(
  sections: ControlPanelSectionConfig[],
): FormatCard[] {
  const items = new Map<string, FormatCardItem>();
  const origin = new Map<string, string>();
  sections.forEach(section => {
    section.controlSetRows.flat().forEach(item => {
      if (!isControlItem(item)) return;
      const found = { ...item, sectionVisibility: section.visibility };
      const first = items.get(item.name);
      if (first) {
        first.alternatives = [...(first.alternatives ?? []), found];
        return;
      }
      items.set(item.name, found);
      origin.set(item.name, String(section.label ?? t('Options')));
    });
  });

  const cards: FormatCard[] = [];
  const known = new Set<string>(SUPERSEDED_CONTROLS);
  let strayValues: FormatCardItem[] = [];
  const placed = new Set<string>();
  const tabular = items.has('table_cell_font');
  CARD_DEFINITIONS.forEach(definition => {
    // The values of a table only make a section for a table
    if (definition.id === 'table_cell' && !tabular) return;
    const toggleOf = definition.toggles?.find(({ control }) =>
      items.has(control),
    );
    definition.toggles?.forEach(({ control }) => known.add(control));
    definition.controls.forEach(control => known.add(control));
    let cardItems = definition.controls.flatMap(control => {
      const item = items.get(control);
      // A control goes in the first section that names it
      if (!item || placed.has(control)) return [];
      placed.add(control);
      const heading = definition.headings?.[control]?.();
      return [heading ? { ...item, heading } : item];
    });
    if (tabular && definition.id === 'labels')
      cardItems = cardItems.filter(item => item.name !== 'date_format');
    if (definition.id === 'values') cardItems = strayValues;
    if (
      (definition.id === 'table_cell' ||
        (definition.id === 'card-value' && items.has('card_value_font'))) &&
      strayValues.length
    ) {
      const previous = cards.findIndex(card => card.id === 'values');
      if (previous !== -1) cards.splice(previous, 1);
      cardItems = [...strayValues, ...cardItems];
    }
    const soft = definition.softControls;
    if (
      soft &&
      !toggleOf &&
      cardItems.every(item => soft.includes(item.name))
    ) {
      strayValues = cardItems;
      return;
    }
    if (!toggleOf && !cardItems.length) return;
    cards.push({
      id: definition.id,
      title: definition.title(),
      ...(definition.level && { level: definition.level }),
      toggle: toggleOf && {
        ...toggleOf,
        item: items.get(toggleOf.control) as FormatCardItem,
      },
      items: cardItems,
    });
  });

  const others = new Map<string, FormatCardItem[]>();
  items.forEach((item, name) => {
    if (known.has(name)) return;
    const title = origin.get(name) as string;
    others.set(title, [...(others.get(title) ?? []), item]);
  });
  others.forEach((cardItems, title) =>
    cards.push({ id: `other-${title}`, title, items: cardItems }),
  );
  return cards;
}

/** The controls a section can reset, its switch included. */
export const cardControlNames = (card: FormatCard) => [
  ...(card.toggle ? [card.toggle.control] : []),
  ...card.items.map(item => item.name),
];
