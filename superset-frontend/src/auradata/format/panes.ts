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

/**
 * Panes of the dashboard editor, side by side as in Power BI: each one folds
 * into a narrow strip of its own. `builder` is the Format pane, which also
 * shows the galleries of charts and elements.
 */
export type PaneName =
  | 'builder'
  | 'data'
  | 'selection'
  | 'bookmarks'
  | 'assistant';

export const PANE_NAMES: PaneName[] = [
  'builder',
  'data',
  'selection',
  'bookmarks',
  'assistant',
];

/** Width of an open pane, and of the strip a folded one leaves. */
export const PANE_WIDTHS: Record<PaneName, number> = {
  builder: 330,
  data: 260,
  selection: 280,
  bookmarks: 280,
  assistant: 340,
};
export const FOLDED_PANE_WIDTH = 32;

const KEY = 'auradata.panes';
const EVENT = 'auradata:panes';

// The Format pane starts open and the others folded
const FOLDED_BY_DEFAULT: Record<PaneName, boolean> = {
  builder: false,
  data: true,
  selection: true,
  bookmarks: true,
  assistant: true,
};

function read(): Record<PaneName, boolean> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return Object.fromEntries(
      PANE_NAMES.map(pane => [
        pane,
        typeof raw?.[pane] === 'boolean' ? raw[pane] : FOLDED_BY_DEFAULT[pane],
      ]),
    ) as Record<PaneName, boolean>;
  } catch {
    return { ...FOLDED_BY_DEFAULT };
  }
}

/** Which panes are folded: a preference of the viewer, kept in the browser. */
let collapsed = read();

export const isPaneCollapsed = (pane: PaneName) => collapsed[pane];

export function setPaneCollapsed(pane: PaneName, value: boolean) {
  if (collapsed[pane] === value) return;
  collapsed = { ...collapsed, [pane]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(collapsed));
  } catch {
    // Not saving the preference is harmless
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Folds every open pane, returning them so they can open again. */
export function foldPanes(): PaneName[] {
  const open = PANE_NAMES.filter(pane => !collapsed[pane]);
  open.forEach(pane => setPaneCollapsed(pane, true));
  return open;
}

export function unfoldPanes(panes: PaneName[]) {
  panes.forEach(pane => setPaneCollapsed(pane, false));
}

/** Which panes are folded, by name. */
export function usePanesCollapsed(): Record<PaneName, boolean> {
  const [value, setValue] = useState(collapsed);
  useEffect(() => {
    const onChange = () => setValue(collapsed);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}

export function usePaneCollapsed(pane: PaneName): boolean {
  return usePanesCollapsed()[pane];
}

/** Width of the panes beside the report: open ones and the folded strips. */
export const panesWidth = (
  folded: Record<PaneName, boolean>,
  panes: PaneName[] = PANE_NAMES,
) =>
  panes.reduce(
    (sum, pane) => sum + (folded[pane] ? FOLDED_PANE_WIDTH : PANE_WIDTHS[pane]),
    0,
  );

/** The tabs of the editor panes. */
export type BuilderTab =
  | 'CHARTS'
  | 'LAYOUT_ELEMENTS'
  | 'FORMAT'
  | 'SELECTION'
  | 'BOOKMARKS'
  | 'ASSISTANT';

/** The pane a tab shows in: the galleries take the place of the Format pane. */
export const paneOfTab = (tab: BuilderTab): PaneName =>
  tab === 'SELECTION'
    ? 'selection'
    : tab === 'BOOKMARKS'
      ? 'bookmarks'
      : tab === 'ASSISTANT'
        ? 'assistant'
        : 'builder';

const TAB_EVENT = 'auradata:builder-tab';
/** The tab opened last, and what the Format pane shows: itself or a gallery. */
let builderTab: BuilderTab = 'FORMAT';
let formatTab: BuilderTab = 'FORMAT';

export function setBuilderTab(tab: BuilderTab) {
  const nextFormatTab = paneOfTab(tab) === 'builder' ? tab : formatTab;
  if (builderTab === tab && formatTab === nextFormatTab) return;
  builderTab = tab;
  // The galleries stay in the Format pane while another pane opens beside it
  formatTab = nextFormatTab;
  window.dispatchEvent(new CustomEvent(TAB_EVENT));
}

export const getBuilderTab = () => builderTab;

/** Shows a tab of the editor, unfolding its pane. */
export function openBuilderTab(tab: BuilderTab) {
  setBuilderTab(tab);
  setPaneCollapsed(paneOfTab(tab), false);
}

/** Whether a tab is in sight: its pane open, and in the Format pane, chosen. */
export const isTabShown = (
  tab: BuilderTab,
  folded: Record<PaneName, boolean>,
  shownInFormat: BuilderTab,
) =>
  !folded[paneOfTab(tab)] &&
  (paneOfTab(tab) !== 'builder' || shownInFormat === tab);

function useTabValue(read: () => BuilderTab): BuilderTab {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const onChange = () => setValue(read());
    window.addEventListener(TAB_EVENT, onChange);
    onChange();
    return () => window.removeEventListener(TAB_EVENT, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export const useBuilderTab = () => useTabValue(() => builderTab);

/** What the Format pane shows: `FORMAT`, `CHARTS` or `LAYOUT_ELEMENTS`. */
export const useFormatPaneTab = () => useTabValue(() => formatTab);

/** Width the editor panes take beside the report, as they last drew. */
let editorPanesWidth = 0;

const PANES_WIDTH_EVENT = 'auradata:panes-width';

export function setEditorPanesWidth(value: number) {
  if (editorPanesWidth === value) return;
  editorPanesWidth = value;
  window.dispatchEvent(new CustomEvent(PANES_WIDTH_EVENT));
}

export function useEditorPanesWidth(): number {
  const [value, setValue] = useState(editorPanesWidth);
  useEffect(() => {
    const onChange = () => setValue(editorPanesWidth);
    window.addEventListener(PANES_WIDTH_EVENT, onChange);
    onChange();
    return () => window.removeEventListener(PANES_WIDTH_EVENT, onChange);
  }, []);
  return value;
}

/** Width of the editor docked beside the report; 0 while it is closed. */
let dockWidth = 0;

export const DOCK_EVENT = 'auradata:dock';

export function setDockWidth(value: number) {
  if (dockWidth === value) return;
  dockWidth = value;
  window.dispatchEvent(new CustomEvent(DOCK_EVENT));
}

export function useDockWidth(): number {
  const [value, setValue] = useState(dockWidth);
  useEffect(() => {
    const onChange = () => setValue(dockWidth);
    window.addEventListener(DOCK_EVENT, onChange);
    onChange();
    return () => window.removeEventListener(DOCK_EVENT, onChange);
  }, []);
  return value;
}
