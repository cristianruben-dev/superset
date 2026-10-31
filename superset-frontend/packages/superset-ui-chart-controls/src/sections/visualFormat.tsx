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
import {
  ControlPanelSectionConfig,
  ControlPanelsContainerProps,
  ControlSetItem,
} from '../types';
import { D3_FORMAT_OPTIONS } from '../utils/D3Formatting';

/*
 * "Format" controls inspired by the Power BI format pane. Every control is a
 * render trigger (no query re-run) and every default reproduces the chart's
 * look before the control existed, so saved charts are unaffected.
 */

type Visibility = (props: ControlPanelsContainerProps) => boolean;

const isChecked =
  (controlName: string): Visibility =>
  ({ controls }) =>
    Boolean(controls?.[controlName]?.value);

const ALIGN_CHOICES: [string, string][] = [
  ['left', t('Left')],
  ['center', t('Center')],
  ['right', t('Right')],
];

const LINE_STYLE_CHOICES: [string, string][] = [
  ['solid', t('Solid')],
  ['dashed', t('Dashed')],
  ['dotted', t('Dotted')],
];

const fontControl = (
  name: string,
  label: string,
  description: string,
  extra: Record<string, unknown> = {},
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'FontControl',
    label,
    description,
    default: null,
    renderTrigger: true,
    ...extra,
    ...(visibility ? { visibility } : {}),
  },
});

const colorControl = (
  name: string,
  label: string,
  description: string,
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'ColorPickerControl',
    label,
    description,
    default: null,
    renderTrigger: true,
    ...(visibility ? { visibility } : {}),
  },
});

const numberControl = (
  name: string,
  label: string,
  description: string,
  defaultValue: number,
  min: number,
  max: number,
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'NumberControl',
    label,
    description,
    default: defaultValue,
    min,
    max,
    step: 1,
    renderTrigger: true,
    ...(visibility ? { visibility } : {}),
  },
});

const checkboxControl = (
  name: string,
  label: string,
  description: string,
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'CheckboxControl',
    label,
    description,
    default: false,
    renderTrigger: true,
    ...(visibility ? { visibility } : {}),
  },
});

const selectControl = (
  name: string,
  label: string,
  description: string,
  choices: [string | number | null, string][],
  defaultValue: string | number | null,
  visibility?: Visibility,
  extra: Record<string, unknown> = {},
): ControlSetItem => ({
  name,
  config: {
    type: 'SelectControl',
    label,
    description,
    choices,
    default: defaultValue,
    clearable: false,
    freeForm: false,
    renderTrigger: true,
    ...extra,
    ...(visibility ? { visibility } : {}),
  },
});

/* -------------------------------------------------------------------------
 * Phase 1 — visual container (applies to every chart type, see SuperChart)
 * ---------------------------------------------------------------------- */

const titleShown = isChecked('visual_title_show');
const subtitleShown = isChecked('visual_subtitle_show');
const dividerShown = isChecked('visual_divider_show');
const backgroundShown = isChecked('visual_background_show');
const borderShown = isChecked('visual_border_show');
const shadowShown = isChecked('visual_shadow_show');

export const visualTitleSection: ControlPanelSectionConfig = {
  label: t('Title & subtitle'),
  description: t(
    'Title, subtitle and divider drawn inside the chart frame, visible in Explore and on dashboards',
  ),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [<ControlSubSectionHeader>{t('Title')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_title_show',
        t('Show title'),
        t('Display a title inside the chart'),
      ),
    ],
    [
      {
        name: 'visual_title_text',
        config: {
          type: 'TextControl',
          label: t('Title text'),
          default: '',
          renderTrigger: true,
          visibility: titleShown,
        },
      },
    ],
    [
      fontControl(
        'visual_title_font',
        t('Title font'),
        t('Font family, size, weight and color of the title'),
        { defaultFontSize: 16, defaultBold: true },
        titleShown,
      ),
    ],
    [
      selectControl(
        'visual_title_align',
        t('Alignment'),
        t('Horizontal alignment of the title and subtitle'),
        ALIGN_CHOICES,
        'left',
        ({ controls }: ControlPanelsContainerProps) =>
          Boolean(
            controls?.visual_title_show?.value ||
            controls?.visual_subtitle_show?.value,
          ),
      ),
      colorControl(
        'visual_title_background',
        t('Title background'),
        t('Background color behind the title'),
        titleShown,
      ),
    ],
    [<ControlSubSectionHeader>{t('Subtitle')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_subtitle_show',
        t('Show subtitle'),
        t('Display a subtitle below the title'),
      ),
    ],
    [
      {
        name: 'visual_subtitle_text',
        config: {
          type: 'TextControl',
          label: t('Subtitle text'),
          default: '',
          renderTrigger: true,
          visibility: subtitleShown,
        },
      },
    ],
    [
      fontControl(
        'visual_subtitle_font',
        t('Subtitle font'),
        t('Font family, size, weight and color of the subtitle'),
        { defaultFontSize: 12 },
        subtitleShown,
      ),
    ],
    [<ControlSubSectionHeader>{t('Divider')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_divider_show',
        t('Show divider'),
        t('Draw a line between the header and the chart'),
      ),
    ],
    [
      colorControl(
        'visual_divider_color',
        t('Divider color'),
        t('Color of the divider line'),
        dividerShown,
      ),
      numberControl(
        'visual_divider_width',
        t('Divider width'),
        t('Thickness of the divider line in pixels'),
        1,
        1,
        10,
        dividerShown,
      ),
    ],
    [
      selectControl(
        'visual_divider_style',
        t('Divider style'),
        t('Line style of the divider'),
        LINE_STYLE_CHOICES,
        'solid',
        dividerShown,
      ),
    ],
    [
      numberControl(
        'visual_header_spacing',
        t('Space below header'),
        t('Space in pixels between the header and the chart'),
        8,
        0,
        64,
        ({ controls }: ControlPanelsContainerProps) =>
          Boolean(
            controls?.visual_title_show?.value ||
            controls?.visual_subtitle_show?.value ||
            controls?.visual_divider_show?.value,
          ),
      ),
    ],
  ],
};

