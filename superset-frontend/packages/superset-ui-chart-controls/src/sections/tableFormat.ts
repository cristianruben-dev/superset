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
import type { CSSProperties } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  getCustomFontCss,
  getColumnLabel,
  getMetricLabel,
  matchesValueRule,
  type ValueRule,
  getNumberFormatter,
  CurrencyFormatter,
  toCssColor,
  type ColorInput,
  type FontStyleValue,
} from '@superset-ui/core';
import type {
  ControlPanelSectionConfig,
  ControlSetItem,
  TableColumnConfig,
} from '../types';

export type TabularFormat = Record<string, unknown>;

const control = (
  name: string,
  label: string,
  type: string,
  extra: Record<string, unknown> = {},
): ControlSetItem => ({
  name,
  config: { type, label, default: null, renderTrigger: true, ...extra },
});
const color = (name: string, label: string) =>
  control(name, label, 'ColorPickerControl', { allowClear: true });
const number = (name: string, label: string, max = 1000) =>
  control(name, label, 'NumberControl', { min: 0, max, step: 1 });
const toggle = (name: string, label: string) =>
  control(name, label, 'CheckboxControl');
const select = (name: string, label: string, choices: [string, string][]) =>
  control(name, label, 'SelectControl', { choices, clearable: true });
const alignment = (): [string, string][] => [
  ['left', t('Left')],
  ['center', t('Center')],
  ['right', t('Right')],
];
const outline = (): [string, string][] => [
  ['none', t('None')],
  ['all', t('All borders')],
  ['top', t('Top')],
  ['bottom', t('Bottom')],
  ['left', t('Left')],
  ['right', t('Right')],
  ['horizontal', t('Horizontal')],
  ['vertical', t('Vertical')],
];

/** Render-only table and matrix controls; unset values preserve the saved visual. */
/** Database drivers may serialize array cells; accept only numeric JSON lists and gaps. */
export function getTableSparklineValues(
  value: unknown,
): (number | null)[] | undefined {
  let values = value;
  if (typeof values === 'string') {
    if (!values.trim().startsWith('[')) return undefined;
    try {
      values = JSON.parse(values);
    } catch {
      return undefined;
    }
  }
  return Array.isArray(values) &&
    values.every(
      item =>
        item === null || (typeof item === 'number' && Number.isFinite(item)),
    )
    ? values
    : undefined;
}

