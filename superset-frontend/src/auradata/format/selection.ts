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

const EVENT = 'auradata:format-selection';
const OPEN_EVENT = 'auradata:format-open';

/** The object the Format pane edits: the last one picked. */
let selected: string | null = null;
/** The rest of a multiple selection. */
let others: string[] = [];
/** Members of the group an object belongs to (itself included), if any. */
let groupOf: (id: string) => string[] = id => [id];

export const selectedVisual = () => selected;

/** Every object picked, the one the pane edits last. */
export const selectedVisuals = (): string[] =>
  selected ? [...others, selected] : [];

/** Lets the canvas tell which objects are grouped with another. */
export function setGroupResolver(resolver: (id: string) => string[]) {
  groupOf = resolver;
}

const emit = () =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: selected }));

/**
 * Picks an object. With `additive` (shift or ctrl/cmd click) it joins or
 * leaves the current selection; a grouped object brings its group along.
 */
export function selectVisual(id: string | null, additive = false) {
  if (id === null) {
    if (!selected && !others.length) return;
    selected = null;
    others = [];
    emit();
    return;
  }
  const members = groupOf(id);
  if (additive) {
    const all = selectedVisuals();
    if (all.includes(id)) {
      const rest = all.filter(item => !members.includes(item));
      selected = rest.pop() ?? null;
      others = rest;
    } else {
      const merged = [...all, ...members.filter(item => item !== id), id];
      selected = merged.pop() ?? null;
      others = merged;
    }
    emit();
    return;
  }
  // Pressing an object of the current selection keeps it, to move it together
  if (selected === id && others.length === members.length - 1) return;
  if (selectedVisuals().length > 1 && selectedVisuals().includes(id)) {
    others = selectedVisuals().filter(item => item !== id);
    selected = id;
    emit();
    return;
  }
  selected = id;
  others = members.filter(item => item !== id);
  emit();
}

/** Picks exactly these objects, as Ctrl+A does. */
export function selectAllVisuals(ids: string[]) {
  const rest = [...ids];
  selected = rest.pop() ?? null;
  others = rest;
  emit();
}

export function openFormat(id: string | null) {
  selectVisual(id);
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function useSelectedVisual(): string | null {
  const [value, setValue] = useState(selected);
  useEffect(() => {
    const onChange = () => setValue(selected);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}

/** Whether this object is picked: objects only redraw when their answer changes. */
export function useIsVisualSelected(id: string): boolean {
  const [value, setValue] = useState(() => selectedVisuals().includes(id));
  useEffect(() => {
    const onChange = () => setValue(selectedVisuals().includes(id));
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [id]);
  return value;
}

/** Every object picked on the canvas. */
export function useSelectedVisuals(): string[] {
  const [value, setValue] = useState<string[]>(selectedVisuals());
  useEffect(() => {
    const onChange = () => setValue(selectedVisuals());
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}

export function useOnOpenFormat(callback: () => void) {
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, callback);
    return () => window.removeEventListener(OPEN_EVENT, callback);
  }, [callback]);
}
