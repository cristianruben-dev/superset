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
    allowClear: true,
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
 * Data labels
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
 * Legend
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
 * Axes and gridlines
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
 * Series
 * ---------------------------------------------------------------------- */

type ChartQueryResponse = { label_map?: Record<string, unknown> };
type ExploreControls = {
  controls?: Record<string, { value?: unknown } | undefined>;
};

const columnNamesOf = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === 'string' && item !== '',
  );

/**
 * Series names from the chart's last query responses, used to offer the
 * per-series pickers before the user types any name. `label_map` also lists
 * the x-axis and dimension columns, so those are left out: when grouped,
 * series are the entries built from more than one label; otherwise every
 * entry except the dimension columns is a metric series.
 */
export const getSeriesNamesFromChart = (
  chart?: { queriesResponse?: ChartQueryResponse[] | null },
  state?: ExploreControls,
): string[] => {
  const controlValue = (name: string) => state?.controls?.[name]?.value;
  const groupColumns = ['groupby', 'groupby_b'].flatMap(name =>
    columnNamesOf(controlValue(name)),
  );
  // With a dimension, a metric on its own is not a series: the series are
  // its groups.
  const metricLabels =
    groupColumns.length > 0
      ? ['metrics', 'metrics_b', 'metric'].flatMap(name =>
          (Array.isArray(controlValue(name))
            ? (controlValue(name) as unknown[])
            : [controlValue(name)]
          ).map(metric =>
            typeof metric === 'string'
              ? metric
              : metric && typeof metric === 'object'
                ? (metric as { label?: unknown }).label
                : undefined,
          ),
        )
      : [];
  const dimensions = new Set([
    ...['x_axis', 'granularity_sqla'].flatMap(name =>
      columnNamesOf(controlValue(name)),
    ),
    ...groupColumns,
    ...columnNamesOf(metricLabels),
  ]);
  const names = new Set<string>();
  (chart?.queriesResponse ?? []).forEach(response => {
    const entries = Object.entries(response?.label_map ?? {});
    const grouped = entries.some(
      ([, labels]) => Array.isArray(labels) && labels.length > 1,
    );
    entries.forEach(([name, labels]) => {
      const isSeries = grouped
        ? Array.isArray(labels) && labels.length > 1
        : !dimensions.has(name);
      if (isSeries) names.add(name);
    });
  });
  return Array.from(names);
};

const seriesNamesProps = {
  shouldMapStateToProps: () => true,
  mapStateToProps: (
    state: ExploreControls,
    _control: unknown,
    chart?: { queriesResponse?: ChartQueryResponse[] | null },
  ) => ({ seriesNames: getSeriesNamesFromChart(chart, state) }),
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
 * Conditional formatting of marks and labels
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
