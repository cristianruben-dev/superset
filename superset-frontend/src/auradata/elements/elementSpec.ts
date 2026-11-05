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
import {
  action,
  align,
  bool,
  color,
  fontSize,
  num,
  percent,
  px,
  text,
  type Described,
  type FieldSpec,
} from '../format/generalFormat';
import {
  BUTTON_ICONS,
  ELEMENT_DEFAULTS,
  type AccentBar,
  type ButtonElement,
  type ButtonState,
  type ElementKind,
  type Fill,
  type FilterElement,
  type ImageElement,
  type NavigatorElement,
  type ShapeElement,
  type TextElement,
  type TextStyle,
} from './types';

/**
 * What the settings of each design element hold (`meta.auradataElement`), for
 * tools that build a report without the editor. The MCP service reads them
 * from the format catalog, with the defaults of a new element.
 */

const kindOf = (kind: ElementKind) =>
  ({ type: 'enum', values: [kind] }) as const;
const enumOf = (...values: string[]) => ({ type: 'enum', values }) as const;
const opacity = percent;
const corners = { type: 'array', items: px, length: 4 } as const;
const sides = corners;
const fontFamily = text;
const weight = { type: 'enum', values: [400, 500, 600, 700] } as const;
const hoverEffect = enumOf('none', 'lift', 'grow', 'brighten');
const shadow = enumOf('none', 'soft', 'strong');

const textStyle: Described<TextStyle> = {
  size: fontSize,
  color,
  weight,
  italic: bool,
  align,
  verticalAlign: enumOf('top', 'middle', 'bottom'),
  lineHeight: { type: 'number', min: 0 },
  letterSpacing: num,
  uppercase: bool,
};

const fill: Described<Fill> = {
  type: enumOf('solid', 'gradient', 'none'),
  color,
  color2: color,
  angle: num,
  opacity,
};

const buttonState: Described<ButtonState> = {
  fill: color,
  color,
  borderColor: color,
};

const accent: Described<AccentBar> = {
  position: enumOf('left', 'right', 'top', 'bottom'),
  width: px,
  color,
  opacity,
  on: enumOf('all', 'selected'),
};

const actionSpec = { type: 'object', fields: action } as const;
const textStyleSpec = { type: 'object', fields: textStyle } as const;
const stateSpec = { type: 'object', fields: buttonState } as const;

const image: Described<ImageElement> = {
  kind: kindOf('image'),
  src: { type: 'string', format: 'image' },
  imageId: { type: 'number', integer: true },
  fit: enumOf('cover', 'contain', 'fill', 'none'),
  position: enumOf('center', 'top', 'bottom', 'left', 'right'),
  opacity,
  grayscale: bool,
  blur: px,
  rotation: num,
  flip: bool,
  alt: text,
  action: actionSpec,
  hoverEffect,
  tooltip: text,
};

const shape: Described<ShapeElement> = {
  kind: kindOf('shape'),
  shape: enumOf(
    'rectangle',
    'ellipse',
    'triangle',
    'diamond',
    'hexagon',
    'arrow',
    'chevron',
    'line',
    'star',
  ),
  fill: { type: 'object', fields: fill },
  stroke: {
    type: 'object',
    fields: { color, width: px, dash: enumOf('solid', 'dashed', 'dotted') },
  },
  radius: px,
  rotation: num,
  shadow,
  text,
  textStyle: textStyleSpec,
  action: actionSpec,
  hoverFill: color,
  hoverEffect,
  tooltip: text,
};

const button: Described<ButtonElement> = {
  kind: kindOf('button'),
  label: text,
  icon: enumOf(...BUTTON_ICONS),
  iconPosition: enumOf('left', 'right', 'only'),
  action: actionSpec,
  normal: stateSpec,
  hover: stateSpec,
  pressed: stateSpec,
  borderWidth: px,
  radius: px,
  shadow,
  textStyle: textStyleSpec,
  hoverEffect,
  tooltip: text,
};

const textElement: Described<TextElement> = {
  kind: kindOf('text'),
  html: text,
  textStyle: textStyleSpec,
};

const navigator: Described<NavigatorElement> = {
  kind: kindOf('navigator'),
  direction: enumOf('row', 'column'),
  gap: px,
  radius: px,
  normal: stateSpec,
  active: stateSpec,
  textStyle: textStyleSpec,
};

