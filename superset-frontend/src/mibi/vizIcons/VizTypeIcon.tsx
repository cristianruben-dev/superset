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
import type { ReactNode } from 'react';
import { css, styled } from '@apache-superset/core/theme';

/** Families of chart types that share a drawing. */
export type VizIconKind =
  | 'bar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'bubble'
  | 'pie'
  | 'kpi'
  | 'kpiTrend'
  | 'table'
  | 'pivot'
  | 'map'
  | 'heatmap'
  | 'calendar'
  | 'funnel'
  | 'gauge'
  | 'treemap'
  | 'sunburst'
  | 'sankey'
  | 'radar'
  | 'histogram'
  | 'boxplot'
  | 'waterfall'
  | 'graph'
  | 'tree'
  | 'mixed'
  | 'wordcloud'
  | 'gantt'
  | 'text'
  | 'chart';

const KINDS: Record<string, VizIconKind> = {
  echarts_timeseries_bar: 'bar',
  dist_bar: 'bar',
  bar: 'bar',
  bullet: 'bar',
  echarts_timeseries: 'line',
  echarts_timeseries_line: 'line',
  echarts_timeseries_smooth: 'line',
  echarts_timeseries_step: 'line',
  line: 'line',
  compare: 'line',
  time_pivot: 'line',
  horizon: 'line',
  echarts_area: 'area',
  area: 'area',
  echarts_timeseries_scatter: 'scatter',
  paired_ttest: 'scatter',
  bubble: 'bubble',
  bubble_v2: 'bubble',
  pie: 'pie',
  rose: 'pie',
  big_number_total: 'kpi',
  big_number: 'kpiTrend',
  pop_kpi: 'kpiTrend',
  table: 'table',
  ag_grid_table: 'table',
  time_table: 'table',
  pivot_table_v2: 'pivot',
  country_map: 'map',
  world_map: 'map',
  mapbox: 'map',
  cartodiagram: 'map',
  heatmap: 'heatmap',
  heatmap_v2: 'heatmap',
  cal_heatmap: 'calendar',
  funnel: 'funnel',
  gauge_chart: 'gauge',
  treemap: 'treemap',
  treemap_v2: 'treemap',
  sunburst: 'sunburst',
  sunburst_v2: 'sunburst',
  partition: 'sunburst',
  sankey: 'sankey',
  sankey_v2: 'sankey',
  chord: 'sankey',
  parallel_coordinates: 'sankey',
  radar: 'radar',
  histogram: 'histogram',
  histogram_v2: 'histogram',
  box_plot: 'boxplot',
  waterfall: 'waterfall',
  graph_chart: 'graph',
  tree_chart: 'tree',
  mixed_timeseries: 'mixed',
  word_cloud: 'wordcloud',
  gantt_chart: 'gantt',
  handlebars: 'text',
  markdown: 'text',
};

/** The drawing family of a viz type; deck.gl layers are maps. */
export function vizIconKind(vizType?: string | null): VizIconKind {
  if (!vizType) {
    return 'chart';
  }
  if (vizType.startsWith('deck_')) {
    return 'map';
  }
  return KINDS[vizType] || KINDS[vizType.replace(/-/g, '_')] || 'chart';
}

