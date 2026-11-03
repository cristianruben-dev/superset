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
import { applySpecialChartFormat } from '../../src/utils/specialChartFormat';

const dimensions = { width: 400, height: 300 };

test('absent family formatting preserves the original option', () => {
  const option = {
    series: [{ type: 'pie', data: [{ name: 'A', value: 10 }] }],
  };
  expect(applySpecialChartFormat(option, {}, 'pie', dimensions)).toBe(option);
});

test('scatter formatting retains coordinate arrays and limits ratio to numeric axes', () => {
  const point = [1, 2];
  const option = {
    xAxis: { type: 'time' },
    yAxis: { type: 'value' },
    series: [{ type: 'scatter', data: [point] }],
  };
  const formatted = applySpecialChartFormat(
    option,
    { scatterRatioShow: true, scatterSizeMultiplier: 2 },
    'scatter',
    dimensions,
  );
  expect(formatted.series[0].data[0]).toBe(point);
  expect(formatted.series[0]).not.toHaveProperty('markLine');
  expect(option.series[0]).not.toHaveProperty('symbolSize');
});

test('waterfall formatting preserves the transparent helper series', () => {
  const helper = {
    type: 'bar',
    data: [0, 10],
    itemStyle: { color: 'transparent' },
  };
  const option = {
    series: [
      helper,
      { type: 'bar', data: [{ value: 10, originalValue: 10, totalSum: 10 }] },
    ],
  };
  const formatted = applySpecialChartFormat(
    option,
    {
      specialFillColor: '#ff0000',
      colorScaleMin: '#ff0000',
      colorScaleMax: '#0000ff',
    },
    'waterfall',
    dimensions,
  );
  expect(formatted.series[0]).toEqual(helper);
  expect(option.series[1].data).toEqual([
    { value: 10, originalValue: 10, totalSum: 10 },
  ]);
});

test('gauge accepts a zero target and explicit hiding removes the extra pointer', () => {
  const option = {
    series: [{ type: 'gauge', min: -10, max: 10, data: [{ value: 5 }] }],
  };
  expect(
    applySpecialChartFormat(
      option,
      { gaugeTargetValue: 0 },
      'gauge',
      dimensions,
    ).series,
  ).toHaveLength(2);
  expect(
    applySpecialChartFormat(
      option,
      { gaugeTargetValue: 0, gaugeTargetShow: false },
      'gauge',
      dimensions,
    ).series,
  ).toHaveLength(1);
});

test('the center label has its own line and style over the value', () => {
  const next = applySpecialChartFormat(
    { series: [{ type: 'pie', radius: ['30%', '60%'], data: [{ value: 5 }] }] },
    {
      centerLabel: 'Total',
      centerLabelFont: { bold: true, color: '#ff0000' },
      centerValueFont: { fontSize: 20 },
    } as never,
    'pie',
    { width: 100, height: 100 },
  ) as unknown as { graphic: { style: Record<string, any> } };
  const { style } = next.graphic;
  expect(style.text).toBe('{label|Total}\n{value|5}');
  expect(style.rich.label).toMatchObject({
    fontWeight: 'bold',
    fill: '#ff0000',
  });
  expect(style.rich.value.fontSize).toBe(20);
});

test('labels keep the content the chart saved, as a funnel saves it', () => {
  const formatOf = (format: object) =>
    (
      applySpecialChartFormat(
        {
          series: [
            { type: 'funnel', label: {}, data: [{ name: 'A', value: 5 }] },
          ],
        },
        { valueLabelDecimals: 0, ...format } as never,
        'funnel',
        { width: 100, height: 100 },
      ) as unknown as {
        series: { label: { formatter: (params: unknown) => string } }[];
      }
    ).series[0].label.formatter({ name: 'A', value: 5, data: {} });
  expect(formatOf({ labelType: 3 })).toBe('{category|A}: {value|5}');
  expect(formatOf({})).toBe('{category|A}');
});
