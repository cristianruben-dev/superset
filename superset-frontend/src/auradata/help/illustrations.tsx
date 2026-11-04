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
import type { ReactElement, ReactNode } from 'react';
import { useTheme } from '@apache-superset/core/theme';

/**
 * Small drawings that show what a chart or format control changes. Each one is
 * a miniature chart where the part the control affects is drawn in the accent
 * color (class `hl`, which pulses gently) and the rest stays quiet.
 */
export type HelpIllustrationKind =
  | 'legend'
  | 'legendAlign'
  | 'legendMarker'
  | 'legendSort'
  | 'dataLabels'
  | 'labelRotate'
  | 'labelFormat'
  | 'labelBackground'
  | 'font'
  | 'axisLabels'
  | 'axisTitle'
  | 'axisTitleMargin'
  | 'axisInverse'
  | 'axisBounds'
  | 'axisRotation'
  | 'axisLog'
  | 'axisTruncate'
  | 'gridColor'
  | 'gridWidth'
  | 'gridStyle'
  | 'seriesColors'
  | 'lineWidth'
  | 'markers'
  | 'barGap'
  | 'barRadius'
  | 'barBorder'
  | 'stack'
  | 'area'
  | 'conditional'
  | 'tooltip'
  | 'donut'
  | 'rose'
  | 'pieLabels'
  | 'sort'
  | 'zoom'
  | 'colorBy'
  | 'canvasMargins'
  | 'canvasGap'
  | 'cardRadius'
  | 'cardShadow'
  | 'cardPadding'
  | 'cardBorder'
  | 'cardBackground'
  | 'canvasBackground'
  | 'gradient'
  | 'opacity'
  | 'cardTitle'
  | 'cardSubtitle'
  | 'headerLine'
  | 'gridColumns'
  | 'gridRows'
  | 'gridLines'
  | 'mobileView'
  | 'visibility'
  | 'lock';

export const ILLUSTRATION_WIDTH = 248;
export const ILLUSTRATION_HEIGHT = 112;

type Palette = {
  accent: string;
  accentSoft: string;
  second: string;
  third: string;
  ink: string;
  faint: string;
  surface: string;
};

const usePalette = (): Palette => {
  const theme = useTheme();
  return {
    accent: theme.colorPrimary,
    accentSoft: theme.colorPrimaryBg,
    second: theme.colorPrimaryBorderHover ?? theme.colorPrimaryBorder,
    third: theme.colorFillSecondary,
    ink: theme.colorTextTertiary,
    faint: theme.colorBorderSecondary,
    surface: theme.colorBgContainer,
  };
};

/* ------------------------------------------------------------------ pieces */

const Frame = ({ c, children }: { c: Palette; children: ReactNode }) => (
  <g>
    <rect
      x="6"
      y="6"
      width="236"
      height="100"
      rx="9"
      fill={c.surface}
      stroke={c.faint}
    />
    {children}
  </g>
);

/** L-shaped axes at the bottom-left of the plot. */
const Axes = ({
  c,
  x = 30,
  y = 88,
  w = 196,
  h = 64,
  hl = false,
}: {
  c: Palette;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hl?: boolean;
}) => (
  <path
    d={`M${x} ${y - h} V${y} H${x + w}`}
    fill="none"
    stroke={hl ? c.accent : c.ink}
    strokeWidth={hl ? 1.8 : 1.2}
    strokeLinecap="round"
    className={hl ? 'hl' : undefined}
  />
);

const Grid = ({
  c,
  lines = 3,
  dash,
  color,
  width = 1,
  hl = false,
}: {
  c: Palette;
  lines?: number;
  dash?: string;
  color?: string;
  width?: number;
  hl?: boolean;
}) => (
  <g className={hl ? 'hl' : undefined}>
    {Array.from({ length: lines }, (_, i) => {
      const y = 88 - ((i + 1) * 64) / lines;
      return (
        <line
          key={y}
          x1="30"
          x2="226"
          y1={y}
          y2={y}
          stroke={color ?? c.faint}
          strokeWidth={width}
          strokeDasharray={dash}
        />
      );
    })}
  </g>
);

const BAR_HEIGHTS = [26, 44, 34, 56, 40];

const Bars = ({
  c,
  fills,
  heights = BAR_HEIGHTS,
  gap = 14,
  radius = 2,
  stroke,
  hl = false,
  x0 = 40,
  width,
  base = 88,
}: {
  c: Palette;
  base?: number;
  fills?: string[];
  heights?: number[];
  gap?: number;
  radius?: number;
  stroke?: string;
  hl?: boolean;
  x0?: number;
  width?: number;
}) => {
  const barWidth = width ?? Math.max(10, 34 - gap / 2);
  return (
    <g className={hl ? 'hl' : undefined}>
      {heights.map((height, i) => (
        <rect
          key={`${height}-${i}`}
          x={x0 + i * (barWidth + gap)}
          y={base - height}
          width={barWidth}
          height={height}
          rx={radius}
          fill={fills?.[i % fills.length] ?? c.second}
          stroke={stroke}
          strokeWidth={stroke ? 1.6 : 0}
        />
      ))}
    </g>
  );
};

