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
  applyChartFormat,
  applySeriesFormat,
  getDisplayFormatter,
  mixColors,
  secondaryYAxisFormatOptions,
  xAxisFormatOptions,
  yAxisFormatOptions,
} from '../../src/utils/chartFormatOptions';
import {
  applyAxisFormatting,
  parseDashArray,
} from '../../src/utils/formatting';

const bar = (name: string, data: unknown[], extra = {}) => ({
  name,
  type: 'bar',
  data,
  itemStyle: { color: '#ff0000', opacity: 1, borderWidth: 0 },
  label: { show: true, position: 'top', formatter: () => '10' },
  ...extra,
});

const line = (name: string, extra = {}) => ({
  name,
  type: 'line',
  data: [['a', 1]],
  itemStyle: { color: '#00ff00', opacity: 1 },
  lineStyle: { opacity: 1 },
  label: { show: false, position: 'top', formatter: () => '1' },
  ...extra,
});

test('nothing set leaves a series and the options as they are', () => {
  const series = bar('A', [['a', 1]]);
  expect(applySeriesFormat(series, {})).toBe(series);
  const options = { series: [series], grid: {}, legend: { data: ['A'] } };
  expect(applyChartFormat(options, {})).toBe(options);
});

test('display units scale a number and keep percentages', () => {
  expect(getDisplayFormatter(null, null)).toBeUndefined();
  expect(getDisplayFormatter('thousands', 1)?.(2500)).toBe('2.5K');
  expect(getDisplayFormatter('millions', 0)?.(3000000)).toBe('3M');
  expect(getDisplayFormatter('auto', 1)?.(2500000000)).toBe('2.5B');
  expect(getDisplayFormatter('auto', 1)?.(12)).toBe('12.0');
  expect(getDisplayFormatter(null, 2)?.(1234.5)).toBe('1,234.50');
  expect(getDisplayFormatter('millions', 1, true)?.(0.25)).toBe('25.0%');
});

test('each axis takes its own gridlines over the shared ones', () => {
  const format = {
    gridlineColor: '#111111',
    xGridlinesShow: true,
    yGridlineColor: '#222222',
    yGridlineDash: '4 2',
    yGridlineCap: 'round',
  } as never;
  const x = applyAxisFormatting(
    { type: 'category' },
    xAxisFormatOptions(format),
  ) as any;
  expect(x.splitLine.show).toBe(true);
  expect(x.splitLine.lineStyle.color).toBe('#111111');
  const y = applyAxisFormatting(
    { type: 'value' },
    yAxisFormatOptions(format),
  ) as any;
  expect(y.splitLine.lineStyle).toMatchObject({
    color: '#222222',
    type: [4, 2],
    cap: 'round',
  });
});

test('a dash pattern needs positive lengths', () => {
  expect(parseDashArray('4, 2')).toEqual([4, 2]);
  expect(parseDashArray('a')).toBeUndefined();
  expect(parseDashArray('')).toBeUndefined();
  expect(parseDashArray(null)).toBeUndefined();
});

test('axes switch sides by the orientation of the chart', () => {
  const format = { xAxisSwitchPosition: true, yAxisSwitchPosition: true };
  expect(xAxisFormatOptions(format).position).toBe('top');
  expect(xAxisFormatOptions(format, true).position).toBe('right');
  expect(yAxisFormatOptions(format).position).toBe('right');
  expect(yAxisFormatOptions(format, { isHorizontal: true }).position).toBe(
    'top',
  );
  expect(secondaryYAxisFormatOptions(format).position).toBe('left');
});

test('a logarithmic scale and units only touch a numeric axis', () => {
  const options = { logScale: true, labelFormatter: () => 'x' };
  const category = applyAxisFormatting({ type: 'category' }, options) as any;
  expect(category.type).toBe('category');
  expect(category.axisLabel).toBeUndefined();
  const value = applyAxisFormatting({ type: 'value' }, options) as any;
  expect(value.type).toBe('log');
  expect(value.axisLabel.formatter()).toBe('x');
});

