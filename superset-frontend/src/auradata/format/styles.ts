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
  CELL,
  MAX_CANVAS,
  MIN_CANVAS,
  type CanvasFormat,
  type CanvasPreset,
  SAMPLING_FORMAT_KEY,
  TOOLTIP_FORMAT_KEY,
  type ActionButtonFormat,
  type BoxSides,
  type ButtonEffect,
  type ChartTooltipFormat,
  type EffectPosition,
  type HeaderTooltipFormat,
  type ShadowDetail,
  type ShadowLevel,
  type VisualFormat,
} from './types';

/** Padding of a visual card before any format, see DashboardBuilder. */
export const BASE_VISUAL_PADDING = 16;
const BASE_BORDER = 1;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

export const shadowOf = (
  level: ShadowLevel | undefined,
  theme: SupersetTheme,
  detail?: ShadowDetail,
) => {
  if (level === 'none') return 'none';
  if (level === 'strong') return theme.boxShadowSecondary;
  if (level === 'custom') {
    const {
      color = '#000000',
      opacity = 25,
      angle = 90,
      distance = 4,
      blur = 12,
      spread = 0,
      inset,
    } = detail ?? {};
    const radians = (angle * Math.PI) / 180;
    const x = Math.round(Math.cos(radians) * distance);
    const y = Math.round(Math.sin(radians) * distance);
    return `${inset ? 'inset ' : ''}${x}px ${y}px ${blur}px ${spread}px ${withOpacity(color, opacity)}`;
  }
  return undefined;
};

export interface VisualStyle {
  /** Inline style for the visual card */
  style: CSSProperties;
  /** CSS variables the title rules read */
  className?: string;
  /** Pixels the chart loses in width because of padding and border */
  shrinkX: number;
  /** Pixels the chart loses in height because of padding and border */
  shrinkY: number;
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
  if (shared.chart || own.chart) {
    merged.chart = { ...shared.chart, ...own.chart };
  }
  return merged;
}

const ITEMS_OF = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

