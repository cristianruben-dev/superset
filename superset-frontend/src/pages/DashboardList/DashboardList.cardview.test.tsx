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
import fetchMock from 'fetch-mock';
import { fireEvent, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { isFeatureEnabled } from '@superset-ui/core';
import {
  mockDashboards,
  mockHandleResourceExport,
  renderDashboardList,
  renderDashboardListAsCards,
  setupMocks,
  getLatestDashboardApiCall,
} from './DashboardList.testHelpers';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/export', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_write', 'Dashboard'],
      ['can_export', 'Dashboard'],
    ],
  },
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('DashboardList Card View Tests', () => {
  beforeEach(() => {
    setupMocks();

    // Enable card view as default
    (
      isFeatureEnabled as jest.MockedFunction<typeof isFeatureEnabled>
    ).mockImplementation(
      (feature: string) => feature === 'LISTVIEWS_DEFAULT_CARD_VIEW',
    );
  });

  afterEach(() => fetchMock.clearHistory().removeRoutes());

  test('renders cards, with no table and no view selector', async () => {
    renderDashboardListAsCards(mockUser);

    await screen.findByTestId('dashboard-list-view');

    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'appstore' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'unordered-list' })).toBeNull();
  });

  test('stays on the cards when the address asks for a table', async () => {
    renderDashboardList(mockUser, {}, {}, '/?viewMode=table');

    await screen.findByText(mockDashboards[0].dashboard_title);

    expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
  });

  test('cards show the editors of each dashboard', async () => {
    renderDashboardListAsCards(mockUser);

    await screen.findByText(mockDashboards[0].dashboard_title);

    expect(screen.getAllByTestId('dashboard-card-people')).toHaveLength(
      mockDashboards.length,
    );
  });

  test('displays dashboard data correctly in cards', async () => {
    renderDashboardListAsCards(mockUser);

    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Verify favorite stars exist (one per dashboard)
    const favoriteStars = screen.getAllByTestId('fave-unfave-icon');
    expect(favoriteStars).toHaveLength(mockDashboards.length);

    // Verify action menu exists (more button for each card)
    const moreButtons = screen.getAllByLabelText('more');
    expect(moreButtons).toHaveLength(mockDashboards.length);

    // Verify menu items appear on click
    fireEvent.click(moreButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  test('renders sort dropdown in card view', async () => {
    renderDashboardListAsCards(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(screen.queryByTestId('listview-table')).not.toBeInTheDocument();
    });

    const sortFilter = screen.getByTestId('card-sort-select');
    expect(sortFilter).toBeInTheDocument();
    expect(sortFilter).toBeVisible();
  });

  test('selecting a sort option triggers new API call', async () => {
    renderDashboardListAsCards(mockUser);
    await screen.findByTestId('dashboard-list-view');

    await waitFor(() => {
      expect(
        screen.getByText(mockDashboards[0].dashboard_title),
      ).toBeInTheDocument();
    });

    // Find the sort select by its testId, then the pill button within it
    const sortContainer = screen.getByTestId('card-sort-select');
    // eslint-disable-next-line testing-library/no-node-access
    const sortPill = sortContainer.querySelector(
      '[data-test="compact-filter-pill"]',
    ) as HTMLElement;
    await userEvent.click(sortPill);

    // Select "Alphabetical" from the dropdown
    const alphabeticalOption = await screen.findByText('Alphabetical');
    await userEvent.click(alphabeticalOption);

    await waitFor(() => {
      const latest = getLatestDashboardApiCall();
      expect(latest).not.toBeNull();
      expect(latest!.query).toMatchObject({
        order_column: 'dashboard_title',
        order_direction: 'asc',
      });
    });
  });

  const waitForCards = async () => {
    renderDashboardListAsCards(mockUser);
    await screen.findByText(mockDashboards[0].dashboard_title);
    return screen.getAllByTestId('card-select-checkbox');
  };

  test('cards have their checkbox, without a bulk select button', async () => {
    const checkboxes = await waitForCards();

    expect(checkboxes).toHaveLength(mockDashboards.length);
    expect(screen.queryByTestId('bulk-select')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();
  });

  test('can select all and deselect all dashboards', async () => {
    const checkboxes = await waitForCards();

    fireEvent.click(checkboxes[0]);

    expect(await screen.findByTestId('bulk-select-copy')).toHaveTextContent(
      '1 Selected',
    );
    const bulkActions = screen.getAllByTestId('bulk-select-action');
    expect(bulkActions.find(btn => btn.textContent === 'Delete')).toBeTruthy();
    expect(bulkActions.find(btn => btn.textContent === 'Export')).toBeTruthy();

    fireEvent.click(screen.getByTestId('bulk-select-all'));
    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });

    fireEvent.click(screen.getByTestId('bulk-select-deselect-all'));
    await waitFor(() => {
      expect(
        screen.queryByTestId('bulk-select-controls'),
      ).not.toBeInTheDocument();
    });
  });

  test('can bulk export selected dashboards', async () => {
    const checkboxes = await waitForCards();

    checkboxes.forEach(checkbox => fireEvent.click(checkbox));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });
    fireEvent.click(screen.getByText('Export'));

    expect(mockHandleResourceExport).toHaveBeenCalledWith(
      'dashboard',
      mockDashboards.map(d => d.id),
      expect.any(Function),
    );
  });

  test('can bulk delete selected dashboards', async () => {
    const checkboxes = await waitForCards();

    checkboxes.forEach(checkbox => fireEvent.click(checkbox));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-select-copy')).toHaveTextContent(
        `${mockDashboards.length} Selected`,
      );
    });
    fireEvent.click(screen.getByText('Delete'));
    await screen.findByText('Please confirm');

    await userEvent.type(screen.getByTestId('delete-modal-input'), 'DELETE');
    fetchMock.delete('glob:*/api/v1/dashboard/?*', {
      message: 'Dashboards deleted',
    });
    fireEvent.click(screen.getByTestId('modal-confirm-button'));

    await waitFor(() => {
      const deleteCalls = fetchMock.callHistory.calls(
        /api\/v1\/dashboard\/\?/,
        { method: 'DELETE' },
      );
      expect(deleteCalls).toHaveLength(1);
    });
  });

  test('a click on a card still opens it', async () => {
    await waitForCards();

    fireEvent.click(screen.getByText(mockDashboards[0].dashboard_title));

    expect(
      screen.queryByTestId('bulk-select-controls'),
    ).not.toBeInTheDocument();
  });

  test('a right click on a card opens its menu', async () => {
    await waitForCards();

    fireEvent.contextMenu(screen.getByText(mockDashboards[0].dashboard_title));

    expect(await screen.findByText('Open in a new tab')).toBeInTheDocument();
  });
});
