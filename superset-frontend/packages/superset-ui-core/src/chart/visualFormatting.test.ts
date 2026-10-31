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
  getVisualContainerConfig,
  getVisualContainerInnerSize,
  getVisualHeaderHeight,
  getVisualShadowCss,
  hasCustomFontStyle,
  resolveFontStyle,
  toBoundedNumber,
  toCssColor,
} from './visualFormatting';

const theme = {
  colorText: '#111111',
  colorTextSecondary: '#666666',
  colorBgContainer: '#ffffff',
  colorBorder: '#d9d9d9',
  colorSplit: '#eeeeee',
  colorTextQuaternary: '#999999',
};

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

test('getVisualContainerConfig returns null when nothing is enabled', () => {
  expect(getVisualContainerConfig(undefined, theme)).toBeNull();
  expect(getVisualContainerConfig({}, theme)).toBeNull();
  // Enabled title without text draws nothing.
  expect(
    getVisualContainerConfig({ visual_title_show: true }, theme),
  ).toBeNull();
  // Text without the toggle draws nothing either.
  expect(
    getVisualContainerConfig({ visual_title_text: 'Sales' }, theme),
  ).toBeNull();
});

test('getVisualContainerConfig resolves title, subtitle and effects', () => {
  const config = getVisualContainerConfig(
    {
      visual_title_show: true,
      visual_title_text: '  Sales  ',
      visual_title_align: 'center',
      visual_title_font: { fontSize: 20, color: '#ff0000' },
      visual_subtitle_show: true,
      visual_subtitle_text: 'By region',
      visual_divider_show: true,
      visual_divider_width: 2,
      visual_divider_style: 'dashed',
      visual_background_show: true,
      visual_border_show: true,
      visual_border_width: '3',
      visual_border_radius: 10,
      visual_shadow_show: true,
      visual_shadow_position: 'bottom',
      visual_padding: 12,
    },
    theme,
  );
  expect(config).not.toBeNull();
  expect(config?.title).toEqual({
    text: 'Sales',
    align: 'center',
    background: undefined,
    font: {
      fontFamily: undefined,
      fontSize: 20,
      bold: true,
      italic: false,
      color: '#ff0000',
    },
  });
  expect(config?.subtitle?.align).toBe('center');
  expect(config?.subtitle?.font.color).toBe(theme.colorTextSecondary);
  expect(config?.divider).toEqual({
    color: theme.colorSplit,
    width: 2,
    style: 'dashed',
  });
  expect(config?.background).toBe(theme.colorBgContainer);
  expect(config?.border).toEqual({
    color: theme.colorBorder,
    width: 3,
    radius: 10,
  });
  expect(config?.padding).toBe(12);
  expect(getVisualShadowCss(config!)).toBe('0 4px 8px #999999');
});

test('invalid enum values fall back to defaults', () => {
  const config = getVisualContainerConfig(
    {
      visual_title_show: true,
      visual_title_text: 'T',
      visual_title_align: 'diagonal',
      visual_divider_show: true,
      visual_divider_style: 'wavy',
    },
    theme,
  );
  expect(config?.title?.align).toBe('left');
  expect(config?.divider?.style).toBe('solid');
});

test('header height accounts for each header element', () => {
  const titleOnly = getVisualContainerConfig(
    {
      visual_title_show: true,
      visual_title_text: 'T',
      visual_title_font: { fontSize: 20 },
      visual_header_spacing: 10,
    },
    theme,
  )!;
  // ceil(20 * 1.3) = 26, plus spacing
  expect(getVisualHeaderHeight(titleOnly)).toBe(36);

  const full = getVisualContainerConfig(
    {
      visual_title_show: true,
      visual_title_text: 'T',
      visual_title_font: { fontSize: 20 },
      visual_title_background: '#000000',
      visual_subtitle_show: true,
      visual_subtitle_text: 'S',
      visual_divider_show: true,
      visual_divider_width: 3,
      visual_header_spacing: 0,
    },
    theme,
  )!;
  // 26 + 8 (title background) + 2 + 16 (ceil(12 * 1.3)) + 4 + 3
  expect(getVisualHeaderHeight(full)).toBe(59);

  const effectsOnly = getVisualContainerConfig(
    { visual_border_show: true },
    theme,
  )!;
  expect(getVisualHeaderHeight(effectsOnly)).toBe(0);
});

test('inner size subtracts shadow margin, border, padding and header', () => {
  const config = getVisualContainerConfig(
    {
      visual_title_show: true,
      visual_title_text: 'T',
      visual_header_spacing: 8,
      visual_border_show: true,
      visual_border_width: 2,
      visual_shadow_show: true,
      visual_padding: 10,
    },
    theme,
  )!;
  // chrome per side = 8 (shadow) + 2 (border) + 10 (padding) = 20
  // header = ceil(16 * 1.3) + 8 = 29
  expect(getVisualContainerInnerSize(config, 400, 300)).toEqual({
    width: 360,
    height: 231,
    headerHeight: 29,
  });
  expect(getVisualContainerInnerSize(config, 10, 10)).toEqual({
    width: 0,
    height: 0,
    headerHeight: 29,
  });
});
