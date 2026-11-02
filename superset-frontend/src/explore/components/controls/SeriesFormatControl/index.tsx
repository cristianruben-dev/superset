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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { toCssColor } from '@superset-ui/core';
import {
  ColorPicker,
  Flex,
  InputNumber,
  Select,
  Typography,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

type FieldGroup = 'labels' | 'bars' | 'lines' | 'markers';
type Override = Record<string, unknown>;
export type SeriesFormat = Record<string, Override>;

export interface SeriesFormatControlProps extends ControlHeaderProps {
  value?: SeriesFormat | null;
  onChange?: (value: SeriesFormat) => void;
  /** Series names from the chart's last query results. */
  seriesNames?: string[];
  fields?: FieldGroup[];
}

const BOOLEAN_CHOICES = () => [
  { value: 'default', label: t('As the chart') },
  { value: 'on', label: t('Show') },
  { value: 'off', label: t('Hide') },
];

const LINE_TYPES = () => [
  { value: 'solid', label: t('Solid') },
  { value: 'dashed', label: t('Dashed') },
  { value: 'dotted', label: t('Dotted') },
];

const LINE_INTERPOLATIONS = () => [
  { value: 'linear', label: t('Straight') },
  { value: 'smooth', label: t('Smooth') },
  { value: 'monotone', label: t('Smooth, without overshooting') },
  { value: 'start', label: t('Steps, before the point') },
  { value: 'middle', label: t('Steps, between the points') },
  { value: 'end', label: t('Steps, after the point') },
];

const MARKER_SHAPES = () => [
  { value: 'circle', label: t('Circle') },
  { value: 'rect', label: t('Square') },
  { value: 'triangle', label: t('Triangle') },
  { value: 'diamond', label: t('Diamond') },
];

function Row({ label, children }: { label: string; children: JSX.Element }) {
  return (
    <Flex align="center" justify="space-between" gap="small">
      <Typography.Text>{label}</Typography.Text>
      <div style={{ width: 150 }}>{children}</div>
    </Flex>
  );
}

/**
 * Picks a series and gives it its own options over those of the chart, as
 * "Apply settings to" does in Power BI. Only what differs is kept.
 */
export default function SeriesFormatControl({
  value,
  onChange,
  seriesNames = [],
  fields = ['labels', 'bars', 'lines', 'markers'],
  ...headerProps
}: SeriesFormatControlProps) {
  const format: SeriesFormat =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const names = Array.from(new Set([...seriesNames, ...Object.keys(format)]));
  const [picked, setPicked] = useState<string>();
  const series = picked && names.includes(picked) ? picked : undefined;
  const own: Override = (series && format[series]) || {};

  const setOption = (option: string, next: unknown) => {
    if (!series) return;
    const options = { ...own };
    if (next === null || next === undefined || next === '') {
      delete options[option];
    } else {
      options[option] = next;
    }
    const nextFormat = { ...format };
    if (Object.keys(options).length) nextFormat[series] = options;
    else delete nextFormat[series];
    onChange?.(nextFormat);
  };

  const booleanSelect = (option: string, label: string) => (
    <Row label={label}>
      <Select
        ariaLabel={label}
        options={BOOLEAN_CHOICES()}
        value={
          typeof own[option] === 'boolean'
            ? own[option]
              ? 'on'
              : 'off'
            : 'default'
        }
        onChange={choice =>
          setOption(option, choice === 'default' ? null : choice === 'on')
        }
      />
    </Row>
  );

  const choiceSelect = (
    option: string,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Row label={label}>
      <Select
        ariaLabel={label}
        allowClear
        placeholder={t('As the chart')}
        options={options}
        value={(own[option] as string) ?? undefined}
        onChange={choice => setOption(option, choice)}
      />
    </Row>
  );

  const numberInput = (
    option: string,
    label: string,
    min: number,
    max: number,
  ) => (
    <Row label={label}>
      <InputNumber
        aria-label={label}
        min={min}
        max={max}
        placeholder={t('As the chart')}
        style={{ width: '100%' }}
        value={(own[option] as number) ?? null}
        onChange={next => setOption(option, next)}
      />
    </Row>
  );

  return (
    <div data-test="series-format-control">
      <ControlHeader {...headerProps} />
      <Flex vertical gap="small">
        {names.length === 0 ? (
          <Typography.Text type="secondary">
            {t('Run the chart to list its series')}
          </Typography.Text>
        ) : (
          <Select
            ariaLabel={t('Series')}
            placeholder={t('Choose a series')}
            options={names.map(name => ({
              value: name,
              label: format[name] ? `${name} •` : name,
            }))}
            value={series}
            onChange={choice => setPicked(choice as string)}
          />
        )}
        {series && fields.includes('labels') && (
          <>
            {booleanSelect('showLabels', t('Data labels'))}
            <Row label={t('Label color')}>
              <ColorPicker
                aria-label={t('Label color')}
                allowClear
                size="small"
                value={toCssColor(own.labelColor as string)}
                onChangeComplete={(color: ColorValue) =>
                  setOption('labelColor', color.toHexString().toLowerCase())
                }
                onClear={() => setOption('labelColor', null)}
              />
            </Row>
          </>
        )}
        {series &&
          fields.includes('bars') &&
          numberInput('barTransparency', t('Bar transparency (%)'), 0, 100)}
        {series && fields.includes('lines') && (
          <>
            {numberInput('lineWidth', t('Line width'), 1, 10)}
            {choiceSelect('lineType', t('Line style'), LINE_TYPES())}
            {choiceSelect(
              'lineInterpolation',
              t('Line type'),
              LINE_INTERPOLATIONS(),
            )}
            {numberInput(
              'lineTransparency',
              t('Line transparency (%)'),
              0,
              100,
            )}
          </>
        )}
        {series && fields.includes('markers') && (
          <>
            {booleanSelect('markerEnabled', t('Markers'))}
            {choiceSelect('markerSymbol', t('Marker shape'), MARKER_SHAPES())}
            {numberInput('markerSize', t('Marker size'), 0, 100)}
          </>
        )}
      </Flex>
    </div>
  );
}
