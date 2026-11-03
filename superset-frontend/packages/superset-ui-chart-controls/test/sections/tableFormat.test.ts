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
  formatTableNumber,
  getTableSparklineValues,
  getTableCellUrl,
  getTabularFormatCss,
  getTableColumnStyle,
  getTabularCellIcon,
} from '../../src/sections/tableFormat';

test('unset table and matrix formats produce no CSS overrides', () => {
  expect(getTabularFormatCss({})).toBe('');
  expect(getTabularFormatCss({}, true)).toBe('');
});

test('independent grid directions include explicit false and zero', () => {
  const css = getTabularFormatCss({
    table_grid_horizontal: false,
    table_grid_vertical_width: 0,
  });
  expect(css).toContain('border-top:none');
  expect(css).toContain('border-left:0px solid');
});

test('per-column styles respect their target and preserve zero values', () => {
  const config = {
    fontStyle: { bold: false },
    styleValues: false,
    styleHeader: true,
    underline: false,
  };
  expect(getTableColumnStyle(config, 'values')).toEqual({});
  expect(getTableColumnStyle(config, 'header')).toMatchObject({
    fontWeight: 400,
    textDecoration: 'none',
  });
});

test('numeric formatting scales display values and keeps zero decimals', () => {
  expect(
    formatTableNumber(12345, { displayUnits: 'thousand', decimalPlaces: 0 }),
  ).toBe('12k');
  expect(formatTableNumber(0, { decimalPlaces: 0 })).toBe('0');
  expect(formatTableNumber(5, {})).toBeUndefined();
});

test('URL cells allow only explicit web links', () => {
  expect(getTableCellUrl('https://example.com')).toBe('https://example.com/');
  for (const value of [
    ['javascript', 'alert(1)'].join(':'),
    'data:text/html,x',
    '//example.com',
    '/local',
    1,
  ])
    expect(getTableCellUrl(value)).toBeUndefined();
});

test('conditional matrix icons validate rules and match the intended metric', () => {
  const rules = [
    { operator: '>', value: 10, series: 'sales', icon: '▲' },
    { operator: '>', value: 0 },
  ];
  expect(getTabularCellIcon(rules, 'sales', 20)?.icon).toBe('▲');
  expect(getTabularCellIcon(rules, 'cost', 20)).toBeUndefined();
  expect(getTabularCellIcon(rules, 'sales', '20')).toBeUndefined();
});

test('sparkline lists accept driver JSON but reject scalars, nested data and invalid numbers', () => {
  expect(getTableSparklineValues('[1,0,null,-2]')).toEqual([1, 0, null, -2]);
  expect(getTableSparklineValues([1, 2])).toEqual([1, 2]);
  for (const value of [
    1,
    '1',
    'invalid',
    '["1"]',
    '[[1]]',
    '[1,NaN]',
    [Infinity],
  ])
    expect(getTableSparklineValues(value)).toBeUndefined();
});