export const visualEffectsSection: ControlPanelSectionConfig = {
  label: t('Background, border & shadow'),
  description: t('Visual effects applied to the chart frame'),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [<ControlSubSectionHeader>{t('Background')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_background_show',
        t('Background'),
        t('Fill the chart frame with a background color'),
      ),
    ],
    [
      colorControl(
        'visual_background_color',
        t('Background color'),
        t('Defaults to the theme background when empty'),
        backgroundShown,
      ),
    ],
    [<ControlSubSectionHeader>{t('Border')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_border_show',
        t('Border'),
        t('Draw a border around the chart frame'),
      ),
    ],
    [
      colorControl(
        'visual_border_color',
        t('Border color'),
        t('Defaults to the theme border color when empty'),
        borderShown,
      ),
    ],
    [
      numberControl(
        'visual_border_width',
        t('Border width'),
        t('Border thickness in pixels'),
        1,
        0,
        20,
        borderShown,
      ),
      numberControl(
        'visual_border_radius',
        t('Rounded corners'),
        t('Corner radius in pixels'),
        4,
        0,
        64,
        borderShown,
      ),
    ],
    [<ControlSubSectionHeader>{t('Shadow')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'visual_shadow_show',
        t('Shadow'),
        t('Draw a drop shadow around the chart frame'),
      ),
    ],
    [
      colorControl(
        'visual_shadow_color',
        t('Shadow color'),
        t('Color of the shadow'),
        shadowShown,
      ),
      selectControl(
        'visual_shadow_position',
        t('Shadow position'),
        t('Where the shadow is cast'),
        [
          ['outer', t('Around')],
          ['bottom_right', t('Bottom right')],
          ['bottom', t('Bottom')],
        ],
        'outer',
        shadowShown,
      ),
    ],
    [<ControlSubSectionHeader>{t('Spacing')}</ControlSubSectionHeader>],
    [
      numberControl(
        'visual_padding',
        t('Padding'),
        t('Inner space in pixels between the frame and its content'),
        0,
        0,
        64,
      ),
    ],
  ],
};

/* -------------------------------------------------------------------------
 * Phase 2 — data labels
 * ---------------------------------------------------------------------- */

export const valueLabelFontControl = fontControl(
  'value_label_font',
  t('Label font'),
  t('Font family, size, weight and color of the data labels'),
  { defaultFontSize: 12 },
);

export const valueLabelBackgroundControl = colorControl(
  'value_label_background',
  t('Label background'),
  t('Background color behind each data label'),
);

export const valueLabelFormatControl: ControlSetItem = {
  name: 'value_label_format',
  config: {
    type: 'SelectControl',
    freeForm: true,
    clearable: true,
    label: t('Label number format'),
    description: t(
      'Display units and decimals for the data labels. Leave empty to use the axis number format',
    ),
    choices: D3_FORMAT_OPTIONS,
    default: null,
    renderTrigger: true,
  },
};

export const valueLabelRotateControl = selectControl(
  'value_label_rotate',
  t('Label orientation'),
  t('Orientation of the data label text'),
  [
    [0, t('Horizontal')],
    [45, t('Diagonal')],
    [90, t('Vertical')],
  ],
  0,
);

/**
 * Builds the "Data labels format" section. Charts choose which control
 * reveals the section and which options apply to their labels.
 */
