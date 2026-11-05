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
import { DatasourceType } from '@superset-ui/core';
import type { ControlPanelSectionConfig } from '@superset-ui/chart-controls';
import { getSectionsToRender } from 'src/explore/controlUtils/getSectionsToRender';
import { OWN_CHART_SETTINGS } from './chartFormatSettings';
import {
  buildFormatCards,
  lookSections,
  SUPERSEDED_CONTROLS,
  type FormatCardItem,
} from './formatCards';
import { GENERAL_CHART_SETTINGS, GENERAL_FORMAT } from './generalFormat';

/**
 * The format catalog: per chart type, the controls the Visual and Analytics
 * levels of the Format pane draw, sorted into its sections, plus the settings
 * of the General level. The MCP service reads it from
 * `superset/auradata/catalog/format_catalog.json`, so tools validate a format
 * the same way the pane builds it.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** What value a control takes, as far as a tool can check it. */
export type ValueKind =
  | 'boolean'
  | 'number'
  | 'string'
  | 'enum'
  | 'enum_list'
  | 'color'
  | 'json';

export interface CatalogControl {
  key: string;
  /** The control component of Explore */
  control: string;
  value: ValueKind;
  label?: string;
  description?: string;
  default?: Json;
  /** Allowed values for an enum */
  choices?: Json[];
  /** The control also takes values outside `choices` */
  free_form?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** The switch in the heading of the section */
  toggle?: boolean;
  /** The switch says the opposite of the control ("Hide legend") */
  inverted?: boolean;
  heading?: string;
  /** Says something about one chart: copying a format leaves it out */
  own?: boolean;
  /** Choices, default or visibility depend on the chart */
  dynamic?: ('choices' | 'default' | 'visibility')[];
  /** Declared more than once, each one for a case (bars per orientation) */
  variants?: number;
}

export interface CatalogSection {
  id: string;
  title: string;
  level: 'visual' | 'analytics' | 'fields';
  controls: CatalogControl[];
}

export interface FormatCatalog {
  version: 1;
  own_chart_settings: string[];
  superseded_controls: string[];
  general: Json;
  general_chart_settings: Json;
  charts: Record<string, { sections: CatalogSection[] }>;
}

const isJson = (value: unknown): value is Json => {
  if (value === null) return true;
  if (['boolean', 'number', 'string'].includes(typeof value))
    return typeof value !== 'number' || Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value === 'object' && value.constructor === Object)
    return Object.values(value).every(isJson);
  return false;
};

const controlName = (type: unknown): string => {
  if (typeof type === 'string') return type;
  if (typeof type === 'function' || (type && typeof type === 'object')) {
    const named = type as { displayName?: string; name?: string };
    return named.displayName || named.name || 'CustomControl';
  }
  return 'CustomControl';
};

const choiceValue = (choice: unknown): unknown =>
  Array.isArray(choice) ? choice[0] : choice;

const valueKind = (
  control: string,
  config: Record<string, unknown>,
  choices: Json[] | undefined,
): ValueKind => {
  if (control === 'CheckboxControl') return 'boolean';
  if (['SliderControl', 'NumberControl'].includes(control)) return 'number';
  if (control === 'TextControl')
    return config.isInt || config.isFloat ? 'number' : 'string';
  if (control === 'TextAreaControl') return 'string';
  if (control === 'ColorPickerControl') return 'color';
  if (choices && ['SelectControl', 'RadioButtonControl'].includes(control))
    return config.multi ? 'enum_list' : 'enum';
  return 'json';
};

/** One control as the catalog describes it. */
export function describeControl(item: FormatCardItem): CatalogControl {
  const config = item.config as unknown as Record<string, unknown>;
  const control = controlName(config.type);
  const dynamic: CatalogControl['dynamic'] = [];
  let choices: Json[] | undefined;
  const rawChoices = config.choices ?? config.options;
  if (Array.isArray(rawChoices)) {
    const values = rawChoices.map(choice =>
      choiceValue(
        choice && typeof choice === 'object' && 'value' in choice
          ? (choice as { value: unknown }).value
          : choice,
      ),
    );
    if (isJson(values)) choices = values;
  } else if (typeof rawChoices === 'function' || config.mapStateToProps) {
    // Choices the chart or its data give, unknown ahead
    dynamic.push('choices');
  }
  const described: CatalogControl = {
    key: item.name,
    control,
    value: valueKind(control, config, choices),
  };
  const label = typeof config.label === 'string' ? config.label : undefined;
  if (label) described.label = label;
  if (typeof config.description === 'string' && config.description)
    described.description = config.description;
  if (typeof config.default === 'function') dynamic.push('default');
  else if (config.default !== undefined && isJson(config.default))
    described.default = config.default;
  if (choices) described.choices = choices;
  if (config.freeForm) described.free_form = true;
  (['min', 'max', 'step'] as const).forEach(bound => {
    if (typeof config[bound] === 'number')
      described[bound] = config[bound] as number;
  });
  if (typeof config.visibility === 'function' || item.sectionVisibility)
    dynamic.push('visibility');
  if (dynamic.length) described.dynamic = dynamic;
  if (item.heading) described.heading = item.heading;
  if (OWN_CHART_SETTINGS.includes(item.name)) described.own = true;
  if (item.alternatives?.length)
    described.variants = item.alternatives.length + 1;
  return described;
}

/** The sections of the Format pane a control panel makes, described. */
export function catalogSections(
  sections: ControlPanelSectionConfig[],
): CatalogSection[] {
  return buildFormatCards(lookSections(sections)).map(card => ({
    id: card.id,
    title: card.title,
    level: card.level ?? 'visual',
    controls: [
      ...(card.toggle
        ? [
            {
              ...describeControl(card.toggle.item),
              toggle: true,
              ...(card.toggle.inverted && { inverted: true }),
            },
          ]
        : []),
      ...card.items.map(describeControl),
    ],
  }));
}

/** The catalog of the registered chart types. */
export function buildFormatCatalog(vizTypes: string[]): FormatCatalog {
  const charts: FormatCatalog['charts'] = {};
  [...vizTypes].sort().forEach(vizType => {
    const sections = getSectionsToRender(vizType, DatasourceType.Table).filter(
      Boolean,
    ) as ControlPanelSectionConfig[];
    charts[vizType] = { sections: catalogSections(sections) };
  });
  return {
    version: 1,
    own_chart_settings: [...OWN_CHART_SETTINGS].sort(),
    superseded_controls: [...SUPERSEDED_CONTROLS].sort(),
    general: GENERAL_FORMAT as unknown as Json,
    general_chart_settings: GENERAL_CHART_SETTINGS as unknown as Json,
    charts,
  };
}
