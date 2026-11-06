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

test('the commands work from the keyboard', async ({ page, anthropic }) => {
  anthropic.script(say('Resumen de la página.'), say('Otra respuesta.'));
  await openPanel(page);
  const input = page.getByTestId('auradata-assistant-input');

  await input.fill('/');
  const menu = page.getByTestId('auradata-assistant-commands');
  await expect(menu).toBeVisible();
  // Nothing to start over from yet, and nothing to undo
  await expect(menu.getByRole('option')).toHaveCount(2);

  await input.fill('/res');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await input.press('Enter');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Resumen de la página',
  );
  expect(anthropic.requests).toHaveLength(1);
  expect(JSON.stringify(anthropic.requests[0].messages)).not.toContain(
    '/resumen',
  );

  await input.fill('/nuevo');
  await input.press('Enter');
  await expect(page.getByTestId('auradata-assistant-answer')).toHaveCount(0);

  await input.fill('/modelo');
  await input.press('Enter');
  await expect(page.getByRole('listbox').last()).toBeVisible();
  await page.keyboard.press('Escape');

  await ask(page, 'Sigue funcionando');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'Otra respuesta',
  );
});

test('the commands answer to their english names', async ({
  page,
  anthropic,
}) => {
  anthropic.script(say('A summary.'));
  await openPanel(page);
  const input = page.getByTestId('auradata-assistant-input');

  await input.fill('/summ');
  await expect(
    page.getByTestId('auradata-assistant-commands').getByRole('option'),
  ).toHaveCount(1);
  await input.press('Enter');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'A summary',
  );
});
