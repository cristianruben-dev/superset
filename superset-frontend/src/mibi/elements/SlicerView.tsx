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
import {
  inputFilters,
  inputValues,
  nextSelection,
  selectionMode,
  selectionSummary,
  slicerText,
  slicerValueKey,
  sortSlicerValues,
  visibleValues,
  type SlicerValue,
} from './slicer';
import { withOpacity } from 'src/mibi/format/styles';
import type { Corners, FilterElement } from './types';

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
      font-family: var(--mb-s-search-family, inherit);
      font-size: var(--mb-s-search-size, inherit);
      padding: var(
        --mb-s-search-padding,
        ${theme.sizeUnit}px ${theme.sizeUnit * 2}px
      );
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
      align-items: var(--mb-s-valign, center);
      gap: var(--mb-s-icon-gap, ${theme.sizeUnit * 1.5}px);
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
      text-align: var(--mb-s-align, left);
      justify-content: var(--mb-s-justify, flex-start);
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
        font-style: var(--mb-s-selected-style, var(--mb-s-style, inherit));
        text-decoration: var(
          --mb-s-selected-decoration,
          var(--mb-s-decoration, none)
        );
        border-width: var(
          --mb-s-selected-border-width,
          var(--mb-s-border-width, 0)
        );
        border-radius: var(
          --mb-s-selected-radius,
          var(--mb-s-radius, ${theme.borderRadius}px)
        );
        padding: var(
          --mb-s-selected-padding,
          var(--mb-s-padding, ${theme.sizeUnit}px ${theme.sizeUnit * 2}px)
        );
      }
    }
    .slicer-items.is-mark-overlay .slicer-item {
      position: relative;
    }
    .slicer-items.is-mark-overlay .slicer-mark {
      position: absolute;
      top: ${theme.sizeUnit}px;
      right: ${theme.sizeUnit}px;
    }
    .slicer-items.is-mark-right .slicer-mark {
      order: 2;
      margin-left: auto;
    }
    .slicer-items.is-buttons .slicer-item {
      --mb-s-border-width: 1px;
      justify-content: var(--mb-s-justify, center);
      background: var(--mb-s-fill, ${theme.colorBgContainer});
    }
    .slicer-items.is-buttons .slicer-item[aria-pressed='true'] {
      background: var(--mb-s-selected, ${theme.colorPrimary});
      color: var(--mb-s-selected-color, ${theme.colorTextLightSolid});
      border-color: var(--mb-s-selected-border, ${theme.colorPrimary});
    }

    .slicer-mark {
      flex: none;
      width: var(--mb-s-icon-size, 14px);
      height: var(--mb-s-icon-size, 14px);
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

    .slicer-pills {
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.sizeUnit}px;
    }
    .slicer-pill {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
      max-width: 100%;
      padding: 0 ${theme.sizeUnit * 1.5}px;
      border: 0;
      border-radius: var(--mb-s-pill-radius, 999px);
      background: var(--mb-s-pill-fill, ${theme.colorFillSecondary});
      color: var(--mb-s-pill-color, ${theme.colorText});
      font: inherit;
      font-size: ${theme.fontSizeSM}px;
      line-height: 22px;
      cursor: pointer;

      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      &:focus-visible {
        outline: 2px solid ${theme.colorPrimary};
      }
    }

    .slicer-apply {
      display: flex;
      justify-content: flex-end;
      gap: ${theme.sizeUnit * 2}px;

      button {
        padding: ${theme.sizeUnit}px ${theme.sizeUnit * 3}px;
        border: 1px solid ${theme.colorBorder};
        border-radius: ${theme.borderRadius}px;
        background: ${theme.colorBgContainer};
        color: ${theme.colorText};
        font: inherit;
        cursor: pointer;
      }
      button.is-primary {
        border-color: var(--mb-s-apply-fill, ${theme.colorPrimary});
        background: var(--mb-s-apply-fill, ${theme.colorPrimary});
        color: var(--mb-s-apply-color, ${theme.colorTextLightSolid});
      }
      button:disabled {
        opacity: 0.5;
        cursor: default;
      }
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
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  justify-content: var(--mb-f-label-justify, flex-start);

  .slicer-summary {
    font-weight: 400;
    opacity: 0.7;
  }
  .slicer-pending {
    width: 6px;
    height: 6px;
    flex: none;
    align-self: center;
    border-radius: 50%;
    background: ${({ theme }) => theme.colorWarning};
  }
`;

/**
 * The rows a filter asks for, as its own control would: the values of a list,
 * or the lowest and highest value of a range.
 */
export function useFilterRows(filter: Filter) {
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const dashboardId = useSelector<RootState, number>(
    state => state.dashboardInfo.id,
  );
  const dependencies = useFilterDependencies(filter.id, dataMask);
  const [rows, setRows] = useState<Record<string, SlicerValue>[]>();
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
        if (current)
          setRows((answer as { data: Record<string, SlicerValue>[] }).data);
      })
      .catch(error => {
        logging.error(error);
        if (current) setRows([]);
      });
    return () => {
      current = false;
    };
    // Asks again only when the parents of the filter change their selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, column, dashboardId, datasetId, filter.id]);

  return { column, rows };
}

/** The values of a filter, as its own dropdown would ask for them. */
function useSlicerValues(filter: Filter) {
  const { column, rows } = useFilterRows(filter);
  const values = useMemo(
    () => (column ? rows?.map(row => row[column]) : rows && []),
    [column, rows],
  );
  return { column, values };
}

const JUSTIFY = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

const V_ALIGN = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
} as const;

/** A fill with its transparency, or nothing when no fill was chosen. */
export const fillOf = (color: string | undefined, opacity?: number) =>
  color && opacity !== undefined ? withOpacity(color, opacity) : color;

/** Four corners as a CSS radius, top left first and clockwise. */
const cornersOf = (corners: Corners | undefined) =>
  corners?.map(corner => `${corner}px`).join(' ');

/** The variables of the look of a slicer; what is unset keeps the theme. */
export function slicerStyle(config: FilterElement): CSSProperties {
  const style: Record<string, string | number> = {};
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') style[name] = value;
  };
  const px = (value: number | undefined) =>
    value === undefined ? undefined : `${value}px`;
  set('--mb-s-family', config.itemFamily);
  set('--mb-s-size', px(config.itemSize));
  set('--mb-s-color', config.itemColor);
  set('--mb-s-fill', fillOf(config.itemFill, config.itemFillOpacity));
  set('--mb-s-border', config.itemBorder);
  set('--mb-s-border-width', px(config.itemBorderWidth));
  set('--mb-s-radius', cornersOf(config.itemCorners) ?? px(config.itemRadius));
  set(
    '--mb-s-padding',
    config.itemPadding === undefined
      ? undefined
      : `${config.itemPadding}px ${config.itemPadding * 2}px`,
  );
  set('--mb-s-gap', px(config.itemGap));
  if (config.itemBold !== undefined)
    set('--mb-s-weight', config.itemBold ? 700 : 400);
  if (config.itemItalic) set('--mb-s-style', 'italic');
  if (config.itemUnderline) set('--mb-s-decoration', 'underline');
  if (config.itemWrap) set('--mb-s-wrap', 'normal');
  if (config.itemAlign) {
    set('--mb-s-align', config.itemAlign);
    set('--mb-s-justify', JUSTIFY[config.itemAlign]);
  }
  set('--mb-s-hover', config.hoverFill);
  set('--mb-s-hover-color', config.hoverColor);
  set(
    '--mb-s-selected',
    fillOf(config.selectedFill, config.selectedFillOpacity),
  );
  set('--mb-s-selected-color', config.selectedColor);
  set('--mb-s-selected-border', config.selectedBorder);
  set('--mb-s-selected-border-width', px(config.selectedBorderWidth));
  if (config.selectedBold !== undefined)
    set('--mb-s-selected-weight', config.selectedBold ? 700 : 400);
  if (config.selectedItalic !== undefined)
    set('--mb-s-selected-style', config.selectedItalic ? 'italic' : 'normal');
  if (config.selectedUnderline !== undefined)
    set(
      '--mb-s-selected-decoration',
      config.selectedUnderline ? 'underline' : 'none',
    );
  set('--mb-s-icon', config.iconColor);
  set('--mb-s-icon-size', px(config.iconSize));
  set('--mb-s-icon-gap', px(config.iconGap));
  set('--mb-s-selected-radius', px(config.selectedRadius));
  if (config.selectedPadding !== undefined)
    set(
      '--mb-s-selected-padding',
      `${config.selectedPadding}px ${config.selectedPadding * 2}px`,
    );
  if (config.itemVAlign) set('--mb-s-valign', V_ALIGN[config.itemVAlign]);
  if (config.searchPadding !== undefined)
    set(
      '--mb-s-search-padding',
      `${config.searchPadding}px ${config.searchPadding * 2}px`,
    );
  set('--mb-s-search-family', config.searchFamily);
  set('--mb-s-search-size', px(config.searchSize));
  set('--mb-s-search-color', config.searchColor);
  set(
    '--mb-s-search-fill',
    fillOf(config.searchFill, config.searchFillOpacity),
  );
  set('--mb-s-search-border', config.searchBorder);
  set(
    '--mb-s-search-radius',
    cornersOf(config.searchCorners) ?? px(config.searchRadius),
  );
  set('--mb-s-pill-fill', fillOf(config.pillFill, config.pillFillOpacity));
  set('--mb-s-pill-color', config.pillColor);
  set('--mb-s-pill-radius', px(config.pillRadius));
  set('--mb-s-apply-fill', config.applyFill);
  set('--mb-s-apply-color', config.applyColor);
  if (config.layout === 'grid')
    set('--mb-s-columns', `repeat(${config.columns ?? 2}, minmax(0, 1fr))`);
  return style as CSSProperties;
}

const sameValues = (a: SlicerValue[], b: SlicerValue[]) =>
  a.length === b.length && a.every(value => b.includes(value));

/**
 * The header of a slicer: its name, how many values are chosen and a mark
 * while choices wait for Apply.
 */
export function SlicerHeader({
  name,
  summary,
  pending,
}: {
  name: string;
  summary?: string;
  pending?: boolean;
}) {
  return (
    <Header data-test="mibi-slicer-header">
      <span>{name}</span>
      {summary !== undefined && (
        <span className="slicer-summary" data-test="mibi-slicer-summary">
          {summary}
        </span>
      )}
      {pending && (
        <span
          className="slicer-pending"
          role="img"
          aria-label={t('Changes not applied')}
          title={t('Changes not applied')}
        />
      )}
    </Header>
  );
}

/**
 * A slicer of the canvas drawn as a list, buttons or a text box. Choices apply
 * right away, through the same data mask as the filter bar, or wait for an
 * Apply button when the slicer has one.
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
  const applied = useSelector<RootState, SlicerValue[]>(
    state =>
      (state.dataMask[filter.id]?.filterState?.value as SlicerValue[]) ?? [],
  );
  const [pending, setPending] = useState<SlicerValue[]>();
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const { multiSelect = true, inverseSelection } = (filter.controlValues ??
    {}) as { multiSelect?: boolean; inverseSelection?: boolean };
  const variant = config.variant ?? 'list';
  const mode = selectionMode(config, multiSelect);
  const selected = pending ?? applied;
  const waiting = !!pending && !sameValues(pending, applied);

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
            label:
              next.map(value => slicerText(value, config)).join(', ') ||
              undefined,
          },
        }),
      );
      setPending(undefined);
    },
    [column, config, dispatch, filter.id, inverseSelection],
  );

  // With an Apply button choices wait; without one they filter right away
  const choose = (next: SlicerValue[]) =>
    config.applyButton ? setPending(next) : apply(next);

  const applyText = (value: string) => {
    if (!column) return;
    const numeric = !!config.inputNumeric;
    const asked = inputValues(value, config.inputMatch, numeric);
    // Enter and leaving the box both apply; only a change filters again
    if (sameValues(asked.map(String), applied.map(String))) return;
    dispatch(
      updateDataMask(filter.id, {
        extraFormData: inputFilters(column, asked, config.inputMatch, numeric),
        filterState: {
          value: asked.length ? asked : null,
          label: asked.join(', ') || undefined,
        },
      }),
    );
  };

  useEffect(() => {
    if (variant === 'input')
      setText(
        applied
          .map(String)
          .join(
            config.inputMatch === 'exact' || config.inputNumeric ? ', ' : ' ',
          ),
      );
    // Follows selections made elsewhere, like the filter bar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.join('|'), variant]);

  // Values the editor left out are not offered, nor chosen by «Select all»
  const offered = useMemo(
    () => values && visibleValues(values, config.hiddenValues),
    [config.hiddenValues, values],
  );
  const shown = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortSlicerValues(offered ?? [], config.sortValues).filter(
      value =>
        !query || slicerText(value, config).toLowerCase().includes(query),
    );
  }, [config, offered, search]);

  const all = !!offered?.length && offered.every(v => selected.includes(v));
  const placeholder = config.searchPlaceholder || t('Search');
  // Lists show their mark unless it is turned off; buttons only when asked
  const showMark =
    variant === 'list' ? config.showIcon !== false : !!config.showIcon;
  const markClass = mode === 'single' ? 'slicer-mark is-single' : 'slicer-mark';

  return (
    <Box style={slicerStyle(config)} data-test="mibi-slicer">
      {!config.hideLabel && (
        <SlicerHeader
          name={filter.name}
          summary={
            config.showSummary ? selectionSummary(selected, config) : undefined
          }
          pending={waiting}
        />
      )}
      {config.showPills && variant !== 'input' && selected.length > 0 && (
        <div className="slicer-pills" data-test="mibi-slicer-pills">
          {selected.map(value => (
            <button
              type="button"
              key={slicerValueKey(value)}
              className="slicer-pill"
              aria-label={t('Remove the value %s', slicerText(value, config))}
              onClick={() => choose(selected.filter(item => item !== value))}
            >
              <span>{slicerText(value, config)}</span>
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      {variant === 'input' ? (
        <input
          className="slicer-input"
          data-test="mibi-slicer-input"
          aria-label={filter.name}
          placeholder={
            config.searchPlaceholder ||
            (config.inputNumeric && t('Numbers separated by commas')) ||
            (config.inputMatch === 'exact'
              ? t('Values separated by commas')
              : t('Type to filter'))
          }
          inputMode={config.inputNumeric ? 'decimal' : undefined}
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
              config.iconPosition === 'right' && 'is-mark-right',
              config.iconOverlay && 'is-mark-overlay',
            ]
              .filter(Boolean)
              .join(' ')}
            role="group"
            aria-label={filter.name}
          >
            {values === undefined && (
              <span className="slicer-hint">{t('Loading...')}</span>
            )}
            {offered?.length === 0 && (
              <span className="slicer-hint">{t('No data')}</span>
            )}
            {mode !== 'single' && config.showSelectAll && !!offered?.length && (
              <button
                type="button"
                className="slicer-item"
                aria-pressed={all}
                data-test="mibi-slicer-all"
                onClick={() => choose(all ? [] : (offered ?? []))}
              >
                {showMark && <span className="slicer-mark" />}
                <span className="slicer-text">{t('Select all')}</span>
              </button>
            )}
            {shown.map(value => (
              <button
                type="button"
                key={slicerValueKey(value)}
                className="slicer-item"
                aria-pressed={selected.includes(value)}
                title={slicerText(value, config)}
                data-test="mibi-slicer-item"
                onClick={event =>
                  choose(
                    nextSelection(
                      selected,
                      value,
                      mode,
                      event.ctrlKey || event.metaKey,
                    ),
                  )
                }
              >
                {showMark && <span className={markClass} />}
                <span className="slicer-text">{slicerText(value, config)}</span>
              </button>
            ))}
          </div>
          {config.applyButton && (
            <div className="slicer-apply">
              <button
                type="button"
                data-test="mibi-slicer-reset"
                disabled={!waiting}
                onClick={() => setPending(undefined)}
              >
                {t('Reset')}
              </button>
              <button
                type="button"
                className="is-primary"
                data-test="mibi-slicer-apply"
                disabled={!waiting}
                onClick={() => apply(selected)}
              >
                {t('Apply')}
              </button>
            </div>
          )}
        </>
      )}
    </Box>
  );
}
