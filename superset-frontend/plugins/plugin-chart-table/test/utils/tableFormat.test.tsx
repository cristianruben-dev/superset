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
import '@testing-library/jest-dom';
import { render } from '@superset-ui/core/spec';
import TableChart from '../../src/TableChart';
import transformProps from '../../src/transformProps';
import {
  getCellIcon,
  getTableClassName,
  getTableFormat,
  getTableFormatCss,
} from '../../src/utils/tableFormat';
import testData from '../testData';
import { ProviderWrapper } from '../testHelpers';

test('getTableFormat defaults to the original look', () => {
  const format = getTableFormat({});
  expect(format).toEqual({
    preset: 'default',
    headerCss: {},
    cellCss: {},
    stripeColor: undefined,
    gridColor: undefined,
    iconRules: [],
  });
  expect(getTableClassName(format.preset)).toBe(
    'table table-striped table-condensed',
  );
  expect(getTableFormatCss(format)).toBe('');
});

test('getTableFormat resolves fonts, colors and icon rules', () => {
  const format = getTableFormat({
    table_style_preset: 'bordered',
    table_header_font: { fontSize: 14, bold: true, color: '#ffffff' },
    table_header_background: '#003366',
    table_cell_font: { italic: true },
    table_grid_color: '#cccccc',
    table_conditional_icons: [
      { operator: '>', value: 10, color: '#00aa00', icon: '▲' },
      { operator: '>', value: 10, color: '#00aa00' },
    ],
  });
  expect(format.preset).toBe('bordered');
  expect(format.headerCss).toEqual({
    fontSize: '14px',
    fontWeight: 700,
    color: '#ffffff',
    background: '#003366',
  });
  expect(format.cellCss).toEqual({ fontStyle: 'italic' });
  expect(format.iconRules).toHaveLength(1);
  const css = getTableFormatCss(format);
  expect(css).toContain(
    'thead > tr > th { font-size: 14px; font-weight: 700; color: #ffffff; background: #003366; }',
  );
  expect(css).toContain('table > tbody > tr > td { font-style: italic; }');
  expect(css).toContain('border-color: #cccccc');
  expect(getTableClassName(format.preset)).toBe(
    'table table-bordered table-condensed',
  );
});

test('unknown presets fall back to the default', () => {
  expect(getTableFormat({ table_style_preset: 'neon' }).preset).toBe('default');
});

test('getCellIcon matches rules by column and value', () => {
  const rules = [
    {
      operator: '<' as const,
      value: 0,
      color: '#ff0000',
      icon: '▼',
      series: 'profit',
    },
    { operator: '>=' as const, value: 100, color: '#00aa00', icon: '▲' },
  ];
  expect(getCellIcon(rules, 'profit', -5)).toEqual({
    icon: '▼',
    color: '#ff0000',
  });
  expect(getCellIcon(rules, 'sales', -5)).toBeUndefined();
  expect(getCellIcon(rules, 'sales', 150)).toEqual({
    icon: '▲',
    color: '#00aa00',
  });
  expect(getCellIcon(rules, 'sales', 'text')).toBeUndefined();
  expect(getCellIcon([], 'sales', 150)).toBeUndefined();
});

test('TableChart renders the preset class and conditional icons', () => {
  const chartProps = {
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      table_style_preset: 'minimal',
      table_conditional_icons: [
        {
          operator: '>',
          value: 10000,
          color: '#00aa00',
          icon: '★',
          series: 'sum__num',
        },
      ],
    },
  };
  const { container } = render(
    ProviderWrapper({
      children: <TableChart {...transformProps(chartProps)} sticky={false} />,
    }),
  );
  expect(container.querySelector('table')).toHaveClass(
    'table',
    'table-condensed',
    'table-minimal',
  );
  expect(container.querySelector('table')).not.toHaveClass('table-striped');
  // Michael (2467063) and Maria (12342) exceed 10000; Joe (2467) does not.
  expect(container.querySelectorAll('.dt-cell-icon')).toHaveLength(2);
  expect(container.querySelector('.dt-cell-icon')).toHaveTextContent('★');
});
