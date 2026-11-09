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
import { Profiler } from 'react';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import mockState from 'spec/fixtures/mockState';
import reducerIndex from 'spec/helpers/reducerIndex';
import { sliceId as baseChartId } from 'spec/fixtures/mockChartQueries';
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import { initialState } from 'src/SqlLab/fixtures';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DYNAMIC_TYPE,
  ROW_TYPE,
} from 'src/dashboard/util/componentTypes';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from 'src/dashboard/util/constants';
import type { DashboardLayout, LayoutItem } from 'src/dashboard/types';
import { ELEMENT_DEFAULTS } from 'src/auradata/elements/types';
import { BookmarksPane } from 'src/auradata/report/BookmarksPane';
import { Ribbon } from 'src/auradata/ribbon/Ribbon';
import { moveObject, setVisualFormat } from './actions';
import { CanvasFrame } from './CanvasFrame';
import { selectVisual } from './selection';
import { useCellMove } from './useCellMove';

const CHART_IDS = [1, 2, 3, 4, 5, 6].map(i => `CHART-${i}`);
const ELEMENT_IDS = ['ELEMENT-btn', 'ELEMENT-slicer'];

function buildBenchmarkState() {
  const rawMock = mockState as Record<string, Record<string, unknown>>;
  const baseChart = (rawMock.charts as Record<number, Record<string, unknown>>)[
    baseChartId
  ];
  const baseSlice = (
    rawMock.sliceEntities.slices as Record<number, Record<string, unknown>>
  )[baseChartId];

  const charts: Record<number, Record<string, unknown>> = {};
  const slices: Record<number, Record<string, unknown>> = {};
  const layout: Record<string, LayoutItem> = {
    [DASHBOARD_ROOT_ID]: {
      id: DASHBOARD_ROOT_ID,
      type: DASHBOARD_ROOT_TYPE,
      children: [DASHBOARD_GRID_ID],
      meta: {},
    } as LayoutItem,
    [DASHBOARD_GRID_ID]: {
      id: DASHBOARD_GRID_ID,
      type: DASHBOARD_GRID_TYPE,
      children: ['ROW-1'],
      parents: [DASHBOARD_ROOT_ID],
      meta: {},
    } as LayoutItem,
    'ROW-1': {
      id: 'ROW-1',
      type: ROW_TYPE,
      children: [...CHART_IDS, ...ELEMENT_IDS],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      meta: { background: 'BACKGROUND_TRANSPARENT' },
    } as LayoutItem,
  };

  CHART_IDS.forEach((id, index) => {
    const numericId = 100 + index;
    charts[numericId] = {
      ...baseChart,
      id: numericId,
      chartAlert: null,
      chartStatus: 'rendered',
    };
    slices[numericId] = {
      ...baseSlice,
      slice_id: numericId,
      slice_name: `Sales Chart ${index + 1}`,
    };
    layout[id] = {
      id,
      type: CHART_TYPE,
      children: [],
      parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-1'],
      meta: {
        uuid: id,
        chartId: numericId,
        width: 4,
        height: 20,
        chartName: `Sales Chart ${index + 1}`,
        sliceName: `Sales Chart ${index + 1}`,
        auradataPos: { x: (index % 3) * 20, y: Math.floor(index / 3) * 22 },
      },
    } as unknown as LayoutItem;
  });

  layout['ELEMENT-btn'] = {
    id: 'ELEMENT-btn',
    type: DYNAMIC_TYPE,
    children: [],
    parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-1'],
    meta: {
      uuid: 'ELEMENT-btn',
      componentKey: 'auradata-button',
      width: 3,
      height: 8,
      auradataPos: { x: 0, y: 48 },
      auradataElement: { ...ELEMENT_DEFAULTS.button.element, label: 'Go' },
    },
  } as unknown as LayoutItem;

  layout['ELEMENT-slicer'] = {
    id: 'ELEMENT-slicer',
    type: DYNAMIC_TYPE,
    children: [],
    parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'ROW-1'],
    meta: {
      uuid: 'ELEMENT-slicer',
      componentKey: 'auradata-filter',
      width: 4,
      height: 14,
      auradataPos: { x: 16, y: 48 },
      auradataElement: {
        ...ELEMENT_DEFAULTS.filter.element,
        filterId: 'NATIVE_FILTER-1',
        variant: 'list',
      },
    },
  } as unknown as LayoutItem;

  return {
    ...mockState,
    ...(initialState as Record<string, unknown>),
    charts,
    sliceEntities: {
      ...rawMock.sliceEntities,
      slices,
    },
    dashboardLayout: {
      present: layout as DashboardLayout,
      past: [],
      future: [],
    },
    dashboardState: {
      ...rawMock.dashboardState,
      editMode: true,
      sliceIds: CHART_IDS.map((_, index) => 100 + index),
      hasUnsavedChanges: false,
    },
    dashboardInfo: {
      ...rawMock.dashboardInfo,
      id: 77,
      dash_edit_perm: true,
      metadata: {
        ...(rawMock.dashboardInfo.metadata as Record<string, unknown>),
        shared_label_colors: undefined,
      },
    },
    nativeFilters: {
      filters: {
        'NATIVE_FILTER-1': {
          id: 'NATIVE_FILTER-1',
          name: 'Region',
          filterType: 'filter_select',
          type: 'NATIVE_FILTER',
          targets: [{}],
          controlValues: {},
          cascadeParentIds: [],
          scope: { rootPath: [DASHBOARD_ROOT_ID], excluded: [] },
        },
      },
    },
    dataMask: {},
  };
}

