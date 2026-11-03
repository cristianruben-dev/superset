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

import { Component, createRef, Fragment, ReactNode, MouseEvent } from 'react';
import {
  safeHtmlSpan,
  getNumberFormatter,
  getMetricLabel,
  CurrencyFormatter,
  getCustomFontCss,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { supersetTheme } from '@apache-superset/core/theme';
import PropTypes from 'prop-types';
import { FaSort } from 'react-icons/fa';
import { FaSortDown as FaSortDesc } from 'react-icons/fa';
import { FaSortUp as FaSortAsc } from 'react-icons/fa';
import {
  TabularSparkline,
  formatTableNumber,
  getTabularCellIcon,
  getTableColumnStyle,
  getTableCellUrl,
  type TabularFormat,
  type TableColumnConfig,
  ColorFormatters,
  getTextColorForBackground,
  ObjectFormattingEnum,
  ResolvedColorFormatterResult,
} from '@superset-ui/chart-controls';
import { PivotData, flatKey } from './utilities';
import { Styles } from './Styles';

type ClickCallback = (
  e: MouseEvent,
  value: unknown,
  filters: Record<string, string>,
  pivotData: InstanceType<typeof PivotData>,
) => void;

type HeaderClickCallback = (
  e: MouseEvent,
  value: string,
  filters: Record<string, string>,
  pivotData: InstanceType<typeof PivotData>,
  isSubtotal: boolean,
  isGrandTotal: boolean,
) => void;

interface TableOptions {
  tableFormat?: TabularFormat;
  rowTotals?: boolean;
  colTotals?: boolean;
  rowSubTotals?: boolean;
  colSubTotals?: boolean;
  clickCallback?: ClickCallback;
  clickColumnHeaderCallback?: HeaderClickCallback;
  clickRowHeaderCallback?: HeaderClickCallback;
  highlightHeaderCellsOnHover?: boolean;
  omittedHighlightHeaderGroups?: string[];
  highlightedHeaderCells?: Record<string, unknown[]>;
  cellColorFormatters?: Record<string, ColorFormatters>;
  dateFormatters?: Record<string, ((val: unknown) => string) | undefined>;
  cellBackgroundColor?: string;
  cellTextColor?: string;
  activeHeaderBackgroundColor?: string;
}

interface SubtotalDisplay {
  displayOnTop: boolean;
  enabled?: boolean;
  hideOnExpand: boolean;
}

interface SubtotalOptions {
  arrowCollapsed?: ReactNode;
  arrowExpanded?: ReactNode;
  colSubtotalDisplay?: Partial<SubtotalDisplay>;
  rowSubtotalDisplay?: Partial<SubtotalDisplay>;
}

interface TableRendererProps {
  cols: string[];
  rows: string[];
  aggregatorName: string;
  tableOptions: TableOptions;
  subtotalOptions?: SubtotalOptions;
  namesMapping?: Record<string, string>;
  onContextMenu: (
    e: MouseEvent,
    colKey?: string[],
    rowKey?: string[],
    filters?: Record<string, string>,
  ) => void;
  allowRenderHtml?: boolean;
  [key: string]: unknown;
}

interface TableRendererState {
  collapsedRows: Record<string, boolean>;
  collapsedCols: Record<string, boolean>;
  sortingOrder: string[];
  activeSortColumn?: number | null;
}

interface PivotSettings {
  pivotData: InstanceType<typeof PivotData>;
  colAttrs: string[];
  rowAttrs: string[];
  colKeys: string[][];
  rowKeys: string[][];
  rowTotals: boolean;
  colTotals: boolean;
  arrowCollapsed: ReactNode;
  arrowExpanded: ReactNode;
  colSubtotalDisplay: SubtotalDisplay;
  rowSubtotalDisplay: SubtotalDisplay;
  cellCallbacks: Record<string, Record<string, (e: MouseEvent) => void>>;
  rowTotalCallbacks: Record<string, (e: MouseEvent) => void>;
  colTotalCallbacks: Record<string, (e: MouseEvent) => void>;
  grandTotalCallback: ((e: MouseEvent) => void) | null;
  namesMapping: Record<string, string>;
  allowRenderHtml?: boolean;
  visibleRowKeys?: string[][];
  visibleColKeys?: string[][];
  maxRowVisible?: number;
  maxColVisible?: number;
  rowAttrSpans?: number[][];
  colAttrSpans?: number[][];
}

const parseLabel = (value: unknown): string | number => {
  if (typeof value === 'string') {
    if (value === 'metric') return t('metric');
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
};

function displayCell(value: unknown, allowRenderHtml?: boolean): ReactNode {
  if (allowRenderHtml && typeof value === 'string') {
    return safeHtmlSpan(value);
  }
  return parseLabel(value);
}
function displayHeaderCell(
  needToggle: boolean,
  ArrowIcon: ReactNode,
  onArrowClick: ((e: MouseEvent<HTMLSpanElement>) => void) | null,
  value: unknown,
  namesMapping: Record<string, string>,
  allowRenderHtml?: boolean,
  urlIcon?: boolean,
): ReactNode {
  const name = namesMapping[String(value)] || value;
  const parsedLabel = parseLabel(name);
  const url = urlIcon ? getTableCellUrl(name) : undefined;
  const labelContent = url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('Open link: %s', String(name))}
      onClick={event => event.stopPropagation()}
    >
      ↗
    </a>
  ) : allowRenderHtml && typeof parsedLabel === 'string' ? (
    safeHtmlSpan(parsedLabel)
  ) : (
    parsedLabel
  );
  return needToggle ? (
    <span className="toggle-wrapper">
      <span
        role="button"
        tabIndex={0}
        className="toggle"
        onClick={onArrowClick || undefined}
        aria-label={t('Expand or collapse group')}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onArrowClick?.(event as unknown as MouseEvent<HTMLSpanElement>);
          }
        }}
      >
        {ArrowIcon}
      </span>
      <span className="toggle-val">{labelContent}</span>
    </span>
  ) : (
    labelContent
  );
}

export function getCellColor(
  keys: string[],
  aggValue: string | number | null,
  cellColorFormatters: Record<string, ColorFormatters> | undefined,
  cellBackgroundColor = supersetTheme.colorBgBase,
): ResolvedColorFormatterResult {
  if (!cellColorFormatters) return { backgroundColor: undefined };

  let backgroundColor: string | undefined;
  let color: string | undefined;
  const isTextColorFormatter = (formatter: ColorFormatters[number]) =>
    formatter.objectFormatting === ObjectFormattingEnum.TEXT_COLOR ||
    formatter.toTextColor;

  for (const cellColorFormatter of Object.values(cellColorFormatters)) {
    if (!Array.isArray(cellColorFormatter)) continue;

    for (const key of keys) {
      for (const formatter of cellColorFormatter) {
        if (formatter.column === key) {
          const result = formatter.getColorFromValue(aggValue);
          if (result) {
            if (isTextColorFormatter(formatter)) {
              color = result;
            } else if (
              formatter.objectFormatting !== ObjectFormattingEnum.CELL_BAR
            ) {
              backgroundColor = result;
            }
          }
        }
      }
    }
  }

  return {
    backgroundColor,
    color: getTextColorForBackground(
      { backgroundColor, color },
      cellBackgroundColor,
    ),
  };
}

