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

import { ask, expect, openPanel, say, test } from './fakeAnthropic';

test('the list finds, renames and deletes conversations', async ({
  page,
  anthropic,
}) => {
  anthropic.script(say('Primera respuesta.'), say('Segunda respuesta.'));
  await openPanel(page);
  await ask(page, 'Sobre ventas del norte');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Primera',
  );
  await page.getByTestId('auradata-assistant-new').click();
  await ask(page, 'Sobre costos del sur');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Segunda',
  );

  await page.getByTestId('auradata-assistant-history').click();
  const rows = page.getByTestId('auradata-assistant-conversation');
  await expect(rows.filter({ hasText: 'Sobre' })).toHaveCount(2);

  await page.getByTestId('auradata-assistant-search').fill('costos');
  await expect(rows).toHaveCount(1);
  await page.getByTestId('auradata-assistant-rename').click();
  await page.getByTestId('auradata-assistant-rename-input').fill('Costos 2025');
  await page.getByTestId('auradata-assistant-rename-input').press('Enter');
  await expect(rows).toContainText('Costos 2025');

  await page.getByTestId('auradata-assistant-delete').click();
  await page.getByTestId('auradata-assistant-delete-confirm').click();
  await expect(rows).toHaveCount(0);

  await page.getByTestId('auradata-assistant-search').fill('norte');
  await expect(rows).toHaveCount(1);
  await rows.getByRole('button').first().click();
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Primera',
  );
});
