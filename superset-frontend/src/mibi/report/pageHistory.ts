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
import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from 'src/dashboard/types';
import { topLevelTabs } from 'src/mibi/present/dashboardTabs';

/**
 * Pages visited in this view of the report, for buttons that go "Back". Only
 * the dashboard on screen is tracked; it starts empty on every visit.
 */
let history: string[] = [];
/** Page a "Back" is opening, so that change pops the history */
let goingBack: string | undefined;

/**
 * The page visited before the current one, to open with "Back". Opening it
 * removes it from the history (see usePageHistory), so "Back" twice goes two
 * pages back.
 */
export function goBackTo(): string | undefined {
  goingBack = history[history.length - 1];
  return goingBack;
}

/** Records page changes while the report is on screen. */
export function usePageHistory() {
  const current = useSelector((state: RootState) => {
    const tabs = topLevelTabs(state.dashboardLayout.present);
    return tabs.find(tab => state.dashboardState.activeTabs?.includes(tab.id))
      ?.id;
  });
  const previous = useRef(current);
  useEffect(() => {
    if (previous.current && current && previous.current !== current) {
      if (goingBack === current) history.pop();
      else history.push(previous.current);
    }
    goingBack = undefined;
    previous.current = current;
  }, [current]);
  useEffect(
    () => () => {
      history = [];
      goingBack = undefined;
    },
    [],
  );
}
