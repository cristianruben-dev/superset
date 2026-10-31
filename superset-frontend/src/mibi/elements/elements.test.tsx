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
import type { DashboardLayout, RootState } from 'src/dashboard/types';
import newEntitiesFromDrop from 'src/dashboard/util/newEntitiesFromDrop';
import { FormatPane } from 'src/mibi/format/FormatPane';
import { selectVisual } from 'src/mibi/format/selection';
import { runElementAction, setElementConfig } from './actions';
import {
  fillBackground,
  isSafeUrl,
  sanitizeRichText,
  starPoints,
  textCss,
} from './render';
import { ELEMENT_DEFAULTS, elementKey, elementKind } from './types';
import { ButtonView, ImageView, ShapeView, TextView } from './views';

const layout = {
  ROOT_ID: { id: 'ROOT_ID', type: 'ROOT', children: ['TABS-1'], meta: {} },
  'TABS-1': {
    id: 'TABS-1',
    type: 'TABS',
    children: ['TAB-a', 'TAB-b'],
    parents: ['ROOT_ID'],
    meta: {},
  },
  'TAB-a': {
    id: 'TAB-a',
    type: 'TAB',
    children: ['ROW-1'],
    parents: ['ROOT_ID', 'TABS-1'],
    meta: { text: 'Resumen' },
  },
  'TAB-b': {
    id: 'TAB-b',
    type: 'TAB',
    children: [],
    parents: ['ROOT_ID', 'TABS-1'],
    meta: { text: 'Detalle' },
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['DYNAMIC-btn'],
    parents: ['ROOT_ID', 'TABS-1', 'TAB-a'],
    meta: {},
  },
  'DYNAMIC-btn': {
    id: 'DYNAMIC-btn',
    type: 'DYNAMIC',
    children: [],
    parents: ['ROOT_ID', 'TABS-1', 'TAB-a', 'ROW-1'],
    meta: {
      componentKey: 'mibi-button',
      width: 3,
      height: 7,
      mibiElement: { ...ELEMENT_DEFAULTS.button.element, label: 'Ir' },
    },
  },
} as unknown as DashboardLayout;

const makeStore = () =>
  createStore(
    {
      dashboardLayout: { present: layout, past: [], future: [] },
      dashboardState: { editMode: true, activeTabs: ['TAB-a'] },
      dashboardInfo: { id: 7 },
      nativeFilters: {
        filters: {
          f1: {
            id: 'f1',
            name: 'Region',
            defaultDataMask: { filterState: { value: ['Norte'] } },
          },
        },
      },
      dataMask: { f1: { id: 'f1', filterState: { value: ['Sur'] } } },
    },
    reducerIndex,
  );

const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as RootState;
const dispatcher = (store: ReturnType<typeof makeStore>) =>
  store.dispatch as unknown as (action: unknown) => void;

afterEach(() => selectVisual(null));

// Built in pieces: linters reject the literal
const SCRIPT_SCHEME = ['java', 'script:'].join('');

test('recognises Mi BI elements by their component key', () => {
  expect(elementKind(elementKey('shape'))).toBe('shape');
  expect(elementKind('mibi-unknown')).toBeNull();
  expect(elementKind('some-plugin')).toBeNull();
  expect(elementKind(undefined)).toBeNull();
});

test('keeps rich text formatting and drops scripts', () => {
  const clean = sanitizeRichText(
    `<b>ok</b><img src=x onerror="alert(1)"><a href="${SCRIPT_SCHEME}alert(1)">x</a><a href="https://a.io">y</a><script>alert(1)</script>`,
  );
  expect(clean).toContain('<b>ok</b>');
  expect(clean).not.toContain('onerror');
  expect(clean).not.toContain('<script');
  expect(clean).not.toContain(SCRIPT_SCHEME);
  expect(clean).toContain('href="https://a.io"');
  expect(clean).toContain('rel="noopener noreferrer"');
});

test('only follows safe links', () => {
  expect(isSafeUrl('https://example.com')).toBe(true);
  expect(isSafeUrl('/dashboard/list/')).toBe(true);
  expect(isSafeUrl('mailto:a@b.co')).toBe(true);
  expect(isSafeUrl(`${SCRIPT_SCHEME}alert(1)`)).toBe(false);
  expect(isSafeUrl('//evil.com')).toBe(false);
  expect(isSafeUrl('')).toBe(false);
});

test('builds fills, typography and star points', () => {
  expect(fillBackground({ type: 'none' }, supersetTheme)).toBe('transparent');
  expect(
    fillBackground(
      { type: 'solid', color: '#ff0000', opacity: 50 },
      supersetTheme,
    ),
  ).toBe('rgba(255, 0, 0, 0.5)');
  expect(
    fillBackground(
      { type: 'gradient', color: '#000000', color2: '#ffffff', angle: 90 },
      supersetTheme,
    ),
  ).toBe('linear-gradient(90deg, rgb(0, 0, 0), rgb(255, 255, 255))');
  expect(
    textCss(
      { size: 20, verticalAlign: 'bottom', uppercase: true },
      supersetTheme,
    ),
  ).toMatchObject({
    fontSize: 20,
    justifyContent: 'flex-end',
    textTransform: 'uppercase',
  });
  expect(starPoints().split(' ')).toHaveLength(10);
});

