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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { setAllLocked, isObjectLocked } from 'src/mibi/format/lock';
import { selectVisual } from 'src/mibi/format/selection';
import { SelectionPane } from 'src/mibi/format/SelectionPane';
import { Section, FormatSearchContext } from 'src/mibi/format/controls';
import { visibleTabs, HIDDEN_PAGE_KEY } from 'src/mibi/present/dashboardTabs';
import { Ribbon, type RibbonProps } from './Ribbon';

const layout = {
  [DASHBOARD_ROOT_ID]: {
    id: DASHBOARD_ROOT_ID,
    type: 'ROOT',
    children: ['TABS-1'],
    meta: {},
  },
  'TABS-1': {
    id: 'TABS-1',
    type: 'TABS',
    children: ['TAB-1', 'TAB-2'],
    parents: [DASHBOARD_ROOT_ID],
    meta: {},
  },
  'TAB-1': {
    id: 'TAB-1',
    type: 'TAB',
    children: ['ROW-1'],
    parents: [DASHBOARD_ROOT_ID, 'TABS-1'],
    meta: { text: 'One' },
  },
  'TAB-2': {
    id: 'TAB-2',
    type: 'TAB',
    children: [],
    parents: [DASHBOARD_ROOT_ID, 'TABS-1'],
    meta: { text: 'Two', [HIDDEN_PAGE_KEY]: true },
  },
  'ROW-1': {
    id: 'ROW-1',
    type: 'ROW',
    children: ['CHART-1'],
    parents: [DASHBOARD_ROOT_ID, 'TABS-1', 'TAB-1'],
    meta: {},
  },
  'CHART-1': {
    id: 'CHART-1',
    type: 'CHART',
    children: [],
    parents: [DASHBOARD_ROOT_ID, 'TABS-1', 'TAB-1', 'ROW-1'],
    meta: {
      chartId: 7,
      sliceName: 'Sales',
      width: 4,
      height: 4,
      mibiPos: { x: 0, y: 0 },
    },
  },
};

const initialState = {
  dashboardLayout: { present: layout, past: [], future: [] },
  dashboardState: { activeTabs: ['TAB-1'] },
  dashboardInfo: { id: 1 },
  nativeFilters: { filters: {} },
  user: { roles: {} },
};

const handlers = (): RibbonProps => ({
  hasUnsavedChanges: true,
  canUndo: false,
  canRedo: false,
  onSave: jest.fn(),
  onDiscard: jest.fn(),
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  onRefresh: jest.fn(),
  onExport: jest.fn(),
  onProperties: jest.fn(),
});

const renderRibbon = (props: RibbonProps = handlers()) =>
  render(<Ribbon {...props} />, { useRedux: true, initialState });

afterEach(() => {
  selectVisual(null);
  setAllLocked(false);
  window.localStorage.clear();
});

test('saves from its button and with Ctrl+S', () => {
  const props = handlers();
  renderRibbon(props);
  userEvent.click(screen.getByTestId('header-save-button'));
  expect(props.onSave).toHaveBeenCalledTimes(1);

  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }),
  );
  expect(props.onSave).toHaveBeenCalledTimes(2);
});

test('shows the object tabs only with an object selected', async () => {
  renderRibbon();
  expect(
    screen.queryByTestId('mibi-ribbon-tab-format'),
  ).not.toBeInTheDocument();

  selectVisual('CHART-1');
  expect(
    await screen.findByTestId('mibi-ribbon-tab-format'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('mibi-ribbon-tab-data')).toBeInTheDocument();

  userEvent.click(screen.getByTestId('mibi-ribbon-tab-format'));
  expect(screen.getByTestId('mibi-ribbon-lock-object')).toBeInTheDocument();

  selectVisual(null);
  await waitFor(() =>
    expect(screen.getByTestId('header-save-button')).toBeInTheDocument(),
  );
});

test('folds to its tabs and opens again with one', () => {
  renderRibbon();
  userEvent.click(screen.getByTestId('mibi-ribbon-fold'));
  expect(screen.queryByTestId('header-save-button')).not.toBeInTheDocument();

  userEvent.click(screen.getByTestId('mibi-ribbon-tab-insert'));
  expect(screen.getByTestId('mibi-ribbon-insert-shape')).toBeInTheDocument();
});

test('"Lock objects" locks every object while it is on', () => {
  renderRibbon();
  expect(isObjectLocked({})).toBe(false);
  userEvent.click(screen.getByTestId('mibi-ribbon-tab-view'));
  userEvent.click(screen.getByTestId('mibi-ribbon-lock'));
  expect(isObjectLocked({})).toBe(true);
});

test('the Selection pane lists the page and sets hidden and locked', () => {
  render(<SelectionPane />, { useRedux: true, initialState });
  expect(screen.getByTestId('mibi-selection-row')).toHaveTextContent('Sales');
  expect(screen.getByRole('button', { name: 'Lock' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
});

test('viewers go through the visible pages only', () => {
  expect(visibleTabs(layout as never).map(tab => tab.id)).toEqual(['TAB-1']);
});

test('a section folds from its heading and shows what the search asks', () => {
  const content = (
    <Section>
      <h4>Shadow</h4>
      <span>Soft</span>
    </Section>
  );
  const { rerender } = render(
    <FormatSearchContext.Provider value="">
      {content}
    </FormatSearchContext.Provider>,
    { useTheme: true },
  );
  expect(screen.getByText('Soft')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Shadow' }));
  expect(screen.queryByText('Soft')).not.toBeInTheDocument();

  rerender(
    <FormatSearchContext.Provider value="soft">
      {content}
    </FormatSearchContext.Provider>,
  );
  expect(screen.getByText('Soft')).toBeInTheDocument();

  rerender(
    <FormatSearchContext.Provider value="title">
      {content}
    </FormatSearchContext.Provider>,
  );
  expect(screen.queryByText('Shadow')).not.toBeInTheDocument();
});
