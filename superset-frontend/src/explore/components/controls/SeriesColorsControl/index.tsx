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
  Button,
  ColorPicker,
  Flex,
  Input,
  Typography,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

export type SeriesColors = Record<string, string>;

export interface SeriesColorsControlProps extends ControlHeaderProps {
  value?: SeriesColors | null;
  onChange?: (value: SeriesColors) => void;
  /** Series names from the chart's last query results. */
  seriesNames?: string[];
}

/**
 * Lists the chart's series with a color picker each. Series without a
 * color keep the chart's color scheme. A series can also be added by name,
 * e.g. before the chart has been run.
 */
export default function SeriesColorsControl({
  value,
  onChange,
  seriesNames = [],
  ...headerProps
}: SeriesColorsControlProps) {
  const colors: SeriesColors =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const [newName, setNewName] = useState('');
  // Names typed by the user that have no color yet; they only live in the
  // UI until a color is picked.
  const [extraNames, setExtraNames] = useState<string[]>([]);
  const allNames = Array.from(
    new Set([...seriesNames, ...Object.keys(colors), ...extraNames]),
  );

  const setColor = (name: string, color: string | null) => {
    const next = { ...colors };
    if (color) {
      next[name] = color;
    } else {
      delete next[name];
    }
    onChange?.(next);
  };

  const addSeries = () => {
    const name = newName.trim();
    if (!name) return;
    setNewName('');
    setExtraNames(prev => (prev.includes(name) ? prev : [...prev, name]));
  };

  return (
    <div data-test="series-colors-control">
      <ControlHeader {...headerProps} />
      <Flex vertical gap="small">
        {allNames.length === 0 && (
          <Typography.Text type="secondary">
            {t('Run the chart to list its series, or add one by name')}
          </Typography.Text>
        )}
        {allNames.map(name => (
          <Flex key={name} align="center" justify="space-between" gap="small">
            <Typography.Text ellipsis={{ tooltip: name }}>
              {name}
            </Typography.Text>
            <ColorPicker
              aria-label={t('Color for %s', name)}
              allowClear
              size="small"
              value={toCssColor(colors[name])}
              onChangeComplete={(color: ColorValue) =>
                setColor(name, color.toHexString().toLowerCase())
              }
              onClear={() => setColor(name, null)}
            />
          </Flex>
        ))}
        <Flex gap="small">
          <Input
            aria-label={t('Series name')}
            placeholder={t('Series name')}
            value={newName}
            onChange={event => setNewName(event.target.value)}
            onPressEnter={addSeries}
          />
          <Button
            buttonSize="small"
            buttonStyle="secondary"
            onClick={addSeries}
          >
            {t('Add')}
          </Button>
        </Flex>
      </Flex>
    </div>
  );
}
