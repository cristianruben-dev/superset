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
import { render, screen } from 'spec/helpers/testing-library';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { DASHBOARD_GRID_TYPE } from 'src/dashboard/util/componentTypes';
import DashboardGrid from './DashboardGrid';

const previewState = {
  isPanelOpen: true,
  entityType: 'dashboard',
  include: 'all',
  preview: {
    entityUuid: 'dash-uuid',
    versionUuid: 'version-uuid',
    transactionId: 7,
    headline: 'Dec 5, 2025, 12:18 PM',
    issuedAt: '2025-12-05T17:18:00',
  },
  sessionLog: [],
  restoreCount: 0,
  lastRestoredEntityUuid: null,
};

const renderEmptyGrid = (versionHistory?: typeof previewState) =>
  render(
    <DashboardGrid
      depth={1}
      gridComponent={{
        ...newComponentFactory(DASHBOARD_GRID_TYPE),
        children: [],
      }}
      width={500}
      isComponentVisible
    />,
    {
      useRedux: true,
      useDnd: true,
      initialState: {
        dashboardState: { editMode: false },
        dashboardInfo: { id: 1, dash_edit_perm: true },
        ...(versionHistory ? { versionHistory } : {}),
      },
    },
  );

test('offers an editor the edit action of an empty dashboard', () => {
  renderEmptyGrid();

  expect(
    screen.getByRole('button', { name: 'Edit the dashboard' }),
  ).toBeVisible();
});

test('withholds the edit action of an empty dashboard while previewing a version', () => {
  renderEmptyGrid(previewState);

  // The message still describes what is on screen; only the edit is withdrawn
  expect(
    screen.getByText('There are no charts added to this dashboard'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Edit the dashboard' }),
  ).not.toBeInTheDocument();
});
