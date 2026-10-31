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
import { ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';

export type HelpKind =
  | 'font'
  | 'inverse'
  | 'lineStyle'
  | 'lineWidth'
  | 'radius'
  | 'gap'
  | 'color'
  | 'palette'
  | 'legend'
  | 'valueLabel'
  | 'marker'
  | 'conditional'
  | 'rotate';

/** Control-name patterns, checked in order, that pick an illustration. */
const KIND_PATTERNS: [RegExp, HelpKind][] = [
  [/conditional_formatting/, 'conditional'],
  [/series_colors/, 'palette'],
  [/inverse/, 'inverse'],
  [/rotate/, 'rotate'],
  [/marker/, 'marker'],
  [/legend/, 'legend'],
  [/radius/, 'radius'],
  [/category_gap|bar_gap|_gap$/, 'gap'],
  [/(line_type|_style)$/, 'lineStyle'],
  [/value_label_(?!font|background|format|rotate)/, 'valueLabel'],
  [/_width$/, 'lineWidth'],
  [/font/, 'font'],
  [/color|background/, 'color'],
];

/** Returns the illustration kind for a control name, if there is one. */
export function helpKindFor(name?: string): HelpKind | undefined {
  if (!name) return undefined;
  return KIND_PATTERNS.find(([pattern]) => pattern.test(name))?.[1];
}

type Palette = {
  main: string;
  soft: string;
  muted: string;
  line: string;
  text: string;
};

const WIDTH = 200;
const HEIGHT = 96;

const BARS = [34, 52, 28, 60, 42];

function bars(
  p: Palette,
  opts: { rx?: number; gap?: number; stroke?: number },
) {
  const { rx = 2, gap = 10, stroke = 0 } = opts;
  const barWidth = (WIDTH - 40 - gap * (BARS.length - 1)) / BARS.length;
  return BARS.map((h, i) => (
    <rect
      key={h + i}
      x={20 + i * (barWidth + gap)}
      y={80 - h}
      width={barWidth}
      height={h}
      rx={rx}
      fill={i % 2 ? p.soft : p.main}
      stroke={stroke ? p.text : 'none'}
      strokeWidth={stroke}
    />
  ));
}

function render(kind: HelpKind, p: Palette): ReactNode {
  switch (kind) {
    case 'font':
      return (
        <>
          <text x="26" y="62" fontSize="46" fontWeight="700" fill={p.main}>
            Aa
          </text>
          <text x="104" y="40" fontSize="12" fill={p.text}>
            {t('Bold')}
          </text>
          <text x="104" y="58" fontSize="12" fontStyle="italic" fill={p.text}>
            {t('Italic')}
          </text>
          <text
            x="104"
            y="76"
            fontSize="12"
            fill={p.text}
            textDecoration="underline"
          >
            {t('Underline')}
          </text>
        </>
      );
    case 'inverse':
      return (
        <>
          <line x1="24" y1="82" x2="176" y2="82" stroke={p.line} />
          {[24, 40, 56].map((h, i) => (
            <rect
              key={h}
              x={30 + i * 26}
              y={82 - h}
              width="16"
              height={h}
              rx="2"
              fill={p.main}
            />
          ))}
          <path d="M176 24 H110" stroke={p.text} strokeWidth="2" fill="none" />
          <path d="M118 18 L108 24 L118 30 Z" fill={p.text} />
        </>
      );
    case 'lineStyle':
      return (
        <>
          <line
            x1="24"
            y1="26"
            x2="176"
            y2="26"
            stroke={p.main}
            strokeWidth="3"
          />
          <line
            x1="24"
            y1="48"
            x2="176"
            y2="48"
            stroke={p.main}
            strokeWidth="3"
            strokeDasharray="10 6"
          />
          <line
            x1="24"
            y1="70"
            x2="176"
            y2="70"
            stroke={p.main}
            strokeWidth="3"
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
        </>
      );
    case 'lineWidth':
      return (
        <>
          {[1, 2, 4, 6].map((w, i) => (
            <line
              key={w}
              x1="24"
              y1={18 + i * 20}
              x2="176"
              y2={18 + i * 20}
              stroke={p.main}
              strokeWidth={w}
              strokeLinecap="round"
            />
          ))}
        </>
      );
    case 'radius':
      return <>{bars(p, { rx: 9 })}</>;
    case 'gap':
      return (
        <>
          {bars(p, { gap: 22 })}
          <path
            d="M70 20 H88 M70 15 V25 M88 15 V25"
            stroke={p.text}
            strokeWidth="1.5"
            fill="none"
          />
        </>
      );
    case 'color':
      return (
        <>
          {[p.main, p.soft, p.muted, p.text].map((fill, i) => (
            <rect
              key={fill + i}
              x={24 + i * 38}
              y="22"
              width="30"
              height="52"
              rx="8"
              fill={fill}
              stroke={p.line}
            />
          ))}
        </>
      );
    case 'palette':
      return (
        <>
          {['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'].map(
            (fill, i) => (
              <rect
                key={fill}
                x={20 + i * 32}
                y={80 - BARS[i]}
                width="24"
                height={BARS[i]}
                rx="3"
                fill={fill}
              />
            ),
          )}
        </>
      );
    case 'legend':
      return (
        <>
          {bars(p, {}).slice(0, 4)}
          {[p.main, p.soft].map((fill, i) => (
            <g key={fill}>
              <circle cx={120 + i * 40} cy="14" r="4" fill={fill} />
              <rect
                x={128 + i * 40}
                y="11"
                width="22"
                height="6"
                rx="3"
                fill={p.muted}
              />
            </g>
          ))}
        </>
      );
    case 'valueLabel':
      return (
        <>
          {bars(p, {})}
          {BARS.map((h, i) => (
            <text
              key={h + i}
              x={36 + i * 31}
              y={74 - h}
              fontSize="10"
              textAnchor="middle"
              fill={p.text}
            >
              {h}
            </text>
          ))}
        </>
      );
    case 'marker':
      return (
        <>
          <polyline
            points="24,70 64,40 104,58 144,26 176,44"
            fill="none"
            stroke={p.main}
            strokeWidth="2.5"
          />
          <circle cx="64" cy="40" r="5" fill={p.main} />
          <rect x="99" y="53" width="10" height="10" fill={p.main} />
          <path d="M144 19 L151 33 H137 Z" fill={p.main} />
        </>
      );
    case 'conditional':
      return (
        <>
          {[0, 1, 2].map(r =>
            [0, 1, 2].map(c => {
              const hot = (r + c * 2) % 4 === 0;
              const warm = (r * 2 + c) % 3 === 1;
              return (
                <rect
                  key={`${r}-${c}`}
                  x={28 + c * 48}
                  y={14 + r * 24}
                  width="42"
                  height="18"
                  rx="4"
                  fill={hot ? '#e8685f' : warm ? '#f2c84b' : p.soft}
                />
              );
            }),
          )}
        </>
      );
    case 'rotate':
      return (
        <>
          {bars(p, {})}
          <path
            d="M150 24 A22 22 0 0 1 172 46"
            stroke={p.text}
            strokeWidth="2"
            fill="none"
          />
          <path d="M168 38 L174 48 L164 48 Z" fill={p.text} />
        </>
      );
    default:
      return null;
  }
}

/** Small themed drawing that shows what a format control changes. */
export function HelpIllustration({ kind }: { kind: HelpKind }) {
  const theme = useTheme();
  const palette: Palette = {
    main: theme.colorPrimary,
    soft: theme.colorPrimaryBorder,
    muted: theme.colorFillSecondary,
    line: theme.colorBorder,
    text: theme.colorTextSecondary,
  };
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-hidden="true"
      data-test={`help-illustration-${kind}`}
      style={{ display: 'block' }}
    >
      {render(kind, palette)}
    </svg>
  );
}
