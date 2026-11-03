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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, styled } from '@apache-superset/core/theme';
import type { DataMaskStateWithId, Filter } from '@superset-ui/core';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { useFilterDependencies } from 'src/dashboard/components/nativeFilters/FilterBar/FilterControls/state';
import { getFormData } from 'src/dashboard/components/nativeFilters/utils';
import type { RootState } from 'src/dashboard/types';
import { updateDataMask } from 'src/dataMask/actions';
import { getSelectExtraFormData } from 'src/filters/utils';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import type { FilterElement } from './types';

type SlicerValue = string | number | boolean | null;

const Box = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: var(--mb-s-gap, ${theme.sizeUnit}px);
    width: 100%;
    height: 100%;
    min-height: 0;
    font-family: var(--mb-s-family, inherit);

    .slicer-search,
    .slicer-input {
      width: 100%;
      box-sizing: border-box;
      padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
      border: 1px solid var(--mb-f-box-border, ${theme.colorBorder});
      border-radius: var(--mb-f-box-radius, ${theme.borderRadius}px);
      background: var(--mb-f-box-fill, ${theme.colorBgContainer});
      color: var(--mb-f-text-color, ${theme.colorText});
      font: inherit;
    }

    .slicer-items {
      display: grid;
      grid-template-columns: var(--mb-s-columns, minmax(0, 1fr));
      grid-auto-rows: max-content;
      align-content: start;
      gap: var(--mb-s-gap, ${theme.sizeUnit}px);
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .slicer-items.is-row {
      display: flex;
      flex-wrap: wrap;
    }

    .slicer-item {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 1.5}px;
      min-width: 0;
      padding: var(--mb-s-padding, ${theme.sizeUnit}px ${theme.sizeUnit * 2}px);
      border: var(--mb-s-border-width, 0) solid
        var(--mb-s-border, ${theme.colorBorder});
      border-radius: var(--mb-s-radius, ${theme.borderRadius}px);
      background: var(--mb-s-fill, transparent);
      color: var(--mb-s-color, ${theme.colorText});
      font-size: var(--mb-s-size, inherit);
      font-weight: var(--mb-s-weight, inherit);
      font-style: var(--mb-s-style, inherit);
      text-decoration: var(--mb-s-decoration, none);
      text-align: left;
      cursor: pointer;

      &:hover {
        background: var(--mb-s-hover, ${theme.colorFillTertiary});
        color: var(--mb-s-hover-color, var(--mb-s-color, ${theme.colorText}));
      }
      &:focus-visible {
        outline: 2px solid ${theme.colorPrimary};
        outline-offset: 1px;
      }
      &[aria-pressed='true'] {
        background: var(--mb-s-selected, transparent);
        border-color: var(--mb-s-selected-border, var(--mb-s-border));
        color: var(--mb-s-selected-color, var(--mb-s-color));
        font-weight: var(--mb-s-selected-weight, var(--mb-s-weight, inherit));
      }
    }
    .slicer-items.is-buttons .slicer-item {
      --mb-s-border-width: 1px;
      justify-content: center;
      background: var(--mb-s-fill, ${theme.colorBgContainer});
    }
    .slicer-items.is-buttons .slicer-item[aria-pressed='true'] {
      background: var(--mb-s-selected, ${theme.colorPrimary});
      color: var(--mb-s-selected-color, ${theme.colorTextLightSolid});
      border-color: var(--mb-s-selected-border, ${theme.colorPrimary});
    }

    .slicer-mark {
      flex: none;
      width: 14px;
      height: 14px;
      box-sizing: border-box;
      border: 1px solid var(--mb-s-icon, ${theme.colorBorder});
      border-radius: 3px;
    }
    .slicer-mark.is-single {
      border-radius: 50%;
    }
    [aria-pressed='true'] > .slicer-mark {
      border-color: var(--mb-s-icon, ${theme.colorPrimary});
      background: var(--mb-s-icon, ${theme.colorPrimary});
      box-shadow: inset 0 0 0 2px ${theme.colorBgContainer};
    }
    .slicer-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: var(--mb-s-wrap, nowrap);
    }
    .slicer-hint {
      font-size: ${theme.fontSizeSM}px;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const Header = styled.div`
  font-size: var(--mb-f-label-size, inherit);
  color: var(--mb-f-label-color, inherit);
  font-weight: var(--mb-f-label-weight, 600);
  font-style: var(--mb-f-label-style, normal);
  font-family: var(--mb-f-label-family, inherit);
  text-decoration: var(--mb-f-label-decoration, none);
  text-align: var(--mb-f-label-align, left);
  background: var(--mb-f-label-fill, transparent);
  border-bottom: var(--mb-f-label-divider, 0);
`;

const textOf = (value: SlicerValue) =>
  value === null ? t('(Blank)') : String(value);

/** The values of a filter, as its own dropdown would ask for them. */
function useSlicerValues(filter: Filter) {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const dashboardId = useSelector<RootState, number>(
    state => state.dashboardInfo.id,
  );
  const dependencies = useFilterDependencies(filter.id, dataMask);
  const [values, setValues] = useState<SlicerValue[]>();
  const [target] = filter.targets ?? [];
  const column = (target as { column?: { name?: string } })?.column?.name;
  const datasetId = (target as { datasetId?: number })?.datasetId;
  const asked = JSON.stringify(dependencies);

  useEffect(() => {
    if (!datasetId || !column) return undefined;
    let current = true;
    const formData = getFormData({
      ...filter,
      datasetId,
      dependencies,
      groupby: column,
      adhoc_filters: filter.adhoc_filters,
      time_range: filter.time_range,
      granularity_sqla: filter.granularity_sqla,
      dashboardId,
    } as never);
    getChartDataRequest({ formData })
      .then(async ({ response, json }) => {
        const body = json as { result?: unknown[] };
        const result = body.result ? body.result[0] : body;
        const answer =
          response.status === 202
            ? ((await waitForAsyncData(result as never)) as unknown[])[0]
            : result;
        const rows = (answer as { data: Record<string, SlicerValue>[] }).data;
        if (current) setValues(rows.map(row => row[column]));
      })
      .catch(error => {
        logging.error(error);
        if (current) setValues([]);
      });
    return () => {
      current = false;
    };
    // Asks again only when the parents of the filter change their selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, column, dashboardId, datasetId, filter.id]);

  return { column, values };
}

/** The variables of the look of a slicer; what is unset keeps the theme. */
export function slicerStyle(config: FilterElement): CSSProperties {
  const style: Record<string, string | number> = {};
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') style[name] = value;
  };
  set('--mb-s-family', config.itemFamily);
  set(
    '--mb-s-size',
    config.itemSize === undefined ? undefined : `${config.itemSize}px`,
  );
  set('--mb-s-color', config.itemColor);
  set('--mb-s-fill', config.itemFill);
  set('--mb-s-border', config.itemBorder);
  set(
    '--mb-s-border-width',
    config.itemBorderWidth === undefined
      ? undefined
      : `${config.itemBorderWidth}px`,
  );
  set(
    '--mb-s-radius',
    config.itemRadius === undefined ? undefined : `${config.itemRadius}px`,
  );
  set(
    '--mb-s-padding',
    config.itemPadding === undefined
      ? undefined
      : `${config.itemPadding}px ${config.itemPadding * 2}px`,
  );
  set(
    '--mb-s-gap',
    config.itemGap === undefined ? undefined : `${config.itemGap}px`,
  );
  if (config.itemBold !== undefined)
    set('--mb-s-weight', config.itemBold ? 700 : 400);
  if (config.itemItalic) set('--mb-s-style', 'italic');
  if (config.itemUnderline) set('--mb-s-decoration', 'underline');
  if (config.itemWrap) set('--mb-s-wrap', 'normal');
  set('--mb-s-hover', config.hoverFill);
  set('--mb-s-hover-color', config.hoverColor);
  set('--mb-s-selected', config.selectedFill);
  set('--mb-s-selected-color', config.selectedColor);
  set('--mb-s-selected-border', config.selectedBorder);
  if (config.selectedBold !== undefined)
    set('--mb-s-selected-weight', config.selectedBold ? 700 : 400);
  set('--mb-s-icon', config.iconColor);
  if (config.layout === 'grid')
    set('--mb-s-columns', `repeat(${config.columns ?? 2}, minmax(0, 1fr))`);
  return style as CSSProperties;
}

/**
 * A slicer of the canvas drawn as a list, buttons or a text box. Choices apply
 * right away, through the same data mask as the filter bar.
 */
export function SlicerView({
  filter,
  config,
}: {
  filter: Filter;
  config: FilterElement;
}) {
  const dispatch = useDispatch();
  const { column, values } = useSlicerValues(filter);
  const selected = useSelector<RootState, SlicerValue[]>(
    state =>
      (state.dataMask[filter.id]?.filterState?.value as SlicerValue[]) ?? [],
  );
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const { multiSelect = true, inverseSelection } = (filter.controlValues ??
    {}) as { multiSelect?: boolean; inverseSelection?: boolean };
  const variant = config.variant ?? 'list';

  const apply = useCallback(
    (next: SlicerValue[]) => {
      if (!column) return;
      dispatch(
        updateDataMask(filter.id, {
          extraFormData: getSelectExtraFormData(
            column,
            next,
            false,
            inverseSelection,
          ),
          filterState: {
            value: next.length ? next : null,
            label: next.map(textOf).join(', ') || undefined,
          },
        }),
      );
    },
    [column, dispatch, filter.id, inverseSelection],
  );

  const applyText = (value: string) => {
    if (!column) return;
    const clean = value.trim();
    dispatch(
      updateDataMask(filter.id, {
        extraFormData: clean
          ? { filters: [{ col: column, op: 'ILIKE', val: `%${clean}%` }] }
          : {},
        filterState: {
          value: clean ? [clean] : null,
          label: clean || undefined,
        },
      }),
    );
  };

  useEffect(() => {
    if (variant === 'input') setText(selected.map(String).join(' '));
    // Follows selections made elsewhere, like the filter bar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join('|'), variant]);

  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (values ?? []).filter(
      value => !query || textOf(value).toLowerCase().includes(query),
    );
  }, [search, values]);

  const toggle = (value: SlicerValue) => {
    if (selected.includes(value)) {
      apply(selected.filter(item => item !== value));
    } else {
      apply(multiSelect ? [...selected, value] : [value]);
    }
  };

  const all = !!values?.length && values.every(v => selected.includes(v));
  const placeholder = config.searchPlaceholder || t('Search');

  return (
    <Box style={slicerStyle(config)} data-test="mibi-slicer">
      {!config.hideLabel && <Header>{filter.name}</Header>}
      {variant === 'input' ? (
        <input
          className="slicer-input"
          data-test="mibi-slicer-input"
          aria-label={filter.name}
          placeholder={config.searchPlaceholder || t('Type to filter')}
          value={text}
          onChange={event => setText(event.target.value)}
          onBlur={() => applyText(text)}
          onKeyDown={event => {
            if (event.key === 'Enter') applyText(text);
          }}
        />
      ) : (
        <>
          {config.showSearch && (
            <input
              className="slicer-search"
              data-test="mibi-slicer-search"
              aria-label={t('Search %s', filter.name)}
              placeholder={placeholder}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          )}
          <div
            className={[
              'slicer-items',
              variant === 'buttons' && 'is-buttons',
              config.layout === 'horizontal' && 'is-row',
            ]
              .filter(Boolean)
              .join(' ')}
            role="group"
            aria-label={filter.name}
          >
            {values === undefined && (
              <span className="slicer-hint">{t('Loading...')}</span>
            )}
            {values?.length === 0 && (
              <span className="slicer-hint">{t('No data')}</span>
            )}
            {multiSelect && config.showSelectAll && !!values?.length && (
              <button
                type="button"
                className="slicer-item"
                aria-pressed={all}
                data-test="mibi-slicer-all"
                onClick={() => apply(all ? [] : values)}
              >
                {variant === 'list' && config.showIcon !== false && (
                  <span className="slicer-mark" />
                )}
                <span className="slicer-text">{t('Select all')}</span>
              </button>
            )}
            {shown.map(value => (
              <button
                type="button"
                key={String(value)}
                className="slicer-item"
                aria-pressed={selected.includes(value)}
                title={textOf(value)}
                data-test="mibi-slicer-item"
                onClick={() => toggle(value)}
              >
                {variant === 'list' && config.showIcon !== false && (
                  <span
                    className={
                      multiSelect ? 'slicer-mark' : 'slicer-mark is-single'
                    }
                  />
                )}
                <span className="slicer-text">{textOf(value)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Box>
  );
}
