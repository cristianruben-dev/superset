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
      'truncateXAxis',
      'xAxisBounds',
      'logXAxis',
      'show_x_axis',
      'show_x_axis_min_max_labels',
    ],
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
      'currency_format',
      'yAxisLabelRotation',
      'y_axis_inverse',
      'logAxis',
      'logYAxis',
      'truncateYAxis',
      'y_axis_bounds',
      'minorTicks',
      'show_y_axis',
      'show_y_axis_min_max_labels',
      'start_y_axis_at_zero',
    ],
    softControls: ['y_axis_format', 'currency_format'],
  },
  {
    id: 'values',
    title: () => t('Values'),
    controls: [],
  },
  {
    id: 'y-axis-secondary',
    title: () => t('Secondary Y axis'),
    controls: [
      'yAxisTitleSecondary',
      'y_axis_secondary_title_font',
      'y_axis_secondary_label_font',
      'y_axis_format_secondary',
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
    ],
  },
  {
    id: 'series',
    title: () => t('Colors and series'),
    controls: [
      'color_scheme',
      'series_colors',
      'color_by_primary_axis',
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
      'area',
      'opacity',
      'series_line_width',
      'series_line_type',
      'markerEnabled',
      'markerSize',
      'series_marker_symbol',
      'max_bubble_size',
    ],
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
    ],
  },
  {
    id: 'tooltip',
    title: () => t('Tooltips'),
    toggles: [{ control: 'rich_tooltip' }, { control: 'show_tooltip_labels' }],
    controls: [
      'tooltip_label_type',
      'tooltipTimeFormat',
      'tooltipValuesFormat',
      'tooltipSizeFormat',
      'tooltipSortByMetric',
      'showTooltipTotal',
      'showTooltipPercentage',
    ],
  },
  {
    id: 'table',
    title: () => t('Table style'),
    controls: [
      'table_style_preset',
      'table_header_font',
      'table_header_background',
      'table_cell_font',
      'table_stripe_color',
      'table_grid_color',
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
    id: 'advanced',
    title: () => t('Advanced'),
    controls: ['echart_options'],
  },
];

export interface FormatCardItem extends CustomControlItem {
  /** Whether the section of the control panel it comes from shows */
  sectionVisibility?: ControlPanelSectionConfig['visibility'];
}

export interface FormatCard {
  id: string;
  title: string;
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
      if (!isControlItem(item) || items.has(item.name)) return;
      items.set(item.name, {
        ...item,
        sectionVisibility: section.visibility,
      });
      origin.set(item.name, String(section.label ?? t('Options')));
    });
  });

  const cards: FormatCard[] = [];
  const known = new Set<string>();
  let strayValues: FormatCardItem[] = [];
  CARD_DEFINITIONS.forEach(definition => {
    const toggleOf = definition.toggles?.find(({ control }) =>
      items.has(control),
    );
    definition.toggles?.forEach(({ control }) => known.add(control));
    definition.controls.forEach(control => known.add(control));
    let cardItems = definition.controls.flatMap(control => {
      const item = items.get(control);
      return item ? [item] : [];
    });
    if (definition.id === 'values') cardItems = strayValues;
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
