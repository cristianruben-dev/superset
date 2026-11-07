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

import { Page, Locator, expect } from '@playwright/test';
import { Button, Table } from '../components/core';
import { BulkSelect, BulkSelectActionKey } from '../components/ListView';
import { gotoWithRetry } from '../helpers/navigation';
import { URL } from '../utils/urls';

/**
 * Dashboard List Page object. Dashboards are always a grid of cards.
 */
export class DashboardListPage {
  private readonly page: Page;
  readonly bulkSelect: BulkSelect;

  private static readonly TEST_IDS = {
    LIST: 'dashboard-list-view',
    CARD: 'auradata-dashboard-card',
    CHECKBOX: 'card-select-checkbox',
    DELETE: 'dashboard-card-option-delete-button',
    EDIT: 'dashboard-card-option-edit-button',
    EXPORT: 'dashboard-card-option-export-button',
  } as const;

  constructor(page: Page) {
    this.page = page;
    this.bulkSelect = new BulkSelect(page, new Table(page));
  }

  /**
   * Navigate to the dashboard list page.
   */
  async goto(): Promise<void> {
    await gotoWithRetry(this.page, URL.DASHBOARD_LIST);
  }

  /**
   * Wait for the list to load
   * @param options - Optional wait options
   */
  async waitForListLoad(options?: { timeout?: number }): Promise<void> {
    await this.page
      .getByTestId(DashboardListPage.TEST_IDS.LIST)
      .waitFor({ state: 'visible', ...options });
  }

  /**
   * Gets a dashboard card locator by name.
   * Returns a Locator that tests can use with expect().toBeVisible(), etc.
   *
   * @param dashboardName - The name of the dashboard
   * @returns Locator for the dashboard card
   */
  getCard(dashboardName: string): Locator {
    return this.page
      .getByTestId(DashboardListPage.TEST_IDS.CARD)
      .filter({ hasText: dashboardName });
  }

  /**
   * Opens the "more" menu of a card and clicks one of its options.
   * The menu renders in a portal, so the option is looked up on the page.
   */
  private async clickCardOption(
    dashboardName: string,
    testId: string,
  ): Promise<void> {
    await this.getCard(dashboardName).getByRole('img', { name: 'more' }).click();
    await this.page.getByTestId(testId).click();
  }

  /**
   * Clicks the delete option of a dashboard card
   * @param dashboardName - The name of the dashboard to delete
   */
  async clickDeleteAction(dashboardName: string): Promise<void> {
    await this.clickCardOption(
      dashboardName,
      DashboardListPage.TEST_IDS.DELETE,
    );
  }

  /**
   * Clicks the edit option of a dashboard card
   * @param dashboardName - The name of the dashboard to edit
   */
  async clickEditAction(dashboardName: string): Promise<void> {
    await this.clickCardOption(dashboardName, DashboardListPage.TEST_IDS.EDIT);
  }

  /**
   * Clicks the export option of a dashboard card
   * @param dashboardName - The name of the dashboard to export
   */
  async clickExportAction(dashboardName: string): Promise<void> {
    await this.clickCardOption(
      dashboardName,
      DashboardListPage.TEST_IDS.EXPORT,
    );
  }

  /**
   * Selects a dashboard through the checkbox of its card, which sits next to
   * the card, in the wrapper of the grid. Asserts the checkbox is checked so a
   * state-update race surfaces here rather than as a missing bulk action later.
   * @param dashboardName - The name of the dashboard to select
   */
  async selectDashboardCheckbox(dashboardName: string): Promise<void> {
    const checkbox = this.getCard(dashboardName)
      .locator('..')
      .getByTestId(DashboardListPage.TEST_IDS.CHECKBOX);
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }

  /**
   * Clicks a bulk action button by its stable action key (e.g., "delete", "export").
   * @param actionKey - The stable key of the bulk action to click
   */
  async clickBulkAction(actionKey: BulkSelectActionKey): Promise<void> {
    await this.bulkSelect.clickAction(actionKey);
  }

  /**
   * Clicks the import button on the dashboard list page
   */
  async clickImportButton(): Promise<void> {
    await new Button(this.page, this.page.getByTestId('import-button')).click();
  }
}
