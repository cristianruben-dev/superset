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
import { ControlPanelSectionConfig, ControlSetItem } from '../types';

const gridControl = (
  name: string,
  label: string,
  type: string,
  extra: Record<string, unknown> = {},
): ControlSetItem => ({
  name,
  config: { type, label, default: null, renderTrigger: true, ...extra },
});

export const matrixifyEnableSection: ControlPanelSectionConfig = {
  label: t('Matrixify'),
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'matrixify_enable',
        config: {
          type: 'SwitchControl',
          label: t('Enable matrixify'),
          default: false,
          renderTrigger: true,
        },
      },
    ],
    ['matrixify_mode_columns'],
    ['matrixify_mode_rows'],
  ],
  tabOverride: 'matrixify',
};

export const matrixifySection: ControlPanelSectionConfig = {
  label: t('Cell layout & styling'),
  expanded: false,
  visibility: ({ controls }) =>
    controls?.matrixify_enable?.value === true &&
    (controls?.matrixify_mode_rows?.value === 'metrics' ||
      controls?.matrixify_mode_rows?.value === 'dimensions' ||
      controls?.matrixify_mode_columns?.value === 'metrics' ||
      controls?.matrixify_mode_columns?.value === 'dimensions'),
  controlSetRows: [
    [
      {
        name: 'matrixify_row_height',
        config: {
          type: 'TextControl',
          label: t('Row height'),
          default: 300,
          isInt: true,
          renderTrigger: true,
          description: t('Height of each row in pixels'),
        },
      },
      {
        name: 'matrixify_fit_columns_dynamically',
        config: {
          type: 'CheckboxControl',
          label: t('Fit columns dynamically'),
          default: true,
          renderTrigger: true,
          description: t('Automatically adjust column width based on content'),
        },
      },
    ],
    [
      {
        name: 'matrixify_charts_per_row',
        config: {
          type: 'TextControl',
          label: t('Charts per row'),
          default: 3,
          isInt: true,
          renderTrigger: true,
          description: t(
            'Number of charts per row when not fitting dynamically',
          ),
          visibility: ({ controls }) =>
            !controls?.matrixify_fit_columns_dynamically?.value,
        },
      },
    ],
    [
      {
        name: 'matrixify_cell_title_template',
        config: {
          type: 'TextControl',
          label: t('Cell title template'),
          default: '',
          description: t(
            'Template for cell titles. Use Handlebars templating syntax (a popular templating library that uses double curly brackets for variable substitution): {{row}}, {{column}}, {{rowLabel}}, {{columnLabel}}',
          ),
          placeholder: '{{rowLabel}} by {{colLabel}}',
        },
      },
    ],
    [
      gridControl(
        'matrixify_grid_gap',
        t('Space between charts'),
        'NumberControl',
        {
          min: 0,
          max: 64,
        },
      ),
      gridControl(
        'matrixify_cell_radius',
        t('Rounded corners'),
        'NumberControl',
        {
          min: 0,
          max: 50,
        },
      ),
    ],
    [
      gridControl(
        'matrixify_cell_border_show',
        t('Borders'),
        'CheckboxControl',
        {
          default: true,
        },
      ),
      gridControl(
        'matrixify_cell_border_width',
        t('Border width'),
        'NumberControl',
        {
          min: 0,
          max: 20,
        },
      ),
    ],
    [
      gridControl(
        'matrixify_cell_border_color',
        t('Border color'),
        'ColorPickerControl',
        {
          allowClear: true,
        },
      ),
      gridControl(
        'matrixify_cell_background',
        t('Chart background'),
        'ColorPickerControl',
        {
          allowClear: true,
        },
      ),
    ],
    [gridControl('matrixify_header_font', t('Header font'), 'FontControl')],
    [
      gridControl(
        'matrixify_header_background',
        t('Header background'),
        'ColorPickerControl',
        {
          allowClear: true,
        },
      ),
      gridControl(
        'matrixify_header_align',
        t('Header alignment'),
        'SelectControl',
        {
          choices: [
            ['left', t('Left')],
            ['center', t('Center')],
            ['right', t('Right')],
          ],
          clearable: true,
        },
      ),
    ],
  ],
  tabOverride: 'customize',
};

export const matrixifyRowSection: ControlPanelSectionConfig = {
  expanded: false,
  visibility: ({ controls }) =>
    controls?.matrixify_enable?.value === true &&
    (controls?.matrixify_mode_rows?.value === 'metrics' ||
      controls?.matrixify_mode_rows?.value === 'dimensions'),
  controlSetRows: [
    ['matrixify_show_row_labels'],
    ['matrixify_rows'],
    ['matrixify_dimension_rows'],
    ['matrixify_dimension_selection_mode_rows'],
    ['matrixify_topn_value_rows'],
    ['matrixify_topn_metric_rows'],
    ['matrixify_topn_order_rows'],
  ],
  tabOverride: 'matrixify',
};

export const matrixifyColumnSection: ControlPanelSectionConfig = {
  expanded: false,
  visibility: ({ controls }) =>
    controls?.matrixify_enable?.value === true &&
    (controls?.matrixify_mode_columns?.value === 'metrics' ||
      controls?.matrixify_mode_columns?.value === 'dimensions'),
  controlSetRows: [
    ['matrixify_show_column_headers'],
    ['matrixify_columns'],
    ['matrixify_dimension_columns'],
    ['matrixify_dimension_selection_mode_columns'],
    ['matrixify_topn_value_columns'],
    ['matrixify_topn_metric_columns'],
    ['matrixify_topn_order_columns'],
  ],
  tabOverride: 'matrixify',
};
