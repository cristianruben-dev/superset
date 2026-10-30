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

const EVENT = 'mibi:presentation';
let presenting = false;

/** Whether a dashboard is being presented full screen. */
export const isPresenting = () => presenting;

/** Starts or ends the presentation and tells every listener. */
export function setPresenting(value: boolean) {
  if (presenting === value) return;
  presenting = value;
  document.body.classList.toggle('mibi-presenting', value);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** Re-renders the caller when the presentation starts or ends. */
export function usePresenting(): boolean {
  const [value, setValue] = useState(presenting);
  useEffect(() => {
    const onChange = () => setValue(presenting);
    window.addEventListener(EVENT, onChange);
    onChange();
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return value;
}
