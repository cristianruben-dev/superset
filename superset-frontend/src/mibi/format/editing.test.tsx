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
import {
  act,
  createStore,
  fireEvent,
  render,
  screen,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import type {
  DashboardLayout,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import { setObjectFlag } from './actions';
import { CanvasFrame, useCanvasMobile } from './CanvasFrame';
import {
  copyObject,
  pasteObject,
  placeComponent,
  readClipboard,
} from './clipboard';
import {
  cancelFormatPainter,
  copyFormat,
  formatOf,
  pasteFormat,
} from './formatPainter';
import { FormatPane } from './FormatPane';
import { setMobilePreview } from './mobile';
import { selectVisual } from './selection';

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
    children: ['DYNAMIC-a', 'DYNAMIC-b'],
    parents: ['ROOT_ID', 'GRID_ID'],
    meta: {},
  },
  'DYNAMIC-a': {
    id: 'DYNAMIC-a',
    type: 'DYNAMIC',
    children: [],
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
    meta: {
      componentKey: 'mibi-button',
      width: 3,
      height: 7,
      mibiFormat: { radius: 20, shadow: 'strong' },
      mibiElement: {
        kind: 'button',
        label: 'Ir',
        action: { type: 'top' },
        radius: 30,
        normal: { fill: '#ff0000' },
      },
    },
  },
  'DYNAMIC-b': {
    id: 'DYNAMIC-b',
    type: 'DYNAMIC',
    children: [],
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-1'],
    meta: {
      componentKey: 'mibi-button',
      width: 6,
      height: 7,
      mibiElement: { kind: 'button', label: 'Otro', radius: 4 },
    },
  },
} as unknown as DashboardLayout;

const makeStore = () =>
  createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { editMode: true, activeTabs: [] },
      dashboardInfo: { id: 7 },
    },
    reducerIndex,
  );
const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as RootState;
const dispatcher = (store: ReturnType<typeof makeStore>) =>
  store.dispatch as unknown as (action: unknown) => Promise<void> | void;

afterEach(() => {
  selectVisual(null);
  cancelFormatPainter();
  setMobilePreview(false);
  window.localStorage.clear();
});

test('hides and locks objects, and clears the flag when turned off', () => {
  const store = makeStore();
  dispatcher(store)(setObjectFlag('DYNAMIC-a', 'mibiHidden', true));
  dispatcher(store)(setObjectFlag('DYNAMIC-a', 'mibiLocked', true));
  let { meta } = stateOf(store).dashboardLayout.present['DYNAMIC-a'];
  expect(meta.mibiHidden).toBe(true);
  expect(meta.mibiLocked).toBe(true);
  dispatcher(store)(setObjectFlag('DYNAMIC-a', 'mibiHidden', false));
  ({ meta } = stateOf(store).dashboardLayout.present['DYNAMIC-a']);
  expect(meta).not.toHaveProperty('mibiHidden');
});

test('the Format pane toggles hide, lock and hide on mobile', () => {
  const store = makeStore();
  render(<FormatPane />, { store });
  act(() => selectVisual('DYNAMIC-b'));
  fireEvent.click(screen.getByTestId('mibi-toggle-hidden'));
  fireEvent.click(screen.getByTestId('mibi-toggle-locked'));
  fireEvent.click(screen.getByTestId('mibi-toggle-mobile'));
  expect(
    stateOf(store).dashboardLayout.present['DYNAMIC-b'].meta,
  ).toMatchObject({ mibiHidden: true, mibiLocked: true, mibiHideMobile: true });
});

test('copying a format leaves the content behind', () => {
  const copied = formatOf(layout['DYNAMIC-a'] as LayoutItem);
  expect(copied.box).toEqual({ radius: 20, shadow: 'strong' });
  expect(copied.style).toEqual({
    kind: 'button',
    radius: 30,
    normal: { fill: '#ff0000' },
  });
});