interface HierarchicalNode {
  currentVal?: number;
  [key: string]: HierarchicalNode | number | undefined;
}

function sortHierarchicalObject(
  obj: Record<string, HierarchicalNode>,
  objSort: string,
  rowPartialOnTop: boolean | undefined,
): Map<string, unknown> {
  // Performs a recursive sort of nested object structures. Sorts objects based on
  // their currentVal property. The function preserves the hierarchical structure
  // while sorting each level according to the specified criteria.
  const sortedKeys = Object.keys(obj).sort((a, b) => {
    const valA = obj[a].currentVal || 0;
    const valB = obj[b].currentVal || 0;
    if (rowPartialOnTop) {
      if (obj[a].currentVal !== undefined && obj[b].currentVal === undefined) {
        return -1;
      }
      if (obj[b].currentVal !== undefined && obj[a].currentVal === undefined) {
        return 1;
      }
    }
    return objSort === 'asc' ? valA - valB : valB - valA;
  });

  const result = new Map<string, unknown>();
  sortedKeys.forEach(key => {
    const value = obj[key];
    if (typeof value === 'object' && !Array.isArray(value)) {
      result.set(
        key,
        sortHierarchicalObject(
          value as Record<string, HierarchicalNode>,
          objSort,
          rowPartialOnTop,
        ),
      );
    } else {
      result.set(key, value);
    }
  });
  return result;
}

function convertToNumberIfNumeric(value: string): string | number {
  const n = Number(value);
  return value.trim() !== '' && !Number.isNaN(n) ? n : value;
}

function convertToArray(
  obj: Map<string, unknown>,
  rowEnabled: boolean | undefined,
  rowPartialOnTop: boolean | undefined,
  maxRowIndex: number,
  parentKeys: string[] = [],
  result: string[][] = [],
  flag = false,
): string[][] {
  // Recursively flattens a hierarchical Map structure into an array of key paths.
  // Handles different rendering scenarios based on row grouping configurations and
  // depth limitations. The function supports complex hierarchy flattening with
  let updatedFlag = flag;

  const keys = Array.from(obj.keys());
  const getValue = (key: string) => obj.get(key);

  keys.forEach(key => {
    if (key === 'currentVal') {
      return;
    }
    const value = getValue(key);
    if (rowEnabled && rowPartialOnTop && parentKeys.length < maxRowIndex - 1) {
      result.push(parentKeys.length > 0 ? [...parentKeys, key] : [key]);
      updatedFlag = true;
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      convertToArray(
        value as Map<string, unknown>,
        rowEnabled,
        rowPartialOnTop,
        maxRowIndex,
        [...parentKeys, key],
        result,
      );
    }
    if (
      parentKeys.length >= maxRowIndex - 1 ||
      (rowEnabled && !rowPartialOnTop)
    ) {
      if (!updatedFlag) {
        result.push(parentKeys.length > 0 ? [...parentKeys, key] : [key]);
        return;
      }
    }
    if (parentKeys.length === 0 && maxRowIndex === 1) {
      result.push([key]);
    }
  });
  return result;
}

export class TableRenderer extends Component<
  TableRendererProps,
  TableRendererState
