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
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { Filter, NativeFilterType } from '@superset-ui/core';
import { useFilters } from 'src/dashboard/components/nativeFilters/FilterBar/state';
import type { VisualFormat } from 'src/mibi/format/types';
import CanvasFilterControl from './CanvasFilterControl';
import { ElementTitle } from './ElementTitle';
import { DateSlicerView, RangeSlicerView } from './RangeSlicerView';
import { SlicerIcons } from './SlicerIcons';
import { SlicerView } from './SlicerView';
import type { FilterElement } from './types';

const Placeholder = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: ${theme.sizeUnit * 2}px;
    text-align: center;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Body = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: visible;

  .mibi-slicer-body {
    flex: 1;
    min-height: 0;
  }
  /* The corner icons keep clear of the header */
  &.has-icons [data-test='mibi-slicer-header'],
  &.has-icons [data-test='mibi-element-title'],
  &.has-icons .ant-form-item-label {
    padding-right: 52px;
  }
  /* The open list of the dropdown is drawn inside the element */
  &.has-menu .ant-select-dropdown.ant-select-dropdown {
    background: var(--mb-f-menu-fill);
    border: var(--mb-f-menu-border, 0);
    border-radius: var(--mb-f-menu-radius) !important;
    box-shadow: var(--mb-f-menu-shadow) !important;
  }
  &.has-menu .ant-select-dropdown .rc-virtual-list-holder {
    max-height: var(--mb-f-menu-height) !important;
  }
  &.has-menu .ant-select-dropdown .ant-select-item {
    color: var(--mb-f-menu-color);
  }
  &.has-menu .ant-select-dropdown .ant-select-item-option-selected {
    background: var(--mb-f-menu-selected);
  }

  &.hide-label .ant-form-item-label,
  &.hide-label label[for] {
    display: none;
  }
  &.has-label-style label {
    font-size: var(--mb-f-label-size, inherit) !important;
    color: var(--mb-f-label-color, inherit) !important;
    font-weight: var(--mb-f-label-weight, inherit) !important;
    font-style: var(--mb-f-label-style, inherit) !important;
    text-decoration: var(--mb-f-label-decoration, none) !important;
    font-family: var(--mb-f-label-family, inherit) !important;
    display: block;
    text-align: var(--mb-f-label-align, left);
  }
  &.has-box .ant-select-selector,
  &.has-box .ant-picker,
  &.has-box .ant-input-affix-wrapper {
    background: var(--mb-f-box-fill, inherit) !important;
    border-color: var(--mb-f-box-border, inherit) !important;
    border-radius: var(--mb-f-box-radius, inherit) !important;
    color: var(--mb-f-text-color, inherit) !important;
  }
  &.has-box .ant-select-selection-item,
  &.has-box .ant-select-selection-placeholder {
    color: var(--mb-f-text-color, inherit) !important;
  }
