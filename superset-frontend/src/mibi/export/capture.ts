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
import domToImage from 'dom-to-image-more';
import type { SupersetTheme } from '@apache-superset/core/theme';
import type { RootState } from 'src/dashboard/types';

/** A picture of the dashboard grid plus where pages may break without cutting a visual. */
export interface Capture {
  canvas: HTMLCanvasElement;
  /** Pixels of the canvas per CSS pixel of the dashboard. */
  scale: number;
  /** Canvas y positions between visuals, ascending, ending with the height. */
  breaks: number[];
}

type DomToCanvas = (
  node: Node,
  options: {
    bgcolor?: string;
    width?: number;
    height?: number;
    scale?: number;
    cacheBust?: boolean;
    filter?: (node: Node) => boolean;
    onclone?: (clone: Node) => void;
    imagePlaceholder?: string;
  },
) => Promise<HTMLCanvasElement>;

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, ms);
  });

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const SETTLE_POLL_MS = 150;
const SETTLE_MAX_MS = 20000;
// ECharts animates for about a second after the data arrives
const ANIMATION_MS = 1100;

/**
 * Whether a visual on screen is loading. Charts of other tabs, or never
 * rendered, can stay "loading" in the store forever: only the ones shown in
 * ``root`` count.
 */
export const anyChartLoading = (state: RootState, root: Element | null) => {
  if (!root) return false;
  if (root.querySelector('[data-test="loading-indicator"]')) {
    const spinners = Array.from(
      root.querySelectorAll<HTMLElement>('[data-test="loading-indicator"]'),
    );
    if (spinners.some(spinner => spinner.getClientRects().length > 0)) {
      return true;
    }
  }
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-test-chart-id]'),
  ).some(element => {
    if (!element.getClientRects().length) return false;
    const id = Number(element.getAttribute('data-test-chart-id'));
    return state.charts?.[id]?.chartStatus === 'loading';
  });
};

/**
 * Resolves once no visual on screen is loading, and once the charts that
 * just loaded ended their animation.
 */
export async function waitForCharts(
  getState: () => RootState,
  root: Element | null,
  {
    animate = false,
  }: {
    /** Wait for animations even if nothing loaded, as after showing a tab */
    animate?: boolean;
  } = {},
): Promise<void> {
  const deadline = Date.now() + SETTLE_MAX_MS;
  let quiet = 0;
  let loaded = false;
  // A visual may start loading right after a tab switch or a scroll
  while (quiet < 2 && Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(SETTLE_POLL_MS);
    if (anyChartLoading(getState(), root)) {
      loaded = true;
      quiet = 0;
    } else {
      quiet += 1;
    }
  }
  if (loaded || animate) await sleep(ANIMATION_MS);
}

/**
 * Scrolls through the page so visuals rendered only near the viewport load,
 * then returns to the top.
 */
export async function loadWholePage(
  getState: () => RootState,
  root: Element | null,
): Promise<void> {
  const step = window.innerHeight;
  const height = document.documentElement.scrollHeight;
  if (height <= step) return;
  for (let y = step; y < height; y += step) {
    window.scrollTo(0, y);
    // eslint-disable-next-line no-await-in-loop
    await waitForCharts(getState, root);
  }
  window.scrollTo(0, 0);
  // Charts drawn during the scroll animate once, all at the same time
  await waitForCharts(getState, root, { animate: true });
}

/** Y offsets, relative to root, where no visual is cut. */
function safeBreaks(root: HTMLElement): number[] {
  const box = root.getBoundingClientRect();
  // A zoomed canvas measures smaller on screen than in its own pixels
  const unzoom = box.height ? root.offsetHeight / box.height : 1;
  const spansOf = (selector: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(selector))
      .map(el => {
        const rect = el.getBoundingClientRect();
        return [
          (rect.top - box.top) * unzoom,
          (rect.bottom - box.top) * unzoom,
        ] as const;
      })
      .filter(([start, end]) => end > start);
  const visuals = spansOf('.dashboard-component-chart-holder');
  const rows = spansOf('.grid-row');
  const candidates = Array.from(
    new Set([...visuals, ...rows].map(([, end]) => Math.round(end))),
  ).sort((a, b) => a - b);
  return candidates.filter(
    y => !visuals.some(([start, end]) => start < y - 1 && end > y + 1),
  );
}