test('the label position follows the mark and drops the one of negative bars', () => {
  const series = bar('A', [
    { value: ['a', -1], label: { position: 'outside' } },
  ]);
  const next = applySeriesFormat(series, {
    valueLabelPosition: 'insideEnd',
    valueLabelTransparency: 50,
    valueLabelMaxWidth: 40,
    valueLabelDistance: 8,
  }) as any;
  expect(next.label).toMatchObject({
    position: 'insideTop',
    opacity: 0.5,
    width: 40,
    overflow: 'truncate',
    distance: 8,
  });
  expect(next.data[0].label.position).toBeUndefined();
  const horizontal = applySeriesFormat(
    bar('A', []),
    { valueLabelPosition: 'insideEnd' },
    true,
  ) as any;
  expect(horizontal.label.position).toBe('insideRight');
  const onLine = applySeriesFormat(line('A'), {
    valueLabelPosition: 'below',
  }) as any;
  expect(onLine.label.position).toBe('bottom');
});

test('bars take transparency, overlap, border and category colors', () => {
  const next = applySeriesFormat(
    bar('A', [
      ['a', 1],
      ['b', 2],
    ]),
    {
      barTransparency: 25,
      barOverlap: 30,
      barBorderOnly: true,
      categoryColors: { b: '#0000ff' },
    },
  ) as any;
  expect(next.barGap).toBe('-30%');
  expect(next.itemStyle).toMatchObject({
    opacity: 0.75,
    color: 'transparent',
    borderColor: '#ff0000',
    borderWidth: 1,
  });
  expect(next.data[0]).toEqual(['a', 1]);
  expect(next.data[1].itemStyle.color).toBe('#0000ff');
});

test('a default color skips the series with a color of their own', () => {
  const format = {
    seriesDefaultColor: '#123456',
    seriesColors: { B: '#654321' },
  } as never;
  const a = applySeriesFormat(bar('A', []), format) as any;
  expect(a.itemStyle.color).toBe('#123456');
  const b = applySeriesFormat(bar('B', []), format) as any;
  expect(b.itemStyle.color).toBe('#ff0000');
});

test('lines take interpolation, dash, transparency and can hide', () => {
  const smooth = applySeriesFormat(line('A', { step: 'start' }), {
    lineInterpolation: 'monotone',
    lineSmoothness: 40,
  }) as any;
  expect(smooth).toMatchObject({
    step: undefined,
    smooth: 0.4,
    smoothMonotone: 'x',
  });
  const step = applySeriesFormat(line('A', { smooth: true }), {
    lineInterpolation: 'end',
  }) as any;
  expect(step).toMatchObject({ step: 'end', smooth: false });
  const styled = applySeriesFormat(line('A'), {
    seriesLineDash: '6 3',
    seriesLineCap: 'round',
    lineTransparency: 50,
  }) as any;
  expect(styled.lineStyle).toMatchObject({
    type: [6, 3],
    cap: 'round',
    opacity: 0.5,
  });
  const hidden = applySeriesFormat(line('A'), { lineHidden: true }) as any;
  expect(hidden.lineStyle).toMatchObject({ opacity: 0, width: 0 });
});

test('a time comparison keeps its dash pattern', () => {
  const next = applySeriesFormat(line('A', { lineStyle: { type: [1, 1] } }), {
    seriesLineDash: '6 3',
  }) as any;
  expect(next.lineStyle.type).toEqual([1, 1]);
});

test('a marker color leaves the line with the color of the series', () => {
  const next = applySeriesFormat(line('A'), {
    markerColor: '#0000ff',
    markerTransparency: 50,
    markerBorderWidth: 2,
    markerBorderMatchFill: true,
    markerRotation: 45,
  }) as any;
  expect(next.itemStyle).toMatchObject({
    color: '#0000ff',
    opacity: 0.5,
    borderWidth: 2,
    borderColor: '#0000ff',
  });
  expect(next.lineStyle.color).toBe('#00ff00');
  expect(next.symbolRotate).toBe(45);
});

