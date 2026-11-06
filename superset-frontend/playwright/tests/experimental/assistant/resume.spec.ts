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
  ask,
  expect,
  openPanel,
  panelAfterReload,
  say,
  test,
} from './fakeAnthropic';

const LONG_ANSWER = `${'palabra '.repeat(60)}fin de la respuesta.`;

test('a reload in the middle of an answer shows it whole', async ({
  page,
  anthropic,
}) => {
  anthropic.script(say(LONG_ANSWER, 120));
  await openPanel(page);
  await ask(page, 'Una respuesta larga');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'palabra',
  );

  await page.reload();
  await panelAfterReload(page);

  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'fin de la respuesta.',
    { timeout: 30000 },
  );
  await expect(page.getByTestId('auradata-assistant-send')).toBeVisible();
});

test('stop ends a turn that a closed page left running', async ({
  page,
  anthropic,
}) => {
  anthropic.script(say(LONG_ANSWER, 500), say('Sigo aquí.'));
  await openPanel(page);
  await ask(page, 'Una respuesta larga');
  await expect(page.getByTestId('auradata-assistant-answer')).toContainText(
    'palabra',
  );

  await page.reload();
  await panelAfterReload(page);
  await page.getByTestId('auradata-assistant-stop').click();

  await expect(page.getByTestId('auradata-assistant-send')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId('auradata-assistant-answer')).not.toContainText(
    'fin de la respuesta.',
  );

  await ask(page, '¿Sigues?');
  await expect(
    page.getByTestId('auradata-assistant-answer').last(),
  ).toContainText('Sigo aquí.');
});
