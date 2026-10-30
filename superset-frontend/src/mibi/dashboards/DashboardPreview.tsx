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
import { css, styled, useTheme } from '@apache-superset/core/theme';
import type { PreviewCell, PreviewRows } from './useDashboardPreviews';

export type Glyph =
  | 'bar'
  | 'line'
  | 'pie'
  | 'number'
  | 'table'
  | 'map'
  | 'text'
  | 'chart';

const GLYPHS: [RegExp, Glyph][] = [
  [/big_number|kpi|gauge/, 'number'],
  [/pie|sunburst|donut|treemap|funnel/, 'pie'],
  [/table|pivot|ag_grid|ag-grid/, 'table'],
  [/deck|map|country|world/, 'map'],
  [
    /line|area|smooth|step|timeseries$|time_series|compare|scatter|bubble/,
    'line',
  ],
  [/bar|histogram|box_plot|waterfall|heatmap|column/, 'bar'],
  [/markdown/, 'text'],
];

/** The miniature drawn for a viz type. */
export function glyphFor(kind: string): Glyph {
  return GLYPHS.find(([pattern]) => pattern.test(kind))?.[1] || 'chart';
}

const Canvas = styled.div`
  ${({ theme }) => css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 3}px 0;

    & > * {
      flex-shrink: 0;
    }
    overflow: hidden;
    /* The rows that do not fit fade out at the bottom */
    mask-image: linear-gradient(to bottom, black 78%, transparent);
  `}
`;

const Row = styled.div`
  display: flex;
  gap: 6px;
  min-height: 0;
