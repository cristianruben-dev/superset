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
import type { ReactNode } from 'react';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { ColorPicker, Slider } from '@superset-ui/core/components';
import { FieldHelp, type FieldHelpContent } from '../help/FieldHelp';

export const Section = styled.section`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    h4 {
      margin: 0;
      font-size: ${theme.fontSizeSM}px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const FieldRow = styled.label<{ $stacked?: boolean }>`
  ${({ theme, $stacked }) => css`
    display: flex;
    flex-direction: ${$stacked ? 'column' : 'row'};
    align-items: ${$stacked ? 'stretch' : 'center'};
    justify-content: space-between;
    gap: ${theme.sizeUnit * ($stacked ? 1 : 2)}px;
    margin: 0;
    min-height: ${theme.sizeUnit * 6}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};

    > .label {
      flex: none;
      font-weight: 500;
    }

    > .control {
      display: flex;
      align-items: center;
      justify-content: ${$stacked ? 'stretch' : 'flex-end'};
      gap: ${theme.sizeUnit * 2}px;
      min-width: 0;
    }
  `}
`;

export function Field({
  label,
  children,
  stacked,
  help,
}: {
  label: ReactNode;
  children: ReactNode;
  stacked?: boolean;
  help?: FieldHelpContent;
}) {
  return (
    <FieldRow $stacked={stacked} as={stacked ? 'div' : 'label'}>
      <span className="label">
        {label}
        {help && <FieldHelp label={label} help={help} />}
      </span>
      <span className="control">{children}</span>
    </FieldRow>
  );
}

const SliderBox = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex: 1;
    width: 100%;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;

    .ant-slider {
      flex: 1;
      margin: 0 ${theme.sizeUnit}px;
    }

    .value {
      flex: none;
      min-width: 44px;
      text-align: right;
      font-variant-numeric: tabular-nums;
      color: ${theme.colorText};
    }
  `}
`;

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = 'px',
  onChange,
  testId,
  help,
}: {
  label: ReactNode;
  help?: FieldHelpContent;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <Field label={label} stacked help={help}>
      <SliderBox data-test={testId}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(next: number) => onChange(next)}
          tooltip={{ open: false }}
        />
        <span className="value">
          {value}
          {unit}
        </span>
      </SliderBox>
    </Field>
  );
}

/** A color picker with the theme colors as presets. */
export function ColorField({
  label,
  value,
  onChange,
  disabled,
  testId,
  help,
}: {
  label: ReactNode;
  help?: FieldHelpContent;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const theme = useTheme();
  return (
    <Field label={label} help={help}>
      <span data-test={testId}>
        <ColorPicker
          size="small"
          value={value}
          disabled={disabled}
          disabledAlpha
          showText
          onChange={(_, hex) => onChange(hex)}
          presets={[
            {
              label: t('Theme'),
              colors: [
                theme.colorBgContainer,
                theme.colorBgLayout,
                theme.colorText,
                theme.colorTextSecondary,
                theme.colorBorderSecondary,
                theme.colorPrimary,
                theme.colorPrimaryBg,
                theme.colorSuccess,
                theme.colorWarning,
                theme.colorError,
                theme.colorInfo,
              ],
              defaultOpen: true,
            },
          ]}
        />
      </span>
    </Field>
  );
}

const SegmentsBox = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorFillTertiary};
  `}
`;

const SegmentButton = styled.button<{ $selected: boolean }>`
  ${({ theme, $selected }) => css`
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    min-width: 0;
    height: 28px;
    padding: 0 ${theme.sizeUnit * 2}px;
    border: 0;
    border-radius: ${theme.borderRadiusSM}px;
    background: ${$selected ? theme.colorBgContainer : 'transparent'};
    box-shadow: ${$selected ? theme.boxShadowTertiary : 'none'};
    color: ${$selected ? theme.colorText : theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${$selected ? 600 : 500};
    white-space: nowrap;
    cursor: pointer;
  `}
`;

export function Segments<T extends string>({
  value,
  options,
  onChange,
  name,
  testId,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  name: string;
  testId?: string;
}) {
  return (
    <SegmentsBox role="radiogroup" aria-label={name} data-test={testId}>
      {options.map(option => (
        <SegmentButton
          key={option.value}
          type="button"
          role="radio"
          title={option.title}
          aria-label={option.title}
          aria-checked={option.value === value}
          $selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </SegmentButton>
      ))}
    </SegmentsBox>
  );
}
