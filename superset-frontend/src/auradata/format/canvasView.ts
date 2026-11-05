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
 * How the report is shown on screen: fitted to the width or to the whole
 * page, or at a zoom the viewer chose. A viewer preference, kept in the
 * browser: it is not part of the report.
 */
export type CanvasViewMode = 'fit-width' | 'fit-page' | 'custom';

export interface CanvasView {
  mode: CanvasViewMode;
  /** The zoom of the `custom` mode */
  zoom: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

const KEY = 'auradata.canvasView';
const EVENT = 'auradata:canvas-view';
const DEFAULT: CanvasView = { mode: 'fit-width', zoom: 1 };

export const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(zoom) ? zoom : 1));

function read(): CanvasView {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    if (
      raw &&
      ['fit-width', 'fit-page', 'custom'].includes(raw.mode) &&
      Number.isFinite(raw.zoom)
    ) {
      return { mode: raw.mode, zoom: clampZoom(raw.zoom) };
    }
  } catch {
    // The browser may not give storage: the default view applies
  }
  return DEFAULT;
}

let current: CanvasView = read();

export const canvasView = () => current;

export function setCanvasView(next: Partial<CanvasView>) {
  const merged = {
    ...current,
    ...next,
    zoom: clampZoom(next.zoom ?? current.zoom),
  };
  if (merged.mode === current.mode && merged.zoom === current.zoom) return;
  current = merged;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not saving the preference is harmless
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useCanvasView(): CanvasView {
  const [value, setValue] = useState(current);
  useEffect(() => {
    const onChange = () => setValue(current);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}
