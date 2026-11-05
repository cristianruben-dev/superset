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
import { supersetTheme } from '@apache-superset/core/theme';
import {
  actionButtonStyles,
  echartsHostFormat,
  headerTooltipStyle,
  visualStyle,
} from './styles';

test('a chart without tooltip format or sampling asks nothing of ECharts', () => {
  expect(echartsHostFormat(undefined)).toBeUndefined();
  expect(echartsHostFormat({ chart: { legend_font: {} } })).toBeUndefined();
});

test('the opacity of the tooltip goes into its background, with readable text', () => {
  expect(
    JSON.parse(
      echartsHostFormat({
        chart: { auradata_tooltip: { background: '#000000', opacity: 50 } },
      }) as string,
    ),
  ).toEqual({
    sampling: false,
    tooltip: { background: 'rgba(0, 0, 0, 0.5)', textColor: '#ffffff' },
  });
});

test('spacing only applies when customized', () => {
  const off = visualStyle(
    { title: { spacing: { belowTitle: 9 } } },
    supersetTheme,
  );
  expect(off.className).toBeUndefined();
  const on = visualStyle(
    { title: { spacing: { customize: true, belowTitle: 9 } } },
    supersetTheme,
  );
  expect(on.className).toBe('auradata-spacing');
  expect(on.style).toMatchObject({ '--mb-s-title': '9px' });
});

test('a divider that reaches the edges knows the padding of the card', () => {
  const { style, className } = visualStyle(
    {
      paddingSides: { left: 5, right: 7 },
      title: { dividerBleed: true },
    },
    supersetTheme,
  );
  expect(className).toBe('auradata-divider-bleed');
  expect(style).toMatchObject({
    '--mb-v-pad-left': '5px',
    '--mb-v-pad-right': '7px',
  });
});

test('icons take their border and opacity', () => {
  const { style, className } = visualStyle(
    { header: { iconBorder: '#000000', iconOpacity: 50 } },
    supersetTheme,
  );
  expect(className).toBe('auradata-header-icons');
  expect(style).toMatchObject({
    '--mb-v-icon-border': '1px solid rgba(0, 0, 0, 0.5)',
  });
});

test('keeping the layer order is a class of the holder', () => {
  expect(visualStyle({ keepLayerOrder: true }, supersetTheme).className).toBe(
    'auradata-keep-layer',
  );
});

test('the header tooltip takes its text style', () => {
  expect(
    headerTooltipStyle({
      bold: true,
      underline: true,
      background: '#000000',
      opacity: 50,
    }),
  ).toMatchObject({
    fontWeight: 700,
    textDecoration: 'underline',
    background: 'rgba(0, 0, 0, 0.5)',
  });
});

test('the action button draws its fill, border, shadow and padding', () => {
  const { box, text, icon } = actionButtonStyles(
    {
      fill: { color: '#ff0000', opacity: 50 },
      border: { show: true, color: '#000000', width: 2, opacity: 50 },
      shadow: { show: true, color: '#000000', blur: 6, position: 'bottom' },
      paddingSides: { top: 1, right: 2, bottom: 3, left: 4 },
      alignHorizontal: 'left',
      textColor: '#00ff00',
      iconColor: '#0000ff',
      iconPadding: 3,
    },
    undefined,
    supersetTheme,
  );
  expect(box.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
  expect(box.border).toBe('2px solid rgba(0, 0, 0, 0.5)');
  expect(box.boxShadow).toBe('0px 2px 6px rgba(0, 0, 0, 0.4)');
  expect(box.padding).toBe('1px 2px 3px 4px');
  expect(box.justifyContent).toBe('flex-start');
  expect(text.color).toBe('rgb(0, 255, 0)');
  expect(icon.padding).toBe('3px');
});

test('the action button can take the background of the chart', () => {
  const { box } = actionButtonStyles(
    { matchBackground: true, fill: { show: false } },
    { background: '#123456' },
    supersetTheme,
  );
  expect(box.backgroundColor).toBe('#123456');
});
