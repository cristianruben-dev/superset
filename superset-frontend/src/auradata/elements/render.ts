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
import DOMPurify from 'dompurify';
import tinycolor from 'tinycolor2';
import type { SupersetTheme } from '@apache-superset/core/theme';
import type { Fill, TextStyle } from './types';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A color with an opacity from 0 to 100. */
export const colorWithOpacity = (color: string, opacity = 100) =>
  tinycolor(color)
    .setAlpha(clamp(opacity, 0, 100) / 100)
    .toRgbString();

/** CSS background of a fill. */
export function fillBackground(
  fill: Fill | undefined,
  theme: SupersetTheme,
): string {
  if (!fill || fill.type === 'none') return 'transparent';
  const opacity = fill.opacity ?? 100;
  const first = colorWithOpacity(fill.color || theme.colorPrimary, opacity);
  if (fill.type === 'gradient') {
    const second = colorWithOpacity(
      fill.color2 || theme.colorPrimaryBg,
      opacity,
    );
    return `linear-gradient(${fill.angle ?? 135}deg, ${first}, ${second})`;
  }
  return first;
}

export const shadowFilter = (
  shadow: 'none' | 'soft' | 'strong' | undefined,
) => {
  if (shadow === 'soft') return 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))';
  if (shadow === 'strong')
    return 'drop-shadow(0 12px 28px rgba(0, 0, 0, 0.24))';
  return undefined;
};

export const boxShadow = (
  shadow: 'none' | 'soft' | 'strong' | undefined,
  theme: SupersetTheme,
) => {
  if (shadow === 'soft') return theme.boxShadowTertiary;
  if (shadow === 'strong') return theme.boxShadowSecondary;
  return 'none';
};

const VERTICAL = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const HORIZONTAL = { left: 'flex-start', center: 'center', right: 'flex-end' };

/** Typography of a text style, laid out in a flex box. */
export function textCss(
  style: TextStyle | undefined,
  theme: SupersetTheme,
): CSSProperties {
  return {
    fontSize: style?.size ?? 14,
    color: style?.color || theme.colorText,
    fontWeight: style?.weight ?? 400,
    fontStyle: style?.italic ? 'italic' : undefined,
    textAlign: style?.align ?? 'left',
    lineHeight: style?.lineHeight ?? 1.4,
    letterSpacing:
      style?.letterSpacing !== undefined
        ? `${style.letterSpacing}px`
        : undefined,
    textTransform: style?.uppercase ? 'uppercase' : undefined,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: VERTICAL[style?.verticalAlign ?? 'top'],
    alignItems: 'stretch',
  };
}

export const horizontalJustify = (align: TextStyle['align']) =>
  HORIZONTAL[align ?? 'center'];

const ALLOWED_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'strike',
  'br',
  'p',
  'div',
  'span',
  'font',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'a',
];

let hooked = false;

/** Keeps the formatting of rich text and drops anything that could run. */
export function sanitizeRichText(html: string): string {
  if (!hooked) {
    hooked = true;
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'style', 'color', 'size', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/)/i,
  });
}

/** A link a button may open: http(s), mail or a path of this site. */
export const isSafeUrl = (url: string | undefined) =>
  !!url && /^(?:https?:\/\/|mailto:|\/(?!\/))/i.test(url.trim());

/** Points of a regular star in a 100x100 box. */
export const starPoints = (spikes = 5) =>
  Array.from({ length: spikes * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? 50 : 21;
    const angle = (Math.PI / spikes) * index - Math.PI / 2;
    return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(
      50 +
      radius * Math.sin(angle)
    ).toFixed(2)}`;
  }).join(' ');
