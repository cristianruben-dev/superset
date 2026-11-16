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
 * Where the header of a chart puts its buttons in the floating action bar of
 * its object (ObjectActions), by the id of the object in the layout. The bar
 * lives in a portal of the body, so the header cannot reach it through the
 * tree.
 */
const slots = new Map<string, HTMLElement>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(listener => listener());

/** Offers ``element`` as the slot of object ``id``; returns its release. */
export function registerActionSlot(id: string, element: HTMLElement) {
  slots.set(id, element);
  notify();
  return () => {
    if (slots.get(id) === element) {
      slots.delete(id);
      notify();
    }
  };
}

/** The slot of object ``id``, or null while it has no action bar. */
export function useActionSlot(id: string | undefined): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(() =>
    id ? (slots.get(id) ?? null) : null,
  );
  useEffect(() => {
    const onChange = () => setSlot(id ? (slots.get(id) ?? null) : null);
    onChange();
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [id]);
  return slot;
}