test('a series can differ from the rest of the chart', () => {
  const format = {
    lineTransparency: 10,
    seriesFormat: {
      A: {
        lineTransparency: 50,
        lineType: 'dotted',
        showLabels: true,
        labelColor: '#abcdef',
        markerEnabled: true,
        markerSize: 9,
      },
    },
  };
  const a = applySeriesFormat(line('A', { showSymbol: false }), format) as any;
  expect(a.lineStyle).toMatchObject({ opacity: 0.5, type: 'dotted' });
  expect(a.label).toMatchObject({ show: true, color: '#abcdef' });
  expect(a).toMatchObject({ showSymbol: true, symbolSize: 9 });
  const b = applySeriesFormat(line('B'), format) as any;
  expect(b.lineStyle.opacity).toBe(0.9);
  expect(b.label.show).toBe(false);
});

test('the color scale spares what a rule colored and other marks', () => {
  const options = {
    series: [
      bar('A', [
        ['a', 0],
        ['b', 10],
        { value: ['c', 5], itemStyle: { color: '#123456' } },
      ]),
      line('L'),
    ],
  };
  const next = applyChartFormat(options, {
    colorScaleMin: '#000000',
    colorScaleMax: '#ffffff',
  }) as any;
  expect(next.series[0].data[0].itemStyle.color).toBe('rgba(0, 0, 0, 1)');
  expect(next.series[0].data[1].itemStyle.color).toBe('rgba(255, 255, 255, 1)');
  expect(next.series[0].data[2].itemStyle.color).toBe('#123456');
  expect(next.series[1].data).toEqual([['a', 1]]);
});

test('colors mix from the share between them', () => {
  expect(mixColors('#000000', '#ffffff', 0.5)).toBe('rgba(128, 128, 128, 1)');
  expect(mixColors('rgba(0, 0, 0, 0)', '#000000', 0.5)).toBe(
    'rgba(0, 0, 0, 0.5)',
  );
});

test('labels gather a title, the value and a detail', () => {
  const options = {
    series: [
      bar('A', [['a', 25]], { label: { formatter: () => '25' } }),
      bar('B', [['a', 75]], { label: { formatter: () => '' } }),
    ],
  };
  const next = applyChartFormat(options, {
    valueLabelTitle: 'series',
    valueLabelDetail: 'percent',
    valueLabelTitleFont: { bold: true },
  }) as any;
  const params = { seriesName: 'A', value: ['a', 25] };
  expect(next.series[0].label.formatter(params)).toBe(
    '{title|A}\n25\n{detail|25.0%}',
  );
  expect(next.series[0].label.rich.title.fontWeight).toBe('bold');
  // A stack leaves a label empty to hide it
  expect(next.series[1].label.formatter(params)).toBe('');
  const inline = applyChartFormat(options, {
    valueLabelHideValue: true,
    valueLabelDetail: 'category',
    valueLabelLayout: 'inline',
  }) as any;
  expect(inline.series[0].label.formatter(params)).toBe('{detail|a}');
});

test('total labels add a mark at the end of each stack', () => {
  const options = {
    series: [
      bar(
        'A',
        [
          ['a', 1],
          ['b', -2],
        ],
        { stack: 'obs', stackStrategy: 'samesign' },
      ),
      bar(
        'B',
        [
          ['a', 2],
          ['b', 3],
        ],
        { stack: 'obs', stackStrategy: 'samesign' },
      ),
      bar('Hidden', [['a', 100]], { stack: 'obs' }),
    ],
  };
  const next = applyChartFormat(
    options,
    { totalLabelsShow: true, totalLabelUnits: 'none', totalLabelDecimals: 0 },
    { legendState: { Hidden: false } },
  ) as any;
  const total = next.series[3];
  expect(next.series).toHaveLength(4);
  expect(total).toMatchObject({
    type: 'bar',
    stack: 'obs',
    silent: true,
    tooltip: { show: false },
  });
  expect(total.data).toEqual([
    ['a', 0],
    ['b', 0],
  ]);
  expect(total.label.formatter({ dataIndex: 0 })).toBe('3');
  expect(total.label.formatter({ dataIndex: 1 })).toBe('1');
});

