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
export type CanvasSizeMode = 'auto' | '16:9' | '4:3' | 'custom';

export interface CanvasFormat {
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
  /** Space around the visuals, in pixels */
  padding?: number;
  /** Space between visuals, in pixels */
  gap?: number;
}

/** Layout meta keys hiding an object from viewers and locking it in place. */
export const HIDDEN_KEY = 'mibiHidden';
export const LOCKED_KEY = 'mibiLocked';

/** Layout meta keys holding the formats. */
export const VISUAL_FORMAT_KEY = 'mibiFormat';
export const CANVAS_FORMAT_KEY = 'mibiCanvas';

export const DEFAULT_GAP = 16;
export const DEFAULT_PADDING = 0;
export const DEFAULT_RADIUS = 14;
export const MIN_CANVAS = 320;
export const MAX_CANVAS = 4096;

export const CANVAS_PRESETS: Record<'16:9' | '4:3', [number, number]> = {
  '16:9': [1280, 720],
  '4:3': [1024, 768],
};