/** How a visual format turns into the card's style. */
export function visualStyle(
  format: VisualFormat | undefined,
  theme: SupersetTheme,
): VisualStyle {
  if (!format) return { style: {}, shrinkX: 0, shrinkY: 0 };
  const style: Record<string, string | number> = {};
  if (format.background !== undefined) {
    style.backgroundColor = withOpacity(
      format.background,
      format.backgroundOpacity,
    );
  }
  if (
    format.borderWidth !== undefined ||
    format.borderColor ||
    format.borderOpacity !== undefined
  ) {
    const width = format.borderWidth ?? BASE_BORDER;
    const base = format.borderColor || theme.colorBorderSecondary;
    const color =
      format.borderOpacity === undefined
        ? base
        : withOpacity(base, format.borderOpacity);
    style.border = width > 0 ? `${width}px solid ${color}` : '0';
  }
  if (format.radius !== undefined)
    style['--mb-v-radius'] = `${format.radius}px`;
  const shadow = shadowOf(format.shadow, theme, format.shadowDetail);
  if (shadow) style.boxShadow = shadow;
  const allSides = format.padding ?? BASE_VISUAL_PADDING;
  const sides = {
    top: format.paddingSides?.top ?? allSides,
    right: format.paddingSides?.right ?? allSides,
    bottom: format.paddingSides?.bottom ?? allSides,
    left: format.paddingSides?.left ?? allSides,
  };
  if (format.paddingSides) {
    style.padding = `${sides.top}px ${sides.right}px ${sides.bottom}px ${sides.left}px`;
  } else if (format.padding !== undefined) {
    style.padding = `${format.padding}px`;
  }
  const { title, header } = format;
  if (title?.fontFamily) style['--mb-v-title-family'] = title.fontFamily;
  if (title?.underline !== undefined)
    style['--mb-v-title-decoration'] = title.underline ? 'underline' : 'none';
  if (title?.gap !== undefined) style['--mb-v-header-gap'] = `${title.gap}px`;
  if (header?.iconColor) {
    style['--mb-v-icon-color'] = withOpacity(
      header.iconColor,
      header.iconOpacity,
    );
  } else if (header?.iconOpacity !== undefined) {
    style['--mb-v-icon-color'] = withOpacity(
      theme.colorTextSecondary,
      header.iconOpacity,
    );
  }
  if (header?.iconBackground) {
    style['--mb-v-icon-bg'] = withOpacity(
      header.iconBackground,
      header.iconOpacity,
    );
  }
  if (header?.iconBorder) {
    style['--mb-v-icon-border'] = `1px solid ${withOpacity(
      header.iconBorder,
      header.iconOpacity,
    )}`;
  }
  if (title?.dividerBleed) {
    style['--mb-v-pad-left'] = `${sides.left}px`;
    style['--mb-v-pad-right'] = `${sides.right}px`;
  }
  const spacing = title?.spacing?.customize ? title.spacing : undefined;
  if (spacing) {
    const vars: [string, number | undefined][] = [
      ['--mb-s-title', spacing.belowTitle],
      ['--mb-s-above-subtitle', spacing.aboveSubtitle],
      ['--mb-s-below-subtitle', spacing.belowSubtitle],
      ['--mb-s-above-divider', spacing.aboveDivider],
      ['--mb-s-plot', spacing.abovePlot],
      ['--mb-s-card', spacing.cardValue],
    ];
    vars.forEach(([name, value]) => {
      if (value !== undefined) style[name] = `${value}px`;
    });
  }
  if (title?.size) style['--mb-v-title-size'] = `${title.size}px`;
  if (title?.color) style['--mb-v-title-color'] = title.color;
  if (title?.align) style['--mb-v-title-align'] = title.align;
  if (title?.background) style['--mb-v-title-bg'] = title.background;
  if (title?.bold !== undefined)
    style['--mb-v-title-weight'] = title.bold ? 700 : 400;
  if (title?.italic !== undefined)
    style['--mb-v-title-style'] = title.italic ? 'italic' : 'normal';
  const { value, label } = format;
  if (value?.size) style['--mb-v-value-size'] = `${value.size}px`;
  if (value?.color) style['--mb-v-value-color'] = value.color;
  if (value?.bold !== undefined)
    style['--mb-v-value-weight'] = value.bold ? 700 : 400;
  if (value?.italic !== undefined)
    style['--mb-v-value-style'] = value.italic ? 'italic' : 'normal';
  if (value?.align) {
    style['--mb-v-value-items'] = ITEMS_OF[value.align];
    style['--mb-v-value-align'] = value.align;
  }
  if (label?.size) style['--mb-v-label-size'] = `${label.size}px`;
  if (label?.color) style['--mb-v-label-color'] = label.color;
  if (label?.bold !== undefined)
    style['--mb-v-label-weight'] = label.bold ? 700 : 400;
  if (label?.italic !== undefined)
    style['--mb-v-label-style'] = label.italic ? 'italic' : 'normal';

  const border =
    format.borderWidth !== undefined ? format.borderWidth : BASE_BORDER;
  return {
    style: style as CSSProperties,
    className:
      [
        title?.show === false && 'auradata-title-hidden',
        title?.background && 'auradata-title-band',
        title?.wrap && 'auradata-title-wrap',
        title?.gap !== undefined && 'auradata-header-gap',
        (header?.iconColor ||
          header?.iconBackground ||
          header?.iconBorder ||
          header?.iconOpacity !== undefined) &&
          'auradata-header-icons',
        title?.dividerBleed && 'auradata-divider-bleed',
        title?.spacing?.customize && 'auradata-spacing',
        format.keepLayerOrder && 'auradata-keep-layer',
        value?.size && 'auradata-v-size',
        value?.color && 'auradata-v-color',
        value?.bold !== undefined && 'auradata-v-weight',
        value?.italic !== undefined && 'auradata-v-style',
        value?.align && 'auradata-v-align',
        label?.size && 'auradata-l-size',
        label?.color && 'auradata-l-color',
        label?.bold !== undefined && 'auradata-l-weight',
        label?.italic !== undefined && 'auradata-l-style',
        // A centered title spans the whole card: see the header icons in skin.css
        title?.align === 'center' && 'auradata-title-center',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    shrinkX:
      sides.left +
      sides.right -
      BASE_VISUAL_PADDING * 2 +
      (border - BASE_BORDER) * 2,
    shrinkY:
      sides.top +
      sides.bottom -
      BASE_VISUAL_PADDING * 2 +
      (border - BASE_BORDER) * 2,
  };
}

/** The style of the text of the tooltip icon in a chart header. */
export function headerTooltipStyle(
  tooltip: HeaderTooltipFormat,
): CSSProperties {
  return {
    fontFamily: tooltip.fontFamily,
    fontSize: tooltip.fontSize,
    fontWeight: tooltip.bold ? 700 : undefined,
    fontStyle: tooltip.italic ? 'italic' : undefined,
    textDecoration: tooltip.underline ? 'underline' : undefined,
    color: tooltip.color,
    background: tooltip.background
      ? withOpacity(tooltip.background, tooltip.opacity)
      : undefined,
  };
}

/** What a chart hands to its ECharts, as read by `applyHostFormat`. */
export function echartsHostFormat(
  format: VisualFormat | undefined,
  tooltipPage = false,
): string | undefined {
  const tooltip = format?.chart?.[TOOLTIP_FORMAT_KEY] as
    | ChartTooltipFormat
    | undefined;
  const sampling = !!format?.chart?.[SAMPLING_FORMAT_KEY];
  if (!tooltip && !sampling && !tooltipPage) return undefined;
  const { background, opacity, ...rest } = tooltip ?? {};
  return JSON.stringify({
    sampling,
    ...(tooltipPage && { tooltipPage }),
    tooltip: tooltip && {
      ...rest,
      background: background ? withOpacity(background, opacity) : undefined,
      // What the labels leave unset stays readable over its background
      textColor:
        rest.labelColor ||
        (background &&
          tinycolor
            .mostReadable(background, ['#ffffff', '#0a0a0f'])
            .toHexString()),
    },
  });
}

const OFFSET_OF: Record<EffectPosition, [number, number]> = {
  'top-left': [-1, -1],
  top: [0, -1],
  'top-right': [1, -1],
  left: [-1, 0],
  center: [0, 0],
  right: [1, 0],
  'bottom-left': [-1, 1],
  bottom: [0, 1],
  'bottom-right': [1, 1],
};

const effectShadow = (effect: ButtonEffect | undefined, fallback: string) => {
  if (!effect?.show) return undefined;
  const [x, y] = OFFSET_OF[effect.position ?? 'center'];
  const blur = effect.blur ?? 8;
  const distance = Math.ceil(blur / 3);
  return `${effect.inset ? 'inset ' : ''}${x * distance}px ${y * distance}px ${blur}px ${withOpacity(
    effect.color || fallback,
    effect.opacity ?? 40,
  )}`;
};

const paddingOf = (all: number | undefined, sides: BoxSides | undefined) =>
  sides
    ? `${sides.top ?? all ?? 0}px ${sides.right ?? all ?? 0}px ${sides.bottom ?? all ?? 0}px ${sides.left ?? all ?? 0}px`
    : all !== undefined
      ? `${all}px`
      : undefined;

const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };
const ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