> {
  sortCache: Map<string, string[][]>;
  rowExpansionDepth: unknown;
  columnExpansionDepth: unknown;
  columnRanges: Record<string, [number, number]> = {};
  cachedProps: TableRendererProps | null;
  cachedBasePivotSettings: PivotSettings | null;

  tableRef = createRef<HTMLTableElement>();

  static propTypes: Record<string, unknown>;
  static defaultProps: Record<string, unknown>;

  constructor(props: TableRendererProps) {
    super(props);

    // We need state to record which entries are collapsed and which aren't.
    // This is an object with flat-keys indicating if the corresponding rows
    // should be collapsed.
    this.state = { collapsedRows: {}, collapsedCols: {}, sortingOrder: [] };
    this.sortCache = new Map();
    this.cachedProps = null;
    this.cachedBasePivotSettings = null;
    this.clickHeaderHandler = this.clickHeaderHandler.bind(this);
    this.clickHandler = this.clickHandler.bind(this);
  }

  /** Resolve a metric or grouping field against the existing per-column settings. */
  columnConfig(keys: string[], attribute?: string): TableColumnConfig {
    const config = this.props.tableOptions.tableFormat?.column_config as
      | Record<string, TableColumnConfig>
      | undefined;
    return config?.[keys.find(key => config?.[key]) ?? attribute ?? ''] ?? {};
  }

  /** Format the same aggregate for detail cells and totals. */
  formatValue(
    value: unknown,
    fallback: unknown,
    config: TableColumnConfig,
  ): unknown {
    const number = formatTableNumber(value, config);
    if (number !== undefined) return number;
    if (typeof value !== 'number' || !config.d3NumberFormat) return fallback;
    return config.currencyFormat?.symbol &&
      config.currencyFormat.symbol !== 'AUTO'
      ? new CurrencyFormatter({
          currency: config.currencyFormat,
          d3Format: config.d3NumberFormat,
        })(value)
      : getNumberFormatter(config.d3NumberFormat)(value);
  }

  getBasePivotSettings(): PivotSettings {
    // One-time extraction of pivot settings that we'll use throughout the render.

    const { props } = this;
    const colAttrs = props.cols;
    const rowAttrs = props.rows;

    const tableOptions: TableOptions = {
      rowTotals: true,
      colTotals: true,
      ...props.tableOptions,
    };
    const rowTotals = tableOptions.rowTotals || colAttrs.length === 0;
    const colTotals = tableOptions.colTotals || rowAttrs.length === 0;

    const namesMapping = props.namesMapping || {};
    const subtotalOptions: Required<
      Pick<SubtotalOptions, 'arrowCollapsed' | 'arrowExpanded'>
    > &
      SubtotalOptions = {
      arrowCollapsed: '\u25B2',
      arrowExpanded: '\u25BC',
      ...props.subtotalOptions,
    };

    const colSubtotalDisplay: SubtotalDisplay = {
      displayOnTop: false,
      enabled:
        tableOptions.colSubTotals ||
        typeof tableOptions.tableFormat?.table_column_expand_depth === 'number',
      hideOnExpand:
        !tableOptions.colSubTotals &&
        typeof tableOptions.tableFormat?.table_column_expand_depth === 'number',
      ...subtotalOptions.colSubtotalDisplay,
    };

    const rowSubtotalDisplay: SubtotalDisplay = {
      displayOnTop: false,
      enabled:
        tableOptions.rowSubTotals ||
        tableOptions.tableFormat?.table_stepped === true ||
        typeof tableOptions.tableFormat?.table_row_expand_depth === 'number',
      hideOnExpand:
        !tableOptions.rowSubTotals &&
        tableOptions.tableFormat?.table_stepped !== true &&
        typeof tableOptions.tableFormat?.table_row_expand_depth === 'number',
      ...subtotalOptions.rowSubtotalDisplay,
    };

    const pivotData = new PivotData(props as Record<string, unknown>, {
      rowEnabled:
        rowSubtotalDisplay.enabled ||
        props.tableOptions.tableFormat?.table_stepped === true,
      colEnabled: colSubtotalDisplay.enabled,
      rowPartialOnTop: rowSubtotalDisplay.displayOnTop,
      colPartialOnTop: colSubtotalDisplay.displayOnTop,
    });
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();

    // Also pre-calculate all the callbacks for cells, etc... This is nice to have to
    // avoid re-calculations of the call-backs on cell expansions, etc...
    const cellCallbacks: Record<
      string,
      Record<string, (e: MouseEvent) => void>
    > = {};
    const rowTotalCallbacks: Record<string, (e: MouseEvent) => void> = {};
    const colTotalCallbacks: Record<string, (e: MouseEvent) => void> = {};
    let grandTotalCallback: ((e: MouseEvent) => void) | null = null;
    if (tableOptions.clickCallback) {
      rowKeys.forEach(rowKey => {
        const flatRowKey = flatKey(rowKey);
        if (!(flatRowKey in cellCallbacks)) {
          cellCallbacks[flatRowKey] = {};
        }
        colKeys.forEach(colKey => {
          cellCallbacks[flatRowKey][flatKey(colKey)] = this.clickHandler(
            pivotData,
            rowKey,
            colKey,
          );
        });
      });

      // Add in totals as well.
      if (rowTotals) {
        rowKeys.forEach(rowKey => {
          rowTotalCallbacks[flatKey(rowKey)] = this.clickHandler(
            pivotData,
            rowKey,
            [],
          );
        });
      }
      if (colTotals) {
        colKeys.forEach(colKey => {
          colTotalCallbacks[flatKey(colKey)] = this.clickHandler(
            pivotData,
            [],
            colKey,
          );
        });
      }
      if (rowTotals && colTotals) {
        grandTotalCallback = this.clickHandler(pivotData, [], []);
      }
    }

    this.columnRanges = {};
    if (
      Object.values(
        (tableOptions.tableFormat?.column_config ?? {}) as Record<
          string,
          TableColumnConfig
        >,
      ).some(config => config.showCellBars === true)
    ) {
      rowKeys
        .filter(key => key.length === rowAttrs.length)
        .forEach(rowKey =>
          colKeys
            .filter(key => key.length === colAttrs.length)
            .forEach(colKey => {
              const config = this.columnConfig([...rowKey, ...colKey]);
              if (config.showCellBars !== true) return;
              const value = pivotData.getAggregator(rowKey, colKey).value();
              if (typeof value !== 'number' || !Number.isFinite(value)) return;
              const key = flatKey(colKey);
              const range = this.columnRanges[key] ?? [0, 0];
              this.columnRanges[key] = [
                Math.min(range[0], value),
                Math.max(range[1], value),
              ];
            }),
        );
    }
    return {
      pivotData,
      colAttrs,
      rowAttrs,
      colKeys,
      rowKeys,
      rowTotals,
      colTotals,
      arrowCollapsed: subtotalOptions.arrowCollapsed,
      arrowExpanded: subtotalOptions.arrowExpanded,
      colSubtotalDisplay,
      rowSubtotalDisplay,
      cellCallbacks,
      rowTotalCallbacks,
      colTotalCallbacks,
      grandTotalCallback,
      namesMapping,
      allowRenderHtml: props.allowRenderHtml,
    };
  }

  clickHandler(
    pivotData: InstanceType<typeof PivotData>,
    rowValues: string[],
    colValues: string[],
  ) {
    const colAttrs = this.props.cols;
    const rowAttrs = this.props.rows;
    const value = pivotData.getAggregator(rowValues, colValues).value();
    const filters: Record<string, string> = {};
    const colLimit = Math.min(colAttrs.length, colValues.length);
    for (let i = 0; i < colLimit; i += 1) {
      const attr = colAttrs[i];
      if (colValues[i] !== null) {
        filters[attr] = colValues[i];
      }
    }
    const rowLimit = Math.min(rowAttrs.length, rowValues.length);
    for (let i = 0; i < rowLimit; i += 1) {
      const attr = rowAttrs[i];
      if (rowValues[i] !== null) {
        filters[attr] = rowValues[i];
      }
    }
    const { clickCallback } = this.props.tableOptions;
    return (e: MouseEvent) => clickCallback?.(e, value, filters, pivotData);
  }

  clickHeaderHandler(
    pivotData: InstanceType<typeof PivotData>,
    values: string[],
    attrs: string[],
    attrIdx: number,
    callback: HeaderClickCallback | undefined,
    isSubtotal = false,
    isGrandTotal = false,
  ) {
    const filters: Record<string, string> = {};
    for (let i = 0; i <= attrIdx; i += 1) {
      const attr = attrs[i];
      filters[attr] = values[i];
    }
    return (e: MouseEvent) =>
      callback?.(
        e,
        values[attrIdx],
        filters,
        pivotData,
        isSubtotal,
        isGrandTotal,
      );
  }

  collapseAttr(rowOrCol: boolean, attrIdx: number, allKeys: string[][]) {
    return (e: MouseEvent<HTMLSpanElement>) => {
      // Collapse an entire attribute.
      e.stopPropagation();
      const keyLen = attrIdx + 1;
      const collapsed = allKeys
        .filter((k: string[]) => k.length === keyLen)
        .map(flatKey);

      const updates: Record<string, boolean> = {};
      collapsed.forEach((k: string) => {
        updates[k] = true;
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  expandAttr(rowOrCol: boolean, attrIdx: number, allKeys: string[][]) {
    return (e: MouseEvent<HTMLSpanElement>) => {
      // Expand an entire attribute. This implicitly implies expanding all of the
      // parents as well. It's a bit inefficient but ah well...
      e.stopPropagation();
      const updates: Record<string, boolean> = {};
      allKeys.forEach((k: string[]) => {
        for (let i = 0; i <= attrIdx; i += 1) {
          updates[flatKey(k.slice(0, i + 1))] = false;
        }
      });

      if (rowOrCol) {
        this.setState(state => ({
          collapsedRows: { ...state.collapsedRows, ...updates },
        }));
      } else {
        this.setState(state => ({
          collapsedCols: { ...state.collapsedCols, ...updates },
        }));
      }
    };
  }

  toggleRowKey(flatRowKey: string) {
    return (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedRows: {
          ...state.collapsedRows,
          [flatRowKey]: !state.collapsedRows[flatRowKey],
        },
      }));
    };
  }

  toggleColKey(flatColKey: string) {
    return (e: MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      this.setState(state => ({
        collapsedCols: {
          ...state.collapsedCols,
          [flatColKey]: !state.collapsedCols[flatColKey],
        },
      }));
    };
  }

  calcAttrSpans(attrArr: string[][], numAttrs: number) {
    // Given an array of attribute values (i.e. each element is another array with
    // the value at every level), compute the spans for every attribute value at
    // every level. The return value is a nested array of the same shape. It has
    // -1's for repeated values and the span number otherwise.

    const spans = [];
    // Index of the last new value
    const li = Array(numAttrs).map(() => 0);
    let lv: (string | null)[] = Array(numAttrs).map(() => null);
    for (let i = 0; i < attrArr.length; i += 1) {
      // Keep increasing span values as long as the last keys are the same. For
      // the rest, record spans of 1. Update the indices too.
      const cv = attrArr[i];
      const ent = [];
      let depth = 0;
      const limit = Math.min(lv.length, cv.length);
      while (depth < limit && lv[depth] === cv[depth]) {
        ent.push(-1);
        spans[li[depth]][depth] += 1;
        depth += 1;
      }
      while (depth < cv.length) {
        li[depth] = i;
        ent.push(1);
        depth += 1;
      }
      spans.push(ent);
      lv = cv;
    }
    return spans;
  }

  getAggregatedData(
    pivotData: InstanceType<typeof PivotData>,
    visibleColName: string[],
    rowPartialOnTop: boolean | undefined,
  ) {
    // Transforms flat row keys into a hierarchical group structure where each level
    // represents a grouping dimension. For each row key path, it calculates the
    // aggregated value for the specified column and builds a nested object that
    // preserves the hierarchy while storing aggregation values at each level.
    const groups: Record<string, HierarchicalNode> = {};
    const rows = pivotData.rowKeys;
    rows.forEach(rowKey => {
      const aggValue =
        pivotData.getAggregator(rowKey, visibleColName).value() ?? 0;

      if (rowPartialOnTop) {
        const parent = rowKey
          .slice(0, -1)
          .reduce(
            (acc: Record<string, HierarchicalNode>, key: string) =>
              (acc[key] ??= {}) as Record<string, HierarchicalNode>,
            groups,
          );
        parent[rowKey.at(-1)!] = { currentVal: aggValue as number };
      } else {
        rowKey.reduce((acc: Record<string, HierarchicalNode>, key: string) => {
          acc[key] = acc[key] || { currentVal: 0 };
          (acc[key] as HierarchicalNode).currentVal = aggValue as number;
          return acc[key] as Record<string, HierarchicalNode>;
        }, groups);
      }
    });
    return groups;
  }

  sortAndCacheData(
    groups: Record<string, HierarchicalNode>,
    sortOrder: string,
    rowEnabled: boolean | undefined,
    rowPartialOnTop: boolean | undefined,
    maxRowIndex: number,
  ) {
    // Processes hierarchical data by first sorting it according to the specified order
    // and then converting the sorted structure into a flat array format. This function
    // serves as an intermediate step between hierarchical data representation and
    // flat array representation needed for rendering.
    const sortedGroups = sortHierarchicalObject(
      groups,
      sortOrder,
      rowPartialOnTop,
    );
    return convertToArray(
      sortedGroups,
      rowEnabled,
      rowPartialOnTop,
      maxRowIndex,
    );
  }

  sortData(
    columnIndex: number,
    visibleColKeys: string[][],
    pivotData: InstanceType<typeof PivotData>,
    maxRowIndex: number,
  ) {
    // Handles column sorting with direction toggling (asc/desc) and implements
    // caching mechanism to avoid redundant sorting operations. When sorting the same
    // column multiple times, it cycles through sorting directions. Uses composite
    // cache keys based on sorting parameters for optimal performance.
    this.setState(state => {
      const { sortingOrder, activeSortColumn } = state;

      const newSortingOrder = [];
      let newDirection = 'asc';

      if (activeSortColumn === columnIndex) {
        newDirection = sortingOrder[columnIndex] === 'asc' ? 'desc' : 'asc';
      }

      const { rowEnabled, rowPartialOnTop } = pivotData.subtotals as {
        rowEnabled?: boolean;
        rowPartialOnTop?: boolean;
      };
      newSortingOrder[columnIndex] = newDirection;

      const cacheKey = `${columnIndex}-${visibleColKeys.length}-${rowEnabled}-${rowPartialOnTop}-${newDirection}`;
      let newRowKeys;
      if (this.sortCache.has(cacheKey)) {
        const cachedRowKeys = this.sortCache.get(cacheKey);
        newRowKeys = cachedRowKeys;
      } else {
        const groups = this.getAggregatedData(
          pivotData,
          visibleColKeys[columnIndex],
          rowPartialOnTop,
        );
        const sortedRowKeys = this.sortAndCacheData(
          groups,
          newDirection,
          rowEnabled,
          rowPartialOnTop,
          maxRowIndex,
        );
        this.sortCache.set(cacheKey, sortedRowKeys);
        newRowKeys = sortedRowKeys;
      }
      this.cachedBasePivotSettings = {
        ...this.cachedBasePivotSettings!,
        rowKeys: newRowKeys!,
      };

      return {
        sortingOrder: newSortingOrder,
        activeSortColumn: columnIndex,
      };
    });
  }

  renderColHeaderRow(
    attrName: string,
    attrIdx: number,
    pivotSettings: PivotSettings,
  ) {
    // Render a single row in the column header at the top of the pivot table.

    const {
      rowAttrs,
      colAttrs,
      colKeys,
      visibleColKeys,
      colAttrSpans,
      rowTotals,
      arrowExpanded,
      arrowCollapsed,
      colSubtotalDisplay,
      maxColVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      cellColorFormatters,
      dateFormatters,
      cellBackgroundColor = supersetTheme.colorBgBase,
      activeHeaderBackgroundColor = supersetTheme.colorPrimaryBg,
    } = this.props.tableOptions;

    if (!visibleColKeys || !colAttrSpans) {
      return null;
    }

    const spaceCell =
      attrIdx === 0 && rowAttrs.length !== 0 ? (
        <th
          key="padding"
          colSpan={rowAttrs.length}
          rowSpan={colAttrs.length}
          aria-hidden="true"
          data-mibi-level={0}
        />
      ) : null;

    const needToggle =
      colSubtotalDisplay.enabled === true && attrIdx !== colAttrs.length - 1;
    let arrowClickHandle = null;
    let subArrow = null;
    if (needToggle) {
      arrowClickHandle =
        attrIdx + 1 < maxColVisible!
          ? this.collapseAttr(false, attrIdx, colKeys)
          : this.expandAttr(false, attrIdx, colKeys);
      subArrow = attrIdx + 1 < maxColVisible! ? arrowExpanded : arrowCollapsed;
    }
    const attrNameCell = (
      <th
        key="label"
        className="pvtAxisLabel"
        data-mibi-level={rowAttrs.length}
      >
        {displayHeaderCell(
          needToggle,
          subArrow,
          arrowClickHandle,
          attrName,
          namesMapping,
          allowRenderHtml,
        )}
      </th>
    );

    const attrValueCells = [];
    const rowIncrSpan = rowAttrs.length !== 0 ? 1 : 0;
    // Iterate through columns. Jump over duplicate values.
    let i = 0;
    while (i < visibleColKeys.length) {
      let handleContextMenu: ((e: MouseEvent) => void) | undefined;
      const colKey = visibleColKeys[i];
      const colSpan = attrIdx < colKey.length ? colAttrSpans[i][attrIdx] : 1;
      let colLabelClass = 'pvtColLabel';
      if (attrIdx < colKey.length) {
        if (!omittedHighlightHeaderGroups.includes(colAttrs[attrIdx])) {
          if (highlightHeaderCellsOnHover) {
            colLabelClass += ' hoverable';
          }
          handleContextMenu = (e: MouseEvent) =>
            this.props.onContextMenu(e, colKey, undefined, {
              [attrName]: colKey[attrIdx],
            });
        }
        if (
          highlightedHeaderCells &&
          Array.isArray(highlightedHeaderCells[colAttrs[attrIdx]]) &&
          highlightedHeaderCells[colAttrs[attrIdx]].includes(colKey[attrIdx])
        ) {
          colLabelClass += ' active';
        }
        const isActiveHeader = colLabelClass.includes('active');
        const maxRowIndex = pivotSettings.maxRowVisible!;
        const mColVisible = pivotSettings.maxColVisible!;
        const visibleSortIcon = mColVisible - 1 === attrIdx;
        const columnName = colKey[mColVisible - 1];

        const rowSpan = 1 + (attrIdx === colAttrs.length - 1 ? rowIncrSpan : 0);
        const flatColKey = flatKey(colKey.slice(0, attrIdx + 1));
        const onArrowClick = needToggle ? this.toggleColKey(flatColKey) : null;
        const getSortIcon = (key: number) => {
          const { activeSortColumn, sortingOrder } = this.state;

          if (activeSortColumn !== key) {
            return (
              <FaSort
                onClick={() =>
                  this.sortData(key, visibleColKeys, pivotData, maxRowIndex)
                }
              />
            );
          }

          const SortIcon = sortingOrder[key] === 'asc' ? FaSortAsc : FaSortDesc;
          return (
            <SortIcon
              onClick={() =>
                this.sortData(key, visibleColKeys, pivotData, maxRowIndex)
              }
            />
          );
        };
        const headerCellFormattedValue =
          dateFormatters?.[attrName]?.(
            convertToNumberIfNumeric(colKey[attrIdx]),
          ) ?? colKey[attrIdx];
        const { backgroundColor, color } = getCellColor(
          [attrName],
          headerCellFormattedValue,
          cellColorFormatters,
          isActiveHeader ? activeHeaderBackgroundColor : cellBackgroundColor,
        );
        const config = this.columnConfig([colKey[attrIdx]], attrName);
        const style = {
          ...getTableColumnStyle(config, 'header'),
          ...(config.columnWidth !== undefined && {
            minWidth: config.columnWidth,
          }),
          ...(backgroundColor && { backgroundColor }),
          ...(color ? { color } : {}),
        };
        attrValueCells.push(
          <th
            className={colLabelClass}
            key={`colKey-${flatColKey}`}
            style={style}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needToggle,
              this.state.collapsedCols[flatColKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
              config.urlIcon ??
                this.props.tableOptions.tableFormat?.table_header_url_icon ===
                  true,
            )}
            <span
              role="columnheader"
              tabIndex={0}
              // Prevents event bubbling to avoid conflict with column header click handlers
              // Ensures sort operation executes without triggering cross-filtration
              onClick={e => {
                e.stopPropagation();
              }}
              aria-label={
                this.state.activeSortColumn === i
                  ? `Sorted by ${columnName} ${this.state.sortingOrder[i] === 'asc' ? 'ascending' : 'descending'}`
                  : undefined
              }
            >
              {visibleSortIcon && getSortIcon(i)}
            </span>
          </th>,
        );
      } else if (attrIdx === colKey.length) {
        const rowSpan = colAttrs.length - colKey.length + rowIncrSpan;
        attrValueCells.push(
          <th
            className={`${colLabelClass} pvtSubtotalLabel`}
            key={`colKeyBuffer-${flatKey(colKey)}`}
            colSpan={colSpan}
            rowSpan={rowSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              colKey,
              this.props.cols,
              attrIdx,
              this.props.tableOptions.clickColumnHeaderCallback,
              true,
            )}
          >
            {String(
              this.columnConfig([], colAttrs[colKey.length - 1])
                .subtotalLabel ||
                this.props.tableOptions.tableFormat
                  ?.table_column_subtotal_label ||
                t('Subtotal'),
            )}
          </th>,
        );
      }
      // The next colSpan columns will have the same value anyway...
      i += colSpan;
    }

    const totalCell =
      attrIdx === 0 && rowTotals ? (
        <th
          key="total"
          className="pvtTotalLabel"
          rowSpan={colAttrs.length + Math.min(rowAttrs.length, 1)}
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.cols,
            attrIdx,
            this.props.tableOptions.clickColumnHeaderCallback,
            false,
            true,
          )}
        >
          {t('Total (%(aggregatorName)s)', {
            aggregatorName: t(this.props.aggregatorName),
          })}
        </th>
      ) : null;

    const cells = [spaceCell, attrNameCell, ...attrValueCells, totalCell];
    return <tr key={`colAttr-${attrIdx}`}>{cells}</tr>;
  }

  renderRowHeaderRow(pivotSettings: PivotSettings) {
    // Render just the attribute names of the rows (the actual attribute values
    // will show up in the individual rows).

    const {
      rowAttrs,
      colAttrs,
      rowKeys,
      arrowCollapsed,
      arrowExpanded,
      rowSubtotalDisplay,
      maxRowVisible,
      pivotData,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;
    return (
      <tr key="rowHdr">
        {rowAttrs.map((r, i) => {
          const needLabelToggle =
            rowSubtotalDisplay.enabled === true && i !== rowAttrs.length - 1;
          let arrowClickHandle = null;
          let subArrow = null;
          if (needLabelToggle) {
            arrowClickHandle =
              i + 1 < maxRowVisible!
                ? this.collapseAttr(true, i, rowKeys)
                : this.expandAttr(true, i, rowKeys);
            subArrow = i + 1 < maxRowVisible! ? arrowExpanded : arrowCollapsed;
          }
          return (
            <th
              className="pvtAxisLabel"
              key={`rowAttr-${i}`}
              data-mibi-level={i}
              data-mibi-head={i}
            >
              {displayHeaderCell(
                needLabelToggle,
                subArrow,
                arrowClickHandle,
                r,
                namesMapping,
                allowRenderHtml,
              )}
            </th>
          );
        })}
        <th
          className="pvtTotalLabel"
          key="padding"
          data-mibi-level={rowAttrs.length}
          data-mibi-head={rowAttrs.length}
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            [],
            this.props.rows,
            0,
            this.props.tableOptions.clickRowHeaderCallback,
            false,
            true,
          )}
        >
          {colAttrs.length === 0
            ? t('Total (%(aggregatorName)s)', {
                aggregatorName: t(this.props.aggregatorName),
              })
            : null}
        </th>
      </tr>
    );
  }

  renderTableRow(
    rowKey: string[],
    rowIdx: number,
    pivotSettings: PivotSettings,
  ) {
    // Render a single row in the pivot table.

    const {
      rowAttrs,
      colAttrs,
      rowAttrSpans,
      visibleColKeys,
      pivotData,
      rowTotals,
      rowSubtotalDisplay,
      arrowExpanded,
      arrowCollapsed,
      cellCallbacks,
      rowTotalCallbacks,
      namesMapping,
      allowRenderHtml,
    } = pivotSettings;

    const {
      highlightHeaderCellsOnHover,
      omittedHighlightHeaderGroups = [],
      highlightedHeaderCells,
      cellColorFormatters,
      dateFormatters,
      cellBackgroundColor = supersetTheme.colorBgBase,
      cellTextColor = supersetTheme.colorPrimaryText,
      activeHeaderBackgroundColor = supersetTheme.colorPrimaryBg,
    } = this.props.tableOptions;
    const flatRowKey = flatKey(rowKey);

    const colIncrSpan = colAttrs.length !== 0 ? 1 : 0;
    const attrValueCells = rowKey.map((r: string, i: number) => {
      let handleContextMenu: ((e: MouseEvent) => void) | undefined;
      let valueCellClassName = 'pvtRowLabel';
      if (!omittedHighlightHeaderGroups.includes(rowAttrs[i])) {
        if (highlightHeaderCellsOnHover) {
          valueCellClassName += ' hoverable';
        }
        handleContextMenu = (e: MouseEvent) =>
          this.props.onContextMenu(e, undefined, rowKey, {
            [rowAttrs[i]]: r,
          });
      }
      if (
        highlightedHeaderCells &&
        Array.isArray(highlightedHeaderCells[rowAttrs[i]]) &&
        highlightedHeaderCells[rowAttrs[i]].includes(r)
      ) {
        valueCellClassName += ' active';
      }
      const isActiveHeader = valueCellClassName.includes('active');
      const rowSpan =
        this.props.tableOptions.tableFormat?.table_repeat_headers === true ||
        this.props.tableOptions.tableFormat?.table_blank_rows === true
          ? 1
          : rowAttrSpans![rowIdx][i];
      if (rowSpan > 0) {
        const flatRowKey = flatKey(rowKey.slice(0, i + 1));
        const colSpan = 1 + (i === rowAttrs.length - 1 ? colIncrSpan : 0);
        const needRowToggle =
          rowSubtotalDisplay.enabled === true && i !== rowAttrs.length - 1;
        const onArrowClick = needRowToggle
          ? this.toggleRowKey(flatRowKey)
          : null;

        const headerCellFormattedValue =
          dateFormatters?.[rowAttrs[i]]?.(convertToNumberIfNumeric(r)) ?? r;

        const { backgroundColor, color } = getCellColor(
          [rowAttrs[i]],
          headerCellFormattedValue,
          cellColorFormatters,
          isActiveHeader ? activeHeaderBackgroundColor : cellBackgroundColor,
        );
        const config = this.columnConfig([], rowAttrs[i]);
        const style = {
          ...getTableColumnStyle(config, 'header'),
          ...(config.columnWidth !== undefined && {
            minWidth: config.columnWidth,
          }),
          ...(backgroundColor && { backgroundColor }),
          ...(color ? { color } : {}),
        };
        return (
          <th
            key={`rowKeyLabel-${i}`}
            className={valueCellClassName}
            style={style}
            data-mibi-level={i}
            rowSpan={rowSpan}
            colSpan={colSpan}
            role="columnheader button"
            onClick={this.clickHeaderHandler(
              pivotData,
              rowKey,
              this.props.rows,
              i,
              this.props.tableOptions.clickRowHeaderCallback,
            )}
            onContextMenu={handleContextMenu}
          >
            {displayHeaderCell(
              needRowToggle,
              this.state.collapsedRows[flatRowKey]
                ? arrowCollapsed
                : arrowExpanded,
              onArrowClick,
              headerCellFormattedValue,
              namesMapping,
              allowRenderHtml,
              config.urlIcon ??
                this.props.tableOptions.tableFormat
                  ?.table_row_header_url_icon === true,
            )}
          </th>
        );
      }
      return null;
    });

    const stepped =
      rowAttrs.length > 0 &&
      this.props.tableOptions.tableFormat?.table_stepped === true;
    const rawIndent = this.props.tableOptions.tableFormat?.table_stepped_indent;
    const indentation =
      typeof rawIndent === 'number' && Number.isFinite(rawIndent)
        ? Math.max(0, Math.min(100, rawIndent))
        : 16;
    const attrValuePaddingCell =
      !stepped && rowKey.length < rowAttrs.length ? (
        <th
          className="pvtRowLabel pvtSubtotalLabel"
          key="rowKeyBuffer"
          data-mibi-level={rowKey.length}
          colSpan={rowAttrs.length - rowKey.length + colIncrSpan}
          rowSpan={1}
          role="columnheader button"
          onClick={this.clickHeaderHandler(
            pivotData,
            rowKey,
            this.props.rows,
            rowKey.length,
            this.props.tableOptions.clickRowHeaderCallback,
            true,
          )}
        >
          {String(
            this.columnConfig([], rowAttrs[rowKey.length - 1]).subtotalLabel ||
              this.props.tableOptions.tableFormat?.table_row_subtotal_label ||
              t('Subtotal'),
          )}
        </th>
      ) : null;

    if (!visibleColKeys) {
      return null;
    }

    const rowClickHandlers = cellCallbacks[flatRowKey] || {};
    const valueCells = visibleColKeys.map((colKey: string[]) => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator(rowKey, colKey);
      const aggValue = agg.value();

      const keys = [...rowKey, ...colKey];
      const subtotalVisible =
        (rowKey.length === rowAttrs.length ||
          this.props.tableOptions.rowSubTotals ||
          this.state.collapsedRows[flatRowKey]) &&
        (colKey.length === colAttrs.length ||
          this.props.tableOptions.colSubTotals ||
          this.state.collapsedCols[flatColKey]);

      const { backgroundColor, color } = getCellColor(
        keys,
        aggValue,
        cellColorFormatters,
        cellBackgroundColor,
      );

      const config = this.columnConfig(keys);
      const columnStyle = getTableColumnStyle(
        config,
        agg.isSubtotal ? 'subtotal' : 'values',
      );
      const style = agg.isSubtotal
        ? {
            backgroundColor,
            fontWeight: 'bold',
            ...getCustomFontCss(
              this.props.tableOptions.tableFormat?.table_subtotal_font as
                | import('@superset-ui/core').FontStyleValue
                | undefined,
            ),
            color: color ?? cellTextColor,
          }
        : { backgroundColor, color: color ?? cellTextColor };

      return (
        <td
          role="gridcell"
          className={agg.isSubtotal ? 'pvtVal pvtSubtotalValue' : 'pvtVal'}
          key={`pvtVal-${flatColKey}`}
          onClick={rowClickHandlers[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, rowKey)}
          onMouseEnter={e => this.hoverCell(e, colKey, rowKey)}
          onMouseLeave={this.leaveCell}
          style={{
            ...style,
            ...(config.showCellBars === true && { position: 'relative' }),
            color: color ?? columnStyle.color,
            ...columnStyle,
            ...(backgroundColor && { backgroundColor }),
            ...(color && { color }),
            ...(config.columnWidth !== undefined && {
              minWidth: config.columnWidth,
            }),
          }}
        >
          {subtotalVisible &&
            config.showCellBars === true &&
            typeof aggValue === 'number' &&
            this.columnRanges[flatColKey] &&
            (() => {
              const [min, max] = this.columnRanges[flatColKey];
              const span = max - min || 1;
              return (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${((Math.min(0, aggValue) - min) / span) * 100}%`,
                    width: `${(Math.abs(aggValue) / span) * 100}%`,
                    backgroundColor: 'currentColor',
                    opacity: 0.16,
                    pointerEvents: 'none',
                  }}
                />
              );
            })()}
          {subtotalVisible &&
            this.renderValue(
              aggValue,
              this.formatValue(aggValue, agg.format(aggValue, agg), config),
              allowRenderHtml,
              config.urlIcon,
              keys,
            )}
        </td>
      );
    });

    let totalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator(rowKey, []);
      const aggValue = agg.value();
      const config = this.columnConfig(rowKey);
      totalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtTotal"
          style={getTableColumnStyle(config, 'total')}
          onClick={rowTotalCallbacks[flatRowKey]}
          onContextMenu={e => this.props.onContextMenu(e, undefined, rowKey)}
        >
          {this.renderValue(
            aggValue,
            this.formatValue(aggValue, agg.format(aggValue, agg), config),
            allowRenderHtml,
            config.urlIcon,
          )}
        </td>
      );
    }

    const steppedConfig = stepped
      ? this.columnConfig([], rowAttrs[rowKey.length - 1])
      : {};
    const steppedCell = stepped ? (
      <th
        key="stepped"
        className="pvtRowLabel"
        data-mibi-level={0}
        colSpan={rowAttrs.length + colIncrSpan}
        style={{
          ...getTableColumnStyle(steppedConfig, 'header'),
          ...(steppedConfig.columnWidth !== undefined && {
            minWidth: steppedConfig.columnWidth,
          }),
          paddingLeft: Math.max(0, rowKey.length - 1) * indentation + 4,
        }}
        onClick={this.clickHeaderHandler(
          pivotData,
          rowKey,
          this.props.rows,
          rowKey.length - 1,
          this.props.tableOptions.clickRowHeaderCallback,
          rowKey.length < rowAttrs.length,
        )}
        onContextMenu={event =>
          this.props.onContextMenu(event, undefined, rowKey)
        }
      >
        {displayHeaderCell(
          rowKey.length < rowAttrs.length,
          this.state.collapsedRows[flatRowKey] ? arrowCollapsed : arrowExpanded,
          this.toggleRowKey(flatRowKey),
          dateFormatters?.[rowAttrs[rowKey.length - 1]]?.(
            convertToNumberIfNumeric(rowKey[rowKey.length - 1]),
          ) ?? rowKey[rowKey.length - 1],
          namesMapping,
          allowRenderHtml,
          steppedConfig.urlIcon ??
            this.props.tableOptions.tableFormat?.table_row_header_url_icon ===
              true,
        )}
      </th>
    ) : null;
    const format = this.props.tableOptions.tableFormat ?? {};
    const sparklineMetrics = Array.isArray(format.table_sparkline_columns)
      ? format.table_sparkline_columns.filter(
          (metric): metric is string =>
            typeof metric === 'string' &&
            colAttrs.length > 0 &&
            visibleColKeys.some(key => key.includes(metric)) &&
            !rowAttrs.includes(metric),
        )
      : [];
    const sparklineCells = sparklineMetrics.map(metric => (
      <td key={`sparkline-${metric}`}>
        <TabularSparkline
          format={format}
          values={visibleColKeys
            .filter(
              key => key.length === colAttrs.length && key.includes(metric),
            )
            .map(key => pivotData.getAggregator(rowKey, key).value())}
        />
      </td>
    ));
    const rowCells = [
      ...(stepped ? [steppedCell] : attrValueCells),
      attrValuePaddingCell,
      ...valueCells,
      totalCell,
      ...sparklineCells,
    ];

    const blank =
      this.props.tableOptions.tableFormat?.table_blank_rows === true &&
      rowIdx > 0 &&
      pivotSettings.visibleRowKeys?.[rowIdx - 1]?.[0] !== rowKey[0];
    if (!blank) return <tr key={`keyRow-${flatRowKey}`}>{rowCells}</tr>;
    return (
      <Fragment key={`keyRow-${flatRowKey}`}>
        <tr className="pvtBlankRow" aria-hidden="true">
          <td
            colSpan={
              rowAttrs.length +
              colIncrSpan +
              visibleColKeys.length +
              sparklineMetrics.length +
              Number(rowTotals)
            }
          />
        </tr>
        <tr>{rowCells}</tr>
      </Fragment>
    );
  }

  /** Render plain values with an optional safe URL icon. */
  renderValue(
    value: unknown,
    formatted: unknown,
    allowRenderHtml?: boolean,
    urlIcon?: boolean,
    keys: string[] = [],
  ): ReactNode {
    const url =
      (urlIcon ?? this.props.tableOptions.tableFormat?.table_url_icon)
        ? getTableCellUrl(value)
        : undefined;
    const metrics = (this.props.tableOptions.tableFormat?.metrics ??
      []) as import('@superset-ui/core').QueryFormMetric[];
    const metric = metrics
      .map(getMetricLabel)
      .find(name => keys.includes(name));
    const icon = getTabularCellIcon(
      this.props.tableOptions.tableFormat?.table_conditional_icons,
      metric,
      value,
    );
    const content = url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('Open link: %s', String(value))}
        onClick={event => event.stopPropagation()}
      >
        ↗
      </a>
    ) : (
      displayCell(formatted, allowRenderHtml)
    );
    return icon ? (
      <>
        <span aria-hidden="true" style={{ color: icon.color, marginRight: 4 }}>
          {icon.icon}
        </span>
        {content}
      </>
    ) : (
      content
    );
  }

  renderTotalsRow(pivotSettings: PivotSettings) {
    // Render the final totals rows that has the totals for all the columns.

    const {
      rowAttrs,
      colAttrs,
      visibleColKeys,
      rowTotals,
      pivotData,
      colTotalCallbacks,
      grandTotalCallback,
    } = pivotSettings;

    if (!visibleColKeys) {
      return null;
    }

    const totalLabelCell = (
      <th
        key="label"
        className="pvtTotalLabel pvtRowTotalLabel"
        data-mibi-level={0}
        colSpan={rowAttrs.length + Math.min(colAttrs.length, 1)}
        role="columnheader button"
        onClick={this.clickHeaderHandler(
          pivotData,
          [],
          this.props.rows,
          0,
          this.props.tableOptions.clickRowHeaderCallback,
          false,
          true,
        )}
      >
        {t('Total (%(aggregatorName)s)', {
          aggregatorName: t(this.props.aggregatorName),
        })}
      </th>
    );

    const totalValueCells = visibleColKeys.map((colKey: string[]) => {
      const flatColKey = flatKey(colKey);
      const agg = pivotData.getAggregator([], colKey);
      const aggValue = agg.value();
      const config = this.columnConfig(colKey);
      return (
        <td
          role="gridcell"
          className="pvtTotal pvtRowTotal"
          key={`total-${flatColKey}`}
          onClick={colTotalCallbacks[flatColKey]}
          onContextMenu={e => this.props.onContextMenu(e, colKey, undefined)}
          style={{ padding: '5px', ...getTableColumnStyle(config, 'total') }}
        >
          {this.renderValue(
            aggValue,
            this.formatValue(aggValue, agg.format(aggValue, agg), config),
            this.props.allowRenderHtml,
            config.urlIcon,
          )}
        </td>
      );
    });

    let grandTotalCell = null;
    if (rowTotals) {
      const agg = pivotData.getAggregator([], []);
      const aggValue = agg.value();
      grandTotalCell = (
        <td
          role="gridcell"
          key="total"
          className="pvtGrandTotal pvtRowTotal"
          onClick={grandTotalCallback || undefined}
          onContextMenu={e => this.props.onContextMenu(e, undefined, undefined)}
        >
          {displayCell(agg.format(aggValue, agg), this.props.allowRenderHtml)}
        </td>
      );
    }

    const totalCells = [totalLabelCell, ...totalValueCells, grandTotalCell];

    return (
      <tr key="total" className="pvtRowTotals">
        {totalCells}
      </tr>
    );
  }

  visibleKeys(
    keys: string[][],
    collapsed: Record<string, boolean>,
    numAttrs: number,
    subtotalDisplay: SubtotalDisplay,
  ) {
    return keys.filter(
      (key: string[]) =>
        // Is the key hidden by one of its parents?
        !key.some(
          (_k: string, j: number) => collapsed[flatKey(key.slice(0, j))],
        ) &&
        // Leaf key.
        (key.length === numAttrs ||
          // Children hidden. Must show total.
          collapsed[flatKey(key)] === true ||
          // Don't hide totals.
          !subtotalDisplay.hideOnExpand),
    );
  }

  isDashboardEditMode() {
    return document.contains(document.querySelector('.dashboard--editing'));
  }

  /**
   * AuraData BI: with a tooltip page, the cell under the pointer is told to the
   * report through the context menu handler, which the chart renderer reads as
   * a hover while the probe mark is on.
   */
  hoverCell(e: MouseEvent<HTMLElement>, colKey?: string[], rowKey?: string[]) {
    const cell = e.currentTarget;
    if (!cell.closest('[data-mibi-tooltip-page]')) return;
    cell.dataset.mibiProbe = 'true';
    try {
      this.props.onContextMenu(e, colKey, rowKey);
    } finally {
      delete cell.dataset.mibiProbe;
    }
  }

  leaveCell = (e: MouseEvent<HTMLElement>) => {
    if (e.currentTarget.closest('[data-mibi-tooltip-page]')) {
      window.dispatchEvent(new CustomEvent('mibi:mark-leave'));
    }
  };

  freezesRowHeaders() {
    return (
      this.props.tableOptions.tableFormat?.table_freeze_row_headers === true
    );
  }

  /**
   * Gives each level of the row headers the left offset where it stays while
   * the table scrolls sideways: the widths of the levels before it.
   */
  placeFrozenRowHeaders() {
    const table = this.tableRef.current;
    if (!table || !this.freezesRowHeaders()) return;
    let left = 0;
    table
      .querySelectorAll<HTMLElement>('thead th[data-mibi-head]')
      .forEach(head => {
        table.style.setProperty(
          `--mibi-freeze-${head.dataset.mibiHead}`,
          `${left}px`,
        );
        left += head.getBoundingClientRect().width;
      });
  }

  componentDidMount() {
    this.placeFrozenRowHeaders();
  }

  componentDidUpdate() {
    this.placeFrozenRowHeaders();
  }

  componentWillUnmount() {
    this.sortCache.clear();
  }

  render() {
    if (this.cachedProps !== this.props) {
      this.sortCache.clear();
      // Reset sort state without using setState to avoid re-render during render.
      // This is safe because the state is being synchronized with new props.
      (this.state as TableRendererState).sortingOrder = [];
      (this.state as TableRendererState).activeSortColumn = null;
      this.cachedProps = this.props;
      this.cachedBasePivotSettings = this.getBasePivotSettings();
    }
    const basePivotSettings = this.cachedBasePivotSettings!;
    const {
      colAttrs,
      rowAttrs,
      rowKeys,
      colKeys,
      colTotals,
      rowSubtotalDisplay,
      colSubtotalDisplay,
      allowRenderHtml,
    } = basePivotSettings;

    const format = this.props.tableOptions.tableFormat ?? {};
    for (const axis of ['row', 'column'] as const) {
      const depthValue = format[`table_${axis}_expand_depth`];
      const previous =
        axis === 'row' ? this.rowExpansionDepth : this.columnExpansionDepth;
      if (depthValue === previous) continue;
      if (axis === 'row') this.rowExpansionDepth = depthValue;
      else this.columnExpansionDepth = depthValue;
      const depth =
        typeof depthValue === 'number'
          ? Math.max(1, Math.floor(depthValue))
          : undefined;
      const keys = axis === 'row' ? rowKeys : colKeys;
      const count = axis === 'row' ? rowAttrs.length : colAttrs.length;
      const collapsed =
        depth === undefined
          ? {}
          : Object.fromEntries(
              keys
                .filter(key => key.length === depth && key.length < count)
                .map(key => [flatKey(key), true]),
            );
      if (axis === 'row')
        (this.state as TableRendererState).collapsedRows = collapsed;
      else (this.state as TableRendererState).collapsedCols = collapsed;
    }
    const visibleAtLevel = (
      keys: string[][],
      axis: string,
      count: number,
      collapsed: Record<string, boolean>,
    ) => {
      const levels = format[`table_${axis}_subtotal_levels`];
      return !Array.isArray(levels) || !levels.length
        ? keys
        : keys.filter(
            key =>
              key.length === count ||
              levels.includes(String(key.length)) ||
              collapsed[flatKey(key)] ||
              (axis === 'row' && format.table_stepped === true),
          );
    };
    // Need to account for exclusions to compute the effective row
    // and column keys.
    const visibleRowKeys = this.visibleKeys(
      visibleAtLevel(rowKeys, 'row', rowAttrs.length, this.state.collapsedRows),
      this.state.collapsedRows,
      rowAttrs.length,
      rowSubtotalDisplay,
    );
    const visibleColKeys = this.visibleKeys(
      visibleAtLevel(
        colKeys,
        'column',
        colAttrs.length,
        this.state.collapsedCols,
      ),
      this.state.collapsedCols,
      colAttrs.length,
      colSubtotalDisplay,
    );

    const pivotSettings: PivotSettings = {
      visibleRowKeys,
      maxRowVisible: Math.max(...visibleRowKeys.map((k: string[]) => k.length)),
      visibleColKeys,
      maxColVisible: Math.max(...visibleColKeys.map((k: string[]) => k.length)),
      rowAttrSpans: this.calcAttrSpans(visibleRowKeys, rowAttrs.length),
      colAttrSpans: this.calcAttrSpans(visibleColKeys, colAttrs.length),
      allowRenderHtml,
      ...basePivotSettings,
    };

    const sparklineMetrics = Array.isArray(format.table_sparkline_columns)
      ? format.table_sparkline_columns.filter(
          (metric): metric is string =>
            typeof metric === 'string' &&
            visibleColKeys.some(key => key.includes(metric)),
        )
      : [];
    const headerRows = colAttrs.map((c: string, j: number) =>
      this.renderColHeaderRow(c, j, pivotSettings),
    );
    if (rowAttrs.length !== 0)
      headerRows.push(this.renderRowHeaderRow(pivotSettings));
    const renderedHeaders = headerRows.map((row, index) =>
      index === 0 && row ? (
        <tr key="sparkline-header">
          {row.props.children}
          {sparklineMetrics.map(metric => (
            <th key={metric} rowSpan={headerRows.length}>
              {t('Trend: %s', metric)}
            </th>
          ))}
        </tr>
      ) : (
        row
      ),
    );
    const totalRow = colTotals ? this.renderTotalsRow(pivotSettings) : null;
    return (
      <Styles
        isDashboardEditMode={this.isDashboardEditMode()}
        freezeRowHeaders={this.freezesRowHeaders()}
      >
        <table className="pvtTable" role="grid" ref={this.tableRef}>
          <thead>{renderedHeaders}</thead>
          <tbody>
            {visibleRowKeys.map((r: string[], i: number) =>
              this.renderTableRow(r, i, pivotSettings),
            )}
            {totalRow && (
              <tr className="pvtRowTotals">
                {totalRow.props.children}
                {sparklineMetrics.map(metric => (
                  <td key={metric} />
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </Styles>
    );
  }
}

TableRenderer.propTypes = {
  ...PivotData.propTypes,
  tableOptions: PropTypes.object,
  onContextMenu: PropTypes.func,
};
TableRenderer.defaultProps = { ...PivotData.defaultProps, tableOptions: {} };
