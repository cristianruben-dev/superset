/*
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
  getCompleteValueRules,
  getCustomFontCss,
  hasCustomFontStyle,
  matchesValueRule,
  resolveFontStyle,
  toBoundedNumber,
  toCssColor,
} from './visualFormatting';

test('toCssColor converts picker values to CSS colors', () => {
  expect(toCssColor(undefined)).toBeUndefined();
  expect(toCssColor(null)).toBeUndefined();
  expect(toCssColor('')).toBeUndefined();
  expect(toCssColor('#ff0000')).toBe('#ff0000');
  expect(toCssColor('#ff000080')).toBe('rgba(255, 0, 0, 0.5)');
  expect(toCssColor({ r: 1, g: 2, b: 3 })).toBe('rgba(1, 2, 3, 1)');
  expect(toCssColor({ r: 1, g: 2, b: 3, a: 0.4 })).toBe('rgba(1, 2, 3, 0.4)');
  expect(toCssColor('red')).toBe('red');
});

test('toBoundedNumber parses, clamps and falls back', () => {
  expect(toBoundedNumber('12', 1)).toBe(12);
  expect(toBoundedNumber('', 5)).toBe(5);
  expect(toBoundedNumber('abc', 5)).toBe(5);
  expect(toBoundedNumber(200, 5, 0, 64)).toBe(64);
  expect(toBoundedNumber(-3, 5, 0, 64)).toBe(0);
});

test('resolveFontStyle merges user values over defaults', () => {
  expect(
    resolveFontStyle(undefined, { fontSize: 16, bold: true, color: '#000' }),
  ).toEqual({
    fontFamily: undefined,
    fontSize: 16,
    bold: true,
    italic: false,
    color: '#000',
  });
  expect(
    resolveFontStyle(
      { fontSize: 20, bold: false, italic: true, color: '#00ff00' },
      { fontSize: 16, bold: true },
    ),
  ).toEqual({
    fontFamily: undefined,
    fontSize: 20,
    bold: false,
    italic: true,
    color: '#00ff00',
  });
});

test('hasCustomFontStyle detects any explicit property', () => {
  expect(hasCustomFontStyle(undefined)).toBe(false);
  expect(hasCustomFontStyle({})).toBe(false);
  expect(hasCustomFontStyle({ color: null, fontSize: null })).toBe(false);
  expect(hasCustomFontStyle({ fontSize: 14 })).toBe(true);
  expect(hasCustomFontStyle({ bold: false })).toBe(true);
  expect(hasCustomFontStyle({ color: '#fff' })).toBe(true);
});

test('getCustomFontCss only returns properties set by the user', () => {
  expect(getCustomFontCss(undefined)).toEqual({});
  expect(
    getCustomFontCss({
      fontFamily: 'Georgia, serif',
      fontSize: 14,
      bold: true,
      italic: false,
      color: '#ff0000',
    }),
  ).toEqual({
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    fontWeight: 700,
    fontStyle: 'normal',
    color: '#ff0000',
  });
});

test('matchesValueRule evaluates operators and ignores invalid input', () => {
  expect(matchesValueRule({ operator: '>', value: 5 }, 6)).toBe(true);
  expect(matchesValueRule({ operator: '<=', value: 5 }, 5)).toBe(true);
  expect(matchesValueRule({ operator: '!=', value: 5 }, 5)).toBe(false);
  expect(
    matchesValueRule({ operator: 'between', value: 10, value2: 1 }, 3),
  ).toBe(true);
  expect(matchesValueRule({ operator: 'between', value: 1 }, 3)).toBe(false);
  expect(matchesValueRule({ operator: '>', value: 5 }, 'abc')).toBe(false);
  expect(matchesValueRule({ operator: '>', value: 0 }, true)).toBe(false);
});

test('getCompleteValueRules keeps rules with operator, value and color', () => {
  expect(
    getCompleteValueRules([
      { operator: '>', value: 1, color: '#000000' },
      { operator: '>', value: '', color: '#000000' },
      { operator: '>', value: 1 },
      null,
    ]),
  ).toEqual([{ operator: '>', value: 1, color: '#000000' }]);
});
