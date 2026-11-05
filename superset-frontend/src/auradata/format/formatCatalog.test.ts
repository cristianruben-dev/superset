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
/**
 * Generates and guards superset/auradata/catalog/format_catalog.json, the
 * format catalog of the MCP service. It fails when the committed file no
 * longer matches the control panels; run with UPDATE_FORMAT_CATALOG=1 to write
 * it again after a deliberate change.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { VizType } from '@superset-ui/core';
import type { ChartPlugin } from '@superset-ui/core';
import {
  BigNumberChartPlugin,
  BigNumberTotalChartPlugin,
  EchartsAreaChartPlugin,
  EchartsBoxPlotChartPlugin,
  EchartsBubbleChartPlugin,
  EchartsBulletChartPlugin,
  EchartsButterflyChartPlugin,
  EchartsFunnelChartPlugin,
  EchartsGanttChartPlugin,
  EchartsGaugeChartPlugin,
  EchartsGraphChartPlugin,
  EchartsHeatmapChartPlugin,
  EchartsHistogramChartPlugin,
  EchartsMixedTimeseriesChartPlugin,
  EchartsPieChartPlugin,
  EchartsRadarChartPlugin,
  EchartsSankeyChartPlugin,
  EchartsSunburstChartPlugin,
  EchartsTimeseriesBarChartPlugin,
  EchartsTimeseriesChartPlugin,
  EchartsTimeseriesLineChartPlugin,
  EchartsTimeseriesScatterChartPlugin,
  EchartsTimeseriesSmoothLineChartPlugin,
  EchartsTimeseriesStepChartPlugin,
  EchartsTreeChartPlugin,
  EchartsTreemapChartPlugin,
  EchartsWaterfallChartPlugin,
} from '@superset-ui/plugin-chart-echarts';
import TableChartPlugin from '@superset-ui/plugin-chart-table';
import { PivotTableChartPlugin } from '@superset-ui/plugin-chart-pivot-table';
import { buildFormatCatalog } from './formatCatalog';

const REPO = join(__dirname, '..', '..', '..', '..');
const CATALOG = join(
  REPO,
  'superset',
  'auradata',
  'catalog',
  'format_catalog.json',
);
const UPDATE = process.env.UPDATE_FORMAT_CATALOG === '1';

// The chart types of the report editor, as MainPreset registers them
const PLUGINS: [string, new () => ChartPlugin][] = [
  [VizType.BigNumber, BigNumberChartPlugin],
  [VizType.BigNumberTotal, BigNumberTotalChartPlugin],
  [VizType.BoxPlot, EchartsBoxPlotChartPlugin],
  [VizType.Bubble, EchartsBubbleChartPlugin],
  [VizType.Bullet, EchartsBulletChartPlugin],
  [VizType.Butterfly, EchartsButterflyChartPlugin],
  [VizType.Funnel, EchartsFunnelChartPlugin],
  [VizType.Gantt, EchartsGanttChartPlugin],
  [VizType.Gauge, EchartsGaugeChartPlugin],
  [VizType.Graph, EchartsGraphChartPlugin],
  [VizType.Heatmap, EchartsHeatmapChartPlugin],
  [VizType.Histogram, EchartsHistogramChartPlugin],
  [VizType.MixedTimeseries, EchartsMixedTimeseriesChartPlugin],
  [VizType.Pie, EchartsPieChartPlugin],
  [VizType.PivotTable, PivotTableChartPlugin],
  [VizType.Radar, EchartsRadarChartPlugin],
  [VizType.Sankey, EchartsSankeyChartPlugin],
  [VizType.Sunburst, EchartsSunburstChartPlugin],
  [VizType.Table, TableChartPlugin],
  [VizType.Area, EchartsAreaChartPlugin],
  [VizType.Timeseries, EchartsTimeseriesChartPlugin],
  [VizType.Bar, EchartsTimeseriesBarChartPlugin],
  [VizType.Line, EchartsTimeseriesLineChartPlugin],
  [VizType.SmoothLine, EchartsTimeseriesSmoothLineChartPlugin],
  [VizType.Scatter, EchartsTimeseriesScatterChartPlugin],
  [VizType.Step, EchartsTimeseriesStepChartPlugin],
  [VizType.Tree, EchartsTreeChartPlugin],
  [VizType.Treemap, EchartsTreemapChartPlugin],
  [VizType.Waterfall, EchartsWaterfallChartPlugin],
];

beforeAll(() => {
  PLUGINS.forEach(([key, Plugin]) =>
    new Plugin().configure({ key }).register(),
  );
});

/**
 * The catalog as committed: indented, with one control per line so a change
 * shows as a short diff.
 */
const generate = () =>
  `${JSON.stringify(
    buildFormatCatalog(PLUGINS.map(([key]) => key)),
    (key, value) =>
      key === 'controls'
        ? (value as unknown[]).map(control => `@@${JSON.stringify(control)}`)
        : value,
    2,
  ).replace(
    /"@@(.*)"(,?)$/gm,
    (_, control: string, comma: string) =>
      `${JSON.parse(`"${control}"`)}${comma}`,
  )}\n`;

test('the committed format catalog matches the control panels', () => {
  const catalog = generate();
  if (UPDATE) writeFileSync(CATALOG, catalog);
  expect(existsSync(CATALOG)).toBe(true);
  // Compared as text: a stale catalog shows as a diff of the JSON
  expect(readFileSync(CATALOG, 'utf8')).toBe(catalog);
});

test('the catalog places the controls of the pane by level', () => {
  const { charts } = JSON.parse(generate());
  const bar = charts[VizType.Bar].sections;
  const levelOf = (key: string) =>
    bar.find((section: { controls: { key: string }[] }) =>
      section.controls.some(control => control.key === key),
    )?.level;
  expect(levelOf('show_legend')).toBe('visual');
  expect(levelOf('reference_lines')).toBe('analytics');
  // Data controls never reach the catalog
  expect(levelOf('metrics')).toBeUndefined();
  expect(levelOf('groupby')).toBeUndefined();
});