/** The inline styles of the action button of a chart. */
export function actionButtonStyles(
  button: ActionButtonFormat,
  format: VisualFormat | undefined,
  theme: SupersetTheme,
): { box: CSSProperties; text: CSSProperties; icon: CSSProperties } {
  const fillShown = button.fill?.show !== false;
  const background = button.matchBackground
    ? (format?.background ?? theme.colorBgContainer)
    : button.background?.show
      ? withOpacity(
          button.background.color || theme.colorBgContainer,
          button.background.opacity,
        )
      : undefined;
  const fill = fillShown
    ? withOpacity(
        button.fill?.color || theme.colorFillTertiary,
        button.fill?.opacity,
      )
    : undefined;
  const shadows = [
    effectShadow(button.glow, theme.colorPrimary),
    effectShadow(button.shadow, theme.colorText),
  ].filter(Boolean);
  return {
    box: {
      backgroundColor: fill ?? background ?? 'transparent',
      backgroundImage:
        fill && background ? `linear-gradient(${fill}, ${fill})` : undefined,
      border: button.border?.show
        ? `${button.border.width ?? 1}px solid ${withOpacity(
            button.border.color || theme.colorBorder,
            button.border.opacity,
          )}`
        : '0',
      boxShadow: shadows.length ? shadows.join(', ') : undefined,
      padding: paddingOf(button.padding, button.paddingSides) ?? '4px 8px',
      justifyContent: JUSTIFY[button.alignHorizontal ?? 'center'],
      alignItems: ALIGN[button.alignVertical ?? 'middle'],
    },
    text: {
      fontFamily: button.fontFamily,
      fontSize: button.fontSize,
      fontWeight: button.bold ? 700 : undefined,
      fontStyle: button.italic ? 'italic' : undefined,
      textDecoration: button.underline ? 'underline' : undefined,
      color: withOpacity(
        button.textColor || theme.colorText,
        button.textOpacity,
      ),
      padding: paddingOf(button.textPadding, button.textPaddingSides),
    },
    icon: {
      display: 'inline-flex',
      color: withOpacity(
        button.iconColor || theme.colorPrimary,
        button.iconOpacity,
      ),
      padding: paddingOf(button.iconPadding, button.iconPaddingSides),
    },
  };
}

/** The page size of the canvas, DEFAULT_CANVAS_SIZE unless it has another. */
export function canvasSize(canvas: CanvasFormat | undefined): {
  width: number;
  height: number;
} {
  const size = canvas?.size;
  if (size?.mode === 'custom') {
    const cells = (pixels: number) =>
      clamp(Math.round(pixels / CELL) * CELL, MIN_CANVAS, MAX_CANVAS);
    return {
      width: cells(size.width || CANVAS_PRESETS['16:9'][0]),
      height: cells(size.height || CANVAS_PRESETS['16:9'][1]),
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
  return clamp(Number.isFinite(zoom) && zoom > 0 ? zoom : 1, 0.1, 4);
}

/** Background of the canvas. */
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
  return style as CSSProperties;
}

export const hasCanvasFormat = (canvas: CanvasFormat | undefined) =>
  !!canvas &&
  canvas.background !== undefined &&
  canvas.background.type !== 'none';
