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
import { getColumnLabel, type QueryFormColumn } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { ControlSubSectionHeader } from '../components/ControlSubSectionHeader';
import {
  ControlPanelSectionConfig,
  ControlPanelsContainerProps,
  ControlSetItem,
  Dataset,
} from '../types';
import { D3_FORMAT_OPTIONS } from '../utils/D3Formatting';
import { checkColumnType } from '../utils/checkColumnType';

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
    // The choices go in the order they are written, not by their name
    sortComparator: () => 0,
    renderTrigger: true,
    ...extra,
    ...(visibility ? { visibility } : {}),
  },
});

const optionalNumberControl = (
  name: string,
  label: string,
  description: string,
  min: number,
  max: number,
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'NumberControl',
    label,
    description,
    default: null,
    min,
    max,
    step: 1,
    renderTrigger: true,
    ...(visibility ? { visibility } : {}),
  },
});

const textControl = (
  name: string,
  label: string,
  description: string,
  visibility?: Visibility,
): ControlSetItem => ({
  name,
  config: {
    type: 'TextControl',
    label,
    description,
    default: '',
    renderTrigger: true,
    ...(visibility ? { visibility } : {}),
  },
});

const hasPositive =
  (controlName: string): Visibility =>
  ({ controls }) =>
    Number(controls?.[controlName]?.value) > 0;

const hasValue =
  (controlName: string): Visibility =>
  ({ controls }) => {
    const value = controls?.[controlName]?.value;
    return value !== null && value !== undefined && value !== '';
  };

const DISPLAY_UNIT_CHOICES: [string | null, string][] = [
  [null, t('Default')],
  ['none', t('None')],
  ['auto', t('Auto')],
  ['thousands', t('Thousands (K)')],
  ['millions', t('Millions (M)')],
  ['billions', t('Billions (B)')],
  ['trillions', t('Trillions (T)')],
];

/** Display units and decimals, side by side, for a set of numbers. */
const unitRows = (
  prefix: string,
  description: string,
  visibility?: Visibility,
): ControlSetItem[][] => [
  [
    selectControl(
      `${prefix}_units`,
      t('Display units'),
      description,
      DISPLAY_UNIT_CHOICES,
      null,
      visibility,
    ),
    optionalNumberControl(
      `${prefix}_decimals`,
      t('Decimal places'),
      t('Empty shows the decimals each number needs'),
      0,
      9,
      visibility,
    ),
  ],
];

const LINE_CAP_CHOICES: [string | null, string][] = [
  [null, t('Default')],
  ['butt', t('Flat')],
  ['round', t('Round')],
  ['square', t('Square')],
];

/** The gridlines of one axis; what is left empty follows the shared style. */
const gridlineRows = (
  axis: 'x' | 'y',
  visibility?: Visibility,
): ControlSetItem[][] => [
  [
    colorControl(
      `${axis}_gridline_color`,
      t('Gridline color'),
      t('Empty follows the Gridlines section'),
      visibility,
    ),
    optionalNumberControl(
      `${axis}_gridline_width`,
      t('Gridline width'),
      t('Empty follows the Gridlines section'),
      1,
      10,
      visibility,
    ),
  ],
  [
    selectControl(
      `${axis}_gridline_style`,
      t('Gridline style'),
      t('Empty follows the Gridlines section'),
      [[null, t('Default')], ...LINE_STYLE_CHOICES],
      null,
      visibility,
    ),
    selectControl(
      `${axis}_gridline_cap`,
      t('Line ends'),
      t('Shape of the ends of each dash'),
      LINE_CAP_CHOICES,
      null,
      visibility,
    ),
  ],
  [
    textControl(
      `${axis}_gridline_dash`,
      t('Dash pattern'),
      t('Lengths of each dash and gap in pixels, like 4 2'),
      visibility,
    ),
  ],
];

