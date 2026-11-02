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
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import type { GetState, LayoutItem, RootState } from 'src/dashboard/types';
import { DYNAMIC_TYPE } from 'src/dashboard/util/componentTypes';
import { DASHBOARD_GRID_ID } from 'src/dashboard/util/constants';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { newElementMeta } from 'src/mibi/elements/NewElements';
import type { ElementKind } from 'src/mibi/elements/types';
import { updateLayout } from 'src/mibi/format/actions';
import { placeComponent } from 'src/mibi/format/clipboard';
import { freeCell, POS_KEY } from 'src/mibi/format/positions';
import { openFormat } from 'src/mibi/format/selection';
import { activeTabIndex, topLevelTabs } from 'src/mibi/present/dashboardTabs';

type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;

/**
 * Adds a design element from the ribbon: on the first free cell of the open
 * page, selected, with the Format pane open to set it up.
 */
export const insertElement =
  (kind: ElementKind) => (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout, dashboardState } = getState();
    const layout = dashboardLayout.present;
    const tabs = topLevelTabs(layout);
    const pageId = tabs.length
      ? tabs[activeTabIndex(tabs, dashboardState.activeTabs)].id
      : DASHBOARD_GRID_ID;
    const meta = newElementMeta(kind);
    const component = newComponentFactory(DYNAMIC_TYPE, {
      ...meta,
      [POS_KEY]: freeCell(layout, pageId, meta.width, meta.height),
    }) as unknown as LayoutItem;
    dispatch(
      updateLayout(
        placeComponent(layout, component, null, dashboardState.activeTabs),
        `insert-element:${component.id}`,
      ),
    );
    openFormat(component.id);
  };
