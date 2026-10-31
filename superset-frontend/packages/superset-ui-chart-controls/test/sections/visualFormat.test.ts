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
import { getSeriesNamesFromChart } from '../../src/sections/visualFormat';

const controls = (values: Record<string, unknown>) => ({
  controls: Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { value }]),
  ),
});

test('lists metric series and leaves out the x-axis column', () => {
  expect(
    getSeriesNamesFromChart(
      {
        queriesResponse: [
          {
            label_map: {
              mes: ['mes'],
              Ingresos: ['Ingresos'],
              Costos: ['Costos'],
            },
          },
        ],
      },
      controls({ x_axis: 'mes', groupby: [] }),
    ),
  ).toEqual(['Ingresos', 'Costos']);
});

test('lists groups and leaves out dimension columns and lone metrics', () => {
  expect(
    getSeriesNamesFromChart(
      {
        queriesResponse: [
          {
            label_map: {
              mes: ['mes'],
              region: ['region'],
              Ingresos: ['Ingresos'],
              Norte: ['Norte'],
              Sur: ['Sur'],
            },
          },
        ],
      },
      controls({
        x_axis: 'mes',
        groupby: ['region'],
        metrics: [{ label: 'Ingresos' }],
      }),
    ),
  ).toEqual(['Norte', 'Sur']);
});

test('uses multi-label entries when series combine metric and group', () => {
  expect(
    getSeriesNamesFromChart({
      queriesResponse: [
        {
          label_map: {
            mes: ['mes'],
            'Ingresos, Norte': ['Ingresos', 'Norte'],
            'Costos, Norte': ['Costos', 'Norte'],
          },
        },
      ],
    }),
  ).toEqual(['Ingresos, Norte', 'Costos, Norte']);
});

test('returns no names before the chart has run', () => {
  expect(getSeriesNamesFromChart(undefined)).toEqual([]);
  expect(getSeriesNamesFromChart({ queriesResponse: null })).toEqual([]);
});
