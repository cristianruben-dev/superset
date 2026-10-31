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
import type { CSSProperties } from 'react';
import tinycolor from 'tinycolor2';
import type { SupersetTheme } from '@apache-superset/core/theme';
import {
  CANVAS_PRESETS,
  DEFAULT_CANVAS_SIZE,
  DEFAULT_GAP,
  DEFAULT_PADDING,
  MAX_CANVAS,
  MIN_CANVAS,
  type CanvasFormat,
  type CanvasPreset,
  type ShadowLevel,
  type VisualFormat,
} from './types';

/** Padding of a visual card before any format, see DashboardBuilder. */
export const BASE_VISUAL_PADDING = 16;
const BASE_BORDER = 1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const shadowOf = (
  level: ShadowLevel | undefined,
  theme: SupersetTheme,
) => {
  if (level === 'none') return 'none';
  if (level === 'strong') return theme.boxShadowSecondary;
  return undefined;
};

/** A color with its opacity (0-100) applied. */
export const withOpacity = (color: string, opacity = 100) => {
  if (color === 'transparent') return color;
  const parsed = tinycolor(color);
  return parsed.isValid()
    ? parsed
        .setAlpha((parsed.getAlpha() * clamp(opacity, 0, 100)) / 100)
        .toRgbString()
    : color;
};

export interface VisualStyle {
  /** Inline style for the visual card */
  style: CSSProperties;
  /** CSS variables the title rules read */
  className?: string;
  /** Pixels the chart loses on each axis because of padding and border */
  shrink: number;
}

/**
 * The format a chart shows: the style every chart shares, overridden by the
 * chart's own format setting by setting (title and header icons included).
 */
export function mergeVisualFormat(
  shared: VisualFormat | undefined,
  own: VisualFormat | undefined,
): VisualFormat | undefined {
  if (!shared) return own;
  if (!own) return shared;
  const merged: VisualFormat = { ...shared, ...own };
  if (shared.title || own.title) {
    merged.title = { ...shared.title, ...own.title };
  }
  if (shared.header || own.header) {
    merged.header = { ...shared.header, ...own.header };
  }
  return merged;
}

/** How a visual format turns into the card's style. */
export function visualStyle(
  format: VisualFormat | undefined,
  theme: SupersetTheme,
): VisualStyle {
  if (!format) return { style: {}, shrink: 0 };
  const style: Record<string, string | number> = {};
  if (format.background !== undefined) {
    style.backgroundColor = withOpacity(
      format.background,
      format.backgroundOpacity,
    );
  }
  if (format.borderWidth !== undefined || format.borderColor) {
    const width = format.borderWidth ?? BASE_BORDER;
    style.border =
      width > 0
        ? `${width}px solid ${format.borderColor || theme.colorBorderSecondary}`
        : '0';
  }
  if (format.radius !== undefined)
    style['--mb-v-radius'] = `${format.radius}px`;
  const shadow = shadowOf(format.shadow, theme);
  if (shadow) style.boxShadow = shadow;
  if (format.padding !== undefined) style.padding = `${format.padding}px`;
  const { title } = format;
  if (title?.size) style['--mb-v-title-size'] = `${title.size}px`;
  if (title?.color) style['--mb-v-title-color'] = title.color;
  if (title?.align) style['--mb-v-title-align'] = title.align;

  const padding = format.padding ?? BASE_VISUAL_PADDING;
  const border =
    format.borderWidth !== undefined ? format.borderWidth : BASE_BORDER;
  return {
    style: style as CSSProperties,
    className: title?.show === false ? 'mibi-title-hidden' : undefined,
    shrink: (padding - BASE_VISUAL_PADDING) * 2 + (border - BASE_BORDER) * 2,
  };
}

/** Half of the change in space between visuals, applied as a card margin. */
export const gapInset = (canvas: CanvasFormat | undefined) =>
  ((canvas?.gap ?? DEFAULT_GAP) - DEFAULT_GAP) / 2;

/** The page size of the canvas, DEFAULT_CANVAS_SIZE unless it has another. */
export function canvasSize(canvas: CanvasFormat | undefined): {
  width: number;
  height: number;
} {
  const size = canvas?.size;
  if (size?.mode === 'custom') {
    return {
      width: clamp(Math.round(size.width || 1280), MIN_CANVAS, MAX_CANVAS),
      height: clamp(Math.round(size.height || 720), MIN_CANVAS, MAX_CANVAS),
    };
  }
  const preset =
    size && size.mode in CANVAS_PRESETS
      ? (size.mode as CanvasPreset)
      : DEFAULT_CANVAS_SIZE;
  const [width, height] = CANVAS_PRESETS[preset];
  return { width, height };
}

/** Zoom that fits a fixed canvas in the space available. */
export function canvasZoom(
  size: { width: number; height: number },
  available: { width: number; height?: number },
): number {
  const byWidth = available.width / size.width;
  const zoom = available.height
    ? Math.min(byWidth, available.height / size.height)
    : byWidth;
  return clamp(Number.isFinite(zoom) && zoom > 0 ? zoom : 1, 0.25, 4);
}

/** Background, padding and gap of the canvas. */
export function canvasStyle(
  canvas: CanvasFormat | undefined,
  theme: SupersetTheme,
): CSSProperties {
  const style: Record<string, string | number> = {};
  const background = canvas?.background;
  if (background?.type === 'color' && background.color) {
    style.background = background.color;
  } else if (background?.type === 'gradient') {
    style.background = `linear-gradient(${background.angle ?? 135}deg, ${
      background.color || theme.colorBgLayout
    }, ${background.color2 || theme.colorPrimaryBg})`;
  } else if (background?.type === 'image' && background.image) {
    // The opacity fades the picture into the page color
    const veil = tinycolor(theme.colorBgLayout)
      .setAlpha(1 - clamp(background.opacity ?? 100, 0, 100) / 100)
      .toRgbString();
    const fit = background.fit ?? 'cover';
    style.backgroundImage = `linear-gradient(${veil}, ${veil}), url("${background.image}")`;
    style.backgroundSize = fit === 'repeat' ? 'auto' : fit;
    style.backgroundRepeat = fit === 'repeat' ? 'repeat' : 'no-repeat';
    style.backgroundPosition = 'center';
  }
  if (canvas?.padding !== undefined) {
    style.padding = `${canvas.padding}px`;
  }
  const inset = gapInset(canvas);
  if (inset) style['--mb-gap-inset'] = `${inset}px`;
  return style as CSSProperties;
}

export const hasCanvasFormat = (canvas: CanvasFormat | undefined) =>
  !!canvas &&
  ((canvas.background && canvas.background.type !== 'none') ||
    (canvas.padding !== undefined && canvas.padding !== DEFAULT_PADDING) ||
    gapInset(canvas) !== 0);
