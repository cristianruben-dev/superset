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
import {
  type ColorInput,
  type FontStyleValue,
  type ValueRule,
  getCompleteValueRules,
  getCustomFontCss,
  matchesValueRule,
  toCssColor,
} from '@superset-ui/core';

/*
 * "Table format" controls (style presets, header/cell fonts, grid colors and
 * conditional icons). Defaults reproduce the table's look before these
 * controls existed.
 */

export type TableStylePreset =
  | 'default'
  | 'comfortable'
  | 'minimal'
  | 'bordered';

export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
  'default',
  'comfortable',
  'minimal',
  'bordered',
];

const PRESET_CLASS_NAMES: Record<TableStylePreset, string> = {
  default: 'table table-striped table-condensed',
  comfortable: 'table table-striped',
  minimal: 'table table-condensed table-minimal',
  bordered: 'table table-bordered table-condensed',
};

export const TABLE_ICONS = ['▲', '▼', '●', '■', '◆', '★', '✔', '✖', '⚠'];

export interface TableIconRule extends ValueRule {
  icon?: string;
  /** Column key the rule applies to; empty means every numeric column. */
  series?: string | null;
}

export interface TableFormat {
  preset: TableStylePreset;
  headerCss: ReturnType<typeof getCustomFontCss> & { background?: string };
  cellCss: ReturnType<typeof getCustomFontCss>;
  stripeColor?: string;
  gridColor?: string;
  iconRules: TableIconRule[];
}

export type TableFormatFormData = {
  table_style_preset?: string | null;
  table_header_font?: FontStyleValue | null;
  table_header_background?: ColorInput;
  table_cell_font?: FontStyleValue | null;
  table_stripe_color?: ColorInput;
  table_grid_color?: ColorInput;
  table_conditional_icons?: unknown;
};

/** Resolves the table format controls from raw form data. */
export function getTableFormat(
  rawFormData: TableFormatFormData | Record<string, unknown>,
): TableFormat {
  const formData = rawFormData as TableFormatFormData;
  const preset = TABLE_STYLE_PRESETS.includes(
    formData.table_style_preset as TableStylePreset,
  )
    ? (formData.table_style_preset as TableStylePreset)
    : 'default';
  const headerBackground = toCssColor(formData.table_header_background);
  return {
    preset,
    headerCss: {
      ...getCustomFontCss(formData.table_header_font),
      ...(headerBackground ? { background: headerBackground } : {}),
    },
    cellCss: getCustomFontCss(formData.table_cell_font),
    stripeColor: toCssColor(formData.table_stripe_color),
    gridColor: toCssColor(formData.table_grid_color),
    iconRules: getCompleteValueRules<TableIconRule>(
      formData.table_conditional_icons,
    ).filter(rule => typeof rule.icon === 'string' && rule.icon !== ''),
  };
}

export const getTableClassName = (preset: TableStylePreset = 'default') =>
  PRESET_CLASS_NAMES[preset] ?? PRESET_CLASS_NAMES.default;

const toKebab = (key: string) =>
  key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

const declarations = (css: Record<string, string | number | undefined>) =>
  Object.entries(css)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${toKebab(key)}: ${value};`)
    .join(' ');

/**
 * CSS overrides for the user's table format. Cell rules use low-specificity
 * selectors so per-cell conditional formatting (cell-level classes) still
 * wins over the user's default cell font and color.
 */
export function getTableFormatCss(format: TableFormat): string {
  const rules: string[] = [];
  const header = declarations(format.headerCss);
  if (header) {
    rules.push(`thead > tr > th { ${header} }`);
  }
  const cell = declarations(format.cellCss);
  if (cell) {
    rules.push(`table > tbody > tr > td { ${cell} }`);
  }
  if (format.stripeColor) {
    rules.push(
      `table.table-striped tbody tr:nth-of-type(odd) { background-color: ${format.stripeColor}; }`,
    );
  }
  if (format.preset === 'minimal') {
    rules.push(
      'table.table-minimal thead > tr > th { border-right: none; }',
      'table.table-minimal > tbody tr td { border-top: none; }',
    );
  }
  if (format.gridColor) {
    rules.push(
      `thead > tr > th { border-color: ${format.gridColor}; }`,
      // Same specificity as the base rule, so this later rule wins.
      `.table > tbody tr td { border-top-color: ${format.gridColor}; }`,
      `table.table-bordered, table.table-bordered th, table.table-bordered td { border-color: ${format.gridColor}; }`,
    );
  }
  return rules.join('\n');
}

/**
 * Icon to show next to a cell value: the first rule for this column (or for
 * every numeric column) whose condition the value meets.
 */
export function getCellIcon(
  rules: TableIconRule[],
  columnKey: string,
  value: unknown,
): { icon: string; color?: string } | undefined {
  if (rules.length === 0 || typeof value !== 'number') return undefined;
  const rule = rules.find(
    r => (!r.series || r.series === columnKey) && matchesValueRule(r, value),
  );
  return rule?.icon
    ? { icon: rule.icon, color: toCssColor(rule.color) }
    : undefined;
}