export function buildTableFormatSections(
  matrix = false,
): ControlPanelSectionConfig[] {
  const textSection = (
    prefix: string,
    label: string,
    font = true,
  ): ControlPanelSectionConfig => ({
    label,
    tabOverride: 'customize',
    expanded: false,
    controlSetRows: [
      ...(font
        ? [
            [control(`${prefix}_font`, t('Font'), 'FontControl')],
            [color(`${prefix}_background`, t('Background color'))],
          ]
        : []),
      [select(`${prefix}_align`, t('Text align'), alignment())],
      [
        toggle(`${prefix}_underline`, t('Underline')),
        toggle(`${prefix}_wrap`, t('Word wrap')),
      ],
      [select(`${prefix}_outline`, t('Outline'), outline())],
      [
        color(`${prefix}_outline_color`, t('Outline color')),
        number(`${prefix}_outline_width`, t('Outline width'), 20),
      ],
    ],
  });
  const headers = textSection('table_header', t('Column headers'), matrix);
  headers.controlSetRows.push(
    [
      select('table_column_sizing', t('Column sizing'), [
        ['auto', t('Fit content')],
        ['fixed', t('Fixed width')],
      ]),
    ],
    [number('table_default_column_width', t('Default column width'))],
    [
      select(
        'table_header_title_align',
        t('Header title alignment'),
        alignment(),
      ),
    ],
    ...(matrix
      ? [[number('table_column_expand_depth', t('Column expansion depth'), 20)]]
      : []),
  );
  const cells = textSection('table_cell', t('Values'), matrix);
  cells.controlSetRows.push(
    ...(!matrix
      ? [[color('table_cell_background', t('Background color'))]]
      : []),
    [color('table_alternate_text_color', t('Alternate text color'))],
    ...(matrix ? [[color('table_stripe_color', t('Stripe color'))]] : []),
    [
      number('table_image_width', t('Image width')),
      number('table_image_height', t('Image height')),
    ],
    [toggle('table_url_icon', t('Show URLs as icons'))],
  );
  headers.controlSetRows.push([
    toggle('table_header_url_icon', t('Show URLs as icons')),
  ]);
  const totals = textSection('table_total', t('Totals'));
  totals.controlSetRows.push([
    toggle('table_total_apply_labels', t('Apply to labels')),
  ]);
  totals.controlSetRows.push([
    control('table_total_label', t('Total label'), 'TextControl'),
  ]);
  const grid: ControlPanelSectionConfig = {
    label: t('Gridlines'),
    tabOverride: 'customize',
    expanded: false,
    controlSetRows: [
      [
        toggle('table_grid_horizontal', t('Horizontal grid')),
        toggle('table_grid_vertical', t('Vertical grid')),
      ],
      [
        color('table_grid_horizontal_color', t('Horizontal grid color')),
        number('table_grid_horizontal_width', t('Horizontal grid width'), 20),
      ],
      [
        color('table_grid_vertical_color', t('Vertical grid color')),
        number('table_grid_vertical_width', t('Vertical grid width'), 20),
      ],
      [number('table_row_padding', t('Row padding'), 100)],
      [number('table_text_size', t('Text size'), 100)],
      [select('table_outline', t('Outline'), outline())],
      [
        color('table_outline_color', t('Outline color')),
        number('table_outline_width', t('Outline width'), 20),
      ],
    ],
  };
  const sparkline: ControlPanelSectionConfig = {
    label: t('Sparklines'),
    tabOverride: 'customize',
    expanded: false,
    visibility: ({ controls }) =>
      !matrix ||
      (controls?.metricsLayout?.value !== 'ROWS' &&
        (
          (controls?.[
            controls?.transposePivot?.value ? 'groupbyRows' : 'groupbyColumns'
          ]?.value ?? []) as unknown[]
        ).length > 0),
    controlSetRows: [
      [
        {
          name: 'table_sparkline_columns',
          config: {
            type: 'SelectControl',
            label: matrix
              ? t('Sparkline metrics')
              : t('Sparkline array columns'),
            description: matrix
              ? t(
                  'Trend across the existing column groups, in their displayed order.',
                )
              : t(
                  'Select columns containing ordered numeric arrays. Scalar values are not a time series.',
                ),
            multi: true,
            renderTrigger: true,
            default: [],
            shouldMapStateToProps: () => true,
            mapStateToProps: (state, _control, chart) => {
              const metrics = (state.controls?.metrics?.value ??
                []) as import('@superset-ui/core').QueryFormMetric[];
              const data = chart?.queriesResponse?.[0]?.data ?? [];
              const names = matrix
                ? metrics.map(getMetricLabel)
                : (chart?.queriesResponse?.[0]?.colnames ?? []).filter(
                    (name: string) =>
                      data.some((record: Record<string, unknown>) =>
                        getTableSparklineValues(record[name])?.some(
                          value => typeof value === 'number',
                        ),
                      ),
                  );
              return { choices: names.map((name: string) => [name, name]) };
            },
          },
        },
      ],
      [
        select('table_sparkline_type', t('Chart type'), [
          ['line', t('Line')],
          ['column', t('Column')],
        ]),
      ],
      [
        color('table_sparkline_color', t('Data color')),
        number('table_sparkline_width', t('Line width'), 8),
      ],
      [
        select('table_sparkline_markers', t('Show these markers'), [
          ['none', t('None')],
          ['all', t('All')],
          ['first-last', t('First and last')],
          ['min-max', t('Minimum and maximum')],
        ]),
      ],
      [
        color('table_sparkline_marker_color', t('Marker color')),
        number('table_sparkline_marker_size', t('Marker size'), 6),
      ],
      [
        select('table_sparkline_marker_shape', t('Marker shape'), [
          ['circle', t('Circle')],
          ['square', t('Square')],
        ]),
      ],
    ],
  };
  if (!matrix) return [headers, cells, totals, grid, sparkline];
  const rows = textSection('table_row_header', t('Row headers'));
  rows.controlSetRows.push(
    [toggle('table_row_header_url_icon', t('Show URLs as icons'))],
    [toggle('table_banded_row_headers', t('Banded row headers'))],
    [toggle('table_stepped', t('Stepped layout'))],
    [number('table_stepped_indent', t('Indentation'), 100)],
    [number('table_row_expand_depth', t('Row expansion depth'), 20)],
    [toggle('table_repeat_headers', t('Repeat row headers'))],
    [toggle('table_expand_icons', t('Show expand and collapse icons'))],
    [
      color('table_expand_icon_color', t('Expand and collapse icon color')),
      number('table_expand_icon_size', t('Expand and collapse icon size'), 64),
    ],
  );
  const subtotals = textSection('table_subtotal', t('Subtotals'));
  subtotals.controlSetRows.push([
    toggle('table_subtotal_apply_labels', t('Apply to labels')),
  ]);
  const rowTotal = textSection('table_row_total', t('Row grand total'));
  rowTotal.controlSetRows.push([
    toggle('table_row_total_apply_labels', t('Apply to labels')),
  ]);
  const columnTotal = textSection(
    'table_column_total',
    t('Column grand total'),
  );
  columnTotal.controlSetRows.push([
    toggle('table_column_total_apply_labels', t('Apply to labels')),
  ]);
  subtotals.controlSetRows.push(
    [
      control(
        'table_row_subtotal_label',
        t('Row subtotal label'),
        'TextControl',
      ),
    ],
    [
      control(
        'table_column_subtotal_label',
        t('Column subtotal label'),
        'TextControl',
      ),
    ],
  );
  for (const axis of ['row', 'column']) {
    subtotals.controlSetRows.push([
      {
        name: `table_${axis}_subtotal_levels`,
        config: {
          type: 'SelectControl',
          label:
            axis === 'row'
              ? t('Row subtotal levels')
              : t('Column subtotal levels'),
          multi: true,
          renderTrigger: true,
          default: null,
          description: t('Leave empty to include every level.'),
          shouldMapStateToProps: () => true,
          mapStateToProps: state => {
            const transpose = state.controls?.transposePivot?.value === true;
            const field =
              (axis === 'row') !== transpose ? 'groupbyRows' : 'groupbyColumns';
            const labels = (
              (state.controls?.[field]?.value ??
                []) as import('@superset-ui/core').QueryFormColumn[]
            ).map(getColumnLabel);
            const metricsOnRows =
              state.controls?.metricsLayout?.value === 'ROWS';
            if ((axis === 'row') === metricsOnRows) {
              if (state.controls?.combineMetric?.value)
                labels.push(t('Metric'));
              else labels.unshift(t('Metric'));
            }
            return {
              choices: labels
                .slice(0, -1)
                .map((label, index) => [String(index + 1), label]),
            };
          },
        },
      },
    ]);
  }
  return [
    headers,
    rows,
    cells,
    subtotals,
    {
      label: t('Conditional icons'),
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'table_conditional_icons',
            config: {
              type: 'ChartConditionalFormattingControl',
              label: t('Icon rules'),
              variant: 'icon',
              default: [],
              renderTrigger: true,
              shouldMapStateToProps: () => true,
              mapStateToProps: state => ({
                seriesNames: (
                  (state.controls?.metrics?.value ??
                    []) as import('@superset-ui/core').QueryFormMetric[]
                ).map(getMetricLabel),
              }),
            },
          },
        ],
      ],
    },
    rowTotal,
    columnTotal,
    grid,
    sparkline,
    {
      label: t('Blank rows'),
      tabOverride: 'customize',
      expanded: false,
      controlSetRows: [
        [toggle('table_blank_rows', t('Show blank rows'))],
        [color('table_blank_background', t('Blank row color'))],
        [number('table_blank_height', t('Blank row height'), 100)],
        [select('table_blank_outline', t('Outline'), outline())],
        [
          color('table_blank_outline_color', t('Outline color')),
          number('table_blank_outline_width', t('Outline width'), 20),
        ],
      ],
    },
  ];
}