const hasColumnType =
  (type: GenericDataType, controls: ControlPanelsContainerProps['controls']) =>
  () =>
    checkColumnType(
      getColumnLabel(controls?.x_axis?.value as QueryFormColumn),
      (controls?.datasource as { datasource?: Dataset } | undefined)
        ?.datasource ?? null,
      [type],
    );

/** Whether the X axis is a scale of numbers. */
const hasNumericXAxis: Visibility = ({ controls }) =>
  hasColumnType(GenericDataType.Numeric, controls)() &&
  !controls?.xAxisForceCategorical?.value;

/** Whether the X axis lists its categories, as bars do with numbers too. */
const hasCategoricalXAxis: Visibility = ({ controls }) => {
  if (controls?.xAxisForceCategorical?.value) return true;
  if (hasColumnType(GenericDataType.Temporal, controls)()) return false;
  return (
    !hasColumnType(GenericDataType.Numeric, controls)() ||
    Boolean(controls?.stack?.value) ||
    Boolean(controls?.orientation)
  );
};

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

const BAR_LABEL_POSITIONS: [string, string][] = [
  ['outsideEnd', t('Outside end')],
  ['insideEnd', t('Inside end')],
  ['center', t('Inside center')],
  ['insideBase', t('Inside base')],
];

const LINE_LABEL_POSITIONS: [string, string][] = [
  ['above', t('Above')],
  ['below', t('Below')],
  ['left', t('Left')],
  ['right', t('Right')],
  ['center', t('Center')],
];

const LABEL_BLOCK_CHOICES: [string | null, string][] = [
  [null, t('None')],
  ['series', t('Series name')],
  ['category', t('Category')],
  ['percent', t('Percent of the category')],
];

/** Where the labels go and what they say, for bars, lines, areas and combos. */
const labelBlockRows = (
  marks: 'bars' | 'lines' | 'both',
): ControlSetItem[][] => [
  [
    selectControl(
      'value_label_position',
      t('Label position'),
      t('Where each label sits on its mark'),
      [
        [null, t('Auto')],
        ...(marks === 'lines' ? [] : BAR_LABEL_POSITIONS),
        ...(marks === 'lines'
          ? LINE_LABEL_POSITIONS
          : marks === 'both'
            ? LINE_LABEL_POSITIONS.filter(([value]) => value !== 'center')
            : []),
      ],
      null,
    ),
    selectControl(
      'value_label_align',
      t('Label alignment'),
      t('Horizontal alignment of the text of each label'),
      [
        [null, t('Auto')],
        ['left', t('Left')],
        ['center', t('Center')],
        ['right', t('Right')],
      ],
      null,
    ),
  ],
  [
    optionalNumberControl(
      'value_label_transparency',
      t('Transparency (%)'),
      t('How see-through the labels are'),
      0,
      100,
    ),
    optionalNumberControl(
      'value_label_distance',
      t('Distance from the mark'),
      t('Pixels between each label and its mark'),
      0,
      100,
    ),
  ],
  [
    optionalNumberControl(
      'value_label_max_width',
      t('Maximum width'),
      t('Longest a label can be, in pixels'),
      0,
      1000,
    ),
    selectControl(
      'value_label_overflow',
      t('Text overflow'),
      t('What happens to a label longer than its maximum width'),
      [
        ['truncate', t('Cut with an ellipsis')],
        ['break', t('Wrap the text')],
      ],
      'truncate',
      hasValue('value_label_max_width'),
    ),
  ],
  [
    checkboxControl(
      'value_label_hide_overlap',
      t('Hide overlapping labels'),
      t('Leave out the labels that would cover another one'),
    ),
  ],
  [
    numberControl(
      'value_label_density',
      t('Label density (%)'),
      t(
        'The share of the points that show their label: 50 shows every other one',
      ),
      100,
      1,
      100,
    ),
  ],
  ...unitRows('value_label', t('The scale of the values in the labels')),
  [
    checkboxControl(
      'value_label_hide_value',
      t('Hide the value'),
      t('Show only the title and the detail of each label'),
    ),
  ],
  [
    selectControl(
      'value_label_title',
      t('Label title'),
      t('Text above the value of each label'),
      LABEL_BLOCK_CHOICES,
      null,
    ),
    selectControl(
      'value_label_detail',
      t('Label detail'),
      t('Text below the value of each label'),
      LABEL_BLOCK_CHOICES,
      null,
    ),
  ],
  [
    fontControl(
      'value_label_title_font',
      t('Title font'),
      t('Font of the title of each label'),
      { defaultFontSize: 12 },
      hasValue('value_label_title'),
    ),
  ],
  [
    fontControl(
      'value_label_detail_font',
      t('Detail font'),
      t('Font of the detail of each label'),
      { defaultFontSize: 12 },
      hasValue('value_label_detail'),
    ),
  ],
  [
    selectControl(
      'value_label_layout',
      t('Label layout'),
      t('How the title, value and detail of a label are placed'),
      [
        ['stacked', t('Stacked')],
        ['inline', t('In one line')],
      ],
      'stacked',
    ),
  ],
];