// Two tones: "soft" shapes use the current color at low opacity
const SOFT = 0.28;
const MID = 0.55;

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const DRAWINGS: Record<VizIconKind, ReactNode> = {
  bar: (
    <>
      <rect x="4.5" y="17" width="5.5" height="10" rx="1.6" fill="currentColor" opacity={SOFT} />
      <rect x="13.25" y="10.5" width="5.5" height="16.5" rx="1.6" fill="currentColor" opacity={MID} />
      <rect x="22" y="5" width="5.5" height="22" rx="1.6" fill="currentColor" />
    </>
  ),
  line: (
    <>
      <path d="M4 27.5h24" {...stroke} strokeWidth={1.6} opacity={SOFT} />
      <path d="M4.5 22 11 14.5l6 4.5L27.5 7" {...stroke} />
      <circle cx="11" cy="14.5" r="2.2" fill="currentColor" />
      <circle cx="17" cy="19" r="2.2" fill="currentColor" />
      <circle cx="27.5" cy="7" r="2.2" fill="currentColor" />
    </>
  ),
  area: (
    <>
      <path d="M4 22 11 13.5l6 4.5L28 7v20H4Z" fill="currentColor" opacity={SOFT} />
      <path d="M4 22 11 13.5l6 4.5L28 7" {...stroke} />
    </>
  ),
  scatter: (
    <>
      <path d="M4.5 4v23.5H28" {...stroke} strokeWidth={1.6} opacity={SOFT} />
      <circle cx="10" cy="21" r="2.3" fill="currentColor" opacity={MID} />
      <circle cx="14.5" cy="15" r="2.3" fill="currentColor" />
      <circle cx="19" cy="18.5" r="2.3" fill="currentColor" opacity={MID} />
      <circle cx="21.5" cy="10" r="2.3" fill="currentColor" />
      <circle cx="26" cy="6.5" r="2.3" fill="currentColor" opacity={MID} />
    </>
  ),
  bubble: (
    <>
      <circle cx="11" cy="19.5" r="6.5" fill="currentColor" opacity={SOFT} />
      <circle cx="21.5" cy="11" r="6" fill="currentColor" opacity={MID} />
      <circle cx="23.5" cy="23.5" r="3.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="2.5" fill="currentColor" />
    </>
  ),
  pie: (
    <>
      <circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="6" opacity={SOFT} />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        pathLength={100}
        strokeDasharray="36 100"
        transform="rotate(-90 16 16)"
      />
      <circle
        cx="16"
        cy="16"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        pathLength={100}
        strokeDasharray="0 38 22 100"
        transform="rotate(-90 16 16)"
        opacity={MID}
      />
    </>
  ),
  kpi: (
    <>
      <rect x="4" y="8" width="15" height="10" rx="2.5" fill="currentColor" />
      <rect x="4" y="22" width="10" height="3.5" rx="1.75" fill="currentColor" opacity={SOFT} />
      <path d="M25 22V9m-4 4 4-4 4 4" {...stroke} />
    </>
  ),
  kpiTrend: (
    <>
      <rect x="4" y="4.5" width="13" height="8" rx="2.2" fill="currentColor" />
      <path d="M4 27 10 21l5 3 6-7 7 3v7Z" fill="currentColor" opacity={SOFT} />
      <path d="M4 27 10 21l5 3 6-7 7 3" {...stroke} />
      <path d="M22 9.5h6m-6 0 2.5-2.5m-2.5 2.5L24.5 12" {...stroke} strokeWidth={1.8} opacity={MID} />
    </>
  ),
  table: (
    <>
      <rect x="4" y="5" width="24" height="22" rx="3" fill="currentColor" opacity={0.12} />
      <path d="M7 5h18a3 3 0 0 1 3 3v3H4V8a3 3 0 0 1 3-3Z" fill="currentColor" />
      <path d="M4 16.5h24M4 21.5h24M13 11v16" {...stroke} strokeWidth={1.6} opacity={MID} />
      <rect x="4" y="5" width="24" height="22" rx="3" {...stroke} strokeWidth={1.6} opacity={MID} />
    </>
  ),
  pivot: (
    <>
      <rect x="4" y="5" width="24" height="22" rx="3" fill="currentColor" opacity={0.12} />
      <path d="M7 5h18a3 3 0 0 1 3 3v3H4V8a3 3 0 0 1 3-3Z" fill="currentColor" />
      <rect x="4" y="11" width="8" height="16" fill="currentColor" opacity={MID} />
      <path d="M12 17.5h16M12 22.5h16M20 11v16" {...stroke} strokeWidth={1.6} opacity={MID} />
      <rect x="4" y="5" width="24" height="22" rx="3" {...stroke} strokeWidth={1.6} opacity={MID} />
    </>
  ),
  map: (
    <>
      <path d="M4 8.5 11 5.5l10 3 7-3V24l-7 3-10-3-7 3Z" fill="currentColor" opacity={SOFT} />
      <path d="M4 8.5 11 5.5l10 3 7-3V24l-7 3-10-3-7 3Z M11 5.5V24M21 8.5V27" {...stroke} strokeWidth={1.8} />
      <path d="M16 20.5s-4.5-4.2-4.5-7.5a4.5 4.5 0 0 1 9 0c0 3.3-4.5 7.5-4.5 7.5Z" fill="currentColor" />
      <circle cx="16" cy="13" r="1.6" fill="white" />
    </>
  ),
  heatmap: (
    <>
      {[0, 1, 2].flatMap(row =>
        [0, 1, 2].map(col => (
          <rect
            key={`${row}-${col}`}
            x={4.5 + col * 8}
            y={4.5 + row * 8}
            width="7"
            height="7"
            rx="1.8"
            fill="currentColor"
            opacity={[0.2, 0.45, 1, 0.45, 1, 0.7, 1, 0.7, 0.3][row * 3 + col]}
          />
        )),
      )}
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="6" width="24" height="21" rx="3" fill="currentColor" opacity={0.12} />
      <path d="M7 6h18a3 3 0 0 1 3 3v3H4V9a3 3 0 0 1 3-3Z" fill="currentColor" />
      <path d="M10 4v4M22 4v4" {...stroke} />
      {[0, 1].flatMap(row =>
        [0, 1, 2, 3].map(col => (
          <rect
            key={`${row}-${col}`}
            x={6.5 + col * 5.2}
            y={15 + row * 5.5}
            width="3.8"
            height="3.8"
            rx="1"
            fill="currentColor"
            opacity={[0.3, 1, 0.55, 0.3, 0.55, 0.3, 1, 0.55][row * 4 + col]}
          />
        )),
      )}
    </>
  ),
  funnel: (
    <>
      <rect x="4" y="5" width="24" height="5.5" rx="2" fill="currentColor" />
      <rect x="7.5" y="13.25" width="17" height="5.5" rx="2" fill="currentColor" opacity={MID} />
      <rect x="11" y="21.5" width="10" height="5.5" rx="2" fill="currentColor" opacity={SOFT} />
    </>
  ),
  gauge: (
    <>
      <path d="M5 22a11 11 0 0 1 22 0" {...stroke} strokeWidth={4.5} opacity={SOFT} />
      <path d="M5 22a11 11 0 0 1 14.5-10.4" {...stroke} strokeWidth={4.5} />
      <path d="m16 22 5.5-7" {...stroke} />
      <circle cx="16" cy="22" r="2.4" fill="currentColor" />
    </>
  ),
  treemap: (
    <>
      <rect x="4" y="4.5" width="13" height="23" rx="2.2" fill="currentColor" />
      <rect x="19" y="4.5" width="9" height="12" rx="2.2" fill="currentColor" opacity={MID} />
      <rect x="19" y="18.5" width="9" height="9" rx="2.2" fill="currentColor" opacity={SOFT} />
    </>
  ),
  sunburst: (
    <>
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="4" opacity={SOFT} />
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        pathLength={100}
        strokeDasharray="28 4 18 100"
        transform="rotate(-90 16 16)"
        opacity={MID}
      />
      <circle
        cx="16"
        cy="16"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        pathLength={100}
        strokeDasharray="52 100"
        transform="rotate(-90 16 16)"
      />
      <circle cx="16" cy="16" r="5" fill="none" stroke="currentColor" strokeWidth="4.5" opacity={SOFT} />
    </>
  ),
  sankey: (
    <>
      <path d="M7 6c9 0 9 9 18 9v4c-9 0-9-9-18-9Z" fill="currentColor" opacity={MID} />
      <path d="M7 16c9 0 9 8 18 8v3c-9 0-9-8-18-8Z" fill="currentColor" opacity={SOFT} />
      <rect x="4" y="5" width="3.5" height="14" rx="1.5" fill="currentColor" />
      <rect x="24.5" y="13.5" width="3.5" height="14" rx="1.5" fill="currentColor" />
    </>
  ),
  radar: (
    <>
      <path d="M16 4 27 12l-4 13H9L5 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity={SOFT} />
      <path d="M16 9.5 23 13l-3 9h-7.5L9 14Z" fill="currentColor" opacity={SOFT} />
      <path d="M16 9.5 23 13l-3 9h-7.5L9 14Z" {...stroke} />
      <circle cx="16" cy="9.5" r="1.8" fill="currentColor" />
      <circle cx="23" cy="13" r="1.8" fill="currentColor" />
    </>
  ),
  histogram: (
    <>
      <rect x="4" y="20" width="4.8" height="7" fill="currentColor" opacity={SOFT} />
      <rect x="8.8" y="13" width="4.8" height="14" fill="currentColor" opacity={MID} />
      <rect x="13.6" y="6" width="4.8" height="21" fill="currentColor" />
      <rect x="18.4" y="11" width="4.8" height="16" fill="currentColor" opacity={MID} />
      <rect x="23.2" y="19" width="4.8" height="8" fill="currentColor" opacity={SOFT} />
    </>
  ),
  boxplot: (
    <>
      <path d="M10 4v5m0 14v5M22 7v5m0 9v5M7 4h6M7 28h6M19 7h6M19 26h6" {...stroke} strokeWidth={1.8} opacity={MID} />
      <rect x="6" y="9" width="8" height="14" rx="1.8" fill="currentColor" />
      <rect x="18" y="12" width="8" height="9" rx="1.8" fill="currentColor" opacity={MID} />
      <path d="M6.5 16h7" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  waterfall: (
    <>
      <rect x="4" y="15" width="5" height="12" rx="1.4" fill="currentColor" />
      <rect x="10.5" y="8" width="5" height="7" rx="1.4" fill="currentColor" opacity={MID} />
      <rect x="17" y="8" width="5" height="5" rx="1.4" fill="currentColor" opacity={SOFT} />
      <rect x="23.5" y="13" width="5" height="14" rx="1.4" fill="currentColor" />
    </>
  ),
  graph: (
    <>
      <path d="M9 9l7 7m0 0 8-5m-8 5-6 8m6-8 8 9" {...stroke} strokeWidth={1.8} opacity={MID} />
      <circle cx="16" cy="16" r="3.6" fill="currentColor" />
      <circle cx="8" cy="8" r="2.8" fill="currentColor" opacity={MID} />
      <circle cx="24.5" cy="10.5" r="2.8" fill="currentColor" opacity={MID} />
      <circle cx="9.5" cy="25" r="2.8" fill="currentColor" opacity={MID} />
      <circle cx="24.5" cy="25" r="2.8" fill="currentColor" opacity={MID} />
    </>
  ),
  tree: (
    <>
      <path d="M16 9v5M8 14h16M8 14v5M24 14v5M16 14v5" {...stroke} strokeWidth={1.8} opacity={MID} />
      <rect x="11.5" y="3.5" width="9" height="6" rx="2" fill="currentColor" />
      <rect x="4" y="19.5" width="8" height="6" rx="2" fill="currentColor" opacity={MID} />
      <rect x="12" y="19.5" width="8" height="6" rx="2" fill="currentColor" opacity={MID} />
      <rect x="20" y="19.5" width="8" height="6" rx="2" fill="currentColor" opacity={MID} />
    </>
  ),
  mixed: (
    <>
      <rect x="5" y="17" width="5" height="10" rx="1.5" fill="currentColor" opacity={SOFT} />
      <rect x="13.5" y="13" width="5" height="14" rx="1.5" fill="currentColor" opacity={SOFT} />
      <rect x="22" y="19" width="5" height="8" rx="1.5" fill="currentColor" opacity={SOFT} />
      <path d="M4.5 13 11 9l6 4 10.5-7" {...stroke} />
      <circle cx="11" cy="9" r="2.2" fill="currentColor" />
      <circle cx="17" cy="13" r="2.2" fill="currentColor" />
    </>
  ),
  wordcloud: (
    <>
      <rect x="4" y="6" width="11" height="5" rx="2.5" fill="currentColor" opacity={MID} />
      <rect x="17" y="6" width="11" height="5" rx="2.5" fill="currentColor" opacity={SOFT} />
      <rect x="6" y="13.5" width="20" height="6" rx="3" fill="currentColor" />
      <rect x="4" y="22" width="8" height="4.5" rx="2.25" fill="currentColor" opacity={SOFT} />
      <rect x="14" y="22" width="14" height="4.5" rx="2.25" fill="currentColor" opacity={MID} />
    </>
  ),
  gantt: (
    <>
      <path d="M4.5 4v24" {...stroke} strokeWidth={1.6} opacity={SOFT} />
      <rect x="7" y="6" width="11" height="5" rx="2.5" fill="currentColor" />
      <rect x="13" y="13.5" width="12" height="5" rx="2.5" fill="currentColor" opacity={MID} />
      <rect x="19" y="21" width="9" height="5" rx="2.5" fill="currentColor" opacity={SOFT} />
    </>
  ),
  text: (
    <>
      <rect x="4" y="5" width="24" height="22" rx="3" fill="currentColor" opacity={0.12} />
      <path d="M9 11h14M9 16h14M9 21h8" {...stroke} />
    </>
  ),
  chart: (
    <>
      <rect x="5" y="16" width="5" height="11" rx="1.5" fill="currentColor" opacity={SOFT} />
      <rect x="13.5" y="11" width="5" height="16" rx="1.5" fill="currentColor" opacity={MID} />
      <rect x="22" y="6" width="5" height="21" rx="1.5" fill="currentColor" />
    </>
  ),
};

export interface VizTypeIconProps {
  vizType?: string | null;
  /** Width and height in pixels */
  size?: number;
  className?: string;
  title?: string;
}

/** A two-tone drawing of a chart type, in the current text color. */
export function VizTypeIcon({
  vizType,
  size = 20,
  className,
  title,
}: VizTypeIconProps) {
  const kind = vizIconKind(vizType);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      data-test="viz-type-icon"
      data-kind={kind}
    >
      {title && <title>{title}</title>}
      {DRAWINGS[kind]}
    </svg>
  );
}

const TILE_SIZES = { s: 28, m: 40, l: 56, xl: 88 } as const;

const Tile = styled.span<{ px: number }>`
  ${({ theme, px }) => css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: ${px}px;
    height: ${px}px;
    border-radius: ${Math.max(6, Math.round(px * 0.26))}px;
    background: ${theme.colorPrimaryBg};
    color: ${theme.colorPrimary};
    box-shadow: inset 0 0 0 1px ${theme.colorPrimaryBorder};
  `}
`;

export interface VizTypeTileProps extends Omit<VizTypeIconProps, 'size'> {
  size?: keyof typeof TILE_SIZES;
}

/** The chart type icon on a soft brand tile, for lists and cards. */
export function VizTypeTile({ size = 'm', ...props }: VizTypeTileProps) {
  const px = TILE_SIZES[size];
  return (
    <Tile px={px} className={props.className}>
      <VizTypeIcon {...props} className={undefined} size={Math.round(px * 0.62)} />
    </Tile>
  );
}
