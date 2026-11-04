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
import { useEffect, useLayoutEffect, useState } from 'react';

let items: string[] = [];
const listeners = new Set<() => void>();

const publish = (next: string[]) => {
  items = next;
  listeners.forEach(listener => listener());
};

/**
 * Shows figures about the page in the status bar of the window ("6 dashboards",
 * "2 selected") while the page is mounted.
 */
export function usePageStatus(next: (string | false | null | undefined)[]) {
  const key = JSON.stringify(next.filter(Boolean));
  useEffect(() => {
    publish(JSON.parse(key) as string[]);
    return () => publish([]);
  }, [key]);
}

/** The figures the current page shows in the status bar. */
export function usePageStatusItems(): string[] {
  const [current, setCurrent] = useState(items);
  useLayoutEffect(() => {
    const update = () => setCurrent(items);
    update();
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return current;
}
