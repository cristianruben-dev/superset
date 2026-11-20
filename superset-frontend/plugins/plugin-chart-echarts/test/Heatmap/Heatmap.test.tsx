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
import { render } from '@testing-library/react';
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Heatmap from '../../src/Heatmap/Heatmap';
import transformProps from '../../src/Heatmap/transformProps';
import { HeatmapChartProps } from '../../src/Heatmap/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const JAN = Date.UTC(2024, 0, 1);
const FEB = Date.UTC(2024, 1, 1);

function setup(formData: Record<string, unknown> = {}) {
  const onContextMenu = jest.fn();
  const chartProps = new ChartProps({
    formData: {
      datasource: '5__table',
      viz_type: 'heatmap_v2',
      xAxis: 'order_date',
      groupby: 'region',
      metric: 'count',
      linearColorScheme: 'blue_white_yellow',
      xAxisTimeFormat: '%Y-%m',
      borderColor: { r: 255, g: 255, b: 255, a: 1 },
      borderWidth: 1,
      valueBounds: [null, null],
      ...formData,
    },
    width: 800,
    height: 600,
    queriesData: [
      {
        data: [
          { order_date: JAN, region: 'North', count: 3 },
          { order_date: FEB, region: 'South', count: 5 },
        ],
        colnames: ['order_date', 'region', 'count'],
        coltypes: [2, 1, 0],
      },
    ],
    hooks: { onContextMenu },
    theme: supersetTheme,
  });
  render(
    <Heatmap {...transformProps(chartProps as unknown as HeatmapChartProps)} />,
  );
  const { eventHandlers } = mockedEchart.mock.calls.at(-1)![0] as {
    eventHandlers: EventHandlers;
  };
  return { eventHandlers, onContextMenu };
}

const pointer = () => ({
  stop: jest.fn(),
  event: { clientX: 10, clientY: 20 } as PointerEvent,
});

test('a cell on a date axis with a grain names the period of its date', () => {
  const { eventHandlers, onContextMenu } = setup({ timeGrainSqla: 'P1M' });
  eventHandlers.contextmenu({ value: [0, 0, 3], event: pointer() });
  const [x, y, { drillToDetail }] = onContextMenu.mock.calls[0];
  expect([x, y]).toEqual([10, 20]);
  expect(drillToDetail).toEqual([
    {
      col: 'order_date',
      op: '==',
      val: JAN,
      formattedVal: '2024-01',
      grain: 'P1M',
    },
    { col: 'region', op: '==', val: 'North', formattedVal: 'North' },
  ]);
});

test('without a grain a date names itself, and other columns never get one', () => {
  const { eventHandlers, onContextMenu } = setup();
  eventHandlers.contextmenu({ value: [1, 1, 5], event: pointer() });
  const [, , { drillToDetail }] = onContextMenu.mock.calls[0];
  expect(drillToDetail).toEqual([
    { col: 'order_date', op: '==', val: FEB, formattedVal: '2024-02' },
    { col: 'region', op: '==', val: 'South', formattedVal: 'South' },
  ]);
});