const LINE_POINTS: [number, number][] = [
  [38, 70],
  [70, 54],
  [102, 62],
  [134, 38],
  [166, 46],
  [198, 26],
];

const polyline = (points: [number, number][]) =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

const Line = ({
  c,
  color,
  width = 2.2,
  dash,
  points = LINE_POINTS,
  hl = false,
}: {
  c: Palette;
  color?: string;
  width?: number;
  dash?: string;
  points?: [number, number][];
  hl?: boolean;
}) => (
  <polyline
    points={polyline(points)}
    fill="none"
    stroke={color ?? c.accent}
    strokeWidth={width}
    strokeDasharray={dash}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={hl ? 'hl' : undefined}
  />
);

const Tick = ({
  c,
  x,
  y,
  w = 16,
  color,
}: {
  c: Palette;
  x: number;
  y: number;
  w?: number;
  color?: string;
}) => (
  <rect
    x={x}
    y={y}
    width={w}
    height="4"
    rx="2"
    fill={color ?? c.ink}
    opacity={color ? 1 : 0.55}
  />
);

const Chip = ({
  c,
  x,
  y,
  fill,
  shape = 'circle',
  w = 24,
}: {
  c: Palette;
  x: number;
  y: number;
  fill: string;
  shape?: string;
  w?: number;
}) => {
  const mark = (() => {
    switch (shape) {
      case 'rect':
        return <rect x={x} y={y - 4} width="8" height="8" fill={fill} />;
      case 'roundRect':
        return (
          <rect x={x} y={y - 4} width="8" height="8" rx="2.5" fill={fill} />
        );
      case 'triangle':
        return (
          <path
            d={`M${x + 4} ${y - 5} L${x + 9} ${y + 4} H${x - 1}Z`}
            fill={fill}
          />
        );
      case 'diamond':
        return (
          <path
            d={`M${x + 4} ${y - 5.5} L${x + 9.5} ${y} L${x + 4} ${y + 5.5} L${x - 1.5} ${y}Z`}
            fill={fill}
          />
        );
      default:
        return <circle cx={x + 4} cy={y} r="4.2" fill={fill} />;
    }
  })();
  return (
    <g>
      {mark}
      <Tick c={c} x={x + 14} y={y - 2} w={w - 8} />
    </g>
  );
};

const Arrow = ({
  c,
  x1,
  y1,
  x2,
  y2,
  hl = true,
}: {
  c: Palette;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hl?: boolean;
}) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = (a: number) =>
    `${x2 - 5.5 * Math.cos(angle + a)},${y2 - 5.5 * Math.sin(angle + a)}`;
  return (
    <g
      stroke={c.accent}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      className={hl ? 'hl' : undefined}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <polyline points={`${head(0.5)} ${x2},${y2} ${head(-0.5)}`} />
    </g>
  );
};