test('total labels can split by sign and skip a stream', () => {
  const stacked = (strategy: string) => ({
    series: [
      bar(
        'A',
        [
          ['a', 1],
          ['a', -4],
        ],
        { stack: 'obs', stackStrategy: strategy },
      ),
    ],
  });
  const split = applyChartFormat(stacked('samesign'), {
    totalLabelsShow: true,
    totalLabelSplitSign: true,
    totalLabelDecimals: 0,
  }) as any;
  expect(split.series).toHaveLength(3);
  expect(split.series[1].label.formatter({ dataIndex: 0 })).toBe('1');
  expect(split.series[2].label.formatter({ dataIndex: 0 })).toBe('-4');
  expect(split.series[2].data[0][1]).toBeLessThan(0);
  const stream = applyChartFormat(stacked('all'), {
    totalLabelsShow: true,
  }) as any;
  expect(stream.series).toHaveLength(1);
});

test('series labels name each line and make room for it', () => {
  const next = applyChartFormat(
    { series: [line('A')], grid: { right: 10 } },
    { seriesLabelsShow: true, seriesLabelMatchColor: true },
  ) as any;
  const { endLabel } = next.series[0];
  expect(endLabel).toMatchObject({ show: true, color: '#00ff00' });
  expect(endLabel.formatter({ seriesName: 'A' })).toBe('A');
  expect(next.grid.right).toBe(106);
});

test('the legend can match the series and take a title', () => {
  const next = applyChartFormat(
    { series: [line('A')], legend: { data: ['A'] } },
    { legendMatchColor: true, legendTitle: ' Region ' },
  ) as any;
  expect(next.legend.data[0]).toMatchObject({ name: 'Region', icon: 'none' });
  expect(next.legend.data[1].textStyle.color).toBe('#00ff00');
  expect(next.series[1]).toMatchObject({ name: 'Region', data: [] });
});

test('a bar without fill keeps its color in the legend', () => {
  const series = applySeriesFormat(bar('A', []), { barBorderOnly: true });
  const next = applyChartFormat(
    { series: [series], legend: { data: ['A'] } },
    { barBorderOnly: true, legendMatchColor: true },
  ) as any;
  expect(next.legend.data[0]).toMatchObject({
    name: 'A',
    itemStyle: { color: '#ff0000' },
    textStyle: { color: '#ff0000' },
  });
});

test('the plot area takes a color or an image', () => {
  const color = applyChartFormat(
    { series: [], grid: { top: 1 } },
    { plotAreaColor: '#eeeeee' },
  ) as any;
  expect(color.grid).toEqual({
    top: 1,
    show: true,
    borderWidth: 0,
    backgroundColor: '#eeeeee',
  });
  const image = applyChartFormat(
    { series: [] },
    {
      plotAreaColor: '#eeeeee',
      plotAreaImage: 'a.png',
      plotAreaImageRepeat: 'no-repeat',
    },
  ) as any;
  expect(image.grid.backgroundColor).toEqual({
    image: 'a.png',
    repeat: 'no-repeat',
  });
});

test('categories that do not fit scroll, only on a categorical axis', () => {
  const data = ['a', 'b', 'c', 'd'].map(name => [name, 1]);
  const options = {
    series: [bar('A', data)],
    grid: { bottom: 10 },
    xAxis: { type: 'category' },
  };
  const format = { xAxisMinCategoryWidth: 50 };
  const next = applyChartFormat(options, format, { width: 100 }) as any;
  expect(next.dataZoom[0]).toMatchObject({
    type: 'slider',
    xAxisIndex: 0,
    startValue: 0,
    endValue: 1,
  });
  expect(next.grid.bottom).toBe(30);
  const atEnd = applyChartFormat(
    options,
    { ...format, xAxisScrollPosition: 'end' },
    { width: 100 },
  ) as any;
  expect(atEnd.dataZoom[0]).toMatchObject({ startValue: 2, endValue: 3 });
  const fits = applyChartFormat(options, format, { width: 500 }) as any;
  expect(fits.dataZoom).toBeUndefined();
  const time = applyChartFormat(
    { ...options, xAxis: { type: 'time' } },
    format,
    { width: 100 },
  ) as any;
  expect(time.dataZoom).toBeUndefined();
});
