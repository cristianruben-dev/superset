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
import { toCssColor, type ColorInput } from '@superset-ui/core';
import type { TabularFormat } from '../sections/tableFormat';

/** An actual ordered numeric series, preserving gaps for missing observations. */
export function TabularSparkline({
  values,
  format,
}: {
  values: unknown[];
  format: TabularFormat;
}) {
  const points = values.map((value, index) =>
    typeof value === 'number' && Number.isFinite(value)
      ? { value, index }
      : null,
  );
  const numbers = points.flatMap(point => (point ? [point.value] : []));
  if (!numbers.length) return null;
  const minimum = numbers.reduce(
    (result, value) => Math.min(result, value),
    Infinity,
  );
  const maximum = numbers.reduce(
    (result, value) => Math.max(result, value),
    -Infinity,
  );
  const min = Math.min(0, minimum);
  const max = Math.max(0, maximum);
  const x = (index: number) =>
    4 + (index * 112) / Math.max(1, values.length - 1);
  const y = (value: number) => 32 - ((value - min) * 28) / (max - min || 1);
  const color =
    toCssColor(format.table_sparkline_color as ColorInput) ?? 'currentColor';
  const markerColor =
    toCssColor(format.table_sparkline_marker_color as ColorInput) ?? color;
  const marker = String(format.table_sparkline_markers ?? 'none');
  const bounded = (value: unknown, fallback: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.min(max, value))
      : fallback;
  const size = bounded(format.table_sparkline_marker_size, 2, 6);
  const stroke = bounded(format.table_sparkline_width, 1, 8);
  const label = t('Trend: %s', numbers.join(', '));
  const path = points
    .map((point, index) =>
      point
        ? `${index === 0 || !points[index - 1] ? 'M' : 'L'}${x(point.index)},${y(point.value)}`
        : '',
    )
    .join(' ');
  return (
    <svg
      width="120"
      height="36"
      viewBox="0 0 120 36"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {format.table_sparkline_type === 'column' ? (
        points.map(
          point =>
            point && (
              <rect
                key={point.index}
                x={x(point.index) - 2}
                y={Math.min(y(0), y(point.value))}
                width={Math.min(8, 100 / values.length)}
                height={Math.max(1, Math.abs(y(point.value) - y(0)))}
                fill={color}
              />
            ),
        )
      ) : (
        <path d={path} stroke={color} strokeWidth={stroke} fill="none" />
      )}
      {points.map(point => {
        if (
          !point ||
          !(
            marker === 'all' ||
            (marker === 'first-last' &&
              (point.index === 0 || point.index === values.length - 1)) ||
            (marker === 'min-max' &&
              (point.value === minimum || point.value === maximum))
          )
        )
          return null;
        return format.table_sparkline_marker_shape === 'square' ? (
          <rect
            key={point.index}
            x={x(point.index) - size}
            y={y(point.value) - size}
            width={size * 2}
            height={size * 2}
            fill={markerColor}
          />
        ) : (
          <circle
            key={point.index}
            cx={x(point.index)}
            cy={y(point.value)}
            r={size}
            fill={markerColor}
          />
        );
      })}
    </svg>
  );
}
