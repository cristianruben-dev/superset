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
import { useLayoutEffect, useState } from 'react';

let slot: HTMLElement | null = null;
const listeners = new Set<() => void>();

/** The first row of the window, where the menu bar of the page goes. */
export function setMenuBarSlot(element: HTMLElement | null) {
  slot = element;
  listeners.forEach(listener => listener());
}

/**
 * Where a report puts its menu bar: the first row of the window, above the top
 * bar. Null without the application frame (standalone, embedded).
 */
export function useMenuBarSlot(): HTMLElement | null {
  const [current, setCurrent] = useState(slot);
  useLayoutEffect(() => {
    const update = () => setCurrent(slot);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return current;
}
