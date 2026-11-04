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
import { GenericDataType } from '@apache-superset/core/common';
import { checkColumnType } from '../utils/checkColumnType';
import { getColumnLabel, type QueryFormColumn } from '@superset-ui/core';
import type {
  ControlPanelSectionConfig,
  ControlSetItem,
  Dataset,
} from '../types';
import {
  buildAxesFormatSection,
  seriesLegendFormatSection,
  plotAreaFormatSection,
  buildSeriesFormatSection,
} from './visualFormat';

const control = (
  name: string,
  label: string,
  type: string,
  extra: Record<string, unknown> = {},
): ControlSetItem => ({
  name,
  config: { type, label, default: null, renderTrigger: true, ...extra },
});
const font = (name: string, label: string) =>
  control(name, label, 'FontControl');
const color = (name: string, label: string) =>
  control(name, label, 'ColorPickerControl', { allowClear: true });
const toggle = (name: string, label: string) =>
  control(name, label, 'CheckboxControl', {
    default: [
      'card_value_show',
      'kpi_goal_show',
      'kpi_distance_show',
      'kpi_show_icon',
      'gauge_value_show',
      'gauge_target_show',
    ].includes(name)
      ? true
      : null,
  });
const number = (name: string, label: string, min?: number, max?: number) =>
  control(name, label, 'NumberControl', { min, max, step: 1 });
const text = (name: string, label: string) =>
  control(name, label, 'TextControl');
const select = (name: string, label: string, choices: [string, string][]) =>
  control(name, label, 'SelectControl', { choices, clearable: true });
const align = (): [string, string][] => [
  ['left', t('Left')],
  ['center', t('Center')],
  ['right', t('Right')],
];
const units = (): [string, string][] => [
  ['auto', t('Automatic')],
  ['none', t('None')],
  ['thousands', t('Thousands')],
  ['millions', t('Millions')],
  ['billions', t('Billions')],
  ['trillions', t('Trillions')],
];
const section = (
  label: string,
  rows: ControlSetItem[][],
): ControlPanelSectionConfig => ({
  label,
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: rows,
});
const textRows = (prefix: string): ControlSetItem[][] => [
  [font(`${prefix}_font`, t('Font'))],
  [
    toggle(`${prefix}_underline`, t('Underline')),
    toggle(`${prefix}_wrap`, t('Word wrap')),
  ],
  [select(`${prefix}_align`, t('Text align'), align())],
];
/** Render-only HTML card styles; unset controls inherit the saved card. */
export function buildCardFormatSections(
  trend = false,
): ControlPanelSectionConfig[] {
  const result = [
    section(t('Callout value'), [
      [toggle('card_value_show', t('Show value'))],
      ...textRows('card_value'),
      [
        select('card_value_units', t('Display units'), units()),
        number('card_value_decimals', t('Decimal places'), 0, 9),
      ],
      [text('card_blank_text', t('Show blank as'))],
      [
        select('card_vertical_align', t('Vertical alignment'), [
          ['top', t('Top')],
          ['middle', t('Middle')],
          ['bottom', t('Bottom')],
        ]),
      ],
    ]),
    section(t('Category label'), [
      [toggle('card_label_show', t('Show category label'))],
      [text('card_label_text', t('Label text'))],
      ...textRows('card_label'),
      [
        select('card_label_position', t('Label position'), [
          ['before', t('Before value')],
          ['after', t('After value')],
        ]),
      ],
      [number('card_label_gap', t('Label gap'), 0, 100)],
    ]),
    section(t('Subtitle'), textRows('card_subtitle')),
  ];
  if (trend)
    result.push(
      section(t('Goal'), [
        [number('kpi_target_value', t('Target value'))],
        [
          toggle('kpi_goal_show', t('Show goal')),
          text('kpi_goal_label', t('Goal label')),
        ],
        ...textRows('kpi_goal'),
        [
          toggle('kpi_distance_show', t('Show distance')),
          text('kpi_distance_label', t('Distance label')),
        ],
        ...textRows('kpi_distance'),
        [
          select('kpi_distance_mode', t('Distance format'), [
            ['percent', t('Percentage')],
            ['absolute', t('Absolute difference')],
          ]),
        ],
        [
          select('kpi_direction', t('Good direction'), [
            ['higher', t('Higher is better')],
            ['lower', t('Lower is better')],
          ]),
        ],
        [number('kpi_neutral_band', t('Neutral band around target'), 0)],
      ]),
      section(t('Status'), [
        [
          color('kpi_good_color', t('Good color')),
          color('kpi_bad_color', t('Bad color')),
          color('kpi_neutral_color', t('Neutral color')),
        ],
        [
          toggle('kpi_show_icon', t('Show status icon')),
          number('kpi_icon_size', t('Icon size'), 6, 96),
        ],
      ]),
      section(t('Last date'), [
        [toggle('show_timestamp', t('Show Timestamp'))],
        ...textRows('card_date'),
      ]),
      section(t('Trend'), [
        [toggle('show_trend_line', t('Show trend line'))],
        [number('kpi_trend_transparency', t('Trend transparency'), 0, 100)],
      ]),
    );
  return result;
}
export type SpecialChartKind =
  | 'pie'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'waterfall'
  | 'scatter'
  | 'bubble';
