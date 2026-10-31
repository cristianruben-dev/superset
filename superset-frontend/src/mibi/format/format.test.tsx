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
import { supersetTheme } from '@apache-superset/core/theme';
import {
  act,
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import {
  fitToCanvas,
  setSharedVisualFormat,
  setCanvasFormat,
  setVisualFormat,
} from './actions';
import { CanvasFrame } from './CanvasFrame';
import { FormatPane } from './FormatPane';
import { selectedVisual, selectVisual } from './selection';
import {
  canvasSize,
  canvasStyle,
  canvasZoom,
  gapInset,
  mergeVisualFormat,
  visualStyle,
  withOpacity,
} from './styles';

const layout = {
  ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['GRID_ID'], meta: {} },
  GRID_ID: {
    id: 'GRID_ID',
    type: 'GRID',
    children: ['ROW-1'],
    parents: ['ROOT_ID'],
    meta: {},
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['CHART-a', 'CHART-b'],
    parents: ['ROOT_ID', 'GRID_ID'],
    meta: {},
  },
  'CHART-a': {
    id: 'CHART-a',
    type: 'CHART',
    children: [],
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
    meta: { chartId: 1, sliceName: 'Sales', width: 6, height: 50 },
  },
  'CHART-b': {
    id: 'CHART-b',
    type: 'CHART',
    children: [],
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
    meta: { chartId: 2, sliceName: 'Costs', width: 6, height: 50 },
  },
} as unknown as DashboardLayout;

const makeStore = () =>
  createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { editMode: true, hasUnsavedChanges: false },
      dashboardInfo: { id: 7 },
    },
    reducerIndex,
  );

const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as RootState;

// The test store is typed for SQL Lab; the format actions are dashboard thunks
const dispatcher = (store: ReturnType<typeof makeStore>) =>
  store.dispatch as unknown as (action: unknown) => void;

afterEach(() => selectVisual(null));

test('turns a visual format into the card style', () => {
  const { style, className, shrink } = visualStyle(
    {
      background: '#ff0000',
      backgroundOpacity: 50,
      borderWidth: 3,
      borderColor: '#000000',
      radius: 4,
      shadow: 'none',
      padding: 24,
      title: { show: false, size: 18, align: 'center' },
    },
    supersetTheme,
  );
  expect(style).toMatchObject({
    backgroundColor: 'rgba(255, 0, 0, 0.5)',
    border: '3px solid #000000',
    '--mb-v-radius': '4px',
    boxShadow: 'none',
    padding: '24px',
    '--mb-v-title-size': '18px',
    '--mb-v-title-align': 'center',
  });
  expect(className).toBe('mibi-title-hidden');
  // 8px more padding and 2px more border on each side
  expect(shrink).toBe(20);
});

test('leaves an unformatted visual alone', () => {
  expect(visualStyle(undefined, supersetTheme)).toEqual({
    style: {},
    shrink: 0,
  });
  expect(withOpacity('transparent', 10)).toBe('transparent');
});

test('sizes the canvas from presets and clamps custom sizes', () => {
  expect(canvasSize(undefined)).toBeNull();
  expect(canvasSize({ size: { mode: 'auto' } })).toBeNull();
  expect(canvasSize({ size: { mode: '16:9' } })).toEqual({
    width: 1280,
    height: 720,
  });
  expect(
    canvasSize({ size: { mode: 'custom', width: 50, height: 99999 } }),
  ).toEqual({ width: 320, height: 4096 });
});

test('zooms a fixed canvas to the width, or to the screen', () => {
  const size = { width: 1280, height: 720 };
  expect(canvasZoom(size, { width: 640 })).toBe(0.5);
  expect(canvasZoom(size, { width: 2560, height: 720 })).toBe(1);
  expect(canvasZoom(size, { width: 0 })).toBe(1);
});

test('builds the canvas background and spacing', () => {
  expect(gapInset({ gap: 28 })).toBe(6);
  expect(
    canvasStyle(
      {
        background: { type: 'gradient', color: '#111111', color2: '#222222' },
        padding: 24,
        gap: 8,
      },
      supersetTheme,
    ),
  ).toEqual({
    background: 'linear-gradient(135deg, #111111, #222222)',
    padding: '24px',
    '--mb-gap-inset': '-4px',
  });
  const image = canvasStyle(
    { background: { type: 'image', image: '/bg.png', fit: 'repeat' } },
    supersetTheme,
  ) as Record<string, string>;
  expect(image.backgroundImage).toContain('url("/bg.png")');
  expect(image.backgroundRepeat).toBe('repeat');
});

