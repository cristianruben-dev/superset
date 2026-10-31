/*
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
 * Shared, chart-agnostic helpers for the "Format" controls a user edits in
 * Explore (title/subtitle, container effects, font styles). They live in core
 * so that both SuperChart (which draws the visual container for every viz
 * type) and individual chart plugins (which style labels, legends and axes)
 * resolve the same form-data values the same way.
 */

/** A color as stored by the color picker controls. */
export type ColorInput =
  | string
  | { r: number; g: number; b: number; a?: number }
  | null
  | undefined;

/** Value stored by the `FontControl` explore control. */
export interface FontStyleValue {
  /** CSS font family; empty means "inherit from the theme". */
  fontFamily?: string | null;
  /** Font size in pixels; empty means "use the default for this element". */
  fontSize?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  /** Text color; empty means "inherit from the theme". */
  color?: ColorInput;
}

export interface ResolvedFontStyle {
  fontFamily?: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  color?: string;
}

export const FONT_FAMILY_OPTIONS: [string, string][] = [
  ['Inter, Helvetica, Arial, sans-serif', 'Inter'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Helvetica, Arial, sans-serif', 'Helvetica'],
  ['"Segoe UI", Roboto, sans-serif', 'Segoe UI'],
  ['Roboto, Arial, sans-serif', 'Roboto'],
  ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet MS'],
  ['Georgia, serif', 'Georgia'],
  ['"Times New Roman", Times, serif', 'Times New Roman'],
  ['"Courier New", Courier, monospace', 'Courier New'],
];

const clampAlpha = (alpha: number) => Math.min(Math.max(alpha, 0), 1);

/**
 * Converts any color value stored by the color picker controls (hex string,
 * 8-digit hex with alpha, CSS color string or `{r, g, b, a}` object) into a
 * CSS color string that both the DOM and ECharts understand. Returns
 * `undefined` for empty values so callers can fall back to theme defaults.
 */
export function toCssColor(color: ColorInput): string | undefined {
  if (color === null || color === undefined || color === '') {
    return undefined;
  }
  if (typeof color === 'object') {
    const { r, g, b, a = 1 } = color;
    if ([r, g, b].some(channel => typeof channel !== 'number')) {
      return undefined;
    }
    return `rgba(${r}, ${g}, ${b}, ${clampAlpha(a)})`;
  }
  const value = color.trim();
  const hex8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(
    value,
  );
  if (hex8) {
    const [r, g, b, a] = hex8.slice(1).map(part => parseInt(part, 16));
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
  }
  return value || undefined;
}

/**
 * Parses a numeric control value (controls may store numbers as strings),
 * clamping it to `[min, max]` and falling back when it is empty or invalid.
 */
export function toBoundedNumber(
  value: unknown,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Resolves a stored font style against element-specific defaults.
 */
export function resolveFontStyle(
  value: FontStyleValue | null | undefined,
  defaults: Partial<ResolvedFontStyle> & { fontSize: number },
): ResolvedFontStyle {
  const font = value && typeof value === 'object' ? value : {};
  return {
    fontFamily: font.fontFamily || defaults.fontFamily || undefined,
    fontSize: toBoundedNumber(font.fontSize, defaults.fontSize, 6, 96),
    bold: typeof font.bold === 'boolean' ? font.bold : Boolean(defaults.bold),
    italic:
      typeof font.italic === 'boolean' ? font.italic : Boolean(defaults.italic),
    color: toCssColor(font.color) ?? defaults.color,
  };
}

/**
 * Whether a stored font style differs from "inherit everything", i.e. the
 * user changed at least one property.
 */
export function hasCustomFontStyle(
  value: FontStyleValue | null | undefined,
): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Boolean(
    value.fontFamily ||
    (value.fontSize !== null &&
      value.fontSize !== undefined &&
      `${value.fontSize}` !== '') ||
    typeof value.bold === 'boolean' ||
    typeof value.italic === 'boolean' ||
    toCssColor(value.color),
  );
}

export type VisualTextAlign = 'left' | 'center' | 'right';
export type VisualLineStyle = 'solid' | 'dashed' | 'dotted';
export type VisualShadowPosition = 'outer' | 'bottom_right' | 'bottom';

/** Theme colors the visual container falls back to. */
export interface VisualContainerThemeDefaults {
  colorText?: string;
  colorTextSecondary?: string;
  colorBgContainer?: string;
  colorBorder?: string;
  colorSplit?: string;
  /** Used as the default drop shadow color. */
  colorTextQuaternary?: string;
  fontFamily?: string;
}

export interface VisualContainerConfig {
  title?: {
    text: string;
    font: ResolvedFontStyle;
    align: VisualTextAlign;
    background?: string;
  };
  subtitle?: {
    text: string;
    font: ResolvedFontStyle;
    align: VisualTextAlign;
  };
  divider?: {
    color?: string;
    width: number;
    style: VisualLineStyle;
  };
  /** Space between the header block and the chart, in pixels. */
  headerSpacing: number;
  background?: string;
  border?: {
    color?: string;
    width: number;
    radius: number;
  };
  shadow?: {
    color: string;
    position: VisualShadowPosition;
  };
  padding: number;
}

export const VISUAL_TITLE_LINE_HEIGHT = 1.3;
export const VISUAL_TITLE_BACKGROUND_PADDING = 4;
export const VISUAL_SUBTITLE_GAP = 2;
export const VISUAL_DIVIDER_GAP = 4;
export const VISUAL_SHADOW_BLUR = 8;
export const VISUAL_SHADOW_OFFSET = 4;

const ALIGNMENTS: VisualTextAlign[] = ['left', 'center', 'right'];
const LINE_STYLES: VisualLineStyle[] = ['solid', 'dashed', 'dotted'];
const SHADOW_POSITIONS: VisualShadowPosition[] = [
  'outer',
  'bottom_right',
  'bottom',
];

const pick = <T extends string>(value: unknown, allowed: T[], fallback: T) =>
  allowed.includes(value as T) ? (value as T) : fallback;

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Builds the visual container configuration from raw (snake_case) form data.
 * Returns `null` when the user has not enabled any container option, so
 * charts render exactly as before.
 */
export function getVisualContainerConfig(
  formData: Record<string, unknown> | null | undefined,
  theme: VisualContainerThemeDefaults = {},
): VisualContainerConfig | null {
  if (!formData) {
    return null;
  }
  const align = pick(formData.visual_title_align, ALIGNMENTS, 'left');
  const titleText = asText(formData.visual_title_text);
  const subtitleText = asText(formData.visual_subtitle_text);

  const title =
    formData.visual_title_show && titleText
      ? {
          text: titleText,
          align,
          font: resolveFontStyle(
            formData.visual_title_font as FontStyleValue | undefined,
            {
              fontSize: 16,
              bold: true,
              color: theme.colorText,
              fontFamily: theme.fontFamily,
            },
          ),
          background: toCssColor(
            formData.visual_title_background as ColorInput,
          ),
        }
      : undefined;

  const subtitle =
    formData.visual_subtitle_show && subtitleText
      ? {
          text: subtitleText,
          align: pick(formData.visual_subtitle_align, ALIGNMENTS, align),
          font: resolveFontStyle(
            formData.visual_subtitle_font as FontStyleValue | undefined,
            {
              fontSize: 12,
              color: theme.colorTextSecondary,
              fontFamily: theme.fontFamily,
            },
          ),
        }
      : undefined;

  const divider = formData.visual_divider_show
    ? {
        color:
          toCssColor(formData.visual_divider_color as ColorInput) ??
          theme.colorSplit,
        width: toBoundedNumber(formData.visual_divider_width, 1, 1, 10),
        style: pick(formData.visual_divider_style, LINE_STYLES, 'solid'),
      }
    : undefined;

  const background = formData.visual_background_show
    ? (toCssColor(formData.visual_background_color as ColorInput) ??
      theme.colorBgContainer)
    : undefined;

  const border = formData.visual_border_show
    ? {
        color:
          toCssColor(formData.visual_border_color as ColorInput) ??
          theme.colorBorder,
        width: toBoundedNumber(formData.visual_border_width, 1, 0, 20),
        radius: toBoundedNumber(formData.visual_border_radius, 4, 0, 64),
      }
    : undefined;

  const shadow = formData.visual_shadow_show
    ? {
        color:
          toCssColor(formData.visual_shadow_color as ColorInput) ??
          theme.colorTextQuaternary ??
          'currentColor',
        position: pick(
          formData.visual_shadow_position,
          SHADOW_POSITIONS,
          'outer',
        ),
      }
    : undefined;

  const padding = toBoundedNumber(formData.visual_padding, 0, 0, 64);

  if (
    !title &&
    !subtitle &&
    !divider &&
    !background &&
    !border &&
    !shadow &&
    padding === 0
  ) {
    return null;
  }

  return {
    title,
    subtitle,
    divider,
    headerSpacing: toBoundedNumber(formData.visual_header_spacing, 8, 0, 64),
    background,
    border,
    shadow,
    padding,
  };
}

/** Height in pixels of a single line of text for the given font size. */
export const getVisualLineHeight = (fontSize: number) =>
  Math.ceil(fontSize * VISUAL_TITLE_LINE_HEIGHT);

/**
 * Deterministic height of the header block (title, subtitle, divider and
 * spacing). Titles never wrap, so the height can be computed without
 * measuring the DOM, which keeps chart sizing stable on first render.
 */
export function getVisualHeaderHeight(config: VisualContainerConfig): number {
  const { title, subtitle, divider } = config;
  let height = 0;
  if (title) {
    height += getVisualLineHeight(title.font.fontSize);
    if (title.background) {
      height += VISUAL_TITLE_BACKGROUND_PADDING * 2;
    }
  }
  if (subtitle) {
    height +=
      (title ? VISUAL_SUBTITLE_GAP : 0) +
      getVisualLineHeight(subtitle.font.fontSize);
  }
  if (divider) {
    height += (title || subtitle ? VISUAL_DIVIDER_GAP : 0) + divider.width;
  }
  if (height > 0) {
    height += config.headerSpacing;
  }
  return height;
}

/** Margin kept around the frame so a drop shadow is not clipped. */
export const getVisualShadowMargin = (config: VisualContainerConfig) =>
  config.shadow ? VISUAL_SHADOW_BLUR : 0;

export function getVisualShadowCss(config: VisualContainerConfig) {
  if (!config.shadow) {
    return undefined;
  }
  const { color, position } = config.shadow;
  const blur = VISUAL_SHADOW_BLUR;
  const offset = VISUAL_SHADOW_OFFSET;
  switch (position) {
    case 'bottom_right':
      return `${offset}px ${offset}px ${blur}px ${color}`;
    case 'bottom':
      return `0 ${offset}px ${blur}px ${color}`;
    default:
      return `0 0 ${blur}px ${color}`;
  }
}

/**
 * Size left for the chart itself once the container chrome (shadow margin,
 * border, padding and header) is subtracted from the available box.
 */
export function getVisualContainerInnerSize(
  config: VisualContainerConfig,
  width: number,
  height: number,
): { width: number; height: number; headerHeight: number } {
  const chrome =
    getVisualShadowMargin(config) +
    (config.border?.width ?? 0) +
    config.padding;
  const headerHeight = getVisualHeaderHeight(config);
  return {
    width: Math.max(Math.floor(width - chrome * 2), 0),
    height: Math.max(Math.floor(height - chrome * 2 - headerHeight), 0),
    headerHeight,
  };
}