/** Per-column styles are inline so conditional cell colors can take precedence. */
export function getTableColumnStyle(
  config: TableColumnConfig,
  target: 'values' | 'header' | 'total' | 'subtotal',
): CSSProperties {
  const enabled =
    target === 'values'
      ? config.styleValues !== false
      : target === 'header'
        ? config.styleHeader
        : target === 'subtotal'
          ? config.styleSubtotals
          : config.styleTotal;
  if (!enabled) return {};
  return {
    ...getCustomFontCss(config.fontStyle),
    ...(toCssColor(config.backgroundColor) && {
      backgroundColor: toCssColor(config.backgroundColor),
    }),
    ...(typeof config.underline === 'boolean' && {
      textDecoration: config.underline ? 'underline' : 'none',
    }),
    ...(typeof config.wordWrap === 'boolean' && {
      whiteSpace: config.wordWrap ? 'normal' : 'nowrap',
      overflowWrap: 'anywhere',
    }),
    ...(config.horizontalAlign && { textAlign: config.horizontalAlign }),
  };
}

const declarations = (style: CSSProperties) =>
  Object.entries(style)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(
      ([key, value]) =>
        `${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}:${typeof value === 'number' && key !== 'fontWeight' ? `${value}px` : value}`,
    )
    .join(';');

