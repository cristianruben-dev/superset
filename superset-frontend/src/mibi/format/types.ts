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

export type ShadowLevel = 'none' | 'soft' | 'strong';
export type TitleAlign = 'left' | 'center' | 'right';

export interface VisualFormat {
  /** CSS color, or 'transparent' */
  background?: string;
  /** 0 to 100 */
  backgroundOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  shadow?: ShadowLevel;
  padding?: number;
  title?: {
    show?: boolean;
    size?: number;
    color?: string;
    align?: TitleAlign;
    subtitle?: string;
    subtitleSize?: number;
    subtitleColor?: string;
    /** A line under the header */
    divider?: boolean;
    dividerColor?: string;
  };
  /** Which header icons viewers see (all by default) */
  header?: {
    menu?: boolean;
    badges?: boolean;
  };
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

/** Page sizes, in pixels: whole cells close to the ones of Power BI. */
export const CANVAS_PRESETS: Record<CanvasPreset, [number, number]> = {
  '16:9': [48 * CELL, 27 * CELL],
  '4:3': [40 * CELL, 30 * CELL],
  letter: [26 * CELL, 34 * CELL],
};
export const DEFAULT_CANVAS_SIZE: CanvasPreset = '16:9';
