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
import type { LayoutItemMeta } from 'src/dashboard/types';

/**
 * Locking objects: one object keeps `meta.auradataLocked` in the report, and "Lock
 * objects" in the View ribbon locks the whole page for this editor, a
 * preference kept in the browser. A locked object cannot be moved, resized or
 * removed.
 */
const KEY = 'auradata.lockAll';
const EVENT = 'auradata:lock-all';

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let allLocked = read();

export const areAllLocked = () => allLocked;

export function setAllLocked(value: boolean) {
  if (allLocked === value) return;
  allLocked = value;
  try {
    window.localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // The preference lasts until the page reloads
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useAllLocked(): boolean {
  const [value, setValue] = useState(allLocked);
  useEffect(() => {
    const onChange = () => setValue(allLocked);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}

export const isObjectLocked = (meta: LayoutItemMeta | undefined) =>
  allLocked || !!meta?.auradataLocked;

export function useObjectLocked(meta: LayoutItemMeta | undefined): boolean {
  return useAllLocked() || !!meta?.auradataLocked;
}