/** Scoped CSS for both renderers; only explicit overrides produce declarations. */
export function getTabularFormatCss(
  format: TabularFormat,
  matrix = false,
): string {
  const rules: string[] = [];
  const table = matrix ? 'table.pvtTable' : 'table.table';
  const cells = `${table} > tbody > tr > td`;
  const allCells = `${table} > thead > tr > th, ${table} > tbody > tr > th, ${cells}, ${table} > tfoot > tr > td, ${table} > tfoot > tr > th`;
  const numeric = (key: string, max = 1000) =>
    typeof format[key] === 'number' && Number.isFinite(format[key])
      ? Math.max(0, Math.min(max, format[key] as number))
      : undefined;
  const add = (selector: string, style: CSSProperties) => {
    const value = declarations(style);
    if (value) rules.push(`${selector}{${value}}`);
  };
  const colorValue = (key: string) => toCssColor(format[key] as ColorInput);
  const border = (selector: string, prefix: string) => {
    const position = format[`${prefix}_outline`];
    if (typeof position !== 'string') return;
    const value = `${numeric(`${prefix}_outline_width`, 20) ?? 1}px solid ${colorValue(`${prefix}_outline_color`) ?? 'currentColor'}`;
    const style: CSSProperties = { border: 'none' };
    if (position === 'all') style.border = value;
    if (position === 'top' || position === 'horizontal')
      style.borderTop = value;
    if (position === 'bottom' || position === 'horizontal')
      style.borderBottom = value;
    if (position === 'left' || position === 'vertical')
      style.borderLeft = value;
    if (position === 'right' || position === 'vertical')
      style.borderRight = value;
    add(selector, style);
  };
  add(allCells, {
    ...(numeric('table_row_padding', 100) !== undefined && {
      paddingTop: numeric('table_row_padding', 100),
      paddingBottom: numeric('table_row_padding', 100),
    }),
    fontSize: numeric('table_text_size', 100),
  });
  for (const direction of ['horizontal', 'vertical']) {
    const key = `table_grid_${direction}`;
    if (
      format[key] == null &&
      format[`${key}_color`] == null &&
      format[`${key}_width`] == null
    )
      continue;
    const value =
      format[key] === false
        ? 'none'
        : `${numeric(`${key}_width`, 20) ?? 1}px solid ${colorValue(`${key}_color`) ?? colorValue('table_grid_color') ?? 'currentColor'}`;
    add(
      allCells,
      direction === 'horizontal'
        ? { borderTop: value, borderBottom: value }
        : { borderLeft: value, borderRight: value },
    );
  }
  const sections: [string, string][] = [
    ['table_header', `${table} > thead > tr > th`],
    ['table_cell', cells],
    ...(matrix
      ? ([
          ['table_row_header', `${table} > tbody > tr > th.pvtRowLabel`],
          [
            'table_subtotal',
            `${table} .pvtSubtotalLabel, ${table} td.pvtSubtotalValue`,
          ],
          [
            'table_row_total',
            `${table} td.pvtTotal:not(.pvtRowTotal), ${table} thead .pvtTotalLabel`,
          ],
          [
            'table_column_total',
            `${table} tr.pvtRowTotals > th, ${table} tr.pvtRowTotals > td`,
          ],
        ] as [string, string][])
      : [
          [
            'table_total',
            `${table} > tfoot > tr > td, ${table} > tfoot > tr > th`,
          ] as [string, string],
        ]),
  ];
  for (const [prefix, sectionSelector] of sections) {
    const selector =
      format[`${prefix}_apply_labels`] === false
        ? sectionSelector
            .split(', ')
            .filter(part => !part.includes('th') && !part.includes('Label'))
            .join(', ')
        : sectionSelector;
    if (!selector) continue;
    const font = format[`${prefix}_font`] as FontStyleValue | undefined;
    add(selector, {
      ...getCustomFontCss(font),
      backgroundColor: colorValue(`${prefix}_background`),
      ...(['left', 'center', 'right'].includes(
        String(format[`${prefix}_align`]),
      ) && {
        textAlign: format[`${prefix}_align`] as CSSProperties['textAlign'],
      }),
      ...(typeof format[`${prefix}_underline`] === 'boolean' && {
        textDecoration: format[`${prefix}_underline`] ? 'underline' : 'none',
      }),
      ...(typeof format[`${prefix}_wrap`] === 'boolean' && {
        whiteSpace: format[`${prefix}_wrap`] ? 'normal' : 'nowrap',
        overflowWrap: 'anywhere',
      }),
    });
    if (font?.bold === false)
      add(
        selector
          .split(', ')
          .map(part => `${part} strong`)
          .join(', '),
        { fontWeight: 'normal' },
      );
    border(selector, prefix);
  }
  add(`${table} > tbody > tr:nth-of-type(odd) > td`, {
    color: colorValue('table_alternate_text_color'),
    ...(matrix && { backgroundColor: colorValue('table_stripe_color') }),
  });
  if (
    ['left', 'center', 'right'].includes(
      String(format.table_header_title_align),
    )
  )
    add(matrix ? `${table} thead .pvtAxisLabel` : `${table} thead th`, {
      textAlign: format.table_header_title_align as CSSProperties['textAlign'],
    });
  if (matrix && format.table_banded_row_headers === true)
    add(`${table} > tbody > tr:nth-of-type(odd) > th.pvtRowLabel`, {
      backgroundColor: colorValue('table_stripe_color'),
      color: colorValue('table_alternate_text_color'),
    });
  if (format.table_column_sizing === 'fixed')
    add(table, { tableLayout: 'fixed', width: '100%' });
  if (format.table_column_sizing === 'auto')
    add(table, { tableLayout: 'auto' });
  const width = numeric('table_default_column_width', 2000);
  if (width !== undefined) add(allCells, { width, minWidth: width });
  if (
    numeric('table_image_width') !== undefined ||
    numeric('table_image_height') !== undefined
  )
    add(`${cells} img`, {
      width: numeric('table_image_width'),
      height: numeric('table_image_height'),
      objectFit: 'contain',
    });
  add(`${table} .toggle`, {
    color: colorValue('table_expand_icon_color'),
    fontSize: numeric('table_expand_icon_size', 64),
  });
  if (format.table_expand_icons === false)
    add(`${table} .toggle`, { display: 'none' });
  border(table, 'table');
  if (format.table_blank_rows === true)
    add(`${table} .pvtBlankRow > td`, {
      backgroundColor: colorValue('table_blank_background'),
      height: numeric('table_blank_height', 100) ?? 12,
      padding: 0,
    });
  border(`${table} .pvtBlankRow > td`, 'table_blank');
  return rules.join('\n');
}