export const buildDataLabelsFormatSection = ({
  showWhen = ['show_value'],
  numberFormat = true,
  rotate = true,
}: {
  /** The section shows when any of these checkbox controls is on. */
  showWhen?: string[];
  numberFormat?: boolean;
  rotate?: boolean;
} = {}): ControlPanelSectionConfig => ({
  label: t('Data labels format'),
  description: t('Style of the values shown on the chart'),
  tabOverride: 'customize',
  expanded: false,
  visibility: props => showWhen.some(name => isChecked(name)(props)),
  controlSetRows: [
    [valueLabelFontControl],
    rotate
      ? [valueLabelBackgroundControl, valueLabelRotateControl]
      : [valueLabelBackgroundControl],
    ...(numberFormat ? [[valueLabelFormatControl]] : []),
  ],
});

export const dataLabelsFormatSection = buildDataLabelsFormatSection();

/* -------------------------------------------------------------------------
 * Phase 3 — legend
 * ---------------------------------------------------------------------- */

export const legendAlignControl = selectControl(
  'legend_align',
  t('Legend alignment'),
  t(
    'Alignment of the legend along its edge: left/center/right for top and bottom legends, top/middle/bottom for side legends',
  ),
  [
    [null, t('Auto')],
    ['start', t('Start (left / top)')],
    ['center', t('Center')],
    ['end', t('End (right / bottom)')],
  ],
  null,
);

export const legendFontControl = fontControl(
  'legend_font',
  t('Legend font'),
  t('Font family, size, weight and color of the legend text'),
  { defaultFontSize: 12 },
);

export const legendIconControl = selectControl(
  'legend_icon',
  t('Legend marker'),
  t('Shape of the legend markers'),
  [
    [null, t('Auto')],
    ['circle', t('Circle')],
    ['rect', t('Square')],
    ['roundRect', t('Rounded square')],
    ['triangle', t('Triangle')],
    ['diamond', t('Diamond')],
  ],
  null,
);

export const legendFormatSection: ControlPanelSectionConfig = {
  label: t('Legend format'),
  description: t('Alignment, font and markers of the legend'),
  tabOverride: 'customize',
  expanded: false,
  visibility: isChecked('show_legend'),
  controlSetRows: [
    [legendAlignControl, legendIconControl],
    [legendFontControl],
  ],
};

/* -------------------------------------------------------------------------
 * Phase 4 — axes and gridlines
 * ---------------------------------------------------------------------- */

/**
 * Builds the "Axes & gridlines format" section; charts with a secondary
 * value axis get font controls for it too.
 */