`;

const JUSTIFY = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

/**
 * A dashboard native filter drawn on the canvas, like a BI slicer. It
 * applies selections right away and shares its value with the filter bar.
 */
export function FilterView({
  config,
  editMode,
  format,
}: {
  config: FilterElement;
  editMode: boolean;
  /** The element's own format, with its title from the General level */
  format?: VisualFormat;
}) {
  const theme = useTheme();
  const filters = useFilters();
  const candidate = config.filterId ? filters[config.filterId] : undefined;
  const filter =
    candidate?.type === NativeFilterType.NativeFilter
      ? (candidate as Filter)
      : undefined;

  if (filter) {
    const style: Record<string, string | number> = {};
    if (config.labelSize) style['--mb-f-label-size'] = `${config.labelSize}px`;
    if (config.labelColor) style['--mb-f-label-color'] = config.labelColor;
    if (config.labelBold !== undefined)
      style['--mb-f-label-weight'] = config.labelBold ? 700 : 400;
    if (config.boxFill) style['--mb-f-box-fill'] = config.boxFill;
    if (config.boxBorder) style['--mb-f-box-border'] = config.boxBorder;
    if (config.boxRadius !== undefined)
      style['--mb-f-box-radius'] = `${config.boxRadius}px`;
    if (config.textColor) style['--mb-f-text-color'] = config.textColor;
    if (config.labelItalic) style['--mb-f-label-style'] = 'italic';
    if (config.labelUnderline) style['--mb-f-label-decoration'] = 'underline';
    if (config.labelFamily) style['--mb-f-label-family'] = config.labelFamily;
    if (config.labelAlign) {
      style['--mb-f-label-align'] = config.labelAlign;
      style['--mb-f-label-justify'] = JUSTIFY[config.labelAlign];
    }
    const hasIcons =
      config.showClear !== false ||
      !!format?.link?.show ||
      (!!format?.header?.tooltipIcon && !!format?.header?.tooltip?.text);
    const hasMenu =
      !!config.menuFill ||
      !!config.menuColor ||
      !!config.menuSelected ||
      !!config.menuBorder ||
      config.menuShadow === false ||
      config.menuRadius !== undefined ||
      !!config.menuMaxHeight;
    if (hasMenu) {
      style['--mb-f-menu-fill'] = config.menuFill || theme.colorBgElevated;
      style['--mb-f-menu-color'] = config.menuColor || theme.colorText;
      style['--mb-f-menu-selected'] =
        config.menuSelected || theme.controlItemBgActive;
      style['--mb-f-menu-radius'] = `${
        config.menuRadius ?? theme.borderRadiusLG
      }px`;
      style['--mb-f-menu-height'] = `${config.menuMaxHeight ?? 256}px`;
      if (config.menuBorder)
        style['--mb-f-menu-border'] = `1px solid ${config.menuBorder}`;
      style['--mb-f-menu-shadow'] =
        config.menuShadow === false ? 'none' : theme.boxShadowSecondary;
    }
    if (config.labelFill) style['--mb-f-label-fill'] = config.labelFill;
    if (config.labelDivider)
      style['--mb-f-label-divider'] = '1px solid currentColor';
    // Only a list of values can be drawn as other than its filter
    const variant = config.variant ?? 'dropdown';
    const drawn =
      variant !== 'dropdown' && filter.filterType === 'filter_select';
    const range = !!config.rangeStyle && filter.filterType === 'filter_range';
    const date = !!config.dateStyle && filter.filterType === 'filter_time';
    let control = <CanvasFilterControl filter={filter} />;
    if (drawn) control = <SlicerView filter={filter} config={config} />;
    else if (range)
      control = <RangeSlicerView filter={filter} config={config} />;
    else if (date) control = <DateSlicerView filter={filter} config={config} />;
    const hasBox =
      !!config.boxFill ||
      !!config.boxBorder ||
      config.boxRadius !== undefined ||
      !!config.textColor;
    const hasLabelStyle =
      !!config.labelSize ||
      !!config.labelColor ||
      config.labelBold !== undefined ||
      !!config.labelItalic ||
      !!config.labelUnderline ||
      !!config.labelFamily ||
      !!config.labelAlign;
    return (
      <Body
        data-test="mibi-filter-control"
        className={[
          config.hideLabel && 'hide-label',
          hasLabelStyle && 'has-label-style',
          hasBox && 'has-box',
          hasMenu && 'has-menu',
          hasIcons && 'has-icons',
        ]
          .filter(Boolean)
          .join(' ')}
        style={style as CSSProperties}
      >
        <SlicerIcons filterId={filter.id} config={config} format={format} />
        <ElementTitle format={format} fallback={filter.name} />
        <div className="mibi-slicer-body">{control}</div>
      </Body>
    );
  }
  let message = t('No filter selected');
  if (config.filterId) {
    message = t('The selected filter no longer exists');
  } else if (editMode) {
    message = t('Choose a dashboard filter in the Format pane');
  }
  return <Placeholder>{message}</Placeholder>;
}