/** Only declare controls whose renderer implements the corresponding appearance. */
export function buildSpecialChartSections(
  kind: SpecialChartKind,
): ControlPanelSectionConfig[] {
  const cartesian = ['waterfall', 'scatter', 'bubble'].includes(kind);
  const scatter = kind === 'scatter' || kind === 'bubble';
  const result = [
    section(t('Data labels'), [
      [toggle('special_labels_show', t('Show labels'))],
      [
        font('value_label_font', t('Value label font')),
        color('value_label_background', t('Value label background')),
      ],
      [
        select('value_label_units', t('Display units'), units()),
        number('value_label_decimals', t('Decimal places'), 0, 9),
      ],
      [
        number(
          'special_percent_decimals',
          t('Percentage decimal places'),
          0,
          9,
        ),
      ],
      [
        select(
          'special_label_position',
          t('Label position'),
          kind === 'pie'
            ? [
                ['inner', t('Inside')],
                ['outer', t('Outside')],
                ['center', t('Center')],
              ]
            : kind === 'funnel'
              ? [
                  ['inner', t('Inside')],
                  ['left', t('Left')],
                  ['right', t('Right')],
                ]
              : [
                  ['inside', t('Inside')],
                  ['top', t('Top')],
                  ['bottom', t('Bottom')],
                  ['left', t('Left')],
                  ['right', t('Right')],
                ],
        ),
      ],
      [number('special_label_rotation', t('Label rotation'), -180, 180)],
      [
        number('special_label_max_width', t('Maximum label width'), 0, 2000),
        select('special_label_overflow', t('Overflow text'), [
          ['truncate', t('Truncate')],
          ['break', t('Wrap')],
          ['breakAll', t('Wrap anywhere')],
        ]),
      ],
    ]),
  ];
  if (kind !== 'gauge')
    result.push(
      section(t('Colors and borders'), [
        [
          color('special_fill_color', t('Default color')),
          number('special_fill_transparency', t('Fill transparency'), 0, 100),
        ],
        [
          toggle('special_border_show', t('Show border')),
          toggle('special_border_match_fill', t('Match border to fill')),
        ],
        [
          color('special_border_color', t('Border color')),
          number('special_border_width', t('Border width'), 0, 20),
        ],
        [
          number(
            'special_border_transparency',
            t('Border transparency'),
            0,
            100,
          ),
          toggle('special_border_only', t('Outline only')),
        ],
        [
          {
            name: 'special_category_colors',
            config: {
              type: 'SeriesColorsControl',
              label: t('Category colors'),
              default: {},
              renderTrigger: true,
              shouldMapStateToProps: () => true,
              mapStateToProps: (state, _control, chart) => {
                const groupby = (state.controls?.groupby?.value ??
                  []) as QueryFormColumn[];
                const data = chart?.queriesResponse?.[0]?.data ?? [];
                return {
                  seriesNames: [
                    ...new Set(
                      data
                        .map((record: Record<string, unknown>) =>
                          groupby
                            .map(getColumnLabel)
                            .map(name => String(record[name] ?? ''))
                            .join(', '),
                        )
                        .filter(Boolean),
                    ),
                  ],
                };
              },
            },
          },
        ],
        [
          color('color_scale_min', t('Minimum color')),
          color('color_scale_max', t('Maximum color')),
        ],
      ]),
      seriesLegendFormatSection,
    );
  if (cartesian && kind !== 'scatter')
    result.push(buildAxesFormatSection(), plotAreaFormatSection);
  if (kind === 'bubble')
    result.push(buildSeriesFormatSection({ lines: false, bars: false }));
  if (['pie', 'funnel', 'treemap', 'gauge'].includes(kind))
    result.push(
      section(t('Category label'), [
        [toggle('special_category_show', t('Show category label'))],
        [
          font('special_category_font', t('Category label font')),
          color('special_category_background', t('Category label background')),
        ],
      ]),
    );
  if (kind === 'pie')
    result.push(
      section(t('Slices'), [
        [number('special_start_angle', t('Start angle'), 0, 360)],
      ]),
      section(t('Center value'), [
        [
          toggle('center_value_show', t('Show center value')),
          text('center_label', t('Center label')),
        ],
        [font('center_value_font', t('Center value font'))],
        [font('center_label_font', t('Center label font'))],
        [
          select('center_value_units', t('Display units'), units()),
          number('center_value_decimals', t('Decimal places'), 0, 9),
        ],
        [
          toggle('center_background_show', t('Show center background')),
          color('center_background_color', t('Center background')),
        ],
        [
          number(
            'center_background_transparency',
            t('Background transparency'),
            0,
            100,
          ),
          number('center_background_padding', t('Padding'), 0, 100),
        ],
        [text('center_image', t('Center image (address)'))],
        [
          number('center_image_size', t('Image size (%)'), 5, 100),
          number('center_image_transparency', t('Image transparency'), 0, 100),
        ],
      ]),
    );
  if (kind === 'funnel')
    result.push(
      section(t('Conversion labels'), [
        [
          select('special_label_style', t('Label content'), [
            ['category', t('Category')],
            ['value', t('Value')],
            ['percent', t('Percentage')],
            ['value-percent', t('Value and percentage')],
            ['all', t('Category, value and percentage')],
          ]),
        ],
        [
          font('funnel_percent_font', t('Conversion font')),
          color('funnel_percent_background', t('Conversion background')),
        ],
        [toggle('funnel_percent_show', t('Show conversion percentage'))],
      ]),
    );
  if (kind === 'treemap')
    result.push(
      section(t('Layout'), [
        [
          number('treemap_inner_padding', t('Space between nodes'), 0, 100),
          number('treemap_outer_padding', t('Space between groups'), 0, 100),
        ],
      ]),
    );
  if (kind === 'gauge')
    result.push(
      section(t('Gauge value'), [
        [
          toggle('gauge_value_show', t('Show value')),
          font('gauge_value_font', t('Value font')),
        ],
        [text('gauge_value_label', t('Custom value label'))],
      ]),
      section(t('Gauge axis'), [
        [font('gauge_axis_font', t('Axis label font'))],
      ]),
      section(t('Target'), [
        [
          number('gauge_target_value', t('Target value')),
          toggle('gauge_target_show', t('Show target')),
        ],
        [
          color('gauge_target_color', t('Target color')),
          font('gauge_target_font', t('Target label font')),
        ],
        [text('gauge_target_label', t('Target label'))],
      ]),
    );
  if (kind === 'waterfall')
    result.push(
      section(t('Breakdown'), [
        [
          number('waterfall_max_breakdowns', t('Max breakdowns'), 1, 100),
          text('waterfall_other_label', t('Label of the rest')),
        ],
      ]),
      section(t('Connectors'), [
        [
          toggle('waterfall_connectors_show', t('Show connectors')),
          color('waterfall_connector_color', t('Connector color')),
        ],
        [
          number('waterfall_connector_width', t('Connector width'), 0, 20),
          select('waterfall_connector_style', t('Connector style'), [
            ['solid', t('Solid')],
            ['dashed', t('Dashed')],
            ['dotted', t('Dotted')],
          ]),
        ],
      ]),
    );
  if (scatter)
    result.push(
      section(t('Bubbles'), [
        [number('scatter_size_multiplier', t('Size multiplier'), 0, 10)],
      ]),
      section(t('Ratio line'), [
        [
          toggle('scatter_ratio_show', t('Show ratio line')),
          text('scatter_ratio_label', t('Ratio line name')),
        ],
        [
          color('scatter_ratio_color', t('Ratio line color')),
          number('scatter_ratio_width', t('Ratio line width'), 0, 20),
        ],
        [
          select('scatter_ratio_style', t('Ratio line style'), [
            ['solid', t('Solid')],
            ['dashed', t('Dashed')],
            ['dotted', t('Dotted')],
          ]),
          text('scatter_ratio_dash', t('Dash pattern')),
        ],
        [
          number(
            'scatter_ratio_transparency',
            t('Ratio line transparency'),
            0,
            100,
          ),
        ],
        [
          toggle('scatter_shading_show', t('Show plot shading')),
          color('scatter_upper_color', t('Upper shading color')),
          color('scatter_lower_color', t('Lower shading color')),
        ],
        [
          number(
            'scatter_shading_transparency',
            t('Shading transparency'),
            0,
            100,
          ),
        ],
      ]),
    );
  for (const entry of result) {
    if (kind === 'gauge' && entry.label === t('Data labels'))
      entry.controlSetRows = entry.controlSetRows.filter(
        row =>
          !row.some(
            item =>
              item &&
              typeof item === 'object' &&
              'name' in item &&
              [
                'special_percent_decimals',
                'special_label_position',
                'special_label_rotation',
                'special_label_max_width',
                'special_label_overflow',
              ].includes(item.name),
          ),
      );
    if (entry.label === t('Ratio line'))
      entry.visibility = ({ controls }) =>
        kind === 'bubble'
          ? !controls?.logXAxis?.value && !controls?.logYAxis?.value
          : !controls?.logAxis?.value &&
            checkColumnType(
              getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
              (controls?.datasource as { datasource?: Dataset } | undefined)
                ?.datasource ?? null,
              [GenericDataType.Numeric],
            );
  }
  return result;
}
