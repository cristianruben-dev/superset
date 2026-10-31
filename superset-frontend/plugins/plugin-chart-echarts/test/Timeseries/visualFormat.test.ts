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
import { ChartDataResponseResult, DataRecord } from '@superset-ui/core';
import transformProps from '../../src/Timeseries/transformProps';
import {
  EchartsTimeseriesFormData,
  EchartsTimeseriesSeriesType,
  OrientationType,
} from '../../src/Timeseries/types';
import {
  EchartsTimeseriesChartProps,
  LegendOrientation,
  LegendType,
} from '../../src/types';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import { createEchartsTimeseriesTestChartProps } from '../helpers';
import { createTestData } from './helpers';

const queriesData = [
  {
    data: createTestData(
      [
        { 'San Francisco': 1234, 'New York': 2345 },
        { 'San Francisco': 3456, 'New York': 4567 },
      ],
      { intervalMs: 300000000 },
    ) as DataRecord[],
    colnames: [],
    coltypes: [],
    label_map: {},
  } as unknown as ChartDataResponseResult,
];

const createProps = (formData: Partial<EchartsTimeseriesFormData>) =>
  createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'echarts_timeseries_bar',
    defaultQueriesData: queriesData,
    formData: {
      metric: 'sum__num',
      groupby: ['city'],
      seriesType: EchartsTimeseriesSeriesType.Bar,
      ...formData,
    },
  });

type LabelledSeries = {
  name?: string;
  label?: Record<string, unknown> & {
    formatter?: (params: unknown) => string;
  };
};

const getDataSeries = (result: ReturnType<typeof transformProps>) =>
  (result.echartOptions.series as LabelledSeries[]).filter(s =>
    ['San Francisco', 'New York'].includes(String(s.name)),
  );

test('default form data keeps the original label, legend and axis output', () => {
  const result = transformProps(createProps({ showValue: true }));
  const [series] = getDataSeries(result);
  expect(series.label).not.toHaveProperty('fontSize');
  expect(series.label).not.toHaveProperty('backgroundColor');
  expect(series.label).not.toHaveProperty('rotate');
  const { xAxis, yAxis } = result.echartOptions as Record<
    string,
    Record<string, unknown>
  >;
  expect(xAxis).not.toHaveProperty('inverse');
  expect(yAxis).not.toHaveProperty('nameTextStyle');
});

test('styles data labels and overrides their number format', () => {
  const result = transformProps(
    createProps({
      showValue: true,
      valueLabelFont: { fontSize: 15, bold: true, color: '#ff0000' },
      valueLabelBackground: '#000000',
      valueLabelRotate: 90,
      valueLabelFormat: '.3s',
    }),
  );
  const series = getDataSeries(result);
  expect(series).toHaveLength(2);
  series.forEach(s => {
    expect(s.label).toEqual(
      expect.objectContaining({
        show: true,
        fontSize: 15,
        fontWeight: 'bold',
        color: '#ff0000',
        backgroundColor: '#000000',
        rotate: 90,
      }),
    );
  });
  const formatted = series[0].label?.formatter?.({
    value: [0, 1234],
    dataIndex: 0,
    seriesIndex: 0,
    seriesName: series[0].name,
  });
  expect(formatted).toBe('1.23k');
});

test('styles and aligns the native legend', () => {
  const result = transformProps(
    createProps({
      showLegend: true,
      legendType: LegendType.Scroll,
      legendOrientation: LegendOrientation.Top,
      legendAlign: 'center',
      legendIcon: 'circle',
      legendFont: { fontSize: 14, italic: true },
    }),
  );
  const legend = result.echartOptions.legend as Record<string, unknown>;
  expect(legend.left).toBe('center');
  expect(legend).not.toHaveProperty('right');
  expect(legend.icon).toBe('circle');
  expect(legend.textStyle).toEqual(
    expect.objectContaining({ fontSize: 14, fontStyle: 'italic' }),
  );
});

test('passes legend style to the custom plain legend', () => {
  const result = transformProps(
    createProps({
      showLegend: true,
      legendType: LegendType.Plain,
      legendOrientation: LegendOrientation.Bottom,
      legendAlign: 'end',
      legendIcon: 'diamond',
      legendFont: { color: '#123456' },
    }),
  );
  expect(result.customLegend?.style).toEqual({
    align: 'end',
    icon: 'diamond',
    textStyle: { color: '#123456' },
  });
});

test('formats axes before swapping them on horizontal charts', () => {
  const formData = {
    xAxisLabelFont: { fontSize: 9 },
    yAxisTitleFont: { color: '#00ff00' },
    yAxisTitle: 'Revenue',
    xAxisInverse: true,
    gridlines: true,
    gridlineColor: '#dddddd',
    gridlineStyle: 'dashed',
  };
  const vertical = transformProps(createProps(formData))
    .echartOptions as Record<string, Record<string, any>>;
  expect(vertical.xAxis.axisLabel.fontSize).toBe(9);
  expect(vertical.xAxis.inverse).toBe(true);
  expect(vertical.yAxis.nameTextStyle).toEqual({ color: '#00ff00' });
  expect(vertical.yAxis.splitLine.lineStyle).toEqual({
    color: '#dddddd',
    width: 1,
    type: 'dashed',
  });

  const horizontal = transformProps(
    createProps({ ...formData, orientation: OrientationType.Horizontal }),
  ).echartOptions as Record<string, Record<string, any>>;
  // The dimension ("X") axis is drawn vertically on horizontal bar charts.
  expect(horizontal.yAxis.axisLabel.fontSize).toBe(9);
  expect(horizontal.yAxis.inverse).toBe(true);
  expect(horizontal.xAxis.nameTextStyle).toEqual({ color: '#00ff00' });
});

type StyledSeries = LabelledSeries & {
  type?: string;
  itemStyle?: Record<string, unknown>;
  barCategoryGap?: string;
  data?: unknown[];
};

test('applies series colors and bar styles', () => {
  const result = transformProps(
    createProps({
      seriesColors: { 'New York': '#123456' },
      barCategoryGap: 50,
      barBorderRadius: 4,
    }),
  );
  const series = getDataSeries(result) as StyledSeries[];
  const newYork = series.find(s => s.name === 'New York');
  const sanFrancisco = series.find(s => s.name === 'San Francisco');
  expect(newYork?.itemStyle?.color).toBe('#123456');
  expect(sanFrancisco?.itemStyle?.color).not.toBe('#123456');
  series.forEach(s => {
    expect(s.barCategoryGap).toBe('50%');
    expect(s.itemStyle?.borderRadius).toEqual([4, 4, 0, 0]);
  });
});

test('colors bars whose value matches a conditional rule', () => {
  const result = transformProps(
    createProps({
      chartConditionalFormatting: [
        {
          operator: '>',
          value: 4000,
          color: '#ff0000',
          target: 'both',
          series: 'New York',
        },
      ],
    }),
  );
  const series = getDataSeries(result) as StyledSeries[];
  const newYork = series.find(s => s.name === 'New York');
  const sanFrancisco = series.find(s => s.name === 'San Francisco');
  const [first, second] = (newYork?.data ?? []) as Record<string, any>[];
  expect(Array.isArray(first) || !first.itemStyle).toBe(true);
  expect(second.itemStyle).toEqual({ color: '#ff0000' });
  expect(second.label).toEqual(expect.objectContaining({ color: '#ff0000' }));
  expect(sanFrancisco?.data).toBeDefined();
  (sanFrancisco?.data ?? []).forEach(point => {
    expect(point).not.toHaveProperty('itemStyle');
  });
});
