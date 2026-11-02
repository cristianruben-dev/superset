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

/** Panes of the dashboard editor that fold into a rail, as in Power BI. */
export type PaneName = 'builder';

const KEY = 'mibi.panes';
const EVENT = 'mibi:panes';

function read(): Record<PaneName, boolean> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? 'null');
    return { builder: !!raw?.builder };
  } catch {
    return { builder: false };
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

export function usePaneCollapsed(pane: PaneName): boolean {
  const [value, setValue] = useState(collapsed[pane]);
  useEffect(() => {
    const onChange = () => setValue(collapsed[pane]);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, [pane]);
  return value;
}

/** Width of the editor docked beside the report; 0 while it is closed. */
let dockWidth = 0;

export const DOCK_EVENT = 'mibi:dock';

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