export const buildAxesFormatSection = ({
  secondaryYAxis = false,
}: { secondaryYAxis?: boolean } = {}): ControlPanelSectionConfig => ({
  label: t('Axes & gridlines format'),
  description: t(
    'Fonts of the axis labels and titles, axis direction and gridline style',
  ),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
    [
      fontControl(
        'x_axis_label_font',
        t('X axis labels font'),
        t('Font of the X axis tick labels'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      fontControl(
        'x_axis_title_font',
        t('X axis title font'),
        t('Font of the X axis title'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      checkboxControl(
        'x_axis_inverse',
        t('Reverse X axis'),
        t('Draw the X axis in the opposite direction'),
      ),
    ],
    [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
    [
      fontControl(
        'y_axis_label_font',
        t('Y axis labels font'),
        t('Font of the Y axis tick labels'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      fontControl(
        'y_axis_title_font',
        t('Y axis title font'),
        t('Font of the Y axis title'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      checkboxControl(
        'y_axis_inverse',
        t('Reverse Y axis'),
        t('Draw the Y axis in the opposite direction'),
      ),
    ],
    ...(secondaryYAxis
      ? [
          [
            <ControlSubSectionHeader>
              {t('Secondary Y Axis')}
            </ControlSubSectionHeader>,
          ],
          [
            fontControl(
              'y_axis_secondary_label_font',
              t('Secondary Y axis labels font'),
              t('Font of the secondary Y axis tick labels'),
              { defaultFontSize: 12 },
            ),
          ],
          [
            fontControl(
              'y_axis_secondary_title_font',
              t('Secondary Y axis title font'),
              t('Font of the secondary Y axis title'),
              { defaultFontSize: 12 },
            ),
          ],
        ]
      : []),
    [<ControlSubSectionHeader>{t('Gridlines')}</ControlSubSectionHeader>],
    [
      colorControl(
        'gridline_color',
        t('Gridline color'),
        t('Defaults to the theme color when empty'),
      ),
      numberControl(
        'gridline_width',
        t('Gridline width'),
        t('Gridline thickness in pixels'),
        1,
        1,
        10,
      ),
    ],
    [
      selectControl(
        'gridline_style',
        t('Gridline style'),
        t('Line style of the gridlines'),
        LINE_STYLE_CHOICES,
        'solid',
      ),
    ],
  ],
});

export const axesFormatSection = buildAxesFormatSection();

/* -------------------------------------------------------------------------
 * Phase 5 — series
 * ---------------------------------------------------------------------- */

type ChartQueryResponse = { label_map?: Record<string, unknown> };

/**
 * Series names from the chart's last query responses, used to offer the
 * per-series pickers before the user types any name.
 */
export const getSeriesNamesFromChart = (chart?: {
  queriesResponse?: ChartQueryResponse[] | null;
}): string[] => {
  const names = new Set<string>();
  (chart?.queriesResponse ?? []).forEach(response => {
    Object.keys(response?.label_map ?? {}).forEach(name => names.add(name));
  });
  return Array.from(names);
};

const seriesNamesProps = {
  shouldMapStateToProps: () => true,
  mapStateToProps: (
    _state: unknown,
    _control: unknown,
    chart?: { queriesResponse?: ChartQueryResponse[] | null },
  ) => ({ seriesNames: getSeriesNamesFromChart(chart) }),
};

export const seriesColorsControl: ControlSetItem = {
  name: 'series_colors',
  config: {
    type: 'SeriesColorsControl',
    label: t('Series colors'),
    description: t(
      'Pick a color per series. Series without a color keep the color scheme',
    ),
    default: {},
    renderTrigger: true,
    ...seriesNamesProps,
  },
};

export const MARKER_SYMBOL_CHOICES: [string | null, string][] = [
  [null, t('Auto')],
  ['circle', t('Circle')],
  ['emptyCircle', t('Empty circle')],
  ['rect', t('Square')],
  ['roundRect', t('Rounded square')],
  ['triangle', t('Triangle')],
  ['diamond', t('Diamond')],
  ['pin', t('Pin')],
  ['arrow', t('Arrow')],
];

/**
 * Builds the "Series format" section with the options that apply to the
 * chart's series types.
 */
export const buildSeriesFormatSection = ({
  lines = true,
  markers = true,
  bars = true,
}: {
  lines?: boolean;
  markers?: boolean;
  bars?: boolean;
} = {}): ControlPanelSectionConfig => ({
  label: t('Series format'),
  description: t('Colors, lines, markers and bars of each series'),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [seriesColorsControl],
    ...(lines
      ? [
          [<ControlSubSectionHeader>{t('Lines')}</ControlSubSectionHeader>],
          [
            {
              name: 'series_line_width',
              config: {
                type: 'NumberControl',
                label: t('Line width'),
                description: t('Line thickness in pixels; empty uses 2'),
                default: null,
                min: 1,
                max: 10,
                step: 1,
                renderTrigger: true,
              },
            },
            selectControl(
              'series_line_type',
              t('Line style'),
              t('Line style of the series'),
              LINE_STYLE_CHOICES,
              'solid',
            ),
          ],
        ]
      : []),
    ...(markers
      ? [
          [
            selectControl(
              'series_marker_symbol',
              t('Marker shape'),
              t('Shape of the data point markers'),
              MARKER_SYMBOL_CHOICES,
              null,
            ),
          ],
        ]
      : []),
    ...(bars
      ? [
          [<ControlSubSectionHeader>{t('Bars')}</ControlSubSectionHeader>],
          [
            {
              name: 'bar_category_gap',
              config: {
                type: 'NumberControl',
                label: t('Space between bars (%)'),
                description: t(
                  'Gap between bar groups as a percentage of their width; empty uses the default',
                ),
                default: null,
                min: 0,
                max: 95,
                step: 5,
                renderTrigger: true,
              },
            },
            numberControl(
              'bar_border_radius',
              t('Rounded corners'),
              t('Corner radius of the bar ends in pixels'),
              0,
              0,
              50,
            ),
          ],
          [
            colorControl(
              'bar_border_color',
              t('Bar border color'),
              t('Color of the bar borders'),
            ),
            numberControl(
              'bar_border_width',
              t('Bar border width'),
              t('Border thickness in pixels; 0 hides it'),
              0,
              0,
              10,
            ),
          ],
        ]
      : []),
  ],
});

/* -------------------------------------------------------------------------
 * Phase 8 — conditional formatting of marks and labels
 * ---------------------------------------------------------------------- */

export const chartConditionalFormattingSection: ControlPanelSectionConfig = {
  label: t('Conditional formatting'),
  description: t(
    'Color bars, points or data labels whose value matches a rule',
  ),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [
      {
        name: 'chart_conditional_formatting',
        config: {
          type: 'ChartConditionalFormattingControl',
          label: t('Rules'),
          description: t(
            'Rules are checked in order; the first matching rule colors the value',
          ),
          default: [],
          renderTrigger: true,
          ...seriesNamesProps,
        },
      },
    ],
  ],
};
