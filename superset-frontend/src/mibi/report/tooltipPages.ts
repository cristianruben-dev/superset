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
import type { QueryFormData } from '@superset-ui/core';
import type { DashboardLayout } from 'src/dashboard/types';
import { CHART_TYPE, MARKDOWN_TYPE } from 'src/dashboard/util/componentTypes';
import { posOf } from 'src/mibi/format/positions';
import type { VisualTooltipPage } from 'src/mibi/format/types';
import {
  topLevelTabs,
  type DashboardTab,
} from 'src/mibi/present/dashboardTabs';
import type { DrillthroughField } from './drillthroughScope';
import {
  DEFAULT_TOOLTIP_PAGE,
  TOOLTIP_PAGE_KEY,
  type TooltipPage,
} from './types';

export * from './markHover';

/**
 * Tooltip pages, as in Power BI: a small page of the report that shows,
 * floating, over the mark under the pointer, filtered to the values of that
 * mark. A chart picks one in General › Tooltips, or leaves the choice to the
 * fields the page and the chart have in common.
 */

export interface TooltipTarget {
  tab: DashboardTab;
  page: TooltipPage;
}

const whole = (value: unknown, fallback: number, max = 60) =>
  Number.isFinite(value)
    ? Math.min(max, Math.max(2, Math.round(value as number)))
    : fallback;

/** The tooltip settings of a page, with defaults; undefined for other pages. */
export function tooltipPageOf(
  meta: Record<string, unknown> | undefined,
): TooltipPage | undefined {
  const raw = meta?.[TOOLTIP_PAGE_KEY] as Partial<TooltipPage> | undefined;
  if (!raw) return undefined;
  return {
    width: whole(raw.width, DEFAULT_TOOLTIP_PAGE.width),
    height: whole(raw.height, DEFAULT_TOOLTIP_PAGE.height),
    columns: Array.isArray(raw.columns) ? raw.columns.map(String) : [],
  };
}

/** The pages of the report that are tooltips, in order. */
export function tooltipPages(layout: DashboardLayout): TooltipTarget[] {
  return topLevelTabs(layout).flatMap(tab => {
    const page = tooltipPageOf(layout[tab.id]?.meta);
    return page ? [{ tab, page }] : [];
  });
}

const DIMENSION_KEYS = [
  'x_axis',
  'groupby',
  'columns',
  'series',
  'entity',
  'granularity_sqla',
  'groupbyColumns',
  'groupbyRows',
];

/** The plain columns a chart splits its marks by. */
export function chartDimensions(
  formData: Record<string, unknown> | undefined,
): string[] {
  const names = new Set<string>();
  DIMENSION_KEYS.forEach(key => {
    const value = formData?.[key];
    (Array.isArray(value) ? value : [value]).forEach(item => {
      if (typeof item === 'string' && item) names.add(item);
    });
  });
  return [...names];
}

/**
 * The page a chart shows as tooltip: the one it names, or with "Auto" the
 * tooltip page whose fields the chart has, the most of them winning.
 */
export function resolveTooltipPage(
  layout: DashboardLayout,
  setting: VisualTooltipPage | undefined,
  dimensions: string[],
): string | undefined {
  if (setting?.type !== 'page') return undefined;
  const pages = tooltipPages(layout);
  if (setting.page) {
    return pages.some(({ tab }) => tab.id === setting.page)
      ? setting.page
      : undefined;
  }
  let best: TooltipTarget | undefined;
  pages.forEach(target => {
    const { columns } = target.page;
    if (!columns.length || !columns.every(col => dimensions.includes(col))) {
      return;
    }
    if (!best || columns.length > best.page.columns.length) best = target;
  });
  return best?.tab.id;
}