test('the format painter gives its format to the next object selected', () => {
  const store = makeStore();
  render(<FormatPane />, { store });
  act(() => selectVisual('DYNAMIC-a'));
  fireEvent.click(screen.getByTestId('mibi-copy-format'));
  expect(screen.getByTestId('mibi-painter-tip')).toBeInTheDocument();
  act(() => selectVisual('DYNAMIC-b'));
  const { meta } = stateOf(store).dashboardLayout.present['DYNAMIC-b'];
  expect(meta.mibiFormat).toEqual({ radius: 20, shadow: 'strong' });
  expect(meta.mibiElement).toMatchObject({
    label: 'Otro',
    radius: 30,
    normal: { fill: '#ff0000' },
  });
  expect(screen.queryByTestId('mibi-painter-tip')).not.toBeInTheDocument();
});

test('pasting a format again works without the painter', () => {
  const store = makeStore();
  copyFormat(layout['DYNAMIC-a'] as LayoutItem);
  cancelFormatPainter();
  dispatcher(store)(pasteFormat('DYNAMIC-b'));
  expect(
    stateOf(store).dashboardLayout.present['DYNAMIC-b'].meta.mibiFormat,
  ).toEqual({ radius: 20, shadow: 'strong' });
});

test('places a pasted object in its row when it fits, else in a row below', () => {
  const fits = placeComponent(
    layout as Record<string, LayoutItem>,
    {
      id: 'NEW',
      type: 'DYNAMIC',
      children: [],
      meta: { width: 3 },
    } as LayoutItem,
    'DYNAMIC-a',
    [],
  );
  expect(fits['ROW-1'].children).toEqual(['DYNAMIC-a', 'NEW', 'DYNAMIC-b']);
  expect(fits.NEW.parents).toEqual(['ROOT_ID', 'GRID_ID', 'ROW-1']);

  const below = placeComponent(
    layout as Record<string, LayoutItem>,
    {
      id: 'BIG',
      type: 'DYNAMIC',
      children: [],
      meta: { width: 6 },
    } as LayoutItem,
    'DYNAMIC-a',
    [],
  );
  const row = Object.values(below).find(
    item => item.type === 'ROW' && item.id !== 'ROW-1',
  )!;
  expect(below.GRID_ID.children).toEqual(['ROW-1', row.id]);
  expect(row.children).toEqual(['BIG']);
  expect(below.BIG.parents).toEqual(['ROOT_ID', 'GRID_ID', row.id]);
});

test('copies and pastes a design element as a new, unlocked object', async () => {
  const store = makeStore();
  dispatcher(store)(setObjectFlag('DYNAMIC-a', 'mibiLocked', true));
  dispatcher(store)(copyObject('DYNAMIC-a'));
  expect(readClipboard()).toMatchObject({ type: 'DYNAMIC', dashboardId: 7 });
  await dispatcher(store)(pasteObject('DYNAMIC-a'));
  const { present } = stateOf(store).dashboardLayout;
  const copies = Object.values(present).filter(
    item =>
      item.type === 'DYNAMIC' &&
      (item.meta.mibiElement as { label: string }).label === 'Ir',
  );
  expect(copies).toHaveLength(2);
  const copy = copies.find(item => item.id !== 'DYNAMIC-a')!;
  expect(copy.meta.mibiLocked).toBeUndefined();
  expect(present['ROW-1'].children).toContain(copy.id);
});

function MobileProbe() {
  return <span data-test="probe">{String(useCanvasMobile())}</span>;
}

test('the phone preview narrows the canvas and turns on the mobile layout', () => {
  const store = makeStore();
  render(
    <CanvasFrame>
      <MobileProbe />
    </CanvasFrame>,
    { store },
  );
  expect(screen.getByTestId('probe')).toHaveTextContent('false');
  act(() => setMobilePreview(true));
  expect(screen.getByTestId('probe')).toHaveTextContent('true');
  expect(screen.getByTestId('mibi-canvas')).toHaveStyle({ width: '390px' });
  expect(screen.getByTestId('mibi-canvas')).toHaveClass('mibi-mobile');
});