`;

const Cell = styled.div`
  ${({ theme }) => css`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;

    &.leaf {
      min-height: 0;
      overflow: hidden;
      padding: 6px 7px;
      border-radius: 6px;
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorderSecondary};
      box-shadow: ${theme.boxShadowTertiary};
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `}
`;

function GlyphSvg({ glyph, seed }: { glyph: Glyph; seed: number }) {
  const theme = useTheme();
  const primary = theme.colorPrimary;
  // Shades of the brand color, from strongest to lightest
  const accents = [
    theme.colorPrimary,
    theme.colorPrimaryHover,
    theme.colorPrimaryBorderHover,
    theme.colorPrimaryBorder,
  ];
  const vary = (index: number, min: number, range: number) =>
    min + ((seed * 31 + index * 17) % range);

  switch (glyph) {
    case 'bar':
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map(index => {
            const height = vary(index, 18, 40);
            return (
              <rect
                key={index}
                x={6 + index * 15.5}
                y={58 - height}
                width={10}
                height={height}
                rx={2}
                fill={primary}
                opacity={0.45 + (index % 3) * 0.2}
              />
            );
          })}
        </svg>
      );
    case 'line': {
      const points = [0, 1, 2, 3, 4, 5, 6].map(
        index => `${index * 16.5},${56 - vary(index, 8, 40)}`,
      );
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          <polygon
            points={`0,60 ${points.join(' ')} 100,60`}
            fill={primary}
            opacity={0.14}
          />
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke={primary}
            strokeWidth={2.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    }
    case 'pie': {
      const shares = [0.46, 0.24, 0.18, 0.12];
      let offset = 0;
      return (
        <svg viewBox="0 0 60 60" aria-hidden>
          {shares.map((share, index) => {
            const length = share * 113;
            const circle = (
              <circle
                key={index}
                cx={30}
                cy={30}
                r={18}
                fill="none"
                stroke={accents[index]}
                strokeWidth={10}
                strokeDasharray={`${length} 113`}
                strokeDashoffset={-offset}
                transform="rotate(-90 30 30)"
              />
            );
            offset += length;
            return circle;
          })}
        </svg>
      );
    }
    case 'number':
      return (
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="xMinYMid meet"
          aria-hidden
        >
          <rect
            x={4}
            y={10}
            width={26}
            height={5}
            rx={2.5}
            fill={theme.colorTextTertiary}
            opacity={0.5}
          />
          <rect
            x={4}
            y={24}
            width={vary(1, 44, 30)}
            height={16}
            rx={4}
            fill={primary}
          />
          <polyline
            points="4,52 20,48 36,50 52,44 68,46 84,40 96,42"
            fill="none"
            stroke={theme.colorPrimaryBorderHover}
            strokeWidth={2}
          />
        </svg>
      );
    case 'table':
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          <rect
            x={0}
            y={2}
            width={100}
            height={8}
            rx={2}
            fill={primary}
            opacity={0.22}
          />
          {[0, 1, 2, 3].map(index => (
            <g key={index} opacity={0.55}>
              <rect
                x={2}
                y={16 + index * 11}
                width={34}
                height={5}
                rx={2.5}
                fill={theme.colorTextTertiary}
              />
              <rect
                x={46}
                y={16 + index * 11}
                width={vary(index, 14, 22)}
                height={5}
                rx={2.5}
                fill={theme.colorTextTertiary}
              />
              <rect
                x={78}
                y={16 + index * 11}
                width={18}
                height={5}
                rx={2.5}
                fill={primary}
                opacity={0.7}
              />
            </g>
          ))}
        </svg>
      );
    case 'map':
      return (
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <path
            d="M14 22c8-10 22-12 30-6s18 2 26-4 22 2 20 14-14 10-20 18-22 10-32 4-16-4-22-10-10-10-2-16z"
            fill={primary}
            opacity={0.18}
          />
          {[
            [30, 24, 4],
            [52, 30, 6],
            [70, 22, 3],
            [44, 40, 3.5],
          ].map(([cx, cy, r]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={primary}
              opacity={0.75}
            />
          ))}
        </svg>
      );
    case 'text':
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          {[0, 1, 2, 3].map(index => (
            <rect
              key={index}
              x={2}
              y={6 + index * 13}
              width={index === 0 ? 50 : vary(index, 60, 36)}
              height={index === 0 ? 7 : 5}
              rx={2.5}
              fill={theme.colorTextTertiary}
              opacity={index === 0 ? 0.6 : 0.35}
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0 50 C20 30 35 44 50 30 S80 14 100 20 V60 H0z"
            fill={primary}
            opacity={0.2}
          />
        </svg>
      );
  }
}

const rowHeight = (row: PreviewCell[]) =>
  Math.max(...row.map(cell => cell.height || 50));

function PreviewCellView({ cell, seed }: { cell: PreviewCell; seed: number }) {
  if (cell.kind === 'column' && cell.cells?.length) {
    return (
      <Cell style={{ flex: `${cell.width} 1 0` }}>
        {cell.cells.map((child, index) => (
          <Cell
            key={index}
            className="leaf"
            style={{ flex: `${child.height || 50} 1 0` }}
          >
            <GlyphSvg glyph={glyphFor(child.kind)} seed={seed + index} />
          </Cell>
        ))}
      </Cell>
    );
  }
  return (
    <Cell className="leaf" style={{ flex: `${cell.width} 1 0` }}>
      <GlyphSvg glyph={glyphFor(cell.kind)} seed={seed} />
    </Cell>
  );
}

/** A miniature of a dashboard's layout: its rows, widths and chart types. */
export function DashboardPreview({
  rows,
  seed,
}: {
  rows: PreviewRows;
  seed: number;
}) {
  return (
    <Canvas aria-hidden data-test="dashboard-preview">
      {rows.map((row, rowIndex) => (
        <Row
          key={rowIndex}
          // Grid units to pixels, so tall rows stay tall in the miniature
          style={{ height: Math.min(Math.max(rowHeight(row) * 1.25, 30), 96) }}
        >
          {row.map((cell, cellIndex) => (
            <PreviewCellView
              key={cellIndex}
              cell={cell}
              seed={seed + rowIndex * 7 + cellIndex}
            />
          ))}
        </Row>
      ))}
    </Canvas>
  );
}
