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
import { ControlSubSectionHeader } from '../components/ControlSubSectionHeader';
import type {
  ControlPanelSectionConfig,
  ControlSetItem,
  ControlSetRow,
} from '../types';
import { sharedControls } from '../shared-controls';

const control = (
  name: string,
  label: string,
  type: string,
  extra: Record<string, unknown> = {},
): ControlSetItem => ({
  name,
  config: { type, label, default: null, renderTrigger: true, ...extra },
});
const toggle = (name: string, label: string, visibility?: unknown) =>
  control(name, label, 'CheckboxControl', visibility ? { visibility } : {});
const number = (
  name: string,
  label: string,
  min: number,
  max: number,
  visibility?: unknown,
) =>
  control(name, label, 'NumberControl', {
    min,
    max,
    ...(visibility ? { visibility } : {}),
  });

const isOn =
  (name: string) =>
  ({ controls }: { controls: Record<string, { value?: unknown }> }) =>
    !!controls?.[name]?.value;

/** The options of the Analytics level for a chart with axes. */
export function buildAnalyticsSections({
  trend = true,
  zoom = true,
  tooltipFields = false,
  secondaryAxis = false,
}: {
  trend?: boolean;
  zoom?: boolean;
  tooltipFields?: boolean;
  /** Adds a zoom slider for the secondary value axis. */
  secondaryAxis?: boolean;
} = {}): ControlPanelSectionConfig[] {
  const trendOn = isOn('trend_show');
  const categoryOn = isOn('zoom_category_show');
  const valueOn = isOn('zoom_value_show');
  const inValues = isOn('zoom_in_values');
  const both =
    (first: ReturnType<typeof isOn>, second: ReturnType<typeof isOn>) =>
    (state: Parameters<ReturnType<typeof isOn>>[0]) =>
      first(state) && second(state);
  const notInValues = (state: Parameters<ReturnType<typeof isOn>>[0]) =>
    !inValues(state);
  const secondaryOn = isOn('zoom_secondary_show');
  return [
    {
      label: t('Analytics'),
      tabOverride: 'customize',
      expanded: false,
      controlSetRows: [
        [
          control(
            'reference_lines',
            t('Reference lines'),
            'ReferenceLinesControl',
            {
              default: [],
              description: t(
                'Lines at a value or calculated from the data, with their label and shading',
              ),
              shouldMapStateToProps: () => true,
              mapStateToProps: (
                _state: unknown,
                _control: unknown,
                chart?: { queriesResponse?: { label_map?: object }[] | null },
              ) => ({
                seriesNames: Object.keys(
                  chart?.queriesResponse?.[0]?.label_map ?? {},
                ),
              }),
            },
          ),
        ],
        ...(trend
          ? ([
              [
                <ControlSubSectionHeader>
                  {t('Trend line')}
                </ControlSubSectionHeader>,
              ],
              [toggle('trend_show', t('Show the trend line'))],
              [
                toggle(
                  'trend_combine',
                  t('One line for all the series'),
                  trendOn,
                ),
                control('trend_color', t('Line color'), 'ColorPickerControl', {
                  allowClear: true,
                  visibility: trendOn,
                }),
              ],
              [
                number('trend_width', t('Line width'), 0, 20, trendOn),
                number(
                  'trend_transparency',
                  t('Transparency (%)'),
                  0,
                  100,
                  trendOn,
                ),
              ],
              [
                control('trend_style', t('Line style'), 'SelectControl', {
                  choices: [
                    ['solid', t('Solid')],
                    ['dashed', t('Dashed')],
                    ['dotted', t('Dotted')],
                  ],
                  default: 'dashed',
                  clearable: false,
                  visibility: trendOn,
                }),
                control('trend_dash', t('Dash pattern'), 'TextControl', {
                  default: '',
                  visibility: trendOn,
                }),
              ],
            ] as ControlSetRow[])
          : []),
        ...(zoom
          ? ([
              [
                <ControlSubSectionHeader>
                  {t('Zoom sliders')}
                </ControlSubSectionHeader>,
              ],
              [toggle('zoom_category_show', t('On the categories axis'))],
              [
                number(
                  'zoom_category_start',
                  t('Start (%)'),
                  0,
                  100,
                  categoryOn,
                ),
                number('zoom_category_end', t('End (%)'), 0, 100, categoryOn),
              ],
              [toggle('zoom_value_show', t('On the values axis'))],
              [
                toggle(
                  'zoom_in_values',
                  t('Limits of the value axes in values'),
                ),
              ],
              [
                number(
                  'zoom_value_start',
                  t('Start (%)'),
                  0,
                  100,
                  both(valueOn, notInValues),
                ),
                number(
                  'zoom_value_end',
                  t('End (%)'),
                  0,
                  100,
                  both(valueOn, notInValues),
                ),
              ],
              [
                control('zoom_value_min', t('From'), 'NumberControl', {
                  visibility: both(valueOn, inValues),
                }),
                control('zoom_value_max', t('To'), 'NumberControl', {
                  visibility: both(valueOn, inValues),
                }),
              ],
              ...(secondaryAxis
                ? ([
                    [
                      toggle(
                        'zoom_secondary_show',
                        t('On the secondary values axis'),
                      ),
                    ],
                    [
                      number(
                        'zoom_secondary_start',
                        t('Start (%)'),
                        0,
                        100,
                        both(secondaryOn, notInValues),
                      ),
                      number(
                        'zoom_secondary_end',
                        t('End (%)'),
                        0,
                        100,
                        both(secondaryOn, notInValues),
                      ),
                    ],
                    [
                      control(
                        'zoom_secondary_min',
                        t('From'),
                        'NumberControl',
                        {
                          visibility: both(secondaryOn, inValues),
                        },
                      ),
                      control('zoom_secondary_max', t('To'), 'NumberControl', {
                        visibility: both(secondaryOn, inValues),
                      }),
                    ],
                  ] as ControlSetRow[])
                : []),
              [
                control(
                  'zoom_show_labels',
                  t('Show the labels'),
                  'CheckboxControl',
                  {
                    default: true,
                  },
                ),
                number('zoom_size', t('Slider size'), 8, 60),
              ],
            ] as ControlSetRow[])
          : []),
        ...(tooltipFields
          ? [
              [
                {
                  name: 'tooltip_metrics',
                  config: {
                    ...sharedControls.metrics,
                    label: t('Tooltip fields'),
                    description: t(
                      'Metrics the tooltip adds to each mark, without drawing them',
                    ),
                    default: [],
                    validators: [],
                    renderTrigger: false,
                  },
                },
              ],
            ]
          : []),
      ],
    },
  ];
}
