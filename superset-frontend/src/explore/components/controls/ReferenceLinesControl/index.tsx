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
import { useState, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { toCssColor } from '@superset-ui/core';
import {
  Button,
  Checkbox,
  ColorPicker,
  Flex,
  Input,
  InputNumber,
  Select,
  Typography,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

type Line = Record<string, unknown> & { id: string };

export interface ReferenceLinesControlProps extends ControlHeaderProps {
  value?: Line[] | null;
  onChange?: (value: Line[]) => void;
  seriesNames?: string[];
}

const KINDS = () => [
  { value: 'constant', label: t('Constant value') },
  { value: 'min', label: t('Minimum') },
  { value: 'max', label: t('Maximum') },
  { value: 'average', label: t('Average') },
  { value: 'median', label: t('Median') },
  { value: 'percentile', label: t('Percentile') },
];

const styles = () => [
  { value: 'solid', label: t('Solid') },
  { value: 'dashed', label: t('Dashed') },
  { value: 'dotted', label: t('Dotted') },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <Typography.Text>{label}</Typography.Text>
      <div style={{ width: 150, flex: 'none' }}>{children}</div>
    </Flex>
  );
}

/**
 * The reference lines of a chart: at a value, or calculated from its data, each
 * with its own line, label and shading.
 */
export default function ReferenceLinesControl({
  value,
  onChange,
  seriesNames = [],
  ...headerProps
}: ReferenceLinesControlProps) {
  const lines = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<string>();

  const setLine = (id: string, patch: Record<string, unknown>) =>
    onChange?.(
      lines.map(line => (line.id === id ? { ...line, ...patch } : line)),
    );
  const add = () => {
    const id = `line-${Date.now()}`;
    onChange?.([
      ...lines,
      { id, kind: 'constant', axis: 'value', label: true, style: 'dashed' },
    ]);
    setOpen(id);
  };

  const editor = (line: Line) => {
    const kind = (line.kind as string) ?? 'constant';
    const select = (
      key: string,
      label: string,
      options: { value: string; label: string }[],
      allowClear = false,
    ) => (
      <Row label={label}>
        <Select
          ariaLabel={label}
          allowClear={allowClear}
          options={options}
          value={(line[key] as string) ?? undefined}
          onChange={next => setLine(line.id, { [key]: next ?? null })}
        />
      </Row>
    );
    const number = (key: string, label: string, min: number, max: number) => (
      <Row label={label}>
        <InputNumber
          aria-label={label}
          min={min}
          max={max}
          style={{ width: '100%' }}
          value={(line[key] as number) ?? null}
          onChange={next => setLine(line.id, { [key]: next })}
        />
      </Row>
    );
    const color = (key: string, label: string) => (
      <Row label={label}>
        <ColorPicker
          aria-label={label}
          allowClear
          size="small"
          value={toCssColor(line[key] as string)}
          onChangeComplete={(next: ColorValue) =>
            setLine(line.id, { [key]: next.toHexString().toLowerCase() })
          }
          onClear={() => setLine(line.id, { [key]: null })}
        />
      </Row>
    );
    const text = (key: string, label: string) => (
      <Row label={label}>
        <Input
          aria-label={label}
          value={(line[key] as string) ?? ''}
          onChange={event => setLine(line.id, { [key]: event.target.value })}
        />
      </Row>
    );
    const check = (key: string, label: string, fallback = false) => (
      <Checkbox
        checked={(line[key] as boolean | undefined) ?? fallback}
        onChange={event => setLine(line.id, { [key]: event.target.checked })}
      >
        {label}
      </Checkbox>
    );
    return (
      <Flex vertical gap="small" data-test="reference-line-editor">
        {select('kind', t('Type'), KINDS())}
        {select('axis', t('Axis'), [
          { value: 'value', label: t('Values') },
          { value: 'category', label: t('Categories') },
        ])}
        {kind === 'constant' && text('value', t('Value'))}
        {kind === 'percentile' && number('percentile', t('Percentile'), 0, 100)}
        {kind !== 'constant' &&
          select(
            'series',
            t('Series'),
            seriesNames.map(name => ({ value: name, label: name })),
            true,
          )}
        {text('name', t('Name'))}
        {color('color', t('Line color'))}
        {number('width', t('Line width'), 0, 20)}
        {select('style', t('Line style'), styles())}
        {text('dash', t('Dash pattern'))}
        {number('transparency', t('Transparency (%)'), 0, 100)}
        {check('behind', t('Behind the marks'))}
        {check('label', t('Show the label'))}
        {line.label === true && (
          <>
            {text('labelText', t('Label text'))}
            {color('labelColor', t('Label color'))}
            {select('labelPosition', t('Label position'), [
              { value: 'start', label: t('Start') },
              { value: 'middle', label: t('Middle') },
              { value: 'end', label: t('End') },
            ])}
            {check('labelAbove', t('Above the line'), true)}
            {select(
              'labelUnits',
              t('Display units'),
              [
                { value: 'none', label: t('None') },
                { value: 'auto', label: t('Auto') },
                { value: 'thousands', label: t('Thousands (K)') },
                { value: 'millions', label: t('Millions (M)') },
                { value: 'billions', label: t('Billions (B)') },
              ],
              true,
            )}
            {number('labelDecimals', t('Decimal places'), 0, 9)}
          </>
        )}
        {select('shade', t('Shading'), [
          { value: 'none', label: t('None') },
          { value: 'before', label: t('Before the line') },
          { value: 'after', label: t('After the line') },
        ])}
        {!!line.shade && line.shade !== 'none' && (
          <>
            {color('shadeColor', t('Shading color'))}
            {number('shadeTransparency', t('Shading transparency (%)'), 0, 100)}
          </>
        )}
      </Flex>
    );
  };

  return (
    <div data-test="reference-lines-control">
      <ControlHeader {...headerProps} />
      <Flex vertical gap="small">
        {lines.map((line, index) => {
          const name = (line.name as string) || t('Line %s', index + 1);
          return (
            <Flex key={line.id} vertical gap="small">
              <Flex align="center" justify="space-between" gap="small">
                <Checkbox
                  checked={line.show !== false}
                  aria-label={t('Show %s', name)}
                  onChange={event =>
                    setLine(line.id, { show: event.target.checked })
                  }
                />
                <Button
                  buttonStyle="link"
                  buttonSize="small"
                  onClick={() =>
                    setOpen(open === line.id ? undefined : line.id)
                  }
                >
                  {name}
                </Button>
                <Button
                  buttonStyle="link"
                  buttonSize="small"
                  aria-label={t('Remove %s', name)}
                  onClick={() =>
                    onChange?.(lines.filter(item => item.id !== line.id))
                  }
                >
                  {t('Remove')}
                </Button>
              </Flex>
              {open === line.id && editor(line)}
            </Flex>
          );
        })}
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          data-test="reference-line-add"
          onClick={add}
        >
          {t('Add a line')}
        </Button>
      </Flex>
    </div>
  );
}
