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
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { rgbaToHex, toCssColor, type ColorInput } from '@superset-ui/core';
import {
  Button,
  ColorPicker,
  Flex,
  Select,
  type ColorValue,
} from '@superset-ui/core/components';
import { InputNumber } from '@superset-ui/core/components/Input';
import { Icons } from '@superset-ui/core/components/Icons';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

export type ChartConditionalOperator =
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'between';

export type ChartConditionalTarget = 'mark' | 'label' | 'both';

/** Mirrors `ChartConditionalRule` in the ECharts plugin. */
export interface ChartConditionalRuleValue {
  operator: ChartConditionalOperator;
  value?: number | null;
  value2?: number | null;
  color?: ColorInput;
  target?: ChartConditionalTarget;
  series?: string | null;
  /** Icon shown next to matching table cells (icon variant). */
  icon?: string;
}

export interface ChartConditionalFormattingControlProps extends ControlHeaderProps {
  value?: ChartConditionalRuleValue[] | null;
  onChange?: (value: ChartConditionalRuleValue[]) => void;
  /** Series names from the chart's last query results. */
  seriesNames?: string[];
  /**
   * `chart` colors bars/points/labels; `icon` adds an icon next to matching
   * table cells and targets columns instead of series.
   */
  variant?: 'chart' | 'icon';
}

export const CONDITIONAL_ICONS = ['▲', '▼', '●', '■', '◆', '★', '✔', '✖', '⚠'];

const OPERATOR_OPTIONS: { value: ChartConditionalOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'between', label: t('between') },
];

const TARGET_OPTIONS: { value: ChartConditionalTarget; label: string }[] = [
  { value: 'mark', label: t('Bar / point') },
  { value: 'label', label: t('Data label') },
  { value: 'both', label: t('Both') },
];

/**
 * Editable list of "if value <operator> X then color" rules for chart marks
 * and data labels, optionally limited to one series.
 */
export default function ChartConditionalFormattingControl({
  value,
  onChange,
  seriesNames = [],
  variant = 'chart',
  ...headerProps
}: ChartConditionalFormattingControlProps) {
  const theme = useTheme();
  const isIconVariant = variant === 'icon';
  const rules = Array.isArray(value) ? value : [];

  const updateRule = (
    index: number,
    patch: Partial<ChartConditionalRuleValue>,
  ) => {
    onChange?.(
      rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  };

  const addRule = () =>
    onChange?.([
      ...rules,
      isIconVariant
        ? {
            operator: '>',
            value: null,
            color: theme.colorSuccess,
            icon: CONDITIONAL_ICONS[0],
            series: null,
          }
        : {
            operator: '>',
            value: null,
            color: theme.colorError,
            target: 'mark',
            series: null,
          },
    ]);

  const removeRule = (index: number) =>
    onChange?.(rules.filter((_, i) => i !== index));

  const seriesOptions = Array.from(
    new Set([
      ...seriesNames,
      ...rules.map(rule => rule.series).filter((s): s is string => !!s),
    ]),
  ).map(name => ({ value: name, label: name }));

  return (
    <div data-test="chart-conditional-formatting-control">
      <ControlHeader {...headerProps} />
      <Flex vertical gap="middle">
        {rules.map((rule, index) => (
          <Flex
            // Rules have no stable id; their order is their identity.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            vertical
            gap="small"
            data-test="chart-conditional-formatting-rule"
            style={{
              borderLeft: `3px solid ${
                toCssColor(rule.color) ?? theme.colorBorder
              }`,
              paddingLeft: theme.sizeUnit * 2,
            }}
          >
            <Select
              ariaLabel={isIconVariant ? t('Column') : t('Series')}
              allowClear
              placeholder={
                isIconVariant ? t('All numeric columns') : t('All series')
              }
              options={seriesOptions}
              value={rule.series ?? undefined}
              onChange={(series: string | undefined) =>
                updateRule(index, { series: series ?? null })
              }
            />
            <Flex gap="small" align="center">
              <div style={{ minWidth: 96 }}>
                <Select
                  ariaLabel={t('Condition')}
                  options={OPERATOR_OPTIONS}
                  value={rule.operator}
                  onChange={(operator: ChartConditionalOperator) =>
                    updateRule(index, { operator })
                  }
                />
              </div>
              <InputNumber
                aria-label={t('Value')}
                placeholder={t('Value')}
                value={rule.value ?? undefined}
                onChange={next =>
                  updateRule(index, {
                    value:
                      next === null || next === undefined ? null : Number(next),
                  })
                }
              />
              {rule.operator === 'between' && (
                <InputNumber
                  aria-label={t('Upper value')}
                  placeholder={t('and')}
                  value={rule.value2 ?? undefined}
                  onChange={next =>
                    updateRule(index, {
                      value2:
                        next === null || next === undefined
                          ? null
                          : Number(next),
                    })
                  }
                />
              )}
            </Flex>
            <Flex gap="small" align="center">
              <ColorPicker
                aria-label={t('Rule color')}
                size="small"
                value={toCssColor(rule.color)}
                onChangeComplete={(color: ColorValue) =>
                  updateRule(index, {
                    color: rgbaToHex(color.toRgb()).toLowerCase(),
                  })
                }
              />
              {isIconVariant ? (
                <Select
                  ariaLabel={t('Icon')}
                  options={CONDITIONAL_ICONS.map(icon => ({
                    value: icon,
                    label: icon,
                  }))}
                  value={rule.icon ?? CONDITIONAL_ICONS[0]}
                  onChange={(icon: string) => updateRule(index, { icon })}
                />
              ) : (
                <Select
                  ariaLabel={t('Apply to')}
                  options={TARGET_OPTIONS}
                  value={rule.target ?? 'mark'}
                  onChange={(target: ChartConditionalTarget) =>
                    updateRule(index, { target })
                  }
                />
              )}
              <Button
                aria-label={t('Remove rule')}
                buttonSize="small"
                buttonStyle="link"
                onClick={() => removeRule(index)}
                icon={<Icons.DeleteOutlined iconSize="m" />}
              />
            </Flex>
          </Flex>
        ))}
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={addRule}
          icon={<Icons.PlusOutlined iconSize="m" />}
        >
          {t('Add rule')}
        </Button>
      </Flex>
    </div>
  );
}