const toDataUrl = async (url: string) => {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

let fontCss: Promise<string> | undefined;

/** Cross origin stylesheets, linked or @imported, whose rules the page cannot read. */
const foreignStylesheets = () => {
  const linked = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
  ).map(link => link.href);
  const imported = Array.from(document.querySelectorAll('style')).flatMap(
    style =>
      Array.from(
        (style.textContent ?? '').matchAll(
          /@import\s+url\((['"]?)(https?:[^'")]+)\1\)/g,
        ),
      ).map(match => match[2]),
  );
  return Array.from(new Set([...linked, ...imported])).filter(
    href =>
      new URL(href, window.location.href).origin !== window.location.origin,
  );
};

/** Keeps the Latin subsets of a Google Fonts stylesheet, which is all the UI shows. */
const latinFaces = (css: string) => {
  const blocks = css.split(/(?=\/\*[^*]*\*\/\s*@font-face)/);
  const latin = blocks.filter(block =>
    /^\/\*\s*latin(-ext)?\s*\*\//.test(block),
  );
  return latin.length ? latin.join('\n') : css;
};

/**
 * The @font-face rules of cross origin stylesheets (such as Google Fonts) with
 * the font files inlined, which the capture cannot read by itself.
 */
function embeddedWebFonts(): Promise<string> {
  fontCss ??= Promise.all(
    foreignStylesheets().map(async href => {
      try {
        let css = latinFaces(await (await fetch(href)).text());
        const urls = Array.from(
          new Set(
            Array.from(css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)).map(
              match => match[2],
            ),
          ),
        );
        const inlined = await Promise.all(
          urls.map(url => toDataUrl(new URL(url, href).href)),
        );
        urls.forEach((url, index) => {
          css = css.split(url).join(inlined[index]);
        });
        return css;
      } catch {
        return '';
      }
    }),
  ).then(parts => parts.join('\n'));
  return fontCss;
}

/** Takes a picture of the dashboard grid, as shown on screen. */
export async function captureDashboard(
  theme: SupersetTheme,
  scale = 2,
  selector = '.dashboard',
): Promise<Capture> {
  const root = document.querySelector<HTMLElement>(selector);
  if (!root) throw new Error('Dashboard not found');
  const cssBreaks = safeBreaks(root);
  const fonts = await embeddedWebFonts();
  const width = root.scrollWidth;
  // Stop below the last visual instead of at the end of the page's empty space
  const height = Math.min(
    root.scrollHeight,
    cssBreaks.length
      ? Math.ceil(Math.max(...cssBreaks)) + 16
      : window.innerHeight,
  );
  const { toCanvas } = domToImage as unknown as { toCanvas: DomToCanvas };
  const canvas = await toCanvas(root, {
    bgcolor: theme.colorBgLayout,
    width,
    height,
    scale,
    cacheBust: true,
    // A picture that fails to load must not fail the whole export
    imagePlaceholder: TRANSPARENT_PIXEL,
    onclone: clone => {
      // A fixed size canvas is zoomed to fit the screen: capture it at its size
      if (clone instanceof HTMLElement) clone.style.setProperty('zoom', '1');
      const style = document.createElement('style');
      // Text measures differ slightly in the picture: keep chart titles on one line
      style.textContent = `${fonts}
        .header-title, .header-title * {
          white-space: nowrap !important;
          max-height: none !important;
        }`;
      clone.appendChild(style);
    },
    filter: node =>
      !(
        node instanceof HTMLElement &&
        (node.classList.contains('header-controls') ||
          node.classList.contains('mapboxgl-control-container') ||
          node.classList.contains('ant-tabs-tabpane-hidden'))
      ),
  });
  const ratio = canvas.height / height || scale;
  const breaks = cssBreaks
    .map(y => Math.round(y * ratio))
    .filter(y => y > 0 && y < canvas.height);
  breaks.push(canvas.height);
  return { canvas, scale: ratio, breaks };
}

export interface AppliedFilter {
  label: string;
  value: string;
}

const valueText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(valueText).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/** The native filters that hold a value, as label and readable value. */
export function appliedFilters(state: RootState): AppliedFilter[] {
  const filters = state.nativeFilters?.filters ?? {};
  return Object.values(filters).flatMap(filter => {
    if (!filter || !('name' in filter)) return [];
    const filterState = state.dataMask?.[filter.id]?.filterState;
    const value =
      valueText(filterState?.label) || valueText(filterState?.value);
    return value ? [{ label: String(filter.name), value }] : [];
  });
}
