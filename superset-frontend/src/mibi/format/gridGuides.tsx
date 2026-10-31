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
import { useEffect, useState, type CSSProperties } from 'react';
import { useTheme } from '@apache-superset/core/theme';
import { withOpacity } from './styles';

/**
 * The grid edit mode draws behind the visuals. Its look is a preference of
 * each editor, kept in the browser, so it never changes the dashboard.
 *
 * Columns are the dashboard's layout columns (see columns.ts), the ones visuals snap to
 * when resized; rows only guide heights, which snap every GRID_BASE_UNIT.
 */
export type GridStyle = 'lines' | 'dots' | 'columns';

export interface GridSettings {
  show: boolean;
  style: GridStyle;
  /** Rows as tall as a column and its gap is wide, so cells are square */
  square: boolean;
  /** Height of a grid row, in pixels */
  spacing: number;
  /** CSS color; the theme's primary color when missing */
  color?: string;
  /** 0 to 100 */
  opacity: number;
}

export const DEFAULT_GRID: GridSettings = {
  show: true,
  style: 'lines',
  square: true,
  spacing: 32,
  opacity: 50,
};

const KEY = 'mibi.grid';
const LEGACY_KEY = 'mibi.showGrid';
const EVENT = 'mibi:grid';
const STYLES: GridStyle[] = ['lines', 'dots', 'columns'];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The stored settings, repaired: a bad value falls back to the default. */
export function readGrid(): GridSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        show: typeof raw.show === 'boolean' ? raw.show : DEFAULT_GRID.show,
        style: STYLES.includes(raw.style) ? raw.style : DEFAULT_GRID.style,
        square:
          typeof raw.square === 'boolean' ? raw.square : DEFAULT_GRID.square,
        spacing: Number.isFinite(raw.spacing)
          ? clamp(Math.round(raw.spacing / 8) * 8, 8, 96)
          : DEFAULT_GRID.spacing,
        color: typeof raw.color === 'string' ? raw.color : undefined,
        opacity: Number.isFinite(raw.opacity)
          ? clamp(raw.opacity, 5, 100)
          : DEFAULT_GRID.opacity,
      };
    }
    if (window.localStorage.getItem(LEGACY_KEY) === 'false') {
      return { ...DEFAULT_GRID, show: false };
    }
  } catch {
    // unreadable storage: the default grid
  }
  return DEFAULT_GRID;
}

/** The grid settings of this editor, and a setter that merges changes. */
export function useGridSettings(): [
  GridSettings,
  (patch: Partial<GridSettings>) => void,
] {
  const [value, setValue] = useState(readGrid);
  useEffect(() => {
    const onChange = () => setValue(readGrid());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  const update = (patch: Partial<GridSettings>) => {
    const next = { ...readGrid(), ...patch };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // the settings last until the page reloads
    }
    setValue(next);
    window.dispatchEvent(new CustomEvent(EVENT));
  };
  return [value, update];
}

/** Whether edit mode shows the grid. */
export function useShowGrid(): [boolean, (value: boolean) => void] {
  const [settings, update] = useGridSettings();
  return [settings.show, show => update({ show })];
}

/**
 * The CSS backgrounds that draw the grid over a content ``columnWidth``
 * pixels per column with ``gutter`` pixels between columns.
 */
export function gridBackground(
  settings: GridSettings,
  columnWidth: number,
  gutter: number,
  color: string,
): CSSProperties {
  const width = Math.max(1, columnWidth);
  const period = width + gutter;
  const rowHeight = settings.square ? period : settings.spacing;
  const line = withOpacity(color, settings.opacity);
  const fill = withOpacity(color, settings.opacity * 0.25);
  // Objects meet in the middle of the gap between columns: one line there
  const seam = width + gutter / 2;
  const seams = `linear-gradient(to right, transparent 0 ${seam - 0.5}px, ${line} ${
    seam - 0.5
  }px ${seam + 0.5}px, transparent ${seam + 0.5}px)`;
  const band = `linear-gradient(to right, ${fill} 0 ${width}px, transparent ${width}px)`;
  const rows = `linear-gradient(to bottom, ${line} 0 1px, transparent 1px)`;
  const dots = `radial-gradient(circle at ${seam}px 1px, ${line} 1.5px, transparent 2px)`;
  const columnSize = `${period}px 100%`;

  if (settings.style === 'columns') {
    return { backgroundImage: band, backgroundSize: columnSize };
  }
  if (settings.style === 'dots') {
    return {
      backgroundImage: dots,
      backgroundSize: `${period}px ${rowHeight}px`,
    };
  }
  return {
    backgroundImage: `${seams}, ${rows}`,
    backgroundSize: `${columnSize}, 100% ${rowHeight}px`,
  };
}

/**
 * How far below the top of ``element`` the page it sits on ends, in canvas
 * pixels, so the grid covers the whole page and not only the visuals.
 */
function usePageBottom(element: HTMLElement | null): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    const page = element?.closest<HTMLElement>('.mibi-canvas');
    if (!element || !page || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const measure = () => {
      const pageBox = page.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      // A fixed size page is zoomed to fit: measure in its own pixels
      const unzoom = pageBox.height ? page.offsetHeight / pageBox.height : 1;
      const padding = parseFloat(getComputedStyle(page).paddingBottom) || 0;
      setBottom(
        Math.max(0, Math.round((pageBox.bottom - box.top) * unzoom - padding)),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    return () => observer.disconnect();
  }, [element]);
  return bottom;
}

/** The grid behind the visuals of the dashboard being edited. */
export function GridGuide({
  columnWidth,
  gutter,
}: {
  columnWidth: number;
  gutter: number;
}) {
  const theme = useTheme();
  const [settings] = useGridSettings();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const pageBottom = usePageBottom(element);
  if (!settings.show) return null;
  return (
    <div
      ref={setElement}
      className="mibi-grid-guide"
      aria-hidden
      data-test="mibi-grid-guide"
      style={{
        ...gridBackground(
          settings,
          columnWidth,
          gutter,
          settings.color || theme.colorPrimary,
        ),
        minHeight: pageBottom || undefined,
      }}
    />
  );
}
