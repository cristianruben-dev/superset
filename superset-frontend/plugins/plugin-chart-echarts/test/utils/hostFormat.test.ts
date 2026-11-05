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
import { applyHostFormat, sentenceFormatter } from '../../src/utils/formatting';

const options = {
  tooltip: { className: 'echarts-tooltip', trigger: 'axis' },
  series: [{ type: 'line' }, { type: 'scatter' }],
};

test('leaves the options alone when the page asks for nothing', () => {
  expect(applyHostFormat(options, undefined)).toBe(options);
  expect(applyHostFormat(options, 'not json')).toBe(options);
});

test('gives the tooltip the look the report asks for', () => {
  const { tooltip } = applyHostFormat(
    options,
    JSON.stringify({
      tooltip: {
        background: 'rgba(0, 0, 0, 0.5)',
        fontSize: 18,
        bold: true,
        labelColor: '#111111',
        valueColor: '#222222',
        boldValues: true,
      },
    }),
  ) as Record<string, any>;
  expect(tooltip.trigger).toBe('axis');
  expect(tooltip.backgroundColor).toBe('rgba(0, 0, 0, 0.5)');
  expect(tooltip.className).toBe('echarts-tooltip auradata-tooltip');
  expect(tooltip.textStyle).toEqual({ fontSize: 18, fontWeight: 'bold' });
  expect(tooltip.extraCssText).toBe(
    '--mb-tt-label:#111111;--mb-tt-value:#222222;--mb-tt-value-weight:700',
  );
});

test('hides the tooltip', () => {
  const { tooltip } = applyHostFormat(
    options,
    JSON.stringify({ tooltip: { show: false } }),
  ) as Record<string, any>;
  expect(tooltip.show).toBe(false);
});

test('samples dense series', () => {
  const { series } = applyHostFormat(
    options,
    JSON.stringify({ sampling: true }),
  ) as Record<string, any>;
  expect(series[0].sampling).toBe('lttb');
  expect(series[1].large).toBe(true);
});

test('a sentence replaces the tokens and escapes what comes from the data', () => {
  const format = sentenceFormatter('{series} en {name}: {value}');
  expect(
    format({ seriesName: 'Ventas', name: '<b>Sur</b>', value: [1, 20] }),
  ).toBe('Ventas en &lt;b&gt;Sur&lt;/b&gt;: 20');
  expect(
    format([
      { seriesName: 'A', name: 'x', value: 1 },
      { seriesName: 'B', name: 'x', value: 2 },
    ]),
  ).toBe('A en x: 1<br/>B en x: 2');
});

test('a tooltip page hides the tooltip box and keeps the pointer marks', () => {
  const options = { tooltip: { trigger: 'axis', show: true } };
  const next = applyHostFormat(options, JSON.stringify({ tooltipPage: true }));
  expect(next.tooltip).toMatchObject({
    trigger: 'axis',
    show: true,
    showContent: false,
  });
  expect(applyHostFormat(options, JSON.stringify({})).tooltip).toBe(
    options.tooltip,
  );
});
