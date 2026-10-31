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

const EVENT = 'mibi:format-selection';
const OPEN_EVENT = 'mibi:format-open';
let selected: string | null = null;

/** Layout id of the visual being formatted, or null for the canvas. */
export const selectedVisual = () => selected;

export function selectVisual(id: string | null) {
  if (selected === id) return;
  selected = id;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Selects a visual and asks the builder pane to show the Format tab. */
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

/** Calls back when something asks to open the Format tab. */
export function useOnOpenFormat(callback: () => void) {
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, callback);
    return () => window.removeEventListener(OPEN_EVENT, callback);
  }, [callback]);
}
