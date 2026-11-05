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
import type { ElementAction } from '../elements/types';
import type {
  ActionButtonFormat,
  ButtonEffect,
  ChartTooltipFormat,
  HeaderTooltipFormat,
  ShadowDetail,
  TitleSpacing,
  VisualFormat,
} from './types';

/**
 * What a setting of the General level holds, for tools that format a report
 * without the pane (the MCP service reads it from the format catalog).
 */
export type FieldSpec =
  | { type: 'boolean' }
  | { type: 'number'; min?: number; max?: number; integer?: boolean }
  | {
      type: 'string';
      /**
       * color: a CSS color; url: http(s), mailto or a path of this site;
       * page and bookmark: an id of the report
       */
      format?: 'color' | 'url' | 'page' | 'bookmark';
    }
  | { type: 'enum'; values: readonly (string | number)[] }
  | { type: 'object'; fields: Record<string, FieldSpec> };

type Leaf = Exclude<FieldSpec, { type: 'object' }>;

/** Every key of a settings type, described: a missing key fails to compile. */
type Described<T> = {
  [K in keyof Required<T>]: NonNullable<T[K]> extends object
    ? { type: 'object'; fields: Described<NonNullable<T[K]>> }
    : Leaf;
};

const bool = { type: 'boolean' } as const;
const text = { type: 'string' } as const;
const color = { type: 'string', format: 'color' } as const;
const num = { type: 'number' } as const;
const percent = { type: 'number', min: 0, max: 100 } as const;
const px = { type: 'number', min: 0 } as const;
const fontFamily = text;
const fontSize = { type: 'number', min: 1 } as const;
const align = { type: 'enum', values: ['left', 'center', 'right'] } as const;

const sides = {
  type: 'object',
  fields: { top: px, right: px, bottom: px, left: px },
} as const;

const shadowDetail: Described<ShadowDetail> = {
  color,
  opacity: percent,
  angle: num,
  distance: px,
  blur: px,
  spread: num,
  inset: bool,
};

const spacing: Described<TitleSpacing> = {
  customize: bool,
  belowTitle: px,
  aboveSubtitle: px,
  belowSubtitle: px,
  aboveDivider: px,
  abovePlot: px,
  cardValue: px,
};

const headerTooltip: Described<HeaderTooltipFormat> = {
  text,
  fontFamily,
  fontSize,
  bold: bool,
  italic: bool,
  underline: bool,
  color,
  background: color,
  opacity: percent,
};

const action: Described<ElementAction> = {
  type: {
    type: 'enum',
    values: ['none', 'page', 'url', 'reset-filters', 'top', 'bookmark', 'back'],
  },
  tabId: { type: 'string', format: 'page' },
  bookmarkId: { type: 'string', format: 'bookmark' },
  url: { type: 'string', format: 'url' },
  newTab: bool,
};

const effect: Described<ButtonEffect> = {
  show: bool,
  color,
  opacity: percent,
  blur: px,
  inset: bool,
  position: {
    type: 'enum',
    values: [
      'top-left',
      'top',
      'top-right',
      'left',
      'center',
      'right',
      'bottom-left',
      'bottom',
      'bottom-right',
    ],
  },
};

const toggleFill = {
  type: 'object',
  fields: { show: bool, color, opacity: percent },
} as const;

const actionButton: Described<ActionButtonFormat> = {
  show: bool,
  position: { type: 'enum', values: ['above', 'within', 'below'] },
  iconOnly: bool,
  text,
  textShow: bool,
  fontFamily,
  fontSize,
  bold: bool,
  italic: bool,
  underline: bool,
  textColor: color,
  textOpacity: percent,
  alignHorizontal: align,
  alignVertical: { type: 'enum', values: ['top', 'middle', 'bottom'] },
  textPadding: px,
  textPaddingSides: sides,
  iconShow: bool,
  iconColor: color,
  iconSize: px,
  iconOpacity: percent,
  iconPadding: px,
  iconPaddingSides: sides,
  fill: toggleFill,
  background: toggleFill,
  matchBackground: bool,
  border: {
    type: 'object',
    fields: { show: bool, color, width: px, opacity: percent },
  },
  glow: { type: 'object', fields: effect },
  shadow: { type: 'object', fields: effect },
  padding: px,
  paddingSides: sides,
};

const chartTooltip: Described<ChartTooltipFormat> = {
  show: bool,
  fontFamily,
  fontSize,
  bold: bool,
  italic: bool,
  underline: bool,
  labelColor: color,
  valueColor: color,
  boldValues: bool,
  background: color,
  opacity: percent,
  sentence: text,
};

/**
 * The settings of the General level, kept in `meta.auradataFormat`. `value`
 * and `label` are the older card styles, read as defaults of the card
 * controls (`legacyCardFormat`), and `chart` holds the chart settings of the
 * other levels.
 */
export const GENERAL_FORMAT: Described<
  Omit<VisualFormat, 'chart' | 'value' | 'label'>
> = {
  background: color,
  backgroundOpacity: percent,
  borderColor: color,
  borderWidth: px,
  borderOpacity: percent,
  radius: px,
  shadow: { type: 'enum', values: ['none', 'soft', 'strong', 'custom'] },
  shadowDetail: { type: 'object', fields: shadowDetail },
  padding: px,
  paddingSides: sides,
  title: {
    type: 'object',
    fields: {
      show: bool,
      fontFamily,
      underline: bool,
      wrap: bool,
      heading: { type: 'number', min: 2, max: 6, integer: true },
      subtitleHeading: { type: 'number', min: 2, max: 6, integer: true },
      subtitleWrap: bool,
      dividerBleed: bool,
      spacing: { type: 'object', fields: spacing },
      size: fontSize,
      color,
      align,
      background: color,
      bold: bool,
      italic: bool,
      template: text,
      subtitle: text,
      subtitleSize: fontSize,
      subtitleColor: color,
      subtitleFamily: fontFamily,
      subtitleBold: bool,
      subtitleItalic: bool,
      subtitleUnderline: bool,
      subtitleAlign: align,
      divider: bool,
      dividerColor: color,
      dividerWidth: px,
      dividerStyle: { type: 'enum', values: ['solid', 'dashed', 'dotted'] },
      gap: px,
    },
  },
  header: {
    type: 'object',
    fields: {
      menu: bool,
      badges: bool,
      iconColor: color,
      iconBackground: color,
      iconBorder: color,
      iconOpacity: percent,
      show: bool,
      focus: bool,
      seeData: bool,
      copy: bool,
      info: bool,
      warning: bool,
      error: bool,
      tooltipIcon: bool,
      tooltip: { type: 'object', fields: headerTooltip },
    },
  },
  link: {
    type: 'object',
    fields: {
      show: bool,
      action: { type: 'object', fields: action },
      tooltip: text,
      disabledTooltip: text,
    },
  },
  actionButton: { type: 'object', fields: actionButton },
  tooltipPage: {
    type: 'object',
    fields: {
      type: { type: 'enum', values: ['default', 'page'] },
      page: { type: 'string', format: 'page' },
    },
  },
  lockAspect: bool,
  keepLayerOrder: bool,
};

/**
 * Chart settings the General level writes into `meta.auradataFormat.chart`:
 * the tooltip and the sampling of ECharts charts.
 */
export const GENERAL_CHART_SETTINGS: Record<string, FieldSpec> = {
  auradata_tooltip: { type: 'object', fields: chartTooltip },
  auradata_sampling: bool,
};