const noop = () => {};

function CellMoveProbe({
  component,
  onRender,
}: {
  component: LayoutItem;
  onRender: () => void;
}) {
  onRender();
  const { handlers, style } = useCellMove(component, true);
  return (
    <div
      data-test="cell-move-probe"
      style={style}
      onMouseDown={e =>
        handlers.onPointerDown(e as unknown as React.PointerEvent<HTMLElement>)
      }
    />
  );
}

describe('Edit Mode UI Performance Benchmarks', () => {
  let scrollViewBase: typeof window.HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    scrollViewBase = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = noop;
    if (!window.PointerEvent) {
      window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    }
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollViewBase;
  });

  afterEach(() => {
    act(() => {
      selectVisual(null);
    });
  });

  test('measures Edit Mode re-renders across unrelated Redux dispatches, single-visual edits, selection, and pointer drag', () => {
    const store = createStore(
      combineReducers(reducerIndex),
      buildBenchmarkState() as never,
      compose(applyMiddleware(thunk)),
    );

    const commits: Record<string, number> = {};
    const recordCommit = (id: string) => {
      commits[id] = (commits[id] ?? 0) + 1;
    };
    const resetCommits = () => {
      Object.keys(commits).forEach(key => {
        commits[key] = 0;
      });
    };
    const sumCommits = (ids: string[]) =>
      ids.reduce((sum, id) => sum + (commits[id] ?? 0), 0);

    render(
      <CanvasFrame>
        <Profiler id="Ribbon" onRender={() => recordCommit('Ribbon')}>
          <Ribbon
            hasUnsavedChanges={false}
            canUndo={false}
            canRedo={false}
            onUndo={noop}
            onRedo={noop}
            onSave={noop}
            onDiscard={noop}
            onRefresh={noop}
            onProperties={noop}
            onExport={noop}
          />
        </Profiler>
        <Profiler
          id="BookmarksPane"
          onRender={() => recordCommit('BookmarksPane')}
        >
          <BookmarksPane />
        </Profiler>
        {[...CHART_IDS, ...ELEMENT_IDS].map((id, index) => (
          <Profiler key={id} id={id} onRender={() => recordCommit(id)}>
            <DashboardComponent
              id={id}
              parentId="ROW-1"
              depth={2}
              index={index}
              availableColumnCount={12}
              columnWidth={16}
              onResizeStart={noop}
              onResize={noop}
              onResizeStop={noop}
              isComponentVisible
            />
          </Profiler>
        ))}
      </CanvasFrame>,
      {
        useRouter: true,
        useDnd: true,
        useRedux: true,
        store,
      },
    );

    // 1. Unrelated Redux action dispatch in Edit Mode (e.g. another slice or toast updates)
    resetCommits();
    act(() => {
      store.dispatch({
        type: 'ADD_TOAST',
        payload: { id: 'bench-toast', toastType: 'INFO_TOAST', text: 'Saved' },
      });
    });
    const unrelatedChartCommits = sumCommits(CHART_IDS);
    const unrelatedElementCommits = sumCommits(ELEMENT_IDS);
    const unrelatedBookmarksCommits = commits.BookmarksPane ?? 0;

    // 2. Formatting a single chart (CHART-1): untouched charts (CHART-2..6) and elements should not re-render
    resetCommits();
    act(() => {
      (store.dispatch as (action: unknown) => void)(
        setVisualFormat('CHART-1', { radius: 12 }),
      );
    });
    const untouchedAfterFormatCommits = sumCommits([
      ...CHART_IDS.slice(1),
      ...ELEMENT_IDS,
    ]);
    const ribbonAfterFormatCommits = commits.Ribbon ?? 0;

    // 3. Moving a single chart (CHART-1): untouched charts (CHART-2..6) and elements should not re-render
    resetCommits();
    act(() => {
      (store.dispatch as (action: unknown) => void)(
        moveObject('CHART-1', { x: 6, y: 4 }),
      );
    });
    const untouchedAfterMoveCommits = sumCommits([
      ...CHART_IDS.slice(1),
      ...ELEMENT_IDS,
    ]);

    // 4. Selecting CHART-1 on the canvas: untouched charts (CHART-2..6) and elements should not re-render
    resetCommits();
    act(() => {
      selectVisual('CHART-1');
    });
    const untouchedAfterSelectCommits = sumCommits([
      ...CHART_IDS.slice(1),
      ...ELEMENT_IDS,
    ]);

    // 5. Switching selection from CHART-1 to CHART-2: CHART-3..6 and elements should not re-render
    resetCommits();
    act(() => {
      selectVisual('CHART-2');
    });
    const untouchedAfterSwitchSelectCommits = sumCommits([
      ...CHART_IDS.slice(2),
      ...ELEMENT_IDS,
    ]);

    // 6. Dragging a visual across 48 pixels (3 cells of 16px) with useCellMove
    let cellMoveRenders = 0;
    const probeComponent = (
      store.getState() as { dashboardLayout: { present: DashboardLayout } }
    ).dashboardLayout.present['CHART-1'];
    render(
      <CellMoveProbe
        component={probeComponent}
        onRender={() => {
          cellMoveRenders += 1;
        }}
      />,
      { useRedux: true, store },
    );
    cellMoveRenders = 0;
    const probe = screen.getByTestId('cell-move-probe');
    for (let px = 0; px <= 48; px += 1) {
      act(() => {
        if (px === 0) {
          fireEvent.mouseDown(probe, {
            button: 0,
            clientX: 100,
            clientY: 100,
          });
        } else {
          window.dispatchEvent(
            Object.assign(new Event('pointermove'), {
              clientX: 100 + px,
              clientY: 100,
            }),
          );
        }
      });
    }
    act(() => {
      window.dispatchEvent(
        Object.assign(new Event('pointerup'), {
          clientX: 148,
          clientY: 100,
        }),
      );
    });

    expect(unrelatedChartCommits).toBe(0);
    expect(unrelatedElementCommits).toBe(0);
    expect(unrelatedBookmarksCommits).toBe(0);
    expect(untouchedAfterFormatCommits).toBe(0);
    expect(ribbonAfterFormatCommits).toBe(0);
    expect(untouchedAfterMoveCommits).toBe(0);
    expect(untouchedAfterSelectCommits).toBe(0);
    expect(untouchedAfterSwitchSelectCommits).toBe(0);
    expect(cellMoveRenders).toBeLessThanOrEqual(6);
  });
});
