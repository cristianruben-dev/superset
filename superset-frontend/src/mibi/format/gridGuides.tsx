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
import { CELL } from './types';
import { withOpacity } from './styles';

/**
 * The grid edit mode draws behind the visuals: lines around square cells of
 * CELL pixels, the same cells objects are placed and sized in. Its color and
 * strength are a preference of each editor, kept in the browser, so they
 * never change the dashboard.
 */
export interface GridSettings {
  /** CSS color; the theme's primary color when missing */
  color?: string;
  /** 0 to 100 */
  opacity: number;
}

export const DEFAULT_GRID: GridSettings = {
  opacity: 30,
};

const KEY = 'mibi.grid';
const EVENT = 'mibi:grid';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The stored settings, repaired: a bad value falls back to the default. */
export function readGrid(): GridSettings {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        color: typeof raw.color === 'string' ? raw.color : undefined,
        opacity: Number.isFinite(raw.opacity)
          ? clamp(raw.opacity, 5, 100)
          : DEFAULT_GRID.opacity,
      };
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

/** The CSS backgrounds that draw the lines of the cells. */
export function gridBackground(
  settings: GridSettings,
  color: string,
): CSSProperties {
  const line = withOpacity(color, settings.opacity);
  return {
    backgroundImage: `linear-gradient(to right, ${line} 0 1px, transparent 1px), linear-gradient(to bottom, ${line} 0 1px, transparent 1px)`,
    backgroundSize: `${CELL}px ${CELL}px`,
    // The lines that close the last column and row
    boxShadow: `inset -1px -1px 0 ${line}`,
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
export function GridGuide() {
  const theme = useTheme();
  const [settings] = useGridSettings();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const pageBottom = usePageBottom(element);
  return (
    <div
      ref={setElement}
      className="mibi-grid-guide"
      aria-hidden
      data-test="mibi-grid-guide"
      style={{
        ...gridBackground(settings, settings.color || theme.colorPrimary),
        minHeight: pageBottom || undefined,
      }}
    />
  );
}