const Label = ({
  x,
  y,
  children,
  fill,
  size = 9,
  weight = 600,
  anchor = 'middle',
  rotate,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  fill: string;
  size?: number;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  rotate?: number;
  className?: string;
}) => (
  <text
    x={x}
    y={y}
    fill={fill}
    fontSize={size}
    fontWeight={weight}
    textAnchor={anchor}
    className={className}
    transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    style={{ fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}
  >
    {children}
  </text>
);

const barCenter = (i: number, gap = 14) => {
  const w = Math.max(10, 34 - gap / 2);
  return 40 + i * (w + gap) + w / 2;
};

/** A dashboard page with chart cards; each card is [x, y, w, h]. */
type Card = [number, number, number, number];

const CARDS: Card[] = [
  [20, 18, 98, 36],
  [126, 18, 96, 36],
  [20, 60, 202, 36],
];

const Cards = ({
  c,
  cards = CARDS,
  fill,
  stroke,
  radius = 6,
  shadow = false,
  hl = false,
  strokeWidth = 1,
  title = false,
  inner = false,
}: {
  c: Palette;
  cards?: Card[];
  fill?: string;
  stroke?: string;
  radius?: number;
  shadow?: boolean;
  hl?: boolean;
  strokeWidth?: number;
  title?: boolean;
  inner?: boolean;
}) => (
  <g>
    {cards.map(([x, y, w, h], i) => (
      <g key={`${x}-${y}`} className={hl && i === 0 ? 'hl' : undefined}>
        {shadow && (
          <rect
            x={x}
            y={y + 3}
            width={w}
            height={h}
            rx={radius}
            fill={c.accent}
            opacity="0.22"
            style={{ filter: 'blur(3px)' }}
          />
        )}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={radius}
          fill={fill ?? c.surface}
          stroke={stroke ?? c.faint}
          strokeWidth={strokeWidth}
        />
        {title && <Tick c={c} x={x + 8} y={y + 7} w={30} />}
        {inner && (
          <rect
            x={x + 6}
            y={y + 6}
            width={w - 12}
            height={h - 12}
            rx={Math.max(1, radius - 3)}
            fill="none"
            stroke={c.accent}
            strokeDasharray="3 3"
          />
        )}
        <Bars
          c={c}
          heights={[8, 14, 10, 16, 12].map(v => v * (h / 36))}
          x0={x + w / 2 - 28}
          base={y + h - 6}
          gap={5}
          width={8}
          radius={1}
        />
      </g>
    ))}
  </g>
);

/* ------------------------------------------------------------ illustrations */

const DRAWINGS: Record<HelpIllustrationKind, (c: Palette) => ReactElement> = {
  legend: c => (
    <Frame c={c}>
      <g className="hl">
        <rect
          x="46"
          y="14"
          width="156"
          height="17"
          rx="8.5"
          fill={c.accentSoft}
        />
        <Chip c={c} x={58} y={22.5} fill={c.accent} />
        <Chip c={c} x={104} y={22.5} fill={c.second} />
        <Chip c={c} x={150} y={22.5} fill={c.third} />
      </g>
      <Axes c={c} y={94} h={52} />
      <Bars c={c} heights={[22, 36, 28, 44, 32]} x0={42} />
    </Frame>
  ),
  legendAlign: c => (
    <Frame c={c}>
      <rect x="18" y="14" width="212" height="1" fill={c.faint} />
      <g opacity="0.5">
        <Chip c={c} x={22} y={26} fill={c.ink} />
        <Chip c={c} x={96} y={26} fill={c.ink} />
        <Chip c={c} x={176} y={26} fill={c.ink} />
      </g>
      <g className="hl">
        <Chip c={c} x={96} y={26} fill={c.accent} />
      </g>
      <Axes c={c} y={94} h={50} />
      <Bars c={c} heights={[18, 28, 22, 34, 26]} x0={42} />
      <Arrow c={c} x1={86} y1={40} x2={52} y2={40} hl={false} />
      <Arrow c={c} x1={160} y1={40} x2={196} y2={40} hl={false} />
    </Frame>
  ),
  legendMarker: c => (
    <Frame c={c}>
      <g className="hl">
        <Chip c={c} x={24} y={44} fill={c.accent} shape="circle" />
        <Chip c={c} x={72} y={44} fill={c.accent} shape="rect" />
        <Chip c={c} x={120} y={44} fill={c.accent} shape="roundRect" />
        <Chip c={c} x={168} y={44} fill={c.accent} shape="triangle" />
      </g>
      <Chip c={c} x={24} y={74} fill={c.second} shape="diamond" />
      <Chip c={c} x={72} y={74} fill={c.second} shape="circle" />
      <Chip c={c} x={120} y={74} fill={c.second} shape="rect" />
      <Chip c={c} x={168} y={74} fill={c.second} shape="roundRect" />
    </Frame>
  ),
  legendSort: c => (
    <Frame c={c}>
      <g className="hl">
        <Chip c={c} x={24} y={30} fill={c.accent} w={64} />
        <Chip c={c} x={24} y={52} fill={c.second} w={46} />
        <Chip c={c} x={24} y={74} fill={c.third} w={30} />
      </g>
      <Arrow c={c} x1={120} y1={28} x2={120} y2={78} />
      <Bars c={c} heights={[44, 32, 20]} x0={146} gap={10} width={20} />
    </Frame>
  ),
  dataLabels: c => (
    <Frame c={c}>
      <Axes c={c} y={90} />
      <Bars c={c} x0={40} />
      {BAR_HEIGHTS.map((height, i) => (
        <Label
          key={height}
          x={barCenter(i)}
          y={84 - height}
          fill={c.accent}
          className="hl"
        >
          {height * 3}
        </Label>
      ))}
    </Frame>
  ),
  labelRotate: c => (
    <Frame c={c}>
      <Axes c={c} y={92} h={56} />
      <Bars c={c} heights={[26, 38, 32, 46]} x0={50} gap={22} width={28} />
      {[26, 38, 32, 46].map((height, i) => (
        <Label
          key={height}
          x={50 + i * 50 + 14}
          y={86 - height}
          fill={c.accent}
          rotate={-45}
          anchor="start"
          className="hl"
        >
          {height * 4}
        </Label>
      ))}
    </Frame>
  ),
  labelFormat: c => (
    <Frame c={c}>
      <Label x={56} y={46} fill={c.ink} size={15} weight={500}>
        1234567
      </Label>
      <Label x={56} y={64} fill={c.ink} size={9} weight={500}>
        raw
      </Label>
      <Arrow c={c} x1={102} y1={52} x2={140} y2={52} />
      <rect
        x="146"
        y="34"
        width="76"
        height="28"
        rx="8"
        fill={c.accentSoft}
        className="hl"
      />
      <Label x={184} y={53} fill={c.accent} size={15} weight={700}>
        1.2M
      </Label>
      <Label x={184} y={78} fill={c.ink} size={9} weight={500}>
        .2s
      </Label>
    </Frame>
  ),
  labelBackground: c => (
    <Frame c={c}>
      <Axes c={c} y={90} />
      <Bars c={c} x0={40} />
      {BAR_HEIGHTS.map((height, i) => (
        <g key={height} className="hl">
          <rect
            x={barCenter(i) - 14}
            y={72 - height}
            width="28"
            height="14"
            rx="7"
            fill={c.accent}
          />
          <Label x={barCenter(i)} y={82 - height} fill={c.surface} size={8.5}>
            {height * 3}
          </Label>
        </g>
      ))}
    </Frame>
  ),
  font: c => (
    <Frame c={c}>
      <Label
        x={62}
        y={64}
        fill={c.accent}
        size={40}
        weight={700}
        className="hl"
      >
        Aa
      </Label>
      <line x1="112" x2="112" y1="28" y2="84" stroke={c.faint} />
      {[0, 1, 2].map(i => (
        <g key={i}>
          <rect
            x="128"
            y={36 + i * 16}
            width="82"
            height="4"
            rx="2"
            fill={c.faint}
          />
          <rect
            x="128"
            y={36 + i * 16}
            width={[58, 36, 70][i]}
            height="4"
            rx="2"
            fill={c.accent}
            className="hl"
          />
          <circle
            cx={128 + [58, 36, 70][i]}
            cy={38 + i * 16}
            r="4.5"
            fill={c.surface}
            stroke={c.accent}
            strokeWidth="1.6"
          />
        </g>
      ))}
    </Frame>
  ),
  axisLabels: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars c={c} />
      <g className="hl">
        {[0, 1, 2, 3, 4].map(i => (
          <Tick key={i} c={c} x={barCenter(i) - 8} y={94} color={c.accent} />
        ))}
        {[0, 1, 2].map(i => (
          <Tick
            key={`y${i}`}
            c={c}
            x={10}
            y={86 - i * 22}
            w={14}
            color={c.accent}
          />
        ))}
      </g>
    </Frame>
  ),
  axisTitle: c => (
    <Frame c={c}>
      <Axes c={c} x={40} y={80} w={186} h={58} />
      <Bars c={c} x0={52} gap={14} width={24} heights={[24, 40, 30, 50, 36]} />
      <g className="hl">
        <rect x="104" y="92" width="62" height="6" rx="3" fill={c.accent} />
        <rect x="8" y="42" width="6" height="34" rx="3" fill={c.accent} />
      </g>
    </Frame>
  ),
  axisTitleMargin: c => (
    <Frame c={c}>
      <Axes c={c} x={46} y={78} w={180} h={54} />
      <Bars c={c} x0={58} gap={14} width={24} heights={[22, 38, 28, 46, 34]} />
      <rect
        x="10"
        y="38"
        width="6"
        height="34"
        rx="3"
        fill={c.accent}
        className="hl"
      />
      <Arrow c={c} x1={18} y1={55} x2={42} y2={55} />
    </Frame>
  ),
  axisInverse: c => (
    <Frame c={c}>
      <Axes c={c} y={90} />
      <Bars c={c} fills={[c.third]} heights={[16, 28, 22, 34, 26]} />
      <Arrow c={c} x1={52} y1={36} x2={52} y2={76} />
      <g className="hl">
        <path
          d="M150 28 h60"
          stroke={c.accent}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M210 28 l-5 -4 m5 4 l-5 4"
          stroke={c.accent}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M200 44 h-60"
          stroke={c.second}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M140 44 l5 -4 m-5 4 l5 4"
          stroke={c.second}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </Frame>
  ),
  axisBounds: c => (
    <Frame c={c}>
      <Axes c={c} />
      <line
        x1="30"
        x2="226"
        y1="30"
        y2="30"
        stroke={c.accent}
        strokeDasharray="3 3"
        className="hl"
      />
      <line
        x1="30"
        x2="226"
        y1="78"
        y2="78"
        stroke={c.accent}
        strokeDasharray="3 3"
        className="hl"
      />
      <Line
        c={c}
        points={[
          [38, 70],
          [70, 56],
          [102, 62],
          [134, 42],
          [166, 48],
          [198, 34],
        ]}
      />
      <Label x={216} y={26} fill={c.accent} size={8.5}>
        max
      </Label>
      <Label x={216} y={92} fill={c.accent} size={8.5}>
        min
      </Label>
    </Frame>
  ),
  axisRotation: c => (
    <Frame c={c}>
      <Axes c={c} y={74} h={50} />
      <Bars c={c} heights={[20, 32, 26, 38, 28]} x0={40} gap={14} />
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i} className="hl">
          <rect
            x={barCenter(i) - 2}
            y="80"
            width="22"
            height="4"
            rx="2"
            fill={c.accent}
            transform={`rotate(35 ${barCenter(i) - 2} 82)`}
          />
        </g>
      ))}
    </Frame>
  ),
  axisLog: c => (
    <Frame c={c}>
      <Axes c={c} hl />
      <path
        d="M38 84 C70 82 96 74 120 56 C144 38 170 30 198 26"
        fill="none"
        stroke={c.accent}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <Label x={20} y={32} fill={c.ink} size={8.5}>
        1000
      </Label>
      <Label x={20} y={56} fill={c.ink} size={8.5}>
        100
      </Label>
      <Label x={20} y={80} fill={c.ink} size={8.5}>
        10
      </Label>
    </Frame>
  ),
  axisTruncate: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars c={c} fills={[c.third]} heights={[34, 40, 38, 46, 42]} />
      <g className="hl">
        <path
          d="M24 78 l4 -4 l4 8 l4 -8 l4 4"
          stroke={c.accent}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="30"
          x2="226"
          y1="78"
          y2="78"
          stroke={c.accent}
          strokeDasharray="3 3"
        />
      </g>
    </Frame>
  ),
  gridColor: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Grid c={c} lines={4} color={c.accent} hl />
      <Line
        c={c}
        color={c.ink}
        points={[
          [38, 72],
          [70, 58],
          [102, 64],
          [134, 44],
          [166, 50],
          [198, 36],
        ]}
      />
    </Frame>
  ),
  gridWidth: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Grid c={c} lines={4} color={c.accent} width={3} hl />
      <Line
        c={c}
        color={c.ink}
        points={[
          [38, 72],
          [70, 58],
          [102, 64],
          [134, 44],
          [166, 50],
          [198, 36],
        ]}
      />
    </Frame>
  ),
  gridStyle: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Grid c={c} lines={4} color={c.accent} dash="5 4" width={1.6} hl />
      <Line
        c={c}
        color={c.ink}
        points={[
          [38, 72],
          [70, 58],
          [102, 64],
          [134, 44],
          [166, 50],
          [198, 36],
        ]}
      />
    </Frame>
  ),
  seriesColors: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars c={c} fills={[c.accent, c.second, c.third]} x0={40} />
      <g className="hl">
        <circle cx="208" cy="22" r="5" fill={c.accent} />
        <circle cx="194" cy="22" r="5" fill={c.second} />
        <circle cx="180" cy="22" r="5" fill={c.third} />
      </g>
    </Frame>
  ),
  lineWidth: c => (
    <Frame c={c}>
      <Line
        c={c}
        color={c.third}
        width={1.2}
        points={[
          [30, 78],
          [70, 70],
          [110, 74],
          [150, 62],
          [200, 66],
        ]}
      />
      <Line
        c={c}
        color={c.second}
        width={3}
        points={[
          [30, 58],
          [70, 50],
          [110, 54],
          [150, 42],
          [200, 46],
        ]}
      />
      <Line
        c={c}
        width={6}
        hl
        points={[
          [30, 38],
          [70, 30],
          [110, 34],
          [150, 22],
          [200, 26],
        ]}
      />
    </Frame>
  ),
  markers: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Line c={c} width={1.8} />
      <g className="hl">
        {LINE_POINTS.map(([x, y]) => (
          <circle
            key={x}
            cx={x}
            cy={y}
            r="4.2"
            fill={c.surface}
            stroke={c.accent}
            strokeWidth="2"
          />
        ))}
      </g>
    </Frame>
  ),
  barGap: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars c={c} heights={[34, 52, 42, 58]} x0={46} gap={30} width={22} />
      <g
        className="hl"
        stroke={c.accent}
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M68 96 h30" />
        <path d="M71 92 l-3 4 l3 4 M95 92 l3 4 l-3 4" />
      </g>
    </Frame>
  ),
  barRadius: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars
        c={c}
        heights={[30, 50, 40, 58]}
        x0={46}
        gap={26}
        width={26}
        radius={10}
        hl
      />
    </Frame>
  ),
  barBorder: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars
        c={c}
        fills={[c.accentSoft]}
        stroke={c.accent}
        heights={[30, 50, 40, 58]}
        x0={46}
        gap={26}
        width={26}
        radius={3}
        hl
      />
    </Frame>
  ),
  stack: c => (
    <Frame c={c}>
      <Axes c={c} />
      {[0, 1, 2, 3, 4].map(i => {
        const bottom = [14, 22, 16, 26, 18][i];
        const top = [12, 18, 16, 22, 14][i];
        const x = 42 + i * 36;
        return (
          <g key={i}>
            <rect
              x={x}
              y={88 - bottom}
              width="24"
              height={bottom}
              rx="2"
              fill={c.accent}
            />
            <rect
              x={x}
              y={88 - bottom - top}
              width="24"
              height={top}
              rx="2"
              fill={c.second}
              className="hl"
            />
          </g>
        );
      })}
    </Frame>
  ),
  area: c => (
    <Frame c={c}>
      <Axes c={c} />
      <path
        d={`M38 88 ${LINE_POINTS.map(([x, y]) => `L${x} ${y}`).join(' ')} L198 88Z`}
        fill={c.accent}
        opacity="0.22"
        className="hl"
      />
      <Line c={c} />
    </Frame>
  ),
  conditional: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars
        c={c}
        fills={[c.third, c.third, c.accent, c.accent, c.third]}
        heights={[26, 34, 52, 58, 30]}
        hl
      />
      <line
        x1="30"
        x2="226"
        y1="42"
        y2="42"
        stroke={c.accent}
        strokeDasharray="4 3"
      />
      <Label x={216} y={37} fill={c.accent} size={8.5}>
        &gt; 50
      </Label>
    </Frame>
  ),
  tooltip: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Line c={c} />
      <line
        x1="134"
        x2="134"
        y1="18"
        y2="88"
        stroke={c.faint}
        strokeDasharray="3 3"
      />
      <circle cx="134" cy="38" r="4.5" fill={c.accent} />
      <g className="hl">
        <rect
          x="142"
          y="16"
          width="76"
          height="44"
          rx="8"
          fill={c.surface}
          stroke={c.accent}
        />
        <Chip c={c} x={150} y={29} fill={c.accent} w={46} />
        <Chip c={c} x={150} y={43} fill={c.second} w={36} />
        <Tick c={c} x={200} y={27} w={12} color={c.accent} />
        <Tick c={c} x={200} y={41} w={12} color={c.second} />
      </g>
    </Frame>
  ),
  donut: c => (
    <Frame c={c}>
      <g transform="translate(124 56)" className="hl">
        <circle r="30" fill="none" stroke={c.third} strokeWidth="12" />
        <circle
          r="30"
          fill="none"
          stroke={c.accent}
          strokeWidth="12"
          strokeDasharray="82 188"
          transform="rotate(-90)"
        />
        <circle
          r="30"
          fill="none"
          stroke={c.second}
          strokeWidth="12"
          strokeDasharray="50 188"
          strokeDashoffset="-84"
          transform="rotate(-90)"
        />
      </g>
    </Frame>
  ),
  rose: c => (
    <Frame c={c}>
      <g transform="translate(124 56)" className="hl">
        {[44, 30, 38, 22, 34, 26].map((radius, i) => {
          const a0 = (i * Math.PI) / 3 - Math.PI / 2;
          const a1 = ((i + 1) * Math.PI) / 3 - Math.PI / 2;
          const p = (r: number, a: number) =>
            `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
          return (
            <path
              key={radius}
              d={`M0 0 L${p(radius, a0)} A${radius} ${radius} 0 0 1 ${p(radius, a1)}Z`}
              fill={[c.accent, c.second, c.third][i % 3]}
              stroke={c.surface}
              strokeWidth="1.5"
            />
          );
        })}
      </g>
    </Frame>
  ),
  pieLabels: c => (
    <Frame c={c}>
      <g transform="translate(124 56)">
        <circle r="26" fill={c.third} />
        <path d="M0 0 L0 -26 A26 26 0 0 1 24.7 8Z" fill={c.accent} />
        <path d="M0 0 L24.7 8 A26 26 0 0 1 -6 25.3Z" fill={c.second} />
      </g>
      <g className="hl">
        <polyline
          points="144,34 168,26 184,26"
          fill="none"
          stroke={c.accent}
          strokeWidth="1.4"
        />
        <Tick c={c} x={186} y={24} w={26} color={c.accent} />
        <polyline
          points="144,82 166,86 182,86"
          fill="none"
          stroke={c.accent}
          strokeWidth="1.4"
        />
        <Tick c={c} x={184} y={84} w={26} color={c.accent} />
      </g>
    </Frame>
  ),
  sort: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars c={c} heights={[56, 46, 38, 28, 18]} x0={40} />
      <Arrow c={c} x1={52} y1={24} x2={200} y2={24} />
    </Frame>
  ),
  zoom: c => (
    <Frame c={c}>
      <Axes c={c} y={78} h={52} />
      <Line
        c={c}
        points={[
          [38, 62],
          [70, 48],
          [102, 56],
          [134, 32],
          [166, 40],
          [198, 24],
        ]}
      />
      <rect x="30" y="88" width="196" height="8" rx="4" fill={c.faint} />
      <rect
        x="86"
        y="88"
        width="84"
        height="8"
        rx="4"
        fill={c.accent}
        className="hl"
      />
    </Frame>
  ),

  canvasMargins: c => (
    <Frame c={c}>
      <rect
        x="6"
        y="6"
        width="236"
        height="100"
        rx="9"
        fill={c.accentSoft}
        opacity="0.5"
        className="hl"
      />
      <Cards c={c} />
      <Arrow c={c} x1={7} y1={36} x2={19} y2={36} />
      <Arrow c={c} x1={70} y1={7} x2={70} y2={17} />
    </Frame>
  ),
  canvasGap: c => (
    <Frame c={c}>
      <Cards
        c={c}
        cards={[
          [20, 16, 92, 34],
          [132, 16, 90, 34],
          [20, 70, 202, 28],
        ]}
      />
      <g className="hl" fill={c.accent} opacity="0.4">
        <rect x="112" y="16" width="20" height="34" rx="3" />
        <rect x="20" y="50" width="202" height="20" rx="3" />
      </g>
    </Frame>
  ),
  cardRadius: c => (
    <Frame c={c}>
      <Cards c={c} radius={14} stroke={c.accent} hl />
    </Frame>
  ),
  cardShadow: c => (
    <Frame c={c}>
      <Cards c={c} shadow hl />
    </Frame>
  ),
  cardPadding: c => (
    <Frame c={c}>
      <Cards c={c} inner hl />
    </Frame>
  ),
  cardBorder: c => (
    <Frame c={c}>
      <Cards c={c} stroke={c.accent} strokeWidth={2.2} hl />
    </Frame>
  ),
  cardBackground: c => (
    <Frame c={c}>
      <Cards c={c} fill={c.accentSoft} stroke={c.accent} hl />
    </Frame>
  ),
  canvasBackground: c => (
    <Frame c={c}>
      <rect
        x="6"
        y="6"
        width="236"
        height="100"
        rx="9"
        fill={c.accentSoft}
        className="hl"
      />
      <Cards c={c} />
    </Frame>
  ),
  gradient: c => (
    <Frame c={c}>
      <defs>
        <linearGradient id="help-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.accent} />
          <stop offset="1" stopColor={c.accentSoft} />
        </linearGradient>
      </defs>
      <rect
        x="6"
        y="6"
        width="236"
        height="100"
        rx="9"
        fill="url(#help-gradient)"
        className="hl"
      />
      <Cards c={c} />
    </Frame>
  ),
  opacity: c => (
    <Frame c={c}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={12 + i * 19.5}
          y={i % 2 ? 38 : 22}
          width="19.5"
          height="16"
          fill={c.third}
          opacity="0.6"
        />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={`b${i}`}
          x={12 + i * 19.5}
          y={i % 2 ? 22 : 38}
          width="19.5"
          height="16"
          fill={c.faint}
          opacity="0.6"
        />
      ))}
      <rect
        x="40"
        y="24"
        width="168"
        height="62"
        rx="10"
        fill={c.accent}
        opacity="0.55"
        className="hl"
      />
      <Bars
        c={c}
        heights={[14, 24, 18, 28, 20]}
        x0={82}
        base={78}
        gap={8}
        width={14}
        fills={[c.surface]}
      />
    </Frame>
  ),
  cardTitle: c => (
    <Frame c={c}>
      <rect
        x="20"
        y="16"
        width="202"
        height="80"
        rx="8"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="32"
        y="26"
        width="78"
        height="9"
        rx="4.5"
        fill={c.accent}
        className="hl"
      />
      <Bars
        c={c}
        heights={[14, 26, 20, 32, 24]}
        x0={84}
        base={88}
        gap={10}
        width={14}
      />
    </Frame>
  ),
  cardSubtitle: c => (
    <Frame c={c}>
      <rect
        x="20"
        y="16"
        width="202"
        height="80"
        rx="8"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="32"
        y="26"
        width="78"
        height="8"
        rx="4"
        fill={c.ink}
        opacity="0.7"
      />
      <rect
        x="32"
        y="39"
        width="54"
        height="5"
        rx="2.5"
        fill={c.accent}
        className="hl"
      />
      <Bars
        c={c}
        heights={[12, 22, 16, 28, 20]}
        x0={84}
        base={90}
        gap={10}
        width={14}
      />
    </Frame>
  ),
  headerLine: c => (
    <Frame c={c}>
      <rect
        x="20"
        y="16"
        width="202"
        height="80"
        rx="8"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="32"
        y="24"
        width="70"
        height="8"
        rx="4"
        fill={c.ink}
        opacity="0.7"
      />
      <line
        x1="20"
        x2="222"
        y1="40"
        y2="40"
        stroke={c.accent}
        strokeWidth="2"
        className="hl"
      />
      <Bars
        c={c}
        heights={[12, 22, 16, 28, 20]}
        x0={84}
        base={90}
        gap={10}
        width={14}
      />
    </Frame>
  ),
  gridColumns: c => (
    <Frame c={c}>
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x={14 + i * 18.4}
          y="14"
          width="14.4"
          height="84"
          rx="2"
          fill={c.accentSoft}
          className="hl"
        />
      ))}
      <rect
        x="14"
        y="22"
        width="87"
        height="30"
        rx="4"
        fill={c.surface}
        stroke={c.accent}
      />
      <rect
        x="123"
        y="22"
        width="106"
        height="30"
        rx="4"
        fill={c.surface}
        stroke={c.accent}
      />
      <rect
        x="14"
        y="60"
        width="215"
        height="30"
        rx="4"
        fill={c.surface}
        stroke={c.accent}
      />
    </Frame>
  ),
  gridRows: c => (
    <Frame c={c}>
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1="14"
          x2="234"
          y1={20 + i * 18}
          y2={20 + i * 18}
          stroke={c.accent}
          strokeDasharray="3 3"
          className="hl"
        />
      ))}
      <rect
        x="20"
        y="22"
        width="96"
        height="32"
        rx="4"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="126"
        y="22"
        width="96"
        height="68"
        rx="4"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="20"
        y="58"
        width="96"
        height="32"
        rx="4"
        fill={c.surface}
        stroke={c.faint}
      />
    </Frame>
  ),
  gridLines: c => (
    <Frame c={c}>
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 12 }, (__, col) => (
          <circle
            key={`${r}-${col}`}
            cx={20 + col * 19}
            cy={20 + r * 15.5}
            r="1.6"
            fill={c.accent}
            className="hl"
          />
        )),
      )}
      <rect
        x="39"
        y="35"
        width="76"
        height="31"
        rx="4"
        fill={c.surface}
        stroke={c.faint}
      />
      <rect
        x="134"
        y="51"
        width="76"
        height="31"
        rx="4"
        fill={c.surface}
        stroke={c.faint}
      />
    </Frame>
  ),
  mobileView: c => (
    <Frame c={c}>
      <rect
        x="92"
        y="12"
        width="64"
        height="88"
        rx="10"
        fill={c.surface}
        stroke={c.accent}
        strokeWidth="1.8"
        className="hl"
      />
      <rect x="100" y="22" width="48" height="20" rx="4" fill={c.accentSoft} />
      <rect x="100" y="46" width="48" height="20" rx="4" fill={c.accentSoft} />
      <rect x="100" y="70" width="48" height="20" rx="4" fill={c.accentSoft} />
      <Cards
        c={c}
        cards={[
          [16, 30, 54, 22],
          [16, 58, 54, 22],
        ]}
      />
      <Cards
        c={c}
        cards={[
          [178, 30, 54, 22],
          [178, 58, 54, 22],
        ]}
      />
    </Frame>
  ),
  visibility: c => (
    <Frame c={c}>
      <Cards
        c={c}
        cards={[
          [20, 18, 98, 36],
          [126, 18, 96, 36],
          [20, 60, 202, 36],
        ]}
      />
      <rect
        x="126"
        y="18"
        width="96"
        height="36"
        rx="6"
        fill={c.surface}
        opacity="0.85"
      />
      <g
        className="hl"
        fill="none"
        stroke={c.accent}
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M152 36 q22 -14 44 0 q-22 14 -44 0z" />
        <circle cx="174" cy="36" r="4" />
        <line x1="154" y1="46" x2="194" y2="26" />
      </g>
    </Frame>
  ),
  lock: c => (
    <Frame c={c}>
      <Cards c={c} />
      <g className="hl">
        <rect x="108" y="40" width="32" height="26" rx="6" fill={c.accent} />
        <path
          d="M115 40 v-6 a9 9 0 0 1 18 0 v6"
          fill="none"
          stroke={c.accent}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="124" cy="52" r="3" fill={c.surface} />
      </g>
    </Frame>
  ),
  colorBy: c => (
    <Frame c={c}>
      <Axes c={c} />
      <Bars
        c={c}
        fills={[c.accent, c.second, c.third, c.accent, c.second]}
        hl
      />
    </Frame>
  ),
};

export const HelpIllustration = ({
  kind,
}: {
  kind: HelpIllustrationKind;
}): ReactElement => {
  const c = usePalette();
  return (
    <svg
      viewBox={`0 0 ${ILLUSTRATION_WIDTH} ${ILLUSTRATION_HEIGHT}`}
      width="100%"
      role="presentation"
      aria-hidden="true"
      data-test="help-illustration"
      data-kind={kind}
    >
      {DRAWINGS[kind](c)}
    </svg>
  );
};