const filter: Described<FilterElement> = {
  kind: kindOf('filter'),
  filterId: text,
  showInFilterBar: bool,
  hideLabel: bool,
  labelSize: fontSize,
  labelColor: color,
  labelBold: bool,
  boxFill: color,
  boxBorder: color,
  boxRadius: px,
  textColor: color,
  variant: enumOf('dropdown', 'list', 'buttons', 'input'),
  labelItalic: bool,
  labelUnderline: bool,
  labelFamily: fontFamily,
  labelAlign: align,
  labelFill: color,
  labelDivider: bool,
  layout: enumOf('vertical', 'horizontal', 'grid'),
  columns: { type: 'number', min: 1, integer: true },
  showSearch: bool,
  searchPlaceholder: text,
  showSelectAll: bool,
  showIcon: bool,
  iconColor: color,
  itemFamily: fontFamily,
  itemSize: fontSize,
  itemColor: color,
  itemFill: color,
  itemBold: bool,
  itemItalic: bool,
  itemUnderline: bool,
  itemWrap: bool,
  itemBorder: color,
  itemBorderWidth: px,
  itemRadius: px,
  itemPadding: px,
  itemGap: px,
  hoverFill: color,
  hoverColor: color,
  selectedFill: color,
  selectedColor: color,
  selectedBorder: color,
  selectedBold: bool,
  selectedItalic: bool,
  selectedUnderline: bool,
  selectedBorderWidth: px,
  selectedRadius: px,
  selectedPadding: px,
  itemVAlign: enumOf('top', 'middle', 'bottom'),
  iconGap: px,
  searchPadding: px,
  menuBorder: color,
  menuShadow: bool,
  selection: enumOf('multi', 'single', 'ctrl'),
  applyButton: bool,
  applyFill: color,
  applyColor: color,
  showPills: bool,
  pillFill: color,
  pillColor: color,
  pillRadius: px,
  showSummary: bool,
  sortValues: enumOf('asc', 'desc'),
  blankText: text,
  valueUnits: enumOf(
    'none',
    'auto',
    'thousands',
    'millions',
    'billions',
    'trillions',
  ),
  valueDecimals: { type: 'number', min: 0, max: 10, integer: true },
  itemAlign: align,
  iconSize: px,
  iconPosition: enumOf('left', 'right'),
  searchFamily: fontFamily,
  searchSize: fontSize,
  searchColor: color,
  searchFill: color,
  searchBorder: color,
  searchRadius: px,
  menuFill: color,
  menuColor: color,
  menuSelected: color,
  menuRadius: px,
  menuMaxHeight: px,
  inputMatch: enumOf('contains', 'exact'),
  rangeStyle: enumOf('between', 'slider'),
  dateStyle: enumOf('relative', 'between'),
  hiddenValues: { type: 'array', items: text },
  showClear: bool,
  inputNumeric: bool,
  valueFormat: text,
  iconOverlay: bool,
  itemCorners: corners,
  searchCorners: corners,
  itemFillOpacity: opacity,
  selectedFillOpacity: opacity,
  searchFillOpacity: opacity,
  menuFillOpacity: opacity,
  pillFillOpacity: opacity,
  itemColorOpacity: opacity,
  itemBorderOpacity: opacity,
  searchColorOpacity: opacity,
  searchBorderOpacity: opacity,
  pillColorOpacity: opacity,
  pillBorderOpacity: opacity,
  iconOpacity: opacity,
  itemPaddingSides: sides,
  searchPaddingSides: sides,
  pillPaddingSides: sides,
  itemAccent: { type: 'object', fields: accent },
  searchAccent: { type: 'object', fields: accent },
  pillBorder: color,
  pillBorderWidth: px,
  pillCorners: corners,
  pillPadding: px,
  pillDismissColor: color,
  pillDismissOpacity: opacity,
  pillDismissSize: px,
  pillDismissGap: px,
  pillDismissPosition: enumOf('left', 'right', 'none'),
};

/** The settings of each kind of element, described. */
export const ELEMENT_SETTINGS: Record<
  ElementKind,
  Record<string, FieldSpec>
> = {
  image,
  shape,
  button,
  text: textElement,
  filter,
  navigator,
};

/** The settings and defaults of the design elements, for the catalog. */
export const elementCatalog = () =>
  Object.fromEntries(
    (Object.keys(ELEMENT_SETTINGS) as ElementKind[])
      .sort()
      .map(kind => [
        kind,
        { settings: ELEMENT_SETTINGS[kind], defaults: ELEMENT_DEFAULTS[kind] },
      ]),
  );