test('renders each element', () => {
  render(
    <>
      <ImageView
        editMode={false}
        config={{ kind: 'image', src: '/x.png', alt: 'Logo', grayscale: true }}
      />
      <ShapeView
        id="s"
        editMode={false}
        config={{
          kind: 'shape',
          shape: 'hexagon',
          fill: { type: 'gradient' },
          text: 'Hola',
        }}
      />
      <TextView
        editing={false}
        editMode={false}
        onChange={jest.fn()}
        config={{ kind: 'text', html: '<b>Título</b>' }}
      />
    </>,
    { useRedux: true },
  );
  expect(screen.getByAltText('Logo')).toHaveStyle({ filter: 'grayscale(1)' });
  expect(
    screen.getByTestId('mibi-shape-hexagon').querySelector('polygon'),
  ).toBeTruthy();
  expect(screen.getByText('Hola')).toBeInTheDocument();
  expect(screen.getByTestId('mibi-text').innerHTML).toBe('<b>Título</b>');
});

test('an empty image shows a hint only while editing', () => {
  const { rerender } = render(
    <ImageView editMode config={{ kind: 'image' }} />,
    { useRedux: true },
  );
  expect(screen.getByTestId('mibi-image-placeholder')).toBeInTheDocument();
  rerender(<ImageView editMode={false} config={{ kind: 'image' }} />);
  expect(
    screen.queryByTestId('mibi-image-placeholder'),
  ).not.toBeInTheDocument();
});

test('buttons run their action in view mode, not while editing', () => {
  const store = makeStore();
  const config = {
    ...ELEMENT_DEFAULTS.button.element,
    kind: 'button' as const,
    label: 'Detalle',
    action: { type: 'page' as const, tabId: 'TAB-b' },
  };
  const { rerender } = render(<ButtonView editMode config={config} />, {
    store,
  });
  fireEvent.click(screen.getByTestId('mibi-button'));
  expect(stateOf(store).dashboardState.directPathToChild).toBeUndefined();

  rerender(<ButtonView editMode={false} config={config} />);
  fireEvent.click(screen.getByTestId('mibi-button'));
  expect(stateOf(store).dashboardState.directPathToChild).toEqual([
    'ROOT_ID',
    'TABS-1',
    'TAB-b',
  ]);
});

test('reset filters puts every filter back to its default', () => {
  const store = makeStore();
  runElementAction({ type: 'reset-filters' }, dispatcher(store) as never, () =>
    stateOf(store),
  );
  expect(stateOf(store).dataMask.f1.filterState?.value).toEqual(['Norte']);
});

test('new elements dropped on the grid get a row and keep their width', () => {
  const entities = newEntitiesFromDrop({
    dropResult: {
      source: { id: 'NEW_COMPONENTS_SOURCE_ID', type: 'NEW_COMPONENT_SOURCE' },
      destination: { id: 'GRID_ID', type: 'GRID', index: 0 },
      dragging: {
        id: 'NEW_MIBI_SHAPE',
        type: 'DYNAMIC',
        meta: { componentKey: 'mibi-shape', width: 3, height: 20 },
      },
      position: 'DROP_TOP',
    },
    layout: {
      GRID_ID: {
        id: 'GRID_ID',
        type: 'GRID',
        children: [],
        parents: ['ROOT_ID'],
        meta: {},
      },
    },
  } as never);
  const created = Object.values(entities);
  const row = created.find(entity => entity.type === 'ROW');
  const shape = created.find(entity => entity.type === 'DYNAMIC');
  expect(row?.children).toEqual([shape?.id]);
  expect(shape?.meta).toMatchObject({ componentKey: 'mibi-shape', width: 3 });
});

test('the Format pane edits the selected button', () => {
  const store = makeStore();
  render(<FormatPane />, { store });
  act(() => selectVisual('DYNAMIC-btn'));
  expect(screen.getByTestId('mibi-format-title')).toHaveTextContent('Button');

  fireEvent.change(screen.getByTestId('mibi-button-label'), {
    target: { value: 'Ver más' },
  });
  fireEvent.click(screen.getByTestId('mibi-button-preset-outline'));
  const element = stateOf(store).dashboardLayout.present['DYNAMIC-btn'].meta
    .mibiElement as { label: string; borderWidth: number };
  expect(element.label).toBe('Ver más');
  expect(element.borderWidth).toBe(1);

  dispatcher(store)(
    setElementConfig('DYNAMIC-btn', { kind: 'button', label: 'Otra' }),
  );
  expect(screen.getByTestId('mibi-button-label')).toHaveValue('Otra');
});
