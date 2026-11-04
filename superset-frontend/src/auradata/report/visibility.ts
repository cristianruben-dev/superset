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
import { useSelector } from 'react-redux';
import type { RootState } from 'src/dashboard/types';

/**
 * Shown/hidden state set by applying a bookmark, on top of each object's own
 * "hidden" flag. It lives only in the browser, belongs to one dashboard and
 * is gone after a reload, as the report opens in its saved state.
 */

const EVENT = 'mibi:visibility';
let dashboardId: number | null = null;
let overrides: Record<string, boolean> = {};

export function setVisibilityOverrides(
  dashboard: number,
  next: Record<string, boolean>,
) {
  dashboardId = dashboard;
  overrides = { ...next };
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Forgets the override of one object, when its own flag is changed. */
export function clearVisibilityOverride(id: string) {
  if (!(id in overrides)) return;
  const { [id]: _removed, ...rest } = overrides;
  overrides = rest;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** The hidden state a bookmark set on an object, if any. */
export function visibilityOverride(
  dashboard: number,
  id: string,
): boolean | undefined {
  return dashboard === dashboardId ? overrides[id] : undefined;
}

export function useHiddenOverride(id: string): boolean | undefined {
  const dashboard = useSelector((state: RootState) => state.dashboardInfo?.id);
  const [, setVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setVersion(version => version + 1);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return visibilityOverride(dashboard, id);
}
