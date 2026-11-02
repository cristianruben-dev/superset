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
import { Button, Drawer, Loading, Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
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
  isChartFormDataMessage,
  isChartSavedMessage,
  isEditChartFromPanelMessage,
  OPEN_CHART_EDITOR,
  type OpenChartEditorDetail,
  withDashboardParam,
  withDockParam,
  withPanelParam,
} from '../chartEditor';
import {
  isPaneCollapsed,
  setDockWidth,
  setPaneCollapsed,
} from '../format/panes';
import { previewChartFormData } from './previewChart';
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

/** Width of the editor docked beside the report */
export const DOCK_WIDTH = 460;

const Dock = styled.aside<{ $top: number }>`
  ${({ theme, $top }) => css`
    position: sticky;
    top: ${$top}px;
    flex: none;
    width: ${DOCK_WIDTH}px;
    height: calc(100vh - ${$top}px);
    display: flex;
    flex-direction: column;
    background: ${theme.colorBgBase};
    border-left: 1px solid ${theme.colorBorderSecondary};
    box-shadow: -${theme.sizeUnit}px 0 ${theme.sizeUnit * 2}px
      ${theme.colorBorderSecondary};
    z-index: 2;

    .dock-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      font-weight: ${theme.fontWeightStrong};
    }
    .dock-body {
      position: relative;
      flex: 1;
      min-height: 0;
    }
  `}
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
export function ChartEditorPanel({ topOffset = 0 }: { topOffset?: number }) {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const [editor, setEditor] = useState<OpenChartEditorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  // An existing chart is edited beside the report; new ones, data and SQL Lab
  // need the room of a page
  const docked =
    !!editor && (!editor.kind || editor.kind === 'chart') && !!editor.chartId;
  const dockedChartId = docked ? editor?.chartId : undefined;
  const savedFormData = useRef<Record<string, unknown> | null>(null);
  const edited = useRef(false);
  const needsQuery = useRef(false);
  const lastSeq = useRef(0);
  const queryTimer = useRef<ReturnType<typeof setTimeout>>();
  const foldedByDock = useRef(false);
  const [confirming, setConfirming] = useState(false);

  // The report keeps the room: the edit pane folds while the editor is docked
  useEffect(() => {
    if (!docked) return undefined;
    setDockWidth(DOCK_WIDTH);
    foldedByDock.current = !isPaneCollapsed('builder');
    if (foldedByDock.current) setPaneCollapsed('builder', true);
    const chart = store.getState().charts[dockedChartId ?? 0];
    savedFormData.current = chart?.form_data ?? null;
    edited.current = false;
    needsQuery.current = false;
    lastSeq.current = 0;
    return () => {
      setDockWidth(0);
      if (foldedByDock.current) setPaneCollapsed('builder', false);
      clearTimeout(queryTimer.current);
    };
  }, [docked, dockedChartId, store]);

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

  // Puts the chart back as it was saved
  const discard = useCallback(() => {
    clearTimeout(queryTimer.current);
    if (dockedChartId !== undefined && savedFormData.current) {
      dispatch(
        previewChartFormData(
          dockedChartId,
          savedFormData.current,
          needsQuery.current ? 'query' : 'render',
        ) as never,
      );
    }
    edited.current = false;
    setConfirming(false);
    setEditor(null);
  }, [dispatch, dockedChartId]);

  const close = useCallback(() => {
    if (docked && edited.current) {
      setConfirming(true);
      return;
    }
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
      clearTimeout(queryTimer.current);
      edited.current = false;
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
      } else if (isChartFormDataMessage(event.data)) {
        const { chartId, formData, kind, seq } = event.data;
        // Only the chart being edited, and never an older message than the last
        if (chartId !== dockedChartId || seq <= lastSeq.current) return;
        lastSeq.current = seq;
        edited.current = true;
        if (kind === 'render') {
          dispatch(previewChartFormData(chartId, formData, kind) as never);
        } else {
          // New data: ask for it once the settings stop changing
          needsQuery.current = true;
          clearTimeout(queryTimer.current);
          queryTimer.current = setTimeout(
            () =>
              dispatch(previewChartFormData(chartId, formData, kind) as never),
            600,
          );
        }
      } else if (isEditChartFromPanelMessage(event.data)) {
        const dashboardId = store.getState().dashboardInfo.id;
        open({ url: withDashboardParam(event.data.url, dashboardId) });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [dispatch, dockedChartId, onSaved, open, store]);

  const title = panelTitle(editor);
  // SQL Lab and the data pages need the room of a page
  const wide = editor?.kind === 'data' || editor?.kind === 'sql';

  const frame = editor && (
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
        src={ensureAppRoot(
          docked
            ? withDockParam(withPanelParam(editor.url))
            : withPanelParam(editor.url),
        )}
        onLoad={() => setLoading(false)}
        data-test="mibi-chart-editor-frame"
      />
    </Frame>
  );

  if (docked) {
    return (
      <>
        <Dock $top={topOffset} data-test="mibi-chart-editor-dock">
          <div className="dock-header">
            <span>{title}</span>
            <Button
              buttonStyle="link"
              buttonSize="small"
              aria-label={t('Close')}
              onClick={close}
              data-test="mibi-chart-editor-close"
            >
              <Icons.CloseOutlined iconSize="m" />
            </Button>
          </div>
          <div className="dock-body">{frame}</div>
        </Dock>
        <Modal
          show={confirming}
          onHide={() => setConfirming(false)}
          title={t('Discard the changes?')}
          width="420px"
          footer={
            <>
              <Button
                buttonStyle="secondary"
                onClick={() => setConfirming(false)}
              >
                {t('Keep editing')}
              </Button>
              <Button buttonStyle="danger" onClick={discard}>
                {t('Discard')}
              </Button>
            </>
          }
        >
          {t(
            'The chart changed and is not saved. Use Save in the editor to keep the changes.',
          )}
        </Modal>
      </>
    );
  }

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
      {frame}
    </Drawer>
  );
}
