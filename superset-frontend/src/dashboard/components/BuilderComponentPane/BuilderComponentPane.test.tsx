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

import { act, render, screen, userEvent } from 'spec/helpers/testing-library';
import { openFormat } from 'src/auradata/format/selection';
import {
  openBuilderTab,
  PANE_NAMES,
  setBuilderTab,
  setPaneCollapsed,
} from 'src/auradata/format/panes';
import { useAssistantAccess } from 'src/auradata/assistant/useAssistant';
import BuilderComponentPane from '.';

jest.mock('src/auradata/assistant/useAssistant', () => ({
  useAssistantAccess: jest.fn(() => ({ models: [], editModels: [] })),
}));

jest.mock('src/auradata/assistant/AssistantPanel', () => ({
  AssistantChat: () => <div data-test="mock-assistant" />,
}));

jest.mock('src/dashboard/containers/SliceAdder', () => () => (
  <div data-test="mock-slice-adder" />
));

const renderPane = () =>
  render(<BuilderComponentPane topOffset={115} />, {
    useRedux: true,
    initialState: {
      dashboardState: { nativeFiltersBarOpen: false, editMode: true },
      dashboardLayout: { present: {}, past: [], future: [] },
      dashboardInfo: { id: 1 },
    },
  });

const toggleOf = (pane: string) =>
  screen.getByTestId(`auradata-pane-${pane}-toggle`);

beforeEach(() => {
  act(() => {
    PANE_NAMES.forEach(pane => setPaneCollapsed(pane, pane !== 'builder'));
    setBuilderTab('FORMAT');
  });
});

test('shows each pane side by side, the Format pane open and the rest folded', () => {
  renderPane();
  const panes = screen.getAllByRole('region');
  expect(panes.map(pane => pane.getAttribute('aria-label'))).toEqual([
    'Bookmarks',
    'Selection',
    'Format',
    'Data',
  ]);
  expect(toggleOf('builder')).toHaveAttribute('aria-expanded', 'true');
  expect(toggleOf('selection')).toHaveAttribute('aria-expanded', 'false');
  expect(toggleOf('data')).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByTestId('auradata-format-pane')).toBeInTheDocument();
});

test('a folded pane is a strip with its name that opens beside the others', () => {
  renderPane();
  expect(toggleOf('selection')).toHaveTextContent('Selection');
  expect(
    screen.queryByTestId('auradata-selection-pane'),
  ).not.toBeInTheDocument();

  userEvent.click(toggleOf('selection'));
  expect(screen.getByTestId('auradata-selection-pane')).toBeInTheDocument();
  expect(screen.getByTestId('auradata-format-pane')).toBeInTheDocument();

  userEvent.click(toggleOf('builder'));
  expect(screen.queryByTestId('auradata-format-pane')).not.toBeInTheDocument();
  expect(screen.getByTestId('auradata-selection-pane')).toBeInTheDocument();
  expect(toggleOf('builder')).toHaveAttribute('aria-expanded', 'false');
});

test('opens the Format pane when a chart asks for it', () => {
  act(() => setPaneCollapsed('builder', true));
  renderPane();
  act(() => openFormat(null));
  expect(toggleOf('builder')).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('auradata-format-pane')).toBeInTheDocument();
});

test('the ribbon opens a pane, and the galleries in the Format pane', () => {
  renderPane();
  act(() => openBuilderTab('BOOKMARKS'));
  expect(toggleOf('bookmarks')).toHaveAttribute('aria-expanded', 'true');

  act(() => openBuilderTab('CHARTS'));
  expect(screen.getByTestId('mock-slice-adder')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Charts' })).toBeInTheDocument();

  userEvent.click(screen.getByTestId('auradata-pane-builder-back'));
  expect(screen.getByTestId('auradata-format-pane')).toBeInTheDocument();
});

test('has the assistant only when it answers', () => {
  (useAssistantAccess as jest.Mock).mockReturnValue({
    models: [{ id: 'model' }],
    editModels: [{ id: 'model' }],
  });
  renderPane();

  const panes = screen.getAllByRole('region');
  expect(panes).toHaveLength(5);
  expect(panes[4]).toHaveAttribute('aria-label', 'Assistant');
  (useAssistantAccess as jest.Mock).mockReturnValue({
    models: [],
    editModels: [],
  });
});
