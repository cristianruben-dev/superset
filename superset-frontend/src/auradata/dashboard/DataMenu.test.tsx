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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { OPEN_CHART_EDITOR, type OpenChartEditorDetail } from '../chartEditor';
import { DataMenu } from './DataMenu';

const renderMenu = (permissions: [string, string][]) =>
  render(<DataMenu />, {
    useRedux: true,
    initialState: { user: { roles: { Editor: permissions } } },
  });

test('opens the datasets and SQL Lab in the side panel', async () => {
  const opened: OpenChartEditorDetail[] = [];
  const onOpen = (event: Event) =>
    opened.push((event as CustomEvent<OpenChartEditorDetail>).detail);
  window.addEventListener(OPEN_CHART_EDITOR, onOpen);

  renderMenu([
    ['can_read', 'Dataset'],
    ['can_write', 'Dataset'],
    ['can_sqllab', 'Superset'],
  ]);
  userEvent.click(screen.getByTestId('auradata-data-menu'));
  userEvent.click(await screen.findByText('SQL editor'));
  userEvent.click(screen.getByTestId('auradata-data-menu'));
  userEvent.click(await screen.findByText('Datasets'));

  expect(opened).toEqual([
    { url: '/sqllab/', kind: 'sql' },
    { url: '/data/', kind: 'data' },
  ]);
  window.removeEventListener(OPEN_CHART_EDITOR, onOpen);
});

test('offers only what the user can do', async () => {
  renderMenu([['can_read', 'Dataset']]);
  userEvent.click(screen.getByTestId('auradata-data-menu'));

  expect(await screen.findByText('Datasets')).toBeInTheDocument();
  expect(screen.queryByText('New dataset')).not.toBeInTheDocument();
  expect(screen.queryByText('SQL editor')).not.toBeInTheDocument();
});

test('hides the menu without data permissions', () => {
  renderMenu([['can_read', 'Dashboard']]);

  expect(screen.queryByTestId('auradata-data-menu')).not.toBeInTheDocument();
});
