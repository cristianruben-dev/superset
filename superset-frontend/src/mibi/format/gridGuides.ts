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

const KEY = 'mibi.showGrid';
const EVENT = 'mibi:show-grid';

const read = () => {
  try {
    return window.localStorage.getItem(KEY) !== 'false';
  } catch {
    return true;
  }
};

/** Whether edit mode shows the column grid, a per-viewer preference. */
export function useShowGrid(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(read);
  useEffect(() => {
    const onChange = () => setValue(read());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  const update = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, String(next));
    } catch {
      // the preference lasts until the page reloads
    }
    setValue(next);
    window.dispatchEvent(new CustomEvent(EVENT));
  };
  return [value, update];
}