/** Only browser web links can be opened from a cell. */
export function getTableCellUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value))
    return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

/** Explicit units/decimals override a numeric format without changing the value. */
export function formatTableNumber(
  value: unknown,
  config: TableColumnConfig,
): string | undefined {
  if (
    typeof value !== 'number' ||
    (config.displayUnits == null && config.decimalPlaces == null)
  )
    return undefined;
  const units: Record<string, [number, string]> = {
    none: [1, ''],
    thousand: [1000, 'k'],
    million: [1e6, 'M'],
    billion: [1e9, 'B'],
  };
  const [divisor, suffix] = units[config.displayUnits ?? 'none'] ?? units.none;
  const precision =
    typeof config.decimalPlaces === 'number' &&
    Number.isFinite(config.decimalPlaces)
      ? Math.max(0, Math.min(20, Math.floor(config.decimalPlaces)))
      : 2;
  const d3Format = `,.${precision}f`;
  const formatter =
    config.currencyFormat?.symbol && config.currencyFormat.symbol !== 'AUTO'
      ? new CurrencyFormatter({ currency: config.currencyFormat, d3Format })
      : getNumberFormatter(d3Format);
  return `${formatter(value / divisor)}${suffix}`;
}

/** The first validated numeric icon rule for this metric (or all metrics). */
export function getTabularCellIcon(
  raw: unknown,
  metric: string | undefined,
  value: unknown,
): { icon: string; color?: string } | undefined {
  if (typeof value !== 'number') return undefined;
  // An icon needs no color: it takes that of the text
  const rule = (
    Array.isArray(raw)
      ? (raw as (ValueRule & { icon?: string; series?: string })[])
      : []
  ).find(
    rule =>
      typeof rule?.icon === 'string' &&
      rule.icon !== '' &&
      (!rule.series || rule.series === metric) &&
      matchesValueRule(rule, value),
  );
  return rule?.icon
    ? { icon: rule.icon, color: toCssColor(rule.color) }
    : undefined;
}