export interface TooltipObject {
  id: string;
  type: string;
  chartId?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Charts and text boxes of a tooltip page that reach its tooltip area, in
 * cells, the lower ones first.
 */
export function tooltipObjects(
  layout: DashboardLayout,
  tabId: string,
  page: TooltipPage,
): TooltipObject[] {
  return Object.values(layout)
    .filter(
      item =>
        (item.type === CHART_TYPE || item.type === MARKDOWN_TYPE) &&
        item.parents?.includes(tabId) &&
        !item.meta?.mibiHidden,
    )
    .flatMap(item => {
      const pos = posOf(item.meta);
      if (!pos || pos.x >= page.width || pos.y >= page.height) return [];
      return [
        {
          id: item.id,
          type: item.type,
          chartId:
            item.type === CHART_TYPE ? Number(item.meta.chartId) : undefined,
          x: pos.x,
          y: pos.y,
          width: Math.max(1, Number(item.meta.width) || 1),
          height: Math.max(1, Number(item.meta.height) || 1),
          z: Number(item.meta.mibiZ) || 0,
        },
      ];
    })
    .sort((a, b) => a.z - b.z)
    .map(({ z: _z, ...object }) => object);
}

/**
 * The form data of a chart with the values of a mark as filters on top, only
 * for the columns its dataset has (all of them when the columns are unknown).
 */
export function withMarkFilters(
  formData: QueryFormData,
  fields: DrillthroughField[],
  datasetColumns?: Set<string>,
): QueryFormData {
  const usable = fields.filter(
    field => !datasetColumns?.size || datasetColumns.has(field.column),
  );
  if (!usable.length) return formData;
  const extra = (formData.extra_form_data ?? {}) as NonNullable<
    QueryFormData['extra_form_data']
  >;
  return {
    ...formData,
    extra_form_data: {
      ...extra,
      filters: [
        ...(extra.filters ?? []),
        ...usable.map(field => ({
          col: field.column,
          op: 'IN' as const,
          val: [field.value] as (string | number | boolean)[],
        })),
      ],
    },
  };
}

/** Same values, same text: the key of a query in the tooltip cache. */
export function tooltipQueryKey(
  chartId: number,
  formData: QueryFormData,
): string {
  return `${chartId}:${JSON.stringify(formData)}`;
}

/** A stable text for the values of a mark, to tell one mark from another. */
export const markKey = (fields: DrillthroughField[]) =>
  JSON.stringify(
    [...fields]
      .sort((a, b) => a.column.localeCompare(b.column))
      .map(field => [field.column, field.value]),
  );

interface CacheEntry<T> {
  promise: Promise<T>;
  controller: AbortController;
  settled: boolean;
  aborted?: boolean;
}

/** What a query cancelled by `abortPending` rejects with. */
export const QUERY_ABORTED = new Error('Tooltip query aborted');

/**
 * Queries of tooltip charts by key. A key asked again shares the request in
 * flight or its result; `abortPending` cancels what has not answered yet and
 * forgets it, so an aborted query is never served.
 */
export class TooltipQueryCache<T> {
  private entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly size = 100) {}

  get(key: string, load: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached) {
      // Most recently used last
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.promise;
    }
    const controller = new AbortController();
    const entry: CacheEntry<T> = {
      controller,
      settled: false,
      promise: load(controller.signal).then(
        result => {
          entry.settled = true;
          return result;
        },
        error => {
          // Failures are asked again next time
          if (this.entries.get(key) === entry) this.entries.delete(key);
          throw entry.aborted ? QUERY_ABORTED : error;
        },
      ),
    };
    this.entries.set(key, entry);
    while (this.entries.size > this.size) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.get(oldest)?.controller.abort();
      this.entries.delete(oldest);
    }
    return entry.promise;
  }

  has(key: string): boolean {
    return this.entries.get(key)?.settled ?? false;
  }

  /** Cancels the queries still running, except those of ``keep``. */
  abortPending(keep: Set<string> = new Set()) {
    this.entries.forEach((entry, key) => {
      if (!entry.settled && !keep.has(key)) {
        entry.aborted = true;
        entry.controller.abort();
        this.entries.delete(key);
      }
    });
  }

  clear() {
    this.entries.forEach(entry => entry.controller.abort());
    this.entries.clear();
  }
}

/** Room kept between the pointer and the tooltip, and from the screen edge. */
const OFFSET = 16;

/** Where the tooltip goes: beside the pointer, flipped to stay on screen. */
export function tooltipPosition(
  pointer: { x: number; y: number },
  size: { width: number; height: number },
  screen: { width: number; height: number },
): { left: number; top: number } {
  let left = pointer.x + OFFSET;
  let top = pointer.y + OFFSET;
  if (left + size.width > screen.width - 4) {
    left = pointer.x - OFFSET - size.width;
  }
  if (top + size.height > screen.height - 4) {
    top = pointer.y - OFFSET - size.height;
  }
  return { left: Math.max(4, left), top: Math.max(4, top) };
}
