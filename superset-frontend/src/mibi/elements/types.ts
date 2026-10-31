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
import type { VisualFormat } from 'src/mibi/format/types';

/**
 * Design elements a dashboard author places on the canvas next to the charts.
 * They are DYNAMIC layout components whose componentKey starts with "mibi-";
 * their settings live in the component meta (ELEMENT_KEY), the box around
 * them in the same mibiFormat charts use.
 */

export type ElementKind = 'image' | 'shape' | 'button' | 'text' | 'filter';

export const ELEMENT_PREFIX = 'mibi-';
export const ELEMENT_KEY = 'mibiElement';

export const elementKey = (kind: ElementKind) => `${ELEMENT_PREFIX}${kind}`;

export const elementKind = (componentKey: unknown): ElementKind | null => {
  if (typeof componentKey !== 'string') return null;
  const kind = componentKey.slice(ELEMENT_PREFIX.length);
  return componentKey.startsWith(ELEMENT_PREFIX) &&
    ['image', 'shape', 'button', 'text', 'filter'].includes(kind)
    ? (kind as ElementKind)
    : null;
};

/** What clicking an element does in view mode. */
export interface ElementAction {
  type: 'none' | 'page' | 'url' | 'reset-filters' | 'top';
  /** Top level tab to open, for 'page' */
  tabId?: string;
  url?: string;
  newTab?: boolean;
}

export type FillType = 'solid' | 'gradient' | 'none';

/** What an element does under the mouse, in view mode. */
export type HoverEffect = 'none' | 'lift' | 'grow' | 'brighten';

/** Interactive states shared by images, shapes and buttons. */
export interface Interactive {
  hoverEffect?: HoverEffect;
  /** Text shown when hovering */
  tooltip?: string;
}

export interface Fill {
  type: FillType;
  color?: string;
  color2?: string;
  angle?: number;
  /** 0 to 100 */
  opacity?: number;
}

export interface TextStyle {
  size?: number;
  color?: string;
  weight?: 400 | 500 | 600 | 700;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  uppercase?: boolean;
}

export interface ImageElement extends Interactive {
  kind: 'image';
  src?: string;
  /** Id of the uploaded picture, to delete it when replaced */
  imageId?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'none';
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  opacity?: number;
  grayscale?: boolean;
  blur?: number;
  rotation?: number;
  flip?: boolean;
  alt?: string;
  action?: ElementAction;
}

export type ShapeKind =
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'arrow'
  | 'chevron'
  | 'line'
  | 'star';

export interface ShapeElement extends Interactive {
  kind: 'shape';
  /** Fill color under the mouse */
  hoverFill?: string;
  shape: ShapeKind;
  fill?: Fill;
  stroke?: {
    color?: string;
    width?: number;
    dash?: 'solid' | 'dashed' | 'dotted';
  };
  /** Corner radius, for rectangles */
  radius?: number;
  rotation?: number;
  shadow?: 'none' | 'soft' | 'strong';
  text?: string;
  textStyle?: TextStyle;
  action?: ElementAction;
}

export interface ButtonState {
  fill?: string;
  color?: string;
  borderColor?: string;
}

export interface ButtonElement extends Interactive {
  kind: 'button';
  label?: string;
  icon?: string;
  iconPosition?: 'left' | 'right' | 'only';
  action?: ElementAction;
  normal?: ButtonState;
  hover?: ButtonState;
  /** While pressed */
  pressed?: ButtonState;
  borderWidth?: number;
  radius?: number;
  shadow?: 'none' | 'soft' | 'strong';
  textStyle?: TextStyle;
}

export interface TextElement {
  kind: 'text';
  /** Sanitized HTML */
  html?: string;
  textStyle?: TextStyle;
}

/** A dashboard native filter placed on the canvas, like a BI slicer */
export interface FilterElement {
  kind: 'filter';
  /** Id of the native filter to show */
  filterId?: string;
  /** Also list the filter in the filter bar (default true) */
  showInFilterBar?: boolean;
}

export type ElementConfig =
  | ImageElement
  | ShapeElement
  | ButtonElement
  | TextElement
  | FilterElement;

/** Icons a button can show, by their name in Icons. */
export const BUTTON_ICONS = [
  'ArrowRightOutlined',
  'ArrowLeftOutlined',
  'ArrowUpOutlined',
  'ArrowDownOutlined',
  'RightOutlined',
  'LeftOutlined',
  'HomeOutlined',
  'DashboardOutlined',
  'BarChartOutlined',
  'LineChartOutlined',
  'PieChartOutlined',
  'TableOutlined',
  'FilterOutlined',
  'ClearOutlined',
  'ReloadOutlined',
  'SearchOutlined',
  'LinkOutlined',
  'ExportOutlined',
  'DownloadOutlined',
  'InfoCircleOutlined',
  'QuestionCircleOutlined',
  'StarOutlined',
  'HeartOutlined',
  'TrophyOutlined',
  'RocketOutlined',
  'RiseOutlined',
  'AimOutlined',
  'DollarOutlined',
  'ShoppingCartOutlined',
  'TeamOutlined',
  'UserOutlined',
  'GlobalOutlined',
  'CalendarOutlined',
  'MailOutlined',
  'SettingOutlined',
  'BulbOutlined',
] as const;

/** Defaults of a new element: its size in the grid, box and settings. */
export const ELEMENT_DEFAULTS: Record<
  ElementKind,
  {
    width: number;
    height: number;
    format: VisualFormat;
    element: ElementConfig;
  }
> = {
  image: {
    width: 4,
    height: 30,
    format: {
      background: 'transparent',
      borderWidth: 0,
      shadow: 'none',
      padding: 0,
      radius: 12,
    },
    element: { kind: 'image', fit: 'cover', position: 'center', opacity: 100 },
  },
  shape: {
    width: 3,
    height: 20,
    format: {
      background: 'transparent',
      borderWidth: 0,
      shadow: 'none',
      padding: 0,
    },
    element: {
      kind: 'shape',
      shape: 'rectangle',
      fill: { type: 'solid', opacity: 100 },
      stroke: { width: 0, dash: 'solid' },
      radius: 12,
      rotation: 0,
      shadow: 'none',
      textStyle: {
        size: 16,
        weight: 600,
        align: 'center',
        verticalAlign: 'middle',
      },
    },
  },
  button: {
    width: 3,
    height: 7,
    format: {
      background: 'transparent',
      borderWidth: 0,
      shadow: 'none',
      padding: 0,
    },
    element: {
      kind: 'button',
      icon: 'ArrowRightOutlined',
      iconPosition: 'right',
      action: { type: 'none' },
      borderWidth: 0,
      radius: 10,
      shadow: 'soft',
      textStyle: { size: 14, weight: 600, align: 'center' },
    },
  },
  filter: {
    width: 3,
    height: 11,
    format: {
      padding: 12,
      radius: 12,
    },
    element: { kind: 'filter', showInFilterBar: true },
  },
  text: {
    width: 4,
    height: 12,
    format: {
      background: 'transparent',
      borderWidth: 0,
      shadow: 'none',
      padding: 8,
    },
    element: {
      kind: 'text',
      textStyle: {
        size: 16,
        align: 'left',
        verticalAlign: 'top',
        lineHeight: 1.5,
      },
    },
  },
};
