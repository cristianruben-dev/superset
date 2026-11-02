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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Drawer, Loading } from '@superset-ui/core/components';
import {
  addSliceToDashboard,
  onRefresh,
} from 'src/dashboard/actions/dashboardState';
import { handleComponentDrop } from 'src/dashboard/actions/dashboardLayout';
import type { DropResult } from 'src/dashboard/components/dnd/dragDroppableConfig';
import type { RootState } from 'src/dashboard/types';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_ROOT_ID,
  NEW_CHART_ID,
  NEW_COMPONENTS_SOURCE_ID,
} from 'src/dashboard/util/constants';
import { ensureAppRoot } from 'src/utils/pathUtils';
import {
  isChartSavedMessage,
  isEditChartFromPanelMessage,
  OPEN_CHART_EDITOR,
  type OpenChartEditorDetail,
  withDashboardParam,
  withPanelParam,
} from '../chartEditor';
import { DEFAULT_OBJECT_COLUMNS, DEFAULT_OBJECT_ROWS } from '../format/columns';
import { freeCell } from '../format/positions';
import { fetchDashboardSlices } from './reloadSavedChart';

const Frame = styled.div`
  position: relative;
  height: 100%;

  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

/** Where a new chart goes: the end of the grid, or of the visible top tab. */
export function newChartDestination(
  state: Pick<RootState, 'dashboardLayout' | 'dashboardState'>,
): DropResult['destination'] {
  const layout = state.dashboardLayout.present;
  const rootChild = layout[layout[DASHBOARD_ROOT_ID]?.children?.[0] ?? ''];
  if (!rootChild) {
    return undefined;
  }
  if (rootChild.type !== TABS_TYPE) {
    return {
      id: rootChild.id,
      type: DASHBOARD_GRID_TYPE,
      index: rootChild.children.length,
    };
  }
  const activeTabs = state.dashboardState.activeTabs || [];
  const tabId =
    rootChild.children.find(id => activeTabs.includes(id)) ??
    rootChild.children[0];
  const tab = layout[tabId];
  return tab
    ? { id: tab.id, type: TAB_TYPE, index: tab.children.length }
    : undefined;
}

const panelTitle = (editor: OpenChartEditorDetail | null) => {
  if (editor?.kind === 'data') {
    return t('Data');
  }
  if (editor?.kind === 'sql') {
    return t('SQL editor');
  }
  return editor?.chartId ? t('Edit visual') : t('New visual');
};

/**
 * The side panel of a dashboard, where its charts, its data and SQL Lab open
 * without leaving it: the page runs inside in panel mode. Explore reports when it
 * saves; the data pages and SQL Lab ask for a chart built from what they made.
 */
export function ChartEditorPanel() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const [editor, setEditor] = useState<OpenChartEditorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const open = useCallback(
    (detail: OpenChartEditorDetail) => {
      // The data pages and SQL Lab save new datasets to this dashboard's workspace
      const next =
        detail.kind === 'data' || detail.kind === 'sql'
          ? {
              ...detail,
              url: withDashboardParam(
                detail.url,
                store.getState().dashboardInfo.id,
              ),
            }
          : detail;
      // The same page again does not reload the frame, so it never says it loaded
      if (editorRef.current?.url !== next.url) {
        setLoading(true);
      }
      setEditor(next);
    },
    [store],
  );

  useEffect(() => {
    const onOpen = (event: Event) =>
      open((event as CustomEvent<OpenChartEditorDetail>).detail);
    window.addEventListener(OPEN_CHART_EDITOR, onOpen);
    return () => window.removeEventListener(OPEN_CHART_EDITOR, onOpen);
  }, [open]);

  const close = useCallback(() => {
    if (editor?.kind === 'data' || editor?.kind === 'sql') {
      // Datasets may have changed: columns, metrics or their SQL
      const state = store.getState();
      const chartIds = Object.keys(state.charts).map(Number);
      dispatch(onRefresh(chartIds, true, 0, state.dashboardInfo.id) as never);
    }
    setEditor(null);
  }, [dispatch, editor, store]);

  const onSaved = useCallback(
    async (chartId: number, isNew: boolean) => {
      setEditor(null);
      // Fresh chart definitions (form data, name) for this dashboard
      await dispatch(fetchDashboardSlices() as never);
      const state = store.getState();
      if (isNew && state.dashboardState.editMode) {
        const destination = newChartDestination(state);
        const sliceName = state.sliceEntities.slices[chartId]?.slice_name;
        if (destination) {
          // The same drop the "Charts" pane does when dragging a chart in
          dispatch(
            handleComponentDrop({
              source: {
                id: NEW_COMPONENTS_SOURCE_ID,
                type: NEW_COMPONENT_SOURCE_TYPE,
                index: 0,
              },
              dragging: {
                id: NEW_CHART_ID,
                type: CHART_TYPE,
                meta: { chartId, sliceName },
              },
              destination,
              // Where it covers no other object of the page
              cell: freeCell(
                state.dashboardLayout.present,
                destination.id,
                DEFAULT_OBJECT_COLUMNS,
                DEFAULT_OBJECT_ROWS,
              ),
            } as DropResult) as never,
          );
          return;
        }
      }
      // Reload the chart in place with its saved definition
      dispatch(addSliceToDashboard(chartId) as never);
    },
    [dispatch, store],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (isChartSavedMessage(event.data)) {
        onSaved(event.data.chartId, event.data.isNew);
      } else if (isEditChartFromPanelMessage(event.data)) {
        const dashboardId = store.getState().dashboardInfo.id;
        open({ url: withDashboardParam(event.data.url, dashboardId) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSaved, open, store]);

  const title = panelTitle(editor);
  // SQL Lab and the data pages need the room of a page
  const wide = editor?.kind === 'data' || editor?.kind === 'sql';

  return (
    <Drawer
      open={!!editor}
      onClose={close}
      title={title}
      placement="right"
      // Explore shows three columns: the data, the settings and the chart
      width={wide ? '92vw' : 'min(1440px, 92vw)'}
      destroyOnHidden
      // A thin header: the page inside has its own title bar
      styles={{ header: { padding: '10px 16px' }, body: { padding: 0 } }}
      data-test="mibi-chart-editor"
    >
      {editor && (
        <Frame
          css={css`
            .loading {
              visibility: ${loading ? 'visible' : 'hidden'};
            }
          `}
        >
          {loading && (
            <div className="loading">
              <Loading position="inline-centered" />
            </div>
          )}
          <iframe
            title={title}
            src={ensureAppRoot(withPanelParam(editor.url))}
            onLoad={() => setLoading(false)}
            data-test="mibi-chart-editor-frame"
          />
        </Frame>
      )}
    </Drawer>
  );
}