test('stores formats in the layout and undoes slider drags as one step', () => {
  const store = makeStore();
  dispatcher(store)(setVisualFormat('CHART-a', { radius: 4 }, 'drag'));
  dispatcher(store)(setVisualFormat('CHART-a', { radius: 8 }, 'drag'));
  dispatcher(store)(setVisualFormat('CHART-a', { radius: 12 }, 'drag'));
  const state = stateOf(store);
  expect(state.dashboardLayout.present['CHART-a'].meta.mibiFormat).toEqual({
    radius: 12,
  });
  expect(state.dashboardState.hasUnsavedChanges).toBe(true);

  dispatcher(store)(UndoActionCreators.undo());
  expect(
    stateOf(store).dashboardLayout.present['CHART-a'].meta.mibiFormat,
  ).toBeUndefined();
});

test('shares a style with every chart, keeping their subtitles', () => {
  const store = makeStore();
  dispatcher(store)(
    setVisualFormat('CHART-a', { radius: 2, title: { subtitle: 'Mes' } }),
  );
  dispatcher(store)(setCanvasFormat({ gap: 24 }));
  dispatcher(store)(
    setSharedVisualFormat({ shadow: 'strong', title: { subtitle: 'Mes' } }),
  );
  const { present } = stateOf(store).dashboardLayout;
  expect(present.ROOT_ID.meta.mibiCanvas).toEqual({
    gap: 24,
    visuals: { shadow: 'strong', title: {} },
  });
  expect(present['CHART-a'].meta.mibiFormat).toEqual({
    title: { subtitle: 'Mes' },
  });
  expect(present['CHART-b'].meta).not.toHaveProperty('mibiFormat');

  // One undo step brings every chart back
  dispatcher(store)(UndoActionCreators.undo());
  expect(
    stateOf(store).dashboardLayout.present['CHART-a'].meta.mibiFormat,
  ).toEqual({ radius: 2, title: { subtitle: 'Mes' } });
});

test('a chart shows its own format over the shared style', () => {
  expect(mergeVisualFormat(undefined, { radius: 1 })).toEqual({ radius: 1 });
  expect(mergeVisualFormat({ radius: 1 }, undefined)).toEqual({ radius: 1 });
  expect(
    mergeVisualFormat(
      { radius: 1, shadow: 'none', title: { size: 20, color: 'red' } },
      { radius: 9, title: { color: 'blue' }, header: { menu: false } },
    ),
  ).toEqual({
    radius: 9,
    shadow: 'none',
    title: { size: 20, color: 'blue' },
    header: { menu: false },
  });
});

test('formats the canvas and then the selected chart', () => {
  const store = makeStore();
  render(<FormatPane />, { store });
  expect(screen.getByTestId('mibi-format-title')).toHaveTextContent('Canvas');

  fireEvent.click(screen.getByRole('radio', { name: 'Gradient' }));
  expect(
    stateOf(store).dashboardLayout.present.ROOT_ID.meta.mibiCanvas?.background
      ?.type,
  ).toBe('gradient');

  act(() => selectVisual('CHART-a'));
  expect(screen.getByTestId('mibi-format-title')).toHaveTextContent('Sales');

  fireEvent.click(screen.getByRole('switch', { name: 'Show title' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Strong' }));
  expect(
    stateOf(store).dashboardLayout.present['CHART-a'].meta.mibiFormat,
  ).toEqual({ title: { show: false }, shadow: 'strong' });

  fireEvent.click(screen.getByTestId('mibi-format-apply-all'));
  expect(
    stateOf(store).dashboardLayout.present.ROOT_ID.meta.mibiCanvas?.visuals
      ?.shadow,
  ).toBe('strong');
  // The chart keeps showing the style, now shared
  expect(screen.getByRole('radio', { name: 'Strong' })).toBeChecked();

  fireEvent.click(screen.getByTestId('mibi-format-back'));
  expect(screen.getByTestId('mibi-format-title')).toHaveTextContent('Canvas');
});

test('frames the grid with the canvas format', () => {
  const store = makeStore();
  dispatcher(store)(
    setCanvasFormat({
      background: { type: 'color', color: '#123456' },
      size: { mode: '4:3' },
    }),
  );
  render(
    <CanvasFrame>
      <div>grid</div>
    </CanvasFrame>,
    { store },
  );
  const canvas = screen.getByTestId('mibi-canvas');
  expect(canvas).toHaveTextContent('grid');
  expect(canvas).toHaveStyle({ width: '1024px', minHeight: '768px' });
  expect(canvas.style.background).toContain('rgb(18, 52, 86)');
});

test('a click on the canvas goes back to the canvas settings', () => {
  const store = makeStore();
  selectVisual('CHART-a');
  render(
    <CanvasFrame>
      <div>grid</div>
    </CanvasFrame>,
    { store },
  );
  fireEvent.click(screen.getByText('grid'));
  expect(selectedVisual()).toBeNull();
});

test('fits the visuals of the page to the canvas height', () => {
  const store = makeStore();
  // One row: 16 px of gutter plus charts 50 units (400 px) tall
  dispatcher(store)(fitToCanvas(216, 416));
  const { present } = stateOf(store).dashboardLayout;
  expect(present['CHART-a'].meta.height).toBe(25);
  expect(present['CHART-b'].meta.height).toBe(25);
});
