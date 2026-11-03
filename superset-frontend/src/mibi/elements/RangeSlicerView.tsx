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
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { NO_TIME_RANGE, type Filter } from '@superset-ui/core';
import { InputNumber, Slider } from '@superset-ui/core/components';
import type { RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { getRangeExtraFormData } from 'src/filters/utils';
import {
  betweenTimeRange,
  formatNumber,
  parseBetweenTimeRange,
  parseRelativeTimeRange,
  relativeTimeRange,
  type RelativeDate,
  type RelativeScope,
  type RelativeUnit,
} from './slicer';
import { SlicerHeader, slicerStyle, useFilterRows } from './SlicerView';
import type { FilterElement } from './types';

const Box = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: var(--mb-s-gap, ${theme.sizeUnit * 2}px);
    width: 100%;
    height: 100%;
    min-height: 0;
    font-family: var(--mb-s-family, inherit);
    font-size: var(--mb-s-size, inherit);
    color: var(--mb-s-color, ${theme.colorText});

    .slicer-fields {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }
    .slicer-fields > * {
      flex: 1;
      min-width: 0;
    }
    .slicer-fields input,
    .slicer-fields select {
      width: 100%;
      box-sizing: border-box;
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border: 1px solid
        var(--mb-s-search-border, var(--mb-f-box-border, ${theme.colorBorder}));
      border-radius: var(
        --mb-s-search-radius,
        var(--mb-f-box-radius, ${theme.borderRadius}px)
      );
      background: var(
        --mb-s-search-fill,
        var(--mb-f-box-fill, ${theme.colorBgContainer})
      );
      color: var(
        --mb-s-search-color,
        var(--mb-f-text-color, ${theme.colorText})
      );
      font: inherit;
    }
    .slicer-fields .ant-input-number {
      width: 100%;
      background: var(
        --mb-s-search-fill,
        var(--mb-f-box-fill, ${theme.colorBgContainer})
      );
      border-color: var(
        --mb-s-search-border,
        var(--mb-f-box-border, ${theme.colorBorder})
      );
      border-radius: var(
        --mb-s-search-radius,
        var(--mb-f-box-radius, ${theme.borderRadius}px)
      );
    }
    .slicer-fields .ant-input-number input {
      border: 0;
      background: transparent;
    }
    .slicer-dash {
      flex: none;
      color: ${theme.colorTextTertiary};
    }
    .ant-slider {
      margin: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    }
    .ant-slider-track {
      background: var(--mb-s-selected, ${theme.colorPrimary});
    }
    .ant-slider-handle::after {
      box-shadow: 0 0 0 2px var(--mb-s-selected, ${theme.colorPrimary});
    }
    .slicer-hint {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
    .slicer-clear {
      align-self: flex-start;
      padding: 0;
      border: 0;
      background: none;
      cursor: pointer;
    }
  `}
`;

type Range = [number | null, number | null];

/**
 * A range filter drawn as Power BI's "Between" slicer: two boxes for the
 * lowest and highest value, and a slider over the values of the column.
 */
export function RangeSlicerView({
  filter,
  config,
}: {
  filter: Filter;
  config: FilterElement;
}) {
  const dispatch = useDispatch();
  const { column, rows } = useFilterRows(filter);
  const applied = useSelector<RootState, Range | undefined>(
    state => state.dataMask[filter.id]?.filterState?.value as Range | undefined,
  );
  const bounds = rows?.[0] as { min?: number; max?: number } | undefined;
  const min = typeof bounds?.min === 'number' ? bounds.min : undefined;
  const max = typeof bounds?.max === 'number' ? bounds.max : undefined;
  const [value, setValue] = useState<Range>(applied ?? [null, null]);

  useEffect(() => {
    setValue(applied ?? [null, null]);
    // Follows selections made elsewhere, like the filter bar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(applied)]);

  const apply = (next: Range) => {
    if (!column) return;
    const [lower, upper] = next;
    const unset = lower === null && upper === null;
    // Enter and leaving a box both apply; only a change filters again
    const [was = null, wasUpper = null] = applied ?? [];
    if (lower === was && upper === wasUpper) return;
    const label = (side: number | null) =>
      side === null
        ? ''
        : formatNumber(side, config.valueUnits, config.valueDecimals);
    dispatch(
      updateDataMask(filter.id, {
        extraFormData: getRangeExtraFormData(column, lower, upper),
        filterState: {
          value: unset ? null : next,
          label: unset ? '' : `${label(lower)} ≤ x ≤ ${label(upper)}`,
        },
      }),
    );
  };

  const ready = min !== undefined && max !== undefined;
  const lower = value[0] ?? min;
  const upper = value[1] ?? max;

  return (
    <Box style={slicerStyle(config)} data-test="mibi-range-slicer">
      {!config.hideLabel && <SlicerHeader name={filter.name} />}
      {rows === undefined && (
        <span className="slicer-hint">{t('Loading...')}</span>
      )}
      <div className="slicer-fields">
        <InputNumber
          aria-label={t('Lowest value')}
          data-test="mibi-range-slicer-min"
          value={value[0]}
          placeholder={min === undefined ? undefined : String(min)}
          onChange={next => setValue([next ?? null, value[1]])}
          onBlur={() => apply(value)}
          onPressEnter={() => apply(value)}
        />
        <span className="slicer-dash">–</span>
        <InputNumber
          aria-label={t('Highest value')}
          data-test="mibi-range-slicer-max"
          value={value[1]}
          placeholder={max === undefined ? undefined : String(max)}
          onChange={next => setValue([value[0], next ?? null])}
          onBlur={() => apply(value)}
          onPressEnter={() => apply(value)}
        />
      </div>
      {config.rangeStyle === 'slider' && ready && min !== max && (
        <Slider
          range
          min={min}
          max={max}
          step={(max - min) / 100 >= 1 ? 1 : (max - min) / 100}
          value={[lower as number, upper as number]}
          onChange={(next: number[]) => setValue([next[0], next[1]])}
          onChangeComplete={(next: number[]) =>
            apply([
              next[0] === min ? null : next[0],
              next[1] === max ? null : next[1],
            ])
          }
        />
      )}
    </Box>
  );
}

const UNITS = (): { value: RelativeUnit; label: string }[] => [
  { value: 'day', label: t('Days') },
  { value: 'week', label: t('Weeks') },
  { value: 'month', label: t('Months') },
  { value: 'quarter', label: t('Quarters') },
  { value: 'year', label: t('Years') },
];

const SCOPES = (): { value: RelativeScope; label: string }[] => [
  { value: 'last', label: t('In the last') },
  { value: 'this', label: t('In this') },
  { value: 'next', label: t('In the next') },
];

/**
 * A time filter drawn as Power BI's date slicers: a relative date such as
 * "last 3 months", or the days between two dates.
 */
export function DateSlicerView({
  filter,
  config,
}: {
  filter: Filter;
  config: FilterElement;
}) {
  const dispatch = useDispatch();
  const applied = useSelector<RootState, string | undefined>(
    state => state.dataMask[filter.id]?.filterState?.value as string,
  );
  const relative = parseRelativeTimeRange(applied);
  const between = parseBetweenTimeRange(applied) ?? [undefined, undefined];
  const [draft, setDraft] = useState<RelativeDate>(
    relative ?? { scope: 'last', count: 1, unit: 'month' },
  );

  useEffect(() => {
    if (relative) setDraft(relative);
    // Follows selections made elsewhere, like the filter bar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  const apply = (range: string | undefined) => {
    const isSet = !!range && range !== NO_TIME_RANGE;
    if ((isSet ? range : undefined) === (applied || undefined)) return;
    dispatch(
      updateDataMask(filter.id, {
        extraFormData: isSet ? { time_range: range } : {},
        filterState: { value: isSet ? range : undefined },
      }),
    );
  };
  const applyRelative = (next: RelativeDate) => {
    setDraft(next);
    apply(relativeTimeRange(next));
  };
  const applyBetween = (start?: string, end?: string) =>
    apply(start || end ? betweenTimeRange(start, end) : undefined);

  return (
    <Box style={slicerStyle(config)} data-test="mibi-date-slicer">
      {!config.hideLabel && <SlicerHeader name={filter.name} />}
      {config.dateStyle === 'between' ? (
        <div className="slicer-fields">
          <input
            type="date"
            aria-label={t('From')}
            data-test="mibi-date-slicer-start"
            value={between[0] ?? ''}
            max={between[1]}
            onChange={event =>
              applyBetween(event.target.value || undefined, between[1])
            }
          />
          <span className="slicer-dash">–</span>
          <input
            type="date"
            aria-label={t('To')}
            data-test="mibi-date-slicer-end"
            value={between[1] ?? ''}
            min={between[0]}
            onChange={event =>
              applyBetween(between[0], event.target.value || undefined)
            }
          />
        </div>
      ) : (
        <div className="slicer-fields">
          <select
            aria-label={t('Period')}
            data-test="mibi-date-slicer-scope"
            value={draft.scope}
            onChange={event =>
              applyRelative({
                ...draft,
                scope: event.target.value as RelativeScope,
              })
            }
          >
            {SCOPES().map(scope => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
          {draft.scope !== 'this' && (
            <input
              type="number"
              min={1}
              aria-label={t('How many')}
              data-test="mibi-date-slicer-count"
              value={draft.count}
              onChange={event =>
                setDraft({ ...draft, count: Number(event.target.value) || 1 })
              }
              onBlur={() => applyRelative(draft)}
              onKeyDown={event => {
                if (event.key === 'Enter') applyRelative(draft);
              }}
            />
          )}
          <select
            aria-label={t('Unit')}
            data-test="mibi-date-slicer-unit"
            value={draft.unit}
            onChange={event =>
              applyRelative({
                ...draft,
                unit: event.target.value as RelativeUnit,
              })
            }
          >
            {UNITS().map(unit => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {applied && (
        <button
          type="button"
          className="slicer-hint slicer-clear"
          data-test="mibi-date-slicer-clear"
          onClick={() => apply(undefined)}
        >
          {t('Clear')}
        </button>
      )}
    </Box>
  );
}
