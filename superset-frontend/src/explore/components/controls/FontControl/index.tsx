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
import {
  FONT_FAMILY_OPTIONS,
  type FontStyleValue,
  rgbaToHex,
  toCssColor,
} from '@superset-ui/core';
import {
  Button,
  ColorPicker,
  Flex,
  Select,
  type ColorValue,
} from '@superset-ui/core/components';
import { InputNumber } from '@superset-ui/core/components/Input';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

export interface FontControlProps extends ControlHeaderProps {
  value?: FontStyleValue | null;
  onChange?: (value: FontStyleValue) => void;
  /** Size shown as placeholder when the user has not set one. */
  defaultFontSize?: number;
  /** Whether the element is bold when the user has not chosen. */
  defaultBold?: boolean;
  /** Hide the font family picker (e.g. where only size/color apply). */
  showFontFamily?: boolean;
  /** Hide the bold/italic toggles. */
  showFontWeight?: boolean;
  /** Hide the color picker. */
  showColor?: boolean;
}

const FONT_FAMILY_SELECT_OPTIONS = FONT_FAMILY_OPTIONS.map(
  ([value, label]) => ({ value, label }),
);

/**
 * Compact font editor (family, size, bold, italic, color) storing a single
 * `FontStyleValue` object. Empty properties mean "inherit from the theme or
 * the element default", so a chart keeps its look until the user changes it.
 */
export default function FontControl({
  value,
  onChange,
  defaultFontSize,
  defaultBold = false,
  showFontFamily = true,
  showFontWeight = true,
  showColor = true,
  ...headerProps
}: FontControlProps) {
  const font: FontStyleValue = value && typeof value === 'object' ? value : {};
  const update = (patch: Partial<FontStyleValue>) => {
    const next: FontStyleValue = { ...font, ...patch };
    (Object.keys(next) as (keyof FontStyleValue)[]).forEach(key => {
      if (next[key] === undefined || next[key] === null || next[key] === '') {
        delete next[key];
      }
    });
    onChange?.(next);
  };

  const bold = typeof font.bold === 'boolean' ? font.bold : defaultBold;
  const italic = Boolean(font.italic);
  const colorCss = toCssColor(font.color);
  const label = headerProps.label ?? t('Font');

  return (
    <div data-test="font-control">
      <ControlHeader {...headerProps} />
      <Flex vertical gap="small">
        {showFontFamily && (
          <Select
            ariaLabel={t('%s font family', label)}
            allowClear
            placeholder={t('Theme font')}
            options={FONT_FAMILY_SELECT_OPTIONS}
            value={font.fontFamily || undefined}
            onChange={(fontFamily: string | undefined) =>
              update({ fontFamily: fontFamily ?? null })
            }
            showSearch
          />
        )}
        <Flex gap="small" align="center" wrap="wrap">
          <InputNumber
            aria-label={t('%s font size', label)}
            min={6}
            max={96}
            step={1}
            placeholder={
              defaultFontSize !== undefined
                ? String(defaultFontSize)
                : t('Size')
            }
            value={
              typeof font.fontSize === 'number' ? font.fontSize : undefined
            }
            onChange={size =>
              update({
                fontSize:
                  size === null || size === undefined ? null : Number(size),
              })
            }
            addonAfter="px"
            style={{ width: 110 }}
          />
          {showFontWeight && (
            <>
              <Button
                aria-label={t('Bold')}
                aria-pressed={bold}
                buttonSize="small"
                buttonStyle={bold ? 'primary' : 'tertiary'}
                tooltip={t('Bold')}
                onClick={() => update({ bold: !bold })}
              >
                <strong>B</strong>
              </Button>
              <Button
                aria-label={t('Italic')}
                aria-pressed={italic}
                buttonSize="small"
                buttonStyle={italic ? 'primary' : 'tertiary'}
                tooltip={t('Italic')}
                onClick={() => update({ italic: !italic })}
              >
                <em>I</em>
              </Button>
            </>
          )}
          {showColor && (
            <ColorPicker
              aria-label={t('%s color', label)}
              allowClear
              value={colorCss}
              onChangeComplete={(color: ColorValue) =>
                update({ color: rgbaToHex(color.toRgb()).toLowerCase() })
              }
              onClear={() => update({ color: null })}
              size="small"
            />
          )}
        </Flex>
      </Flex>
    </div>
  );
}