/**
 * Builds the "Data labels format" section. Charts choose which control
 * reveals the section and which options apply to their labels.
 */
export const buildDataLabelsFormatSection = ({
  showWhen = ['show_value'],
  numberFormat = true,
  rotate = true,
  marks,
}: {
  /** The section shows when any of these checkbox controls is on. */
  showWhen?: string[];
  numberFormat?: boolean;
  rotate?: boolean;
  /** The marks the labels sit on, for the charts with all of its options. */
  marks?: 'bars' | 'lines' | 'both';
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
    ...(marks ? labelBlockRows(marks) : []),
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

/** The legend of the charts that can give it a title and color its text. */
export const seriesLegendFormatSection: ControlPanelSectionConfig = {
  ...legendFormatSection,
  controlSetRows: [
    ...legendFormatSection.controlSetRows,
    [
      checkboxControl(
        'legend_match_color',
        t('Match the color of the series'),
        t('Write each name of the legend in the color of its series'),
      ),
    ],
    [
      textControl(
        'legend_title',
        t('Legend title'),
        t('Text before the items of the legend'),
      ),
    ],
    [
      fontControl(
        'legend_title_font',
        t('Legend title font'),
        t('Font of the title of the legend'),
        { defaultFontSize: 12 },
        hasValue('legend_title'),
      ),
    ],
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
    [
      checkboxControl(
        'x_axis_switch_position',
        t('Switch X axis position'),
        t('Draw the X axis on the opposite side of the chart'),
      ),
    ],
    [
      checkboxControl(
        'x_axis_log',
        t('Logarithmic X axis'),
        t('Use a logarithmic scale'),
        hasNumericXAxis,
      ),
    ],
    ...unitRows(
      'x_axis_label',
      t('The scale of a numeric X axis'),
      hasNumericXAxis,
    ),
    [
      optionalNumberControl(
        'x_axis_label_max_width',
        t('Maximum label width'),
        t('Longer labels are cut, in pixels'),
        0,
        2000,
      ),
    ],
    [
      optionalNumberControl(
        'x_axis_min_category_width',
        t('Minimum category width'),
        t('The axis scrolls when the categories do not fit at this width'),
        0,
        500,
        hasCategoricalXAxis,
      ),
      selectControl(
        'x_axis_scroll_position',
        t('Start the scroll at'),
        t('The categories that show first when the axis scrolls'),
        [
          ['start', t('The first categories')],
          ['end', t('The last categories')],
        ],
        'start',
        props =>
          hasCategoricalXAxis(props) &&
          hasValue('x_axis_min_category_width')(props),
      ),
    ],
    [
      checkboxControl(
        'x_gridlines_show',
        t('Show X gridlines'),
        t('Draw gridlines across the X axis'),
      ),
    ],
    ...gridlineRows('x', isChecked('x_gridlines_show')),
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
    [
      checkboxControl(
        'y_axis_switch_position',
        t('Switch Y axis position'),
        t('Draw the Y axis on the opposite side of the chart'),
      ),
    ],
    ...unitRows('y_axis_label', t('The scale of the Y axis')),
    [
      checkboxControl(
        'y_gridlines_hidden',
        t('Hide Y gridlines'),
        t('Do not draw gridlines across the Y axis'),
      ),
    ],
    ...gridlineRows(
      'y',
      ({ controls }) => !controls?.y_gridlines_hidden?.value,
    ),
    [
      checkboxControl(
        'x_axis_hidden',
        t('Hide X axis'),
        t('Hide the line, ticks and labels of the X axis'),
      ),
      checkboxControl(
        'y_axis_hidden',
        t('Hide Y axis'),
        t('Hide the line, ticks and labels of the Y axis'),
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
          [
            checkboxControl(
              'y_axis_secondary_hidden',
              t('Hide secondary Y axis'),
              t('Hide the line, ticks and labels of the secondary Y axis'),
            ),
          ],
          ...unitRows(
            'y_axis_secondary_label',
            t('The scale of the secondary Y axis'),
          ),
        ]
      : []),
    [<ControlSubSectionHeader>{t('Gridlines')}</ControlSubSectionHeader>],
    [
      checkboxControl(
        'gridlines_hidden',
        t('Hide gridlines'),
        t('Do not draw the gridlines behind the chart'),
      ),
    ],
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

const MAX_CATEGORY_COLORS = 100;

/** Category names from the last query of the chart, for per-category colors. */
export const getCategoryNamesFromChart = (
  chart?: { queriesResponse?: { data?: unknown }[] | null },
  state?: ExploreControls,
): string[] => {
  const axis = state?.controls?.x_axis?.value;
  const column =
    typeof axis === 'string'
      ? axis
      : (axis as { label?: string } | undefined)?.label;
  const rows = chart?.queriesResponse?.[0]?.data;
  if (!column || !Array.isArray(rows)) return [];
  const names = new Set<string>();
  rows.forEach(row => {
    const value = (row as Record<string, unknown>)[column];
    if (typeof value === 'string' && names.size < MAX_CATEGORY_COLORS) {
      names.add(value);
    }
  });
  return Array.from(names);
};

const seriesFormatControl = (
  fields: ('labels' | 'bars' | 'lines' | 'markers' | 'axis')[],
): ControlSetItem => ({
  name: 'series_format',
  config: {
    type: 'SeriesFormatControl',
    label: t('Apply to one series'),
    description: t(
      'Choose a series to give it its own options over those of the chart',
    ),
    default: {},
    renderTrigger: true,
    fields,
    ...seriesNamesProps,
  },
});

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
  axis = false,
}: {
  lines?: boolean;
  markers?: boolean;
  bars?: boolean;
  /** Lets a series move to the secondary Y axis. */
  axis?: boolean;
} = {}): ControlPanelSectionConfig => ({
  label: t('Series format'),
  description: t('Colors, lines, markers and bars of each series'),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [
      colorControl(
        'series_default_color',
        t('Default color'),
        t('Color of the series that have none of their own'),
      ),
    ],
    [seriesColorsControl],
    [
      seriesFormatControl([
        'labels',
        ...(bars ? (['bars'] as const) : []),
        ...(lines ? (['lines'] as const) : []),
        ...(markers ? (['markers'] as const) : []),
        ...(axis ? (['axis'] as const) : []),
      ]),
    ],
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
          [
            selectControl(
              'line_interpolation',
              t('Line type'),
              t('How the line goes from one point to the next'),
              [
                [null, t('Default')],
                ['linear', t('Straight')],
                ['smooth', t('Smooth')],
                ['monotone', t('Smooth, without overshooting')],
                ['start', t('Steps, before the point')],
                ['middle', t('Steps, between the points')],
                ['end', t('Steps, after the point')],
              ],
              null,
            ),
            optionalNumberControl(
              'line_smoothness',
              t('Smoothness (%)'),
              t('How much the line curves'),
              0,
              100,
              ({ controls }) =>
                ['smooth', 'monotone'].includes(
                  String(controls?.line_interpolation?.value),
                ),
            ),
          ],
          [
            optionalNumberControl(
              'line_transparency',
              t('Line transparency (%)'),
              t('How see-through the lines are'),
              0,
              100,
            ),
            checkboxControl(
              'line_hidden',
              t('Hide the lines'),
              t('Show only the markers and labels of the series'),
            ),
          ],
          [
            selectControl(
              'series_line_cap',
              t('Line ends'),
              t('Shape of the ends of the lines and dashes'),
              LINE_CAP_CHOICES,
              null,
            ),
            selectControl(
              'series_line_join',
              t('Line joins'),
              t('Shape of the corners of the lines'),
              [
                [null, t('Default')],
                ['bevel', t('Bevel')],
                ['round', t('Round')],
                ['miter', t('Miter')],
              ],
              null,
            ),
          ],
          [
            textControl(
              'series_line_dash',
              t('Dash pattern'),
              t('Lengths of each dash and gap in pixels, like 4 2'),
            ),
          ],
          [
            colorControl(
              'area_color',
              t('Area color'),
              t('Color of the shaded area; empty uses that of the series'),
              // An area chart has no switch for it: it always shades
              ({ controls }) =>
                !controls?.area ||
                Boolean(controls.area.value || controls.areaB?.value),
            ),
          ],
        ]
      : []),
    ...(markers
      ? [
          [<ControlSubSectionHeader>{t('Markers')}</ControlSubSectionHeader>],
          [
            selectControl(
              'series_marker_symbol',
              t('Marker shape'),
              t('Shape of the data point markers'),
              MARKER_SYMBOL_CHOICES,
              null,
            ),
            numberControl(
              'marker_rotation',
              t('Marker rotation'),
              t('Degrees each marker turns'),
              0,
              0,
              360,
            ),
          ],
          [
            colorControl(
              'marker_color',
              t('Marker color'),
              t('Empty uses the color of the series'),
            ),
            optionalNumberControl(
              'marker_transparency',
              t('Marker transparency (%)'),
              t('How see-through the markers are'),
              0,
              100,
            ),
          ],
          [
            numberControl(
              'marker_border_width',
              t('Marker border width'),
              t('Border thickness in pixels; 0 hides it'),
              0,
              0,
              10,
            ),
            checkboxControl(
              'marker_border_match_fill',
              t('Match the marker color'),
              t('Give the border the color of the marker'),
              hasPositive('marker_border_width'),
            ),
          ],
          [
            colorControl(
              'marker_border_color',
              t('Marker border color'),
              t('Color of the border of the markers'),
              ({ controls }) =>
                Number(controls?.marker_border_width?.value) > 0 &&
                !controls?.marker_border_match_fill?.value,
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
          [
            checkboxControl(
              'bar_border_match_fill',
              t('Match the bar color'),
              t('Give each border the color of its bar'),
            ),
            checkboxControl(
              'bar_border_only',
              t('Only the border'),
              t('Draw the border of each bar, without its fill'),
            ),
          ],
          [
            optionalNumberControl(
              'bar_transparency',
              t('Bar transparency (%)'),
              t('How see-through the bars are'),
              0,
              100,
            ),
          ],
          [
            optionalNumberControl(
              'bar_overlap',
              t('Overlap (%)'),
              t('How far the bars of a group go over one another'),
              0,
              100,
            ),
            checkboxControl(
              'bar_overlap_reverse',
              t('Reverse the overlap'),
              t('Put the first series in front of the others'),
              hasValue('bar_overlap'),
            ),
          ],
          [
            {
              name: 'category_colors',
              config: {
                type: 'SeriesColorsControl',
                label: t('Color by category'),
                namePlaceholder: t('Category name'),
                description: t(
                  'Pick a color per category. Categories without one keep the color of their series',
                ),
                default: {},
                renderTrigger: true,
                // A time axis has no names to choose from
                visibility: ({
                  chart,
                  controls,
                }: ControlPanelsContainerProps) =>
                  getCategoryNamesFromChart(chart as never, {
                    controls: controls as never,
                  }).length > 0,
                shouldMapStateToProps: () => true,
                mapStateToProps: (
                  state: ExploreControls,
                  _control: unknown,
                  chart?: { queriesResponse?: { data?: unknown }[] | null },
                ) => ({
                  seriesNames: getCategoryNamesFromChart(chart, state),
                }),
              },
            },
          ],
          [
            colorControl(
              'color_scale_min',
              t('Color of the lowest value'),
              t('With the color of the highest, colors each bar by its value'),
            ),
            colorControl(
              'color_scale_max',
              t('Color of the highest value'),
              t('With the color of the lowest, colors each bar by its value'),
            ),
          ],
        ]
      : []),
  ],
});

/* -------------------------------------------------------------------------
 * Total labels, series labels and plot area
 * ---------------------------------------------------------------------- */

export const totalLabelsFormatSection: ControlPanelSectionConfig = {
  label: t('Total labels'),
  description: t('The total of each stack, above it'),
  tabOverride: 'customize',
  expanded: false,
  visibility: ({ controls }) => Boolean(controls?.stack?.value),
  controlSetRows: [
    [
      checkboxControl(
        'total_labels_show',
        t('Show total labels'),
        t('Write the total of each stack above it'),
      ),
    ],
    [
      fontControl(
        'total_label_font',
        t('Total font'),
        t('Font of the total labels'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      colorControl(
        'total_label_background',
        t('Total background'),
        t('Background color behind each total'),
      ),
    ],
    ...unitRows('total_label', t('The scale of the totals')),
    [
      checkboxControl(
        'total_label_split_sign',
        t('Split positive and negative'),
        t(
          'Show one total for the positive values and another for the negative ones',
        ),
      ),
    ],
  ],
};

export const seriesLabelsFormatSection: ControlPanelSectionConfig = {
  label: t('Series labels'),
  description: t('The name of each series, at the end of its line'),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [
      checkboxControl(
        'series_labels_show',
        t('Show series labels'),
        t('Write the name of each series at the end of its line'),
      ),
    ],
    [
      fontControl(
        'series_label_font',
        t('Series label font'),
        t('Font of the series labels'),
        { defaultFontSize: 12 },
      ),
    ],
    [
      colorControl(
        'series_label_background',
        t('Series label background'),
        t('Background color behind each series label'),
      ),
      checkboxControl(
        'series_label_match_color',
        t('Match the color of the series'),
        t('Write each label in the color of its series'),
      ),
    ],
    [
      optionalNumberControl(
        'series_label_max_width',
        t('Maximum width'),
        t('Space for the labels at the right of the chart, in pixels'),
        20,
        400,
      ),
      selectControl(
        'series_label_overflow',
        t('Text overflow'),
        t('What happens to a label longer than its maximum width'),
        [
          ['truncate', t('Cut with an ellipsis')],
          ['break', t('Wrap the text')],
        ],
        'truncate',
      ),
    ],
  ],
};

export const plotAreaFormatSection: ControlPanelSectionConfig = {
  label: t('Plot area'),
  description: t('The background behind the marks of the chart'),
  tabOverride: 'customize',
  expanded: false,
  controlSetRows: [
    [
      colorControl(
        'plot_area_color',
        t('Plot area color'),
        t('Background color of the plot area'),
      ),
    ],
    [
      textControl(
        'plot_area_image',
        t('Plot area image'),
        t('Address of an image for the plot area; it wins over the color'),
      ),
    ],
    [
      selectControl(
        'plot_area_image_repeat',
        t('Image layout'),
        t('How the image fills the plot area'),
        [
          ['repeat', t('Tile')],
          ['no-repeat', t('Once, at its size')],
        ],
        'repeat',
        hasValue('plot_area_image'),
      ),
    ],
  ],
};

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
