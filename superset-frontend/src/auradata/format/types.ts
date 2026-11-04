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
 * Formatting a dashboard author picks in the Format pane. Both live in the
 * dashboard layout (position_json): the canvas on the root component and each
 * visual on its chart component, so they save, undo and export with it.
 */

import type { ElementAction } from '../elements/types';

export type ShadowLevel = 'none' | 'soft' | 'strong' | 'custom';

/** A shadow set by hand, with 'custom' as its level. */
export interface ShadowDetail {
  color?: string;
  /** 0 to 100 */
  opacity?: number;
  /** Degrees: 90 falls straight down */
  angle?: number;
  distance?: number;
  blur?: number;
  spread?: number;
  inset?: boolean;
}

export interface BoxSides {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export type LineStyle = 'solid' | 'dashed' | 'dotted';

/** Space around the header of a chart, with `customize` on. */
export interface TitleSpacing {
  customize?: boolean;
  belowTitle?: number;
  aboveSubtitle?: number;
  belowSubtitle?: number;
  aboveDivider?: number;
  abovePlot?: number;
  /** Between the value and the label of a card */
  cardValue?: number;
}

/** The text of the tooltip icon in the header of a chart. */
export interface HeaderTooltipFormat {
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;
  /** 0 to 100 */
  opacity?: number;
}

/** Which tooltip the marks of a chart show. */
export interface VisualTooltipPage {
  type?: 'default' | 'page';
  /** Id of a tooltip page; none for the automatic choice by common fields */
  page?: string;
}

/** What the tooltips of the marks of a chart look like. */
export interface ChartTooltipFormat {
  show?: boolean;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  labelColor?: string;
  valueColor?: string;
  boldValues?: boolean;
  background?: string;
  /** 0 to 100 */
  opacity?: number;
  /** A sentence instead of the table, with {series}, {name} and {value} */
  sentence?: string;
}

/** Settings a report passes to the ECharts of its charts. */
export const TOOLTIP_FORMAT_KEY = 'mibi_tooltip';
export const SAMPLING_FORMAT_KEY = 'mibi_sampling';

export type EffectPosition =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

/** The glow or the shadow of the action button. */
export interface ButtonEffect {
  show?: boolean;
  color?: string;
  /** 0 to 100 */
  opacity?: number;
  blur?: number;
  inset?: boolean;
  position?: EffectPosition;
}

/** A button in the title area of a chart. */
export interface ActionButtonFormat {
  show?: boolean;
  position?: 'above' | 'within' | 'below';
  iconOnly?: boolean;
  text?: string;
  textShow?: boolean;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textColor?: string;
  textOpacity?: number;
  alignHorizontal?: 'left' | 'center' | 'right';
  alignVertical?: 'top' | 'middle' | 'bottom';
  textPadding?: number;
  textPaddingSides?: BoxSides;
  iconShow?: boolean;
  iconColor?: string;
  iconSize?: number;
  iconOpacity?: number;
  iconPadding?: number;
  iconPaddingSides?: BoxSides;
  fill?: { show?: boolean; color?: string; opacity?: number };
  background?: { show?: boolean; color?: string; opacity?: number };
  matchBackground?: boolean;
  border?: { show?: boolean; color?: string; width?: number; opacity?: number };
  glow?: ButtonEffect;
  shadow?: ButtonEffect;
  padding?: number;
  paddingSides?: BoxSides;
}
export type TitleAlign = 'left' | 'center' | 'right';

export interface VisualFormat {
  /** CSS color, or 'transparent' */
  background?: string;
  /** 0 to 100 */
  backgroundOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  /** 0 to 100 */
  borderOpacity?: number;
  radius?: number;
  shadow?: ShadowLevel;
  shadowDetail?: ShadowDetail;
  padding?: number;
  /** Padding by side, over `padding` */
  paddingSides?: BoxSides;
  title?: {
    show?: boolean;
    fontFamily?: string;
    underline?: boolean;
    /** Long titles take more lines instead of being cut */
    wrap?: boolean;
    /** For screen readers: heading level 2 to 6, a plain text without it */
    heading?: number;
    subtitleHeading?: number;
    subtitleWrap?: boolean;
    /** The divider reaches the edges of the card */
    dividerBleed?: boolean;
    spacing?: TitleSpacing;
    size?: number;
    color?: string;
    align?: TitleAlign;
    /** Fill of the header band, edge to edge */
    background?: string;
    bold?: boolean;
    italic?: boolean;
    /** Title with tokens: {value}, {filters}, {filter:Name}, {chart} */
    template?: string;
    subtitle?: string;
    subtitleSize?: number;
    subtitleColor?: string;
    subtitleFamily?: string;
    subtitleBold?: boolean;
    subtitleItalic?: boolean;
    subtitleUnderline?: boolean;
    subtitleAlign?: TitleAlign;
    /** A line under the header */
    divider?: boolean;
    dividerColor?: string;
    dividerWidth?: number;
    dividerStyle?: LineStyle;
    /** Space between the header and the chart */
    gap?: number;
  };
  /** The number of a KPI card */
  value?: {
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    /** Title with tokens: {value}, {filters}, {filter:Name}, {chart} */
    template?: string;
    align?: TitleAlign;
  };
  /** The metric name and subtitle of a KPI card */
  label?: {
    size?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
  };
  /** Which header icons viewers see (all by default) */
  header?: {
    menu?: boolean;
    badges?: boolean;
    iconColor?: string;
    iconBackground?: string;
    iconBorder?: string;
    /** 0 to 100 */
    iconOpacity?: number;
    /** All the icons of the header (shown by default) */
    show?: boolean;
    focus?: boolean;
    seeData?: boolean;
    copy?: boolean;
    info?: boolean;
    warning?: boolean;
    error?: boolean;
    tooltipIcon?: boolean;
    tooltip?: HeaderTooltipFormat;
  };
  /** What the link icon and the action button of a chart do */
  link?: {
    show?: boolean;
    action?: ElementAction;
    tooltip?: string;
    disabledTooltip?: string;
  };
  actionButton?: ActionButtonFormat;
  /** A report page as the tooltip of the marks, instead of the default one */
  tooltipPage?: VisualTooltipPage;
  /** Resizing keeps the proportions */
  lockAspect?: boolean;
  /** Selecting it does not bring it over its neighbors */
  keepLayerOrder?: boolean;
  /** Settings of the chart itself, by form data key, over what the chart saved */
  chart?: Record<string, unknown>;
}

export type CanvasBackgroundType = 'none' | 'color' | 'gradient' | 'image';
export type ImageFit = 'cover' | 'contain' | 'repeat';
/**
 * Canvases always have a fixed size, as Power BI pages do. Layouts saved
 * with the former 'auto' mode, or none, get DEFAULT_CANVAS_SIZE.
 */
export type CanvasSizeMode = '16:9' | '4:3' | 'letter' | 'custom';
export type CanvasPreset = Exclude<CanvasSizeMode, 'custom'>;

/**
 * How a report looks next to the app: reports are light by default, like a
 * sheet of paper, whatever the app's own theme is. 'app' follows the app.
 */
export type ReportAppearance = 'light' | 'dark' | 'app';
export const DEFAULT_APPEARANCE: ReportAppearance = 'light';

/** Colors of one area of the report (the filter panel or the tabs). */
export interface AreaStyle {
  background?: string;
  text?: string;
  accent?: string;
}

export interface CanvasFormat {
  /** Light unless set; never follows the app's theme by default */
  appearance?: ReportAppearance;
  filterBar?: AreaStyle;
  tabs?: AreaStyle;
  background?: {
    type: CanvasBackgroundType;
    color?: string;
    color2?: string;
    angle?: number;
    image?: string;
    fit?: ImageFit;
    /** Image opacity, 0 to 100 */
    opacity?: number;
  };
  size?: {
    mode: CanvasSizeMode;
    width?: number;
    height?: number;
  };
  /**
   * The style every chart shares, from "Apply to all charts" or a theme.
   * A chart's own format wins over it, setting by setting.
   */
  visuals?: VisualFormat;
}

/** Layout meta keys holding the formats. */
export const VISUAL_FORMAT_KEY = 'mibiFormat';
export const CANVAS_FORMAT_KEY = 'mibiCanvas';

/**
 * Side of a grid cell, in pixels. The canvas is a grid of square cells: its
 * size is a whole number of cells and every object is placed and sized in them.
 */
export const CELL = 32;
export const DEFAULT_RADIUS = 14;
export const MIN_CANVAS = 10 * CELL;
export const MAX_CANVAS = 128 * CELL;

/**
 * Page sizes, in pixels, in whole cells: Full HD (1920 × 1080, rounded up to
 * 34 rows) and the same height for the other shapes.
 */
export const CANVAS_PRESETS: Record<CanvasPreset, [number, number]> = {
  '16:9': [60 * CELL, 34 * CELL],
  '4:3': [45 * CELL, 34 * CELL],
  letter: [26 * CELL, 34 * CELL],
};
export const DEFAULT_CANVAS_SIZE: CanvasPreset = '16:9';
